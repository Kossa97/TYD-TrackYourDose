import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type UIEvent as ReactUIEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Minus, Trash2, Pencil, FlaskConical, Activity,
  CalendarDays, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, List,
  TrendingUp, TrendingDown, Search, Bell, Check, SlidersHorizontal,
  Package, FileUp, Droplets, X, FileText, ExternalLink,
  Archive, RefreshCw, Sunrise, Sun, Moon, Clock, AlertTriangle,
  RotateCcw, Flag, Pause, Play, CalendarPlus, type LucideIcon,
} from 'lucide-react'
import { getPeptideColor, getRandomPeptideColor } from '../lib/peptideColors'
import { useNew } from '../lib/useNew'
import { NewDot } from '../components/NewDot'
import { format, parseISO, addDays, differenceInDays } from 'date-fns'
import { effectiveDose, type ScheduleSegment } from '../lib/intakeSchedule'
import { buildDoseAdjustmentBackfillUpdates, type DoseAdjustmentBackfillLog } from '../lib/doseAdjustmentBackfill'
import { PeptideFormModal } from '../components/PeptideFormModal'
import { PeptideVialVisual } from '../components/PeptideVialVisual'
import type { VialStageLightHandle } from '../components/PeptideVialVisual'
import { SloshProvider, useSloshEngine } from '../components/SloshContext'
import { LabLoader } from '../components/LabLoader'
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
  id: string; name: string; default_method: string
  vial_amount_mg: number | null; vial_amount_unit: string | null
  reconstitution_ml: number | null
  syringe_type: string | null; notes: string | null
  vials_in_stock: number | null; vials_initial: number | null
  reconstitution_date: string | null; expiry_days: number | null
  batch_number: string | null; batch_source: string | null; batch_file_url: string | null
  inventory_item_id: string | null
  pk_profile_id: string | null
  archived: boolean
  archived_at: string | null
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

type InfoRow = {
  label: string
  value?: string
  valueNode?: ReactNode
  wide?: boolean
}
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
  | 'active_name'
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
  active_name: 'sort_option_active_name',
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

