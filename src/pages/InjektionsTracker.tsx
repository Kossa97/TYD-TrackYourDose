import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, AlertTriangle, Copy, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { InjectionMapCanvas } from '../components/injection3d/InjectionMapCanvas'
import { InjectionIntroSheet, INJECTION_INTRO_VERSION } from '../components/injection3d/InjectionIntroSheet'
import { InjectionLogSheet } from '../components/injection3d/InjectionLogSheet'
import { InjectionHistorySheet } from '../components/injection3d/InjectionHistorySheet'
import {
  loadInjectionLogs,
  loadSelectableInjectionCycles,
  saveInjectionLog,
} from '../lib/injectionPersistence'
import { filterRecentInjectionLogs, proximityWarning } from '../lib/injectionGeometry'
import type {
  InjectionLog3D,
  InjectionPinDraft,
  InjectionProximityWarning,
  SelectableInjectionCycle,
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
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users on delete cascade not null,
  dose_log_id uuid,
  site        text        not null,
  notes       text,
  logged_at   timestamptz not null default now(),
  created_at  timestamptz default now()
);
alter table injection_logs enable row level security;
create policy "Own injection logs" on injection_logs
  for all
  using     (auth.uid() = user_id)
  with check(auth.uid() = user_id);`

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

  const [logs, setLogs] = useState<InjectionLog3D[]>([])
  const [cycles, setCycles] = useState<SelectableInjectionCycle[]>([])
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)

  const [draftPin, setDraftPin] = useState<InjectionPinDraft | null>(null)
  const [showLogSheet, setShowLogSheet] = useState(false)
  const [showLast7Days, setShowLast7Days] = useState(false)
  const [visibleLogIds, setVisibleLogIds] = useState<Set<string>>(() => new Set())
  const [showIntro, setShowIntro] = useState(
    () => Number(localStorage.getItem(INTRO_STORAGE_KEY) ?? 0) < INJECTION_INTRO_VERSION,
  )

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [loadedLogs, loadedCycles] = await Promise.all([
        loadInjectionLogs(supabase, user.id),
        loadSelectableInjectionCycles(supabase, user.id),
      ])
      setLogs(loadedLogs)
      setCycles(loadedCycles)
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

  const focusLog = (log: InjectionLog3D) =>
    setVisibleLogIds(prev => new Set(prev).add(log.id))

  const toggleLogVisibility = (id: string) => {
    setVisibleLogIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleLast7Days = () => {
    setShowLast7Days(prev => {
      const nextEnabled = !prev
      if (nextEnabled) {
        const ids = filterRecentInjectionLogs(logs, new Date(), 7).map(log => log.id)
        setVisibleLogIds(prevIds => new Set([...prevIds, ...ids]))
      }
      return nextEnabled
    })
  }

  const warning = draftPin ? proximityWarning(draftPin, logs, new Date()) : NO_WARNING

  const saveDraftPin = async (input: {
    cycle: SelectableInjectionCycle | null
    dose: number | null
    unit: string | null
    method: string | null
    notes: string | null
  }) => {
    if (!user || !draftPin) return
    try {
      await saveInjectionLog(supabase, {
        userId: user.id,
        doseLogId: null,
        peptideId: input.cycle?.peptide_id ?? null,
        cycleId: input.cycle?.id ?? null,
        dose: input.dose,
        unit: input.unit,
        method: input.method,
        notes: input.notes,
        loggedAt: new Date().toISOString(),
        warningState: warning.level === 'none' ? null : warning.level,
        pin: draftPin,
      })
      toast.success('Injektion gespeichert')
      setDraftPin(null)
      setShowLogSheet(false)
      await loadData()
    } catch (error) {
      console.error('[InjektionsTracker] saveDraftPin error:', error)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
      <PageHeader onBack={() => navigate(-1)} />

      {/* ── 3D Injektionskarte ── */}
      <section style={{ ...panelStyle, padding: 0 }}>
        <InjectionMapCanvas
          draftPin={draftPin}
          logs={logs}
          visibleLogIds={visibleLogIds}
          onDraftPinChange={(pin) => { setDraftPin(pin); setShowLogSheet(false) }}
          onLogFocus={focusLog}
        />
      </section>

      {/* ── History ── */}
      <InjectionHistorySheet
        logs={loading ? [] : logs}
        showLast7Days={showLast7Days}
        visibleLogIds={visibleLogIds}
        onToggleLast7Days={toggleLast7Days}
        onToggleLog={toggleLogVisibility}
        onFocusLog={focusLog}
      />

      {/* ── Draft confirm bar (floats above the fixed bottom nav) ── */}
      {draftPin && !showLogSheet && (
        <div
          className="fixed rounded-2xl border p-3"
          style={{
            left: 10, right: 10, zIndex: 46,
            bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 10px)',
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            boxShadow: '0 -6px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex gap-3">
            <button type="button" className="btn-secondary flex-1" onClick={() => setDraftPin(null)}>Abbrechen</button>
            <button type="button" className="btn-primary flex-1" onClick={() => setShowLogSheet(true)}>Position übernehmen</button>
          </div>
        </div>
      )}

      {/* ── Log sheet ── */}
      {showLogSheet && draftPin && (
        <InjectionLogSheet
          pin={draftPin}
          cycles={cycles}
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

function PageHeader({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={onBack}
        aria-label={t('inj_back_aria', { defaultValue: 'Zurück' })}
        style={{
          width: 38, height: 38, borderRadius: 14, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-dim)',
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'var(--accent)',
        }}>
          {t('inj3d_kicker', { defaultValue: 'Injektionstracker Pro' })}
        </p>
        <h1 style={{ fontSize: '1.32rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {t('inj3d_title', { defaultValue: '3D Injektionskarte' })}
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
