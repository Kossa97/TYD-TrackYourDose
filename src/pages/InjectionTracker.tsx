import { useState, useRef } from 'react'
import { Info, Undo2, CheckCircle2, X } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Zone {
  key: string; label: string; muscle: string; method: string
  view: 'front' | 'back'; cx: number; cy: number; rx: number; ry: number
}
interface HistEntry { key: string; label: string; prev: number | undefined; ts: number }

// ─────────────────────────────────────────────────────────────────────────────
// Zone definitions  (viewBox 0 0 200 440)
// ─────────────────────────────────────────────────────────────────────────────
const ZONES: Zone[] = [
  { key:'deltoid_l',  label:'Deltoid links',         muscle:'Schulter',      method:'Intramuskulär',            view:'front', cx:36,  cy:118, rx:16, ry:17 },
  { key:'deltoid_r',  label:'Deltoid rechts',        muscle:'Schulter',      method:'Intramuskulär',            view:'front', cx:164, cy:118, rx:16, ry:17 },
  { key:'trizeps_l',  label:'Trizeps links',         muscle:'Oberarm',       method:'Subkutan / Intramuskulär', view:'front', cx:24,  cy:170, rx:11, ry:19 },
  { key:'trizeps_r',  label:'Trizeps rechts',        muscle:'Oberarm',       method:'Subkutan / Intramuskulär', view:'front', cx:176, cy:170, rx:11, ry:19 },
  { key:'bauch_l',    label:'Bauch links',           muscle:'Abdomen',       method:'Subkutan',                 view:'front', cx:74,  cy:202, rx:14, ry:17 },
  { key:'bauch_r',    label:'Bauch rechts',          muscle:'Abdomen',       method:'Subkutan',                 view:'front', cx:126, cy:202, rx:14, ry:17 },
  { key:'ober_l',     label:'Oberschenkel links',    muscle:'Quadrizeps',    method:'Intramuskulär / Subkutan', view:'front', cx:62,  cy:308, rx:13, ry:22 },
  { key:'ober_r',     label:'Oberschenkel rechts',   muscle:'Quadrizeps',    method:'Intramuskulär / Subkutan', view:'front', cx:138, cy:308, rx:13, ry:22 },
  { key:'gesaess_l',  label:'Gesäß links',           muscle:'Gluteus max.',  method:'Intramuskulär',            view:'back',  cx:74,  cy:228, rx:21, ry:23 },
  { key:'gesaess_r',  label:'Gesäß rechts',          muscle:'Gluteus max.',  method:'Intramuskulär',            view:'back',  cx:126, cy:228, rx:21, ry:23 },
  { key:'ober_hl',    label:'Oberschenkel hinten L', muscle:'Hamstrings',    method:'Intramuskulär',            view:'back',  cx:62,  cy:308, rx:13, ry:22 },
  { key:'ober_hr',    label:'Oberschenkel hinten R', muscle:'Hamstrings',    method:'Intramuskulär',            view:'back',  cx:138, cy:308, rx:13, ry:22 },
  { key:'wade_l',     label:'Wade links',            muscle:'Gastrocnemius', method:'Subkutan',                 view:'back',  cx:58,  cy:392, rx:11, ry:19 },
  { key:'wade_r',     label:'Wade rechts',           muscle:'Gastrocnemius', method:'Subkutan',                 view:'back',  cx:142, cy:392, rx:11, ry:19 },
]

