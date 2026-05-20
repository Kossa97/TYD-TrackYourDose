import { useState, useRef } from 'react'
import { Info, Undo2, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'

// ── Types & zones ─────────────────────────────────────────────────────────────
interface Zone {
  key:string; label:string; muscle:string; method:string
  view:'front'|'back'
  cx:number; cy:number; rx:number; ry:number; rotate?:number
}

const ZONES: Zone[] = [
  {key:'deltoid_l',  label:'Deltoid links',         muscle:'Schulter',      method:'Intramuskulär',            view:'front', cx:32,  cy:112, rx:12, ry:16, rotate:-12},
  {key:'deltoid_r',  label:'Deltoid rechts',        muscle:'Schulter',      method:'Intramuskulär',            view:'front', cx:168, cy:112, rx:12, ry:16, rotate: 12},
  {key:'trizeps_l',  label:'Trizeps links',         muscle:'Oberarm',       method:'Subkutan / Intramuskulär', view:'front', cx:18,  cy:168, rx:9,  ry:18, rotate: -6},
  {key:'trizeps_r',  label:'Trizeps rechts',        muscle:'Oberarm',       method:'Subkutan / Intramuskulär', view:'front', cx:182, cy:168, rx:9,  ry:18, rotate:  6},
  {key:'bauch_l',    label:'Bauch links',           muscle:'Abdomen',       method:'Subkutan',                 view:'front', cx:74,  cy:204, rx:13, ry:16},
  {key:'bauch_r',    label:'Bauch rechts',          muscle:'Abdomen',       method:'Subkutan',                 view:'front', cx:126, cy:204, rx:13, ry:16},
  {key:'ober_l',     label:'Oberschenkel links',    muscle:'Quadrizeps',    method:'Intramuskulär / Subkutan', view:'front', cx:56,  cy:310, rx:13, ry:24},
  {key:'ober_r',     label:'Oberschenkel rechts',   muscle:'Quadrizeps',    method:'Intramuskulär / Subkutan', view:'front', cx:144, cy:310, rx:13, ry:24},
  {key:'gesaess_l',  label:'Gesäß links',           muscle:'Gluteus',       method:'Intramuskulär',            view:'back',  cx:74,  cy:232, rx:20, ry:22},
  {key:'gesaess_r',  label:'Gesäß rechts',          muscle:'Gluteus',       method:'Intramuskulär',            view:'back',  cx:126, cy:232, rx:20, ry:22},
  {key:'ober_hl',    label:'Oberschenkel hinten L', muscle:'Hamstrings',    method:'Intramuskulär',            view:'back',  cx:56,  cy:310, rx:13, ry:24},
  {key:'ober_hr',    label:'Oberschenkel hinten R', muscle:'Hamstrings',    method:'Intramuskulär',            view:'back',  cx:144, cy:310, rx:13, ry:24},
  {key:'wade_l',     label:'Wade links',            muscle:'Gastrocnemius', method:'Intramuskulär',            view:'back',  cx:54,  cy:392, rx:10, ry:18},
  {key:'wade_r',     label:'Wade rechts',           muscle:'Gastrocnemius', method:'Intramuskulär',            view:'back',  cx:146, cy:392, rx:10, ry:18},
]

// ── Status ────────────────────────────────────────────────────────────────────
function st(days:number|undefined){
  if(days===undefined) return {fill:'rgba(16,185,129,0.28)', stroke:'#10b981', text:'Frei'}
  if(days===0)  return {fill:'rgba(239,68,68,0.28)',  stroke:'#ef4444', text:'Heute'}
  if(days===1)  return {fill:'rgba(249,115,22,0.28)', stroke:'#f97316', text:'Gestern'}
  if(days<=3)   return {fill:'rgba(234,179,8,0.28)',  stroke:'#eab308', text:`${days}T`}
  if(days<=5)   return {fill:'rgba(34,197,94,0.28)',  stroke:'#22c55e', text:`${days}T`}
  return              {fill:'rgba(16,185,129,0.28)',  stroke:'#10b981', text:`${days}T`}
}
const ok = (d:number|undefined) => d===undefined||d>=2
const findRec = (days:Record<string,number>) =>
  [...ZONES].map(z=>({key:z.key,d:days[z.key]??999}))
    .filter(z=>z.d>=2).sort((a,b)=>b.d-a.d)[0]?.key??null

const INIT:Record<string,number> = {
  deltoid_l:0, deltoid_r:3, trizeps_l:1, trizeps_r:6,
  bauch_l:7,   bauch_r:2,   ober_l:4,    ober_r:1,
  gesaess_l:9, gesaess_r:5, ober_hl:0,   ober_hr:8,
  wade_l:6,    wade_r:3,
}

// ── Body part paths (200 × 440 viewBox) ──────────────────────────────────────
// All parts share the same fill gradient — no stroke.
// A feMorphology dilate+colorize filter creates the clean unified outline.

// HEAD – slightly wider than tall for natural male proportion
const HEAD_RX = 22, HEAD_RY = 27, HEAD_CY = 27

// NECK – tapers slightly toward head
const NECK = 'M 90,52 C 88,58 87,65 88,72 L 112,72 C 113,65 112,58 110,52 Z'

// TORSO – broad shoulders, defined waist, natural hip flare
// Shoulder peaks ~y=82, armpit ~y=108, waist ~y=178, hips ~y=220, crotch y=252
const TORSO = `
  M 90,72
  C 74,74 56,82 46,96
  C 38,107 38,120 40,136
  C 42,150 42,166 40,180
  C 40,194 40,208 44,220
  C 48,232 54,244 60,252
  L 140,252
  C 146,244 152,232 156,220
  C 160,208 160,194 160,180
  C 158,166 158,150 160,136
  C 162,120 162,107 154,96
  C 144,82 126,74 110,72
  Z
`

// LEFT ARM – relaxed hang ~22° outward; elbow subtle inward curve at y≈200
const ARM_L = `
  M 46,96
  C 34,106 20,126 14,148
  C 9,166 8,186 8,206
  C 8,226 10,246 11,262
  C 11,274 9,284 7,294
  C 5,306 9,318 17,322
  C 25,326 33,322 37,314
  C 41,306 41,294 41,278
  C 41,260 41,242 41,224
  C 41,206 42,188 42,170
  C 42,150 42,130 42,112
  C 42,100 43,95 46,96
  Z
`

// RIGHT ARM (mirror: x → 200−x)
const ARM_R = `
  M 154,96
  C 166,106 180,126 186,148
  C 191,166 192,186 192,206
  C 192,226 190,246 189,262
  C 189,274 191,284 193,294
  C 195,306 191,318 183,322
  C 175,326 167,322 163,314
  C 159,306 159,294 159,278
  C 159,260 159,242 159,224
  C 159,206 158,188 158,170
  C 158,150 158,130 158,112
  C 158,100 157,95 154,96
  Z
`

// LEFT LEG – thigh, knee indent, defined calf, tapered ankle
const LEG_L = `
  M 60,252
  C 54,266 50,284 48,304
  C 46,322 46,342 48,360
  C 50,374 50,388 48,402
  C 46,414 40,424 32,428
  C 24,432 16,430 12,424
  C 10,418 16,414 24,414
  C 32,414 38,410 40,400
  C 44,388 46,372 46,356
  C 46,338 46,320 48,304
  C 50,286 54,268 60,256
  C 64,250 72,246 82,246
  Z
`

// RIGHT LEG (mirror)
const LEG_R = `
  M 140,252
  C 146,266 150,284 152,304
  C 154,322 154,342 152,360
  C 150,374 150,388 152,402
  C 154,414 160,424 168,428
  C 176,432 184,430 188,424
  C 190,418 184,414 176,414
  C 168,414 162,410 160,400
  C 156,388 154,372 154,356
  C 154,338 154,320 152,304
  C 150,286 146,268 140,256
  C 136,250 128,246 118,246
  Z
`

// SVG defs shared between front/back
function SVGDefs(){
  return (
    <defs>
      {/* Unified outline: dilate alpha → flood color → composite → drop shadow → merge */}
      <filter id="bodyOutline" x="-5%" y="-2%" width="110%" height="104%">
        <feMorphology in="SourceGraphic" operator="dilate" radius="2.2" result="dilated"/>
        <feFlood floodColor="#3a72c8" floodOpacity="0.50" result="color"/>
        <feComposite in="color" in2="dilated" operator="in" result="outline"/>
        <feDropShadow dx="0" dy="10" stdDeviation="14"
          floodColor="#000000" floodOpacity="0.70"/>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="outline"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>

      {/* Zone glow */}
      <filter id="zglow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="zpulse" x="-70%" y="-70%" width="240%" height="240%">
        <feGaussianBlur stdDeviation="5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>

      {/* Body gradient — subtle depth, lighter in center */}
      <linearGradient id="bfill" x1="0.25" y1="0" x2="0.75" y2="1">
        <stop offset="0%"   stopColor="#1c3058"/>
        <stop offset="40%"  stopColor="#122040"/>
        <stop offset="100%" stopColor="#080f22"/>
      </linearGradient>

      {/* Subtle center-light highlight overlay */}
      <radialGradient id="blight" cx="50%" cy="35%" r="42%">
        <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.045"/>
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
      </radialGradient>
    </defs>
  )
}

// ── Body SVG ──────────────────────────────────────────────────────────────────
function BodySVG({view,days,rec,selected,onZone}:{
  view:'front'|'back'; days:Record<string,number>
  rec:string|null; selected:string|null; onZone:(k:string)=>void
}){
  const zones = ZONES.filter(z=>z.view===view)

  return (
    <svg viewBox="0 0 200 440" width="100%"
      style={{display:'block', maxWidth:210, margin:'0 auto'}}
      shapeRendering="geometricPrecision">
      <SVGDefs/>

      {/* All body parts in one group — filter creates unified outline */}
      <g filter="url(#bodyOutline)">
        <ellipse fill="url(#bfill)" cx={100} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY}/>
        <path    fill="url(#bfill)" d={NECK}/>
        <path    fill="url(#bfill)" d={TORSO}/>
        <path    fill="url(#bfill)" d={ARM_L}/>
        <path    fill="url(#bfill)" d={ARM_R}/>
        <path    fill="url(#bfill)" d={LEG_L}/>
        <path    fill="url(#bfill)" d={LEG_R}/>
        {/* Centre-light highlight — same group so it gets clipped to body shape */}
        <ellipse fill="url(#blight)" cx={100} cy={HEAD_CY} rx={HEAD_RX} ry={HEAD_RY}/>
        <path    fill="url(#blight)" d={NECK}/>
        <path    fill="url(#blight)" d={TORSO}/>
        <path    fill="url(#blight)" d={ARM_L}/>
        <path    fill="url(#blight)" d={ARM_R}/>
        <path    fill="url(#blight)" d={LEG_L}/>
        <path    fill="url(#blight)" d={LEG_R}/>
      </g>

      {/* Anatomy detail lines — very subtle, match new proportions */}
      {view==='front' && (
        <g stroke="rgba(100,150,220,0.13)" strokeWidth="0.85" fill="none" strokeLinecap="round">
          {/* Collar / clavicle */}
          <path d="M 66,78 C 80,84 92,86 100,86 C 108,86 120,84 134,78"/>
          {/* Sternal / centre line */}
          <line x1="100" y1="86" x2="100" y2="250"/>
          {/* Pectoral fold */}
          <path d="M 58,124 C 72,132 88,134 100,133 C 112,134 128,132 142,124"/>
          {/* Abs lines */}
          <line x1="88" y1="162" x2="112" y2="162"/>
          <line x1="88" y1="182" x2="112" y2="182"/>
          <line x1="88" y1="202" x2="112" y2="202"/>
          {/* Knee lines */}
          <path d="M 48,358 C 54,362 58,362 62,358"/>
          <path d="M 138,358 C 142,362 146,362 152,358"/>
        </g>
      )}
      {view==='back' && (
        <g stroke="rgba(100,150,220,0.13)" strokeWidth="0.85" fill="none" strokeLinecap="round">
          {/* Spine */}
          <line x1="100" y1="78" x2="100" y2="248" strokeDasharray="3 6"/>
          {/* Scapulae */}
          <path d="M 66,100 C 70,116 72,132 68,148"/>
          <path d="M 134,100 C 130,116 128,132 132,148"/>
          {/* Gluteal fold */}
          <path d="M 68,246 C 80,254 100,256 120,254 C 132,252 136,246 136,246"/>
          {/* Knee lines */}
          <path d="M 48,358 C 54,362 58,362 62,358"/>
          <path d="M 138,358 C 142,362 146,362 152,358"/>
        </g>
      )}

      {/* Zone overlays */}
      {zones.map(z=>{
        const t     = st(days[z.key])
        const isRec = rec===z.key
        const isSel = selected===z.key
        const isOk  = ok(days[z.key])
        const tr    = z.rotate?`rotate(${z.rotate},${z.cx},${z.cy})`:undefined

        return (
          <g key={z.key} transform={tr} onClick={()=>onZone(z.key)} style={{cursor:'pointer'}}>

            {/* Pulse ring — recommended only */}
            {isRec && (
              <ellipse cx={z.cx} cy={z.cy} rx={z.rx+8} ry={z.ry+8}
                fill="none" stroke={t.stroke} strokeWidth="1.2" opacity="0.4"
                style={{animation:'ob-ring-pulse 2.2s ease-out infinite'}}/>
            )}

            {/* Main zone fill */}
            <ellipse cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry}
              fill={t.fill} stroke={t.stroke}
              strokeWidth={isSel?2.0:1.3} opacity={isOk?1:0.6}
              filter={isRec?'url(#zpulse)':'url(#zglow)'}
              style={{transition:'all 0.2s'}}/>

            {/* Inner shine */}
            <ellipse cx={z.cx-z.rx*0.16} cy={z.cy-z.ry*0.22}
              rx={z.rx*0.52} ry={z.ry*0.30}
              fill="rgba(255,255,255,0.12)" style={{pointerEvents:'none'}}/>

            {/* Day label */}
            <text x={z.cx} y={z.cy+4} textAnchor="middle" dominantBaseline="middle"
              fill={t.stroke} fontSize="8" fontWeight="800"
              fontFamily="system-ui,sans-serif"
              style={{pointerEvents:'none',userSelect:'none'}}>
              {t.text}
            </text>

            {isRec&&(
              <text x={z.cx} y={z.cy-z.ry+5} textAnchor="middle" fontSize="8"
                style={{pointerEvents:'none'}}>⭐</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ── History ───────────────────────────────────────────────────────────────────
interface Hist{key:string;label:string;prev:number|undefined;ts:number}

// ── Main page ─────────────────────────────────────────────────────────────────
export function InjectionTracker(){
  const [view,     setView]     = useState<'front'|'back'>('front')
  const [days,     setDays]     = useState(INIT)
  const [selected, setSelected] = useState<string|null>(null)
  const [history,  setHistory]  = useState<Hist[]>([])
  const [undo,     setUndo]     = useState<Hist|null>(null)
  const [listOpen, setListOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null)

  const rec     = findRec(days)
  const recZone = ZONES.find(z=>z.key===rec)
  const selZone = ZONES.find(z=>z.key===selected)??null
  const sorted  = [...ZONES].sort((a,b)=>(days[b.key]??999)-(days[a.key]??999))
  const freeN   = ZONES.filter(z=>(days[z.key]??999)>=5).length
  const pauseN  = ZONES.filter(z=>{const d=days[z.key];return d!==undefined&&d<2}).length

  function log(key:string){
    const z=ZONES.find(x=>x.key===key)!
    const e:Hist={key,label:z.label,prev:days[key],ts:Date.now()}
    setDays(p=>({...p,[key]:0}))
    setHistory(p=>[e,...p].slice(0,12))
    setUndo(e)
    if(timer.current)clearTimeout(timer.current)
    timer.current=setTimeout(()=>setUndo(null),6000)
    if(z.view!==view)setView(z.view)
    setSelected(null)
  }

  function undoEntry(e:Hist){
    setDays(p=>{const n={...p};if(e.prev===undefined)delete n[e.key];else n[e.key]=e.prev;return n})
    setHistory(p=>p.filter(x=>x.ts!==e.ts))
    if(undo?.ts===e.ts){setUndo(null);if(timer.current)clearTimeout(timer.current)}
  }

  // shared card style
  const card={background:'rgba(8,12,26,0.92)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:18,overflow:'hidden'}

  return (
    <div style={{paddingBottom:96}}>

      {/* Header */}
      <div style={{marginBottom:16,paddingTop:4}}>
        <h1 style={{fontSize:'1.4rem',fontWeight:800,letterSpacing:'-0.03em',color:'#eaeefc'}}>💉 Injektionsstellen</h1>
        <p style={{fontSize:'0.7rem',color:'rgba(154,170,191,0.48)',marginTop:3}}>Rotationsprotokoll · Tippe eine Zone an</p>
      </div>

      {/* Stats */}
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {[
          {l:'Frei',  v:freeN,      c:'#10b981',bg:'rgba(16,185,129,0.09)', bd:'rgba(16,185,129,0.18)'},
          {l:'Pause', v:pauseN,     c:'#ef4444',bg:'rgba(239,68,68,0.09)',  bd:'rgba(239,68,68,0.18)'},
          {l:'Zonen', v:ZONES.length,c:'#00ccf5',bg:'rgba(0,204,245,0.07)', bd:'rgba(0,204,245,0.16)'},
        ].map(s=>(
          <div key={s.l} style={{flex:1,borderRadius:13,padding:'9px 8px',textAlign:'center',background:s.bg,border:`1px solid ${s.bd}`}}>
            <p style={{fontSize:'1.3rem',fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</p>
            <p style={{fontSize:'0.53rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'rgba(154,170,191,0.48)',marginTop:3}}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      {recZone&&(()=>{const t=st(days[recZone.key]);return(
        <div style={{display:'flex',alignItems:'center',gap:11,marginBottom:14,background:'linear-gradient(135deg,rgba(0,204,245,0.07),rgba(0,100,180,0.04))',border:'1px solid rgba(0,204,245,0.16)',borderRadius:14,padding:'11px 14px'}}>
          <div style={{width:38,height:38,borderRadius:'50%',flexShrink:0,background:'rgba(0,204,245,0.10)',border:'1.5px solid rgba(0,204,245,0.28)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1rem'}}>⭐</div>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontSize:'0.55rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'rgba(0,204,245,0.7)',marginBottom:2}}>Optimale Zone heute</p>
            <p style={{fontSize:'0.88rem',fontWeight:700,color:'#eaeefc'}}>{recZone.label}</p>
            <p style={{fontSize:'0.6rem',color:'rgba(154,170,191,0.42)',marginTop:1}}>{recZone.muscle} · {recZone.method}</p>
          </div>
          <button onClick={()=>log(recZone.key)} style={{padding:'8px 14px',borderRadius:10,flexShrink:0,background:'linear-gradient(135deg,rgba(0,204,245,0.20),rgba(0,120,200,0.12))',border:'1px solid rgba(0,204,245,0.30)',color:'#00ccf5',fontSize:'0.72rem',fontWeight:700,cursor:'pointer'}}>✓ Hier</button>
        </div>
      )})()}

      {/* View toggle */}
      <div style={{display:'flex',gap:5,marginBottom:10,background:'rgba(6,10,22,0.95)',border:'1px solid rgba(255,255,255,0.055)',borderRadius:13,padding:4}}>
        {(['front','back'] as const).map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:'8px 0',borderRadius:10,fontWeight:700,fontSize:'0.78rem',cursor:'pointer',transition:'all 0.18s',background:view===v?'linear-gradient(135deg,rgba(0,204,245,0.18),rgba(0,120,190,0.12))':'transparent',border:view===v?'1px solid rgba(0,204,245,0.32)':'1px solid transparent',color:view===v?'#00ccf5':'rgba(154,170,191,0.5)',boxShadow:view===v?'0 0 14px rgba(0,204,245,0.12)':'none'}}>
            {v==='front'?'👤 Vorderseite':'🔄 Rückseite'}
          </button>
        ))}
      </div>

      {/* Body card */}
      <div style={{background:'linear-gradient(175deg,rgba(5,9,22,0.99),rgba(2,5,14,1))',border:'1px solid rgba(30,70,180,0.16)',borderRadius:22,padding:'20px 6px 14px',marginBottom:14,boxShadow:'0 20px 60px rgba(0,0,0,0.65),inset 0 1px 0 rgba(60,120,255,0.06)',position:'relative',overflow:'hidden'}}>
        <div style={{position:'absolute',top:'40%',left:'50%',transform:'translate(-50%,-50%)',width:180,height:300,borderRadius:'50%',background:'radial-gradient(circle,rgba(10,40,140,0.07) 0%,transparent 70%)',pointerEvents:'none'}}/>
        <BodySVG view={view} days={days} rec={rec} selected={selected}
          onZone={k=>setSelected(prev=>prev===k?null:k)}/>
        {/* Legend */}
        <div style={{display:'flex',flexWrap:'wrap',gap:'5px 10px',justifyContent:'center',marginTop:12,padding:'0 8px'}}>
          {[{c:'#10b981',l:'5+ Tage'},{c:'#eab308',l:'2–3 Tage'},{c:'#f97316',l:'Gestern'},{c:'#ef4444',l:'Heute'}].map(x=>(
            <div key={x.l} style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:x.c,boxShadow:`0 0 5px ${x.c}99`}}/>
              <span style={{fontSize:'0.55rem',color:'rgba(154,170,191,0.52)'}}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selZone&&(()=>{
        const t=st(days[selZone.key]);const d=days[selZone.key];const isOk=ok(d)
        const pct=d===undefined?100:d===0?8:d===1?30:d===2?55:d===3?72:d===4?85:d===5?94:100
        return(
          <div style={{background:'rgba(8,12,28,0.98)',border:`1px solid ${t.stroke}30`,borderRadius:16,padding:'14px 16px',marginBottom:14,boxShadow:`0 0 24px ${t.stroke}18`,animation:'ob-step-enter 0.18s ease-out'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
              <div style={{width:10,height:10,borderRadius:'50%',background:t.stroke,boxShadow:`0 0 8px ${t.stroke}`,flexShrink:0}}/>
              <div style={{flex:1}}><p style={{fontSize:'0.9rem',fontWeight:700,color:'#eaeefc'}}>{selZone.label}</p><p style={{fontSize:'0.62rem',color:'rgba(154,170,191,0.5)',marginTop:1}}>{selZone.muscle} · {selZone.method}</p></div>
              <span style={{fontSize:'0.75rem',fontWeight:700,color:t.stroke}}>{d===undefined?'Frei':d===0?'Heute':d===1?'Gestern':`vor ${d}T`}</span>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:'0.57rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.07em',color:'rgba(154,170,191,0.42)'}}>Recovery</span>
                <span style={{fontSize:'0.68rem',fontWeight:700,color:t.stroke}}>{pct}%</span>
              </div>
              <div style={{height:4,background:'rgba(255,255,255,0.06)',borderRadius:2,overflow:'hidden'}}>
                <div style={{height:'100%',borderRadius:2,width:`${pct}%`,background:`linear-gradient(90deg,${t.stroke}80,${t.stroke})`,boxShadow:`0 0 6px ${t.stroke}55`,transition:'width 0.5s ease'}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>setSelected(null)} style={{flex:1,padding:'9px 0',borderRadius:9,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',color:'rgba(154,170,191,0.6)',fontSize:'0.75rem',fontWeight:600,cursor:'pointer'}}>Schließen</button>
              <button onClick={()=>isOk&&log(selZone.key)} disabled={!isOk} style={{flex:2,padding:'9px 0',borderRadius:9,background:isOk?`linear-gradient(135deg,${t.stroke}28,${t.stroke}12)`:'rgba(255,255,255,0.03)',border:isOk?`1px solid ${t.stroke}40`:'1px solid rgba(255,255,255,0.06)',color:isOk?t.stroke:'rgba(154,170,191,0.22)',fontSize:'0.78rem',fontWeight:700,cursor:isOk?'pointer':'not-allowed'}}>
                {isOk?'💉 Hier injizieren':'⏳ In Erholung'}
              </button>
            </div>
          </div>
        )
      })()}

      {/* Zone list */}
      <div style={{...card,marginBottom:12}}>
        <button onClick={()=>setListOpen(p=>!p)} style={{width:'100%',display:'flex',alignItems:'center',gap:8,padding:'12px 16px',background:'transparent',border:'none',cursor:'pointer',borderBottom:listOpen?'1px solid rgba(255,255,255,0.045)':'none'}}>
          <span style={{fontSize:'0.6rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'rgba(154,170,191,0.45)',flex:1,textAlign:'left'}}>Alle Zonen</span>
          {listOpen?<ChevronUp size={14} color="rgba(154,170,191,0.4)"/>:<ChevronDown size={14} color="rgba(154,170,191,0.4)"/>}
        </button>
        {listOpen&&sorted.map((z,i)=>{const t=st(days[z.key]);const d=days[z.key];const isOk=ok(d);const isRec=rec===z.key;return(
          <div key={z.key} onClick={()=>setSelected(prev=>prev===z.key?null:z.key)} style={{display:'flex',alignItems:'center',gap:11,padding:'10px 16px',borderBottom:i<sorted.length-1?'1px solid rgba(255,255,255,0.032)':'none',background:isRec?'rgba(0,204,245,0.035)':'transparent',cursor:'pointer'}}>
            <div style={{width:9,height:9,borderRadius:'50%',flexShrink:0,background:t.stroke,boxShadow:`0 0 7px ${t.stroke}99`}}/>
            <div style={{flex:1,minWidth:0}}><p style={{fontSize:'0.82rem',fontWeight:600,color:'#eaeefc',lineHeight:1}}>{z.label}{isRec&&<span style={{marginLeft:6,fontSize:'0.5rem',fontWeight:700,background:'rgba(0,204,245,0.12)',color:'#00ccf5',border:'1px solid rgba(0,204,245,0.22)',padding:'1px 5px',borderRadius:4,verticalAlign:'middle'}}>⭐</span>}</p><p style={{fontSize:'0.58rem',color:'rgba(154,170,191,0.36)',marginTop:2}}>{z.muscle}</p></div>
            <p style={{fontSize:'0.72rem',fontWeight:700,color:t.stroke,minWidth:54,textAlign:'right'}}>{d===undefined?'Frei':d===0?'Heute':d===1?'Gestern':`vor ${d}T`}</p>
            <button onClick={e=>{e.stopPropagation();isOk&&log(z.key)}} disabled={!isOk} style={{width:28,height:28,borderRadius:'50%',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',background:isOk?'rgba(0,204,245,0.07)':'rgba(255,255,255,0.02)',border:isOk?'1px solid rgba(0,204,245,0.18)':'1px solid rgba(255,255,255,0.04)',color:isOk?'rgba(0,204,245,0.6)':'rgba(154,170,191,0.18)',fontSize:'0.72rem',cursor:isOk?'pointer':'not-allowed'}}>✓</button>
          </div>
        )})}
      </div>

      {/* History */}
      {history.length>0&&(
        <div style={{...card,marginBottom:12}}>
          <div style={{padding:'10px 16px',borderBottom:'1px solid rgba(255,255,255,0.045)',display:'flex',alignItems:'center',gap:6}}>
            <Undo2 size={12} color="rgba(154,170,191,0.4)"/>
            <span style={{fontSize:'0.58rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.09em',color:'rgba(154,170,191,0.4)'}}>Verlauf</span>
          </div>
          {history.slice(0,4).map((e,i)=>(
            <div key={e.ts} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 16px',borderBottom:i<3?'1px solid rgba(255,255,255,0.032)':'none'}}>
              <CheckCircle2 size={13} color="rgba(0,204,245,0.45)" style={{flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}><p style={{fontSize:'0.78rem',fontWeight:600,color:'rgba(234,238,252,0.8)'}}>{e.label}</p><p style={{fontSize:'0.57rem',color:'rgba(154,170,191,0.36)',marginTop:1}}>{new Date(e.ts).toLocaleTimeString('de',{hour:'2-digit',minute:'2-digit'})} Uhr</p></div>
              <button onClick={()=>undoEntry(e)} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:8,background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.16)',color:'rgba(239,68,68,0.65)',fontSize:'0.63rem',fontWeight:700,cursor:'pointer',flexShrink:0}}>
                <Undo2 size={10}/> Rückgängig
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div style={{display:'flex',alignItems:'flex-start',gap:8,padding:'10px 13px',borderRadius:11,background:'rgba(0,204,245,0.03)',border:'1px solid rgba(0,204,245,0.08)'}}>
        <Info size={13} color="rgba(0,204,245,0.4)" style={{flexShrink:0,marginTop:1}}/>
        <p style={{fontSize:'0.61rem',color:'rgba(154,170,191,0.45)',lineHeight:1.55}}>Mindestens <strong style={{color:'rgba(154,170,191,0.72)'}}>2 Tage</strong> Pause pro Zone um Narbenbildung zu vermeiden.</p>
      </div>

      {/* Undo toast */}
      {undo&&(
        <div style={{position:'fixed',bottom:86,left:'50%',transform:'translateX(-50%)',zIndex:9999,width:'calc(100% - 32px)',maxWidth:380,background:'rgba(8,13,32,0.97)',border:'1px solid rgba(0,204,245,0.22)',borderRadius:15,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,boxShadow:'0 10px 40px rgba(0,0,0,0.55)',backdropFilter:'blur(14px)',animation:'ob-step-enter 0.2s ease-out'}}>
          <CheckCircle2 size={17} color="#10b981" style={{flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}><p style={{fontSize:'0.8rem',fontWeight:700,color:'#eaeefc'}}>{undo.label} markiert</p><p style={{fontSize:'0.61rem',color:'rgba(154,170,191,0.48)',marginTop:1}}>Recovery-Zähler gestartet</p></div>
          <button onClick={()=>undoEntry(undo)} style={{display:'flex',alignItems:'center',gap:5,padding:'7px 12px',borderRadius:9,background:'rgba(239,68,68,0.10)',border:'1px solid rgba(239,68,68,0.22)',color:'#f87171',fontSize:'0.71rem',fontWeight:700,cursor:'pointer',flexShrink:0}}>
            <Undo2 size={12}/> Rückgängig
          </button>
        </div>
      )}
    </div>
  )
}
