import { useState, useRef, useEffect } from 'react'
import { RotateCcw, Info, Undo2, CheckCircle2 } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Zone {
  key: string
  label: string
  view: 'front' | 'back'
  cx: number   // original 200-wide coordinate space
  cy: number
  r: number
}

interface HistoryEntry { key: string; label: string; prevDays: number | undefined; ts: number }

// ── Zone coordinates (original 200×310 space — scaled up via SVG transform) ──
const ZONES: Zone[] = [
  { key: 'deltoid_l',  label: 'Deltoid links',            view: 'front', cx: 41,  cy: 100, r: 13 },
  { key: 'deltoid_r',  label: 'Deltoid rechts',           view: 'front', cx: 159, cy: 100, r: 13 },
  { key: 'bauch_l',    label: 'Bauch links',              view: 'front', cx: 84,  cy: 151, r: 14 },
  { key: 'bauch_r',    label: 'Bauch rechts',             view: 'front', cx: 116, cy: 151, r: 14 },
  { key: 'ober_l',     label: 'Oberschenkel links',       view: 'front', cx: 81,  cy: 231, r: 13 },
  { key: 'ober_r',     label: 'Oberschenkel rechts',      view: 'front', cx: 119, cy: 231, r: 13 },
  { key: 'gesaess_l',  label: 'Gesäß links',              view: 'back',  cx: 84,  cy: 184, r: 15 },
  { key: 'gesaess_r',  label: 'Gesäß rechts',             view: 'back',  cx: 116, cy: 184, r: 15 },
  { key: 'ober_hl',    label: 'Oberschenkel hinten L',    view: 'back',  cx: 81,  cy: 241, r: 13 },
  { key: 'ober_hr',    label: 'Oberschenkel hinten R',    view: 'back',  cx: 119, cy: 241, r: 13 },
  { key: 'del_hl',     label: 'Deltoid hinten links',     view: 'back',  cx: 41,  cy: 100, r: 13 },
  { key: 'del_hr',     label: 'Deltoid hinten rechts',    view: 'back',  cx: 159, cy: 100, r: 13 },
]

const INITIAL_DAYS: Record<string, number> = {
  deltoid_l: 0,  deltoid_r: 2,
  bauch_l:   6,  bauch_r:   3,
  ober_l:    1,  ober_r:    8,
  gesaess_l: 10, gesaess_r: 4,
  ober_hl:   0,  ober_hr:   7,
  del_hl:    5,  del_hr:    2,
}

// ── Color theme ───────────────────────────────────────────────────────────────
function zoneTheme(d: number | undefined) {
  if (d === undefined) return { primary: '#334155', fill: 'rgba(51,65,85,0.25)',  gA: 'rgba(51,65,85,0.30)',  gB: 'rgba(15,23,42,0.20)',  badge: '–' }
  if (d === 0)  return { primary: '#ef4444', fill: 'rgba(239,68,68,0.22)',   gA: 'rgba(239,68,68,0.32)',   gB: 'rgba(127,29,29,0.12)',  badge: 'Heute'    }
  if (d === 1)  return { primary: '#f97316', fill: 'rgba(249,115,22,0.20)',  gA: 'rgba(249,115,22,0.28)',  gB: 'rgba(124,45,18,0.10)',  badge: 'Gestern'  }
  if (d <= 3)   return { primary: '#eab308', fill: 'rgba(234,179,8,0.20)',   gA: 'rgba(234,179,8,0.28)',   gB: 'rgba(113,63,18,0.08)',  badge: `${d}T`    }
  if (d <= 5)   return { primary: '#22c55e', fill: 'rgba(34,197,94,0.20)',   gA: 'rgba(34,197,94,0.28)',   gB: 'rgba(20,83,45,0.08)',   badge: `${d}T`    }
  return               { primary: '#10b981', fill: 'rgba(16,185,129,0.22)',  gA: 'rgba(16,185,129,0.30)',  gB: 'rgba(6,78,59,0.08)',    badge: `${d}T`    }
}

