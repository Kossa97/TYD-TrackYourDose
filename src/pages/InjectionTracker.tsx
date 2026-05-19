import { useState, useRef, useEffect } from 'react'
import { RotateCcw, Info, Undo2, CheckCircle2 } from 'lucide-react'

// ── Zone definitions ──────────────────────────────────────────────────────────
interface Zone {
  key: string
  label: string
  shortLabel: string
  view: 'front' | 'back'
  cx: number
  cy: number
  r?: number
}

const ZONES: Zone[] = [
  { key: 'deltoid_l', label: 'Deltoid links',         shortLabel: 'Del\nLinks',  view: 'front', cx: 41,  cy: 100, r: 16 },
  { key: 'deltoid_r', label: 'Deltoid rechts',        shortLabel: 'Del\nRechts', view: 'front', cx: 159, cy: 100, r: 16 },
  { key: 'bauch_l',   label: 'Bauch links',           shortLabel: 'Bauch\nLinks',  view: 'front', cx: 84,  cy: 156, r: 17 },
  { key: 'bauch_r',   label: 'Bauch rechts',          shortLabel: 'Bauch\nRechts', view: 'front', cx: 116, cy: 156, r: 17 },
  { key: 'ober_l',    label: 'Oberschenkel links',    shortLabel: 'Ober\nLinks',   view: 'front', cx: 81,  cy: 232, r: 16 },
  { key: 'ober_r',    label: 'Oberschenkel rechts',   shortLabel: 'Ober\nRechts',  view: 'front', cx: 119, cy: 232, r: 16 },
  { key: 'gesaess_l', label: 'Gesäß links',           shortLabel: 'Ges\nLinks',    view: 'back',  cx: 84,  cy: 185, r: 18 },
  { key: 'gesaess_r', label: 'Gesäß rechts',          shortLabel: 'Ges\nRechts',   view: 'back',  cx: 116, cy: 185, r: 18 },
  { key: 'ober_hl',   label: 'Oberschenkel hinten L', shortLabel: 'Ober\nhL',      view: 'back',  cx: 81,  cy: 242, r: 16 },
  { key: 'ober_hr',   label: 'Oberschenkel hinten R', shortLabel: 'Ober\nhR',      view: 'back',  cx: 119, cy: 242, r: 16 },
  { key: 'del_hl',    label: 'Deltoid hinten links',  shortLabel: 'Del\nhL',       view: 'back',  cx: 41,  cy: 100, r: 16 },
  { key: 'del_hr',    label: 'Deltoid hinten rechts', shortLabel: 'Del\nhR',       view: 'back',  cx: 159, cy: 100, r: 16 },
]

// ── Mock initial data ─────────────────────────────────────────────────────────
const INITIAL_DAYS: Record<string, number> = {
  deltoid_l: 0, deltoid_r: 2,
  bauch_l: 6,   bauch_r: 3,
  ober_l: 1,    ober_r: 8,
  gesaess_l: 10, gesaess_r: 4,
  ober_hl: 0,   ober_hr: 7,
  del_hl: 5,    del_hr: 2,
}

