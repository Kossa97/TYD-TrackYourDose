import { useState, useRef } from 'react'
import { Info, Undo2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

// ── Zone definitions ──────────────────────────────────────────────────────────
interface Zone {
  key:    string
  label:  string
  muscle: string
  method: string
  view:   'front' | 'back'
  // SVG overlay shape: ellipse params in 200×430 space
  cx: number; cy: number; rx: number; ry: number; rotate?: number
}

const ZONES: Zone[] = [
  // Front
  { key:'deltoid_l',  label:'Deltoid links',         muscle:'Schulter',      method:'Intramuskulär',           view:'front', cx:44,  cy:104, rx:16, ry:22, rotate:-18 },
  { key:'deltoid_r',  label:'Deltoid rechts',        muscle:'Schulter',      method:'Intramuskulär',           view:'front', cx:156, cy:104, rx:16, ry:22, rotate: 18 },
  { key:'trizeps_l',  label:'Trizeps links',         muscle:'Oberarm',       method:'Subkutan / Intramuskulär',view:'front', cx:34,  cy:158, rx:10, ry:22, rotate:-8  },
  { key:'trizeps_r',  label:'Trizeps rechts',        muscle:'Oberarm',       method:'Subkutan / Intramuskulär',view:'front', cx:166, cy:158, rx:10, ry:22, rotate: 8  },
  { key:'bauch_l',    label:'Bauch links',           muscle:'Abdomen',       method:'Subkutan',                view:'front', cx:82,  cy:206, rx:14, ry:18 },
  { key:'bauch_r',    label:'Bauch rechts',          muscle:'Abdomen',       method:'Subkutan',                view:'front', cx:118, cy:206, rx:14, ry:18 },
  { key:'ober_l',     label:'Oberschenkel links',    muscle:'Quadrizeps',    method:'Intramuskulär / Subkutan',view:'front', cx:74,  cy:305, rx:17, ry:30 },
  { key:'ober_r',     label:'Oberschenkel rechts',   muscle:'Quadrizeps',    method:'Intramuskulär / Subkutan',view:'front', cx:126, cy:305, rx:17, ry:30 },
  // Back
  { key:'gesaess_l',  label:'Gesäß links',           muscle:'Gluteus',       method:'Intramuskulär',           view:'back',  cx:82,  cy:228, rx:24, ry:28 },
  { key:'gesaess_r',  label:'Gesäß rechts',          muscle:'Gluteus',       method:'Intramuskulär',           view:'back',  cx:118, cy:228, rx:24, ry:28 },
  { key:'ober_hl',    label:'Oberschenkel hinten L', muscle:'Hamstrings',    method:'Intramuskulär',           view:'back',  cx:74,  cy:308, rx:16, ry:28 },
  { key:'ober_hr',    label:'Oberschenkel hinten R', muscle:'Hamstrings',    method:'Intramuskulär',           view:'back',  cx:126, cy:308, rx:16, ry:28 },
  { key:'wade_l',     label:'Wade links',            muscle:'Gastrocnemius', method:'Intramuskulär',           view:'back',  cx:72,  cy:375, rx:11, ry:22 },
  { key:'wade_r',     label:'Wade rechts',           muscle:'Gastrocnemius', method:'Intramuskulär',           view:'back',  cx:128, cy:375, rx:11, ry:22 },
]

// ── Status colors ─────────────────────────────────────────────────────────────
function statusTheme(days: number | undefined) {
  if (days === undefined) return { fill:'rgba(16,185,129,0.28)',  stroke:'#10b981', label:'Frei',    dot:'#10b981' }
  if (days === 0)  return        { fill:'rgba(239,68,68,0.28)',   stroke:'#ef4444', label:'Heute',   dot:'#ef4444' }
  if (days === 1)  return        { fill:'rgba(249,115,22,0.28)',  stroke:'#f97316', label:'Gestern', dot:'#f97316' }
  if (days <= 3)   return        { fill:'rgba(234,179,8,0.28)',   stroke:'#eab308', label:`${days}T`, dot:'#eab308' }
  if (days <= 5)   return        { fill:'rgba(34,197,94,0.28)',   stroke:'#22c55e', label:`${days}T`, dot:'#22c55e' }
  return                         { fill:'rgba(16,185,129,0.28)',  stroke:'#10b981', label:`${days}T`, dot:'#10b981' }
}

function canInject(days: number | undefined) { return days === undefined || days >= 2 }

function recommended(days: Record<string, number>) {
  return [...ZONES]
    .map(z => ({ key: z.key, d: days[z.key] ?? 999 }))
    .filter(z => z.d >= 2)
    .sort((a,b) => b.d - a.d)[0]?.key ?? null
}

const INITIAL: Record<string, number> = {
  deltoid_l:0, deltoid_r:3, trizeps_l:1, trizeps_r:6,
  bauch_l:7,   bauch_r:2,   ober_l:4,    ober_r:1,
  gesaess_l:9, gesaess_r:5, ober_hl:0,   ober_hr:8,
  wade_l:6,    wade_r:3,
}

// ── SVG body paths (200×430 viewBox) ─────────────────────────────────────────
// Front: head + torso + arms + legs traced with cubic bezier curves
const FRONT_PATH = `
  M 100,8
  C 120,8 124,18 124,30 C 124,50 116,60 100,62
  C  84,60  76,50  76,30 C  76,18  80,8 100,8 Z
  M  92,62 C  88,63  84,66  82,72 C  62,74  46,80  38,92
  C  30,104  28,130  28,162 C  28,190  30,222  32,240
  C  34,245  36,248  38,250 C  40,252  42,252  44,250
  C  46,248  46,244  44,240 C  42,228  40,200  40,170
  C  40,148  42,126  50,116
  C  52,128  54,148  56,168 C  58,188  60,210  60,230
  C  60,235  60,240  62,244 C  64,248  68,248  70,244
  C  72,240  72,234  72,228
  L  72,248 C  70,260  68,278  68,300 C  68,322  70,348  72,370
  C  74,390  74,406  72,416 C  68,420  58,420  54,418
  C  50,416  48,412  50,408 C  52,404  58,404  62,402
  C  64,394  64,372  64,348 C  64,324  66,302  68,282
  C  70,302  72,328  72,350 C  72,374  72,396  70,414
  C  68,420  76,422  80,420 C  84,418  86,414  86,408
  C  86,400  84,384  82,364 C  80,344  78,322  78,300
  L  78,262 C  84,268  90,268  96,264 C 100,262 102,258 102,256
  C 104,258 108,264 116,264 C 122,268 126,266 130,260
  L 130,300 C 130,322 128,344 126,364 C 124,384 122,400 122,408
  C 122,414 124,420 128,420 C 132,422 140,420 138,414
  C 136,396 136,374 136,350 C 136,328 138,302 140,282
  C 142,302 142,324 142,348 C 142,372 142,394 144,402
  C 148,404 154,404 156,408 C 158,412 156,416 152,418
  C 148,420 138,420 134,416 C 132,406 132,390 132,370
  C 130,348 130,322 130,300 L 130,228
  C 130,234 130,240 132,244 C 134,248 138,248 140,244
  C 142,240 142,236 140,230 C 140,210 138,188 140,168
  C 142,148 148,128 150,116
  C 158,126 160,148 160,170 C 160,200 158,228 156,240
  C 154,244 154,248 156,250 C 158,252 160,252 162,250
  C 164,248 166,245 168,240 C 170,222 172,190 172,162
  C 172,130 170,104 162,92 C 154,80 138,74 118,72
  C 116,66 112,63 108,62 Z
`

// Back view — mirrored but with gluteal shape difference
const BACK_PATH = `
  M 100,8
  C 120,8 124,18 124,30 C 124,50 116,60 100,62
  C  84,60  76,50  76,30 C  76,18  80,8 100,8 Z
  M  92,62 C  88,63  84,66  82,72 C  62,74  46,80  38,92
  C  30,104  28,130  28,162 C  28,190  30,222  32,240
  C  34,245  36,248  38,250 C  40,252  42,252  44,250
  C  46,248  46,244  44,240 C  42,228  40,200  40,170
  C  40,148  42,126  50,116
  C  52,128  54,148  56,168 C  58,188  60,210  60,230
  C  60,235  60,240  62,244 C  64,248  68,248  70,244
  C  72,240  72,234  72,228
  L  72,248 C  70,262  68,280  68,302 C  68,326  70,352  72,372
  C  74,392  74,408  72,416 C  68,420  58,420  54,418
  C  50,416  48,412  50,408 C  52,404  58,404  62,402
  C  64,394  64,372  64,348 C  64,324  66,302  68,280
  C  70,302  72,328  72,352 C  72,374  72,396  70,414
  C  68,420  76,422  80,420 C  84,418  86,414  86,408
  C  86,400  84,384  82,362 C  80,342  78,320  78,298
  C  78,278  80,258  82,242 C  86,232  92,226 100,226
  C 108,226 114,232 118,242 C 120,258 122,278 122,298
  C 122,320 120,342 118,362 C 116,384 114,400 114,408
  C 114,414 116,420 120,420 C 124,422 132,420 130,414
  C 128,396 128,374 128,352 C 128,328 130,302 132,280
  C 134,302 134,324 134,348 C 134,372 134,394 136,402
  C 140,404 146,404 148,408 C 150,412 148,416 144,418
  C 140,420 130,420 126,416 C 124,406 124,392 124,372
  C 122,348 120,320 120,298
  L 128,242
  C 130,234 130,240 132,244 C 134,248 138,248 140,244
  C 142,240 142,236 140,230 C 140,210 138,188 140,168
  C 142,148 148,128 150,116
  C 158,126 160,148 160,170 C 160,200 158,228 156,240
  C 154,244 154,248 156,250 C 158,252 160,252 162,250
  C 164,248 166,245 168,240 C 170,222 172,190 172,162
  C 172,130 170,104 162,92 C 154,80 138,74 118,72
  C 116,66 112,63 108,62 Z
`

// ── Body gradient defs ────────────────────────────────────────────────────────
function BodyDefs() {
  return (
    <defs>
      <linearGradient id="bodyGrad" x1="0.3" y1="0" x2="0.7" y2="1">
        <stop offset="0%"   stopColor="#1a2d52" />
        <stop offset="40%"  stopColor="#111e3a" />
        <stop offset="100%" stopColor="#080f24" />
      </linearGradient>
      <linearGradient id="bodyGradBack" x1="0.3" y1="0" x2="0.7" y2="1">
        <stop offset="0%"   stopColor="#162446" />
        <stop offset="100%" stopColor="#080f20" />
      </linearGradient>
      <filter id="bodyGlow" x="-10%" y="-5%" width="120%" height="110%">
        <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="#1a4aff" floodOpacity="0.25" />
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.6" />
      </filter>
      <filter id="zoneGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="2.5" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glowStrong" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      {/* Rim highlight */}
      <radialGradient id="rimLight" cx="30%" cy="20%" r="70%">
        <stop offset="0%"   stopColor="rgba(80,140,255,0.18)" />
        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
      </radialGradient>
    </defs>
  )
}

// ── Body SVG component ────────────────────────────────────────────────────────
function BodySVG({ view, days, rec, selected, onZone }: {
  view: 'front'|'back'; days: Record<string,number>
  rec: string|null; selected: string|null; onZone:(k:string)=>void
}) {
  const zones = ZONES.filter(z => z.view === view)
  const path  = view === 'front' ? FRONT_PATH : BACK_PATH
  const grad  = view === 'front' ? 'url(#bodyGrad)' : 'url(#bodyGradBack)'

  return (
    <svg viewBox="0 0 200 430" width="100%"
      style={{ display:'block', maxWidth: 220, margin:'0 auto' }}
      shapeRendering="geometricPrecision">
      <BodyDefs />

      {/* Outer ambient glow behind body */}
      <ellipse cx="100" cy="220" rx="72" ry="200"
        fill="none" stroke="rgba(30,80,200,0.12)" strokeWidth="28" />

      {/* Body silhouette */}
      <path d={path} fill={grad} stroke="rgba(80,130,220,0.30)"
        strokeWidth="1.2" filter="url(#bodyGlow)" />

      {/* Rim highlight overlay */}
      <path d={path} fill="url(#rimLight)" />

      {/* Subtle muscle lines (front only) */}
      {view === 'front' && (
        <g stroke="rgba(100,150,220,0.10)" strokeWidth="0.8" fill="none">
          <path d="M 84,80 Q 100,84 116,80" />
          <path d="M 78,118 Q 100,122 122,118" />
          <path d="M 76,140 Q 100,145 124,140" />
          <path d="M 78,162 Q 100,167 122,162" />
          <line x1="100" y1="85" x2="100" y2="220" />
        </g>
      )}
      {view === 'back' && (
        <g stroke="rgba(100,150,220,0.10)" strokeWidth="0.8" fill="none">
          <line x1="100" y1="82" x2="100" y2="218" strokeDasharray="3 4" />
          <path d="M 82,105 Q 86,118 80,132" />
          <path d="M 118,105 Q 114,118 120,132" />
        </g>
      )}

      {/* Zone overlays */}
      {zones.map(z => {
        const t      = statusTheme(days[z.key])
        const isRec  = rec === z.key
        const isSel  = selected === z.key
        const ok     = canInject(days[z.key])
        const rotate = z.rotate ? `rotate(${z.rotate} ${z.cx} ${z.cy})` : ''

        return (
          <g key={z.key} transform={rotate}
            onClick={() => onZone(z.key)}
            style={{ cursor: 'pointer' }}>

            {/* Outer pulse for recommended */}
            {isRec && (
              <ellipse cx={z.cx} cy={z.cy} rx={z.rx + 7} ry={z.ry + 7}
                fill="none" stroke={t.stroke} strokeWidth="1.2" opacity="0.35"
                style={{ animation: 'ob-ring-pulse 2s ease-out infinite' }} />
            )}

            {/* Zone fill */}
            <ellipse cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry}
              fill={t.fill} stroke={t.stroke} strokeWidth={isSel ? 2.0 : 1.4}
              filter={isRec ? 'url(#glowStrong)' : 'url(#zoneGlow)'}
              opacity={ok ? 1 : 0.75}
              style={{ transition: 'all 0.2s ease' }} />

            {/* Inner shine */}
            <ellipse cx={z.cx - z.rx*0.2} cy={z.cy - z.ry*0.25}
              rx={z.rx * 0.55} ry={z.ry * 0.32}
              fill="rgba(255,255,255,0.10)" />

            {/* Day badge */}
            <text x={z.cx} y={z.cy + 3}
              textAnchor="middle" dominantBaseline="middle"
              fill={t.stroke} fontSize="8.5" fontWeight="800"
              fontFamily="system-ui,sans-serif"
              style={{ pointerEvents:'none', userSelect:'none' }}>
              {t.label}
            </text>

            {/* Star for recommended */}
            {isRec && (
              <text x={z.cx} y={z.cy - z.ry + 5}
                textAnchor="middle" fontSize="8"
                style={{ pointerEvents:'none' }}>⭐</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── History ───────────────────────────────────────────────────────────────────
interface Hist { key:string; label:string; prev:number|undefined; ts:number }

// ── Main page ─────────────────────────────────────────────────────────────────
export function InjectionTracker() {
  const [view,      setView]      = useState<'front'|'back'>('front')
  const [days,      setDays]      = useState<Record<string,number>>(INITIAL)
  const [selected,  setSelected]  = useState<string|null>(null)
  const [history,   setHistory]   = useState<Hist[]>([])
  const [undoToast, setUndoToast] = useState<Hist|null>(null)
  const [listOpen,  setListOpen]  = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null)

  const rec         = recommended(days)
  const recZone     = ZONES.find(z => z.key === rec)
  const selectedZone = ZONES.find(z => z.key === selected) ?? null
  const sortedZones = [...ZONES].sort((a,b) => (days[b.key]??999)-(days[a.key]??999))

  function log(key: string) {
    const z = ZONES.find(x => x.key === key)!
    const entry: Hist = { key, label: z.label, prev: days[key], ts: Date.now() }
    setDays(p => ({...p, [key]:0}))
    setHistory(p => [entry,...p].slice(0,12))
    setUndoToast(entry)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setUndoToast(null), 6000)
    if (z.view !== view) setView(z.view)
    setSelected(null)
  }

  function undo(e: Hist) {
    setDays(p => { const n={...p}; if(e.prev===undefined) delete n[e.key]; else n[e.key]=e.prev; return n })
    setHistory(p => p.filter(x => x.ts !== e.ts))
    if (undoToast?.ts === e.ts) { setUndoToast(null); if(timer.current) clearTimeout(timer.current) }
  }

  const freeCount = ZONES.filter(z => (days[z.key]??999) >= 5).length
  const pauseCount = ZONES.filter(z => { const d=days[z.key]; return d!==undefined && d<2 }).length

  return (
    <div style={{ paddingBottom: 96 }}>

      {/* ── Header ── */}
      <div style={{ marginBottom:16, paddingTop:4 }}>
        <h1 style={{ fontSize:'1.4rem', fontWeight:800, letterSpacing:'-0.03em', color:'#eaeefc' }}>
          💉 Injektionsstellen
        </h1>
        <p style={{ fontSize:'0.7rem', color:'rgba(154,170,191,0.48)', marginTop:3 }}>
          Rotationsprotokoll · Tippe eine Zone an
        </p>
      </div>

      {/* ── Stats ── */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {[
          { label:'Frei',    value:freeCount,            color:'#10b981', bg:'rgba(16,185,129,0.09)',  border:'rgba(16,185,129,0.18)' },
          { label:'Pause',   value:pauseCount,           color:'#ef4444', bg:'rgba(239,68,68,0.09)',   border:'rgba(239,68,68,0.18)'  },
          { label:'Gesamt',  value:ZONES.length,         color:'#00ccf5', bg:'rgba(0,204,245,0.07)',   border:'rgba(0,204,245,0.16)'  },
        ].map(s => (
          <div key={s.label} style={{ flex:1, borderRadius:13, padding:'9px 8px', textAlign:'center', background:s.bg, border:`1px solid ${s.border}` }}>
            <p style={{ fontSize:'1.3rem', fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</p>
            <p style={{ fontSize:'0.53rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', color:'rgba(154,170,191,0.48)', marginTop:3 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Recommendation ── */}
      {recZone && (() => {
        const t = statusTheme(days[recZone.key])
        return (
          <div style={{
            display:'flex', alignItems:'center', gap:11, marginBottom:14,
            background:'linear-gradient(135deg,rgba(0,204,245,0.07),rgba(0,100,180,0.04))',
            border:'1px solid rgba(0,204,245,0.16)', borderRadius:14, padding:'11px 14px',
          }}>
            <div style={{ width:38,height:38,borderRadius:'50%',flexShrink:0, background:'rgba(0,204,245,0.10)',border:'1.5px solid rgba(0,204,245,0.28)', display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem' }}>⭐</div>
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontSize:'0.55rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'rgba(0,204,245,0.7)',marginBottom:2 }}>Optimale Zone heute</p>
              <p style={{ fontSize:'0.88rem',fontWeight:700,color:'#eaeefc' }}>{recZone.label}</p>
              <p style={{ fontSize:'0.6rem',color:'rgba(154,170,191,0.42)',marginTop:1 }}>
                {recZone.muscle} · {recZone.method}
              </p>
            </div>
            <button onClick={() => log(recZone.key)} style={{
              padding:'8px 14px',borderRadius:10,flexShrink:0,
              background:'linear-gradient(135deg,rgba(0,204,245,0.20),rgba(0,120,200,0.12))',
              border:'1px solid rgba(0,204,245,0.30)',color:'#00ccf5',fontSize:'0.72rem',fontWeight:700,cursor:'pointer',
            }}>✓ Hier</button>
          </div>
        )
      })()}

      {/* ── View toggle ── */}
      <div style={{ display:'flex',gap:5,marginBottom:10, background:'rgba(6,10,22,0.95)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:13,padding:4 }}>
        {(['front','back'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            flex:1,padding:'8px 0',borderRadius:10,fontWeight:700,fontSize:'0.78rem',cursor:'pointer',transition:'all 0.18s',
            background: view===v ? 'linear-gradient(135deg,rgba(0,204,245,0.18),rgba(0,120,190,0.12))' : 'transparent',
            border:     view===v ? '1px solid rgba(0,204,245,0.32)' : '1px solid transparent',
            color:      view===v ? '#00ccf5' : 'rgba(154,170,191,0.5)',
            boxShadow:  view===v ? '0 0 14px rgba(0,204,245,0.12)' : 'none',
          }}>
            {v==='front' ? '👤 Vorderseite' : '🔄 Rückseite'}
          </button>
        ))}
      </div>

      {/* ── Body map card ── */}
      <div style={{
        background:'linear-gradient(175deg,rgba(8,14,34,0.98) 0%,rgba(4,8,20,1) 100%)',
        border:'1px solid rgba(30,80,200,0.14)',
        borderRadius:22, padding:'18px 8px 14px', marginBottom:14,
        boxShadow:'0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02), inset 0 1px 0 rgba(80,130,255,0.06)',
        position:'relative', overflow:'hidden',
      }}>
        {/* Ambient halo */}
        <div style={{ position:'absolute',top:'45%',left:'50%',transform:'translate(-50%,-50%)', width:240,height:360,borderRadius:'50%', background:'radial-gradient(circle,rgba(20,60,180,0.07) 0%,transparent 70%)', pointerEvents:'none' }} />

        <BodySVG view={view} days={days} rec={rec} selected={selected}
          onZone={k => setSelected(prev => prev===k ? null : k)} />

        {/* Legend */}
        <div style={{ display:'flex',flexWrap:'wrap',gap:'5px 12px',justifyContent:'center',marginTop:12, padding:'0 8px' }}>
          {[
            {c:'#10b981',l:'5+ Tage · frei'},
            {c:'#eab308',l:'2–3 Tage'},
            {c:'#f97316',l:'Gestern'},
            {c:'#ef4444',l:'Heute · Pause'},
          ].map(x=>(
            <div key={x.l} style={{ display:'flex',alignItems:'center',gap:4 }}>
              <div style={{ width:7,height:7,borderRadius:'50%',background:x.c,boxShadow:`0 0 5px ${x.c}99` }} />
              <span style={{ fontSize:'0.55rem',color:'rgba(154,170,191,0.52)' }}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Detail panel (when zone selected) ── */}
      {selectedZone && (() => {
        const t  = statusTheme(days[selectedZone.key])
        const ok = canInject(days[selectedZone.key])
        const d  = days[selectedZone.key]
        return (
          <div style={{
            background:'rgba(8,12,28,0.98)',border:`1px solid ${t.stroke}30`,
            borderRadius:16,padding:'14px 16px',marginBottom:14,
            boxShadow:`0 0 24px ${t.stroke}18`,
            animation:'ob-step-enter 0.18s ease-out',
          }}>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
              <div style={{ width:10,height:10,borderRadius:'50%',background:t.stroke,boxShadow:`0 0 8px ${t.stroke}`,flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'0.9rem',fontWeight:700,color:'#eaeefc' }}>{selectedZone.label}</p>
                <p style={{ fontSize:'0.62rem',color:'rgba(154,170,191,0.5)',marginTop:1 }}>
                  {selectedZone.muscle} · {selectedZone.method}
                </p>
              </div>
              <span style={{ fontSize:'0.75rem',fontWeight:700,color:t.stroke }}>
                {d===undefined?'Frei':d===0?'Heute':d===1?'Gestern':`vor ${d}T`}
              </span>
            </div>

            {/* Recovery bar */}
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                <span style={{ fontSize:'0.58rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'rgba(154,170,191,0.45)' }}>Recovery</span>
                <span style={{ fontSize:'0.68rem',fontWeight:700,color:t.stroke }}>
                  {d===undefined?100:d===0?8:d===1?30:d===2?55:d===3?72:d===4?85:d===5?94:100}%
                </span>
              </div>
              <div style={{ height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden' }}>
                <div style={{
                  height:'100%',borderRadius:2,
                  width:`${d===undefined?100:d===0?8:d===1?30:d===2?55:d===3?72:d===4?85:d===5?94:100}%`,
                  background:`linear-gradient(90deg,${t.stroke}88,${t.stroke})`,
                  boxShadow:`0 0 6px ${t.stroke}66`,transition:'width 0.5s ease',
                }}/>
              </div>
            </div>

            <div style={{ display:'flex',gap:8 }}>
              <button onClick={() => setSelected(null)} style={{
                flex:1,padding:'9px 0',borderRadius:9,
                background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',
                color:'rgba(154,170,191,0.6)',fontSize:'0.75rem',fontWeight:600,cursor:'pointer',
              }}>Schließen</button>
              <button onClick={() => ok && log(selectedZone.key)} disabled={!ok} style={{
                flex:2,padding:'9px 0',borderRadius:9,
                background: ok?`linear-gradient(135deg,${t.stroke}28,${t.stroke}12)`:'rgba(255,255,255,0.03)',
                border: ok?`1px solid ${t.stroke}40`:'1px solid rgba(255,255,255,0.06)',
                color: ok?t.stroke:'rgba(154,170,191,0.25)',
                fontSize:'0.78rem',fontWeight:700,cursor:ok?'pointer':'not-allowed',
              }}>
                {ok?'💉 Hier injizieren':'⏳ In Erholung'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Zone list (collapsible) ── */}
      <div style={{ background:'rgba(8,12,26,0.92)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:18,overflow:'hidden',marginBottom:12 }}>
        <button onClick={() => setListOpen(p=>!p)} style={{
          width:'100%',display:'flex',alignItems:'center',gap:8,padding:'12px 16px',
          background:'transparent',border:'none',cursor:'pointer',
          borderBottom: listOpen?'1px solid rgba(255,255,255,0.045)':'none',
        }}>
          <span style={{ fontSize:'0.6rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'rgba(154,170,191,0.45)',flex:1,textAlign:'left' }}>
            Alle Zonen
          </span>
          {listOpen?<ChevronUp size={14} color="rgba(154,170,191,0.4)"/>:<ChevronDown size={14} color="rgba(154,170,191,0.4)"/>}
        </button>

        {listOpen && sortedZones.map((z,i) => {
          const t  = statusTheme(days[z.key])
          const d  = days[z.key]
          const ok = canInject(d)
          const isRec = rec === z.key
          return (
            <div key={z.key} onClick={() => setSelected(prev=>prev===z.key?null:z.key)} style={{
              display:'flex',alignItems:'center',gap:11,padding:'10px 16px',
              borderBottom:i<sortedZones.length-1?'1px solid rgba(255,255,255,0.032)':'none',
              background:isRec?'rgba(0,204,245,0.035)':'transparent',cursor:'pointer',
            }}>
              <div style={{ width:9,height:9,borderRadius:'50%',flexShrink:0,background:t.stroke,boxShadow:`0 0 7px ${t.stroke}99` }} />
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:'0.82rem',fontWeight:600,color:'#eaeefc',lineHeight:1 }}>
                  {z.label}
                  {isRec&&<span style={{ marginLeft:6,fontSize:'0.5rem',fontWeight:700,background:'rgba(0,204,245,0.12)',color:'#00ccf5',border:'1px solid rgba(0,204,245,0.22)',padding:'1px 5px',borderRadius:4,verticalAlign:'middle' }}>⭐</span>}
                </p>
                <p style={{ fontSize:'0.58rem',color:'rgba(154,170,191,0.36)',marginTop:2 }}>{z.muscle} · {z.view==='front'?'Vorne':'Hinten'}</p>
              </div>
              <p style={{ fontSize:'0.72rem',fontWeight:700,color:t.stroke,minWidth:54,textAlign:'right' }}>
                {d===undefined?'Frei':d===0?'Heute':d===1?'Gestern':`vor ${d}T`}
              </p>
              <button onClick={e=>{e.stopPropagation();ok&&log(z.key)}} disabled={!ok} style={{
                width:28,height:28,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',
                background:ok?'rgba(0,204,245,0.07)':'rgba(255,255,255,0.02)',
                border:ok?'1px solid rgba(0,204,245,0.18)':'1px solid rgba(255,255,255,0.04)',
                color:ok?'rgba(0,204,245,0.6)':'rgba(154,170,191,0.18)',fontSize:'0.72rem',cursor:ok?'pointer':'not-allowed',
              }}>✓</button>
            </div>
          )
        })}
      </div>

      {/* ── History ── */}
      {history.length > 0 && (
        <div style={{ background:'rgba(8,12,26,0.92)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:16,overflow:'hidden',marginBottom:12 }}>
          <div style={{ padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.045)',display:'flex',alignItems:'center',gap:6 }}>
            <Undo2 size={12} color="rgba(154,170,191,0.4)" />
            <span style={{ fontSize:'0.58rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'rgba(154,170,191,0.4)' }}>Verlauf</span>
          </div>
          {history.slice(0,5).map((e,i) => (
            <div key={e.ts} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 16px', borderBottom:i<Math.min(history.length,5)-1?'1px solid rgba(255,255,255,0.032)':'none' }}>
              <CheckCircle2 size={13} color="rgba(0,204,245,0.45)" style={{ flexShrink:0 }} />
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:'0.78rem',fontWeight:600,color:'rgba(234,238,252,0.8)' }}>{e.label}</p>
                <p style={{ fontSize:'0.57rem',color:'rgba(154,170,191,0.36)',marginTop:1 }}>
                  {new Date(e.ts).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'})} Uhr
                </p>
              </div>
              <button onClick={()=>undo(e)} style={{ display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:8, background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.16)',color:'rgba(239,68,68,0.65)',fontSize:'0.63rem',fontWeight:700,cursor:'pointer',flexShrink:0 }}>
                <Undo2 size={10}/> Rückgängig
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Info ── */}
      <div style={{ display:'flex',alignItems:'flex-start',gap:8,padding:'10px 13px',borderRadius:11,background:'rgba(0,204,245,0.03)',border:'1px solid rgba(0,204,245,0.08)' }}>
        <Info size={13} color="rgba(0,204,245,0.4)" style={{ flexShrink:0,marginTop:1 }} />
        <p style={{ fontSize:'0.61rem',color:'rgba(154,170,191,0.45)',lineHeight:1.55 }}>
          Mindestens <strong style={{ color:'rgba(154,170,191,0.72)' }}>2 Tage</strong> Pause pro Zone um Narbenbildung zu vermeiden. Grüne Zonen sind am sichersten.
        </p>
      </div>

      {/* ── Undo toast ── */}
      {undoToast && (
        <div style={{
          position:'fixed',bottom:86,left:'50%',transform:'translateX(-50%)',
          zIndex:9999,width:'calc(100% - 32px)',maxWidth:380,
          background:'rgba(8,13,32,0.97)',border:'1px solid rgba(0,204,245,0.22)',
          borderRadius:15,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,
          boxShadow:'0 10px 40px rgba(0,0,0,0.55)',backdropFilter:'blur(14px)',
          animation:'ob-step-enter 0.2s ease-out',
        }}>
          <CheckCircle2 size={17} color="#10b981" style={{ flexShrink:0 }} />
          <div style={{ flex:1,minWidth:0 }}>
            <p style={{ fontSize:'0.8rem',fontWeight:700,color:'#eaeefc' }}>{undoToast.label} markiert</p>
            <p style={{ fontSize:'0.61rem',color:'rgba(154,170,191,0.48)',marginTop:1 }}>Recovery-Zähler gestartet</p>
          </div>
          <button onClick={()=>undo(undoToast)} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:9, background:'rgba(239,68,68,0.10)',border:'1px solid rgba(239,68,68,0.22)',color:'#f87171',fontSize:'0.71rem',fontWeight:700,cursor:'pointer',flexShrink:0 }}>
            <Undo2 size={12}/> Rückgängig
          </button>
        </div>
      )}
    </div>
  )
}