// ── SVG body map ──────────────────────────────────────────────────────────────
// All paths drawn in original 200×310 space; the outer <g> scales to 1.65×
// so the rendered SVG is ~330 wide and ~512 tall — high resolution naturally.
const SCALE = 1.65
const VB_W  = Math.round(200 * SCALE)
const VB_H  = Math.round(310 * SCALE)

function BodyMap({ view, days, recommended, pulsing, onZone }: {
  view:        'front' | 'back'
  days:        Record<string, number>
  recommended: string | null
  pulsing:     string | null
  onZone:      (key: string) => void
}) {
  const zones  = ZONES.filter(z => z.view === view)
  const fill   = 'url(#bodyGrad)'
  const stroke = 'rgba(148,163,184,0.16)'

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width="100%"
      style={{ display: 'block', maxWidth: VB_W }}
      shapeRendering="geometricPrecision"
    >
      <defs>
        {/* ── Ambient grid pattern ── */}
        <pattern id="dotGrid" x="0" y="0" width={8 * SCALE} height={8 * SCALE} patternUnits="userSpaceOnUse">
          <circle cx={SCALE} cy={SCALE} r={0.9} fill="rgba(148,163,184,0.055)" />
        </pattern>

        {/* ── Body fill gradient ── */}
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%"   stopColor="rgba(26,38,68,0.97)" />
          <stop offset="55%"  stopColor="rgba(16,26,54,0.98)" />
          <stop offset="100%" stopColor="rgba(9,15,36,0.99)"  />
        </linearGradient>

        {/* ── Body inner shadow / depth ── */}
        <filter id="bodyDepth" x="-5%" y="-3%" width="110%" height="108%">
          <feDropShadow dx="0" dy="5" stdDeviation="8" floodColor="rgba(0,0,0,0.55)" />
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.35)" />
        </filter>

        {/* ── Zone glow filter ── */}
        <filter id="zoneGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ── Strong glow for recommended ── */}
        <filter id="zoneGlowStrong" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="5.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ── Per-zone radial gradients ── */}
        {zones.map(z => {
          const t = zoneTheme(days[z.key])
          return (
            <radialGradient key={`rg-${z.key}`} id={`rg-${z.key}`} cx="35%" cy="30%" r="70%" gradientUnits="objectBoundingBox">
              <stop offset="0%"   stopColor={t.gA} />
              <stop offset="100%" stopColor={t.gB} />
            </radialGradient>
          )
        })}
      </defs>

      {/* ── Background grid ── */}
      <rect width={VB_W} height={VB_H} fill="url(#dotGrid)" />

      {/* ── Scaled body + zones group ── */}
      <g transform={`scale(${SCALE}, ${SCALE})`}>

        {/* ── Body silhouette ── */}
        <g filter="url(#bodyDepth)">
          {/* Head */}
          <ellipse cx="100" cy="34" rx="24" ry="28" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Neck */}
          <rect x="92" y="60" width="16" height="14" rx="5" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Torso */}
          <path d="M67,72 Q57,80 55,98 L55,178 Q55,186 68,186 L132,186 Q145,186 145,178 L145,98 Q143,80 133,72 Z"
            fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Left shoulder */}
          <ellipse cx="51" cy="82" rx="18" ry="11" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Right shoulder */}
          <ellipse cx="149" cy="82" rx="18" ry="11" fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Left upper arm */}
          <path d="M33,79 Q24,88 22,106 L22,158 Q22,166 32,167 L53,167 Q60,165 60,156 L60,92 Q57,82 46,79 Z"
            fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Right upper arm */}
          <path d="M167,79 Q176,88 178,106 L178,158 Q178,166 168,167 L147,167 Q140,165 140,156 L140,92 Q143,82 154,79 Z"
            fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Left forearm */}
          <path d="M24,157 L24,213 Q24,221 33,221 L52,221 Q59,221 62,213 L62,157 Z"
            fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Right forearm */}
          <path d="M176,157 L176,213 Q176,221 167,221 L148,221 Q141,221 138,213 L138,157 Z"
            fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Left leg */}
          <path d="M65,186 L65,297 Q65,305 76,305 L96,305 Q105,305 105,297 L105,186 Z"
            fill={fill} stroke={stroke} strokeWidth="1.4" />
          {/* Right leg */}
          <path d="M95,186 L95,297 Q95,305 105,305 L125,305 Q135,305 135,297 L135,186 Z"
            fill={fill} stroke={stroke} strokeWidth="1.4" />
        </g>

        {/* ── Anatomical detail lines ── */}
        {view === 'front' && (
          <g opacity="0.09" stroke="rgba(148,163,184,1)" fill="none" strokeWidth="1">
            <path d="M76,75 Q100,80 124,75" />                  {/* collar bone */}
            <line x1="100" y1="82" x2="100" y2="178" />         {/* centre line */}
            <path d="M86,112 Q100,116 114,112" />                {/* abs 1 */}
            <path d="M86,130 Q100,134 114,130" />                {/* abs 2 */}
            <path d="M86,148 Q100,152 114,148" />                {/* abs 3 */}
          </g>
        )}
        {view === 'back' && (
          <g opacity="0.09" stroke="rgba(148,163,184,1)" fill="none" strokeWidth="1">
            <line x1="100" y1="78" x2="100" y2="180" strokeDasharray="3 4" /> {/* spine */}
            <path d="M72,92 Q79,104 73,118" />                  {/* L scapula */}
            <path d="M128,92 Q121,104 127,118" />               {/* R scapula */}
          </g>
        )}

        {/* ── Injection zones ── */}
        {zones.map(z => {
          const t      = zoneTheme(days[z.key])
          const r      = z.r
          const isRec  = recommended === z.key
          const isPul  = pulsing === z.key

          return (
            <g key={z.key} onClick={() => onZone(z.key)} style={{ cursor: 'pointer' }}>

              {/* Far outer soft halo */}
              <circle cx={z.cx} cy={z.cy} r={r + 11}
                fill={t.primary} opacity={isRec ? 0.10 : 0.05} />

              {/* Pulsing ring — recommended zone only */}
              {isRec && (
                <circle cx={z.cx} cy={z.cy} r={r + 7}
                  fill="none" stroke={t.primary} strokeWidth="1.5" opacity={0.55}
                  style={{ animation: 'ob-ring-pulse 2s ease-out infinite' }} />
              )}

              {/* Tap feedback pulse */}
              {isPul && (
                <circle cx={z.cx} cy={z.cy} r={r + 13}
                  fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5"
                  style={{ animation: 'ob-ring-pulse 0.65s ease-out forwards' }} />
              )}

              {/* Main zone — gradient fill + glow */}
              <circle
                cx={z.cx} cy={z.cy} r={r}
                fill={`url(#rg-${z.key})`}
                stroke={t.primary}
                strokeWidth={isRec ? 1.8 : 1.3}
                filter={isRec ? 'url(#zoneGlowStrong)' : 'url(#zoneGlow)'}
                style={{ transition: 'all 0.22s ease' }}
              />

              {/* Inner specular highlight */}
              <ellipse
                cx={z.cx - r * 0.22} cy={z.cy - r * 0.28}
                rx={r * 0.42} ry={r * 0.27}
                fill="rgba(255,255,255,0.09)"
                style={{ pointerEvents: 'none' }}
              />

              {/* Centre dot */}
              <circle cx={z.cx} cy={z.cy} r={2.2}
                fill={t.primary} opacity={0.75}
                style={{ pointerEvents: 'none' }} />

              {/* Star badge for recommended */}
              {isRec && (
                <text x={z.cx + r - 1} y={z.cy - r + 2}
                  fontSize="7" textAnchor="middle" style={{ pointerEvents: 'none' }}>⭐</text>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function InjectionTracker() {
  const [view,      setView]      = useState<'front' | 'back'>('front')
  const [days,      setDays]      = useState<Record<string, number>>(INITIAL_DAYS)
  const [pulsing,   setPulsing]   = useState<string | null>(null)
  const [history,   setHistory]   = useState<HistoryEntry[]>([])
  const [undoToast, setUndoToast] = useState<HistoryEntry | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current) }, [])

  const recommended = ZONES
    .map(z => ({ key: z.key, d: days[z.key] ?? 999 }))
    .filter(z => z.d >= 2)
    .sort((a, b) => b.d - a.d)[0]?.key ?? null

  function logZone(key: string) {
    const zone = ZONES.find(z => z.key === key)!
    const entry: HistoryEntry = { key, label: zone.label, prevDays: days[key], ts: Date.now() }
    setDays(p => ({ ...p, [key]: 0 }))
    setPulsing(key)
    setHistory(p => [entry, ...p].slice(0, 10))
    setUndoToast(entry)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setUndoToast(null), 6000)
    setTimeout(() => setPulsing(null), 800)
    if (zone.view !== view) setTimeout(() => setView(zone.view), 200)
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

  const recZone   = ZONES.find(z => z.key === recommended)
  const sortedList = ZONES.slice().sort((a, b) => (days[b.key] ?? 999) - (days[a.key] ?? 999))
  const freeCount  = ZONES.filter(z => (days[z.key] ?? 999) >= 5).length
  const warnCount  = ZONES.filter(z => { const d = days[z.key]; return d !== undefined && d <= 1 }).length
  const loggedCount = ZONES.filter(z => days[z.key] !== undefined).length

  // shared card style
  const card = {
    background: 'rgba(8,12,26,0.92)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 18,
  }

  return (
    <div className="pb-28 relative">

      {/* ── Header ── */}
      <div className="mb-5 pt-1">
        <h1 style={{ fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#eaeefc' }}>
          💉 Injektionsstellen
        </h1>
        <p style={{ fontSize: '0.72rem', color: 'rgba(154,170,191,0.48)', marginTop: 3 }}>
          Rotationsprotokoll · Tippe auf eine Zone zum Markieren
        </p>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Frei',     value: freeCount,   color: '#10b981', bg: 'rgba(16,185,129,0.09)',  border: 'rgba(16,185,129,0.18)' },
          { label: 'Vorsicht', value: warnCount,    color: '#ef4444', bg: 'rgba(239,68,68,0.09)',   border: 'rgba(239,68,68,0.18)'  },
          { label: 'Geloggt',  value: loggedCount,  color: '#00ccf5', bg: 'rgba(0,204,245,0.07)',   border: 'rgba(0,204,245,0.16)'  },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, borderRadius: 13, padding: '9px 8px', textAlign: 'center', background: s.bg, border: `1px solid ${s.border}` }}>
            <p style={{ fontSize: '1.35rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.53rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(154,170,191,0.48)', marginTop: 3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Recommendation ── */}
      {recZone && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.09), rgba(0,204,245,0.05))',
          border: '1px solid rgba(16,185,129,0.20)', borderRadius: 15,
          padding: '12px 14px', marginBottom: 14,
          display: 'flex', alignItems: 'center', gap: 11,
        }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(16,185,129,0.13)', border: '1.5px solid rgba(16,185,129,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem',
          }}>⭐</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.57rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(16,185,129,0.72)', marginBottom: 2 }}>Empfohlene Zone</p>
            <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#eaeefc' }}>{recZone.label}</p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.45)', marginTop: 1 }}>
              {recZone.view === 'front' ? 'Vorderseite' : 'Rückseite'} ·
              zuletzt vor {(days[recZone.key] ?? 999) >= 999 ? 'noch nie' : `${days[recZone.key]} Tagen`}
            </p>
          </div>
          <button onClick={() => logZone(recZone.key)} style={{
            padding: '8px 14px', borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(16,185,129,0.22), rgba(0,204,245,0.12))',
            border: '1px solid rgba(16,185,129,0.32)',
            color: '#10b981', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer',
          }}>✓ Hier</button>
        </div>
      )}

      {/* ── View toggle ── */}
      <div style={{
        display: 'flex', gap: 5, marginBottom: 10,
        background: 'rgba(6,10,22,0.95)', border: '1px solid rgba(255,255,255,0.055)',
        borderRadius: 13, padding: 4,
      }}>
        {(['front', 'back'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '8px 0', borderRadius: 10, fontWeight: 700,
            fontSize: '0.78rem', cursor: 'pointer', transition: 'all 0.18s',
            background: view === v ? 'linear-gradient(135deg, rgba(0,204,245,0.18), rgba(0,120,190,0.12))' : 'transparent',
            border: view === v ? '1px solid rgba(0,204,245,0.32)' : '1px solid transparent',
            color: view === v ? '#00ccf5' : 'rgba(154,170,191,0.5)',
            boxShadow: view === v ? '0 0 14px rgba(0,204,245,0.12)' : 'none',
          }}>
            {v === 'front' ? '👤 Vorderseite' : '🔄 Rückseite'}
          </button>
        ))}
      </div>

      {/* ── Body map card ── */}
      <div style={{
        ...card,
        background: 'linear-gradient(175deg, rgba(10,16,40,0.98) 0%, rgba(5,9,24,1) 100%)',
        border: '1px solid rgba(0,204,245,0.09)',
        borderRadius: 22,
        padding: '20px 10px 16px',
        marginBottom: 14,
        boxShadow: '0 12px 40px rgba(0,0,0,0.45), 0 2px 0 rgba(255,255,255,0.025) inset',
        overflow: 'hidden', position: 'relative',
      }}>
        {/* Ambient centre glow */}
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 260, height: 260, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,204,245,0.035) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <BodyMap view={view} days={days} recommended={recommended} pulsing={pulsing} onZone={logZone} />

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 10px', justifyContent: 'center', marginTop: 14 }}>
          {[
            { c: '#10b981', l: '5+ Tage · frei' },
            { c: '#22c55e', l: '4–5 Tage' },
            { c: '#eab308', l: '2–3 Tage · ok' },
            { c: '#f97316', l: 'Gestern · warten' },
            { c: '#ef4444', l: 'Heute · Pause' },
          ].map(x => (
            <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: x.c, boxShadow: `0 0 5px ${x.c}88`, flexShrink: 0 }} />
              <span style={{ fontSize: '0.56rem', color: 'rgba(154,170,191,0.52)' }}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zone list ── */}
      <div style={{ ...card, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.045)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RotateCcw size={12} color="rgba(0,204,245,0.5)" />
          <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(154,170,191,0.42)' }}>
            Alle Zonen · nach Rotation sortiert
          </span>
        </div>
        {sortedList.map((zone, i) => {
          const t = zoneTheme(days[zone.key])
          const d = days[zone.key]
          const isRec = recommended === zone.key
          return (
            <div key={zone.key} onClick={() => logZone(zone.key)} style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '10px 14px',
              borderBottom: i < sortedList.length - 1 ? '1px solid rgba(255,255,255,0.032)' : 'none',
              background: isRec ? 'rgba(16,185,129,0.035)' : 'transparent',
              cursor: 'pointer',
            }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: t.primary, boxShadow: `0 0 7px ${t.primary}99`, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#eaeefc', lineHeight: 1 }}>
                  {zone.label}
                  {isRec && <span style={{ marginLeft: 6, fontSize: '0.5rem', fontWeight: 700, background: 'rgba(16,185,129,0.16)', color: '#10b981', padding: '1px 5px', borderRadius: 4, verticalAlign: 'middle' }}>⭐</span>}
                </p>
                <p style={{ fontSize: '0.58rem', color: 'rgba(154,170,191,0.36)', marginTop: 2 }}>
                  {zone.view === 'front' ? 'Vorderseite' : 'Rückseite'}
                </p>
              </div>
              <p style={{ fontSize: '0.76rem', fontWeight: 700, color: t.primary, minWidth: 54, textAlign: 'right' }}>
                {d === undefined ? '–' : d === 0 ? 'Heute' : d === 1 ? 'Gestern' : `vor ${d}T`}
              </p>
              <button onClick={e => { e.stopPropagation(); logZone(zone.key) }} style={{
                width: 29, height: 29, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,204,245,0.07)', border: '1px solid rgba(0,204,245,0.16)',
                color: 'rgba(0,204,245,0.6)', fontSize: '0.72rem', cursor: 'pointer',
              }}>✓</button>
            </div>
          )
        })}
      </div>

      {/* ── History / Verlauf ── */}
      {history.length > 0 && (
        <div style={{ ...card, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.045)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Undo2 size={12} color="rgba(154,170,191,0.4)" />
            <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(154,170,191,0.4)' }}>
              Letzte Aktionen
            </span>
          </div>
          {history.slice(0, 5).map((entry, i) => (
            <div key={entry.ts} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
              borderBottom: i < Math.min(history.length, 5) - 1 ? '1px solid rgba(255,255,255,0.032)' : 'none',
            }}>
              <CheckCircle2 size={14} color="rgba(0,204,245,0.45)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(234,238,252,0.8)' }}>{entry.label}</p>
                <p style={{ fontSize: '0.57rem', color: 'rgba(154,170,191,0.36)', marginTop: 1 }}>
                  {new Date(entry.ts).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr
                  {entry.prevDays !== undefined && ` · vorher ${entry.prevDays}T`}
                </p>
              </div>
              <button onClick={() => undoEntry(entry)} style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 8,
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.16)',
                color: 'rgba(239,68,68,0.65)', fontSize: '0.63rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
              }}>
                <Undo2 size={10} /> Rückgängig
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Info ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 13px', borderRadius: 11, background: 'rgba(0,204,245,0.03)', border: '1px solid rgba(0,204,245,0.08)' }}>
        <Info size={13} color="rgba(0,204,245,0.4)" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: '0.61rem', color: 'rgba(154,170,191,0.45)', lineHeight: 1.55 }}>
          Mindestens <strong style={{ color: 'rgba(154,170,191,0.7)' }}>2 Tage</strong> zwischen Injektionen in dieselbe Zone
          einhalten um Narbenbildung zu vermeiden. Grüne Zonen sind am sichersten.
        </p>
      </div>

      {/* ── Undo toast ── */}
      {undoToast && (
        <div style={{
          position: 'fixed', bottom: 86, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, width: 'calc(100% - 32px)', maxWidth: 380,
          background: 'rgba(8,13,32,0.97)', border: '1px solid rgba(0,204,245,0.22)',
          borderRadius: 15, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 10px 40px rgba(0,0,0,0.55), 0 0 20px rgba(0,204,245,0.07)',
          backdropFilter: 'blur(14px)',
          animation: 'ob-step-enter 0.2s ease-out',
        }}>
          <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#eaeefc' }}>{undoToast.label} markiert</p>
            <p style={{ fontSize: '0.61rem', color: 'rgba(154,170,191,0.48)', marginTop: 1 }}>Heute · als injiziert gespeichert</p>
          </div>
          <button onClick={() => undoEntry(undoToast)} style={{
            display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 9,
            background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)',
            color: '#f87171', fontSize: '0.71rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
          }}>
            <Undo2 size={12} /> Rückgängig
          </button>
        </div>
      )}
    </div>
  )
}