// ── Color palette per status ──────────────────────────────────────────────────
function zoneTheme(days: number | undefined) {
  if (days === undefined)
    return { primary: '#4b5563', glow: 'transparent', gradA: '#1e293b', gradB: '#0f172a', text: '#6b7280', badge: '–', badgeColor: '#6b7280' }
  if (days === 0)
    return { primary: '#ef4444', glow: 'rgba(239,68,68,0.6)',  gradA: 'rgba(239,68,68,0.35)',  gradB: 'rgba(185,28,28,0.15)',  text: '#fca5a5', badge: 'Heute',    badgeColor: '#ef4444' }
  if (days === 1)
    return { primary: '#f97316', glow: 'rgba(249,115,22,0.55)', gradA: 'rgba(249,115,22,0.30)', gradB: 'rgba(194,65,12,0.12)', text: '#fdba74', badge: 'Gestern',  badgeColor: '#f97316' }
  if (days <= 3)
    return { primary: '#eab308', glow: 'rgba(234,179,8,0.50)',  gradA: 'rgba(234,179,8,0.28)',  gradB: 'rgba(161,98,7,0.10)',  text: '#fde047', badge: `${days}T`,  badgeColor: '#eab308' }
  if (days <= 5)
    return { primary: '#22c55e', glow: 'rgba(34,197,94,0.45)',  gradA: 'rgba(34,197,94,0.25)',  gradB: 'rgba(20,83,45,0.10)',  text: '#86efac', badge: `${days}T`,  badgeColor: '#22c55e' }
  return   { primary: '#10b981', glow: 'rgba(16,185,129,0.50)', gradA: 'rgba(16,185,129,0.28)', gradB: 'rgba(6,78,59,0.10)',   text: '#6ee7b7', badge: `${days}T`,  badgeColor: '#10b981' }
}

interface HistoryEntry { key: string; label: string; prevDays: number | undefined; ts: number }

