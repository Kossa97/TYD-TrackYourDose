import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, AlertTriangle, Copy, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { InjectionMapCanvas, type InjectionFocusRequest } from '../components/injection3d/InjectionMapCanvas'
import { InjectionIntroSheet, INJECTION_INTRO_VERSION } from '../components/injection3d/InjectionIntroSheet'
import { InjectionLogSheet, type InjectionSaveInput } from '../components/injection3d/InjectionLogSheet'
import { InjectionTrackerTabs } from '../components/injection3d/InjectionTrackerTabs'
import {
  assertInjectionProSchema,
  confirmIntakeDoseLog,
  loadInjectionLogs,
  loadSelectableInjectionIntakes,
  isDoseLogAlreadyLinkedError,
  isInjectionProSchemaError,
  resolveInjectionDoseLogId,
  saveInjectionLog,
  type OpenInjectionIntake,
} from '../lib/injectionPersistence'
import { proximityWarning } from '../lib/injectionGeometry'
import { formatInjectionPinAge, getInjectionPinAgeColor, getInjectionPinSubstance } from '../lib/injectionPinPresentation'
import type { InjectionHistoryDays } from '../lib/injectionHistory'
import type {
  InjectionLog3D,
  InjectionPinDraft,
  InjectionProximityWarning,
} from '../lib/injectionLogTypes'

const INTRO_STORAGE_KEY = 'tyd_injection_intro_version'

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: 'linear-gradient(145deg, var(--surface), var(--surface))',
  border: '1px solid var(--border)',
  borderRadius: 22,
  boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
  position: 'relative',
  overflow: 'hidden',
}

const SETUP_SQL = `create table if not exists injection_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  dose_log_id uuid,
  site text not null,
  notes text,
  logged_at timestamptz not null default now(),
  created_at timestamptz default now()
);

alter table injection_logs
  add column if not exists peptide_id uuid references peptides on delete set null,
  add column if not exists cycle_id uuid references cycles on delete set null,
  add column if not exists dose numeric(10,3),
  add column if not exists unit text,
  add column if not exists method text,
  add column if not exists body_region text,
  add column if not exists body_side text,
  add column if not exists model_version text,
  add column if not exists position jsonb,
  add column if not exists normal jsonb,
  add column if not exists uv jsonb,
  add column if not exists camera_state jsonb,
  add column if not exists warning_state text,
  add column if not exists substance_label text;

alter table injection_logs enable row level security;

do $$ begin
  create policy "Own injection logs" on injection_logs
    for all using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null;
end $$;

create index if not exists injection_logs_user_logged_at_idx
  on injection_logs (user_id, logged_at desc);
create index if not exists injection_logs_user_cycle_idx
  on injection_logs (user_id, cycle_id, logged_at desc);
create index if not exists injection_logs_user_region_idx
  on injection_logs (user_id, body_region, body_side, logged_at desc);
create unique index if not exists injection_logs_dose_log_id_unique_idx
  on injection_logs (dose_log_id)
  where dose_log_id is not null;`;

// ── Supabase error helpers ────────────────────────────────────────────────────

function isTableMissingError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  const msg = (error.message ?? '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === 'PGRST116' ||
    msg.includes('does not exist') ||
    msg.includes('undefined table') ||
    msg.includes('relation') && msg.includes('not exist')
  )
}

const NO_WARNING: InjectionProximityWarning = { level: 'none', nearestLogId: null, distance: null }

// ── Main Component ────────────────────────────────────────────────────────────