const INIT_DAYS: Record<string, number> = {
  deltoid_l:0, deltoid_r:3, trizeps_l:1, trizeps_r:6,
  bauch_l:7,   bauch_r:2,   ober_l:4,    ober_r:1,
  gesaess_l:9, gesaess_r:5, ober_hl:0,   ober_hr:8,
  wade_l:6,    wade_r:3,
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
interface ZSt { color: string; bg: string; label: string; phase: 'free'|'caution'|'blocked' }

function zSt(days: number | undefined): ZSt {
  if (days === undefined) return { color:'#10b981', bg:'rgba(16,185,129,0.14)', label:'Verfügbar',  phase:'free' }
  if (days === 0) return { color:'#ef4444', bg:'rgba(239,68,68,0.14)',   label:'Heute',     phase:'blocked' }
  if (days === 1) return { color:'#f97316', bg:'rgba(249,115,22,0.14)',  label:'Gestern',   phase:'blocked' }
  if (days <= 3)  return { color:'#eab308', bg:'rgba(234,179,8,0.14)',   label:`${days}T`,  phase:'caution' }
  if (days <= 5)  return { color:'#22c55e', bg:'rgba(34,197,94,0.14)',   label:`${days}T`,  phase:'free' }
  return               { color:'#10b981', bg:'rgba(16,185,129,0.14)',   label:`${days}T`,  phase:'free' }
}

const isAvail = (d: number | undefined) => d === undefined || d >= 2

function recPct(days: number | undefined): number {
  if (days === undefined) return 100
  if (days === 0) return 8
  if (days === 1) return 28
  if (days === 2) return 52
  if (days === 3) return 70
  if (days === 4) return 84
  if (days === 5) return 93
  return 100
}

function findRec(days: Record<string, number>): string | null {
  return [...ZONES]
    .map(z => ({ key: z.key, d: days[z.key] ?? 999 }))
    .filter(z => z.d >= 2)
    .sort((a, b) => b.d - a.d)[0]?.key ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG body paths  (viewBox 0 0 200 440)
// All parts share the same fill — no stroke.
// feMorphology dilate+colorize filter creates the seamless outer outline.
// ─────────────────────────────────────────────────────────────────────────────
const HEAD_RX = 21, HEAD_RY = 26, HEAD_CY = 27

// Neck — tapers gently up toward chin
const NECK = 'M 90,51 C 88,57 87,65 88,72 L 112,72 C 113,65 112,57 110,51 Z'

// Torso — broad shoulders, armpit hollow, waist taper, hip flare, crotch
const TORSO = `M 90,72
  C 74,74 56,82 44,95
  C 37,104 37,118 39,132
  C 41,148 40,165 38,180
  C 38,195 39,209 43,221
  C 47,233 53,244 61,253
  L 139,253
  C 147,244 153,233 157,221
  C 161,209 162,195 162,180
  C 160,165 159,148 161,132
  C 163,118 163,104 156,95
  C 144,82 126,74 110,72 Z`

// Left arm — relaxed hang ~22° outward, elbow suggestion near y=240
const ARM_L = `M 44,95
  C 33,105 19,124 14,146
  C 9,165 8,185 8,205
  C 8,224 10,244 11,262
  C 11,273 9,283 7,293
  C 5,305 9,317 18,321
  C 27,325 35,321 39,313
  C 43,305 43,293 43,277
  C 43,259 42,241 42,223
  C 42,205 42,187 42,169
  C 42,150 42,130 41,112
  C 41,100 42,96 44,95 Z`

// Right arm (mirror: x → 200-x)
const ARM_R = `M 156,95
  C 167,105 181,124 186,146
  C 191,165 192,185 192,205
  C 192,224 190,244 189,262
  C 189,273 191,283 193,293
  C 195,305 191,317 182,321
  C 173,325 165,321 161,313
  C 157,305 157,293 157,277
  C 157,259 158,241 158,223
  C 158,205 158,187 158,169
  C 158,150 158,130 159,112
  C 159,100 158,96 156,95 Z`

// Left leg — thigh, knee taper, calf swell, ankle, foot stub
const LEG_L = `M 61,253
  C 55,267 51,285 49,304
  C 47,322 47,341 49,359
  C 51,373 51,388 49,402
  C 47,414 41,423 32,427
  C 23,431 15,428 11,422
  C 10,416 16,412 24,412
  C 32,412 38,408 40,398
  C 44,386 46,370 46,354
  C 46,336 46,318 48,302
  C 50,284 54,268 60,256
  C 64,250 72,246 82,246 Z`

// Right leg (mirror)
const LEG_R = `M 139,253
  C 145,267 149,285 151,304
  C 153,322 153,341 151,359
  C 149,373 149,388 151,402
  C 153,414 159,423 168,427
  C 177,431 185,428 189,422
  C 190,416 184,412 176,412
  C 168,412 162,408 160,398
  C 156,386 154,370 154,354
  C 154,336 154,318 152,302
  C 150,284 146,268 140,256
  C 136,250 128,246 118,246 Z`

// ─────────────────────────────────────────────────────────────────────────────
// SVG Defs
// ─────────────────────────────────────────────────────────────────────────────
function SVGDefs() {
  return (
    <defs>
      {/* Unified body outline — dilate → flood → composite → drop shadow → merge */}
      <filter id="bodyOut" x="-6%" y="-2%" width="112%" height="104%">
        <feMorphology in="SourceGraphic" operator="dilate" radius="2.4" result="dil"/>
        <feFlood floodColor="#1d4ed8" floodOpacity="0.45" result="col"/>
        <feComposite in="col" in2="dil" operator="in" result="rim"/>
        <feDropShadow dx="0" dy="14" stdDeviation="18" floodColor="#000" floodOpacity="0.80"/>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="rim"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      {/* Zone glow — available */}
      <filter id="zGlow" x="-80%" y="-80%" width="260%" height="260%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>

      {/* Recommended zone — stronger glow */}
      <filter id="recGlow" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur stdDeviation="6" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>

      {/* Body fill — dark navy gradient with hint of depth */}
      <linearGradient id="bodyGrad" x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0%"   stopColor="#1c3264"/>
        <stop offset="42%"  stopColor="#101e3e"/>
        <stop offset="100%" stopColor="#06101e"/>
      </linearGradient>

      {/* Centre-light sheen */}
      <radialGradient id="bodySheen" cx="44%" cy="28%" r="50%">
        <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.06"/>
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
      </radialGradient>
    </defs>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Recovery ring — animated SVG circle arc
// ─────────────────────────────────────────────────────────────────────────────
function RecoveryRing({ pct, color, size = 78 }: { pct: number; color: string; size?: number }) {
  const r      = (size - 10) / 2
  const circ   = 2 * Math.PI * r
  const filled = circ * (pct / 100)
  const cx     = size / 2
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke="rgba(255,255,255,0.06)" strokeWidth="5.5"/>
      <circle cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth="5.5" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        style={{
          transition: 'stroke-dasharray 0.75s cubic-bezier(0.4,0,0.2,1)',
          filter: `drop-shadow(0 0 5px ${color}99)`,
        }}/>
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone detail bottom sheet
// ─────────────────────────────────────────────────────────────────────────────
function ZoneSheet({
  zone, days, isRec, onClose, onLog,
}: {
  zone: Zone; days: number | undefined
  isRec: boolean; onClose: () => void; onLog: () => void
}) {
  const s     = zSt(days)
  const avail = isAvail(days)
  const pct   = recPct(days)
  const dayLabel =
    days === undefined ? 'Noch nie verwendet'
    : days === 0       ? 'Heute injiziert'
    : days === 1       ? 'Gestern injiziert'
    : `Vor ${days} Tagen injiziert`

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.60)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          animation: 'it-fade-in 0.2s ease-out',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
        background: 'linear-gradient(180deg, rgba(10,16,38,0.99) 0%, rgba(4,8,18,1) 100%)',
        borderTop: `1px solid ${s.color}22`,
        borderRadius: '22px 22px 0 0',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
        boxShadow: `0 -24px 64px rgba(0,0,0,0.65), 0 -1px 0 ${s.color}18`,
        animation: 'it-slide-up 0.32s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }}/>
        </div>

        <div style={{ padding: '12px 22px 0' }}>

          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 15, flexShrink: 0,
              background: s.bg, border: `1.5px solid ${s.color}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 11, height: 11, borderRadius: '50%',
                background: s.color, boxShadow: `0 0 10px ${s.color}`,
              }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#eaeefc', letterSpacing: '-0.02em' }}>
                  {zone.label}
                </h3>
                {isRec && (
                  <span style={{
                    fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: '#00ccf5',
                    background: 'rgba(0,204,245,0.10)', border: '1px solid rgba(0,204,245,0.24)',
                    padding: '2px 8px', borderRadius: 6,
                  }}>Empfohlen</span>
                )}
              </div>
              <p style={{ fontSize: '0.68rem', color: 'rgba(154,170,191,0.48)' }}>
                {zone.muscle} · {zone.method}
              </p>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <X size={14} color="rgba(154,170,191,0.55)"/>
            </button>
          </div>

          {/* Recovery ring + info pills */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 22 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <RecoveryRing pct={pct} color={s.color} size={78}/>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{pct}%</span>
                <span style={{
                  fontSize: '0.46rem', fontWeight: 700, letterSpacing: '0.1em',
                  textTransform: 'uppercase', color: 'rgba(154,170,191,0.42)', marginTop: 3,
                }}>Recovery</span>
              </div>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)',
                borderRadius: 12, padding: '9px 13px',
              }}>
                <span style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.42)' }}>Letzter Einsatz</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: s.color }}>{dayLabel}</span>
              </div>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)',
                borderRadius: 12, padding: '9px 13px',
              }}>
                <span style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.42)' }}>Status</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: s.color }}>
                  {s.phase === 'blocked' ? '⏳ Erholung' : s.phase === 'caution' ? '⚠ Fast bereit' : '✓ Verfügbar'}
                </span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => { if (avail) { onLog(); onClose() } }}
            disabled={!avail}
            style={{
              width: '100%', padding: '16px 0', borderRadius: 16, cursor: avail ? 'pointer' : 'not-allowed',
              fontSize: '0.9rem', fontWeight: 700, letterSpacing: '-0.01em',
              background: avail
                ? `linear-gradient(135deg, ${s.color}2a, ${s.color}14)`
                : 'rgba(255,255,255,0.02)',
              border: avail
                ? `1.5px solid ${s.color}42`
                : '1.5px solid rgba(255,255,255,0.05)',
              color: avail ? s.color : 'rgba(154,170,191,0.22)',
              boxShadow: avail ? `0 6px 28px ${s.color}14` : 'none',
              transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
            }}>
            {avail ? '💉 Hier injizieren' : '⏳ Noch in Erholung'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Body SVG — renders body + zone markers; handles swipe gesture
// ─────────────────────────────────────────────────────────────────────────────
function BodyView({
  view, days, rec, selected, onZone, onFlip,
}: {
  view: 'front'|'back'; days: Record<string, number>
  rec: string|null; selected: string|null
  onZone: (k: string) => void; onFlip: () => void
}) {
  const zones       = ZONES.filter(z => z.view === view)
  const startX      = useRef(0)
  const deltaX      = useRef(0)
  const [drag, setDrag] = useState(0)
  const [moving, setMoving] = useState(false)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    deltaX.current = 0
    setMoving(true)
  }
  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current
    deltaX.current = dx
    setDrag(Math.max(-90, Math.min(90, dx)) * 0.32)
  }
  function onTouchEnd() {
    if (Math.abs(deltaX.current) > 52) onFlip()
    setDrag(0)
    setMoving(false)
    deltaX.current = 0
  }

  const BG = { fill: 'url(#bodyGrad)' } as const
  const SH = { fill: 'url(#bodySheen)' } as const

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'none', userSelect: 'none', cursor: 'grab' }}>
      <svg
        viewBox="0 0 200 440"
        width="100%"
        style={{
          display: 'block', maxWidth: 210, margin: '0 auto',
          transform: `translateX(${drag}px)`,
          transition: moving ? 'none' : 'transform 0.36s cubic-bezier(0.32,0.72,0,1)',
          willChange: 'transform',
        }}
        shapeRendering="geometricPrecision">
        <SVGDefs/>

        {/* ── Body silhouette ─────────────────────────────────────── */}
        <g filter="url(#bodyOut)">
          <ellipse {...BG} cx={100} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY}/>
          <path {...BG} d={NECK}/>
          <path {...BG} d={TORSO}/>
          <path {...BG} d={ARM_L}/>
          <path {...BG} d={ARM_R}/>
          <path {...BG} d={LEG_L}/>
          <path {...BG} d={LEG_R}/>
          {/* Centre-light sheen overlay (same clip) */}
          <ellipse {...SH} cx={100} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY}/>
          <path {...SH} d={NECK}/>
          <path {...SH} d={TORSO}/>
          <path {...SH} d={ARM_L}/>
          <path {...SH} d={ARM_R}/>
          <path {...SH} d={LEG_L}/>
          <path {...SH} d={LEG_R}/>
        </g>

        {/* ── Anatomy lines — very subtle ─────────────────────────── */}
        {view === 'front' && (
          <g stroke="rgba(100,150,225,0.11)" strokeWidth="0.8" fill="none" strokeLinecap="round">
            {/* Clavicle */}
            <path d="M 66,79 C 80,85 92,87 100,87 C 108,87 120,85 134,79"/>
            {/* Sternal line */}
            <line x1="100" y1="87" x2="100" y2="251"/>
            {/* Pectoral fold */}
            <path d="M 58,127 C 72,135 88,137 100,136 C 112,137 128,135 142,127"/>
            {/* Abs creases */}
            <line x1="88" y1="166" x2="112" y2="166"/>
            <line x1="88" y1="186" x2="112" y2="186"/>
            <line x1="88" y1="206" x2="112" y2="206"/>
            {/* Knee lines */}
            <path d="M 49,356 C 55,360 59,360 63,356"/>
            <path d="M 137,356 C 141,360 145,360 151,356"/>
          </g>
        )}
        {view === 'back' && (
          <g stroke="rgba(100,150,225,0.11)" strokeWidth="0.8" fill="none" strokeLinecap="round">
            {/* Spine */}
            <line x1="100" y1="79" x2="100" y2="251" strokeDasharray="3 6"/>
            {/* Scapulae */}
            <path d="M 66,102 C 70,118 72,135 68,152"/>
            <path d="M 134,102 C 130,118 128,135 132,152"/>
            {/* Gluteal fold */}
            <path d="M 68,249 C 80,257 100,259 120,257 C 132,255 136,249 136,249"/>
            {/* Knee lines */}
            <path d="M 49,356 C 55,360 59,360 63,356"/>
            <path d="M 137,356 C 141,360 145,360 151,356"/>
          </g>
        )}

        {/* ── Zone markers ────────────────────────────────────────── */}
        {zones.map(z => {
          const s     = zSt(days[z.key])
          const isRec = rec === z.key
          const isSel = selected === z.key
          const avail = isAvail(days[z.key])
          const d     = days[z.key]

          return (
            <g key={z.key}
              onClick={e => { e.stopPropagation(); onZone(z.key) }}
              style={{ cursor: 'pointer' }}>

              {/* Large invisible tap target */}
              <ellipse cx={z.cx} cy={z.cy} rx={z.rx + 4} ry={z.ry + 4} fill="transparent"/>

              {/* Recommended — outer pulse ring */}
              {isRec && (
                <ellipse cx={z.cx} cy={z.cy} rx={z.rx + 7} ry={z.ry + 7}
                  fill="none" stroke={s.color} strokeWidth="1.2"
                  style={{
                    animation: 'it-zone-pulse 2.6s ease-in-out infinite',
                    transformBox: 'fill-box', transformOrigin: 'center',
                  }}
                  filter="url(#recGlow)"/>
              )}

              {/* Status ellipse — thin ring, fills on select */}
              <ellipse cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry}
                fill={isSel ? `${s.color}1e` : `${s.color}0d`}
                stroke={s.color}
                strokeWidth={isSel ? 2.0 : 1.3}
                opacity={avail ? 1 : 0.58}
                filter={isRec ? 'url(#zGlow)' : undefined}
                style={{ transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)' }}/>

              {/* Centre dot */}
              <circle cx={z.cx} cy={z.cy} r={isSel ? 3.8 : 2.6}
                fill={s.color}
                style={{
                  filter: `drop-shadow(0 0 4px ${s.color})`,
                  animation: isRec ? 'it-dot-breathe 2.6s ease-in-out infinite' : undefined,
                }}/>

              {/* Day label below zone (≤6 days only) */}
              {d !== undefined && d <= 6 && (
                <text
                  x={z.cx} y={z.cy + z.ry + 9}
                  textAnchor="middle"
                  fontSize="7" fontWeight="700"
                  fill={s.color} opacity="0.80"
                  fontFamily="system-ui,-apple-system,sans-serif"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  {d === 0 ? '●' : `${d}T`}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export function InjectionTracker() {
  const [view,     setView]     = useState<'front'|'back'>('front')
  const [days,     setDays]     = useState<Record<string, number>>(INIT_DAYS)
  const [selected, setSelected] = useState<string|null>(null)
  const [history,  setHistory]  = useState<HistEntry[]>([])
  const [undo,     setUndo]     = useState<HistEntry|null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>|null>(null)

  const rec      = findRec(days)
  const recZone  = ZONES.find(z => z.key === rec)
  const selZone  = ZONES.find(z => z.key === selected) ?? null
  const freeN    = ZONES.filter(z => isAvail(days[z.key])).length
  const blockedN = ZONES.filter(z => { const d = days[z.key]; return d !== undefined && d < 2 }).length

  function logInjection(key: string) {
    const z = ZONES.find(x => x.key === key)!
    const entry: HistEntry = { key, label: z.label, prev: days[key], ts: Date.now() }
    setDays(p => ({ ...p, [key]: 0 }))
    setHistory(p => [entry, ...p].slice(0, 12))
    setUndo(entry)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setUndo(null), 6000)
    if (z.view !== view) setView(z.view)
    setSelected(null)
  }

  function undoEntry(e: HistEntry) {
    setDays(p => {
      const n = { ...p }
      if (e.prev === undefined) delete n[e.key]
      else n[e.key] = e.prev
      return n
    })
    setHistory(p => p.filter(x => x.ts !== e.ts))
    if (undo?.ts === e.ts) {
      setUndo(null)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }

  const flipView = () => setView(v => v === 'front' ? 'back' : 'front')

  // Card style shorthand
  const card: React.CSSProperties = {
    background: 'rgba(8,12,26,0.92)',
    border: '1px solid rgba(255,255,255,0.055)',
    borderRadius: 18, overflow: 'hidden',
  }

  return (
    <div style={{ paddingBottom: 96 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20, paddingTop: 4 }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#eaeefc', lineHeight: 1.1 }}>
          💉 Injektionsstellen
        </h1>
        <p style={{ fontSize: '0.68rem', color: 'rgba(154,170,191,0.42)', marginTop: 3 }}>
          Rotationsprotokoll · Tippe eine Zone
        </p>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {([
          { l: 'Bereit',  v: freeN,         c: '#10b981', bg: 'rgba(16,185,129,0.08)',  bd: 'rgba(16,185,129,0.18)' },
          { l: 'Pause',   v: blockedN,       c: '#ef4444', bg: 'rgba(239,68,68,0.08)',   bd: 'rgba(239,68,68,0.18)'  },
          { l: 'Gesamt',  v: ZONES.length,   c: '#00ccf5', bg: 'rgba(0,204,245,0.06)',   bd: 'rgba(0,204,245,0.16)'  },
        ] as const).map(s => (
          <div key={s.l} style={{
            flex: 1, borderRadius: 14, padding: '11px 8px', textAlign: 'center',
            background: s.bg, border: `1px solid ${s.bd}`,
          }}>
            <p style={{ fontSize: '1.45rem', fontWeight: 800, color: s.c, lineHeight: 1 }}>{s.v}</p>
            <p style={{ fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', color: 'rgba(154,170,191,0.44)', marginTop: 3 }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* ── Recommendation banner ── */}
      {recZone && (() => {
        const s = zSt(days[recZone.key])
        return (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
            background: 'linear-gradient(135deg,rgba(0,204,245,0.06),rgba(0,80,160,0.04))',
            border: '1px solid rgba(0,204,245,0.15)', borderRadius: 16, padding: '12px 14px',
          }}>
            <div style={{ fontSize: '1.25rem', flexShrink: 0 }}>⭐</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.52rem', fontWeight: 700, letterSpacing: '0.1em',
                textTransform: 'uppercase', color: 'rgba(0,204,245,0.62)', marginBottom: 2 }}>
                Optimale Zone
              </p>
              <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#eaeefc' }}>{recZone.label}</p>
              <p style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.4)', marginTop: 1 }}>
                {recZone.muscle} · {recZone.method}
              </p>
            </div>
            <button
              onClick={() => logInjection(recZone.key)}
              style={{
                padding: '9px 16px', borderRadius: 11, flexShrink: 0,
                background: 'linear-gradient(135deg,rgba(0,204,245,0.20),rgba(0,110,190,0.12))',
                border: '1px solid rgba(0,204,245,0.30)',
                color: '#00ccf5', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
              }}>
              ✓ Hier
            </button>
          </div>
        )
      })()}

      {/* ── View toggle ── */}
      <div style={{
        display: 'flex', gap: 5, marginBottom: 10,
        background: 'rgba(5,9,20,0.96)', border: '1px solid rgba(255,255,255,0.055)',
        borderRadius: 14, padding: 4,
      }}>
        {(['front', 'back'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '9px 0', borderRadius: 11,
            fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
            transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
            background: view === v
              ? 'linear-gradient(135deg,rgba(0,204,245,0.16),rgba(0,110,185,0.10))'
              : 'transparent',
            border: view === v ? '1px solid rgba(0,204,245,0.28)' : '1px solid transparent',
            color: view === v ? '#00ccf5' : 'rgba(154,170,191,0.44)',
            boxShadow: view === v ? '0 0 18px rgba(0,204,245,0.09)' : 'none',
          }}>
            {v === 'front' ? '👤 Vorderseite' : '🔄 Rückseite'}
          </button>
        ))}
      </div>

      {/* ── Body card ── */}
      <div style={{
        background: 'linear-gradient(175deg,rgba(5,9,22,0.99),rgba(2,5,14,1))',
        border: '1px solid rgba(24,60,170,0.14)',
        borderRadius: 24, padding: '16px 6px 14px', marginBottom: 14,
        boxShadow: '0 28px 70px rgba(0,0,0,0.72), inset 0 1px 0 rgba(50,110,255,0.05)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Ambient body glow */}
        <div style={{
          position: 'absolute', top: '38%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 170, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(6,36,130,0.09) 0%,transparent 70%)',
          pointerEvents: 'none',
        }}/>

        <p style={{
          textAlign: 'center', fontSize: '0.5rem', fontWeight: 600,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'rgba(154,170,191,0.22)', marginBottom: 8,
        }}>← Wischen zum Wechseln →</p>

        <BodyView
          view={view} days={days} rec={rec}
          selected={selected}
          onZone={k => setSelected(p => p === k ? null : k)}
          onFlip={flipView}/>

        {/* Legend */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px 14px',
          justifyContent: 'center', marginTop: 12, padding: '0 8px',
        }}>
          {[
            { c: '#10b981', l: '5+ Tage frei' },
            { c: '#eab308', l: '2–4 Tage' },
            { c: '#f97316', l: 'Gestern' },
            { c: '#ef4444', l: 'Heute' },
          ].map(x => (
            <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: x.c, boxShadow: `0 0 5px ${x.c}88` }}/>
              <span style={{ fontSize: '0.54rem', color: 'rgba(154,170,191,0.44)' }}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── History ── */}
      {history.length > 0 && (
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{
            padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.042)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}>
            <Undo2 size={12} color="rgba(154,170,191,0.38)"/>
            <span style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'rgba(154,170,191,0.38)' }}>Verlauf</span>
          </div>
          {history.slice(0, 4).map((e, i) => (
            <div key={e.ts} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
              borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.030)' : 'none',
            }}>
              <CheckCircle2 size={13} color="rgba(0,204,245,0.42)" style={{ flexShrink: 0 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(234,238,252,0.78)' }}>{e.label}</p>
                <p style={{ fontSize: '0.57rem', color: 'rgba(154,170,191,0.34)', marginTop: 1 }}>
                  {new Date(e.ts).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr
                </p>
              </div>
              <button onClick={() => undoEntry(e)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 8, flexShrink: 0,
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)',
                color: 'rgba(239,68,68,0.62)', fontSize: '0.63rem', fontWeight: 700, cursor: 'pointer',
              }}>
                <Undo2 size={10}/> Rückgängig
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Info footer ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 14px',
        borderRadius: 12, background: 'rgba(0,204,245,0.022)', border: '1px solid rgba(0,204,245,0.06)',
      }}>
        <Info size={13} color="rgba(0,204,245,0.38)" style={{ flexShrink: 0, marginTop: 1 }}/>
        <p style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.40)', lineHeight: 1.6 }}>
          Mindestens <strong style={{ color: 'rgba(154,170,191,0.62)' }}>2 Tage</strong> Pause
          pro Zone zur Vermeidung von Narbengewebe und Lipohypertrophie.
        </p>
      </div>

      {/* ── Zone detail sheet ── */}
      {selZone && (
        <ZoneSheet
          zone={selZone}
          days={days[selZone.key]}
          isRec={rec === selZone.key}
          onClose={() => setSelected(null)}
          onLog={() => logInjection(selZone.key)}/>
      )}

      {/* ── Undo toast ── */}
      {undo && (
        <div style={{
          position: 'fixed', bottom: 88, left: '50%', zIndex: 9999,
          width: 'calc(100% - 32px)', maxWidth: 380,
          background: 'rgba(7,12,30,0.97)',
          border: '1px solid rgba(0,204,245,0.20)',
          borderRadius: 16, padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 12px 44px rgba(0,0,0,0.60)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          animation: 'it-toast-in 0.22s cubic-bezier(0.32,0.72,0,1)',
        }}>
          <CheckCircle2 size={17} color="#10b981" style={{ flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#eaeefc' }}>{undo.label} markiert</p>
            <p style={{ fontSize: '0.6rem', color: 'rgba(154,170,191,0.46)', marginTop: 1 }}>
              Recovery-Timer gestartet
            </p>
          </div>
          <button onClick={() => undoEntry(undo)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 12px', borderRadius: 9, flexShrink: 0,
            background: 'rgba(239,68,68,0.09)', border: '1px solid rgba(239,68,68,0.20)',
            color: '#f87171', fontSize: '0.71rem', fontWeight: 700, cursor: 'pointer',
          }}>
            <Undo2 size={12}/> Rückgängig
          </button>
        </div>
      )}
    </div>
  )
}