// ── Body SVG ──────────────────────────────────────────────────────────────────
function BodySVG({ view, days, recommended, selected, pulsing, onZone }: {
  view: 'front' | 'back'
  days: Record<string, number>
  recommended: string | null
  selected: string | null
  pulsing: string | null
  onZone: (key: string) => void
}) {
  const bodyFill   = 'url(#bodyGrad)'
  const bodyStroke = 'rgba(148,163,184,0.18)'
  const sw         = 1.8
  const zones      = ZONES.filter(z => z.view === view)

  return (
    <svg viewBox="0 0 200 310" width="100%" style={{ maxWidth: 260, display: 'block', margin: '0 auto' }}>
      <defs>
        {/* Body gradient */}
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(22,33,62,0.95)" />
          <stop offset="100%" stopColor="rgba(10,16,35,0.98)" />
        </linearGradient>

        {/* Glow filter */}
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Outer pulse filter */}
        <filter id="glowStrong" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>

        {/* Body shadow */}
        <filter id="bodyShadow" x="-10%" y="-5%" width="120%" height="115%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.5)" />
        </filter>

        {/* Zone radial gradients — generated per zone */}
        {zones.map(z => {
          const t = zoneTheme(days[z.key])
          return (
            <radialGradient key={`rg-${z.key}`} id={`rg-${z.key}`} cx="38%" cy="35%" r="65%">
              <stop offset="0%"   stopColor={t.gradA} />
              <stop offset="100%" stopColor={t.gradB} />
            </radialGradient>
          )
        })}
      </defs>

      {/* ── Background dot grid ── */}
      <pattern id="dots" x="0" y="0" width="12" height="12" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.7" fill="rgba(148,163,184,0.06)" />
      </pattern>
      <rect x="0" y="0" width="200" height="310" fill="url(#dots)" />

      {/* ── Body silhouette ── */}
      <g filter="url(#bodyShadow)">
        {/* Head */}
        <ellipse cx="100" cy="34" rx="23" ry="27" fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Neck */}
        <rect x="92" y="59" width="16" height="14" rx="5" fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Torso */}
        <path d="M67,71 Q58,78 56,96 L56,178 Q56,186 68,186 L132,186 Q144,186 144,178 L144,96 Q142,78 133,71 Z"
          fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Left shoulder */}
        <ellipse cx="52" cy="81" rx="17" ry="11" fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Right shoulder */}
        <ellipse cx="148" cy="81" rx="17" ry="11" fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Left upper arm */}
        <path d="M34,78 Q26,86 24,104 L24,158 Q24,165 33,166 L53,166 Q59,164 59,156 L59,90 Q57,82 47,78 Z"
          fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Right upper arm */}
        <path d="M166,78 Q174,86 176,104 L176,158 Q176,165 167,166 L147,166 Q141,164 141,156 L141,90 Q143,82 153,78 Z"
          fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Left forearm */}
        <path d="M26,157 L26,213 Q26,220 34,220 L52,220 Q58,220 60,213 L60,157 Z"
          fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Right forearm */}
        <path d="M174,157 L174,213 Q174,220 166,220 L148,220 Q142,220 140,213 L140,157 Z"
          fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Left leg */}
        <path d="M66,186 L66,295 Q66,303 76,303 L96,303 Q104,303 104,295 L104,186 Z"
          fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />
        {/* Right leg */}
        <path d="M96,186 L96,295 Q96,303 104,303 L124,303 Q134,303 134,295 L134,186 Z"
          fill={bodyFill} stroke={bodyStroke} strokeWidth={sw} />

        {/* Subtle body detail lines */}
        {view === 'front' && <>
          {/* Collar bone hints */}
          <path d="M76,74 Q100,78 124,74" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1.2" />
          {/* Torso center line */}
          <line x1="100" y1="80" x2="100" y2="178" stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
          {/* Abs hint */}
          <path d="M88,110 Q100,113 112,110" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
          <path d="M88,128 Q100,131 112,128" fill="none" stroke="rgba(148,163,184,0.07)" strokeWidth="1" />
        </>}
        {view === 'back' && <>
          {/* Spine */}
          <line x1="100" y1="78" x2="100" y2="180" stroke="rgba(148,163,184,0.10)" strokeWidth="1" strokeDasharray="3 4" />
          {/* Shoulder blade hints */}
          <path d="M72,90 Q80,100 74,114" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1.2" />
          <path d="M128,90 Q120,100 126,114" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1.2" />
        </>}
      </g>

      {/* ── Injection zones ── */}
      {zones.map(z => {
        const t     = zoneTheme(days[z.key])
        const r     = z.r ?? 16
        const isRec = recommended === z.key
        const isSel = selected === z.key
        const isPul = pulsing === z.key

        return (
          <g key={z.key} onClick={() => onZone(z.key)} style={{ cursor: 'pointer' }}>
            {/* Outer glow halo */}
            <circle cx={z.cx} cy={z.cy} r={r + 9}
              fill="none" stroke={t.primary} strokeWidth="1"
              opacity={isRec ? 0.35 : 0.15}
              filter={isRec ? 'url(#glowStrong)' : undefined}
            />

            {/* Pulsing ring (recommendation) */}
            {isRec && (
              <circle cx={z.cx} cy={z.cy} r={r + 6}
                fill="none" stroke={t.primary} strokeWidth="1.5"
                opacity={0.5}
                style={{ animation: 'ob-ring-pulse 1.8s ease-out infinite' }}
              />
            )}

            {/* Main zone circle */}
            <circle cx={z.cx} cy={z.cy} r={r}
              fill={`url(#rg-${z.key})`}
              stroke={isSel ? '#fff' : isRec ? t.primary : t.primary}
              strokeWidth={isSel ? 2.5 : isRec ? 2 : 1.5}
              filter="url(#glow)"
              style={{ transition: 'all 0.25s ease' }}
            />

            {/* Inner subtle highlight */}
            <ellipse cx={z.cx - r * 0.25} cy={z.cy - r * 0.28} rx={r * 0.45} ry={r * 0.3}
              fill="rgba(255,255,255,0.06)" style={{ pointerEvents: 'none' }} />

            {/* Success pulse */}
            {isPul && (
              <circle cx={z.cx} cy={z.cy} r={r + 12}
                fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2"
                style={{ animation: 'ob-ring-pulse 0.7s ease-out forwards' }}
              />
            )}

            {/* Text labels */}
            {z.shortLabel.split('\n').map((line, li) => (
              <text key={li}
                x={z.cx} y={z.cy - 3.5 + li * 9}
                textAnchor="middle" dominantBaseline="middle"
                fill={t.text} fontSize="6.8" fontWeight="700"
                fontFamily="system-ui, sans-serif"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {line}
              </text>
            ))}

            {/* Days badge */}
            <text x={z.cx} y={z.cy + (z.shortLabel.includes('\n') ? 8.5 : 6)}
              textAnchor="middle" dominantBaseline="middle"
              fill={t.badgeColor} fontSize="7.5" fontWeight="800"
              fontFamily="system-ui, sans-serif"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {t.badge}
            </text>

            {/* Star for recommended */}
            {isRec && (
              <text x={z.cx + r - 3} y={z.cy - r + 4}
                textAnchor="middle" dominantBaseline="middle"
                fontSize="8" style={{ pointerEvents: 'none' }}>⭐</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export function InjectionTracker() {
  const [view,      setView]      = useState<'front' | 'back'>('front')
  const [days,      setDays]      = useState<Record<string, number>>(INITIAL_DAYS)
  const [selected,  setSelected]  = useState<string | null>(null)
  const [pulsing,   setPulsing]   = useState<string | null>(null)
  const [history,   setHistory]   = useState<HistoryEntry[]>([])
  const [undoToast, setUndoToast] = useState<HistoryEntry | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recommended: most days since last use, minimum 2
  const recommended = ZONES
    .map(z => ({ key: z.key, d: days[z.key] ?? 999 }))
    .filter(z => z.d >= 2)
    .sort((a, b) => b.d - a.d)[0]?.key ?? null

  function logZone(key: string) {
    const zone = ZONES.find(z => z.key === key)!
    const entry: HistoryEntry = { key, label: zone.label, prevDays: days[key], ts: Date.now() }

    setDays(p => ({ ...p, [key]: 0 }))
    setSelected(key)
    setPulsing(key)
    setHistory(p => [entry, ...p].slice(0, 10))
    setUndoToast(entry)

    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndoToast(null), 6000)

    setTimeout(() => { setSelected(null); setPulsing(null) }, 900)

    // Switch view if zone is on the other side
    if (zone.view !== view) setTimeout(() => setView(zone.view), 300)
  }

  function undoEntry(entry: HistoryEntry) {
    setDays(p => {
      const next = { ...p }
      if (entry.prevDays === undefined) delete next[entry.key]
      else next[entry.key] = entry.prevDays
      return next
    })
    setHistory(p => p.filter(e => e.ts !== entry.ts))
    if (undoToast?.ts === entry.ts) {
      setUndoToast(null)
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }

  // Cleanup timer on unmount
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])

  const sortedList = ZONES.slice().sort((a, b) => (days[b.key] ?? 999) - (days[a.key] ?? 999))
  const recZone    = ZONES.find(z => z.key === recommended)

  // Stats
  const freeCount   = ZONES.filter(z => (days[z.key] ?? 999) >= 5).length
  const warnCount   = ZONES.filter(z => { const d = days[z.key]; return d !== undefined && d <= 1 }).length
  const totalLogged = ZONES.filter(z => days[z.key] !== undefined).length

  return (
    <div className="pb-28 relative">

      {/* ── Header ── */}
      <div className="mb-5 pt-1">
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#eaeefc', lineHeight: 1.1 }}>
          💉 Injektionsstellen
        </h1>
        <p style={{ fontSize: '0.72rem', color: 'rgba(154,170,191,0.5)', marginTop: 3 }}>
          Rotationsprotokoll · Tippe auf eine Zone zum Markieren
        </p>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Frei',     value: freeCount,   color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)'  },
          { label: 'Vorsicht', value: warnCount,    color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)'   },
          { label: 'Geloggt',  value: totalLogged,  color: '#00ccf5', bg: 'rgba(0,204,245,0.08)',  border: 'rgba(0,204,245,0.18)'  },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, borderRadius: 12, padding: '9px 10px', textAlign: 'center',
            background: s.bg, border: `1px solid ${s.border}`,
          }}>
            <p style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(154,170,191,0.5)', marginTop: 2 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Recommendation Banner ── */}
      {recZone && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(0,204,245,0.06) 100%)',
          border: '1px solid rgba(16,185,129,0.22)',
          borderRadius: 14, padding: '11px 14px',
          marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(16,185,129,0.15)', border: '1.5px solid rgba(16,185,129,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
          }}>⭐</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(16,185,129,0.75)', marginBottom: 2 }}>
              Empfohlene Zone
            </p>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#eaeefc', lineHeight: 1.2 }}>
              {recZone.label}
            </p>
            <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.5)', marginTop: 1 }}>
              {recZone.view === 'front' ? 'Vorderseite' : 'Rückseite'} ·
              zuletzt vor {(days[recZone.key] ?? 999) >= 999 ? 'noch nie' : `${days[recZone.key]} Tagen`}
            </p>
          </div>
          <button onClick={() => logZone(recZone.key)} style={{
            padding: '7px 13px', borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(0,204,245,0.15))',
            border: '1px solid rgba(16,185,129,0.35)',
            color: '#10b981', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
          }}>✓ Hier</button>
        </div>
      )}

      {/* ── View Toggle ── */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 10,
        background: 'rgba(8,12,26,0.9)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: 4,
      }}>
        {(['front', 'back'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '8px 0', borderRadius: 9, fontWeight: 700,
            fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.18s',
            background: view === v
              ? 'linear-gradient(135deg, rgba(0,204,245,0.2), rgba(0,130,200,0.15))'
              : 'transparent',
            border: view === v ? '1px solid rgba(0,204,245,0.35)' : '1px solid transparent',
            color: view === v ? '#00ccf5' : 'rgba(154,170,191,0.55)',
            boxShadow: view === v ? '0 0 12px rgba(0,204,245,0.15)' : 'none',
          }}>
            {v === 'front' ? '👤 Vorderseite' : '🔄 Rückseite'}
          </button>
        ))}
      </div>

      {/* ── Body Map Card ── */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(8,14,32,0.97) 0%, rgba(5,9,22,0.99) 100%)',
        border: '1px solid rgba(0,204,245,0.10)',
        borderRadius: 22,
        padding: '18px 12px 14px',
        marginBottom: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle ambient glow */}
        <div style={{
          position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,204,245,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <BodySVG
          view={view} days={days}
          recommended={recommended} selected={selected} pulsing={pulsing}
          onZone={logZone}
        />

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', justifyContent: 'center', marginTop: 10 }}>
          {[
            { color: '#10b981', label: '5+ Tage · frei' },
            { color: '#22c55e', label: '4–5 Tage' },
            { color: '#eab308', label: '2–3 Tage · ok' },
            { color: '#f97316', label: 'Gestern · warten' },
            { color: '#ef4444', label: 'Heute · Pause' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: l.color,
                boxShadow: `0 0 5px ${l.color}88`,
              }} />
              <span style={{ fontSize: '0.57rem', color: 'rgba(154,170,191,0.55)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zone List ── */}
      <div style={{
        background: 'rgba(8,12,26,0.9)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16, overflow: 'hidden', marginBottom: 12,
      }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <RotateCcw size={12} color="rgba(0,204,245,0.55)" />
          <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(154,170,191,0.45)' }}>
            Alle Zonen · Rotation
          </span>
        </div>

        {sortedList.map((zone, i) => {
          const t = zoneTheme(days[zone.key])
          const isRec = recommended === zone.key
          const d = days[zone.key]
          return (
            <div key={zone.key}
              onClick={() => logZone(zone.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '10px 14px',
                borderBottom: i < sortedList.length - 1 ? '1px solid rgba(255,255,255,0.035)' : 'none',
                background: isRec ? 'rgba(16,185,129,0.04)' : 'transparent',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
            >
              {/* Color indicator */}
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: t.primary, boxShadow: `0 0 7px ${t.primary}99`,
              }} />

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#eaeefc', lineHeight: 1 }}>
                  {zone.label}
                  {isRec && <span style={{
                    marginLeft: 6, fontSize: '0.52rem', fontWeight: 700,
                    background: 'rgba(16,185,129,0.18)', color: '#10b981',
                    padding: '1px 6px', borderRadius: 4, verticalAlign: 'middle',
                  }}>⭐</span>}
                </p>
                <p style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.38)', marginTop: 2 }}>
                  {zone.view === 'front' ? 'Vorderseite' : 'Rückseite'}
                </p>
              </div>

              {/* Days text */}
              <p style={{ fontSize: '0.76rem', fontWeight: 700, color: t.primary, minWidth: 56, textAlign: 'right' }}>
                {d === undefined ? '–' : d === 0 ? 'Heute' : d === 1 ? 'Gestern' : `vor ${d}T`}
              </p>

              {/* Mark button */}
              <button onClick={e => { e.stopPropagation(); logZone(zone.key) }}
                style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,204,245,0.08)', border: '1px solid rgba(0,204,245,0.18)',
                  color: 'rgba(0,204,245,0.65)', fontSize: '0.75rem', cursor: 'pointer',
                  transition: 'all 0.15s',
                }}>
                ✓
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Verlauf / History ── */}
      {history.length > 0 && (
        <div style={{
          background: 'rgba(8,12,26,0.9)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16, overflow: 'hidden', marginBottom: 12,
        }}>
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Undo2 size={12} color="rgba(154,170,191,0.45)" />
            <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(154,170,191,0.45)' }}>
              Letzte Aktionen
            </span>
          </div>
          {history.slice(0, 5).map((entry) => (
            <div key={entry.ts} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', borderBottom: '1px solid rgba(255,255,255,0.035)',
            }}>
              <CheckCircle2 size={14} color="rgba(0,204,245,0.5)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(234,238,252,0.8)' }}>{entry.label}</p>
                <p style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.38)', marginTop: 1 }}>
                  {new Date(entry.ts).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr
                  {entry.prevDays !== undefined && ` · war vor ${entry.prevDays}T`}
                </p>
              </div>
              <button onClick={() => undoEntry(entry)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 8,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
                color: 'rgba(239,68,68,0.7)', fontSize: '0.65rem', fontWeight: 700,
                cursor: 'pointer',
              }}>
                <Undo2 size={10} /> Rückgängig
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Info ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '10px 13px', borderRadius: 11,
        background: 'rgba(0,204,245,0.04)', border: '1px solid rgba(0,204,245,0.09)',
      }}>
        <Info size={13} color="rgba(0,204,245,0.45)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.48)', lineHeight: 1.55 }}>
          Mindestens <strong style={{ color: 'rgba(154,170,191,0.72)' }}>2 Tage</strong> zwischen Injektionen in dieselbe Zone einhalten um Narbenbildung zu vermeiden.
          Grüne Zonen sind am sichersten.
        </p>
      </div>

      {/* ── Undo Toast ── */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: 84, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, width: 'calc(100% - 32px)', maxWidth: 380,
          background: 'rgba(10,16,36,0.97)',
          border: '1px solid rgba(0,204,245,0.25)',
          borderRadius: 14, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(0,204,245,0.08)',
          backdropFilter: 'blur(12px)',
          animation: 'ob-step-enter 0.2s ease-out',
        }}>
          <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 700, color: '#eaeefc' }}>
              {undoToast.label} markiert
            </p>
            <p style={{ fontSize: '0.62rem', color: 'rgba(154,170,191,0.5)', marginTop: 1 }}>
              Heute · Zone als injiziert gespeichert
            </p>
          </div>
          <button onClick={() => undoEntry(undoToast)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 9, flexShrink: 0,
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            color: '#f87171', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
          }}>
            <Undo2 size={12} /> Rückgängig
          </button>
        </div>
      )}
    </div>
  )
}