function sortPeptides(list: Peptide[], sortBy: PeptideSortKey, activeIds: Set<string>): Peptide[] {
  return [...list].sort((a, b) => {
    switch (sortBy) {
      case 'active_name': {
        // Default order: active peptides first (alphabetically), then inactive ones (alphabetically).
        const rank = (p: Peptide) => (activeIds.has(p.id) ? 0 : 1)
        return rank(a) - rank(b) || a.name.localeCompare(b.name)
      }
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
  dose: '', unit: 'mcg',
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
  // Scale into [0, H-4 px]: every single % changes the level proportionally,
  // and at 100 % a tiny 4 px air gap keeps the wave surface visible.
  const fillH   = pct <= 0 ? 4 : Math.max(4, (pct / 100) * (H - 4))
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

// Empty "ghost" vial that adds a new substance when clicked.
function AddVialTile({ onClick, label, active = false, obKey }: { onClick: () => void; label: string; active?: boolean; obKey?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      {...(obKey ? { 'data-ob': obKey } : {})}
      className="group mx-auto flex w-20 flex-col items-center sm:w-24"
    >
      <div className={`flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed ${
        active ? 'border-cyan-400/45 bg-slate-900/40 text-cyan-200' : 'border-slate-600/55 bg-slate-900/25 text-slate-500'
      } transition-colors group-hover:border-cyan-400/45 group-hover:text-cyan-200 group-focus-visible:border-cyan-300/60 sm:h-36`}>
        <span className={`flex h-9 w-9 items-center justify-center rounded-full border text-cyan-200 ${
          active ? 'border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_30px_rgba(34,211,238,0.18)]' : 'border-cyan-300/15 bg-cyan-300/[0.03] shadow-[0_0_22px_rgba(34,211,238,0.08)]'
        } transition-all duration-500 group-hover:border-cyan-300/35 group-hover:bg-cyan-300/10 group-hover:shadow-[0_0_30px_rgba(34,211,238,0.18)] group-focus-visible:border-cyan-300/45 group-focus-visible:bg-cyan-300/10 group-focus-visible:shadow-[0_0_30px_rgba(34,211,238,0.22)]`}>
          <Plus size={18} strokeWidth={1.45} />
        </span>
        <span className="px-2 text-center text-[10px] font-semibold leading-tight">{label}</span>
      </div>
    </button>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────
export function Peptide() {
  const { t, i18n } = useTranslation()
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
  const [loading, setLoading]                 = useState(true)
  const [initialLoad, setInitialLoad]         = useState(true)
  const [loaderFading, setLoaderFading]       = useState(false)
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
  const [searchOpen, setSearchOpen]           = useState(false)
  const [filterOpen, setFilterOpen]           = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [sortBy, setSortBy]                   = useState<PeptideSortKey>('active_name')
  const [viewMode, setViewModeState]          = useState<'vials' | 'list'>(() =>
    localStorage.getItem('tyd_peptide_view') === 'list' ? 'list' : 'vials'
  )
  const [activePeptideId, setActivePeptideId] = useState<string | null>(null)
  const [vialDetailsOpen, setVialDetailsOpen] = useState(false)
  const [isVialCarouselDragging, setIsVialCarouselDragging] = useState(false)
  const [addTileActive, setAddTileActive] = useState(false)
  // Stage light bypasses React entirely: each vial registers an imperative
  // handle and the scroll rAF pushes focus/lightOffset straight into the DOM.
  const vialStageLightHandlesRef = useRef(new Map<number, VialStageLightHandle>())
  const vialFocusFrameRef = useRef<number | null>(null)
  const sloshEngine = useSloshEngine()
  const vialCarouselRef = useRef<HTMLDivElement | null>(null)
  const vialScrollFrameRef = useRef<number | null>(null)
  const vialTargetIndexRef = useRef<number | null>(null)
  const vialDraggingRef = useRef(false)
  const vialDragStartXRef = useRef(0)
  const vialDragLastXRef = useRef(0)
  const vialDragLastTimeRef = useRef(0)
  const vialDragStartScrollLeftRef = useRef(0)
  const vialDragMovedRef = useRef(false)
  const vialSuppressClickRef = useRef(false)
  const vialWheelCooldownRef = useRef<number | null>(null)
  const vialLastScrollLeftRef = useRef(0)
  const vialLastScrollTimeRef = useRef(0)
  const [animationEpoch, setAnimationEpoch] = useState(0)

  // ── Zyklen ────────────────────────────────────────────────────────────────
  const [showCycleForm, setShowCycleForm]         = useState(false)
  const [cycleForPeptide, setCycleForPeptide]     = useState<Peptide | null>(null)
  const [cyclePromptPeptide, setCyclePromptPeptide] = useState<Peptide | null>(null)
  const [cycleManagerPeptide, setCycleManagerPeptide] = useState<Peptide | null>(null)
  // Zyklus-Manager: welche inaktiven Karten / Dosisanpassungs-Sektionen sind aufgeklappt
  const [managerCardOpen, setManagerCardOpen] = useState<Set<string>>(() => new Set())
  const [managerEscOpen, setManagerEscOpen]   = useState<Set<string>>(() => new Set())
  // Substanz entfernen: Archivieren vs. endgültig löschen
  const [deletePromptPeptide, setDeletePromptPeptide] = useState<Peptide | null>(null)
  const [deletePromptFromArchive, setDeletePromptFromArchive] = useState(false)
  const [deletingPeptide, setDeletingPeptide]     = useState(false)
  const [archiveViewOpen, setArchiveViewOpen]     = useState(false)
  const [archivedPeptides, setArchivedPeptides]   = useState<Peptide[]>([])
  const archiveDialogRef = useRef<HTMLDivElement | null>(null)
  const archiveCloseButtonRef = useRef<HTMLButtonElement | null>(null)
  const [editingCycleId, setEditingCycleId]       = useState<string | null>(null)
  const [cForm, setCForm]                         = useState<CycleForm | null>(null)
  const [savingCycle, setSavingCycle]             = useState(false)
  // Beim Bearbeiten eines bestehenden Zyklus: Planänderung rückwirkend oder ab heute?
  const [scheduleChoiceOpen, setScheduleChoiceOpen] = useState(false)

  // ── Dosisanpassungen ──────────────────────────────────────────────────────
  const [escalations, setEscalations]             = useState<Escalation[]>([])
  const [showEscForm, setShowEscForm]             = useState(false)
  const [escForCycle, setEscForCycle]             = useState<Cycle | null>(null)
  const [editingEscId, setEditingEscId]           = useState<string | null>(null)
  const [eForm, setEForm]                         = useState<EscalationForm | null>(null)
  const [savingEsc, setSavingEsc]                 = useState(false)

  useEffect(() => {
    if (!archiveViewOpen) return

    const dialog = archiveDialogRef.current
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    archiveCloseButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      const nestedDialog = document.querySelector<HTMLElement>('[data-archive-delete-confirmation]')
      const focusScope = nestedDialog ?? dialog
      if (e.key === 'Escape') {
        e.preventDefault()
        if (nestedDialog) {
          setDeletePromptFromArchive(false)
          setDeletePromptPeptide(null)
          window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())
        } else {
          setArchiveViewOpen(false)
        }
        return
      }
      if (e.key !== 'Tab') return

      const focusable = Array.from(focusScope?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!focusScope?.contains(document.activeElement)) {
        e.preventDefault()
        const target = e.shiftKey ? last : first
        target.focus()
        return
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [archiveViewOpen])

  // ── Laden ─────────────────────────────────────────────────────────────────
  const loadInventory = async () => {
    const { data } = await supabase.from('inventory_items').select('*').eq('user_id', user!.id).order('name')
    if (data) setInventory(data as InventoryItem[])
  }
  const loadPeptides = async () => {
    const { data } = await supabase.from('peptides').select('*').eq('user_id', user!.id).eq('archived', false).order('name')
    if (data) setPeptides(data as Peptide[])
  }
  const loadArchived = async () => {
    const { data, error } = await supabase.from('peptides')
      .select('*').eq('user_id', user!.id).eq('archived', true)
      .order('archived_at', { ascending: false, nullsFirst: false })
      .order('name')
    if (error) {
      toast.error(t('error'))
      return
    }
    setArchivedPeptides((data as Peptide[]) ?? [])
  }
  const loadCycles = async () => {
    const { data } = await supabase.from('cycles').select('*').eq('user_id', user!.id)
    if (data) setCycles(data as Cycle[])
  }
  const loadEscalations = async () => {
    const { data } = await supabase.from('dose_escalations').select('*').eq('user_id', user!.id).order('start_after_days').order('start_date')
    if (data) setEscalations(data as Escalation[])
  }
  useEffect(() => {
    Promise.all([loadInventory(), loadPeptides(), loadCycles(), loadEscalations()])
      .finally(() => {
        setLoading(false)
        // Fade out the full-screen loader, then unmount it (same as The Lab).
        setLoaderFading(true)
        setTimeout(() => setInitialLoad(false), 500)
      })
  }, [])

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

  const activePeptideIds = useMemo(
    () => new Set(cycles.filter(c => c.active).map(c => c.peptide_id)),
    [cycles],
  )
  const displayPeptides = sortPeptides(
    peptides.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    sortBy,
    activePeptideIds,
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
    setCyclePromptPeptide(null)
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
      default_unit:   'mcg',
      default_dose:   null,
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
    const isNewPeptide = !editingPeptideId
    const { error, data: savedRow } = editingPeptideId
      ? await supabase.from('peptides').update(payload).eq('id', editingPeptideId).select('*').single()
      : await supabase.from('peptides').insert(payload).select('*').single()
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
      if (isNewPeptide && savedRow) setCyclePromptPeptide(savedRow as Peptide)
    }
    setSavingPeptide(false); setShowPeptideForm(false); setBatchFile(null); loadPeptides(); loadInventory()
  }

  const openEditPeptide = (p: Peptide) => {
    setEditingPeptideId(p.id)
    setPForm({
      inventory_item_id: p.inventory_item_id ?? '',
      pk_profile_id:     p.pk_profile_id ?? '',
      name: p.name,
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

  const removePeptide = (id: string) => {
    const p = peptides.find(pp => pp.id === id)
    if (p) {
      setDeletePromptFromArchive(false)
      setDeletePromptPeptide(p)
    }
  }

  // „Behalten": Substanz aus My Stack ausblenden, alle Daten bleiben verknüpft.
  // Aktive Zyklen werden deaktiviert, damit keine Erinnerungen mehr entstehen.
  const archivePeptide = async (p: Peptide) => {
    setDeletingPeptide(true)
    const archivedAt = p.archived_at ?? new Date().toISOString()
    const { error: archiveError } = await supabase.from('peptides')
      .update({ archived: true, archived_at: archivedAt }).eq('id', p.id)
    if (archiveError) {
      toast.error(t('error'))
      setDeletingPeptide(false)
      return
    }
    await supabase.from('cycles').update({ active: false }).eq('peptide_id', p.id).eq('active', true)
    toast.success(t('substanz_archiviert'))
    setDeletePromptFromArchive(false)
    setDeletePromptPeptide(null); setDeletingPeptide(false)
    loadPeptides(); loadCycles()
  }

  // „Endgültig löschen": Substanz + ALLE zugehörigen Daten entfernen.
  // dose_logs / injection_logs / effects stehen auf ON DELETE SET NULL und müssen
  // explizit gelöscht werden, sonst bleiben namenlose Geister-Einträge zurück.
  // cycles, dose_escalations, vials, reviews werden per CASCADE mit entfernt.
  const hardDeletePeptide = async (p: Peptide) => {
    setDeletingPeptide(true)
    await supabase.from('dose_logs').delete().eq('peptide_id', p.id)
    await supabase.from('injection_logs').delete().eq('peptide_id', p.id)
    await supabase.from('effects').delete().eq('peptide_id', p.id)
    await supabase.from('peptides').delete().eq('id', p.id)
    toast.success(t('geloescht'))
    setDeletePromptFromArchive(false)
    setDeletePromptPeptide(null); setDeletingPeptide(false)
    window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())
    loadPeptides(); loadCycles(); loadArchived()
  }

  const restorePeptide = async (p: Peptide) => {
    await supabase.from('peptides').update({ archived: false, archived_at: null }).eq('id', p.id)
    toast.success(t('substanz_wiederhergestellt'))
    loadArchived(); loadPeptides()
  }

  // ── Zyklus-Aktionen ───────────────────────────────────────────────────────
  const openNewCycle = (p: Peptide) => {
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
              setTimeout(() => new Notification(`ðŸ’Š ${cForm.name}`, {
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
  // Zyklus sauber beenden: Enddatum = heute + deaktiviert. Historie bleibt erhalten.
  const endCycle = async (c: Cycle) => {
    if (!confirm(t('zyklus_beenden_confirm'))) return
    await supabase.from('cycles')
      .update({ active: false, end_date: format(new Date(), 'yyyy-MM-dd') })
      .eq('id', c.id)
    toast.success(t('zyklus_beendet'))
    loadCycles()
  }
  const toggleManagerCard = (id: string) => setManagerCardOpen(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleManagerEsc = (id: string) => setManagerEscOpen(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const removeCycle = async (id: string) => {
    if (!confirm(t('zyklus_loeschen'))) return
    await supabase.from('cycles').delete().eq('id', id)
    toast.success(t('geloescht')); loadCycles()
  }

  // ── Dosisanpassungs-Aktionen ──────────────────────────────────────────────
  const openNewEsc = (c: Cycle) => {
    setEscForCycle(c); setEditingEscId(null)
    setEForm(emptyEscalationForm(c.unit)); setShowEscForm(true)
  }
  const openEditEsc = (c: Cycle, e: Escalation) => {
    setEscForCycle(c); setEditingEscId(e.id)
    const startAfterValue = e.start_after_days !== null && e.start_after_days !== undefined
      ? (e.start_type === 'after_weeks' ? e.start_after_days / 7 : e.start_after_days).toString()
      : '2'
    setEForm({
      increase_amount: escalationTargetDose(c, e).toString(), unit: e.unit,
      start_type: e.start_type,
      start_date: e.start_date ?? format(new Date(), 'yyyy-MM-dd'),
      start_after_days: startAfterValue,
      notes: e.notes ?? '',
    })
    setShowEscForm(true)
  }
  const backfillDoseAdjustmentLogs = async (cycle: Cycle, nextEscalations: Escalation[], affectedEscalations: Escalation[]) => {
    let query = supabase
      .from('dose_logs')
      .select('id, peptide_id, logged_at, taken')
      .eq('user_id', user!.id)
      .eq('peptide_id', cycle.peptide_id)
      .gte('logged_at', `${cycle.start_date}T00:00:00.000`)
      .or('taken.is.null,taken.eq.false')

    if (cycle.end_date) query = query.lte('logged_at', `${cycle.end_date}T23:59:59.999`)

    const { data, error } = await query
    if (error) throw error

    const updates = buildDoseAdjustmentBackfillUpdates(
      cycle,
      nextEscalations,
      (data ?? []) as DoseAdjustmentBackfillLog[],
      affectedEscalations,
    )

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('dose_logs')
        .update({ dose: update.dose, unit: update.unit })
        .eq('id', update.id)
        .eq('user_id', user!.id)
      if (updateError) throw updateError
    }

    return updates.length
  }
  const saveEsc = async () => {
    if (!eForm || !escForCycle) return
    if (!eForm.increase_amount) return toast.error(t('erhoeht_erforderlich'))
    setSavingEsc(true)
    const targetDose = parseFloat(eForm.increase_amount)
    if (!Number.isFinite(targetDose)) {
      setSavingEsc(false)
      return toast.error(t('erhoeht_erforderlich'))
    }
    const startAfterDays = eForm.start_type !== 'date'
      ? parseInt(eForm.start_after_days) * (eForm.start_type === 'after_weeks' ? 7 : 1)
      : null
    const draftEsc: Escalation = {
      id: editingEscId ?? '__new_adjustment__',
      cycle_id: escForCycle.id,
      increase_amount: 0,
      unit: eForm.unit,
      start_type: eForm.start_type,
      start_date: eForm.start_type === 'date' ? eForm.start_date : null,
      start_after_days: startAfterDays,
      notes: eForm.notes || null,
    }
    const baseDoseAtStart = doseBeforeAdjustment(escForCycle, draftEsc)
    const payload = {
      user_id: user!.id, cycle_id: escForCycle.id,
      increase_amount: targetDose - baseDoseAtStart,
      unit: eForm.unit, start_type: eForm.start_type,
      start_date: eForm.start_type === 'date' ? eForm.start_date : null,
      start_after_days: startAfterDays,
      notes: eForm.notes || null,
    }
    const previousEscalation = editingEscId
      ? escalations.find(e => e.id === editingEscId) ?? null
      : null
    const changedEscalation: Escalation = {
      id: editingEscId ?? '__new_adjustment__',
      cycle_id: escForCycle.id,
      increase_amount: payload.increase_amount,
      unit: payload.unit,
      start_type: payload.start_type,
      start_date: payload.start_date,
      start_after_days: payload.start_after_days,
      notes: payload.notes,
    }
    const nextEscalations = editingEscId
      ? escalations.map(e => e.id === editingEscId ? changedEscalation : e)
      : [...escalations, changedEscalation]
    const affectedEscalations = previousEscalation
      ? [previousEscalation, changedEscalation]
      : [changedEscalation]

    const { error } = editingEscId
      ? await supabase.from('dose_escalations').update(payload).eq('id', editingEscId)
      : await supabase.from('dose_escalations').insert(payload)
    if (error) toast.error(t('error'))
    else {
      let backfilled = 0
      try {
        backfilled = await backfillDoseAdjustmentLogs(escForCycle, nextEscalations, affectedEscalations)
      } catch {
        toast.error('Dosisanpassung gespeichert, aber offene/verpasste Einnahmen konnten nicht aktualisiert werden.')
      }

      toast.success(editingEscId ? t('inventar_aktualisiert') : t('esc_gespeichert'))
      if (backfilled > 0) {
        toast(`${backfilled} offene/verpasste Einnahme${backfilled === 1 ? '' : 'n'} aktualisiert. Bestaetigte Einnahmen bleiben unveraendert.`)
      }
      setShowEscForm(false); loadEscalations()
    }
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
  const escalationStartDate = (c: Cycle, e: Escalation) => {
    if (e.start_type === 'date' && e.start_date) return parseISO(e.start_date)
    if (e.start_after_days !== null) return addDays(parseISO(c.start_date), e.start_after_days)
    return null
  }
  const escalationIsActive = (c: Cycle, e: Escalation) => {
    const start = escalationStartDate(c, e)
    return start ? start <= new Date() : false
  }
  const sortedEscalationsOf = (cid: string) => {
    const cycle = cycles.find(c => c.id === cid)
    return [...escalationsOf(cid)].sort((a, b) => {
      if (!cycle) return escLabel(a).localeCompare(escLabel(b))
      const aStart = escalationStartDate(cycle, a)?.getTime() ?? Number.MAX_SAFE_INTEGER
      const bStart = escalationStartDate(cycle, b)?.getTime() ?? Number.MAX_SAFE_INTEGER
      return aStart - bStart
    })
  }
  const escalationTargetDose = (c: Cycle, e: Escalation) => {
    const start = escalationStartDate(c, e)
    return start ? effectiveDose(c, start, sortedEscalationsOf(c.id)) : c.dose + e.increase_amount
  }
  const doseBeforeAdjustment = (c: Cycle, e: Escalation) => {
    const start = escalationStartDate(c, e)
    if (!start) return c.dose
    return effectiveDose(c, start, sortedEscalationsOf(c.id).filter(row => row.id !== e.id))
  }
  const doseAdjustmentIcon = (c: Cycle, e: Escalation) => {
    const target = escalationTargetDose(c, e)
    const previous = doseBeforeAdjustment(c, e)
    return target > previous ? TrendingUp : target < previous ? TrendingDown : Minus
  }
  const reminderLabel = (c: Cycle) => {
    if (!c.reminder || c.reminder === 'none') return null
    const labels = c.reminder.split(',').filter(v => v && v !== 'none').map(v => {
      const opt = REMINDER_OPTIONS.find(r => r.value === v)
      return opt ? t(opt.labelKey) : v
    }).filter(Boolean)
    return labels.length > 0 ? labels.join(' · ') : null
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
  useEffect(() => {
    setVialDetailsOpen(false)
  }, [activePeptideId])
  // Focus the search field right after it expands.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])
  const closeSearch = () => { setSearchOpen(false); setSearch('') }
  // On entering the vials view (toggle or page load), always reset to the first
  // peptide and center it, so the leading add tile isn't the centered item.
  useEffect(() => {
    if (viewMode !== 'vials') return
    const first = displayPeptides[0]
    if (!first) return
    setActivePeptideId(first.id)
    setAddTileActive(false)
    requestAnimationFrame(() => {
      const item = vialCarouselRef.current?.querySelector<HTMLElement>('[data-vial-index="0"]')
      item?.scrollIntoView({ block: 'nearest', inline: 'center' })
      updateVialFocus()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, loading])
  const vialSnapClassName = isVialCarouselDragging ? 'snap-none' : 'snap-x snap-mandatory'
  const vialItemSnapClassName = isVialCarouselDragging ? '' : 'snap-center'
  // Feed carousel interaction velocity into the shared liquid physics engine.
  const pushVialSlosh = (velocity: number) => sloshEngine.pushImpulse(velocity)
  const updateVialFocus = () => {
    const carousel = vialCarouselRef.current
    if (!carousel) return

    const center = carousel.scrollLeft + carousel.clientWidth / 2
    const maxDistance = Math.max(1, carousel.clientWidth * 0.48)

    // measure every item first, then write, so layout reads never interleave
    // with the imperative attribute writes below
    const measured: Array<{ handle: VialStageLightHandle; normalized: number }> = []
    for (const item of carousel.querySelectorAll<HTMLElement>('[data-vial-index]')) {
      const index = Number(item.dataset.vialIndex)
      if (!Number.isFinite(index)) continue
      const handle = vialStageLightHandlesRef.current.get(index)
      if (!handle) continue

      const itemCenter = item.offsetLeft + item.offsetWidth / 2
      const distance = itemCenter - center
      measured.push({ handle, normalized: Math.max(-1, Math.min(1, distance / maxDistance)) })
    }

    for (const { handle, normalized } of measured) {
      const focus = Math.max(0.22, 1 - Math.abs(normalized) * 0.78)
      handle.setStageLight(focus, -normalized)
    }
  }
  const scheduleVialFocusUpdate = () => {
    if (vialFocusFrameRef.current !== null) return
    vialFocusFrameRef.current = window.requestAnimationFrame(() => {
      vialFocusFrameRef.current = null
      updateVialFocus()
    })
  }
  const scrollToPeptideIndex = (index: number) => {
    const carousel = vialCarouselRef.current
    const item = carousel?.querySelector<HTMLElement>(`[data-vial-index="${index}"]`)
    item?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    window.requestAnimationFrame(updateVialFocus)
  }
  const selectPeptideIndex = (index: number) => {
    if (!displayPeptides[index]) return
    vialTargetIndexRef.current = index
    setAddTileActive(false)
    scrollToPeptideIndex(index)
  }
  const getClosestVialIndex = (carousel: HTMLDivElement) => {
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

    return closestIndex
  }
  // True when the leading "add substance" tile is the carousel item closest to center.
  const isAddTileClosest = (carousel: HTMLDivElement) => {
    const addEl = carousel.querySelector<HTMLElement>('[data-vial-add]')
    if (!addEl) return false
    const carouselCenter = carousel.scrollLeft + carousel.clientWidth / 2
    const addDistance = Math.abs(addEl.offsetLeft + addEl.offsetWidth / 2 - carouselCenter)
    let closestPeptideDistance = Number.POSITIVE_INFINITY
    for (const item of carousel.querySelectorAll<HTMLElement>('[data-vial-index]')) {
      const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - carouselCenter)
      if (distance < closestPeptideDistance) closestPeptideDistance = distance
    }
    return addDistance < closestPeptideDistance
  }
  const handleVialCarouselScroll = (e: ReactUIEvent<HTMLDivElement>) => {
    const carousel = vialCarouselRef.current
    if (!carousel) return

    const now = e.timeStamp
    if (vialLastScrollTimeRef.current > 0) {
      const delta = carousel.scrollLeft - vialLastScrollLeftRef.current
      const dt = Math.max(16, now - vialLastScrollTimeRef.current)
      if (Math.abs(delta) > 0.5) pushVialSlosh((delta / dt) * 2.6)
    }
    vialLastScrollLeftRef.current = carousel.scrollLeft
    vialLastScrollTimeRef.current = now
    scheduleVialFocusUpdate()

    if (vialScrollFrameRef.current !== null) window.cancelAnimationFrame(vialScrollFrameRef.current)

    vialScrollFrameRef.current = window.requestAnimationFrame(() => {
      const closestIndex = getClosestVialIndex(carousel)
      const next = displayPeptides[closestIndex]
      if (next && next.id !== activePeptideId) setActivePeptideId(next.id)
      if (vialTargetIndexRef.current === closestIndex) {
        vialTargetIndexRef.current = null
      }
      setAddTileActive(isAddTileClosest(carousel))
      vialScrollFrameRef.current = null
    })
  }
  const scrollToClosestVial = () => {
    const carousel = vialCarouselRef.current
    if (!carousel) return

    selectPeptideIndex(getClosestVialIndex(carousel))
  }
  const selectPeptideOffset = (offset: number) => {
    if (displayPeptides.length === 0) return
    const baseIndex = vialTargetIndexRef.current ?? activeIndex
    const nextIndex = (baseIndex + offset + displayPeptides.length) % displayPeptides.length
    pushVialSlosh(offset > 0 ? 1 : -1)
    selectPeptideIndex(nextIndex)
  }
  const handleVialCarouselPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    vialTargetIndexRef.current = null
    if (e.pointerType !== 'mouse' || e.button !== 0) return
    const carousel = vialCarouselRef.current
    if (!carousel) return

    vialDragStartXRef.current = e.clientX
    vialDragLastXRef.current = e.clientX
    vialDragLastTimeRef.current = e.timeStamp
    vialDragStartScrollLeftRef.current = carousel.scrollLeft
    vialLastScrollLeftRef.current = carousel.scrollLeft
    vialLastScrollTimeRef.current = e.timeStamp
    vialDraggingRef.current = true
    vialDragMovedRef.current = false
    setIsVialCarouselDragging(true)
  }
  const handleVialCarouselPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!vialDraggingRef.current) return
    const carousel = vialCarouselRef.current
    if (!carousel) return

    const delta = e.clientX - vialDragStartXRef.current
    const now = e.timeStamp
    const stepDelta = e.clientX - vialDragLastXRef.current
    const dt = Math.max(16, now - vialDragLastTimeRef.current)
    if (Math.abs(delta) > 4) {
      vialDragMovedRef.current = true
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.setPointerCapture(e.pointerId)
      }
    }
    if (Math.abs(stepDelta) > 0.5) pushVialSlosh((-stepDelta / dt) * 2.4)
    vialDragLastXRef.current = e.clientX
    vialDragLastTimeRef.current = now
    carousel.scrollLeft = vialDragStartScrollLeftRef.current - delta
    e.preventDefault()
  }
  const handleVialCarouselPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!vialDraggingRef.current) return
    vialDraggingRef.current = false
    setIsVialCarouselDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    if (vialDragMovedRef.current) {
      vialSuppressClickRef.current = true
      window.setTimeout(() => { vialSuppressClickRef.current = false }, 0)
      scrollToClosestVial()
    }
  }
  const handleVialCarouselWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (displayPeptides.length <= 1 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    e.preventDefault()
    if (vialWheelCooldownRef.current !== null) return

    selectPeptideOffset(e.deltaY > 0 ? 1 : -1)
    vialWheelCooldownRef.current = window.setTimeout(() => {
      vialWheelCooldownRef.current = null
    }, 280)
  }
  const handleVialCarouselItemClick = (index: number) => {
    if (vialSuppressClickRef.current) return
    if (index !== activeIndex) pushVialSlosh(index > activeIndex ? 1 : -1)
    selectPeptideIndex(index)
  }
  const handleVialCarouselItemKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>, index: number) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (index !== activeIndex) pushVialSlosh(index > activeIndex ? 1 : -1)
    selectPeptideIndex(index)
  }

  useEffect(() => {
    return () => {
      if (vialScrollFrameRef.current !== null) window.cancelAnimationFrame(vialScrollFrameRef.current)
      if (vialFocusFrameRef.current !== null) window.cancelAnimationFrame(vialFocusFrameRef.current)
      if (vialWheelCooldownRef.current !== null) window.clearTimeout(vialWheelCooldownRef.current)
    }
  }, [])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Header (single row): Titel · Suche · Ansicht/Filter ─────────── */}
      <div className="relative flex items-center gap-2 mb-4">
        {/* Titel — kollabiert smooth, sobald die Suche geöffnet wird */}
        <div className={`flex min-w-0 items-center gap-2 overflow-hidden transition-all duration-300 ${searchOpen ? 'max-w-0 opacity-0' : 'max-w-[70%] opacity-100'}`}>
          <FlaskConical size={18} className="shrink-0 text-sky-400" />
          <h2 className="whitespace-nowrap font-semibold text-white">{t('meine_peptide')}</h2>
          {peptides.length > 0 && (
            <span className="badge bg-slate-700 text-slate-400">{peptides.length}</span>
          )}
        </div>

        {peptides.length > 0 && (
          <>
            {/* Suchfeld — wächst smooth von rechts in die Zeile */}
            <div className={`relative overflow-hidden transition-[max-width] duration-300 ease-out ${searchOpen ? 'max-w-full flex-1' : 'max-w-0'}`}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                ref={searchInputRef}
                className="input w-full pl-9 text-sm"
                placeholder={t('peptid_suchen')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') closeSearch() }}
              />
            </div>

            {!searchOpen && <div className="flex-1" />}

            {/* Lupe / Schließen */}
            <button
              type="button"
              onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
              aria-label={searchOpen ? t('close') : t('peptid_suchen')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
            >
              {searchOpen ? <X size={18} /> : <Search size={18} />}
            </button>

            {!searchOpen && (
              <button
                type="button"
                onClick={() => { setFilterOpen(false); setArchiveViewOpen(true); loadArchived() }}
                aria-label={t('archiv')}
                title={t('archiv')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
              >
                <Archive size={18} />
              </button>
            )}

            {/* Ansicht + Sortierung (Popover) */}
            {!searchOpen && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setFilterOpen(o => !o)}
                  aria-label={t('sort_aria_label')}
                  aria-expanded={filterOpen}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${
                    filterOpen
                      ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-300'
                      : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-300'
                  }`}
                >
                  <SlidersHorizontal size={18} />
                </button>

                {filterOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setFilterOpen(false)} />
                    <div className="absolute right-0 top-full z-30 mt-2 w-56 space-y-3 rounded-xl border border-slate-800 bg-[var(--surface-raised)] p-3 shadow-2xl">
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-400">Ansicht</p>
                        <div className="flex rounded-xl border border-slate-800 bg-slate-900/70 p-1">
                          <button
                            type="button"
                            onClick={() => setViewMode('vials')}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              viewMode === 'vials' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <FlaskConical size={14} /> Vials
                          </button>
                          <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                              viewMode === 'list' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <List size={14} /> Liste
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1.5 text-xs font-semibold text-slate-400">{t('sort_aria_label')}</p>
                        <select
                          className="select w-full pr-8 text-sm"
                          value={sortBy}
                          aria-label={t('sort_aria_label')}
                          onChange={e => setSortBy(e.target.value as PeptideSortKey)}
                        >
                          <option value="active_name">{t('sort_option_active_name')}</option>
                          {PEPTIDE_SORT_GROUPS.map(group => (
                            <optgroup key={group.labelKey} label={t(group.labelKey)}>
                              {group.options.map(key => (
                                <option key={key} value={key}>{t(SORT_OPTION_LABEL_KEYS[key])}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setFilterOpen(false); setArchiveViewOpen(true); loadArchived() }}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
                      >
                        <Archive size={14} /> {t('archiv')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ MEINE PEPTIDE ════════════════════════════════════════════════════ */}
      <div>
          {initialLoad && <LabLoader fadingOut={loaderFading} />}

          {!loading && peptides.length > 0 && viewMode === 'list' && (
            <button
              type="button"
              data-ob="btn-peptid-anlegen"
              onClick={handleNewPeptide}
              className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
            >
              <Plus size={15} /> {t('neues_peptid_title')}
            </button>
          )}

          {!loading && peptides.length === 0 && (
            <div className="card text-center py-10 text-slate-500">
              <p className="mb-4">{t('keine_peptide')}</p>
              <AddVialTile onClick={handleNewPeptide} label={t('neues_peptid_title')} obKey="btn-peptid-anlegen" />
            </div>
          )}

          {search && displayPeptides.length === 0 && (
            <div className="card text-center py-8 text-slate-500 text-sm">
              {t('kein_peptid_gefunden_msg', { search })}
            </div>
          )}

          {!loading && viewMode === 'vials' && activePeptide && (
            <div className="space-y-4">
              <div className="py-5">
                <div className="mb-2 flex items-center justify-between px-3">
                  <button
                    type="button"
                    onClick={() => selectPeptideOffset(-1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
                    aria-label="Vorheriges Peptid"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  {addTileActive ? <div aria-hidden /> : (() => {
                    const days = expiryDaysLeft(activePeptide)
                    const expiryTone = days === null ? 'border-slate-700 bg-slate-900 text-slate-300' : days > 7 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : days > 0 ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-red-500/30 bg-red-500/10 text-red-300'
                    const expiryLabel = days === null
                      ? t('peptide_form_not_set', { defaultValue: 'Nicht gesetzt' })
                      : days > 0
                        ? `Haltbar: ${days} ${days === 1 ? 'Tag' : 'Tage'}`
                        : t('abgelaufen_warn')
                    const hasActive = cyclesOf(activePeptide.id).some(c => c.active)

                    return (
                      <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5 text-xs">
                        <span className={`rounded-full border px-2.5 py-1 font-semibold ${expiryTone}`}>{expiryLabel}</span>
                        <span className={`rounded-full px-2.5 py-1 font-semibold ${hasActive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                          {hasActive ? t('aktiv_badge') : t('inaktiv_badge')}
                        </span>
                        <span className="rounded-full bg-slate-900 px-2.5 py-1 font-semibold tabular-nums text-slate-500">
                          {activeIndex + 1} / {displayPeptides.length}
                        </span>
                      </div>
                    )
                  })()}
                  <button
                    type="button"
                    onClick={() => selectPeptideOffset(1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-slate-900/80 text-slate-300 transition-colors hover:border-cyan-400/50 hover:text-cyan-300"
                    aria-label="Nächstes Peptid"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className="relative -mx-3">
                  <div
                    data-vial-detail="carousel-spotlight"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-8 top-4 bottom-10 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.20),rgba(34,211,238,0.08)_38%,transparent_72%)] blur-xl"
                  />
                <SloshProvider engine={sloshEngine}>
                <div
                  ref={vialCarouselRef}
                  onScroll={handleVialCarouselScroll}
                  onPointerDown={handleVialCarouselPointerDown}
                  onPointerMove={handleVialCarouselPointerMove}
                  onPointerUp={handleVialCarouselPointerUp}
                  onPointerCancel={handleVialCarouselPointerUp}
                  onWheel={handleVialCarouselWheel}
                  className={`relative z-10 flex ${vialSnapClassName} gap-2 overflow-x-auto pb-2 select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                    isVialCarouselDragging ? 'cursor-grabbing' : 'cursor-grab'
                  }`}
                  style={{
                    paddingInline: 'calc((100% - min(6rem, 25vw)) / 2)',
                    scrollPaddingInline: 'calc((100% - min(6rem, 25vw)) / 2)',
                  }}
                >
                  <div
                    data-vial-add
                    data-vial-add-slot
                    className={`${vialItemSnapClassName} flex items-center min-h-[calc(7rem+3rem)] shrink-0 rounded-2xl px-2 py-2 sm:min-h-[calc(9rem+3rem)] ${
                      isVialCarouselDragging ? 'transition-none' : 'transition-all duration-300'
                    } ${addTileActive ? 'scale-100' : 'scale-90'}`}
                    style={{ width: 'min(6rem, 25vw)' }}
                  >
                    <AddVialTile
                      active={addTileActive}
                      onClick={() => { if (!vialSuppressClickRef.current) handleNewPeptide() }}
                      label={t('neues_peptid_title')}
                    />
                  </div>
                  {displayPeptides.map((p, index) => {
                    const isActive = p.id === activePeptide.id
                    const colorIdx = peptides.findIndex(pp => pp.id === p.id)
                    const peptideColor = peptideColors[p.id] ?? getPeptideColor(colorIdx)
                    const vialPct = Math.round(getVialFillPct(p) ?? 100)

                    return (
                      <div
                        key={p.id}
                        data-vial-index={index}
                        className={`${vialItemSnapClassName} shrink-0 rounded-2xl px-2 py-2 ${
                          isVialCarouselDragging ? 'transition-none' : 'transition-all duration-300'
                        } ${
                          isActive ? 'scale-100' : 'scale-90'
                        }`}
                        style={{ width: 'min(6rem, 25vw)' }}
                        aria-label={p.name}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleVialCarouselItemClick(index)}
                        onKeyDown={e => handleVialCarouselItemKeyDown(e, index)}
                      >
                        <PeptideVialVisual
                          key={animationEpoch}
                          name={p.name}
                          amount={p.vial_amount_mg}
                          unit={p.vial_amount_unit ?? 'mg'}
                          fillPct={vialPct}
                          color={peptideColor}
                          animateOnMount={true}
                          isActive={isActive}
                          size="carousel"
                          stageLightRef={handle => {
                            const handles = vialStageLightHandlesRef.current
                            if (handle) handles.set(index, handle)
                            else handles.delete(index)
                          }}
                        />
                        {isActive && (
                          <p className="mt-1 text-center text-xs font-semibold tabular-nums text-slate-400">
                            {Math.round(vialPct)}%
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                </SloshProvider>
                </div>

                <div className="mt-2 flex gap-2 px-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => handleRekonstitution(activePeptide)}
                    disabled={!activePeptide.inventory_item_id}
                    className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 text-cyan-200 transition-colors hover:border-cyan-400/40 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-600"
                  >
                    <RefreshCw size={14} /> Erneut rekonstitutieren
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditPeptide(activePeptide)}
                    className="flex min-h-10 w-20 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-2 text-slate-200 transition-colors hover:border-sky-400/40 hover:text-sky-300"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removePeptide(activePeptide.id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 transition-colors hover:border-red-400/40 hover:bg-red-500/10"
                    aria-label="Substanz löschen"
                    title="Substanz löschen"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {(() => {
                  const invItem = activePeptide.inventory_item_id ? inventory.find(i => i.id === activePeptide.inventory_item_id) : null
                  const pCycles = cyclesOf(activePeptide.id)
                  const activeCycle = pCycles.find(c => c.active) ?? null
                  const activeEscs = activeCycle ? sortedEscalationsOf(activeCycle.id) : []
                  const currentEscalationId = activeCycle
                    ? activeEscs.filter(e => escalationIsActive(activeCycle, e)).at(-1)?.id ?? null
                    : null
                  const activeDose = activeCycle ? effectiveDose(activeCycle, new Date(), activeEscs) : null
                  const cycleStart = activeCycle ? parseISO(activeCycle.start_date) : null
                  const cycleEnd = activeCycle?.end_date ? parseISO(activeCycle.end_date) : null
                  const cycleDay = cycleStart ? Math.max(1, differenceInDays(new Date(), cycleStart) + 1) : null
                  const cycleTotalDays = cycleStart && cycleEnd ? Math.max(1, differenceInDays(cycleEnd, cycleStart) + 1) : null
                  const cycleDayLabel = cycleDay ? `${cycleDay} / ${cycleTotalDays ?? t('ende_offen')}` : '-'
                  const activeReminder = activeCycle ? reminderLabel(activeCycle) : null
                  const activeIntake = activeCycle ? intakeLabel(activeCycle) : null
                  const activeFrequency = activeCycle
                    ? [freqLabel(activeCycle), activeIntake].filter(Boolean).join(' · ')
                    : null
                  const notSet = 'Nicht gesetzt'
                  const compactInfoRows: InfoRow[] = [
                    { label: 'Peptidname', value: activePeptide.name || notSet, wide: true },
                    { label: 'Wirkstoff/Vial', value: activePeptide.vial_amount_mg ? `${activePeptide.vial_amount_mg} ${activePeptide.vial_amount_unit ?? 'mg'}` : notSet },
                    { label: 'Flüssigkeit', value: activePeptide.reconstitution_ml ? `${activePeptide.reconstitution_ml} mL` : notSet },
                    { label: 'Rekonst.', value: activePeptide.reconstitution_date ? format(parseISO(activePeptide.reconstitution_date), 'dd.MM.yyyy') : notSet },
                    { label: 'Haltbarkeit', value: activePeptide.expiry_days ? `${activePeptide.expiry_days} Tage` : notSet },
                    { label: 'Reserve', value: invItem ? t('vials_vorratig', { n: invItem.vials_count }) : notSet },
                    { label: 'Applikationsart', value: activePeptide.default_method ? t(METHOD_KEYS[activePeptide.default_method] ?? activePeptide.default_method) : notSet },
                    { label: 'Batch', value: activePeptide.batch_number || notSet },
                    { label: 'Quelle', value: activePeptide.batch_source || notSet },
                    {
                      label: 'Analyse-Dokument',
                      wide: true,
                      valueNode: activePeptide.batch_file_url
                        ? (
                          <a className="truncate text-cyan-300 hover:text-cyan-200" href={activePeptide.batch_file_url} target="_blank" rel="noopener noreferrer">
                            {activePeptide.batch_file_url.split('/').pop() || 'Öffnen'}
                          </a>
                        )
                        : <span>{notSet}</span>,
                    },
                    { label: 'Notizen', value: activePeptide.notes || notSet, wide: true },
                  ]
                  const infoRows: InfoRow[] = [
                    { label: 'Peptidname', value: activePeptide.name || notSet },
                    { label: 'Wirkstoff pro Vial', value: activePeptide.vial_amount_mg ? `${activePeptide.vial_amount_mg} ${activePeptide.vial_amount_unit ?? 'mg'}` : notSet },
                    { label: 'Zugefügte Flüssigkeit', value: activePeptide.reconstitution_ml ? `${activePeptide.reconstitution_ml} mL` : notSet },
                    { label: 'Datum Rekonstitution', value: activePeptide.reconstitution_date ? format(parseISO(activePeptide.reconstitution_date), 'dd.MM.yyyy') : notSet },
                    { label: 'Haltbarkeit nach Rekonstitution', value: activePeptide.expiry_days ? `${activePeptide.expiry_days} Tage` : notSet },
                    { label: 'Rohe Vials in Reserve', value: invItem ? t('vials_vorratig', { n: invItem.vials_count }) : notSet },
                    { label: 'Applikationsart', value: activePeptide.default_method ? t(METHOD_KEYS[activePeptide.default_method] ?? activePeptide.default_method) : notSet },
                  ]
                  const moreInfoRows: InfoRow[] = [
                    { label: 'Batch', value: activePeptide.batch_number || notSet },
                    { label: 'Quelle', value: activePeptide.batch_source || notSet },
                    {
                      label: 'Analyse-Dokument',
                      valueNode: activePeptide.batch_file_url
                        ? (
                          <a className="truncate text-cyan-300 hover:text-cyan-200" href={activePeptide.batch_file_url} target="_blank" rel="noopener noreferrer">
                            {activePeptide.batch_file_url.split('/').pop() || 'Öffnen'}
                          </a>
                        )
                        : <span>{notSet}</span>,
                    },
                    { label: 'Notizen', value: activePeptide.notes || notSet },
                  ]

                  return (
                    <>
                    <div className="mx-1 mt-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-950/50">
                      <button
                        type="button"
                        onClick={() => setVialDetailsOpen(open => !open)}
                        aria-expanded={vialDetailsOpen}
                        className="flex w-full items-center justify-center gap-2 px-3 py-3 text-center text-sm font-semibold text-white"
                      >
                        <FileText size={15} className="text-cyan-300" />
                        <span>Info</span>
                        {vialDetailsOpen ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                      </button>
                      {vialDetailsOpen && (
                        <div className="border-t border-slate-800 text-xs">
                          <div className="grid grid-cols-2 gap-2 p-2">
                            {compactInfoRows.map(row => (
                              <div key={row.label} className={`min-h-14 rounded-lg border border-slate-800 bg-slate-900/55 px-2.5 py-2 ${'wide' in row && row.wide ? 'col-span-2' : ''}`}>
                                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</p>
                                <div className="mt-1 truncate text-sm font-semibold text-slate-200">
                                  {'valueNode' in row ? row.valueNode : row.value}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="hidden">
                          {infoRows.map(row => (
                            <div key={row.label} className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-800/70 px-4 py-3 last:border-b-0">
                              <span className="text-slate-300">{row.label}</span>
                              <span className="min-w-0 max-w-[48%] truncate text-right font-medium text-slate-500">
                                {'valueNode' in row ? row.valueNode : row.value}
                              </span>
                            </div>
                          ))}
                          <div className="flex min-h-10 items-center justify-center border-y border-slate-800 bg-slate-950/70 px-4 py-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Weitere Daten</span>
                          </div>
                          {moreInfoRows.map(row => (
                            <div key={row.label} className="flex min-h-12 items-center justify-between gap-3 border-b border-slate-800/70 px-4 py-3 last:border-b-0">
                              <span className="text-slate-300">{row.label}</span>
                              <span className="min-w-0 max-w-[48%] truncate text-right font-medium text-slate-500">
                                {'valueNode' in row ? row.valueNode : row.value}
                              </span>
                            </div>
                          ))}
                          </div>
                          <div className="hidden">
                          <div className="bg-slate-950/80 px-3 py-2">
                            <p className="text-slate-500">Wirkstoff</p>
                            <p className="font-semibold text-white">{activePeptide.vial_amount_mg ? `${activePeptide.vial_amount_mg} ${activePeptide.vial_amount_unit ?? 'mg'}/Vial` : '-'}</p>
                          </div>
                          <div className="bg-slate-950/80 px-3 py-2">
                            <p className="text-slate-500">Flüssigkeit</p>
                            <p className="font-semibold text-white">{activePeptide.reconstitution_ml ? `${activePeptide.reconstitution_ml} ml` : '-'}</p>
                          </div>
                          <div className="bg-slate-950/80 px-3 py-2">
                            <p className="text-slate-500">Rekonst.</p>
                            <p className="font-semibold text-white">{activePeptide.reconstitution_date ? format(parseISO(activePeptide.reconstitution_date), 'dd.MM.yyyy') : '-'}</p>
                          </div>
                          <div className="bg-slate-950/80 px-3 py-2">
                            <p className="text-slate-500">Methode</p>
                            <p className="font-semibold text-white">{t(METHOD_KEYS[activePeptide.default_method] ?? activePeptide.default_method)}</p>
                          </div>
                          <div className="bg-slate-950/80 px-3 py-2">
                            <p className="text-slate-500">Vorrat</p>
                            <p className="font-semibold text-white">{invItem ? t('vials_vorratig', { n: invItem.vials_count }) : '-'}</p>
                          </div>
                        </div>
                        </div>
                      )}
                    </div>

                    <div className="mx-1 mt-2 rounded-xl border border-violet-500/20 bg-slate-950/55 p-3 text-xs">
                            {activeCycle ? (
                            <>
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-300">
                                  <Activity size={14} /> {t('aktiver_zyklus')}
                                </p>
                                <p className="mt-1 truncate text-base font-bold text-white">{activeCycle.name}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setCycleManagerPeptide(activePeptide)}
                                  className="flex min-h-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/70 px-3 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                                >
                                  {t('verwalten')}
                                </button>
                              </div>
                            </div>

                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                                    <p className="text-slate-500">{t('tag')}</p>
                                    <p className="font-semibold text-white">
                                      {cycleDayLabel}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                                    <p className="text-slate-500">{t('aktuelle_dosis')}</p>
                                    <p className="font-semibold text-white">{activeDose} {activeCycle.unit}</p>
                                  </div>
                                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                                    <p className="text-slate-500">{t('frequenz')}</p>
                                    <p className="font-semibold text-white">{activeFrequency}</p>
                                  </div>
                                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                                    <p className="text-slate-500">{t('methode')}</p>
                                    <p className="font-semibold text-white">{t(METHOD_KEYS[activeCycle.method] ?? activeCycle.method)}</p>
                                  </div>
                                  <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                                    <p className="text-slate-500">{t('reminder')}</p>
                                    <p className="font-semibold text-white">{activeReminder ?? '-'}</p>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-2">
                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold text-orange-300">
                                      <SlidersHorizontal size={13} /> {t('dosiserhoehungen')}
                                    </p>
                                  </div>
                                  <div className="relative space-y-1.5 pl-8">
                                    <div className="absolute bottom-5 left-3 top-5 w-px bg-slate-700/70" />
                                    <div className={`relative flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${currentEscalationId ? 'border-slate-800 bg-slate-950/70 text-slate-300' : 'border-orange-500/50 bg-orange-500/15 text-orange-100 shadow-[0_0_0_1px_rgba(249,115,22,0.14)]'}`}>
                                      <span className={`absolute -left-8 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 ${currentEscalationId ? 'border-slate-500 bg-slate-900 text-slate-300' : 'border-orange-400 bg-orange-500/20 text-orange-200 ring-4 ring-orange-500/15'}`}>
                                        {currentEscalationId ? <Check size={13} /> : <span className="h-2.5 w-2.5 rounded-full bg-orange-300" />}
                                      </span>
                                      <span className="min-w-0 truncate">{t('basis')}</span>
                                      <span className="shrink-0 font-semibold text-white">{activeCycle.dose} {activeCycle.unit}</span>
                                      {!currentEscalationId && (
                                        <span className="shrink-0 rounded-md border border-orange-400/40 bg-orange-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-200">
                                          {t('aktuell')}
                                        </span>
                                      )}
                                    </div>
                                    {activeEscs.length === 0 && (
                                      <p className="px-1 py-1 text-xs italic text-slate-500">{t('keine_dosiserhoehungen')}</p>
                                    )}
                                    {activeEscs.map(e => {
                                      const isCurrent = e.id === currentEscalationId
                                      const isPast = escalationIsActive(activeCycle, e) && !isCurrent
                                      const targetDose = escalationTargetDose(activeCycle, e)
                                      const AdjustmentIcon = doseAdjustmentIcon(activeCycle, e)
                                      return (
                                        <div key={e.id} className={`relative flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${isCurrent ? 'border-orange-500/50 bg-orange-500/15 text-orange-100 shadow-[0_0_0_1px_rgba(249,115,22,0.16)]' : 'border-slate-800 bg-slate-950/70 text-slate-300'}`}>
                                          <span className={`absolute -left-8 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border-2 ${isCurrent ? 'border-orange-400 bg-orange-500/25 text-orange-100 ring-4 ring-orange-500/15' : isPast ? 'border-slate-500 bg-slate-900 text-slate-300' : 'border-slate-600 bg-slate-950 text-slate-500'}`}>
                                            {isCurrent ? <span className="h-2.5 w-2.5 rounded-full bg-orange-300" /> : isPast ? <Check size={13} /> : <span className="h-2.5 w-2.5 rounded-full border border-slate-500" />}
                                          </span>
                                          <span className="min-w-0 truncate">{escLabel(e)}</span>
                                          <span className="flex shrink-0 items-center gap-1 font-semibold">
                                            <AdjustmentIcon size={13} /> {targetDose} {e.unit}
                                          </span>
                                          {isCurrent ? (
                                            <span className="shrink-0 rounded-md border border-orange-400/40 bg-orange-500/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-orange-200">
                                              Aktuell
                                            </span>
                                          ) : (
                                            <span className="shrink-0 text-slate-500">
                                              {isPast ? <Check size={15} /> : <Clock size={15} />}
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                  <div className="mt-2 flex justify-center">
                                    <button
                                      data-ob="btn-esc-add"
                                      className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 text-xs font-semibold text-orange-300 transition-colors hover:border-orange-400/50 hover:bg-orange-500/15 hover:text-orange-200"
                                      onClick={() => openNewEsc(activeCycle)}
                                    >
                                      <Plus size={12} /> {t('esc_hinzufuegen')}
                                    </button>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => navigate('/kalender')}
                                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-violet-400"
                                >
                                  <CalendarDays size={15} /> {t('dosis_im_kalender_loggen')}
                                </button>
                              </div>
                            </>
                            ) : pCycles.length > 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/25 p-5 text-center">
                                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-500/12 text-slate-300">
                                  <Pause size={20} />
                                </div>
                                <p className="text-sm font-semibold text-white">{t('kein_aktiver_zyklus')}</p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {pCycles.length === 1 ? t('zyklus_count_one') : t('zyklus_count_many', { n: pCycles.length })} · {t('keiner_aktiv')}
                                </p>
                                <div className="mt-3.5 flex flex-wrap justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setCycleManagerPeptide(activePeptide)}
                                    className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/15 px-3.5 text-xs font-semibold text-violet-300 transition-colors hover:border-violet-400/50 hover:bg-violet-500/25"
                                  >
                                    <SlidersHorizontal size={14} /> {t('verwalten')}
                                  </button>
                                  <button
                                    data-ob="btn-zyklus-add"
                                    type="button"
                                    onClick={() => { openNewCycle(activePeptide); dismissZyklusBtn() }}
                                    className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-3.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                                  >
                                    <Plus size={14} /> {t('neuer_zyklus')}
                                    {zyklusBtnNew && <NewDot />}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl border border-dashed border-violet-500/25 bg-violet-500/[0.04] p-5 text-center">
                                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-violet-500/15 text-violet-300">
                                  <CalendarPlus size={20} />
                                </div>
                                <p className="text-sm font-semibold text-white">{t('noch_kein_zyklus')}</p>
                                <p className="mt-1 text-xs text-slate-400">{t('noch_kein_zyklus_desc')}</p>
                                <button
                                  data-ob="btn-zyklus-add"
                                  type="button"
                                  onClick={() => { openNewCycle(activePeptide); dismissZyklusBtn() }}
                                  className="mt-3.5 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-violet-500 px-4 text-xs font-bold text-white transition-colors hover:bg-violet-400"
                                >
                                  <Plus size={14} /> {t('zyklus_hinzufuegen')}
                                  {zyklusBtnNew && <NewDot />}
                                </button>
                              </div>
                            )}
                    </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* ── Peptid-Liste ────────────────────────────────────────────── */}
          <div className={`space-y-3 ${!loading && viewMode === 'list' ? '' : 'hidden'}`}>
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

                            {/* Dosisanpassungen */}
                            <div className="border-t border-slate-800/60 px-3 pb-3 pt-2">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                  <SlidersHorizontal size={12} className="text-orange-400" /> {t('dosiserhoehungen')}
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
                                {pEscs.map((e, idx) => {
                                  const AdjustmentIcon = doseAdjustmentIcon(c, e)
                                  return (
                                    <div key={e.id} className="flex items-center justify-between gap-2 bg-orange-500/5 border border-orange-500/20 rounded-lg px-3 py-1.5">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-orange-400 text-xs font-bold shrink-0">#{idx + 1}</span>
                                        <div className="min-w-0">
                                          <span className="inline-flex items-center gap-1 text-white text-xs font-medium">
                                            <AdjustmentIcon size={11} /> {escalationTargetDose(c, e)} {e.unit}
                                          </span>
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
                                  )
                                })}
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

      {/* ZYKLUS-MANAGER */}
      {cycleManagerPeptide && (() => {
        const managerCycles = cyclesOf(cycleManagerPeptide.id)
        const activeCycles = managerCycles.filter(c => c.active)
        const inactiveCycles = managerCycles.filter(c => !c.active)

        const cycleIcons = (c: Cycle) => (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => { openEditCycle(cycleManagerPeptide, c); setCycleManagerPeptide(null) }}
              aria-label={t('bearbeiten')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 transition-colors hover:border-sky-500/40 hover:text-sky-300"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => removeCycle(c.id)}
              aria-label={t('loeschen')}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/5 text-red-300 transition-colors hover:border-red-400/45 hover:bg-red-500/10"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )

        const cycleMeta = (c: Cycle) => (
          <>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
              <span className="font-semibold text-slate-200">{c.dose} {c.unit}</span>
              <span>{freqLabel(c)}</span>
              <span>{t(METHOD_KEYS[c.method] ?? c.method)}</span>
              <span>{t('ab_datum', { date: format(parseISO(c.start_date), 'dd.MM.yyyy') })}</span>
              {c.end_date ? (
                <span>{t('bis_datum', { date: format(parseISO(c.end_date), 'dd.MM.yyyy') })}</span>
              ) : (
                <span>{t('ende_offen')}</span>
              )}
            </div>
            {(() => {
              const intake = intakeLabel(c)
              const reminder = reminderLabel(c)
              return intake || reminder ? (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  {intake && <span className="text-amber-300">{intake}</span>}
                  {reminder && <span className="text-sky-300">{reminder}</span>}
                </div>
              ) : null
            })()}
          </>
        )

        const cycleActions = (c: Cycle, isEnded: boolean) => (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => toggleCycleActive(c)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${c.active ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-400/50 hover:bg-red-500/15' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/50 hover:bg-emerald-500/15'}`}
            >
              {c.active ? <><Pause size={13} /> {t('deaktivieren')}</> : <><Play size={13} /> {t('aktivieren')}</>}
            </button>
            {!isEnded && (
              <button
                type="button"
                onClick={() => endCycle(c)}
                className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 text-xs font-semibold text-violet-200 transition-colors hover:border-violet-400/50 hover:bg-violet-500/20"
              >
                <Flag size={13} /> {t('beenden')}
              </button>
            )}
          </div>
        )

        const cycleEsc = (c: Cycle) => {
          const pEscs = escalationsOf(c.id)
          const open = managerEscOpen.has(c.id)
          return (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => toggleManagerEsc(c.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-xs text-slate-300 transition-colors hover:border-slate-700"
              >
                <SlidersHorizontal size={13} className="text-orange-300" /> {t('dosiserhoehungen')}
                <span className={`ml-auto font-semibold ${pEscs.length > 0 ? 'text-orange-300' : 'text-slate-500'}`}>
                  {pEscs.length > 0 ? (pEscs.length === 1 ? t('stufe_count_one') : t('stufe_count_many', { n: pEscs.length })) : t('keine')}
                </span>
                {open ? <ChevronUp size={15} className="text-slate-500" /> : <ChevronDown size={15} className="text-slate-500" />}
              </button>
              {open && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-xs">
                    <span className="min-w-0 truncate text-orange-100">{t('basis')}</span>
                    <span className="shrink-0 font-semibold text-white">{c.dose} {c.unit}</span>
                  </div>
                  {pEscs.map((e, idx) => {
                    const AdjustmentIcon = doseAdjustmentIcon(c, e)
                    return (
                      <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                        <div className="min-w-0 text-xs">
                          <p className="flex items-center gap-1 truncate font-semibold text-white">
                            <AdjustmentIcon size={12} /> #{idx + 1} {escalationTargetDose(c, e)} {e.unit}
                          </p>
                          <p className="truncate text-slate-400">{escLabel(e)}</p>
                          {e.notes && <p className="truncate text-slate-500">{e.notes}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => { openEditEsc(c, e); setCycleManagerPeptide(null) }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-sky-300"
                            aria-label={t('dosisanpassung_bearbeiten')}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeEsc(e.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
                            aria-label={t('dosisanpassung_loeschen')}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  <button
                    type="button"
                    data-ob="btn-esc-add"
                    onClick={() => { openNewEsc(c); setCycleManagerPeptide(null) }}
                    className="flex min-h-9 w-full items-center justify-center gap-1 rounded-lg border border-orange-500/25 bg-orange-500/10 px-2.5 text-xs font-semibold text-orange-300 transition-colors hover:border-orange-400/45 hover:bg-orange-500/15"
                  >
                    <Plus size={11} /> {t('esc_hinzufuegen')}
                  </button>
                </div>
              )}
            </div>
          )
        }

        const renderActiveCard = (c: Cycle) => {
          const isEnded = c.end_date ? parseISO(c.end_date).getTime() < Date.now() : false
          return (
            <div key={c.id} className="rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-white">{c.name}</p>
                    <span className="shrink-0 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">{t('aktiv_badge')}</span>
                  </div>
                  {cycleMeta(c)}
                </div>
                {cycleIcons(c)}
              </div>
              {cycleActions(c, isEnded)}
              {cycleEsc(c)}
            </div>
          )
        }

        const renderInactiveCard = (c: Cycle) => {
          const isEnded = c.end_date ? parseISO(c.end_date).getTime() < Date.now() : false
          const open = managerCardOpen.has(c.id)
          const statusLabel = isEnded ? t('beendet') : t('inaktiv_badge')
          return (
            <div key={c.id} className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/35">
              <button
                type="button"
                onClick={() => toggleManagerCard(c.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-2.5 p-3 text-left"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-slate-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold text-white">{c.name}</p>
                    <span className="shrink-0 rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">{statusLabel}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {c.dose} {c.unit}{c.end_date ? ` · ${t('bis_datum', { date: format(parseISO(c.end_date), 'dd.MM.yyyy') })}` : ''}
                  </p>
                </div>
                {open ? <ChevronUp size={16} className="shrink-0 text-slate-500" /> : <ChevronDown size={16} className="shrink-0 text-slate-500" />}
              </button>
              {open && (
                <div className="border-t border-slate-800/70 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">{cycleMeta(c)}</div>
                    {cycleIcons(c)}
                  </div>
                  {cycleActions(c, isEnded)}
                  {cycleEsc(c)}
                </div>
              )}
            </div>
          )
        }

        return (
          <div className="fixed inset-0 z-50 flex justify-center bg-slate-950" data-app-modal>
            <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-slate-950">
              <div className="shrink-0 border-b border-slate-800 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">{t('zyklen_verwalten')}</p>
                    <h2 className="mt-1 truncate text-lg font-bold text-white">{cycleManagerPeptide.name}</h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {managerCycles.length === 1 ? t('zyklus_count_one') : t('zyklus_count_many', { n: managerCycles.length })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCycleManagerPeptide(null)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                    aria-label={t('close')}
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  data-ob="btn-zyklus-add"
                  onClick={() => {
                    openNewCycle(cycleManagerPeptide)
                    dismissZyklusBtn()
                    setCycleManagerPeptide(null)
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/15 px-4 text-sm font-bold text-violet-200 transition-colors hover:border-violet-400/50 hover:bg-violet-500/25"
                >
                  <Plus size={16} /> {t('neuer_zyklus')}
                </button>

                {managerCycles.length === 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                    <p className="text-sm font-semibold text-white">{t('noch_kein_zyklus')}</p>
                    <p className="mt-1 text-xs text-slate-500">{t('noch_kein_zyklus_desc')}</p>
                  </div>
                )}

                {activeCycles.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
                      <Play size={12} /> {t('aktiv_badge')}
                    </p>
                    {activeCycles.map(renderActiveCard)}
                  </div>
                )}

                {inactiveCycles.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <Flag size={12} /> {t('beendet_inaktiv')}
                    </p>
                    {inactiveCycles.map(renderInactiveCard)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* PEPTID-FORMULAR */}
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

      {/* ══ SUBSTANZ ENTFERNEN: ARCHIVIEREN vs. ENDGÜLTIG LÖSCHEN ═══════════════ */}
      {deletePromptPeptide && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10"
          data-app-modal
          data-archive-delete-confirmation={deletePromptFromArchive ? '' : undefined}
          onClick={() => {
            if (deletingPeptide) return
            setDeletePromptFromArchive(false)
            setDeletePromptPeptide(null)
            window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-peptide-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-300">
                <AlertTriangle size={20} />
              </span>
              <div className="min-w-0">
                <h2 id="delete-peptide-title" className="text-lg font-bold text-white">{t('substanz_entfernen_title')}</h2>
                <p className="mt-0.5 truncate text-sm text-slate-400">{deletePromptPeptide.name}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {!deletePromptFromArchive && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-cyan-300">
                    <Archive size={15} /> {t('archivieren_behalten')}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{t('archivieren_behalten_desc')}</p>
                </div>
              )}
              <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-300">
                  <Trash2 size={15} /> {t('endgueltig_loeschen')}
                </p>
                <p className="mt-1 text-xs text-slate-400">{t('endgueltig_loeschen_desc')}</p>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {!deletePromptFromArchive && (
                <button
                  type="button"
                  onClick={() => archivePeptide(deletePromptPeptide)}
                  disabled={deletingPeptide}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-4 text-sm font-bold text-cyan-200 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/25 disabled:opacity-50"
                >
                  <Archive size={16} /> {t('archivieren_behalten')}
                </button>
              )}
              <button
                type="button"
                autoFocus={deletePromptFromArchive}
                onClick={() => hardDeletePeptide(deletePromptPeptide)}
                disabled={deletingPeptide}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 text-sm font-bold text-red-200 transition-colors hover:border-red-400/60 hover:bg-red-500/25 disabled:opacity-50"
              >
                <Trash2 size={16} /> {t('endgueltig_loeschen')}
              </button>
              <button
                type="button"
                onClick={() => { setDeletePromptFromArchive(false); setDeletePromptPeptide(null); window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus()) }}
                disabled={deletingPeptide}
                className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-white disabled:opacity-50"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ARCHIV ══════════════════════════════════════════════════════════════ */}
      {archiveViewOpen && (
        <div
          ref={archiveDialogRef}
          data-archive-fullscreen
          className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-slate-950"
          data-app-modal
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-title"
        >
          <header className="shrink-0 border-b border-slate-800 bg-slate-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center justify-between gap-3 px-4">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Archive size={13} /> {t('archiv')}
                </p>
                <h2 id="archive-title" className="mt-1 truncate text-lg font-bold text-white">{t('archiv_title')}</h2>
              </div>
              <button
                type="button"
                ref={archiveCloseButtonRef}
                onClick={() => setArchiveViewOpen(false)}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 transition-colors hover:border-slate-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                aria-label={t('close')}
                title={t('close')}
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3">
              {archivedPeptides.length === 0 && (
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/50 p-6 text-center">
                  <Archive size={22} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-sm font-semibold text-white">{t('archiv_leer')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('archiv_leer_desc')}</p>
                </div>
              )}

              {archivedPeptides.length > 0 && (
                <div className="divide-y divide-slate-800/80 border-y border-slate-800/80">
                  {archivedPeptides.map(p => {
                    const archivedDate = p.archived_at
                      ? new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language).format(new Date(p.archived_at))
                      : ''

                    return (
                      <div key={p.id} data-archive-row className="flex min-h-28 items-center gap-3 py-3">
                        <div className="flex w-16 shrink-0 justify-center opacity-75" aria-hidden="true">
                          <PeptideVialVisual
                            name={p.name}
                            amount={p.vial_amount_mg}
                            unit={p.vial_amount_unit ?? 'mg'}
                            fillPct={0}
                            color="#64748b"
                            animateOnMount={false}
                            isActive={false}
                            size="compact"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white">{p.name}</p>
                          {p.archived_at && (
                            <p className="mt-1 text-xs text-slate-500">
                              {t('archiviert_am', { date: archivedDate })}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 gap-1.5">
                          <button
                            type="button"
                            onClick={() => restorePeptide(p)}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                            aria-label={t('wiederherstellen')}
                            title={t('wiederherstellen')}
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setDeletePromptFromArchive(true); setDeletePromptPeptide(p) }}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 text-red-300 transition-colors hover:border-red-400/45 hover:bg-red-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                            aria-label={t('endgueltig_loeschen')}
                            title={t('endgueltig_loeschen')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {cyclePromptPeptide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-10"
          data-app-modal
          onClick={() => setCyclePromptPeptide(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                <Check size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-white">Substanz gespeichert</p>
                <p className="mt-1 text-sm leading-5 text-slate-400">
                  Möchtest du direkt einen Zyklus für <span className="font-semibold text-slate-200">{cyclePromptPeptide.name}</span> anlegen?
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800"
                onClick={() => setCyclePromptPeptide(null)}
              >
                Später
              </button>
              <button
                type="button"
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 text-sm font-bold text-white transition-colors hover:bg-violet-400"
                onClick={() => {
                  const peptide = cyclePromptPeptide
                  setCyclePromptPeptide(null)
                  openNewCycle(peptide)
                }}
              >
                <CalendarDays size={16} /> Zyklus anlegen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ ZYKLUS-FORMULAR ══════════════════════════════════════════════════ */}
      {showCycleForm && cForm && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950 sm:items-end sm:bg-black/80" data-app-modal
          onClick={() => setShowCycleForm(false)}>
          <div className="flex h-full w-full flex-col overflow-hidden bg-slate-900 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-t-2xl"
            onClick={e => e.stopPropagation()}>

            <div className="shrink-0 border-b border-slate-800 px-6 pb-4 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:pt-6">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-violet-400" />
                <h2 className="text-lg font-bold">{editingCycleId ? t('zyklus_bearbeiten') : t('neuer_zyklus_title')}</h2>
              </div>
              {cycleForPeptide && <p className="text-sky-400 text-sm mt-0.5 ml-6">{cycleForPeptide.name}</p>}
            </div>

            <div data-ob="cycle-core" className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
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

            <div className="flex shrink-0 gap-3 border-t border-slate-800 bg-slate-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <button className="btn-secondary flex-1" onClick={() => setShowCycleForm(false)}>{t('cancel')}</button>
              <button data-ob="btn-cycle-save" className="btn-primary flex-1" onClick={saveCycle} disabled={savingCycle}>
                {savingCycle ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOSISANPASSUNG-FORMULAR */}
      {showEscForm && eForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-end justify-center" data-app-modal
          onClick={() => setShowEscForm(false)}>
          <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}>

            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-orange-400" />
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
                  <div className="grid grid-cols-1 gap-2">
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
