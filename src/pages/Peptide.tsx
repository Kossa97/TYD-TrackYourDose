import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Minus, Trash2, Pencil, FlaskConical, Activity,
  CalendarDays, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, List,
  TrendingUp, Search, Bell, Check,
  Package, FileUp, Droplets, X, FileText, ExternalLink,
  Archive, RefreshCw, Sunrise, Sun, Moon, Clock, type LucideIcon,
} from 'lucide-react'
import { getPeptideColor, getRandomPeptideColor } from '../lib/peptideColors'
import { useNew } from '../lib/useNew'
import { NewDot } from '../components/NewDot'
import { format, parseISO, addDays, differenceInDays } from 'date-fns'
import { type ScheduleSegment } from '../lib/intakeSchedule'
import { PeptideFormModal } from '../components/PeptideFormModal'
import { PeptideVialVisual } from '../components/PeptideVialVisual'
import { emptyPeptideForm, type PeptideForm, type PkProfileOption } from '../lib/peptideFormTypes'

interface InventoryItem {
  id: string; user_id: string; name: string
  batch_number: string | null; batch_source: string | null; batch_file_url: string | null
  vials_count: number; vials_initial: number | null; mg_per_vial: number; created_at: string
  pk_profile_id: string | null
}
interface InventoryForm {
  name: string; batch_number: string; batch_source: string
  batch_file_url: string; vials_count: string; mg_per_vial: string
}
const emptyInventoryForm = (): InventoryForm => ({
  name: '', batch_number: '', batch_source: '', batch_file_url: '',
  vials_count: '1', mg_per_vial: '',
})

// ─── Peptid-Typen ─────────────────────────────────────────────────────────────
interface Peptide {
  id: string; name: string; default_unit: string
  default_dose: number | null; default_method: string
  vial_amount_mg: number | null; vial_amount_unit: string | null
  reconstitution_ml: number | null
  syringe_type: string | null; notes: string | null
  vials_in_stock: number | null; vials_initial: number | null
  reconstitution_date: string | null; expiry_days: number | null
  batch_number: string | null; batch_source: string | null; batch_file_url: string | null
  inventory_item_id: string | null
  pk_profile_id: string | null
}
interface Cycle {
  id: string; peptide_id: string; name: string
  dose: number; unit: string; method: string
  frequency: string; x_days_interval: number | null
  schedule_days: string[] | null
  start_date: string; end_date: string | null; active: boolean
  intake_time: string | null; intake_time_custom: string | null
  schedule_history: ScheduleSegment[] | null
  reminder: string | null
  created_at: string
}
interface Escalation {
  id: string; cycle_id: string
  increase_amount: number; unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null; start_after_days: number | null
  notes: string | null
}
interface EscalationForm {
  increase_amount: string; unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string; start_after_days: string; notes: string
}
const emptyEscalationForm = (unit: string): EscalationForm => ({
  increase_amount: '', unit,
  start_type: 'after_weeks', start_date: format(new Date(), 'yyyy-MM-dd'),
  start_after_days: '2', notes: '',
})

// ─── Konstanten ───────────────────────────────────────────────────────────────
const POPULAR_PEPTIDES = [
  'BPC-157','TB-500','Ipamorelin','CJC-1295','GHK-Cu','Epitalon',
  'Selank','Semax','PT-141','Retatrutide','Semaglutid','Tirzepatid',
  'IGF-1 LR3','GHRP-2','GHRP-6','Sermorelin','AOD 9604',
  'Thymosin Alpha-1','LL-37','Hexarelin','MGF',
]
const UNITS   = ['mcg','mg','IU','ml','nmol']
const METHODS = ['Subkutan','Intramuskulär','Nasal','Oral','Transdermal','Intravenös','Andere']
const METHOD_KEYS: Record<string,string> = {
  'Subkutan':'method_subkutan','Intramuskulär':'method_intramusk','Nasal':'method_nasal',
  'Oral':'method_oral','Transdermal':'method_transdermal','Intravenös':'method_intravenoese','Andere':'method_andere',
}
const WOCHENTAGE = ['Mo','Di','Mi','Do','Fr','Sa','So']
const EXPIRY_PRESETS = [10, 14, 21, 28, 42, 90]

type PeptideSortKey =
  | 'name_asc' | 'name_desc'
  | 'expiry_asc' | 'expiry_desc'
  | 'fill_asc' | 'fill_desc'
  | 'recon_asc' | 'recon_desc'
  | 'stock_asc' | 'stock_desc'

const PEPTIDE_SORT_GROUPS: { labelKey: string; options: PeptideSortKey[] }[] = [
  { labelKey: 'sort_group_name', options: ['name_asc', 'name_desc'] },
  { labelKey: 'sort_group_expiry', options: ['expiry_asc', 'expiry_desc'] },
  { labelKey: 'sort_group_fill', options: ['fill_asc', 'fill_desc'] },
  { labelKey: 'sort_group_recon', options: ['recon_asc', 'recon_desc'] },
  { labelKey: 'sort_group_stock', options: ['stock_asc', 'stock_desc'] },
]

const SORT_OPTION_LABEL_KEYS: Record<PeptideSortKey, string> = {
  name_asc: 'sort_option_name_asc',
  name_desc: 'sort_option_name_desc',
  expiry_asc: 'sort_option_expiry_asc',
  expiry_desc: 'sort_option_expiry_desc',
  fill_asc: 'sort_option_fill_asc',
  fill_desc: 'sort_option_fill_desc',
  recon_asc: 'sort_option_recon_asc',
  recon_desc: 'sort_option_recon_desc',
  stock_asc: 'sort_option_stock_asc',
  stock_desc: 'sort_option_stock_desc',
}

function expiryDaysLeft(p: Peptide): number | null {
  if (!p.reconstitution_date || !p.expiry_days) return null
  return differenceInDays(addDays(parseISO(p.reconstitution_date), p.expiry_days), new Date())
}

/** Rest im aktuellen Vial in % — gleiche Logik wie die Vial-Anzeige in der Liste. */
function getVialFillPct(p: Peptide): number | null {
  const stock = p.vials_in_stock ?? 0
  if ((p.vials_initial ?? 0) <= 0 && stock <= 0) return null
  if (stock <= 0) return 0
  return stock % 1 === 0 ? 100 : (stock % 1) * 100
}

function compareNullableNum(a: number | null | undefined, b: number | null | undefined, asc: boolean): number {
  const av = a ?? null
  const bv = b ?? null
  if (av === null && bv === null) return 0
  if (av === null) return 1
  if (bv === null) return -1
  const diff = av - bv
  return asc ? diff : -diff
}

function compareNullableDate(a: string | null | undefined, b: string | null | undefined, asc: boolean): number {
  const av = a || null
  const bv = b || null
  if (!av && !bv) return 0
  if (!av) return 1
  if (!bv) return -1
  const diff = av.localeCompare(bv)
  return asc ? diff : -diff
}

function sortPeptides(list: Peptide[], sortBy: PeptideSortKey): Peptide[] {
  return [...list].sort((a, b) => {
    switch (sortBy) {
      case 'name_asc': return a.name.localeCompare(b.name)
      case 'name_desc': return b.name.localeCompare(a.name)
      case 'expiry_asc': return compareNullableNum(expiryDaysLeft(a), expiryDaysLeft(b), true)
      case 'expiry_desc': return compareNullableNum(expiryDaysLeft(a), expiryDaysLeft(b), false)
      case 'fill_asc': return compareNullableNum(getVialFillPct(a), getVialFillPct(b), true)
      case 'fill_desc': return compareNullableNum(getVialFillPct(a), getVialFillPct(b), false)
      case 'recon_asc': return compareNullableDate(a.reconstitution_date, b.reconstitution_date, true)
      case 'recon_desc': return compareNullableDate(a.reconstitution_date, b.reconstitution_date, false)
      case 'stock_asc': return compareNullableNum(a.vials_in_stock, b.vials_in_stock, true)
      case 'stock_desc': return compareNullableNum(a.vials_in_stock, b.vials_in_stock, false)
      default: return 0
    }
  })
}

const SYRINGE_PRESETS = [
  { label: '1 mL · 100 Einh. (U-100)',  ml: '1',   units: '100' },
  { label: '0,5 mL · 50 Einh. (U-100)', ml: '0.5', units: '50'  },
  { label: '0,3 mL · 30 Einh. (U-100)', ml: '0.3', units: '30'  },
  { label: '0,5 mL · 100 Einh. (U-100)',ml: '0.5', units: '100' },
  { label: '2 mL · 200 Einh. (U-100)',  ml: '2',   units: '200' },
  { label: '1 mL · 40 Einh. (U-40)',    ml: '1',   units: '40'  },
]
const BASE_FREQUENCIES = [
  'Täglich','Jeden 2. Tag',
  '5 Tage an / 2 aus','Mo-Fr','Wöchentlich',
  'Alle X Tage','Wochentage wählen',
]
const FREQ_KEYS: Record<string,string> = {
  'Täglich':'freq_taeglich','Jeden 2. Tag':'freq_jeden2',
  '5 Tage an / 2 aus':'freq_5an2aus','Mo-Fr':'freq_mofr','Wöchentlich':'freq_woechentlich',
  'Alle X Tage':'freq_alle_x','Wochentage wählen':'freq_wochentage',
}
const INTAKE_TIME_CONFIG = {
  morgens: { labelKey: 'morgens', icon: Sunrise, time: '08:00' },
  mittags: { labelKey: 'mittags', icon: Sun,  time: '12:00' },
  abends:  { labelKey: 'abends',  icon: Moon, time: '20:00' },
  custom:  { labelKey: 'uhrzeit_label', icon: Clock, time: '' },
} as const
const REMINDER_OPTIONS = [
  { value: '1day',    labelKey: 'reminder_1day' },
  { value: '2h',      labelKey: 'reminder_2h' },
  { value: 'on_time', labelKey: 'reminder_on_time' },
]

// ─── Formular-Typen ───────────────────────────────────────────────────────────
interface CycleForm {
  name: string; dose: string; unit: string; method: string
  frequency: string; x_days_interval: string; schedule_days: string[]
  start_date: string; end_date: string
  daily_freq: string  // '1' | '2' | '3' — how many times per day
  intake_times: string[]; intake_time_customs: string[]; reminder: string[]
}
const emptyCycleForm = (p: Peptide, tFn: (k:string)=>string): CycleForm => ({
  name: p.name + ' ' + tFn('zyklus'),
  dose: p.default_dose?.toString() ?? '', unit: p.default_unit,
  method: p.default_method, frequency: 'Täglich',
  x_days_interval: '3', schedule_days: [],
  start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '',
  daily_freq: '1', intake_times: [], intake_time_customs: [], reminder: [],
})

