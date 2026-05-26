import { useEffect, useState, useCallback, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, Plus, Target, RotateCcw, AlertTriangle,
  Clock, CalendarDays, Trash2, Copy, RefreshCw, ChevronRight, Syringe,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { differenceInDays, format, isToday, isYesterday, parseISO } from 'date-fns'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type SiteId =
  | 'abdomen_l' | 'abdomen_r'
  | 'thigh_l'   | 'thigh_r'
  | 'deltoid_l' | 'deltoid_r'
  | 'glute_l'   | 'glute_r'

type ViewMode = 'front' | 'back'
type SiteStatus = 'free' | 'caution' | 'warn'

interface InjectionLog {
  id: string
  user_id: string
  site: SiteId
  notes: string | null
  logged_at: string
}

interface SiteDef {
  id: SiteId
  label: string
  shortLabel: string
  view: ViewMode
  methodHint: string
}

interface ZonePos {
  cx: number
  cy: number
  rx: number
  ry: number
}

// ── Site definitions ──────────────────────────────────────────────────────────

const SITE_DEFS: SiteDef[] = [
  { id: 'abdomen_l', label: 'Bauch Links',         shortLabel: 'Bauch L',  view: 'front', methodHint: 'Subkutan' },
  { id: 'abdomen_r', label: 'Bauch Rechts',        shortLabel: 'Bauch R',  view: 'front', methodHint: 'Subkutan' },
  { id: 'thigh_l',   label: 'Oberschenkel Links',  shortLabel: 'OS Links', view: 'front', methodHint: 'Subkutan / IM' },
  { id: 'thigh_r',   label: 'Oberschenkel Rechts', shortLabel: 'OS Rechts',view: 'front', methodHint: 'Subkutan / IM' },
  { id: 'deltoid_l', label: 'Deltoid Links',       shortLabel: 'Delt. L',  view: 'front', methodHint: 'Intramuskulär' },
  { id: 'deltoid_r', label: 'Deltoid Rechts',      shortLabel: 'Delt. R',  view: 'front', methodHint: 'Intramuskulär' },
  { id: 'glute_l',   label: 'Gesäß Links',         shortLabel: 'Ges. L',   view: 'back',  methodHint: 'Intramuskulär' },
  { id: 'glute_r',   label: 'Gesäß Rechts',        shortLabel: 'Ges. R',   view: 'back',  methodHint: 'Intramuskulär' },
]

// SVG zone ellipse positions — viewBox "0 0 180 400"
const FRONT_ZONES: Record<string, ZonePos> = {
  abdomen_l:  { cx: 71,  cy: 160, rx: 16, ry: 19 },
  abdomen_r:  { cx: 109, cy: 160, rx: 16, ry: 19 },
  thigh_l:    { cx: 69,  cy: 252, rx: 14, ry: 18 },
  thigh_r:    { cx: 111, cy: 252, rx: 14, ry: 18 },
  deltoid_l:  { cx: 37,  cy: 108, rx: 13, ry: 16 },
  deltoid_r:  { cx: 143, cy: 108, rx: 13, ry: 16 },
}

const BACK_ZONES: Record<string, ZonePos> = {
  glute_l: { cx: 71,  cy: 228, rx: 22, ry: 20 },
  glute_r: { cx: 109, cy: 228, rx: 22, ry: 20 },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLastLog(siteId: SiteId, logs: InjectionLog[]): InjectionLog | null {
  const filtered = logs.filter(l => l.site === siteId)
  if (!filtered.length) return null
  return filtered.reduce((a, b) =>
    parseISO(a.logged_at) > parseISO(b.logged_at) ? a : b
  )
}

function getDaysSince(siteId: SiteId, logs: InjectionLog[]): number | null {
  const last = getLastLog(siteId, logs)
  if (!last) return null
  return differenceInDays(new Date(), parseISO(last.logged_at))
}

function getSiteStatus(siteId: SiteId, logs: InjectionLog[]): SiteStatus {
  const days = getDaysSince(siteId, logs)
  if (days === null) return 'free'
  if (days < 3) return 'warn'
  if (days < 7) return 'caution'
  return 'free'
}

function getStatusColor(status: SiteStatus): string {
  if (status === 'free') return '#10b981'
  if (status === 'caution') return '#f59e0b'
  return '#f43f5e'
}

function getRecommendedSite(logs: InjectionLog[]): SiteId {
  // Prefer never-used sites first (front before back), then least recently used
  for (const site of SITE_DEFS) {
    if (getDaysSince(site.id, logs) === null) return site.id
  }
  let best = SITE_DEFS[0].id
  let maxDays = -1
  for (const site of SITE_DEFS) {
    const d = getDaysSince(site.id, logs) ?? 999
    if (d > maxDays) { maxDays = d; best = site.id }
  }
  return best
}

function formatLogTime(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return `heute ${format(date, 'HH:mm')}`
  if (isYesterday(date)) return `gestern ${format(date, 'HH:mm')}`
  return format(date, 'dd.MM.yy · HH:mm')
}

function groupLogs(logs: InjectionLog[]) {
  const grouped: { label: string; logs: InjectionLog[] }[] = []
  const today: InjectionLog[] = []
  const yesterday: InjectionLog[] = []
  const older: InjectionLog[] = []
  for (const l of logs) {
    const d = parseISO(l.logged_at)
    if (isToday(d)) today.push(l)
    else if (isYesterday(d)) yesterday.push(l)
    else older.push(l)
  }
  if (today.length) grouped.push({ label: 'Heute', logs: today })
  if (yesterday.length) grouped.push({ label: 'Gestern', logs: yesterday })
  if (older.length) grouped.push({ label: 'Älter', logs: older })
  return grouped
}

// ── Styles ────────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: 'linear-gradient(145deg, rgba(9,14,34,0.94), rgba(4,7,18,0.96))',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 22,
  boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
  position: 'relative',
  overflow: 'hidden',
}

const labelStyle: CSSProperties = {
  fontSize: '0.62rem',
  fontWeight: 800,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'rgba(154,170,191,0.55)',
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

// ── Main Component ────────────────────────────────────────────────────────────

export function InjektionsTracker() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [logs, setLogs] = useState<InjectionLog[]>([])
  const [view, setView] = useState<ViewMode>('front')
  const [selectedSite, setSelectedSite] = useState<SiteId | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tableError, setTableError] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const loadLogs = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('injection_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(200)
      if (error) {
        console.error('[InjektionsTracker] loadLogs error:', error)
        if (isTableMissingError(error)) setTableError(true)
        return
      }
      setTableError(false)
      setLogs(data ?? [])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadLogs() }, [loadLogs])

  const handleLog = async (siteId: SiteId, notes: string) => {
    if (!user) return
    const { error } = await supabase.from('injection_logs').insert({
      user_id: user.id,
      site: siteId,
      notes: notes.trim() || null,
      logged_at: new Date().toISOString(),
    })
    if (error) {
      console.error('[InjektionsTracker] handleLog error:', error)
      if (isTableMissingError(error)) {
        setShowSheet(false)
        setSelectedSite(null)
        setTableError(true)
        return
      }
      toast.error(t('inj_save_err', { defaultValue: 'Fehler beim Speichern' }))
      return
    }
    toast.success(t('inj_save_ok', { defaultValue: 'Injektion gespeichert ✓' }))
    setShowSheet(false)
    setSelectedSite(null)
    await loadLogs()
  }

  const handleDelete = async (logId: string) => {
    setDeletingId(logId)
    const { error } = await supabase.from('injection_logs').delete().eq('id', logId)
    if (error) {
      toast.error(t('inj_delete_err', { defaultValue: 'Fehler beim Löschen' }))
    } else {
      setLogs(prev => prev.filter(l => l.id !== logId))
      toast.success(t('inj_delete_ok', { defaultValue: 'Eintrag gelöscht' }))
    }
    setDeletingId(null)
  }

  const openSheet = (siteId: SiteId) => {
    setSelectedSite(siteId)
    setShowSheet(true)
  }

  const closeSheet = () => { setShowSheet(false); setSelectedSite(null) }

  // ── Computed stats
  const siteStatuses = Object.fromEntries(
    SITE_DEFS.map(s => [s.id, getSiteStatus(s.id, logs)])
  ) as Record<SiteId, SiteStatus>

  const recommendedSite = getRecommendedSite(logs)
  const recommendedDef = SITE_DEFS.find(s => s.id === recommendedSite)!

  const now = new Date()
  const thisMonthCount = logs.filter(l => {
    const d = parseISO(l.logged_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).length

  const lastLog = logs[0] ?? null
  const lastSiteDef = lastLog ? SITE_DEFS.find(s => s.id === lastLog.site) : null

  const currentZones = view === 'front' ? FRONT_ZONES : BACK_ZONES
  const logGroups = groupLogs(logs.slice(0, 40))

  if (tableError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        <PageHeader onBack={() => navigate(-1)} onLog={undefined} />
        <SetupRequired onRetry={() => { setTableError(false); loadLogs() }} />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>

      {/* ── Header ── */}
      <PageHeader onBack={() => navigate(-1)} onLog={() => openSheet(recommendedSite)} />

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatPill
          label={t('inj_this_month', { defaultValue: 'Diesen Monat' })}
          value={String(thisMonthCount)}
          icon={<CalendarDays size={13} color="#00ccf5" />}
          accent="#00ccf5"
        />
        <StatPill
          label={t('inj_last_injection', { defaultValue: 'Letzte' })}
          value={lastLog
            ? (isToday(parseISO(lastLog.logged_at))
              ? `heute`
              : `${differenceInDays(new Date(), parseISO(lastLog.logged_at))}d`)
            : '–'}
          icon={<Clock size={13} color="#8b5cf6" />}
          accent="#8b5cf6"
        />
        <StatPill
          label={t('inj_recommended', { defaultValue: 'Empfohlen' })}
          value={recommendedDef.shortLabel}
          icon={<Target size={13} color="#10b981" />}
          accent="#10b981"
        />
      </div>

      {/* ── Body Map ── */}
      <section style={{ ...panelStyle, padding: 0 }}>
        {/* View toggle */}
        <div style={{ padding: '14px 14px 0' }}>
          <div style={{
            display: 'flex', gap: 4,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 12, padding: 3,
          }}>
            {(['front', 'back'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 9,
                  fontSize: '0.76rem', fontWeight: 800,
                  background: view === v ? 'rgba(0,204,245,0.18)' : 'transparent',
                  border: view === v ? '1px solid rgba(0,204,245,0.30)' : '1px solid transparent',
                  color: view === v ? '#00ccf5' : 'rgba(154,170,191,0.6)',
                  transition: 'all 0.18s ease',
                }}
              >
                {v === 'front'
                  ? t('inj_front', { defaultValue: 'Vorne' })
                  : t('inj_back',  { defaultValue: 'Hinten' })}
              </button>
            ))}
          </div>
        </div>

        {/* SVG body + zones */}
        <BodyMap
          view={view}
          zones={currentZones}
          siteStatuses={siteStatuses}
          recommendedSite={recommendedSite}
          onSiteClick={openSheet}
        />

        {/* Legend */}
        <div style={{ padding: '4px 14px 14px', display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { color: '#10b981', label: t('inj_legend_free',    { defaultValue: 'Frei (>7 Tage)' }) },
            { color: '#f59e0b', label: t('inj_legend_caution', { defaultValue: 'Kürzlich (3–7)' }) },
            { color: '#f43f5e', label: t('inj_legend_warn',    { defaultValue: 'Schonen (<3)' }) },
          ].map(item => (
            <div key={item.color} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, boxShadow: `0 0 6px ${item.color}60` }} />
              <span style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.55)', fontWeight: 700 }}>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Last injection banner */}
      {lastLog && lastSiteDef && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', borderRadius: 18,
          background: 'rgba(0,204,245,0.07)',
          border: '1px solid rgba(0,204,245,0.15)',
        }}>
          <Syringe size={16} color="#00ccf5" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.76rem', fontWeight: 800, color: '#eaeefc', lineHeight: 1.2 }}>
              {t('inj_last_label', { defaultValue: 'Letzte Injektion' })}: {lastSiteDef.label}
            </p>
            <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.5)', marginTop: 2 }}>
              {formatLogTime(lastLog.logged_at)}
            </p>
          </div>
          <ChevronRight size={14} color="rgba(255,255,255,0.25)" />
        </div>
      )}

      {/* ── Rotation status grid ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <p style={labelStyle}>{t('inj_rotation', { defaultValue: 'Rotation' })}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: '#eaeefc', marginTop: 2 }}>
              {t('inj_site_status', { defaultValue: 'Stellen-Status' })}
            </h2>
          </div>
          <RotateCcw size={16} color="rgba(0,204,245,0.6)" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {SITE_DEFS.map(site => {
            const status = siteStatuses[site.id]
            const color  = getStatusColor(status)
            const days   = getDaysSince(site.id, logs)
            const isRec  = site.id === recommendedSite
            return (
              <button
                key={site.id}
                onClick={() => openSheet(site.id)}
                style={{
                  ...panelStyle,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  border: isRec
                    ? '1px solid rgba(16,185,129,0.35)'
                    : '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* Status dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 8px ${color}70`,
                  flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 800, color: '#eaeefc', lineHeight: 1.2 }}>
                    {site.label}
                  </p>
                  <p style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.5)', marginTop: 2 }}>
                    {days === null
                      ? t('inj_never_used', { defaultValue: 'Noch nie' })
                      : days === 0
                        ? t('inj_today', { defaultValue: 'Heute' })
                        : t('inj_days_ago', { defaultValue: `vor ${days} Tagen`, days })}
                  </p>
                </div>
                {isRec && (
                  <span style={{
                    fontSize: '0.52rem', fontWeight: 900, letterSpacing: '0.07em',
                    textTransform: 'uppercase', color: '#10b981',
                    background: 'rgba(16,185,129,0.12)',
                    padding: '2px 6px', borderRadius: 6, flexShrink: 0,
                  }}>
                    {t('inj_rec_badge', { defaultValue: 'Empf.' })}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── History ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <p style={labelStyle}>{t('inj_history', { defaultValue: 'Verlauf' })}</p>
            <h2 style={{ fontSize: '1rem', fontWeight: 850, color: '#eaeefc', marginTop: 2 }}>
              {t('inj_latest', { defaultValue: 'Letzte Injektionen' })}
            </h2>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                height: 68, borderRadius: 18,
                background: 'rgba(9,14,34,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                animation: 'pulse 1.6s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }} />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div style={{ ...panelStyle, padding: '28px 20px', textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 18,
              background: 'rgba(0,204,245,0.08)', border: '1px solid rgba(0,204,245,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <Syringe size={20} color="rgba(0,204,245,0.5)" />
            </div>
            <p style={{ fontSize: '0.82rem', color: 'rgba(154,170,191,0.6)', lineHeight: 1.6 }}>
              {t('inj_no_logs', { defaultValue: 'Noch keine Injektionen erfasst.' })}
              {'\n'}
              {t('inj_no_logs_hint', { defaultValue: 'Tippe eine Zone im Body-Map an oder nutze „Loggen".' })}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {logGroups.map(group => (
              <div key={group.label}>
                <p style={{ ...labelStyle, marginBottom: 6, paddingLeft: 2 }}>{group.label}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {group.logs.map(log => {
                    const siteDef = SITE_DEFS.find(s => s.id === log.site)
                    const curStatus = siteStatuses[log.site as SiteId] ?? 'free'
                    const color = getStatusColor(curStatus)
                    return (
                      <div
                        key={log.id}
                        style={{
                          ...panelStyle,
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                        }}
                      >
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: color, flexShrink: 0,
                          boxShadow: `0 0 6px ${color}50`,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: 800, color: '#eaeefc' }}>
                            {siteDef?.label ?? log.site}
                          </p>
                          <div style={{ display: 'flex', gap: 8, marginTop: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                            <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.5)' }}>
                              {format(parseISO(log.logged_at), 'dd.MM.yyyy · HH:mm')}
                            </p>
                            {log.notes && (
                              <p style={{
                                fontSize: '0.62rem', color: 'rgba(154,170,191,0.38)',
                                fontStyle: 'italic',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                maxWidth: 140,
                              }}>
                                {log.notes}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={deletingId === log.id}
                          aria-label="Löschen"
                          style={{
                            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(244,63,94,0.07)',
                            border: '1px solid rgba(244,63,94,0.14)',
                            color: '#f43f5e',
                            opacity: deletingId === log.id ? 0.4 : 1,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Log Sheet ── */}
      {showSheet && selectedSite && (
        <LogSheet
          site={SITE_DEFS.find(s => s.id === selectedSite)!}
          status={siteStatuses[selectedSite]}
          daysSince={getDaysSince(selectedSite, logs)}
          onClose={closeSheet}
          onSave={notes => handleLog(selectedSite, notes)}
        />
      )}
    </div>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────────────

