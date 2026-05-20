import { useState, useRef } from 'react'
import { Info, Undo2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

// ── Zone definitions ──────────────────────────────────────────────────────────
interface Zone {
  key: string; label: string; muscle: string; method: string
  view: 'front' | 'back'
  cx: number; cy: number; rx: number; ry: number; rotate?: number
}

const ZONES: Zone[] = [
  { key:'deltoid_l',  label:'Deltoid links',         muscle:'Schulter',      method:'Intramuskulär',            view:'front', cx:28,  cy:118, rx:15, ry:20, rotate:-10 },
  { key:'deltoid_r',  label:'Deltoid rechts',        muscle:'Schulter',      method:'Intramuskulär',            view:'front', cx:172, cy:118, rx:15, ry:20, rotate: 10 },
  { key:'trizeps_l',  label:'Trizeps links',         muscle:'Oberarm',       method:'Subkutan / Intramuskulär', view:'front', cx:14,  cy:168, rx:10, ry:22, rotate:-5  },
  { key:'trizeps_r',  label:'Trizeps rechts',        muscle:'Oberarm',       method:'Subkutan / Intramuskulär', view:'front', cx:186, cy:168, rx:10, ry:22, rotate:  5 },
  { key:'bauch_l',    label:'Bauch links',           muscle:'Abdomen',       method:'Subkutan',                 view:'front', cx:76,  cy:204, rx:15, ry:19 },
  { key:'bauch_r',    label:'Bauch rechts',          muscle:'Abdomen',       method:'Subkutan',                 view:'front', cx:124, cy:204, rx:15, ry:19 },
  { key:'ober_l',     label:'Oberschenkel links',    muscle:'Quadrizeps',    method:'Intramuskulär / Subkutan', view:'front', cx:64,  cy:310, rx:16, ry:30 },
  { key:'ober_r',     label:'Oberschenkel rechts',   muscle:'Quadrizeps',    method:'Intramuskulär / Subkutan', view:'front', cx:136, cy:310, rx:16, ry:30 },
  { key:'gesaess_l',  label:'Gesäß links',           muscle:'Gluteus',       method:'Intramuskulär',            view:'back',  cx:76,  cy:232, rx:24, ry:26 },
  { key:'gesaess_r',  label:'Gesäß rechts',          muscle:'Gluteus',       method:'Intramuskulär',            view:'back',  cx:124, cy:232, rx:24, ry:26 },
  { key:'ober_hl',    label:'Oberschenkel hinten L', muscle:'Hamstrings',    method:'Intramuskulär',            view:'back',  cx:64,  cy:312, rx:16, ry:28 },
  { key:'ober_hr',    label:'Oberschenkel hinten R', muscle:'Hamstrings',    method:'Intramuskulär',            view:'back',  cx:136, cy:312, rx:16, ry:28 },
  { key:'wade_l',     label:'Wade links',            muscle:'Gastrocnemius', method:'Intramuskulär',            view:'back',  cx:62,  cy:392, rx:11, ry:22 },
  { key:'wade_r',     label:'Wade rechts',           muscle:'Gastrocnemius', method:'Intramuskulär',            view:'back',  cx:138, cy:392, rx:11, ry:22 },
]

// ── Status ────────────────────────────────────────────────────────────────────
function statusTheme(days: number | undefined) {
  if (days === undefined) return { fill:'rgba(16,185,129,0.30)',  stroke:'#10b981', text:'Frei'    }
  if (days === 0)  return        { fill:'rgba(239,68,68,0.30)',   stroke:'#ef4444', text:'Heute'   }
  if (days === 1)  return        { fill:'rgba(249,115,22,0.30)',  stroke:'#f97316', text:'Gestern' }
  if (days <= 3)   return        { fill:'rgba(234,179,8,0.30)',   stroke:'#eab308', text:`${days}T`}
  if (days <= 5)   return        { fill:'rgba(34,197,94,0.30)',   stroke:'#22c55e', text:`${days}T`}
  return                         { fill:'rgba(16,185,129,0.30)',  stroke:'#10b981', text:`${days}T`}
}
const canInject = (d: number | undefined) => d === undefined || d >= 2

function findRec(days: Record<string, number>) {
  return [...ZONES]
    .map(z => ({ key:z.key, d:days[z.key]??999 }))
    .filter(z => z.d >= 2)
    .sort((a,b) => b.d - a.d)[0]?.key ?? null
}

const INIT: Record<string,number> = {
  deltoid_l:0, deltoid_r:3, trizeps_l:1, trizeps_r:6,
  bauch_l:7,   bauch_r:2,   ober_l:4,    ober_r:1,
  gesaess_l:9, gesaess_r:5, ober_hl:0,   ober_hr:8,
  wade_l:6,    wade_r:3,
}

// ── Body SVG paths (200 × 444 viewBox) ───────────────────────────────────────
// Built from overlapping filled shapes — same fill merges seamlessly

// Head (shared front/back): ellipse props
const HEAD = { cx:100, cy:28, rx:19, ry:23 }

// Torso shape: shoulders → waist → hips (front & back look similar)
const TORSO = `
  M 68,52
  C 50,56 34,66 24,82
  C 16,94  14,110 16,130
  L 42,130
  C 46,148 50,165 52,180
  C 54,196 54,212 54,226
  C 54,240 56,252 60,262
  L 140,262
  C 144,252 146,240 146,226
  C 146,212 146,196 148,180
  C 150,165 154,148 158,130
  L 184,130
  C 186,110 184,94 176,82
  C 166,66 150,56 132,52
  Z
`

// Left arm: outer and inner edge forming arm shape
const ARM_L = `
  M 24,82
  C 16,94 10,112  8,132
  C  6,150  6,168  8,186
  C 10,200 12,214 12,228
  C 12,238 10,248  8,256
  C  6,262  6,268 10,272
  C 14,276 20,278 24,276
  C 28,274 30,268 30,262
  C 30,252 32,242 34,230
  C 36,216 38,200 40,184
  C 42,168 42,150 42,132
  L 42,130
  Z
`

const ARM_R = `
  M 176,82
  C 184,94 190,112 192,132
  C 194,150 194,168 192,186
  C 190,200 188,214 188,228
  C 188,238 190,248 192,256
  C 194,262 194,268 190,272
  C 186,276 180,278 176,276
  C 172,274 170,268 170,262
  C 170,252 168,242 166,230
  C 164,216 162,200 160,184
  C 158,168 158,150 158,132
  L 158,130
  Z
`

// Hands (simplified fan shape)
const HAND_L = `
  M 8,256
  C  4,262  2,270  4,278
  C  6,286 12,292 18,294
  C 24,296 32,294 36,288
  C 40,282 40,272 38,264
  C 36,256 32,250 28,248
  C 22,246 14,248  8,256 Z
`

const HAND_R = `
  M 192,256
  C 196,262 198,270 196,278
  C 194,286 188,292 182,294
  C 176,296 168,294 164,288
  C 160,282 160,272 162,264
  C 164,256 168,250 172,248
  C 178,246 186,248 192,256 Z
`

// Legs
const LEG_L = `
  M 60,262
  C 56,278 54,298 54,318
  C 54,338 56,356 58,372
  C 60,386 60,400 58,414
  C 56,424 52,432 46,436
  C 40,440 34,440 30,436
  C 26,432 26,426 30,422
  C 36,420 42,418 46,414
  C 48,406 48,394 48,380
  C 48,364 46,348 46,332
  C 46,314 48,296 52,278
  C 56,266 60,262 64,262
  Z
`

const LEG_R = `
  M 140,262
  C 144,262 148,266 152,278
  C 156,296 154,314 154,332
  C 154,348 152,364 152,380
  C 152,394 152,406 154,414
  C 158,418 164,420 170,422
  C 174,426 174,432 170,436
  C 166,440 160,440 154,436
  C 148,432 144,424 142,414
  C 140,400 140,386 142,372
  C 144,356 146,338 146,318
  C 146,298 144,278 140,262
  Z
`

// Feet (small platform shapes)
const FOOT_L = `
  M 30,422 C 22,424 14,426 10,430 C 6,434 8,440 14,442
  C 22,444 38,444 46,440 C 52,436 52,428 48,424 Z
`
const FOOT_R = `
  M 170,422 C 178,424 186,426 190,430 C 194,434 192,440 186,442
  C 178,444 162,444 154,440 C 148,436 148,428 152,424 Z
`

// Back-specific gluteal cleft path (subtle)
const GLUTES = `
  M 100,210 C 100,220 100,236 100,252
`

// Shared SVG defs
function Defs() {
  return (
    <defs>
      <linearGradient id="bfill" x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0%"   stopColor="#162444" />
        <stop offset="50%"  stopColor="#0e1a38" />
        <stop offset="100%" stopColor="#070e22" />
      </linearGradient>
      <filter id="bshadow" x="-8%" y="-3%" width="116%" height="108%">
        <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="rgba(0,0,0,0.7)" />
      </filter>
      <filter id="zglow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="zpulse" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
  )
}

// Body shape props
const BP = { fill:'url(#bfill)', stroke:'rgba(90,135,210,0.50)', strokeWidth:1.6, strokeLinejoin:'round' as const }

// ── Body SVG ──────────────────────────────────────────────────────────────────
function BodySVG({ view, days, rec, selected, onZone }: {
  view:'front'|'back'; days:Record<string,number>
  rec:string|null; selected:string|null; onZone:(k:string)=>void
}) {
  const zones = ZONES.filter(z => z.view === view)

  return (
    <svg viewBox="0 0 200 444" width="100%"
      style={{ display:'block', maxWidth:200, margin:'0 auto' }}
      shapeRendering="geometricPrecision">
      <Defs />

      {/* Body silhouette — overlapping filled shapes, same fill merges */}
      <g filter="url(#bshadow)">
        <ellipse {...BP} cx={HEAD.cx} cy={HEAD.cy} rx={HEAD.rx} ry={HEAD.ry} />
        {/* Neck connector */}
        <rect {...BP} x="88" y="50" width="24" height="16" rx="7" />
        <path {...BP} d={TORSO} />
        <path {...BP} d={ARM_L} />
        <path {...BP} d={ARM_R} />
        <path {...BP} d={HAND_L} />
        <path {...BP} d={HAND_R} />
        <path {...BP} d={LEG_L} />
        <path {...BP} d={LEG_R} />
        <path {...BP} d={FOOT_L} />
        <path {...BP} d={FOOT_R} />
      </g>

      {/* Anatomy lines */}
      {view === 'front' && (
        <g stroke="rgba(100,150,220,0.13)" strokeWidth="1" fill="none" strokeLinecap="round">
          {/* Collar bones */}
          <path d="M 70,68 C 82,74 92,76 100,76 C 108,76 118,74 130,68" />
          {/* Centre line */}
          <line x1="100" y1="76" x2="100" y2="256" />
          {/* Pec line */}
          <path d="M 58,110 C 72,118 88,120 100,118 C 112,120 128,118 142,110" />
          {/* Ab lines */}
          <line x1="88" y1="148" x2="112" y2="148" />
          <line x1="86" y1="168" x2="114" y2="168" />
          <line x1="86" y1="190" x2="114" y2="190" />
          {/* Knee lines */}
          <path d="M 48,348 C 56,352 62,352 68,348" />
          <path d="M 132,348 C 138,352 144,352 152,348" />
        </g>
      )}
      {view === 'back' && (
        <g stroke="rgba(100,150,220,0.13)" strokeWidth="1" fill="none" strokeLinecap="round">
          {/* Spine */}
          <line x1="100" y1="72" x2="100" y2="250" strokeDasharray="3 4" />
          {/* Scapulae */}
          <path d="M 68,92 C 72,108 74,124 70,140" />
          <path d="M 132,92 C 128,108 126,124 130,140" />
          {/* Gluteal cleft */}
          <path d={GLUTES} strokeDasharray="none" />
          {/* Horizontal back lines */}
          <line x1="58" y1="100" x2="142" y2="100" />
          {/* Knee lines */}
          <path d="M 48,350 C 56,354 62,354 68,350" />
          <path d="M 132,350 C 138,354 144,354 152,350" />
        </g>
      )}

      {/* Zone overlays */}
      {zones.map(z => {
        const t     = statusTheme(days[z.key])
        const isRec = rec === z.key
        const isSel = selected === z.key
        const ok    = canInject(days[z.key])
        const tr    = z.rotate ? `rotate(${z.rotate},${z.cx},${z.cy})` : undefined

        return (
          <g key={z.key} transform={tr}
            onClick={() => onZone(z.key)}
            style={{ cursor:'pointer' }}>

            {/* Pulse ring for recommended */}
            {isRec && (
              <ellipse cx={z.cx} cy={z.cy} rx={z.rx+8} ry={z.ry+8}
                fill="none" stroke={t.stroke} strokeWidth="1.2" opacity="0.4"
                style={{ animation:'ob-ring-pulse 2.2s ease-out infinite' }} />
            )}

            {/* Zone fill */}
            <ellipse cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry}
              fill={t.fill}
              stroke={t.stroke} strokeWidth={isSel ? 2.0 : 1.3}
              opacity={ok ? 1 : 0.65}
              filter={isRec ? 'url(#zpulse)' : 'url(#zglow)'}
              style={{ transition:'all 0.2s ease' }} />

            {/* Inner shine */}
            <ellipse cx={z.cx - z.rx*0.18} cy={z.cy - z.ry*0.22}
              rx={z.rx*0.50} ry={z.ry*0.28}
              fill="rgba(255,255,255,0.11)" style={{ pointerEvents:'none' }} />

            {/* Status label */}
            <text x={z.cx} y={z.cy + 3.5}
              textAnchor="middle" dominantBaseline="middle"
              fill={t.stroke} fontSize="8" fontWeight="800"
              fontFamily="system-ui,sans-serif"
              style={{ pointerEvents:'none', userSelect:'none' }}>
              {t.text}
            </text>

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

// ── History type ──────────────────────────────────────────────────────────────
interface Hist { key:string; label:string; prev:number|undefined; ts:number }

// ── Main page ─────────────────────────────────────────────────────────────────
export function InjectionTracker() {
  const [view,      setView]      = useState<'front'|'back'>('front')
  const [days,      setDays]      = useState(INIT)
  const [selected,  setSelected]  = useState<string|null>(null)
  const [history,   setHistory]   = useState<Hist[]>([])
  const [undoToast, setUndoToast] = useState<Hist|null>(null)
  const [listOpen,  setListOpen]  = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null)

  const rec      = findRec(days)
  const recZone  = ZONES.find(z => z.key === rec)
  const selZone  = ZONES.find(z => z.key === selected) ?? null
  const sorted   = [...ZONES].sort((a,b) => (days[b.key]??999)-(days[a.key]??999))
  const freeN    = ZONES.filter(z => (days[z.key]??999) >= 5).length
  const pauseN   = ZONES.filter(z => { const d=days[z.key]; return d!==undefined && d<2 }).length

  function log(key: string) {
    const z = ZONES.find(x => x.key === key)!
    const e: Hist = { key, label:z.label, prev:days[key], ts:Date.now() }
    setDays(p => ({...p,[key]:0}))
    setHistory(p => [e,...p].slice(0,12))
    setUndoToast(e)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setUndoToast(null), 6000)
    if (z.view !== view) setView(z.view)
    setSelected(null)
  }

  function undo(e: Hist) {
    setDays(p => { const n={...p}; if(e.prev===undefined) delete n[e.key]; else n[e.key]=e.prev; return n })
    setHistory(p => p.filter(x => x.ts!==e.ts))
    if (undoToast?.ts===e.ts) { setUndoToast(null); if(timer.current) clearTimeout(timer.current) }
  }

  return (
    <div style={{ paddingBottom:96 }}>

      {/* Header */}
      <div style={{ marginBottom:16, paddingTop:4 }}>
        <h1 style={{ fontSize:'1.4rem',fontWeight:800,letterSpacing:'-0.03em',color:'#eaeefc' }}>
          💉 Injektionsstellen
        </h1>
        <p style={{ fontSize:'0.7rem',color:'rgba(154,170,191,0.48)',marginTop:3 }}>
          Rotationsprotokoll · Tippe eine Zone an
        </p>
      </div>

      {/* Stats */}
      <div style={{ display:'flex',gap:8,marginBottom:14 }}>
        {[
          {l:'Frei',v:freeN,  c:'#10b981',bg:'rgba(16,185,129,0.09)', bd:'rgba(16,185,129,0.18)'},
          {l:'Pause',v:pauseN, c:'#ef4444',bg:'rgba(239,68,68,0.09)',  bd:'rgba(239,68,68,0.18)' },
          {l:'Zonen',v:ZONES.length,c:'#00ccf5',bg:'rgba(0,204,245,0.07)', bd:'rgba(0,204,245,0.16)'},
        ].map(s=>(
          <div key={s.l} style={{ flex:1,borderRadius:13,padding:'9px 8px',textAlign:'center',background:s.bg,border:`1px solid ${s.bd}` }}>
            <p style={{ fontSize:'1.3rem',fontWeight:800,color:s.c,lineHeight:1 }}>{s.v}</p>
            <p style={{ fontSize:'0.53rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'rgba(154,170,191,0.48)',marginTop:3 }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      {recZone && (() => { const t=statusTheme(days[recZone.key]); return (
        <div style={{ display:'flex',alignItems:'center',gap:11,marginBottom:14, background:'linear-gradient(135deg,rgba(0,204,245,0.07),rgba(0,100,180,0.04))', border:'1px solid rgba(0,204,245,0.16)',borderRadius:14,padding:'11px 14px' }}>
          <div style={{ width:38,height:38,borderRadius:'50%',flexShrink:0,background:'rgba(0,204,245,0.10)',border:'1.5px solid rgba(0,204,245,0.28)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem' }}>⭐</div>
          <div style={{ flex:1,minWidth:0 }}>
            <p style={{ fontSize:'0.55rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'rgba(0,204,245,0.7)',marginBottom:2 }}>Optimale Zone heute</p>
            <p style={{ fontSize:'0.88rem',fontWeight:700,color:'#eaeefc' }}>{recZone.label}</p>
            <p style={{ fontSize:'0.6rem',color:'rgba(154,170,191,0.42)',marginTop:1 }}>{recZone.muscle} · {recZone.method}</p>
          </div>
          <button onClick={()=>log(recZone.key)} style={{ padding:'8px 14px',borderRadius:10,flexShrink:0,background:'linear-gradient(135deg,rgba(0,204,245,0.20),rgba(0,120,200,0.12))',border:'1px solid rgba(0,204,245,0.30)',color:'#00ccf5',fontSize:'0.72rem',fontWeight:700,cursor:'pointer' }}>✓ Hier</button>
        </div>
      )})()}

      {/* View toggle */}
      <div style={{ display:'flex',gap:5,marginBottom:10,background:'rgba(6,10,22,0.95)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:13,padding:4 }}>
        {(['front','back'] as const).map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{ flex:1,padding:'8px 0',borderRadius:10,fontWeight:700,fontSize:'0.78rem',cursor:'pointer',transition:'all 0.18s', background:view===v?'linear-gradient(135deg,rgba(0,204,245,0.18),rgba(0,120,190,0.12))':'transparent', border:view===v?'1px solid rgba(0,204,245,0.32)':'1px solid transparent', color:view===v?'#00ccf5':'rgba(154,170,191,0.5)', boxShadow:view===v?'0 0 14px rgba(0,204,245,0.12)':'none' }}>
            {v==='front'?'👤 Vorderseite':'🔄 Rückseite'}
          </button>
        ))}
      </div>

      {/* Body card */}
      <div style={{ background:'linear-gradient(175deg,rgba(6,10,26,0.99) 0%,rgba(3,6,16,1) 100%)', border:'1px solid rgba(30,70,180,0.18)',borderRadius:22,padding:'20px 8px 14px',marginBottom:14, boxShadow:'0 16px 56px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.02),inset 0 1px 0 rgba(60,120,255,0.07)', position:'relative',overflow:'hidden' }}>

        {/* Ambient glow */}
        <div style={{ position:'absolute',top:'40%',left:'50%',transform:'translate(-50%,-50%)', width:200,height:320,borderRadius:'50%', background:'radial-gradient(circle,rgba(15,50,160,0.08) 0%,transparent 70%)',pointerEvents:'none' }} />

        <BodySVG view={view} days={days} rec={rec} selected={selected}
          onZone={k=>setSelected(prev=>prev===k?null:k)} />

        {/* Legend */}
        <div style={{ display:'flex',flexWrap:'wrap',gap:'5px 12px',justifyContent:'center',marginTop:14,padding:'0 8px' }}>
          {[{c:'#10b981',l:'5+ Tage · frei'},{c:'#eab308',l:'2–3 Tage'},{c:'#f97316',l:'Gestern'},{c:'#ef4444',l:'Heute · Pause'}].map(x=>(
            <div key={x.l} style={{ display:'flex',alignItems:'center',gap:4 }}>
              <div style={{ width:7,height:7,borderRadius:'50%',background:x.c,boxShadow:`0 0 5px ${x.c}99` }} />
              <span style={{ fontSize:'0.55rem',color:'rgba(154,170,191,0.52)' }}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Zone detail panel */}
      {selZone && (() => {
        const t=statusTheme(days[selZone.key]); const d=days[selZone.key]; const ok=canInject(d)
        const pct=d===undefined?100:d===0?8:d===1?30:d===2?55:d===3?72:d===4?85:d===5?94:100
        return (
          <div style={{ background:'rgba(8,12,28,0.98)',border:`1px solid ${t.stroke}30`,borderRadius:16,padding:'14px 16px',marginBottom:14,boxShadow:`0 0 24px ${t.stroke}18`,animation:'ob-step-enter 0.18s ease-out' }}>
            <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
              <div style={{ width:10,height:10,borderRadius:'50%',background:t.stroke,boxShadow:`0 0 8px ${t.stroke}`,flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ fontSize:'0.9rem',fontWeight:700,color:'#eaeefc' }}>{selZone.label}</p>
                <p style={{ fontSize:'0.62rem',color:'rgba(154,170,191,0.5)',marginTop:1 }}>{selZone.muscle} · {selZone.method}</p>
              </div>
              <span style={{ fontSize:'0.75rem',fontWeight:700,color:t.stroke }}>
                {d===undefined?'Frei':d===0?'Heute':d===1?'Gestern':`vor ${d}T`}
              </span>
            </div>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4 }}>
                <span style={{ fontSize:'0.57rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'rgba(154,170,191,0.42)' }}>Recovery</span>
                <span style={{ fontSize:'0.68rem',fontWeight:700,color:t.stroke }}>{pct}%</span>
              </div>
              <div style={{ height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden' }}>
                <div style={{ height:'100%',borderRadius:2,width:`${pct}%`,background:`linear-gradient(90deg,${t.stroke}80,${t.stroke})`,boxShadow:`0 0 6px ${t.stroke}55`,transition:'width 0.5s ease' }}/>
              </div>
            </div>
            <div style={{ display:'flex',gap:8 }}>
              <button onClick={()=>setSelected(null)} style={{ flex:1,padding:'9px 0',borderRadius:9,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(154,170,191,0.6)',fontSize:'0.75rem',fontWeight:600,cursor:'pointer' }}>Schließen</button>
              <button onClick={()=>ok&&log(selZone.key)} disabled={!ok} style={{ flex:2,padding:'9px 0',borderRadius:9,background:ok?`linear-gradient(135deg,${t.stroke}28,${t.stroke}12)`:'rgba(255,255,255,0.03)',border:ok?`1px solid ${t.stroke}40`:'1px solid rgba(255,255,255,0.06)',color:ok?t.stroke:'rgba(154,170,191,0.22)',fontSize:'0.78rem',fontWeight:700,cursor:ok?'pointer':'not-allowed' }}>
                {ok?'💉 Hier injizieren':'⏳ In Erholung'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Zone list */}
      <div style={{ background:'rgba(8,12,26,0.92)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:18,overflow:'hidden',marginBottom:12 }}>
        <button onClick={()=>setListOpen(p=>!p)} style={{ width:'100%',display:'flex',alignItems:'center',gap:8,padding:'12px 16px',background:'transparent',border:'none',cursor:'pointer',borderBottom:listOpen?'1px solid rgba(255,255,255,0.045)':'none' }}>
          <span style={{ fontSize:'0.6rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'rgba(154,170,191,0.45)',flex:1,textAlign:'left' }}>Alle Zonen</span>
          {listOpen?<ChevronUp size={14} color="rgba(154,170,191,0.4)"/>:<ChevronDown size={14} color="rgba(154,170,191,0.4)"/>}
        </button>
        {listOpen && sorted.map((z,i)=>{ const t=statusTheme(days[z.key]); const d=days[z.key]; const ok=canInject(d); const isRec=rec===z.key; return (
          <div key={z.key} onClick={()=>setSelected(prev=>prev===z.key?null:z.key)} style={{ display:'flex',alignItems:'center',gap:11,padding:'10px 16px',borderBottom:i<sorted.length-1?'1px solid rgba(255,255,255,0.032)':'none',background:isRec?'rgba(0,204,245,0.035)':'transparent',cursor:'pointer' }}>
            <div style={{ width:9,height:9,borderRadius:'50%',flexShrink:0,background:t.stroke,boxShadow:`0 0 7px ${t.stroke}99` }}/>
            <div style={{ flex:1,minWidth:0 }}>
              <p style={{ fontSize:'0.82rem',fontWeight:600,color:'#eaeefc',lineHeight:1 }}>{z.label}{isRec&&<span style={{ marginLeft:6,fontSize:'0.5rem',fontWeight:700,background:'rgba(0,204,245,0.12)',color:'#00ccf5',border:'1px solid rgba(0,204,245,0.22)',padding:'1px 5px',borderRadius:4,verticalAlign:'middle' }}>⭐</span>}</p>
              <p style={{ fontSize:'0.58rem',color:'rgba(154,170,191,0.36)',marginTop:2 }}>{z.muscle} · {z.view==='front'?'Vorne':'Hinten'}</p>
            </div>
            <p style={{ fontSize:'0.72rem',fontWeight:700,color:t.stroke,minWidth:54,textAlign:'right' }}>{d===undefined?'Frei':d===0?'Heute':d===1?'Gestern':`vor ${d}T`}</p>
            <button onClick={e=>{e.stopPropagation();ok&&log(z.key)}} disabled={!ok} style={{ width:28,height:28,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:ok?'rgba(0,204,245,0.07)':'rgba(255,255,255,0.02)',border:ok?'1px solid rgba(0,204,245,0.18)':'1px solid rgba(255,255,255,0.04)',color:ok?'rgba(0,204,245,0.6)':'rgba(154,170,191,0.18)',fontSize:'0.72rem',cursor:ok?'pointer':'not-allowed' }}>✓</button>
          </div>
        )})}
      </div>

      {/* History */}
      {history.length>0&&(
        <div style={{ background:'rgba(8,12,26,0.92)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:16,overflow:'hidden',marginBottom:12 }}>
          <div style={{ padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.045)',display:'flex',alignItems:'center',gap:6 }}>
            <Undo2 size={12} color="rgba(154,170,191,0.4)"/>
            <span style={{ fontSize:'0.58rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'rgba(154,170,191,0.4)' }}>Verlauf</span>
          </div>
          {history.slice(0,5).map((e,i)=>(
            <div key={e.ts} style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 16px',borderBottom:i<Math.min(history.length,5)-1?'1px solid rgba(255,255,255,0.032)':'none' }}>
              <CheckCircle2 size={13} color="rgba(0,204,245,0.45)" style={{ flexShrink:0 }}/>
              <div style={{ flex:1,minWidth:0 }}>
                <p style={{ fontSize:'0.78rem',fontWeight:600,color:'rgba(234,238,252,0.8)' }}>{e.label}</p>
                <p style={{ fontSize:'0.57rem',color:'rgba(154,170,191,0.36)',marginTop:1 }}>{new Date(e.ts).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'})} Uhr</p>
              </div>
              <button onClick={()=>undo(e)} style={{ display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:8,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.16)',color:'rgba(239,68,68,0.65)',fontSize:'0.63rem',fontWeight:700,cursor:'pointer',flexShrink:0 }}>
                <Undo2 size={10}/> Rückgängig
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div style={{ display:'flex',alignItems:'flex-start',gap:8,padding:'10px 13px',borderRadius:11,background:'rgba(0,204,245,0.03)',border:'1px solid rgba(0,204,245,0.08)' }}>
        <Info size={13} color="rgba(0,204,245,0.4)" style={{ flexShrink:0,marginTop:1 }}/>
        <p style={{ fontSize:'0.61rem',color:'rgba(154,170,191,0.45)',lineHeight:1.55 }}>
          Mindestens <strong style={{ color:'rgba(154,170,191,0.72)' }}>2 Tage</strong> Pause pro Zone um Narbenbildung zu vermeiden.
        </p>
      </div>

      {/* Undo toast */}
      {undoToast&&(
        <div style={{ position:'fixed',bottom:86,left:'50%',transform:'translateX(-50%)',zIndex:9999,width:'calc(100% - 32px)',maxWidth:380,background:'rgba(8,13,32,0.97)',border:'1px solid rgba(0,204,245,0.22)',borderRadius:15,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,boxShadow:'0 10px 40px rgba(0,0,0,0.55)',backdropFilter:'blur(14px)',animation:'ob-step-enter 0.2s ease-out' }}>
          <CheckCircle2 size={17} color="#10b981" style={{ flexShrink:0 }}/>
          <div style={{ flex:1,minWidth:0 }}>
            <p style={{ fontSize:'0.8rem',fontWeight:700,color:'#eaeefc' }}>{undoToast.label} markiert</p>
            <p style={{ fontSize:'0.61rem',color:'rgba(154,170,191,0.48)',marginTop:1 }}>Recovery-Zähler gestartet</p>
          </div>
          <button onClick={()=>undo(undoToast)} style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:9,background:'rgba(239,68,68,0.10)',border:'1px solid rgba(239,68,68,0.22)',color:'#f87171',fontSize:'0.71rem',fontWeight:700,cursor:'pointer',flexShrink:0 }}>
            <Undo2 size={12}/> Rückgängig
          </button>
        </div>
      )}
    </div>
  )
}