// ─── Inventar-Bestand-Grafik ─────────────────────────────────────────────────
function VialStockDisplay({ current, initial, inUse = 0 }: {
  current: number; initial: number | null; inUse?: number
}) {
  const { t } = useTranslation()
  if (!initial || initial <= 0) return null
  const available = Math.max(0, current - inUse)
  const lowStock  = available <= 2
  const color     = lowStock ? '#ef4444' : '#10b981'

  if (initial > 10) {
    const availPct = (available / initial) * 100
    const inUsePct = (Math.min(inUse, current) / initial) * 100
    const barColor = lowStock ? '#ff3355' : '#00ccf5'
    const barGlow  = lowStock ? 'rgba(255,40,80,0.35)' : 'rgba(0,204,245,0.35)'
    return (
      <div className="mt-2.5">
        <div className="flex items-center justify-between mb-1.5" style={{ fontSize: '10px' }}>
          <span style={{ color: lowStock ? '#ff4466' : 'rgba(0,204,245,0.60)', fontWeight: 600, letterSpacing: '0.04em' }}>
            {available} {t('verfuegbar')}{lowStock ? ' · ' + t('bestand_niedrig') : ''}
          </span>
          {inUse > 0 && <span style={{ color: 'rgba(245,160,0,0.75)', fontWeight: 600 }}>{inUse} {t('in_verwendung')}</span>}
        </div>
        <div className="overflow-hidden flex" style={{
          height: '6px', borderRadius: '3px',
          background: 'rgba(0,0,0,0.7)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
        }}>
          <div className="transition-all duration-500" style={{
            width: `${availPct}%`,
            background: `linear-gradient(90deg, ${barColor}aa, ${barColor})`,
            boxShadow: `0 0 8px ${barGlow}`,
          }} />
          {inUse > 0 && (
            <div className="transition-all duration-500" style={{
              width: `${inUsePct}%`,
              background: 'linear-gradient(90deg, #e09000aa, #f5a000)',
              opacity: 0.75,
            }} />
          )}
        </div>
      </div>
    )
  }

  // Nur current Vials anzeigen (keine verbrauchten)
  return (
    <div className="mt-2.5 flex items-end gap-1 flex-wrap">
      {Array.from({ length: current }, (_, i) => {
        const isInUse = i >= available
        const fill    = isInUse ? '#f59e0b' : color
        return (
          <svg key={i} width="13" height="28" viewBox="0 0 13 28">
            <rect x="4" y="0" width="5" height="3" rx="1" fill={fill} opacity={isInUse ? 0.85 : 1} />
            <rect x="3" y="3" width="7" height="2" rx="0.5" fill={fill} opacity={isInUse ? 0.75 : 0.85} />
            <rect x="1" y="5" width="11" height="22" rx="3"
              fill={fill} stroke={fill} strokeWidth="1.5" opacity={isInUse ? 0.4 : 0.65} />
          </svg>
        )
      })}
      <div className="flex flex-col ml-1 self-center gap-0.5">
        {inUse > 0 && (
          <span className="text-xs text-amber-400/70 leading-none">{inUse} {t('in_verwendung')}</span>
        )}
        {lowStock && (
          <span className="text-xs text-red-400 font-medium leading-none">{t('bestand_niedrig')}</span>
        )}
      </div>
    </div>
  )
}

// ─── Vial-Visualisierung ─────────────────────────────────────────────────────
// Pure CSS animations — no device-orientation or mouse tracking.
// Two animations create a "living liquid" feel:
//   waveId    → wave scrolls horizontally (2 s linear loop)
//   breatheId → wave surface gently rises/falls (3 s ease-in-out loop)
function VialDisplay({ pct, uid, color, animateOnMount = false }: { pct: number; uid: string; color: string; animateOnMount?: boolean }) {
  const OX = 4, OY = 13
  const W  = 32, H = 70
  // Scale fill into [0, H-14] so 100 % leaves a clear 14 px air gap and
  // different fill levels (92 %, 95 %, 100 %) are visually distinguishable.
  const fillH   = pct <= 0 ? 4 : Math.max(4, (pct / 100) * (H - 14))
  const surfaceY = OY + (H - fillH)   // top of liquid in absolute SVG coords

  const wW = W * 2, wH = 3.5
  const wp = `M0,${wH/2} C${wW*.25},0 ${wW*.25},${wH} ${wW*.5},${wH/2} C${wW*.75},0 ${wW*.75},${wH} ${wW},${wH/2} L${wW},${wH} L0,${wH} Z`

  const clipId     = `vc${uid}`
  const waveId     = `wv${uid}`
  const breatheId  = `br${uid}`
  const gradId     = `lg${uid}`
  const fillRiseId = `fr${uid}`

  return (
    <div className="shrink-0 select-none">
      <svg width={W + 8} height={H + 22} viewBox={`0 0 ${W + 8} ${H + 22}`}
        shapeRendering="geometricPrecision">
        <defs>
          <clipPath id={clipId}>
            <rect x={OX} y={OY} width={W} height={H} rx="5"/>
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%"   stopColor={color} stopOpacity="0.85"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.35"/>
          </linearGradient>
          <style>{`
            @keyframes ${waveId} {
              from { transform: translateX(0) }
              to   { transform: translateX(-${W}px) }
            }
            @keyframes ${breatheId} {
              0%, 100% { transform: translateY(0px) }
              50%       { transform: translateY(-1px) }
            }
            @keyframes ${fillRiseId} {
              from { transform: scaleY(0); }
              to   { transform: scaleY(1); }
            }
            .vd-fill-group-${uid} {
              transform-box: fill-box;
              transform-origin: center bottom;
              animation: ${fillRiseId} 850ms cubic-bezier(.22,1,.36,1) both;
            }
            @media (prefers-reduced-motion: reduce) {
              .vd-wave-${uid}, .vd-breathe-${uid}, .vd-fill-group-${uid} { animation: none !important; }
            }
          `}</style>
        </defs>

        {/* Cap */}
        <rect x="12" y="1"  width={W - 16} height="8" rx="2.5" fill="#64748b"/>
        <rect x="7"  y="7"  width={W - 6}  height="7" rx="2"   fill="#475569"/>
        <rect x="8"  y="2"  width={W - 20} height="3" rx="1.5" fill="rgba(255,255,255,0.18)"/>

        {/* Glass body */}
        <rect x={OX} y={OY} width={W} height={H} rx="5"
          style={{ fill: 'var(--surface-input)', stroke: 'var(--border-strong)' }} strokeWidth="2"/>

        {/* Liquid (clipped to glass) */}
        <g clipPath={`url(#${clipId})`}>
          <g className={animateOnMount ? `vd-fill-group-${uid}` : ''}>

            {/* Bulk fill */}
            <rect x={OX} y={surfaceY} width={W} height={fillH}
              fill={`url(#${gradId})`}/>

            {/* Surface highlight band */}
            <rect x={OX} y={surfaceY} width={W} height={5}
              fill={color} fillOpacity="0.55"/>

            {/* Wave: positioned at surface, breathing vertically */}
            <g style={{ transform: `translate(${OX}px, ${Math.max(OY, surfaceY - wH + 1)}px)` }}>
              <g className={`vd-breathe-${uid}`}
                style={{ animation: `${breatheId} 3s ease-in-out infinite` }}>
                <path className={`vd-wave-${uid}`} d={wp}
                  fill={color} fillOpacity="0.65"
                  style={{ animation: `${waveId} 2s linear infinite` }}/>
              </g>
            </g>

            {/* Inner shine */}
            <rect x={OX+1} y={surfaceY} width="5" height={fillH} rx="2.5"
              fill="rgba(255,255,255,0.12)"/>
          </g>
        </g>

        {/* Glass rim */}
        <rect x={OX} y={OY} width={W} height={H} rx="5"
          fill="none" style={{ stroke: 'var(--border-strong)' }} strokeWidth="1.5"/>
        <rect x={OX+1} y={OY+3} width="3" height={H - 8} rx="1.5"
          fill="rgba(255,255,255,0.07)"/>
      </svg>
    </div>
  )
}

// Schedule-relevante Felder eines Standes (für Vergleich + Segmentaufbau).
type SchedFields = Pick<ScheduleSegment, 'frequency' | 'x_days_interval' | 'schedule_days' | 'intake_time' | 'intake_time_custom' | 'dose' | 'unit'>

function schedKey(s: SchedFields): string {
  return JSON.stringify([s.frequency, s.x_days_interval, [...(s.schedule_days ?? [])].sort(), s.intake_time, s.intake_time_custom, s.dose, s.unit])
}