function PageHeader({ onBack, onLog }: { onBack: () => void; onLog?: () => void }) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={onBack}
        style={{
          width: 38, height: 38, borderRadius: 14, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(213,224,242,0.7)',
        }}
      >
        <ArrowLeft size={16} />
      </button>
      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(0,204,245,0.7)',
        }}>
          {t('inj_kicker', { defaultValue: 'Stellen-Rotation' })}
        </p>
        <h1 style={{ fontSize: '1.32rem', fontWeight: 900, color: '#f8fbff', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
          {t('inj_title', { defaultValue: 'Injektions-Tracker' })}
        </h1>
      </div>
      {onLog && (
        <button
          onClick={onLog}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 16, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,204,245,0.22), rgba(0,204,245,0.10))',
            border: '1px solid rgba(0,204,245,0.32)',
            color: '#00ccf5', fontSize: '0.76rem', fontWeight: 800,
          }}
        >
          <Plus size={15} />
          {t('inj_log_btn', { defaultValue: 'Loggen' })}
        </button>
      )}
    </div>
  )
}

// ── StatPill ──────────────────────────────────────────────────────────────────

function StatPill({ label, value, icon, accent }: {
  label: string
  value: string
  icon: React.ReactNode
  accent: string
}) {
  return (
    <div style={{
      background: 'rgba(2,6,18,0.48)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 18,
      padding: '11px 10px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        {icon}
        <p style={{
          fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.07em',
          textTransform: 'uppercase', color: 'rgba(154,170,191,0.55)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {label}
        </p>
      </div>
      <p style={{ fontSize: '1.08rem', fontWeight: 900, color: accent, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </p>
    </div>
  )
}

// ── BodyMap ───────────────────────────────────────────────────────────────────

function BodyMap({ view, zones, siteStatuses, recommendedSite, onSiteClick }: {
  view: ViewMode
  zones: Record<string, ZonePos>
  siteStatuses: Record<SiteId, SiteStatus>
  recommendedSite: SiteId
  onSiteClick: (id: SiteId) => void
}) {
  return (
    <div style={{ padding: '10px 16px 4px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg
        viewBox="0 0 180 400"
        style={{ width: '100%', maxWidth: 200, height: 'auto' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* ── Body silhouette ── */}
        <g
          fill="rgba(0,204,245,0.045)"
          stroke="rgba(0,204,245,0.14)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {/* Head */}
          <ellipse cx="90" cy="34" rx="22" ry="25" />
          {/* Neck */}
          <rect x="82" y="57" width="16" height="14" rx="5" />
          {/* Torso */}
          <path d="M 55,69 Q 48,71 46,84 L 46,200 Q 47,214 58,220 L 122,220 Q 133,214 134,200 L 134,84 Q 132,71 125,69 Z" />
          {/* Left arm */}
          <path d="M 52,73 C 42,76 34,87 30,100 L 26,185 C 26,197 32,202 42,200 C 52,198 55,190 55,178 L 56,98 Z" />
          {/* Right arm */}
          <path d="M 128,73 C 138,76 146,87 150,100 L 154,185 C 154,197 148,202 138,200 C 128,198 125,190 125,178 L 124,98 Z" />
          {/* Left leg */}
          <path d="M 58,220 L 55,265 L 52,358 C 51,373 58,378 70,378 C 82,378 85,371 83,358 L 86,265 L 90,220 Z" />
          {/* Right leg */}
          <path d="M 122,220 L 125,265 L 128,358 C 129,373 122,378 110,378 C 98,378 95,371 97,358 L 94,265 L 90,220 Z" />
        </g>

        {/* Back view label */}
        {view === 'back' && (
          <text
            x="90" y="20"
            textAnchor="middle"
            fontSize="8"
            fontWeight="700"
            fill="rgba(154,170,191,0.4)"
            letterSpacing="0.1em"
          >
            RÜCKANSICHT
          </text>
        )}

        {/* ── Injection zones ── */}
        {Object.entries(zones).map(([siteId, zone]) => {
          const status = siteStatuses[siteId as SiteId] ?? 'free'
          const color  = getStatusColor(status)
          const isRec  = siteId === recommendedSite

          return (
            <g
              key={siteId}
              onClick={() => onSiteClick(siteId as SiteId)}
              style={{ cursor: 'pointer' }}
              role="button"
              aria-label={SITE_DEFS.find(s => s.id === siteId)?.label}
            >
              {/* Outer glow halo */}
              <ellipse
                cx={zone.cx} cy={zone.cy}
                rx={zone.rx + 7} ry={zone.ry + 7}
                fill={`${color}0d`}
              />
              {/* Recommended pulse ring */}
              {isRec && (
                <ellipse
                  cx={zone.cx} cy={zone.cy}
                  rx={zone.rx + 3} ry={zone.ry + 3}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                  opacity="0.7"
                />
              )}
              {/* Main zone area */}
              <ellipse
                cx={zone.cx} cy={zone.cy}
                rx={zone.rx} ry={zone.ry}
                fill={`${color}22`}
                stroke={color}
                strokeWidth={isRec ? 2 : 1.5}
              />
              {/* Center dot */}
              <circle cx={zone.cx} cy={zone.cy} r={4} fill={color} />
              {/* Small hit-target (invisible) */}
              <ellipse
                cx={zone.cx} cy={zone.cy}
                rx={zone.rx + 8} ry={zone.ry + 8}
                fill="transparent"
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── LogSheet ──────────────────────────────────────────────────────────────────

function LogSheet({ site, status, daysSince, onClose, onSave }: {
  site: SiteDef
  status: SiteStatus
  daysSince: number | null
  onClose: () => void
  onSave: (notes: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const color = getStatusColor(status)

  const statusLabels: Record<SiteStatus, string> = {
    free:    t('inj_status_free_long',    { defaultValue: 'Frei – optimal' }),
    caution: t('inj_status_caution_long', { defaultValue: 'Kürzlich genutzt' }),
    warn:    t('inj_status_warn_long',    { defaultValue: 'Zu früh – Schonen empfohlen' }),
  }

  const handleSave = async () => {
    setSaving(true)
    await onSave(notes)
    setSaving(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
        }}
      />
      {/* Bottom sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
        background: 'linear-gradient(180deg, rgba(8,12,28,0.99) 0%, rgba(4,7,18,1) 100%)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: '26px 26px 0 0',
        padding: '20px 18px',
        paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
        boxShadow: '0 -28px 80px rgba(0,0,0,0.55)',
      }}>
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.12)',
          margin: '0 auto 22px',
        }} />

        {/* Site card */}
        <div style={{
          background: `linear-gradient(135deg, ${color}18, ${color}08)`,
          border: `1px solid ${color}30`,
          borderRadius: 20,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          {/* Icon */}
          <div style={{
            width: 46, height: 46, borderRadius: 16, flexShrink: 0,
            background: `${color}1f`, border: `1px solid ${color}2e`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', background: color }} />
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '1.02rem', fontWeight: 900, color: '#f8fbff', lineHeight: 1.2 }}>
              {site.label}
            </p>
            <p style={{ fontSize: '0.68rem', color: 'rgba(154,170,191,0.6)', marginTop: 3 }}>
              {site.methodHint}
            </p>
          </div>
          {/* Status */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: '0.66rem', fontWeight: 800, color }}>
              {statusLabels[status]}
            </p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.5)', marginTop: 2 }}>
              {daysSince === null
                ? t('inj_never_used', { defaultValue: 'Noch nie' })
                : daysSince === 0
                  ? t('inj_today', { defaultValue: 'Heute' })
                  : t('inj_days_ago', { defaultValue: `vor ${daysSince} Tagen`, days: daysSince })}
            </p>
          </div>
        </div>

        {/* Warning banner */}
        {status === 'warn' && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '10px 14px', borderRadius: 14, marginBottom: 14,
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.20)',
          }}>
            <AlertTriangle size={15} color="#f43f5e" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '0.72rem', color: 'rgba(244,63,94,0.88)', lineHeight: 1.45 }}>
              {t('inj_warn_too_soon', { defaultValue: 'Diese Stelle wurde vor weniger als 3 Tagen genutzt. Rotation an andere Stelle empfohlen.' })}
            </p>
          </div>
        )}

        {/* Notes */}
        <div style={{ marginBottom: 18 }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'rgba(213,224,242,0.7)', marginBottom: 8 }}>
            {t('inj_notes_label', { defaultValue: 'Notizen (optional)' })}
          </p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('inj_notes_placeholder', { defaultValue: 'z.B. Reaktion, Tiefe, Schmerz...' })}
            rows={2}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 14,
              padding: '10px 14px',
              color: '#eaeefc',
              fontSize: '0.84rem',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 16,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'rgba(213,224,242,0.7)',
              fontSize: '0.84rem', fontWeight: 800,
            }}
          >
            {t('inj_log_cancel', { defaultValue: 'Abbrechen' })}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '13px 0', borderRadius: 16,
              background: `linear-gradient(135deg, ${color}28, ${color}14)`,
              border: `1px solid ${color}45`,
              color,
              fontSize: '0.84rem', fontWeight: 900,
              opacity: saving ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {saving ? '…' : t('inj_log_confirm', { defaultValue: 'Injektion bestätigen' })}
          </button>
        </div>
      </div>
    </>
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
      background: 'linear-gradient(145deg, rgba(9,14,34,0.94), rgba(4,7,18,0.96))',
      border: '1px solid rgba(255,255,255,0.08)',
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
      <h2 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#f8fbff', textAlign: 'center', marginBottom: 8 }}>
        {t('inj_setup_required', { defaultValue: 'Datenbank-Setup erforderlich' })}
      </h2>
      <p style={{ fontSize: '0.78rem', color: 'rgba(154,170,191,0.62)', lineHeight: 1.6, textAlign: 'center', marginBottom: 18 }}>
        {t('inj_setup_hint', { defaultValue: 'Führe folgendes SQL im Supabase SQL-Editor aus, um den Injektions-Tracker zu aktivieren.' })}
      </p>

      {/* SQL block */}
      <div style={{
        background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(0,204,245,0.15)',
        borderRadius: 14, padding: '12px 14px', marginBottom: 14,
      }}>
        <pre style={{
          fontSize: '0.6rem', color: 'rgba(0,204,245,0.75)',
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
            background: 'rgba(0,204,245,0.10)', border: '1px solid rgba(0,204,245,0.22)',
            color: '#00ccf5', fontSize: '0.78rem', fontWeight: 800,
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
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(213,224,242,0.7)', fontSize: '0.78rem', fontWeight: 800,
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