export function InjektionsTracker() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const mapSectionRef = useRef<HTMLElement | null>(null)
  const [logs, setLogs] = useState<InjectionLog3D[]>([])
  const [openIntakes, setOpenIntakes] = useState<OpenInjectionIntake[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)

  const [draftPin, setDraftPin] = useState<InjectionPinDraft | null>(null)
  const [showLogSheet, setShowLogSheet] = useState(false)
  const [historyDays, setHistoryDays] = useState<InjectionHistoryDays>(7)
  const [trackerSheetOpen, setTrackerSheetOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState<InjectionFocusRequest | null>(null)
  const [visibleLogIds, setVisibleLogIds] = useState<Set<string>>(() => new Set())
  const [activeLogId, setActiveLogId] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(
    () => Number(localStorage.getItem(INTRO_STORAGE_KEY) ?? 0) < INJECTION_INTRO_VERSION,
  )

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [loadedLogs, loadedIntakes] = await Promise.all([
        loadInjectionLogs(supabase, user.id),
        loadSelectableInjectionIntakes(supabase, user.id),
      ])
      setLogs(loadedLogs)
      setOpenIntakes(loadedIntakes)
      setTableError(false)
    } catch (error) {
      console.error('[InjektionsTracker] loadData error:', error)
      if (isTableMissingError(error as { message?: string; code?: string })) setTableError(true)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  const closeIntro = () => setShowIntro(false)
  const dontShowIntro = () => {
    localStorage.setItem(INTRO_STORAGE_KEY, String(INJECTION_INTRO_VERSION))
    setShowIntro(false)
  }

  useEffect(() => {
    setFocusRequest(previous => previous
      ? { ...previous, requestId: previous.requestId + 1, sheetOpen: trackerSheetOpen }
      : previous)
  }, [trackerSheetOpen])

  const focusLog = (log: InjectionLog3D) => {
    setActiveLogId(log.id)
    setVisibleLogIds(prev => new Set(prev).add(log.id))
    setFocusRequest(previous => ({ log, requestId: (previous?.requestId ?? 0) + 1, sheetOpen: trackerSheetOpen }))
    requestAnimationFrame(() => mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const toggleLogVisibility = (id: string) => {
    const log = logs.find(item => item.id === id)
    setVisibleLogIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setActiveLogId(current => current === id ? null : current)
      } else {
        next.add(id)
        if (log) setActiveLogId(log.id)
      }
      return next
    })
  }

  const activeLog = activeLogId ? logs.find(log => log.id === activeLogId) ?? null : null
  const warning = draftPin ? proximityWarning(draftPin, logs, new Date()) : NO_WARNING

  const saveDraftPin = async (input: InjectionSaveInput) => {
    if (!user || !draftPin) return
    try {
      await assertInjectionProSchema(supabase)

      let doseLogId: string | null = null
      let peptideId: string | null = null
      let cycleId: string | null = null

      // From an open intake: confirm the dose (writes the dose_log + debits stock)
      // and link the injection to it.
      if (input.mode === 'intake' && input.intake) {
        peptideId = input.intake.peptideId
        cycleId = input.intake.cycleId
        doseLogId = await resolveInjectionDoseLogId(input.intake, () => confirmIntakeDoseLog(supabase, {
          userId: user.id,
          peptideId: input.intake!.peptideId,
          dose: input.dose ?? input.intake!.dose,
          unit: input.unit ?? input.intake!.unit,
          method: input.method ?? input.intake!.method,
          loggedAt: input.loggedAt,
          doseLogId: input.intake!.doseLogId,
        }))
      }

      await saveInjectionLog(supabase, {
        userId: user.id,
        doseLogId,
        peptideId,
        cycleId,
        dose: input.dose,
        unit: input.unit,
        method: input.method,
        notes: input.notes,
        loggedAt: input.loggedAt,
        warningState: warning.level === 'none' ? null : warning.level,
        substanceLabel: input.substanceLabel,
        pin: draftPin,
      })

      toast.success(input.mode === 'intake'
        ? input.intake?.status === 'confirmed'
          ? 'Injektionsstelle hinzugefügt'
          : 'Injektion & Einnahme gespeichert'
        : 'Injektion gespeichert')
      setDraftPin(null)
      setShowLogSheet(false)
      await loadData()
    } catch (error) {
      console.error('[InjektionsTracker] saveDraftPin error:', error)
      if (isDoseLogAlreadyLinkedError(error)) {
        toast.error('Für diese Einnahme wurde bereits eine Injektionsstelle gespeichert')
        setShowLogSheet(false)
        await loadData()
        return
      }
      if (isInjectionProSchemaError(error)) {
        setShowLogSheet(false)
        setTableError(true)
        toast.error('Datenbank-Update erforderlich')
        return
      }
      toast.error('Fehler beim Speichern')
    }
  }

  if (tableError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        <PageHeader onBack={() => navigate(-1)} />
        <SetupRequired onRetry={() => { setTableError(false); loadData() }} />
      </div>
    )
  }

  return (
    <div className="min-h-dvh overflow-hidden">
      {/* 3D Injektionskarte */}
      <section
        ref={mapSectionRef}
        style={{
          ...panelStyle,
          padding: 0,
          height: '100dvh',
          minHeight: '100dvh',
          border: 'none',
          borderRadius: 0,
          boxShadow: 'none',
        }}
      >
        <div style={{ position: 'relative', height: '100dvh', minHeight: '100dvh' }}>
          <PageHeader onBack={() => navigate(-1)} overlay />
          <InjectionMapCanvas
            height="100dvh"
            minHeight="100dvh"
            draftPin={draftPin}
            logs={logs}
            visibleLogIds={visibleLogIds}
            focusRequest={focusRequest}
            activeLogId={activeLogId}
            onDraftPinChange={(pin) => { setDraftPin(pin); setShowLogSheet(false) }}
            onLogFocus={focusLog}
          />

          {activeLog && visibleLogIds.has(activeLog.id) && (
            <div
              className="injection-active-pin-chip pointer-events-none absolute left-4 right-4 z-30 flex justify-center"
              style={{ top: 'calc(78px + env(safe-area-inset-top))' }}
            >
              <div
                className="flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black text-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                style={{ background: 'rgba(7, 11, 24, 0.78)', borderColor: 'rgba(255,255,255,0.12)' }}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: getInjectionPinAgeColor(activeLog.logged_at), boxShadow: '0 0 14px ' + getInjectionPinAgeColor(activeLog.logged_at) }}
                />
                <span className="truncate">
                  {getInjectionPinSubstance(activeLog)} - {formatInjectionPinAge(activeLog.logged_at)}
                </span>
              </div>
            </div>
          )}

          {draftPin && !showLogSheet && (
            <div
              className="absolute bottom-3 left-3 right-3 z-20 rounded-2xl border p-3"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                boxShadow: '0 -6px 32px rgba(0,0,0,0.5)',
              }}
            >
              <div className="flex gap-3">
                <button type="button" className="btn-secondary min-h-11 flex-1" onClick={() => setDraftPin(null)}>{t('injection_position_cancel', { defaultValue: 'Abbrechen' })}</button>
                <button type="button" className="btn-primary min-h-11 flex-1" onClick={() => setShowLogSheet(true)}>{t('injection_position_accept', { defaultValue: 'Position uebernehmen' })}</button>
              </div>
            </div>
          )}
        </div>

        {/* Tracker tabs */}
        <InjectionTrackerTabs
          logs={loading ? [] : logs}
          openIntakes={loading ? [] : openIntakes}
          historyDays={historyDays}
          visibleLogIds={visibleLogIds}
          onHistoryDaysChange={setHistoryDays}
          onToggleLog={toggleLogVisibility}
          onFocusLog={focusLog}
          onSheetOpenChange={setTrackerSheetOpen}
        />
      </section>

      {showLogSheet && draftPin && (
        <InjectionLogSheet
          pin={draftPin}
          openIntakes={openIntakes}
          cycles={[]}
          warning={warning}
          onCancel={() => setShowLogSheet(false)}
          onSave={saveDraftPin}
        />
      )}

      {/* ── Intro ── */}
      {showIntro && (
        <InjectionIntroSheet onClose={closeIntro} onDontShowAgain={dontShowIntro} />
      )}
    </div>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────────────