// Neue Historie nach einem Edit. prev = geladener Zyklus vor dem Edit; next = neue Felder.
function nextScheduleHistory(
  prevHistory: ScheduleSegment[] | null,
  prevFields: SchedFields,
  prevStartDate: string,
  next: SchedFields,
  today: string,
): ScheduleSegment[] | null {
  if (schedKey(prevFields) === schedKey(next)) return prevHistory ?? null
  const history: ScheduleSegment[] = (prevHistory && prevHistory.length > 0)
    ? [...prevHistory]
    : [{ effective_from: prevStartDate, ...prevFields }]
  const todaySeg: ScheduleSegment = { effective_from: today, ...next }
  if (history[history.length - 1].effective_from === today) history[history.length - 1] = todaySeg
  else history.push(todaySeg)
  return history
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export function Peptide() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // ── Bestätigungs-Dialoge ──────────────────────────────────────────────────
  const [rekonstitutionTarget, setRekonstitutionTarget] = useState<Peptide | null>(null)
  const [rekonstitutionDontAsk,setRekonstitutionDontAsk]= useState(false)
  const [skipRekonstitution]   = useState(() => !!localStorage.getItem('_skip_rekonstitution'))

  // ── Neu-Signale ───────────────────────────────────────────────────────────
  const [infoBtnNew,     dismissInfoBtn]       = useNew('peptide_info')
  const [zyklusBtnNew,   dismissZyklusBtn]     = useNew('zyklus_btn')

  // ── Inventar ─────────────────────────────────────────────────────────────
  const [inventory, setInventory]             = useState<InventoryItem[]>([])
  const [pkProfileCatalog, setPkProfileCatalog]   = useState<PkProfileOption[]>([])
  const [pkSuggestOpen, setPkSuggestOpen]         = useState(false)

  // ── Flüssigkeits-Farben (localStorage) ───────────────────────────────────
  const [peptideColors, setPeptideColors] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('tyd_peptide_colors') ?? '{}') } catch { return {} }
  })

  // ── Peptide ───────────────────────────────────────────────────────────────
  const [peptides, setPeptides]               = useState<Peptide[]>([])
  const [cycles, setCycles]                   = useState<Cycle[]>([])
  const [expandedId, setExpandedId]           = useState<string | null>(null)
  const [showPeptideForm, setShowPeptideForm] = useState(false)
  const [editingPeptideId, setEditingPeptideId] = useState<string | null>(null)
  const [pForm, setPForm]                     = useState<PeptideForm>(emptyPeptideForm())
  const [showDropdown, setShowDropdown]       = useState(false)
  const [savingPeptide, setSavingPeptide]     = useState(false)
  const [batchFile, setBatchFile]             = useState<File | null>(null)
  const [uploadingFile, setUploadingFile]     = useState(false)
  const [infoPeptide, setInfoPeptide]         = useState<Peptide | null>(null)
  const [search, setSearch]                   = useState('')
  const [sortBy, setSortBy]                   = useState<PeptideSortKey>('name_asc')
  const [viewMode, setViewModeState]          = useState<'vials' | 'list'>(() =>
    localStorage.getItem('tyd_peptide_view') === 'list' ? 'list' : 'vials'
  )
  const [activePeptideId, setActivePeptideId] = useState<string | null>(null)
  const vialCarouselRef = useRef<HTMLDivElement | null>(null)
  const vialScrollFrameRef = useRef<number | null>(null)
  const [animationEpoch, setAnimationEpoch] = useState(0)

  // ── Zyklen ────────────────────────────────────────────────────────────────
  const [showCycleForm, setShowCycleForm]         = useState(false)
  const [cycleForPeptide, setCycleForPeptide]     = useState<Peptide | null>(null)
  const [editingCycleId, setEditingCycleId]       = useState<string | null>(null)
  const [cForm, setCForm]                         = useState<CycleForm | null>(null)
  const [savingCycle, setSavingCycle]             = useState(false)
  // Beim Bearbeiten eines bestehenden Zyklus: Planänderung rückwirkend oder ab heute?
  const [scheduleChoiceOpen, setScheduleChoiceOpen] = useState(false)

  // ── Dosiserhöhungen ───────────────────────────────────────────────────────
  const [escalations, setEscalations]             = useState<Escalation[]>([])
  const [showEscForm, setShowEscForm]             = useState(false)
  const [escForCycle, setEscForCycle]             = useState<Cycle | null>(null)
  const [editingEscId, setEditingEscId]           = useState<string | null>(null)
  const [eForm, setEForm]                         = useState<EscalationForm | null>(null)
  const [savingEsc, setSavingEsc]                 = useState(false)

  // ── Laden ─────────────────────────────────────────────────────────────────
  const loadInventory = async () => {
    const { data } = await supabase.from('inventory_items').select('*').eq('user_id', user!.id).order('name')
    if (data) setInventory(data as InventoryItem[])
  }
  const loadPeptides = async () => {
    const { data } = await supabase.from('peptides').select('*').eq('user_id', user!.id).order('name')
    if (data) setPeptides(data as Peptide[])
  }
  const loadCycles = async () => {
    const { data } = await supabase.from('cycles').select('*').eq('user_id', user!.id)
    if (data) setCycles(data as Cycle[])
  }
  const loadEscalations = async () => {
    const { data } = await supabase.from('dose_escalations').select('*').eq('user_id', user!.id).order('start_after_days').order('start_date')
    if (data) setEscalations(data as Escalation[])
  }
  useEffect(() => { loadInventory(); loadPeptides(); loadCycles(); loadEscalations() }, [])

  useEffect(() => {
    if (!showPeptideForm) return
    supabase.from('pk_profiles').select('id, name, aliases').order('name')
      .then(({ data }) => setPkProfileCatalog((data as PkProfileOption[]) ?? []))
  }, [showPeptideForm])

  useEffect(() => {
    setAnimationEpoch(e => e + 1)
  }, [location.key])

  useEffect(() => {
    if (location.hash !== '#new-substance') return
    setEditingPeptideId(null)
    setPForm({ ...emptyPeptideForm(), color_hex: getRandomPeptideColor() })
    setBatchFile(null)
    setPkSuggestOpen(false)
    setShowPeptideForm(true)
    navigate(location.pathname, { replace: true })
  }, [location.hash, location.pathname, navigate])

  const pepPkSuggestions = useMemo(() => {
    const q = pForm.name.trim().toLowerCase()
    if (!q) return []
    return pkProfileCatalog
      .filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.aliases.some(a => a.toLowerCase().includes(q)),
      )
      .slice(0, 5)
  }, [pForm.name, pkProfileCatalog])

  const pepLinkedPkProfile = useMemo(
    () => pkProfileCatalog.find(p => p.id === pForm.pk_profile_id) ?? null,
    [pkProfileCatalog, pForm.pk_profile_id],
  )

  const handlePepNameChange = (value: string) => {
    setPForm(f => ({ ...f, name: value }))
    setPkSuggestOpen(true)
    if (pForm.pk_profile_id && pepLinkedPkProfile && value.trim().toLowerCase() !== pepLinkedPkProfile.name.toLowerCase()) {
      setPForm(f => ({ ...f, pk_profile_id: '' }))
    }
  }

  const selectPepPkProfile = (profile: PkProfileOption) => {
    setPForm(f => ({ ...f, name: profile.name, pk_profile_id: profile.id }))
    setPkSuggestOpen(false)
  }

  const displayPeptides = sortPeptides(
    peptides.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    sortBy,
  )

  const setViewMode = (mode: 'vials' | 'list') => {
    setViewModeState(mode)
    localStorage.setItem('tyd_peptide_view', mode)
  }

  useEffect(() => {
    if (displayPeptides.length === 0) {
      if (activePeptideId) setActivePeptideId(null)
      return
    }
    if (!activePeptideId || !displayPeptides.some(p => p.id === activePeptideId)) {
      setActivePeptideId(displayPeptides[0].id)
    }
  }, [activePeptideId, displayPeptides])

  const cyclesOf      = (pid: string) => cycles
    .filter(c => c.peptide_id === pid)
    .sort((a, b) =>
      (a.active === b.active)
        ? b.created_at.localeCompare(a.created_at)
        : (a.active ? -1 : 1))
  const escalationsOf = (cid: string) => escalations.filter(e => e.cycle_id === cid)

  // ── Inventar Bestand anpassen ─────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const adjustInventoryCount = async (id: string, delta: number, current: number) => {
    const newCount = Math.max(0, current + delta)
    await supabase.from('inventory_items').update({ vials_count: newCount }).eq('id', id)
    loadInventory()
  }

  // ── Rekonstitution wiederholen ────────────────────────────────────────────
  const handleRekonstitution = (p: Peptide) => {
    if (skipRekonstitution) { doRekonstitution(p); return }
    setRekonstitutionDontAsk(false); setRekonstitutionTarget(p)
  }
  const doRekonstitution = async (p: Peptide) => {
    const today = format(new Date(), 'yyyy-MM-dd')
    await supabase.from('peptides')
      .update({ reconstitution_date: today, vials_in_stock: 1, vials_initial: 1 })
      .eq('id', p.id)
    setPeptides(prev => prev.map(pp =>
      pp.id === p.id ? { ...pp, reconstitution_date: today, vials_in_stock: 1, vials_initial: 1 } : pp
    ))
    if (p.inventory_item_id) {
      const invItem = inventory.find(i => i.id === p.inventory_item_id)
      if (invItem) {
        await supabase.from('inventory_items')
          .update({ vials_count: Math.max(0, invItem.vials_count - 1) })
          .eq('id', p.inventory_item_id)
        loadInventory()
      }
    }
    toast.success(t('rekonstitution_erneuert'))
    setRekonstitutionTarget(null); loadPeptides()
  }
  const confirmRekonstitution = () => {
    if (!rekonstitutionTarget) return
    if (rekonstitutionDontAsk) localStorage.setItem('_skip_rekonstitution', '1')
    doRekonstitution(rekonstitutionTarget)
  }

  // ── Peptid CRUD ───────────────────────────────────────────────────────────
  const handleNewPeptide = () => {
    setEditingPeptideId(null); setPForm({ ...emptyPeptideForm(), color_hex: getRandomPeptideColor() }); setBatchFile(null)
    setPkSuggestOpen(false); setShowPeptideForm(true)
  }

  const savePeptide = async () => {
    if (!pForm.name.trim()) return toast.error(t('peptidname_erforderlich'))
    setSavingPeptide(true)

    let fileUrl = pForm.batch_file_url
    if (batchFile) {
      setUploadingFile(true)
      const ext  = batchFile.name.split('.').pop()?.toLowerCase()
      const path = `${user!.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('batch-files').upload(path, batchFile)
      if (upErr) toast.error(t('datei_upload_fehler'))
      else { const { data } = supabase.storage.from('batch-files').getPublicUrl(path); fileUrl = data.publicUrl }
      setUploadingFile(false)
    }

    // "Vorrätige Vials" = raw/unangemischte reserve → goes to inventory.
    // The peptide itself always tracks 1 mixed vial at 100% when newly created;
    // edits preserve the current fill level so it isn't reset mid-use.
    const rawReserve = parseFloat(pForm.vials_in_stock) || 0
    const existingPep = editingPeptideId ? peptides.find(p => p.id === editingPeptideId) : null
    const stock   = existingPep ? (existingPep.vials_in_stock ?? 1) : 1
    const initial = existingPep ? (existingPep.vials_initial  ?? 1) : 1

    // Auto-create or update inventory_item
    let invItemId = pForm.inventory_item_id || null
    if (pForm.vial_amount_mg) {
      const vialAmount = parseFloat(pForm.vial_amount_mg)
      const mgPerVial = pForm.vial_amount_unit === 'mcg' ? vialAmount / 1000 : vialAmount
      const invPayload = {
        user_id: user!.id,
        name: pForm.name.trim(),
        mg_per_vial: mgPerVial,
        vials_count: rawReserve,
        vials_initial: rawReserve,
        batch_number: pForm.batch_number || null,
        batch_source: pForm.batch_source || null,
        batch_file_url: fileUrl || null,
        pk_profile_id: pForm.pk_profile_id || null,
      }
      if (invItemId) {
        await supabase.from('inventory_items').update(invPayload).eq('id', invItemId)
      } else {
        const { data: newInv } = await supabase.from('inventory_items').insert(invPayload).select('id').single()
        invItemId = newInv?.id ?? null
      }
    }


    const payload = {
      user_id:        user!.id, name: pForm.name.trim(),
      default_unit:   pForm.default_unit,
      default_dose:   pForm.default_dose ? parseFloat(pForm.default_dose) : null,
      default_method: pForm.default_method || 'Subkutan',
      vial_amount_mg: pForm.vial_amount_mg ? parseFloat(pForm.vial_amount_mg) : null,
      vial_amount_unit: pForm.vial_amount_mg ? pForm.vial_amount_unit : null,
      reconstitution_ml: pForm.reconstitution_ml ? parseFloat(pForm.reconstitution_ml) : null,
      syringe_type:   (pForm.syringe_ml && pForm.syringe_units) ? `${pForm.syringe_ml}:${pForm.syringe_units}` : null,
      notes:          pForm.notes || null,
      vials_in_stock: stock, vials_initial: initial,
      reconstitution_date: pForm.reconstitution_date || null,
      expiry_days:    pForm.expiry_days ? parseInt(pForm.expiry_days) : null,
      batch_number:   pForm.batch_number   || null,
      batch_source:   pForm.batch_source   || null,
      batch_file_url: fileUrl              || null,
      inventory_item_id: invItemId,
      pk_profile_id:     pForm.pk_profile_id || null,
    }
    const { error, data: savedRow } = editingPeptideId
      ? await supabase.from('peptides').update(payload).eq('id', editingPeptideId).select('id').single()
      : await supabase.from('peptides').insert(payload).select('id').single()
    if (error) toast.error(t('fehler_speichern'))
    else {
      toast.success(editingPeptideId ? t('peptid_aktualisiert') : t('peptid_hinzugefuegt'))
      const savedId = editingPeptideId ?? savedRow?.id
      if (savedId) {
        setExpandedId(savedId)
        if (pForm.color_hex) {
          const updated = { ...peptideColors, [savedId]: pForm.color_hex }
          setPeptideColors(updated)
          localStorage.setItem('tyd_peptide_colors', JSON.stringify(updated))
        }
      }
    }
    setSavingPeptide(false); setShowPeptideForm(false); setBatchFile(null); loadPeptides(); loadInventory()
  }

  const openEditPeptide = (p: Peptide) => {
    setEditingPeptideId(p.id)
    setPForm({
      inventory_item_id: p.inventory_item_id ?? '',
      pk_profile_id:     p.pk_profile_id ?? '',
      name: p.name, default_unit: p.default_unit,
      default_dose:      p.default_dose?.toString() ?? '',
      default_method:    p.default_method,
      vial_amount_mg:    p.vial_amount_mg?.toString()    ?? '',
      vial_amount_unit:  p.vial_amount_unit ?? 'mg',
      reconstitution_ml: p.reconstitution_ml?.toString() ?? '',
      syringe_ml:    p.syringe_type?.split(':')[0] ?? '1',
      syringe_units: p.syringe_type?.split(':')[1] ?? '100',
      notes:         p.notes ?? '',
      // Pre-fill with raw reserve (inventory count), not the mixed-vial fill level.
      vials_in_stock: (inventory.find(i => i.id === p.inventory_item_id)?.vials_count ?? 0).toString(),
      reconstitution_date: p.reconstitution_date ?? '',
      expiry_days:   p.expiry_days?.toString() ?? '',
      batch_number:  p.batch_number  ?? '',
      batch_source:  p.batch_source  ?? '',
      batch_file_url: p.batch_file_url ?? '',
      color_hex: peptideColors[p.id] ?? '',
    })
    setBatchFile(null); setPkSuggestOpen(false); setShowPeptideForm(true)
  }

  const removePeptide = async (id: string) => {
    if (!confirm(t('peptid_loeschen_confirm'))) return
    await supabase.from('peptides').delete().eq('id', id)
    toast.success(t('geloescht')); loadPeptides(); loadCycles()
  }

  // ── Zyklus-Aktionen ───────────────────────────────────────────────────────
  const openNewCycle = (p: Peptide) => {
    const activeExists = cycles.filter(c => c.peptide_id === p.id).some(c => c.active)
    if (activeExists) {
      toast(t('aktiver_zyklus_hinweis'), { icon: '⚠️', duration: 4000 })
      return
    }
    setCycleForPeptide(p); setEditingCycleId(null)
    setCForm(emptyCycleForm(p, t)); setShowCycleForm(true)
  }
  const openEditCycle = (p: Peptide, c: Cycle) => {
    setCycleForPeptide(p); setEditingCycleId(c.id)
    setCForm({
      name: c.name, dose: c.dose.toString(), unit: c.unit,
      method: c.method, frequency: c.frequency,
      x_days_interval: c.x_days_interval?.toString() ?? '3',
      schedule_days: c.schedule_days ?? [],
      start_date: c.start_date, end_date: c.end_date ?? '',
      intake_times: (c.intake_time ?? '').split(',').filter(Boolean),
      intake_time_customs: (c.intake_time_custom ?? '').split(',').filter(Boolean),
      daily_freq: String(Math.max(1, Math.min(3, (c.intake_time ?? '').split(',').filter(Boolean).length || 1))),
      reminder: (c.reminder && c.reminder !== 'none') ? c.reminder.split(',').filter(Boolean) : [],
    })
    setShowCycleForm(true)
  }
  // Schedule-Felder des aktuellen Formularstands (für Vergleich + Segmentaufbau).
  const formSchedFields = (): SchedFields => ({
    frequency: cForm!.frequency,
    x_days_interval: cForm!.frequency === 'Alle X Tage' ? parseInt(cForm!.x_days_interval) : null,
    schedule_days: ['Wochentage wählen', 'Alle X Tage'].includes(cForm!.frequency) ? cForm!.schedule_days : null,
    intake_time: cForm!.intake_times.filter(Boolean).join(',') || null,
    intake_time_custom: cForm!.intake_times.some(time => time === 'custom') ? cForm!.intake_time_customs.join(',') : null,
    dose: parseFloat(cForm!.dose),
    unit: cForm!.unit,
  })

  const saveCycle = async () => {
    if (!cForm || !cycleForPeptide) return
    if (!cForm.name || !cForm.dose) return toast.error(t('name_dosis_erforderlich'))
    if (cForm.frequency === 'Wochentage wählen' && cForm.schedule_days.length === 0)
      return toast.error(t('wochentag_auswaehlen_hint'))
    // Bei einer Planungsänderung an einem bestehenden Zyklus erst fragen: rückwirkend oder ab heute?
    if (editingCycleId) {
      const prev = cycles.find(c => c.id === editingCycleId)
      if (prev) {
        const prevFields: SchedFields = { frequency: prev.frequency, x_days_interval: prev.x_days_interval, schedule_days: prev.schedule_days, intake_time: prev.intake_time, intake_time_custom: prev.intake_time_custom, dose: prev.dose, unit: prev.unit }
        if (schedKey(prevFields) !== schedKey(formSchedFields())) { setScheduleChoiceOpen(true); return }
      }
    }
    await finalizeSave(null)
  }

  // mode: 'retroactive' = neuer Plan gilt für gesamten Zyklus; 'fromToday' = neues Segment ab heute;
  // null = keine Planänderung (oder neuer Zyklus) → bestehende Historie bleibt unverändert.
  const finalizeSave = async (mode: 'retroactive' | 'fromToday' | null) => {
    if (!cForm || !cycleForPeptide) return
    setSavingCycle(true)
    const payload = {
      user_id: user!.id, peptide_id: cycleForPeptide.id,
      name: cForm.name, dose: parseFloat(cForm.dose),
      unit: cForm.unit, method: cForm.method, frequency: cForm.frequency,
      x_days_interval: cForm.frequency === 'Alle X Tage' ? parseInt(cForm.x_days_interval) : null,
      schedule_days: ['Wochentage wählen', 'Alle X Tage'].includes(cForm.frequency) ? cForm.schedule_days : null,
      start_date: cForm.start_date, end_date: cForm.end_date || null, active: true,
      intake_time: cForm.intake_times.filter(Boolean).join(',') || null,
      intake_time_custom: cForm.intake_times.some(time => time === 'custom')
        ? cForm.intake_time_customs.join(',')
        : null,
      reminder: cForm.reminder.length > 0 ? cForm.reminder.join(',') : 'none',
    }
    const nextFields = formSchedFields()
    let scheduleHistory: ScheduleSegment[] | null = null
    if (editingCycleId) {
      const prev = cycles.find(c => c.id === editingCycleId)
      if (prev) {
        const prevFields: SchedFields = { frequency: prev.frequency, x_days_interval: prev.x_days_interval, schedule_days: prev.schedule_days, intake_time: prev.intake_time, intake_time_custom: prev.intake_time_custom, dose: prev.dose, unit: prev.unit }
        if (schedKey(prevFields) === schedKey(nextFields)) {
          scheduleHistory = prev.schedule_history ?? null            // unverändert: Historie behalten
        } else if (mode === 'retroactive') {
          scheduleHistory = null                                     // neuer Plan rückwirkend für gesamten Zyklus
        } else {
          scheduleHistory = nextScheduleHistory(                     // neuer Plan erst ab heute
            prev.schedule_history ?? null,
            prevFields,
            prev.start_date,
            nextFields,
            format(new Date(), 'yyyy-MM-dd'),
          )
        }
      }
    }
    const { error } = editingCycleId
      ? await supabase.from('cycles').update({ ...payload, schedule_history: scheduleHistory }).eq('id', editingCycleId)
      : await supabase.from('cycles').insert(payload)
    if (error) { toast.error(t('error')); setSavingCycle(false); return }
    toast.success(editingCycleId ? t('zyklus_aktualisiert') : t('zyklus_erstellt'))
    if (cForm.reminder.length > 0 && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      if (perm === 'granted') {
        const firstSlot = cForm.intake_times[0] ?? ''
        const baseTime = firstSlot === 'custom'
          ? (cForm.intake_time_customs[0] ?? '')
          : (INTAKE_TIME_CONFIG as Record<string, { time: string }>)[firstSlot]?.time ?? ''
        if (baseTime) {
          const [h, m] = baseTime.split(':').map(Number)
          let scheduled = 0
          for (const r of cForm.reminder) {
            const fireAt = new Date(); fireAt.setHours(h, m, 0, 0)
            if (r === '2h')   fireAt.setHours(fireAt.getHours() - 2)
            if (r === '1day') fireAt.setDate(fireAt.getDate() - 1)
            const delay = fireAt.getTime() - Date.now()
            if (delay > 0) {
              const label = r === '2h' ? ' in 2 Stunden' : r === '1day' ? ' morgen' : ''
              setTimeout(() => new Notification(`💊 ${cForm.name}`, {
                body: `Einnahme${label} um ${baseTime} Uhr`,
              }), delay)
              scheduled++
            }
          }
          if (scheduled > 0) toast.success(`${scheduled} Erinnerung${scheduled > 1 ? 'en' : ''} gesetzt!`)
        }
      }
    }
    setSavingCycle(false); setShowCycleForm(false); setExpandedId(cycleForPeptide.id); loadCycles()
  }
  const toggleCycleActive = async (c: Cycle) => {
    await supabase.from('cycles').update({ active: !c.active }).eq('id', c.id)
    toast.success(c.active ? t('zyklus_deaktiviert') : t('zyklus_aktiviert'))
    loadCycles()
  }
  const removeCycle = async (id: string) => {
    if (!confirm(t('zyklus_loeschen'))) return
    await supabase.from('cycles').delete().eq('id', id)
    toast.success(t('geloescht')); loadCycles()
  }

  // ── Dosiserhöhungs-Aktionen ───────────────────────────────────────────────
  const openNewEsc = (c: Cycle) => {
    setEscForCycle(c); setEditingEscId(null)
    setEForm(emptyEscalationForm(c.unit)); setShowEscForm(true)
  }
  const openEditEsc = (c: Cycle, e: Escalation) => {
    setEscForCycle(c); setEditingEscId(e.id)
    setEForm({
      increase_amount: e.increase_amount.toString(), unit: e.unit,
      start_type: e.start_type,
      start_date: e.start_date ?? format(new Date(), 'yyyy-MM-dd'),
      start_after_days: e.start_after_days?.toString() ?? '2',
      notes: e.notes ?? '',
    })
    setShowEscForm(true)
  }
  const saveEsc = async () => {
    if (!eForm || !escForCycle) return
    if (!eForm.increase_amount) return toast.error(t('erhoeht_erforderlich'))
    setSavingEsc(true)
    const payload = {
      user_id: user!.id, cycle_id: escForCycle.id,
      increase_amount: parseFloat(eForm.increase_amount),
      unit: eForm.unit, start_type: eForm.start_type,
      start_date: eForm.start_type === 'date' ? eForm.start_date : null,
      start_after_days: eForm.start_type !== 'date'
        ? parseInt(eForm.start_after_days) * (eForm.start_type === 'after_weeks' ? 7 : 1)
        : null,
      notes: eForm.notes || null,
    }
    const { error } = editingEscId
      ? await supabase.from('dose_escalations').update(payload).eq('id', editingEscId)
      : await supabase.from('dose_escalations').insert(payload)
    if (error) toast.error(t('error'))
    else { toast.success(editingEscId ? t('inventar_aktualisiert') : t('esc_gespeichert')); setShowEscForm(false); loadEscalations() }
    setSavingEsc(false)
  }
  const removeEsc = async (id: string) => {
    if (!confirm(t('esc_loeschen'))) return
    await supabase.from('dose_escalations').delete().eq('id', id)
    toast.success(t('geloescht')); loadEscalations()
  }

  // ── Helper ────────────────────────────────────────────────────────────────
  const escLabel = (e: Escalation) => {
    if (e.start_type === 'date' && e.start_date)
      return t('ab_datum', { date: format(parseISO(e.start_date), 'dd.MM.yyyy') })
    if (e.start_after_days) {
      const weeks = e.start_after_days % 7 === 0 ? e.start_after_days / 7 : null
      return weeks
        ? `${t('nach_prefix')} ${weeks} ${t('wochen_suffix')}`
        : `${t('nach_prefix')} ${e.start_after_days} ${t('tagen_suffix')}`
    }
    return ''
  }
  const intakeLabel = (c: Cycle) => {
    if (!c.intake_time) return null
    const keys = c.intake_time.split(',').filter(Boolean)
    const customs = (c.intake_time_custom ?? '').split(',')
    const labels = keys.map((key, i) => {
      if (key === 'custom') return customs[i] ?? null
      const cfg = (INTAKE_TIME_CONFIG as Record<string, { labelKey: string }>)[key]
      return cfg ? t(cfg.labelKey) : null
    }).filter(Boolean)
    return labels.length > 0 ? labels.join(' · ') : null
  }
  const freqLabel = (c: Cycle) => {
    if (c.frequency === 'Alle X Tage' && c.x_days_interval)
      return `${t('alle_prefix')} ${c.x_days_interval} ${t('tage_suffix')}`
    if (c.frequency === 'Wochentage wählen' && c.schedule_days?.length)
      return c.schedule_days.join(', ')
    return t(FREQ_KEYS[c.frequency] ?? c.frequency)
  }
  const toggleDay = (day: string) => {
    setCForm(f => {
      if (!f) return f
      const days = f.schedule_days.includes(day)
        ? f.schedule_days.filter(d => d !== day)
        : [...f.schedule_days, day]
      return { ...f, schedule_days: days }
    })
  }

  const activeIndex = Math.max(0, displayPeptides.findIndex(p => p.id === activePeptideId))
  const activePeptide = displayPeptides[activeIndex] ?? null
  const scrollToPeptideIndex = (index: number) => {
    const carousel = vialCarouselRef.current
    const item = carousel?.querySelector<HTMLElement>(`[data-vial-index="${index}"]`)
    item?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }
  const handleVialCarouselScroll = () => {
    const carousel = vialCarouselRef.current
    if (!carousel) return
    if (vialScrollFrameRef.current !== null) window.cancelAnimationFrame(vialScrollFrameRef.current)

    vialScrollFrameRef.current = window.requestAnimationFrame(() => {
      const items = Array.from(carousel.querySelectorAll<HTMLElement>('[data-vial-index]'))
      const carouselCenter = carousel.scrollLeft + carousel.clientWidth / 2
      let closestIndex = activeIndex
      let closestDistance = Number.POSITIVE_INFINITY

      for (const item of items) {
        const index = Number(item.dataset.vialIndex)
        const itemCenter = item.offsetLeft + item.offsetWidth / 2
        const distance = Math.abs(itemCenter - carouselCenter)
        if (Number.isFinite(index) && distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      }

      const next = displayPeptides[closestIndex]
      if (next && next.id !== activePeptideId) setActivePeptideId(next.id)
      vialScrollFrameRef.current = null
    })
  }
  const selectPeptideOffset = (offset: number) => {
    if (displayPeptides.length === 0) return
    const nextIndex = (activeIndex + offset + displayPeptides.length) % displayPeptides.length
    scrollToPeptideIndex(nextIndex)
    setActivePeptideId(displayPeptides[nextIndex].id)
  }

  useEffect(() => {
    return () => {
      if (vialScrollFrameRef.current !== null) window.cancelAnimationFrame(vialScrollFrameRef.current)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Header + Aktions-Button ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FlaskConical size={16} className="text-sky-400" />
            <h2 className="font-semibold text-white">{t('meine_peptide')}</h2>
            {peptides.length > 0 && (
              <span className="badge bg-slate-700 text-slate-400">{peptides.length}</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">{t('fertig_rekonst')}</p>
        </div>
        <button data-ob="btn-peptid-anlegen" className="btn-primary flex items-center gap-1.5 text-sm py-2 shrink-0" onClick={handleNewPeptide}>
          <Plus size={15} /> {t('new')}
        </button>
      </div>

      {/* ══ MEINE PEPTIDE ════════════════════════════════════════════════════ */}
      <div>
          {peptides.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <div className="relative flex-1 min-w-[13rem]">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input className="input pl-9 text-sm" placeholder={t('peptid_suchen')}
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="select text-sm shrink-0 w-auto min-w-[8.5rem] max-w-[48%] pr-8" value={sortBy}
                aria-label={t('sort_aria_label')}
                onChange={e => setSortBy(e.target.value as PeptideSortKey)}>
                {PEPTIDE_SORT_GROUPS.map(group => (
                  <optgroup key={group.labelKey} label={t(group.labelKey)}>
                    {group.options.map(key => (
                      <option key={key} value={key}>{t(SORT_OPTION_LABEL_KEYS[key])}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="flex shrink-0 rounded-xl border border-slate-800 bg-slate-900/70 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('vials')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    viewMode === 'vials' ? 'bg-cyan-400 text-slate-950 shadow-cyan-400/20' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FlaskConical size={14} /> Vials
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    viewMode === 'list' ? 'bg-cyan-400 text-slate-950 shadow-cyan-400/20' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <List size={14} /> Liste
                </button>
              </div>
            </div>
          )}

          {peptides.length === 0 && (
            <div className="card text-center py-10 text-slate-500">
              <FlaskConical size={32} className="mx-auto mb-2 opacity-40" />
              <p className="mb-1">{t('keine_peptide')}</p>
              <p className="text-xs text-slate-600 mb-4">{t('keine_peptide')}</p>
              <button className="btn-primary flex items-center gap-2 mx-auto" onClick={handleNewPeptide}>
                <Plus size={14} /> {t('new')}
              </button>
            </div>
          )}

          {search && displayPeptides.length === 0 && (
            <div className="card text-center py-8 text-slate-500 text-sm">
              {t('kein_peptid_gefunden_msg', { search })}
            </div>
          )}

          {viewMode === 'vials' && activePeptide && (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40 px-2 py-5 sm:px-5">
                <div className="mb-2 flex items-center justify-between px-2">
                  <button
                    type="button"
                    onClick={() => selectPeptideOffset(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
                    aria-label="Vorheriges Peptid"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-xs font-semibold tabular-nums text-slate-500">
                    {activeIndex + 1} / {displayPeptides.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => selectPeptideOffset(1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
                    aria-label="Nächstes Peptid"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div
                  ref={vialCarouselRef}
                  onScroll={handleVialCarouselScroll}
                  className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  style={{
                    paddingInline: 'calc((100% - min(14rem, 58vw)) / 2)',
                    scrollPaddingInline: 'calc((100% - min(14rem, 58vw)) / 2)',
                  }}
                >
                  {displayPeptides.map((p, index) => {
                    const isActive = p.id === activePeptide.id
                    const colorIdx = peptides.findIndex(pp => pp.id === p.id)
                    const peptideColor = peptideColors[p.id] ?? getPeptideColor(colorIdx)
                    const vialPct = Math.round(getVialFillPct(p) ?? 100)

                    return (
                      <div
                        key={p.id}
                        data-vial-index={index}
                        className={`snap-center shrink-0 rounded-2xl px-2 py-2 transition-all duration-200 ${
                          isActive ? 'scale-100 opacity-100' : 'scale-90 opacity-45'
                        }`}
                        style={{ width: 'min(14rem, 58vw)' }}
                        aria-label={p.name}
                      >
                        <PeptideVialVisual
                          key={animationEpoch}
                          name={p.name}
                          amount={p.vial_amount_mg}
                          unit={p.vial_amount_unit ?? 'mg'}
                          fillPct={vialPct}
                          color={peptideColor}
                          animateOnMount={true}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {(() => {
                const p = activePeptide
                const pCycles = cyclesOf(p.id)
                const hasActive = pCycles.some(c => c.active)
                const invItem = p.inventory_item_id ? inventory.find(i => i.id === p.inventory_item_id) : null
                const vialPct = Math.round(getVialFillPct(p) ?? 100)
                const days = expiryDaysLeft(p)
                const daysClass = days === null ? 'text-slate-300' : days > 7 ? 'text-emerald-400' : days > 0 ? 'text-amber-400' : 'text-red-400'
                const expiryLabel = days === null
                  ? t('peptide_form_not_set', { defaultValue: 'Nicht gesetzt' })
                  : days > 0
                    ? (days === 1 ? t('haltbar_noch_1') : t('haltbar_noch_n', { n: days }))
                    : t('abgelaufen_warn')

                return (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-xl font-bold text-white">{p.name}</h3>
                          <span className={`badge ${hasActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                            {hasActive ? t('aktiv_badge') : t('inaktiv_badge')}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          {t(METHOD_KEYS[p.default_method] ?? p.default_method)}
                          {p.vial_amount_mg ? ` · Vial: ${p.vial_amount_mg} ${p.vial_amount_unit ?? 'mg'}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button className="p-2 text-slate-400 transition-colors hover:text-sky-400"
                          title="Infos" onClick={() => { setInfoPeptide(p); dismissInfoBtn() }}>
                          <FileText size={16} />
                        </button>
                        <button className="p-2 text-slate-400 transition-colors hover:text-sky-400"
                          onClick={() => openEditPeptide(p)}><Pencil size={16} /></button>
                        {p.inventory_item_id && (
                          <button
                            className="p-2 text-slate-400 transition-colors hover:text-sky-400"
                            title={t('rekonstitution_wdh')}
                            onClick={() => handleRekonstitution(p)}
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}
                        <button className="p-2 text-slate-400 transition-colors hover:text-red-400"
                          onClick={() => removePeptide(p.id)}><Trash2 size={16} /></button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Haltbarkeit</p>
                        <p className={`mt-1 font-semibold ${daysClass}`}>{expiryLabel}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vorrat</p>
                        <p className="mt-1 font-semibold text-white">{invItem ? t('vials_vorratig', { n: invItem.vials_count }) : '-'}</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Füllstand</p>
                        <p className="mt-1 font-semibold text-white">{vialPct}%</p>
                      </div>
                      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Zyklen</p>
                        <p className="mt-1 font-semibold text-white">{pCycles.length}</p>
                      </div>
                    </div>

                    <button
                      data-ob="btn-zyklus-add"
                      onClick={() => { openNewCycle(p); dismissZyklusBtn() }}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-300 transition-colors hover:border-violet-400/50 hover:bg-violet-500/25"
                    >
                      <Plus size={15} /> {t('zyklus_hinzufuegen')}
                      {zyklusBtnNew && <NewDot />}
                    </button>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Peptid-Liste ────────────────────────────────────────────── */}
          <div className={`space-y-3 ${viewMode === 'list' ? '' : 'hidden'}`}>
            {displayPeptides.map(p => {
              const pCycles   = cyclesOf(p.id)
              const isOpen    = expandedId === p.id
              const hasActive = pCycles.some(c => c.active)
              const vialPct = getVialFillPct(p)
              const colorIdx   = peptides.findIndex(pp => pp.id === p.id)
              const peptideColor = peptideColors[p.id] ?? getPeptideColor(colorIdx)
              const invItem = p.inventory_item_id ? inventory.find(i => i.id === p.inventory_item_id) : null

              return (
                <div key={p.id} className="card">
                  {/* Kopfzeile */}
                  <div className="flex items-start gap-3">
                    {vialPct !== null && (
                      <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <VialDisplay key={animationEpoch} pct={Math.round(vialPct)} uid={p.id.replace(/-/g, '')} color={peptideColor} animateOnMount={true} />
                        <span className="text-[10px] font-bold tabular-nums text-slate-500 leading-none">
                          {Math.round(vialPct)}%
                        </span>
                      </div>
                    )}
                    <div className="flex-1 flex items-start justify-between gap-2 min-w-0">
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex-1 text-left min-w-0 cursor-pointer"
                        onClick={() => setExpandedId(isOpen ? null : p.id)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isOpen ? null : p.id) } }}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-white">{p.name}</p>
                          {hasActive && <span className="badge bg-emerald-500/10 text-emerald-400">{t('aktiv_badge')}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-slate-400 text-xs mt-1">
                          <span>{t(METHOD_KEYS[p.default_method] ?? p.default_method)}</span>
                          {p.vial_amount_mg && <span>Vial: {p.vial_amount_mg} {p.vial_amount_unit ?? 'mg'}</span>}
                        </div>


                        {p.reconstitution_date && p.expiry_days && (() => {
                          const exp  = addDays(parseISO(p.reconstitution_date), p.expiry_days)
                          const days = differenceInDays(exp, new Date())
                          const cls  = days > 7 ? 'text-emerald-400' : days > 0 ? 'text-amber-400' : 'text-red-400'
                          return (
                            <p className={`text-xs mt-0.5 ${cls}`}>
                              {days > 0 ? (days === 1 ? t('haltbar_noch_1') : t('haltbar_noch_n', { n: days })) : t('abgelaufen_warn')}
                            </p>
                          )
                        })()}

                        {invItem && (
                          <div
                            className="mt-0.5 flex items-center gap-2"
                            onClick={e => e.stopPropagation()}
                          >
                            <span className="text-[11px] tabular-nums text-slate-500">
                              {t('vials_vorratig', { n: invItem.vials_count })}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={e => { e.stopPropagation(); adjustInventoryCount(invItem.id, -1, invItem.vials_count) }}
                                disabled={invItem.vials_count <= 0}
                                className="flex h-5 w-5 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 disabled:opacity-25"
                              >
                                <Minus size={10} />
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); adjustInventoryCount(invItem.id, +1, invItem.vials_count) }}
                                className="flex h-5 w-5 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                                style={{ color: peptideColor }}
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button className="relative p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                          title="Infos" onClick={() => { setInfoPeptide(p); dismissInfoBtn() }}>
                          <FileText size={15} />
                          {infoBtnNew && <NewDot className="absolute -top-0.5 -right-0.5" />}
                        </button>
                        <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                          onClick={() => openEditPeptide(p)}><Pencil size={15} /></button>
                        {p.inventory_item_id && (
                          <button
                            className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                            title={t('rekonstitution_wdh')}
                            onClick={(e) => { e.stopPropagation(); handleRekonstitution(p) }}
                          >
                            <RefreshCw size={15} />
                          </button>
                        )}
                        <button className="p-1.5 text-slate-400 hover:text-red-400 transition-colors"
                          onClick={() => removePeptide(p.id)}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Zyklus-Zeile */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60">
                    <button
                      onClick={() => setExpandedId(isOpen ? null : p.id)}
                      className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors">
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      {pCycles.length > 0 ? (pCycles.length === 1 ? t('zyklus_count_one') : t('zyklus_count_many', { n: pCycles.length })) : t('keine_zyklen')}
                    </button>
                    <button
                      data-ob="btn-zyklus-add"
                      onClick={() => { openNewCycle(p); dismissZyklusBtn() }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-violet-400 hover:bg-violet-500/25 hover:border-violet-400/50 transition-colors text-xs font-medium">
                      {t('zyklus_hinzufuegen')}
                      {zyklusBtnNew && <NewDot />}
                    </button>
                  </div>

                  {/* Ausgeklappt: Zyklen */}
                  {isOpen && (
                    <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                          <CalendarDays size={14} className="text-violet-400" /> {t('zyklen_header')}
                        </span>
                      </div>
                      {pCycles.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-4">
                          {t('noch_kein_zyklus')}
                        </p>
                      )}
                      {pCycles.map(c => {
                        const pEscs = escalationsOf(c.id)
                        return (
                          <div key={c.id} className={`rounded-xl border ${c.active ? 'border-violet-500/30 bg-violet-500/5' : 'border-slate-800 opacity-60'}`}>
                            <div className="flex items-start justify-between gap-2 p-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{c.name}</p>
                                <div className="flex flex-wrap gap-x-3 text-slate-400 text-xs mt-0.5">
                                  <span className="font-medium text-slate-300">{c.dose} {c.unit}</span>
                                  <span>{t(METHOD_KEYS[c.method] ?? c.method)}</span>
                                  <span>{freqLabel(c)}</span>
                                  {(() => { const lbl = intakeLabel(c); const firstKey = c.intake_time?.split(',')[0] ?? ''; const SlotIcon = (INTAKE_TIME_CONFIG as Record<string,{icon:LucideIcon}>)[firstKey]?.icon ?? Clock; return lbl ? <span className="text-amber-400 inline-flex items-center gap-1"><SlotIcon size={12} /> {lbl}</span> : null })()}
                                  <span>{t('ab_datum', { date: format(parseISO(c.start_date), 'dd.MM.yyyy') })}</span>
                                  {c.end_date && <span>{t('bis_datum', { date: format(parseISO(c.end_date), 'dd.MM.yyyy') })}</span>}
                                </div>
                                {c.reminder && c.reminder !== 'none' && (
                                  <p className="text-xs mt-0.5 flex items-center gap-1 flex-wrap text-sky-400">
                                    <Bell size={10} className="shrink-0" />
                                    {c.reminder.split(',').filter(v => v && v !== 'none').map(v => {
                                      const opt = REMINDER_OPTIONS.find(r => r.value === v)
                                      return opt ? t(opt.labelKey) : v
                                    }).filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => toggleCycleActive(c)} title={c.active ? t('deaktivieren_title') : t('aktivieren_title')}
                                  className="flex items-center gap-1.5">
                                  <span className={`text-xs font-medium transition-colors ${c.active ? 'text-emerald-400' : 'text-slate-500'}`}>
                                    {c.active ? t('aktiv_badge') : t('inaktiv_badge')}
                                  </span>
                                  <div className={`relative w-9 h-5 rounded-full transition-colors ${c.active ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${c.active ? 'left-4' : 'left-0.5'}`} />
                                  </div>
                                </button>
                                <button className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                                  onClick={() => openEditCycle(p, c)}><Pencil size={13} /></button>
                                <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                  onClick={() => removeCycle(c.id)}><Trash2 size={13} /></button>
                              </div>
                            </div>

                            {/* Dosiserhöhungen */}
                            <div className="border-t border-slate-800/60 px-3 pb-3 pt-2">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                  <TrendingUp size={12} className="text-orange-400" /> {t('dosiserhoehungen')}
                                </span>
                                <button data-ob="btn-esc-add" className="text-xs flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors"
                                  onClick={() => openNewEsc(c)}>
                                  <Plus size={11} /> {t('esc_hinzufuegen')}
                                </button>
                              </div>
                              {pEscs.length === 0 && (
                                <p className="text-slate-600 text-xs italic">{t('keine_dosiserhoehungen')}</p>
                              )}
                              <div className="space-y-1.5">
                                {pEscs.map((e, idx) => (
                                  <div key={e.id} className="flex items-center justify-between gap-2 bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-orange-400 text-xs font-bold shrink-0">#{idx + 1}</span>
                                      <div className="min-w-0">
                                        <span className="text-white text-xs font-medium">+{e.increase_amount} {e.unit}</span>
                                        <span className="text-slate-400 text-xs ml-2">{escLabel(e)}</span>
                                        {e.notes && <p className="text-slate-500 text-xs truncate">{e.notes}</p>}
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <button className="p-1 text-slate-500 hover:text-sky-400 transition-colors"
                                        onClick={() => openEditEsc(c, e)}><Pencil size={11} /></button>
                                      <button className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                        onClick={() => removeEsc(e.id)}><Trash2 size={11} /></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
      </div>

      {/* ══ PEPTID-FORMULAR ══════════════════════════════════════════════════ */}
      {showPeptideForm && (
        <PeptideFormModal
          editingPeptideId={editingPeptideId}
          pForm={pForm}
          setPForm={setPForm}
          batchFile={batchFile}
          setBatchFile={setBatchFile}
          savingPeptide={savingPeptide}
          uploadingFile={uploadingFile}
          onClose={() => setShowPeptideForm(false)}
          onSave={savePeptide}
          pkSuggestOpen={pkSuggestOpen}
          setPkSuggestOpen={setPkSuggestOpen}
          pepPkSuggestions={pepPkSuggestions}
          selectPepPkProfile={selectPepPkProfile}
          handlePepNameChange={handlePepNameChange}
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
        />
      )}

      {/* ══ ZYKLUS-FORMULAR ══════════════════════════════════════════════════ */}
      {showCycleForm && cForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal
          onClick={() => setShowCycleForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>

            <div>
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-violet-400" />
                <h2 className="text-lg font-bold">{editingCycleId ? t('zyklus_bearbeiten') : t('neuer_zyklus_title')}</h2>
              </div>
              {cycleForPeptide && <p className="text-sky-400 text-sm mt-0.5 ml-6">{cycleForPeptide.name}</p>}
            </div>

            <div data-ob="cycle-core" className="space-y-4">
            <div data-ob="cyc-name">
              <label className="label">{t('zyklus_name')}</label>
              <input className="input" placeholder={t('zyklus_name_placeholder')}
                value={cForm.name} onChange={e => setCForm(f => f ? { ...f, name: e.target.value } : f)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div data-ob="cyc-dose">
                <label className="label">{t('dosis_label')}</label>
                <input className="input" type="number" value={cForm.dose}
                  onChange={e => setCForm(f => f ? { ...f, dose: e.target.value } : f)} />
              </div>
              <div data-ob="cyc-unit">
                <label className="label">{t('einheit_label')}</label>
                <select className="select" value={cForm.unit}
                  onChange={e => setCForm(f => f ? { ...f, unit: e.target.value } : f)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div data-ob="cyc-method">
              <label className="label">{t('applikationsart_label')}</label>
              <select className="select" value={cForm.method}
                onChange={e => setCForm(f => f ? { ...f, method: e.target.value } : f)}>
                {METHODS.map(m => <option key={m} value={m}>{t(METHOD_KEYS[m] ?? m)}</option>)}
              </select>
            </div>

            <div data-ob="cyc-frequency">
              <label className="label">{t('frequenz')}</label>
              <select className="select" value={cForm.frequency}
                onChange={e => setCForm(f => {
                  if (!f) return f
                  const newFreq = e.target.value
                  const newSlots = parseInt(f?.daily_freq ?? '1')
                  const keepDays = ['Wochentage wählen', 'Alle X Tage'].includes(newFreq)
                  return {
                    ...f,
                    frequency: newFreq,
                    intake_times: f.intake_times.slice(0, newSlots),
                    intake_time_customs: f.intake_time_customs.slice(0, newSlots),
                    schedule_days: keepDays ? f.schedule_days : [],
                  }
                })}>
                {BASE_FREQUENCIES.map(freq => <option key={freq} value={freq}>{t(FREQ_KEYS[freq] ?? freq)}</option>)}
              </select>
            </div>

            {cForm.frequency === 'Alle X Tage' && (
              <div data-ob="cyc-interval">
                <label className="label">{t('alle_x_tage_frage')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">{t('alle_prefix')}</span>
                  <input className="input w-24" type="number" min="2" max="30"
                    value={cForm.x_days_interval}
                    onChange={e => setCForm(f => f ? { ...f, x_days_interval: e.target.value } : f)} />
                  <span className="text-slate-400 text-sm">{t('tage_suffix')}</span>
                </div>
              </div>
            )}

            {cForm.frequency === 'Wochentage wählen' && (
              <div data-ob="cyc-weekdays" data-ob-self>
                <label className="label">{t('injektionstage_label')}</label>
                <div className="flex gap-2">
                  {WOCHENTAGE.map(day => (
                    <button key={day} type="button" onClick={() => toggleDay(day)}
                      className={`flex-1 h-10 rounded-lg text-sm font-medium transition-colors ${
                        cForm.schedule_days.includes(day) ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>
                      {day}
                    </button>
                  ))}
                </div>
                {cForm.schedule_days.length > 0 && (
                  <p className="text-sky-400 text-xs mt-2">{t('ausgewaehlt_label')} {cForm.schedule_days.join(', ')}</p>
                )}
              </div>
            )}

            <div data-ob="cyc-dates" data-ob-self>
              <div>
                <label className="label">{t('startdatum_label')}</label>
                <input className="input" type="date" value={cForm.start_date}
                  onChange={e => setCForm(f => f ? { ...f, start_date: e.target.value } : f)} />
              </div>
              <div className="mt-3">
                <label className="label">{t('enddatum_optional_label')}</label>
                <input className="input" type="date" value={cForm.end_date}
                  onChange={e => setCForm(f => f ? { ...f, end_date: e.target.value } : f)} />
              </div>
            </div>

            <div data-ob="cyc-intake" data-ob-self>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">{t('einnahmezeitpunkt')}</label>
                <span className="text-xs text-slate-500">optional</span>
              </div>
              {/* Wie oft täglich? */}
              <div className="flex gap-2 mb-3">
                {(['1','2','3'] as const).map(n => (
                  <button key={n} type="button"
                    onClick={() => setCForm(f => f ? {
                      ...f,
                      daily_freq: n,
                      intake_times: f.intake_times.slice(0, parseInt(n)),
                      intake_time_customs: f.intake_time_customs.slice(0, parseInt(n)),
                    } : f)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      cForm.daily_freq === n ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>
                    {n}× {t('freq_taeglich')}
                  </button>
                ))}
              </div>
              {Array.from({ length: parseInt(cForm.daily_freq) }, (_, slotIdx) => (
                <div key={slotIdx} className={slotIdx > 0 ? 'mt-3' : ''}>
                  {parseInt(cForm.daily_freq) > 1 && (
                    <p className="text-xs text-slate-400 mb-1.5 font-medium">
                      {t('einnahme_nr', { n: slotIdx + 1 })}
                    </p>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {(Object.entries(INTAKE_TIME_CONFIG) as [string, { labelKey: string; icon: LucideIcon }][]).map(([key, cfg]) => {
                      const isActive = cForm.intake_times[slotIdx] === key
                      return (
                        <button key={key} type="button"
                          onClick={() => setCForm(f => {
                            if (!f) return f
                            const newTimes = [...f.intake_times]
                            const newCustoms = [...f.intake_time_customs]
                            newTimes[slotIdx] = isActive ? '' : key
                            if (isActive) newCustoms[slotIdx] = ''
                            return { ...f, intake_times: newTimes, intake_time_customs: newCustoms }
                          })}
                          className={`py-2.5 rounded-xl text-xs font-medium transition-colors flex flex-col items-center gap-1 ${
                            isActive ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}>
                          <cfg.icon size={18} />
                          {t(cfg.labelKey)}
                        </button>
                      )
                    })}
                  </div>
                  {cForm.intake_times[slotIdx] === 'custom' && (
                    <input className="input mt-2" type="time"
                      value={cForm.intake_time_customs[slotIdx] ?? ''}
                      onChange={e => setCForm(f => {
                        if (!f) return f
                        const newCustoms = [...f.intake_time_customs]
                        newCustoms[slotIdx] = e.target.value
                        return { ...f, intake_time_customs: newCustoms }
                      })} />
                  )}
                </div>
              ))}
            </div>{/* /einnahmezeitpunkt data-ob-self */}

            <div data-ob="cyc-reminder" data-ob-self>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0 flex items-center gap-1.5">
                  <Bell size={13} className="text-sky-400" /> {t('erinnerung_label')}
                </label>
                <span className="text-xs text-slate-500">{t('mehrfachauswahl_hint')}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {REMINDER_OPTIONS.map(opt => {
                  const active = cForm.reminder.includes(opt.value)
                  return (
                    <button key={opt.value} type="button"
                      onClick={() => setCForm(f => {
                        if (!f) return f
                        const next = f.reminder.includes(opt.value)
                          ? f.reminder.filter(v => v !== opt.value)
                          : [...f.reminder, opt.value]
                        return { ...f, reminder: next }
                      })}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between gap-2 ${
                        active ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>
                      <span>{t(opt.labelKey)}</span>
                      <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                        active ? 'bg-white/20 border-white/60' : 'border-slate-600'
                      }`}>
                        {active && <Check size={10} strokeWidth={3} />}
                      </span>
                    </button>
                  )
                })}
              </div>
              {cForm.reminder.length > 0 && (
                <p className="text-slate-500 text-xs mt-1.5">
                  {t('erinnerung_info', { n: cForm.reminder.length })}
                </p>
              )}
            </div>{/* /erinnerung data-ob-self */}

            </div>{/* /cycle-core */}

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowCycleForm(false)}>{t('cancel')}</button>
              <button data-ob="btn-cycle-save" className="btn-primary flex-1" onClick={saveCycle} disabled={savingCycle}>
                {savingCycle ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DOSISERHÖHUNG-FORMULAR ═══════════════════════════════════════════ */}
      {showEscForm && eForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal
          onClick={() => setShowEscForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>

            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-orange-400" />
                <h2 className="text-lg font-bold">
                  {editingEscId ? t('esc_bearbeiten') : t('esc_hinzufuegen')}
                </h2>
              </div>
              {escForCycle && <p className="text-slate-400 text-sm mt-0.5 ml-6">{escForCycle.name}</p>}
            </div>

            <div data-ob="esc-core" className="space-y-4">
            <div data-ob="esc-amount">
              <label className="label">{t('dosis_erhoeht_um')}</label>
              <div className="flex gap-2">
                <input className="input flex-1" type="number" placeholder={t('eg_100')}
                  value={eForm.increase_amount}
                  onChange={e => setEForm(f => f ? { ...f, increase_amount: e.target.value } : f)} />
                <select className="select w-28" value={eForm.unit}
                  onChange={e => setEForm(f => f ? { ...f, unit: e.target.value } : f)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div data-ob="esc-when">
              <label className="label">{t('ab_wann_label')}</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'date',        labelKey: 'festes_datum' },
                  { value: 'after_days',  labelKey: 'nach_x_tagen' },
                  { value: 'after_weeks', labelKey: 'nach_x_wochen' },
                ] as const).map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setEForm(f => f ? { ...f, start_type: opt.value } : f)}
                    className={`py-2.5 rounded-xl text-xs font-medium transition-colors ${
                      eForm.start_type === opt.value ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}>
                    {t(opt.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {eForm.start_type === 'date' && (
              <div data-ob="esc-when-detail">
                <label className="label">{t('datum_label')}</label>
                <input className="input" type="date" value={eForm.start_date}
                  onChange={e => setEForm(f => f ? { ...f, start_date: e.target.value } : f)} />
              </div>
            )}
            {eForm.start_type === 'after_days' && (
              <div data-ob="esc-when-detail">
                <label className="label">{t('tage_nach_start')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm shrink-0">{t('nach_prefix')}</span>
                  <input className="input w-24" type="number" min="1"
                    value={eForm.start_after_days}
                    onChange={e => setEForm(f => f ? { ...f, start_after_days: e.target.value } : f)} />
                  <span className="text-slate-400 text-sm shrink-0">{t('tagen_suffix')}</span>
                </div>
              </div>
            )}
            {eForm.start_type === 'after_weeks' && (
              <div data-ob="esc-when-detail">
                <label className="label">{t('wochen_nach_start')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm shrink-0">{t('nach_prefix')}</span>
                  <input className="input w-24" type="number" min="1"
                    value={eForm.start_after_days}
                    onChange={e => setEForm(f => f ? { ...f, start_after_days: e.target.value } : f)} />
                  <span className="text-slate-400 text-sm shrink-0">{t('wochen_suffix')}</span>
                </div>
              </div>
            )}

            <div data-ob="esc-notes">
              <label className="label">{t('notizen_optional')}</label>
              <textarea className="input resize-none" rows={2}
                placeholder={t('esc_notes_placeholder')}
                value={eForm.notes}
                onChange={e => setEForm(f => f ? { ...f, notes: e.target.value } : f)} />
            </div>

            </div>{/* /esc-core */}

            <div className="flex gap-3 pt-2">
              <button className="btn-secondary flex-1" onClick={() => setShowEscForm(false)}>{t('cancel')}</button>
              <button data-ob="btn-esc-save" className="btn-primary flex-1" onClick={saveEsc} disabled={savingEsc}>
                {savingEsc ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ REKONSTITUTION DIALOG ═════════════════════════════════════════════ */}
      {rekonstitutionTarget && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4" data-app-modal>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-white text-lg">{t('rekonstitution_wdh_title')}</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              {t('rekonstitution_wdh_desc')}
            </p>
            <label className="flex items-center gap-2.5 text-sm text-slate-400 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-sky-500"
                checked={rekonstitutionDontAsk}
                onChange={e => setRekonstitutionDontAsk(e.target.checked)} />
              {t('nicht_mehr_fragen')}
            </label>
            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" onClick={() => setRekonstitutionTarget(null)}>{t('no')}</button>
              <button onClick={confirmRekonstitution}
                className="flex-1 py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold transition-colors text-sm">
                {t('yes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PLANÄNDERUNG: RÜCKWIRKEND ODER AB HEUTE ═══════════════════════════ */}
      {scheduleChoiceOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4" data-app-modal>
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-white text-lg">
              {t('schedule_change_title', { defaultValue: 'Änderung übernehmen' })}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              {t('schedule_change_desc', { defaultValue: 'Du hast den Einnahmeplan geändert. Soll die Änderung rückwirkend für den gesamten Zyklus gelten oder erst ab heute?' })}
            </p>
            <div className="space-y-2.5 pt-1">
              <button onClick={() => { setScheduleChoiceOpen(false); finalizeSave('fromToday') }}
                className="w-full py-2.5 px-4 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm text-left transition-colors">
                {t('schedule_change_from_today', { defaultValue: 'Erst ab heute' })}
                <span className="block text-xs font-normal text-sky-100/80 mt-0.5">
                  {t('schedule_change_from_today_hint', { defaultValue: 'Vergangene Tage behalten den bisherigen Plan.' })}
                </span>
              </button>
              <button onClick={() => { setScheduleChoiceOpen(false); finalizeSave('retroactive') }}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm text-left border border-slate-700 transition-colors">
                {t('schedule_change_retroactive', { defaultValue: 'Rückwirkend für den gesamten Zyklus' })}
                <span className="block text-xs font-normal text-slate-400 mt-0.5">
                  {t('schedule_change_retroactive_hint', { defaultValue: 'Der neue Plan gilt auch für alle vergangenen Tage. Erinnerungen werden entsprechend angepasst.' })}
                </span>
              </button>
            </div>
            <button className="btn-secondary w-full" onClick={() => { setScheduleChoiceOpen(false); setSavingCycle(false) }}>
              {t('cancel', { defaultValue: 'Abbrechen' })}
            </button>
          </div>
        </div>
      )}

      {/* ══ INFO-SHEET ═══════════════════════════════════════════════════════ */}
      {infoPeptide && (() => {
        const p = infoPeptide
        const syringeMl    = p.syringe_type?.split(':')[0]
        const syringeUnits = p.syringe_type?.split(':')[1]
        const isImage = p.batch_file_url ? /\.(jpe?g|png|webp)$/i.test(p.batch_file_url) : false
        const isPdf   = p.batch_file_url ? /\.pdf$/i.test(p.batch_file_url) : false
        const invItem = inventory.find(i => i.id === p.inventory_item_id)

        let expiryDays: number | null = null
        let expiryDate: string | null = null
        if (p.reconstitution_date && p.expiry_days) {
          const exp = addDays(parseISO(p.reconstitution_date), p.expiry_days)
          expiryDays = differenceInDays(exp, new Date())
          expiryDate = format(exp, 'dd.MM.yyyy')
        }

        return (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal
            onClick={() => setInfoPeptide(null)}>
            <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] motion-fade-up"
              onClick={e => e.stopPropagation()}>

              <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-5 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-sky-400" />
                  <h2 className="font-bold text-white text-lg">{p.name}</h2>
                </div>
                <button onClick={() => setInfoPeptide(null)} className="p-1.5 text-slate-400 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4 stagger-in">

                {/* Inventar-Verknüpfung */}
                {invItem && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                    <Archive size={13} className="text-sky-400 shrink-0" />
                    <p className="text-sky-400 text-xs">{t('aus_inventar_badge')} <span className="font-medium">{invItem.name}</span> · {invItem.mg_per_vial} mg/Vial</p>
                  </div>
                )}

                {/* Dosierung */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('dosierung_section')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3">
                      <p className="text-slate-400 text-xs">{t('standard_dosis_label')}</p>
                      <p className="text-white font-semibold mt-0.5">
                        {p.default_dose ? `${p.default_dose} ${p.default_unit}` : '—'}
                      </p>
                    </div>
                    <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3">
                      <p className="text-slate-400 text-xs">{t('applikation_info')}</p>
                      <p className="text-white font-semibold mt-0.5">{t(METHOD_KEYS[p.default_method] ?? p.default_method)}</p>
                    </div>
                  </div>
                </div>

                {/* Rekonstitution */}
                {(p.vial_amount_mg || p.reconstitution_ml) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('wirkstoff_rekonstitution')}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {p.vial_amount_mg && (
                        <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3 text-center">
                          <p className="text-sky-400 text-base font-bold">{p.vial_amount_mg}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{p.vial_amount_unit ?? 'mg'} / Vial</p>
                        </div>
                      )}
                      {p.reconstitution_ml && (
                        <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3 text-center">
                          <p className="text-sky-400 text-base font-bold">{p.reconstitution_ml}</p>
                          <p className="text-slate-500 text-xs mt-0.5">{t('ml_fluessigkeit')}</p>
                        </div>
                      )}
                      {syringeMl && syringeUnits && (
                        <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3 text-center">
                          <p className="text-sky-400 text-base font-bold">{syringeMl} mL</p>
                          <p className="text-slate-500 text-xs mt-0.5">{syringeUnits} {t('einh_kurz')}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Haltbarkeit */}
                {(p.reconstitution_date || expiryDate) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('haltbarkeit_section_info')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {p.reconstitution_date && (
                        <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">{t('datum_rekonstitution')}</p>
                          <p className="text-white font-semibold mt-0.5">{format(parseISO(p.reconstitution_date), 'dd.MM.yyyy')}</p>
                        </div>
                      )}
                      {expiryDate && expiryDays !== null && (
                        <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">{t('ablauf_label')}</p>
                          <p className={`font-semibold mt-0.5 ${expiryDays > 7 ? 'text-emerald-400' : expiryDays > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                            {expiryDate}
                          </p>
                          <p className={`text-xs ${expiryDays > 7 ? 'text-emerald-500' : expiryDays > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                            {expiryDays > 0 ? t('noch_n_tage_ablauf', { n: expiryDays }) : t('abgelaufen_warn')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Bestand */}
                {(p.vials_in_stock !== null || p.vials_initial) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('bestand_section')}</p>
                    <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold">{p.vials_in_stock ?? 0} Vials</span>
                        {(p.vials_initial ?? 0) > 0 && (
                          <span className="text-slate-400 text-xs">{t('von_n_gesamt', { n: p.vials_initial })}</span>
                        )}
                      </div>
                      {(p.vials_initial ?? 0) > 0 && (() => {
                        const pct = Math.max(0, Math.min(100, ((p.vials_in_stock ?? 0) / p.vials_initial!) * 100))
                        const bar = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
                        const txt = pct > 50 ? 'text-emerald-400' : pct > 25 ? 'text-amber-400' : 'text-red-400'
                        return (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-xs font-bold shrink-0 ${txt}`}>{Math.round(pct)}%</span>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {/* Batch */}
                {(p.batch_number || p.batch_source) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('batch_herkunft_section')}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {p.batch_number && (
                        <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">{t('batch')}</p>
                          <p className="text-white font-medium mt-0.5 text-sm">{p.batch_number}</p>
                        </div>
                      )}
                      {p.batch_source && (
                        <div className="bg-slate-800/60 border border-slate-800 rounded-xl p-3">
                          <p className="text-slate-400 text-xs">{t('quelle')}</p>
                          <p className="text-white font-medium mt-0.5 text-sm">{p.batch_source}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Dokument */}
                {p.batch_file_url && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('analyse_dokument_section')}</p>
                    {isImage && (
                      <a href={p.batch_file_url} target="_blank" rel="noopener noreferrer">
                        <img src={p.batch_file_url} alt="Batch-Dokument"
                          className="w-full rounded-xl border border-slate-700 object-contain max-h-64" />
                      </a>
                    )}
                    {isPdf && (
                      <a href={p.batch_file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700 hover:border-sky-500/40 transition-colors">
                        <FileText size={20} className="text-sky-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium">{t('pdf_oeffnen')}</p>
                          <p className="text-slate-500 text-xs truncate">{p.batch_file_url.split('/').pop()}</p>
                        </div>
                        <ExternalLink size={14} className="text-slate-500 shrink-0" />
                      </a>
                    )}
                    {!isImage && !isPdf && (
                      <a href={p.batch_file_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sky-400 text-sm hover:underline">
                        <ExternalLink size={14} /> {t('dokument_oeffnen')}
                      </a>
                    )}
                  </div>
                )}

                {/* Notizen */}
                {p.notes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t('notizen_section')}</p>
                    <p className="text-slate-300 text-sm bg-slate-800/60 border border-slate-800 rounded-xl px-4 py-3 whitespace-pre-wrap">{p.notes}</p>
                  </div>
                )}

                {p.pk_profile_id && (
                  <button
                    type="button"
                    onClick={() => {
                      setInfoPeptide(null)
                      navigate(`/simulation?pk=${p.pk_profile_id}`)
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors"
                    style={{
                      color: 'var(--accent)',
                      background: 'var(--accent-weak)',
                      border: '1px solid var(--accent-border)',
                    }}
                  >
                    <Activity size={16} />
                    Blutspiegel simulieren
                  </button>
                )}
              </div>

              <div className="px-5 pb-8 pt-2">
                <button className="btn-secondary w-full" onClick={() => setInfoPeptide(null)}>{t('close')}</button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