function PageHeader({ onBack, overlay = false }: { onBack: () => void; overlay?: boolean }) {
  const { t } = useTranslation()
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      ...(overlay ? {
        position: 'absolute',
        top: 'calc(14px + env(safe-area-inset-top))',
        left: 14,
        right: 14,
        zIndex: 25,
        pointerEvents: 'none',
      } : null),
    }}>
      <button
        onClick={onBack}
        aria-label={String(t('back', { defaultValue: 'Zurueck' }))}
        style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: overlay ? 'rgba(8,13,26,0.72)' : 'var(--surface)',
          border: '1px solid var(--border)',
          backdropFilter: overlay ? 'blur(16px)' : undefined,
          WebkitBackdropFilter: overlay ? 'blur(16px)' : undefined,
          pointerEvents: overlay ? 'auto' : undefined,
          color: 'var(--text-dim)',
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: '0.62rem', fontWeight: 800, letterSpacing: 0,
          textTransform: 'uppercase', color: 'var(--accent)',
          textShadow: overlay ? '0 2px 12px rgba(0,0,0,0.75)' : undefined,
        }}>
          {t('injection_pro_title', { defaultValue: 'Injektionstracker Pro' })}
        </p>
        <h1 style={{ fontSize: '1.32rem', fontWeight: 900, color: 'var(--text)', letterSpacing: 0, lineHeight: 1.1, textShadow: overlay ? '0 2px 14px rgba(0,0,0,0.8)' : undefined }}>
          {t('injection_map_title', { defaultValue: '3D Injektionskarte' })}
        </h1>
      </div>
    </div>
  )
}

// ── SetupRequired ─────────────────────────────────────────────────────────────

function SetupRequired({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SETUP_SQL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Clipboard nicht verfügbar')
    }
  }

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 22,
      padding: 22,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 18,
        background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 14px',
      }}>
        <AlertTriangle size={22} color="#f59e0b" />
      </div>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text)', textAlign: 'center', marginBottom: 8 }}>
        {t('inj_setup_required', { defaultValue: 'Datenbank-Setup erforderlich' })}
      </h2>
      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, textAlign: 'center', marginBottom: 18 }}>
        {t('inj_setup_hint', { defaultValue: 'Führe folgendes SQL im Supabase SQL-Editor aus, um den Injektions-Tracker zu aktivieren.' })}
      </p>

      <div style={{
        background: 'rgba(0,0,0,0.45)', border: '1px solid var(--accent-border)',
        borderRadius: 14, padding: '12px 14px', marginBottom: 14,
      }}>
        <pre style={{
          fontSize: '0.6rem', color: 'var(--accent)',
          overflowX: 'auto', margin: 0, lineHeight: 1.65,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          fontFamily: "'SF Mono', 'Fira Code', monospace",
        }}>
          {SETUP_SQL}
        </pre>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 14,
            background: 'var(--accent-weak)', border: '1px solid var(--accent-border)',
            color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <Copy size={14} />
          {copied
            ? t('inj_copied', { defaultValue: 'Kopiert ✓' })
            : t('inj_copy_sql', { defaultValue: 'SQL kopieren' })}
        </button>
        <button
          onClick={onRetry}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 14,
            background: 'var(--surface)', border: '1px solid var(--border-strong)',
            color: 'var(--text-dim)', fontSize: '0.78rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <RefreshCw size={14} />
          {t('inj_retry', { defaultValue: 'Erneut versuchen' })}
        </button>
      </div>
    </div>
  )
}
