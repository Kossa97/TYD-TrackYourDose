import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type UIEvent as ReactUIEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import {
  Plus, Minus, Trash2, Pencil, FlaskConical, Activity,
  CalendarDays, CalendarRange, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, List,
  TrendingUp, TrendingDown, Search, Bell, SlidersHorizontal,
  Package, FileUp, Droplets, X, FileText, ExternalLink,
  Archive, Info, RefreshCw, Sunrise, Sun, Moon, Clock, AlertTriangle,
  RotateCcw, Flag, Pause, Play, CalendarPlus, type LucideIcon,
} from 'lucide-react'
import { useNew } from '../../lib/useNew'
import { NewDot } from '../../components/NewDot'
import { format, isValid, parseISO, addDays, differenceInDays } from 'date-fns'
import { effectiveQuantity, scheduleForDay, type ScheduleSegment } from '../../lib/intakeSchedule'
import { buildDoseAdjustmentBackfillUpdates, type DoseAdjustmentBackfillLog } from '../../lib/doseAdjustmentBackfill'
import type { VialStageLightHandle } from '../../components/PeptideVialVisual'
import { SloshProvider, useSloshEngine } from '../../components/SloshContext'
import { LabLoader } from '../../components/LabLoader'
import { StackItemWizard } from './components/StackItemWizard'
import { StageDetailSheet } from './components/StageDetailSheet'
import { hapticTick } from '../../lib/haptics'
import {
  detailAbschnitte, produktTitel, wirkstoffBezug, zeigtFeld,
  type DetailFeld,
} from './lib/stackDetailSections'
import { produktAngaben, type Angabe, type Zutat } from './lib/produktAngaben'
import { StageFit } from './components/StageFit'
import { StackStage } from './components/StackStage'
import { StackArchive } from './components/StackArchive'
import { archiveStackItem, deleteStackItem, loadStackItems, reconstituteStackItem, removePlanSegment, restoreStackItem, savePlanChange, saveStackItemSetup, saveVialTracking, type LoadedStackItem, type LoadedStackItemIngredient } from './services/stackItems'
import { searchSubstanceCatalog } from './services/substanceCatalog'
import type { IntakePlanDraft, IntakeSlotDraft, RoutineGroup, StackItem, StackItemSetupDraft, SubstanceCatalogEntry, TrackingLevel } from './types'
import { getDosageForm, isStageRenderable } from './lib/dosageForms'
import type { WizardSaveMode } from './lib/wizardState'
import { rhythmFromStorage } from './lib/intakeRhythm'
import { STACK_TABS, filterByTab, tabCounts, type StackTabKey } from './lib/stackTabs'
import { sortAbilities, type SortAbility } from './lib/stackSort'
import { planSegments, stufenText } from './lib/planSegments'
import { getRandomStackItemColor, getStableStackItemColor } from './lib/colors'
import { isLocalColorMigrationComplete, migrateLocalColors } from './lib/colorMigration'
import { backfillMessageKey, buildTitrationStep, dosePlanCapabilities, dosePlanQuantitiesForDay } from './lib/dosePlan'
import { DoseUnitControl } from './components/DoseUnitControl'
import { VialTrackingEditor, emptyVialTrackingDraft, type PkProfileOption, type VialTrackingDraft } from './extensions/peptide/VialTrackingEditor'
import { FEATURES } from '../../config/features'
import { PlanManagementSection } from './components/PlanManagementSection'
import {
  endCycle as endTimelineCycle,
  loadCycleTimelines,
  pauseCycle,
  removeFuturePlanVersion,
  restartCycle,
  resumeCycle,
  setPauseEnd,
} from './services/planLifecycle'
import {
  localDateTimeKey,
  resolveCycleAt,
  type CyclePlanVersion,
  type CycleTimeline,
  type PlanChangeKind,
  type PlanScheduleSnapshot,
} from '../../lib/planTimeline'
import type { PlanChangeSubmission, PlanEditContext } from './lib/wizardState'

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
interface Peptide extends StackItem {
  name: string; default_method: string
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
  id: string; stack_item_id: string; name: string
  dose: number | null; unit: string | null; method: string
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
const METHOD_KEYS: Record<string,string> = {
  'Subkutan':'method_subkutan','Intramuskulär':'method_intramusk','Nasal':'method_nasal',
  'Oral':'method_oral','Transdermal':'method_transdermal','Intravenös':'method_intravenoese','Andere':'method_andere',
}
const EXPIRY_PRESETS = [10, 14, 21, 28, 42, 90]

type PeptideSortKey =
  | 'active_name'
  | 'created_desc' | 'created_asc'
  | 'name_asc' | 'name_desc'
  | 'expiry_asc' | 'expiry_desc'
  | 'fill_asc' | 'fill_desc'
  | 'recon_asc' | 'recon_desc'
  | 'stock_asc' | 'stock_desc'

// Jede Gruppe sagt, welche Angabe sie braucht. Fehlt sie im offenen Reiter,
// wird die Gruppe nicht angeboten — eine Sortierung, die nichts bewegt, sieht
// aus wie ein Fehler.
const PEPTIDE_SORT_GROUPS: { labelKey: string; options: PeptideSortKey[]; needs?: SortAbility }[] = [
  { labelKey: 'my_stack_sort_group_created', options: ['created_desc', 'created_asc'] },
  { labelKey: 'sort_group_name', options: ['name_asc', 'name_desc'] },
  { labelKey: 'sort_group_expiry', options: ['expiry_asc', 'expiry_desc'], needs: 'expiry' },
  { labelKey: 'sort_group_fill', options: ['fill_asc', 'fill_desc'], needs: 'fill' },
  { labelKey: 'sort_group_recon', options: ['recon_asc', 'recon_desc'], needs: 'recon' },
  { labelKey: 'sort_group_stock', options: ['stock_asc', 'stock_desc'], needs: 'stock' },
]

const SORT_OPTION_LABEL_KEYS: Record<PeptideSortKey, string> = {
  active_name: 'sort_option_active_name',
  created_desc: 'my_stack_sort_created_desc',
  created_asc: 'my_stack_sort_created_asc',
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

function asPeptide(item: LoadedStackItem): Peptide {
  const legacy = item as LoadedStackItem & Partial<Peptide>
  return {
    ...legacy,
    name: item.display_name,
    default_method: legacy.default_method ?? 'Andere',
    vial_amount_mg: legacy.vial_amount_mg ?? null,
    vial_amount_unit: legacy.vial_amount_unit ?? null,
    reconstitution_ml: legacy.reconstitution_ml ?? null,
    syringe_type: legacy.syringe_type ?? null,
    vials_in_stock: legacy.vials_in_stock ?? null,
    vials_initial: legacy.vials_initial ?? null,
    reconstitution_date: legacy.reconstitution_date ?? null,
    expiry_days: legacy.expiry_days ?? null,
    batch_number: legacy.batch_number ?? null,
    batch_source: legacy.batch_source ?? null,
    batch_file_url: legacy.batch_file_url ?? null,
    inventory_item_id: legacy.inventory_item_id ?? null,
    pk_profile_id: legacy.pk_profile_id ?? null,
  }
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
      // `created_at` kann bei alten Zeilen fehlen — dann hinten einsortieren,
      // statt die ganze Liste durcheinanderzubringen.
      case 'created_desc': return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      case 'created_asc': return (a.created_at ?? '').localeCompare(b.created_at ?? '')
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
const FREQ_KEYS: Record<string,string> = {
  'Täglich':'freq_taeglich','2x täglich':'freq_2x','3x täglich':'freq_3x',
  'Jeden 2. Tag':'freq_jeden2',
  '5 Tage an / 2 aus':'freq_5an2aus','Mo-Fr':'freq_mofr','Wöchentlich':'freq_woechentlich',
  'Alle X Tage':'freq_alle_x','Wochentage wählen':'freq_wochentage',
  'Bei Bedarf':'freq_bei_bedarf',
}
const INTAKE_TIME_CONFIG = {
  morgens: { labelKey: 'morgens', icon: Sunrise, time: '08:00' },
  mittags: { labelKey: 'mittags', icon: Sun,  time: '12:00' },
  abends:  { labelKey: 'abends',  icon: Moon, time: '20:00' },
  custom:  { labelKey: 'uhrzeit_label', icon: Clock, time: '' },
} as const
const ROUTINE_GROUP_TO_INTAKE_TIME = {
  morning: 'morgens',
  midday: 'mittags',
  evening: 'abends',
} as const
const INTAKE_TIME_TO_ROUTINE_GROUP: Record<string, RoutineGroup> = Object.fromEntries(
  Object.entries(ROUTINE_GROUP_TO_INTAKE_TIME).map(([group, intakeTime]) => [intakeTime, group]),
) as Record<string, RoutineGroup>
const REMINDER_OPTIONS = [
  { value: '1day',    labelKey: 'reminder_1day' },
  { value: '2h',      labelKey: 'reminder_2h' },
  { value: 'on_time', labelKey: 'reminder_on_time' },
]

// ─── Formular-Typen ───────────────────────────────────────────────────────────

function parseStoredDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = parseISO(value)
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value ? parsed : null
}

function mergeCatalogEntries(
  current: SubstanceCatalogEntry[],
  additions: SubstanceCatalogEntry[],
): SubstanceCatalogEntry[] {
  const entriesById = new Map(current.map(entry => [entry.id, entry]))
  additions.forEach(entry => entriesById.set(entry.id, entry))
  return [...entriesById.values()]
}

function escalationFormStartDate(cycle: Cycle, form: EscalationForm): Date | null {
  if (form.start_type === 'date') return parseStoredDay(form.start_date)
  const offset = Number(form.start_after_days)
  if (!Number.isFinite(offset) || !Number.isInteger(offset) || offset <= 0) return null
  return addDays(parseISO(cycle.start_date), offset * (form.start_type === 'after_weeks' ? 7 : 1))
}

function withEffectiveEscalationUnit(cycle: Cycle, form: EscalationForm): EscalationForm {
  const start = escalationFormStartDate(cycle, form)
  return { ...form, unit: start ? scheduleForDay(cycle, start).unit ?? '' : '' }
}

export function DosePlanActions({
  trackingLevel,
  onPermanent,
  onTitration,
}: {
  trackingLevel: TrackingLevel
  onPermanent: () => void
  onTitration: () => void
}) {
  const { t } = useTranslation()
  const capabilities = dosePlanCapabilities(trackingLevel)
  if (!capabilities.permanent) return null

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        onClick={onPermanent}
        className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 text-xs font-semibold text-cyan-200 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
      >
        <CalendarPlus size={13} aria-hidden="true" /> {t('dose_plan_new_standard', { defaultValue: 'Neue Standarddosis ab …' })}
      </button>
      <button
        type="button"
        onClick={onTitration}
        className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 text-xs font-semibold text-orange-300 transition-colors hover:border-orange-400/50 hover:bg-orange-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
      >
        <Plus size={13} aria-hidden="true" /> {t('dose_plan_add_titration', { defaultValue: 'Titrationsschritt hinzufügen' })}
      </button>
    </div>
  )
}

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

// Schedule-relevante Felder eines Standes (für Vergleich + Segmentaufbau).

function cycleAsIntakePlanDraft(cycle: Cycle, day: Date): IntakePlanDraft {
  const segment = scheduleForDay(cycle, day)
  // Jeder Einnahmezeitpunkt, nicht nur der erste. Vorher nahm der Assistent
  // `…split(',').find(Boolean)` — beim Bearbeiten eines „2x taeglich"-Zyklus
  // fiel die zweite Einnahme damit still weg, und Speichern loeschte sie.
  const slotKeys = (segment.intake_time ?? '').split(',').map(key => key.trim()).filter(Boolean)
  const slotTimes = (segment.intake_time_custom ?? '').split(',').map(time => time.trim())
  // Die Mengen je Zeitpunkt. Steht dort nichts, gilt ueberall die eine Menge
  // des Zyklus — so war es bei jedem Plan vor dieser Runde.
  const slotDoses = (segment.slot_doses ?? '').split(',').map(wert => wert.trim())
  // Leer heisst „an jedem Tag" — so stand es in jedem Plan vor dieser Runde.
  const slotDays = (segment.slot_days ?? '').split(',')
  const slots: IntakeSlotDraft[] = slotKeys.map((key, index) => {
    const eigene = Number(slotDoses[index])
    return {
      routineGroup: INTAKE_TIME_TO_ROUTINE_GROUP[key] ?? 'morning',
      time: slotTimes[index] || null,
      dose: (slotDoses[index] ?? '') !== '' && Number.isFinite(eigene) ? eigene : segment.dose,
      weekdays: (slotDays[index] ?? '').split('|').map(tag => tag.trim()).filter(Boolean),
    }
  })
  return {
    id: cycle.id,
    name: cycle.name,
    unit: segment.unit,
    method: cycle.method,
    // Alte Frequenztexte werden auf die vier Formen abgebildet — „Wöchentlich"
    // ist ein Abstand von einer Woche, „Mo-Fr" sind fuenf Wochentage. Sie
    // bedeuten dasselbe, und ein bestehender Zyklus verliert beim Oeffnen
    // nichts. Die Tageszahl der alten „2x taeglich" steckt in den
    // Einnahmezeitpunkten, nicht im Rhythmus.
    rhythm: rhythmFromStorage(segment),
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: cycle.end_date,
    slots: slots.length > 0
      ? slots
      : [{ routineGroup: 'morning' as const, time: null, dose: segment.dose, weekdays: [] }],
    reminders: cycle.reminder && cycle.reminder !== 'none'
      ? cycle.reminder.split(',').filter(Boolean)
      : [],
  }
}

interface RecoverableMutation {
  key: string
  committed: boolean
}

function planChangeSubmissionIdentity(submission: PlanChangeSubmission): string {
  const { target, effective, snapshot } = submission
  return JSON.stringify({
    target: [target.mode, target.cycleId, target.versionId],
    effective: [effective.kind, effective.localDate],
    snapshot: [
      snapshot.frequency,
      snapshot.x_days_interval,
      snapshot.interval_unit,
      snapshot.cycle_on_days,
      snapshot.cycle_off_days,
      snapshot.schedule_days,
      snapshot.intake_time,
      snapshot.intake_time_custom,
      snapshot.slot_doses,
      snapshot.slot_days,
      snapshot.dose,
      snapshot.unit,
      snapshot.method,
    ],
    changeKind: submission.changeKind,
    timeZone: submission.timeZone,
  })
}

function versionAsIntakePlanDraft(
  timeline: CycleTimeline,
  version: CyclePlanVersion,
  timeZone: string,
): IntakePlanDraft {
  const slotKeys = version.intake_time.split(',').map(key => key.trim()).filter(Boolean)
  const slotTimes = (version.intake_time_custom ?? '').split(',').map(time => time.trim())
  const slotDoses = (version.slot_doses ?? '').split(',').map(value => value.trim())
  const slotDays = (version.slot_days ?? '').split(',')
  const slots: IntakeSlotDraft[] = slotKeys.map((key, index) => {
    const ownDose = Number(slotDoses[index])
    return {
      routineGroup: INTAKE_TIME_TO_ROUTINE_GROUP[key] ?? 'morning',
      time: slotTimes[index] || null,
      dose: (slotDoses[index] ?? '') !== '' && Number.isFinite(ownDose) ? ownDose : version.dose,
      weekdays: (slotDays[index] ?? '').split('|').map(day => day.trim()).filter(Boolean),
    }
  })
  const frequency = {
    daily: 'Täglich',
    weekdays: 'Wochentage wählen',
    interval: 'Alle X Tage',
    cycle: 'Im Wechsel',
    on_demand: 'Bei Bedarf',
  }[version.frequency] ?? version.frequency
  const startDate = version.effective_kind === 'local_date'
    ? version.effective_local_date ?? localDateTimeKey(new Date(timeline.cycle.started_at), timeZone).slice(0, 10)
    : localDateTimeKey(new Date(version.effective_at ?? timeline.cycle.started_at), timeZone).slice(0, 10)

  return {
    id: version.id,
    name: 'Einnahmeplan',
    unit: version.unit,
    method: version.method,
    rhythm: rhythmFromStorage({
      frequency,
      x_days_interval: version.x_days_interval,
      interval_unit: version.interval_unit,
      cycle_on_days: version.cycle_on_days,
      cycle_off_days: version.cycle_off_days,
      schedule_days: version.schedule_days,
    }),
    startDate,
    endDate: timeline.cycle.ended_at
      ? localDateTimeKey(new Date(timeline.cycle.ended_at), timeZone).slice(0, 10)
      : null,
    slots: slots.length > 0
      ? slots
      : [{ routineGroup: 'morning', time: null, dose: version.dose, weekdays: [] }],
    reminders: [],
  }
}

function versionSnapshot(version: CyclePlanVersion): PlanScheduleSnapshot {
  return {
    frequency: version.frequency,
    x_days_interval: version.x_days_interval,
    interval_unit: version.interval_unit,
    cycle_on_days: version.cycle_on_days,
    cycle_off_days: version.cycle_off_days,
    schedule_days: version.schedule_days,
    intake_time: version.intake_time,
    intake_time_custom: version.intake_time_custom,
    slot_doses: version.slot_doses,
    slot_days: version.slot_days,
    dose: version.dose,
    unit: version.unit,
    method: version.method,
  }
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

interface MyStackPageProps {
  stackDataClient?: typeof supabase
}

export function MyStackPage({ stackDataClient = supabase }: MyStackPageProps = {}) {
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
  const [pkProfileCatalog, setPkProfileCatalog] = useState<PkProfileOption[]>([])
  const [pkSuggestOpen, setPkSuggestOpen] = useState(false)

  // ── Peptide ───────────────────────────────────────────────────────────────
  const [peptides, setPeptides]               = useState<Peptide[]>([])
  const [loading, setLoading]                 = useState(true)
  const [initialLoad, setInitialLoad]         = useState(true)
  const [loaderFading, setLoaderFading]       = useState(false)
  const [cycles, setCycles]                   = useState<Cycle[]>([])
  const [cycleTimelines, setCycleTimelines]   = useState<CycleTimeline[]>([])
  const [timelineLoadError, setTimelineLoadError] = useState(false)
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [expandedId, setExpandedId]           = useState<string | null>(null)
  const [showPeptideForm, setShowPeptideForm] = useState(false)
  const [editingPeptideId, setEditingPeptideId] = useState<string | null>(null)
  const [catalogEntries, setCatalogEntries] = useState<SubstanceCatalogEntry[]>([])
  const [catalogUnavailable, setCatalogUnavailable] = useState(false)
  const [wizardInitialColor, setWizardInitialColor] = useState('')
  const [wizardIntent, setWizardIntent] = useState<'pk' | 'plan' | undefined>()
  const [wizardCycleId, setWizardCycleId] = useState<string | null>(null)
  const [planEditContext, setPlanEditContext] = useState<PlanEditContext | null>(null)
  const planSaveRecoveryRef = useRef<(RecoverableMutation & { identity: string }) | null>(null)
  const lifecycleIdempotencyKeysRef = useRef(new Map<string, RecoverableMutation>())
  // Ein zweiter Plan statt einer Aenderung am bestehenden.
  const [wizardNeuerZyklus, setWizardNeuerZyklus] = useState(false)
  const [infoPeptide, setInfoPeptide]         = useState<Peptide | null>(null)
  const [search, setSearch]                   = useState('')
  const [showTrackingForm, setShowTrackingForm] = useState(false)
  const [pForm, setPForm] = useState<VialTrackingDraft>(emptyVialTrackingDraft())
  const [showDropdown, setShowDropdown] = useState(false)
  const [savingPeptide, setSavingPeptide] = useState(false)
  const [batchFile, setBatchFile] = useState<File | null>(null)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [searchOpen, setSearchOpen]           = useState(false)
  const [filterOpen, setFilterOpen]           = useState(false)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [sortBy, setSortBy]                   = useState<PeptideSortKey>('active_name')
  const [activeTab, setActiveTab]             = useState<StackTabKey>('all')
  const [viewMode, setViewModeState]          = useState<'vials' | 'list'>(() =>
    localStorage.getItem('tyd_peptide_view') === 'list' ? 'list' : 'vials'
  )
  const [activePeptideId, setActivePeptideId] = useState<string | null>(null)
  // Das Rechteck des angetippten Objekts — der Startpunkt des Flugs.
  const [detailUrsprung, setDetailUrsprung] = useState<DOMRect | null>(null)
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
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'

  // ── Zyklen ────────────────────────────────────────────────────────────────
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
  const [archiveInfoPeptide, setArchiveInfoPeptide] = useState<Peptide | null>(null)
  const [archiveCyclesOpen, setArchiveCyclesOpen] = useState(false)
  const archiveInfoBackButtonRef = useRef<HTMLButtonElement | null>(null)
  const archiveDialogRef = useRef<HTMLDivElement | null>(null)
  const archiveCloseButtonRef = useRef<HTMLButtonElement | null>(null)

  // ── Dosisanpassungen ──────────────────────────────────────────────────────
  const [escalations, setEscalations]             = useState<Escalation[]>([])
  const [showEscForm, setShowEscForm]             = useState(false)
  const [escForCycle, setEscForCycle]             = useState<Cycle | null>(null)
  const [editingEscId, setEditingEscId]           = useState<string | null>(null)
  const [eForm, setEForm]                         = useState<EscalationForm | null>(null)
  const [savingEsc, setSavingEsc]                 = useState(false)

  const openArchiveInfo = (p: Peptide) => {
    setArchiveCyclesOpen(false)
    setArchiveInfoPeptide(p)
    window.requestAnimationFrame(() => archiveInfoBackButtonRef.current?.focus())
  }

  useEffect(() => {
    if (!archiveViewOpen) return

    const dialog = archiveDialogRef.current
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    archiveCloseButtonRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      const nestedDialog = document.querySelector<HTMLElement>('[data-archive-delete-confirmation]')
      const archiveInfoDialog = document.querySelector<HTMLElement>('[data-archive-info-detail]')
      const focusScope = nestedDialog ?? archiveInfoDialog ?? dialog
      if (e.key === 'Escape') {
        e.preventDefault()
        if (nestedDialog) {
          setDeletePromptFromArchive(false)
          setDeletePromptPeptide(null)
          window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())
        } else if (archiveInfoDialog) {
          const peptideId = archiveInfoDialog.dataset.archiveInfoDetail
          setArchiveInfoPeptide(null)
          window.requestAnimationFrame(() => {
            if (peptideId) document.querySelector<HTMLButtonElement>(`[data-archive-info-button="${peptideId}"]`)?.focus()
          })
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
    let data = await loadStackItems(stackDataClient as never, false)
    if (!isLocalColorMigrationComplete(localStorage)) {
      const archived = await loadStackItems(stackDataClient as never, true)
      const migrated = await migrateLocalColors(stackDataClient as never, [...data, ...archived], localStorage)
      if (migrated) data = await loadStackItems(stackDataClient as never, false)
    }
    setCatalogEntries(current => mergeCatalogEntries(
      current,
      data.flatMap(item => item.ingredients.map(ingredient => ingredient.substance_catalog).filter(
        (entry): entry is SubstanceCatalogEntry => entry !== null,
      )),
    ))
    setPeptides(data.map(asPeptide))
  }
  const loadArchived = async () => {
    try {
      const data = await loadStackItems(supabase as never, true)
      setArchivedPeptides(data
        .map(asPeptide)
        .sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? '')))
    } catch {
      toast.error(t('error'))
    }
  }
  const loadCycles = async () => {
    const { data } = await stackDataClient.from('cycles').select('*').eq('user_id', user!.id)
    if (data) setCycles(data as Cycle[])
  }
  const loadTimelines = async (throwOnError = false) => {
    if (!FEATURES.planTimelineV2) return
    setTimelineLoading(true)
    setTimelineLoadError(false)
    try {
      setCycleTimelines(await loadCycleTimelines(stackDataClient as never, user!.id))
    } catch (error) {
      setTimelineLoadError(true)
      if (throwOnError) throw error
    } finally {
      setTimelineLoading(false)
    }
  }
  const loadEscalations = async () => {
    const { data } = await supabase.from('dose_escalations').select('*').eq('user_id', user!.id).order('start_after_days').order('start_date')
    if (data) setEscalations(data as Escalation[])
  }
  useEffect(() => {
    // Leaving the page before the queries settle, or within the loader's fade,
    // must not write state into an unmounted component: the fade timer would
    // otherwise still fire half a second later.
    let cancelled = false
    let fadeTimer: number | undefined

    Promise.all([loadInventory(), loadPeptides(), loadCycles(), loadTimelines(), loadEscalations(), searchSubstanceCatalog(supabase as never, '').then(result => { setCatalogEntries(current => mergeCatalogEntries(current, result.entries)); setCatalogUnavailable(result.unavailable) })])
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        // Fade out the full-screen loader, then unmount it (same as The Lab).
        setLoaderFading(true)
        fadeTimer = window.setTimeout(() => setInitialLoad(false), 500)
      })

    return () => {
      cancelled = true
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer)
    }
  }, [])


  useEffect(() => {
    setAnimationEpoch(e => e + 1)
  }, [location.key])

  useEffect(() => {
    if (location.hash !== '#new-substance') return
    setEditingPeptideId(null)
    setWizardCycleId(null)
    setPlanEditContext(null)
    setWizardIntent(undefined)
    setWizardInitialColor(getRandomStackItemColor())
    setShowPeptideForm(true)
    navigate(location.pathname, { replace: true })
  }, [location.hash, location.pathname, navigate])

  useEffect(() => {
    if (loading) return
    const params = new URLSearchParams(location.search)
    if (params.get('intent') !== 'pk') return
    const stackItemId = params.get('edit')
    if (!stackItemId || !peptides.some(item => item.id === stackItemId)) return

    setEditingPeptideId(stackItemId)
    setWizardCycleId(null)
    setPlanEditContext(null)
    setWizardInitialColor('')
    setWizardIntent('pk')
    setShowPeptideForm(true)
    navigate(location.pathname, { replace: true })
  }, [loading, location.pathname, location.search, navigate, peptides])

  useEffect(() => {
    if (!showTrackingForm) return
    supabase.from('pk_profiles').select('id, name, aliases').order('name')
      .then(({ data }) => setPkProfileCatalog((data as PkProfileOption[]) ?? []))
  }, [showTrackingForm])

  const pepPkSuggestions = useMemo(() => {
    const q = pForm.name.trim().toLowerCase()
    if (!q) return []
    return pkProfileCatalog
      .filter(profile => profile.name.toLowerCase().includes(q)
        || profile.aliases.some(alias => alias.toLowerCase().includes(q)))
      .slice(0, 5)
  }, [pForm.name, pkProfileCatalog])

  const pepLinkedPkProfile = useMemo(
    () => pkProfileCatalog.find(profile => profile.id === pForm.pk_profile_id) ?? null,
    [pkProfileCatalog, pForm.pk_profile_id],
  )

  const handlePepNameChange = (value: string) => {
    setPForm(form => ({ ...form, name: value }))
    setPkSuggestOpen(true)
    if (pForm.pk_profile_id && pepLinkedPkProfile && value.trim().toLowerCase() !== pepLinkedPkProfile.name.toLowerCase()) {
      setPForm(form => ({ ...form, pk_profile_id: '' }))
    }
  }

  const selectPepPkProfile = (profile: PkProfileOption) => {
    setPForm(form => ({ ...form, name: profile.name, pk_profile_id: profile.id }))
    setPkSuggestOpen(false)
  }


  const activePeptideIds = useMemo(
    () => new Set(cycles.filter(c => c.active).map(c => c.stack_item_id)),
    [cycles],
  )
  const gesuchtePeptides = peptides.filter(
    p => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  )
  // Was in den Reitern steht, zaehlt ueber den GANZEN Stack — nicht ueber die
  // gerade gefilterte Liste, sonst zeigte jeder Reiter ausser dem offenen 0.
  const reiterZaehler = tabCounts(peptides)
  const offeneKategorie = filterByTab(gesuchtePeptides, activeTab)
  // Welche Sortierungen dieser Reiter ueberhaupt beantworten kann.
  const moeglicheSortierungen = sortAbilities(offeneKategorie)
  // Sortiert jemand nach Fuellstand und wechselt dann in einen Reiter ohne
  // Vials, gaebe es die gewaehlte Sortierung dort nicht mehr — die Auswahl
  // zeigte einen Wert, den das Menue gar nicht fuehrt. Dann zurueck auf die
  // Vorgabe, die immer geht.
  const sortierungMoeglich = PEPTIDE_SORT_GROUPS.some(group => (
    group.options.includes(sortBy) && (!group.needs || moeglicheSortierungen.has(group.needs))
  ))
  const wirksameSortierung: PeptideSortKey = sortBy === 'active_name' || sortierungMoeglich
    ? sortBy
    : 'active_name'
  const displayPeptides = sortPeptides(offeneKategorie, wirksameSortierung, activePeptideIds)
  const stagePeptides = displayPeptides.filter(p => isStageRenderable(p.dosage_form))
  const listPeptides = viewMode === 'list'
    ? displayPeptides
    : displayPeptides.filter(p => !isStageRenderable(p.dosage_form))

  const setViewMode = (mode: 'vials' | 'list') => {
    setViewModeState(mode)
    localStorage.setItem('tyd_peptide_view', mode)
  }

  useEffect(() => {
    if (stagePeptides.length === 0) {
      if (activePeptideId) setActivePeptideId(null)
      return
    }
    if (!activePeptideId || !stagePeptides.some(p => p.id === activePeptideId)) {
      setActivePeptideId(stagePeptides[0].id)
    }
  }, [activePeptideId, stagePeptides])

  const cyclesOf      = (pid: string) => cycles
    .filter(c => c.stack_item_id === pid)
    .sort((a, b) =>
      (a.active === b.active)
        ? b.created_at.localeCompare(a.created_at)
        : (a.active ? -1 : 1))
  const escalationsOf = (cid: string) => escalations.filter(e => e.cycle_id === cid)
  const timelinesOf = (stackItemId: string) => cycleTimelines.filter(
    timeline => timeline.cycle.stack_item_id === stackItemId,
  )

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
    await reconstituteStackItem(supabase as never, p.id, today)
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
    setEditingPeptideId(null)
    setWizardCycleId(null)
    setPlanEditContext(null)
    setWizardIntent(undefined)
    setWizardInitialColor(getRandomStackItemColor())
    setShowPeptideForm(true)
  }

  const openEditPeptide = (p: Peptide) => {
    setEditingPeptideId(p.id)
    setWizardCycleId(null)
    setPlanEditContext(null)
    setWizardIntent(undefined)
    setWizardInitialColor('')
    setShowPeptideForm(true)
  }

  const openTrackingDetails = (p: Peptide) => {
    if (!isStageRenderable(p.dosage_form)) return
    setEditingPeptideId(p.id)
    setPForm({
      inventory_item_id: p.inventory_item_id ?? '',
      pk_profile_id: p.pk_profile_id ?? '',
      name: p.name,
      default_method: p.default_method,
      vial_amount_mg: p.vial_amount_mg?.toString() ?? '',
      vial_amount_unit: p.vial_amount_unit ?? 'mg',
      reconstitution_ml: p.reconstitution_ml?.toString() ?? '',
      syringe_ml: p.syringe_type?.split(':')[0] ?? '1',
      syringe_units: p.syringe_type?.split(':')[1] ?? '100',
      notes: p.notes ?? '',
      vials_in_stock: (inventory.find(item => item.id === p.inventory_item_id)?.vials_count ?? 0).toString(),
      reconstitution_date: p.reconstitution_date ?? '',
      expiry_days: p.expiry_days?.toString() ?? '',
      batch_number: p.batch_number ?? '',
      batch_source: p.batch_source ?? '',
      batch_file_url: p.batch_file_url ?? '',
      color_hex: p.color_hex ?? getStableStackItemColor(p.id),
    })
    setBatchFile(null)
    setPkSuggestOpen(false)
    setShowTrackingForm(true)
  }

  const saveTrackingDetails = async () => {
    if (!editingPeptideId || !pForm.name.trim()) return
    const existing = peptides.find(item => item.id === editingPeptideId)
    if (!existing) return
    setSavingPeptide(true)
    try {
      let fileUrl = pForm.batch_file_url
      if (batchFile) {
        setUploadingFile(true)
        const extension = batchFile.name.split('.').pop()?.toLowerCase()
        const path = `${user!.id}/${Date.now()}.${extension}`
        const { error } = await supabase.storage.from('batch-files').upload(path, batchFile)
        if (error) toast.error(t('datei_upload_fehler'))
        else fileUrl = supabase.storage.from('batch-files').getPublicUrl(path).data.publicUrl
        setUploadingFile(false)
      }

      const rawReserve = parseFloat(pForm.vials_in_stock) || 0
      let inventoryItemId = pForm.inventory_item_id || null
      if (pForm.vial_amount_mg) {
        const vialAmount = parseFloat(pForm.vial_amount_mg)
        const inventoryPayload = {
          user_id: user!.id,
          name: pForm.name.trim(),
          mg_per_vial: pForm.vial_amount_unit === 'mcg' ? vialAmount / 1000 : vialAmount,
          vials_count: rawReserve,
          vials_initial: rawReserve,
          batch_number: pForm.batch_number || null,
          batch_source: pForm.batch_source || null,
          batch_file_url: fileUrl || null,
          pk_profile_id: pForm.pk_profile_id || null,
        }
        if (inventoryItemId) {
          await supabase.from('inventory_items').update(inventoryPayload).eq('id', inventoryItemId)
        } else {
          const { data } = await supabase.from('inventory_items').insert(inventoryPayload).select('id').single()
          inventoryItemId = data?.id ?? null
        }
      }

      await saveVialTracking(supabase as never, editingPeptideId, {
        display_name: pForm.name.trim(),
        name: pForm.name.trim(),
        default_method: pForm.default_method || 'Subkutan',
        vial_amount_mg: pForm.vial_amount_mg ? parseFloat(pForm.vial_amount_mg) : null,
        vial_amount_unit: pForm.vial_amount_mg ? pForm.vial_amount_unit : null,
        reconstitution_ml: pForm.reconstitution_ml ? parseFloat(pForm.reconstitution_ml) : null,
        syringe_type: pForm.syringe_ml && pForm.syringe_units ? `${pForm.syringe_ml}:${pForm.syringe_units}` : null,
        notes: pForm.notes || null,
        vials_in_stock: existing.vials_in_stock ?? 1,
        vials_initial: existing.vials_initial ?? 1,
        reconstitution_date: pForm.reconstitution_date || null,
        expiry_days: pForm.expiry_days ? parseInt(pForm.expiry_days) : null,
        batch_number: pForm.batch_number || null,
        batch_source: pForm.batch_source || null,
        batch_file_url: fileUrl || null,
        inventory_item_id: inventoryItemId,
        pk_profile_id: pForm.pk_profile_id || null,
        color_hex: pForm.color_hex || null,
      })
      toast.success(t('peptid_aktualisiert'))
      setShowTrackingForm(false)
      setBatchFile(null)
      await Promise.all([loadPeptides(), loadInventory()])
    } catch {
      toast.error(t('fehler_speichern'))
    } finally {
      setUploadingFile(false)
      setSavingPeptide(false)
    }
  }

  const handleSaveStackItem = async (
    draft: StackItemSetupDraft,
    _mode: WizardSaveMode,
    idempotencyKey: string,
  ) => {
    const savedRow = await saveStackItemSetup(stackDataClient as never, draft, idempotencyKey)
    await Promise.all([
      loadPeptides(),
      loadCycles(),
      ...(FEATURES.planTimelineV2 ? [loadTimelines(true)] : []),
    ])
    setExpandedId(savedRow.id)
    toast.success(draft.id ? t('peptid_aktualisiert') : t('peptid_hinzugefuegt'))
  }

  const openExistingStackItem = (item: StackItem) => {
    setActivePeptideId(item.id)
    setViewMode('list')
    setExpandedId(item.id)
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
    try {
      await archiveStackItem(supabase as never, p.id)
    } catch {
      toast.error(t('error'))
      setDeletingPeptide(false)
      return
    }
    await supabase.from('cycles').update({ active: false }).eq('stack_item_id', p.id).eq('active', true)
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
    await supabase.from('dose_logs').delete().eq('stack_item_id', p.id)
    await supabase.from('injection_logs').delete().eq('stack_item_id', p.id)
    await supabase.from('effects').delete().eq('stack_item_id', p.id)
    await deleteStackItem(supabase as never, p.id)
    toast.success(t('geloescht'))
    setDeletePromptFromArchive(false)
    setDeletePromptPeptide(null); setDeletingPeptide(false)
    window.requestAnimationFrame(() => archiveCloseButtonRef.current?.focus())
    loadPeptides(); loadCycles(); loadArchived()
  }

  const restorePeptide = async (p: Peptide) => {
    await restoreStackItem(supabase as never, p.id)
    toast.success(t('substanz_wiederhergestellt'))
    loadArchived(); loadPeptides()
  }

  // ── Zyklus-Aktionen ───────────────────────────────────────────────────────
  /**
   * Ein ZWEITER Plan fuer denselben Eintrag.
   *
   * Derselbe Weg wie „Plan aendern", nur ohne den bestehenden Plan im
   * Gepaeck: `save_stack_item_with_plan` legt ohne `p_plan.id` einen neuen
   * Zyklus an, statt den vorhandenen fortzuschreiben.
   */
  const openNewCycle = (p: Peptide) => {
    setEditingPeptideId(p.id)
    setWizardCycleId(null)
    setPlanEditContext(null)
    setWizardInitialColor('')
    setWizardIntent('plan')
    setWizardNeuerZyklus(true)
    setShowPeptideForm(true)
  }
  /**
   * Eine vorgemerkte Stufe zuruecknehmen.
   *
   * Geprueft wird im RPC, nicht hier: dass nur Kuenftiges geht, ist eine
   * Regel ueber die Daten und gehoert dorthin, wo sie sich nicht umgehen
   * laesst. Hier steht nur, was danach zu sehen ist.
   */
  const stufeZuruecknehmen = async (c: Cycle, effectiveFrom: string) => {
    try {
      await removePlanSegment(supabase, c.id, effectiveFrom)
      await loadCycles()
      toast.success(String(t('my_stack_plan_step_removed', { defaultValue: 'Stufe zurückgenommen.' })))
    } catch {
      toast.error(String(t('my_stack_plan_step_remove_failed', {
        defaultValue: 'Die Stufe konnte nicht zurückgenommen werden.',
      })))
    }
  }

  /**
   * Den Einnahmeplan eines Eintrags aendern.
   *
   * Frueher oeffnete das ein eigenes Zyklusformular, das direkt in `cycles`
   * schrieb — am RPC vorbei und damit an dessen Pruefungen. Es kannte
   * `slot_doses`, `slot_days`, `interval_unit` und die Wechseltage gar nicht:
   * ein `update` liess sie stehen, waehrend es `intake_time` ueberschrieb, und
   * die Listen liefen auseinander. Seine Segmentlogik war eine zweite, engere
   * Kopie der des RPC.
   *
   * Jetzt fuehrt auch dieser Weg durch den Assistenten und damit durch
   * `save_stack_item_with_plan`: ein Schreibweg, eine Pruefung, eine
   * Segmentlogik.
   */
  const openEditCycle = (
    p: Peptide,
    cycleId: string,
    versionId?: string,
    changeKind: Exclude<PlanChangeKind, 'initial'> = 'schedule',
  ) => {
    const timeline = cycleTimelines.find(candidate => candidate.cycle.id === cycleId)
    if (FEATURES.planTimelineV2 && timeline) {
      const selectedVersion = versionId
        ? timeline.versions.find(version => version.id === versionId)
        : resolveCycleAt(timeline, new Date(), timeZone).planVersion
      if (!selectedVersion) return
      setPlanEditContext({
        target: versionId
          ? { cycleId, versionId, mode: 'replace_future' }
          : { cycleId, versionId: null, mode: 'new_change' },
        snapshot: versionAsIntakePlanDraft(timeline, selectedVersion, timeZone),
        changeKind,
        timeZone,
        initialEffective: versionId
          ? { kind: 'date', localDate: selectedVersion.effective_local_date }
          : { kind: 'now', localDate: null },
      })
      setWizardCycleId(null)
    } else {
      if (!cycles.some(cycle => cycle.id === cycleId && cycle.stack_item_id === p.id)) return
      setWizardCycleId(cycleId)
      setPlanEditContext(null)
    }
    setEditingPeptideId(p.id)
    setWizardInitialColor('')
    setWizardNeuerZyklus(false)
    setWizardIntent('plan')
    setShowPeptideForm(true)
  }

  const replaceTimeline = (next: CycleTimeline) => {
    setCycleTimelines(current => current.map(timeline => (
      timeline.cycle.id === next.cycle.id ? next : timeline
    )))
  }

  const lifecycleKey = (action: string, targetId: string) => {
    const identity = `${action}:${targetId}`
    const existing = lifecycleIdempotencyKeysRef.current.get(identity)
    if (existing) return { identity, mutation: existing }
    const mutation = { key: globalThis.crypto.randomUUID(), committed: false }
    lifecycleIdempotencyKeysRef.current.set(identity, mutation)
    return { identity, mutation }
  }

  const completeLifecycleMutation = (identity: string, next: CycleTimeline) => {
    lifecycleIdempotencyKeysRef.current.delete(identity)
    replaceTimeline(next)
  }

  const saveVersionChange = async (submission: PlanChangeSubmission) => {
    const identity = planChangeSubmissionIdentity(submission)
    let recovery = planSaveRecoveryRef.current
    if (!recovery || recovery.identity !== identity) {
      recovery = { identity, key: globalThis.crypto.randomUUID(), committed: false }
      planSaveRecoveryRef.current = recovery
    }
    if (!recovery.committed) {
      await savePlanChange(
        stackDataClient as never,
        submission.target,
        submission.snapshot,
        submission.effective,
        {
          changeKind: submission.changeKind,
          idempotencyKey: recovery.key,
          timeZone: submission.timeZone,
        },
      )
      recovery.committed = true
    }
    await loadTimelines(true)
    planSaveRecoveryRef.current = null
  }

  const removeFutureVersion = async (version: CyclePlanVersion) => {
    const mutation = lifecycleKey('remove-version', version.id)
    if (!mutation.mutation.committed) {
      await removeFuturePlanVersion(stackDataClient as never, {
        versionId: version.id,
        timeZone,
        idempotencyKey: mutation.mutation.key,
      })
      mutation.mutation.committed = true
    }
    await loadTimelines(true)
    lifecycleIdempotencyKeysRef.current.delete(mutation.identity)
  }

  const pauseTimeline = async (timeline: CycleTimeline, endsAt: string | null) => {
    const mutation = lifecycleKey('pause', timeline.cycle.id)
    const next = await pauseCycle(stackDataClient as never, {
      cycleId: timeline.cycle.id,
      endsAt,
      idempotencyKey: mutation.mutation.key,
    })
    completeLifecycleMutation(mutation.identity, next)
  }

  const setTimelinePauseEnd = async (timeline: CycleTimeline, endsAt: string | null) => {
    const pause = resolveCycleAt(timeline, new Date(), timeZone).pause
    if (!pause || !endsAt) throw new Error('An active pause and end date are required')
    const mutation = lifecycleKey('pause-end', pause.id)
    const next = await setPauseEnd(stackDataClient as never, {
      pauseId: pause.id,
      endsAt,
      idempotencyKey: mutation.mutation.key,
    })
    completeLifecycleMutation(mutation.identity, next)
  }

  const resumeTimeline = async (timeline: CycleTimeline) => {
    const mutation = lifecycleKey('resume', timeline.cycle.id)
    const next = await resumeCycle(stackDataClient as never, {
      cycleId: timeline.cycle.id,
      idempotencyKey: mutation.mutation.key,
    })
    completeLifecycleMutation(mutation.identity, next)
  }

  const finishTimeline = async (timeline: CycleTimeline) => {
    const mutation = lifecycleKey('end', timeline.cycle.id)
    const next = await endTimelineCycle(stackDataClient as never, {
      cycleId: timeline.cycle.id,
      idempotencyKey: mutation.mutation.key,
    })
    completeLifecycleMutation(mutation.identity, next)
  }

  const restartTimeline = async (timeline: CycleTimeline) => {
    const source = resolveCycleAt(timeline, new Date(), timeZone).planVersion
    if (!source) return
    const mutation = lifecycleKey('restart', timeline.cycle.id)
    const next = await restartCycle(stackDataClient as never, {
      sourceCycleId: timeline.cycle.id,
      startedAt: new Date().toISOString(),
      initialSchedule: versionSnapshot(source),
      idempotencyKey: mutation.mutation.key,
    })
    lifecycleIdempotencyKeysRef.current.delete(mutation.identity)
    setCycleTimelines(current => [
      next,
      ...current.filter(candidate => candidate.cycle.id !== next.cycle.id),
    ])
  }

  const planManagementSection = (p: Peptide, timeline: CycleTimeline) => (
    <PlanManagementSection
      key={timeline.cycle.id}
      timeline={timeline}
      now={new Date()}
      timeZone={timeZone}
      onAdjustDose={() => openEditCycle(p, timeline.cycle.id, undefined, 'dose')}
      onAdjustSchedule={() => openEditCycle(p, timeline.cycle.id, undefined, 'schedule')}
      onEditFuture={version => openEditCycle(
        p,
        timeline.cycle.id,
        version.id,
        version.change_kind === 'initial' ? 'schedule' : version.change_kind,
      )}
      onRemoveFuture={removeFutureVersion}
      onPause={endsAt => pauseTimeline(timeline, endsAt)}
      onSetPauseEnd={endsAt => setTimelinePauseEnd(timeline, endsAt)}
      onResume={() => resumeTimeline(timeline)}
      onEnd={() => finishTimeline(timeline)}
      onRestart={() => restartTimeline(timeline)}
    />
  )
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
    const stackItem = peptides.find(item => item.id === c.stack_item_id)
    const currentQuantity = dosePlanQuantitiesForDay(c, new Date(), escalationsOf(c.id)).current
    if (!stackItem || !dosePlanCapabilities(stackItem.tracking_level).titration || !currentQuantity) return
    setEscForCycle(c); setEditingEscId(null)
    setEForm(withEffectiveEscalationUnit(c, emptyEscalationForm(currentQuantity.unit))); setShowEscForm(true)
  }
  const openEditEsc = (c: Cycle, e: Escalation) => {
    const stackItem = peptides.find(item => item.id === c.stack_item_id)
    if (!stackItem || !dosePlanCapabilities(stackItem.tracking_level).titration) return
    setEscForCycle(c); setEditingEscId(e.id)
    const startAfterValue = e.start_after_days !== null && e.start_after_days !== undefined
      ? (e.start_type === 'after_weeks' ? e.start_after_days / 7 : e.start_after_days).toString()
      : '2'
    setEForm({
      increase_amount: escalationTargetQuantity(c, e)?.dose.toString() ?? '',
      unit: doseBeforeAdjustment(c, e)?.unit ?? '',
      start_type: e.start_type,
      start_date: e.start_date ?? format(new Date(), 'yyyy-MM-dd'),
      start_after_days: startAfterValue,
      notes: e.notes ?? '',
    })
    setShowEscForm(true)
  }
  const backfillDoseAdjustmentLogs = async (
    cycle: Cycle,
    nextEscalations: Escalation[],
    affectedEscalations: Escalation[],
    affectedFromDay?: string,
  ) => {
    let query = supabase
      .from('dose_logs')
      .select('id, stack_item_id, logged_at, taken, dose, unit')
      .eq('user_id', user!.id)
      .eq('stack_item_id', cycle.stack_item_id)
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
      affectedFromDay,
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
    const stackItem = peptides.find(item => item.id === escForCycle.stack_item_id)
    if (!stackItem || !dosePlanCapabilities(stackItem.tracking_level).titration) return
    if (!eForm.increase_amount) return toast.error(t('erhoeht_erforderlich'))
    setSavingEsc(true)
    const targetDose = Number(eForm.increase_amount)
    if (!Number.isFinite(targetDose) || targetDose <= 0) {
      setSavingEsc(false)
      return toast.error(t('erhoeht_erforderlich'))
    }
    const enteredOffset = Number(eForm.start_after_days)
    const startAfterDays = eForm.start_type !== 'date'
      ? enteredOffset * (eForm.start_type === 'after_weeks' ? 7 : 1)
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
    const baseQuantityAtStart = doseBeforeAdjustment(escForCycle, draftEsc)
    if (!baseQuantityAtStart) {
      setSavingEsc(false)
      return toast.error(t('erhoeht_erforderlich'))
    }
    let step
    try {
      step = buildTitrationStep({
        trackingLevel: stackItem.tracking_level,
        cycleId: escForCycle.id,
        targetDose,
        effectiveDose: baseQuantityAtStart.dose,
        effectiveUnit: baseQuantityAtStart.unit,
        unit: eForm.unit,
        startType: eForm.start_type,
        startDate: eForm.start_type === 'date' ? eForm.start_date : null,
        startAfterDays,
      })
    } catch {
      setSavingEsc(false)
      return toast.error(t('erhoeht_erforderlich'))
    }
    const payload = {
      user_id: user!.id, cycle_id: escForCycle.id,
      increase_amount: step.increase_amount,
      unit: step.unit, start_type: step.start_type,
      start_date: step.start_date,
      start_after_days: step.start_after_days,
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
        toast.error(t('dose_plan_titration_backfill_failed', { defaultValue: 'Die Dosisanpassung wurde gespeichert, aber offene oder verpasste Einnahmen konnten nicht aktualisiert werden.' }))
      }

      toast.success(editingEscId ? t('inventar_aktualisiert') : t('esc_gespeichert'))
      if (backfilled > 0) {
        toast(t(backfillMessageKey(backfilled), {
          count: backfilled,
          defaultValue: backfilled === 1
            ? '{{count}} offene oder verpasste Einnahme aktualisiert. Bestätigte Einnahmen bleiben unverändert.'
            : '{{count}} offene oder verpasste Einnahmen aktualisiert. Bestätigte Einnahmen bleiben unverändert.',
        }))
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
    if (e.start_type === 'date' && e.start_date) return parseStoredDay(e.start_date)
    if (e.start_after_days !== null && Number.isInteger(e.start_after_days) && e.start_after_days > 0) {
      return addDays(parseISO(c.start_date), e.start_after_days)
    }
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
  const dosePlanViewFor = (c: Cycle, day: Date = new Date()) => (
    dosePlanQuantitiesForDay(c, day, sortedEscalationsOf(c.id))
  )
  const currentQuantityLabel = (c: Cycle, day: Date = new Date()) => {
    const quantity = dosePlanViewFor(c, day).current
    return quantity ? `${quantity.dose} ${quantity.unit}` : '-'
  }
  const scheduledQuantityLabel = (c: Cycle, day: Date) => {
    const segment = scheduleForDay(c, day)
    return segment.dose != null && Number.isFinite(segment.dose) && segment.dose > 0 && segment.unit?.trim()
      ? `${segment.dose} ${segment.unit}`
      : '-'
  }
  /**
   * Was ab wann gilt.
   *
   * Nur wenn es mehr als eine Stufe gibt — bei einem Plan, der nie geaendert
   * wurde, saehe die Liste aus wie eine Wiederholung dessen, was darueber
   * schon steht.
   */
  const planStufenListe = (c: Cycle) => {
    const stufen = planSegments(c, new Date())
    if (stufen.length <= 1) return null
    return (
      <div data-plan-steps className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-2">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-300">
          <CalendarRange size={13} /> {t('my_stack_plan_steps', { defaultValue: 'Planstufen' })}
        </p>
        <div className="space-y-1.5">
          {stufen.map(({ effectiveFrom, segment, status }) => (
            <div
              key={effectiveFrom}
              data-plan-step={effectiveFrom}
              data-plan-step-status={status}
              className={`flex min-h-11 min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs ${status === 'current'
                ? 'border-sky-400/50 bg-sky-400/15 text-sky-100'
                : status === 'past'
                  ? 'border-slate-800 bg-slate-950/70 text-slate-500'
                  : 'border-slate-700 bg-slate-950/70 text-slate-300'
              }`}
            >
              <span className="shrink-0 font-semibold">
                {t('my_stack_plan_step_from', {
                  defaultValue: 'ab {{date}}',
                  date: format(parseISO(effectiveFrom), 'dd.MM.yyyy'),
                })}
              </span>
              <span className="min-w-0 flex-1 truncate">{stufenText(segment)}</span>
              {status === 'current' && (
                <span className="shrink-0 rounded-md border border-sky-400/40 bg-sky-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-200">
                  {t('my_stack_plan_step_current', { defaultValue: 'gilt jetzt' })}
                </span>
              )}
              {/* Zuruecknehmen laesst sich nur, was noch nicht angefangen hat.
                  Was laeuft, ist eingetreten: der Kalender hat danach geplant. */}
              {status === 'future' && (
                <button
                  type="button"
                  onClick={() => stufeZuruecknehmen(c, effectiveFrom)}
                  aria-label={String(t('my_stack_plan_step_remove', {
                    defaultValue: 'Stufe ab {{date}} zurücknehmen',
                    date: format(parseISO(effectiveFrom), 'dd.MM.yyyy'),
                  }))}
                  className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-rose-400/10 hover:text-rose-300"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }
  const plannedQuantityRows = (c: Cycle) => {
    const planned = dosePlanViewFor(c).planned
    if (planned.length === 0) return null
    return (
      <div className="mt-1 space-y-1 text-xs text-slate-500">
        {planned.map(segment => (
          <p key={segment.effectiveFrom}>
            <span className="font-bold uppercase tracking-wide">{segment.status}</span>
            {' · '}{format(parseISO(segment.effectiveFrom), 'dd.MM.yyyy')}: {segment.dose} {segment.unit}
          </p>
        ))}
      </div>
    )
  }
  const escalationTargetQuantity = (c: Cycle, e: Escalation) => {
    const start = escalationStartDate(c, e)
    return start ? effectiveQuantity(c, start, sortedEscalationsOf(c.id)) : null
  }
  const escalationQuantityLabel = (c: Cycle, e: Escalation) => {
    const quantity = escalationTargetQuantity(c, e)
    return quantity ? `${quantity.dose} ${quantity.unit}` : '-'
  }
  const doseBeforeAdjustment = (c: Cycle, e: Escalation) => {
    const start = escalationStartDate(c, e)
    if (!start) return null
    return effectiveQuantity(c, start, sortedEscalationsOf(c.id).filter(row => row.id !== e.id))
  }
  const doseAdjustmentIcon = (c: Cycle, e: Escalation) => {
    const target = escalationTargetQuantity(c, e)
    const previous = doseBeforeAdjustment(c, e)
    if (target == null || previous == null) return Minus
    return target.dose > previous.dose ? TrendingUp : target.dose < previous.dose ? TrendingDown : Minus
  }
  const reminderLabel = (c: Cycle) => {
    if (!c.reminder || c.reminder === 'none') return null
    const labels = c.reminder.split(',').filter(v => v && v !== 'none').map(v => {
      const opt = REMINDER_OPTIONS.find(r => r.value === v)
      return opt ? t(opt.labelKey) : v
    }).filter(Boolean)
    return labels.length > 0 ? labels.join(' · ') : null
  }

  const activeIndex = Math.max(0, stagePeptides.findIndex(p => p.id === activePeptideId))
  const activePeptide = stagePeptides[activeIndex] ?? null
  // Focus the search field right after it expands.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])
  const closeSearch = () => { setSearchOpen(false); setSearch('') }
  // On entering the vials view (toggle or page load), always reset to the first
  // peptide and center it, so the leading add tile isn't the centered item.
  useEffect(() => {
    if (viewMode !== 'vials') return
    const first = stagePeptides[0]
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
  /**
   * `snap-always`: ein Wisch geht genau einen Eintrag weit.
   *
   * Ohne das setzt der Browser den Schwung fort, bis die Reibung ihn
   * aufbraucht — ein kurzer Stups trug den Streifen ueber drei, vier Objekte,
   * weil der Schwung nur das Tempo kennt und nicht die Absicht.
   * `scroll-snap-stop: always` verbietet ihm, einen Standplatz zu
   * ueberfliegen. Wer weiter will, zieht weiter: beim Ziehen gilt die Regel
   * nicht, nur beim Ausrollen danach.
   */
  const vialItemSnapClassName = isVialCarouselDragging ? '' : 'snap-center snap-always'
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
      // Der Abfall war zwischendurch sehr steil (Faktor 1,35, Boden 0,1) —
      // damit lagen die Nachbarn fast im Dunkeln. Jetzt liegt er dazwischen:
      // die Mitte bleibt der Hauptdarsteller, aber man erkennt daneben noch,
      // WAS dort steht.
      const focus = Math.max(0.25, 1 - Math.abs(normalized) * 1.05)
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
  /**
   * Reiter wechseln.
   *
   * Welcher Eintrag dann auf der Buehne steht, muss hier NICHT gesetzt werden:
   * `activeIndex` faellt ueber `Math.max(0, findIndex(...))` von selbst auf den
   * ersten des Reiters, sobald der bisherige nicht mehr dabei ist. Zu tun
   * bleibt nur, was keine Ableitung erledigen kann — das Karussell an den
   * Anfang rollen und das Licht neu rechnen.
   */
  const reiterWechseln = (key: StackTabKey) => {
    setActiveTab(key)
    setAddTileActive(false)
    requestAnimationFrame(() => {
      vialCarouselRef.current
        ?.querySelector<HTMLElement>('[data-vial-index="0"]')
        ?.scrollIntoView({ block: 'nearest', inline: 'center' })
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
    if (!stagePeptides[index]) return
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
      const next = stagePeptides[closestIndex]
      if (next && next.id !== activePeptideId) {
        // Ein Klick je Eintrag, den das Karussell passiert — wie am Rad einer
        // Uhr. Hier und nirgends sonst: jede Auswahl, ob Wisch, Punkt, Pfeil
        // oder Rad, laeuft ueber dieses Rollen, also fuehlt sich auch jede
        // gleich an.
        void hapticTick()
        setActivePeptideId(next.id)
      }
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
    if (stagePeptides.length === 0) return
    const baseIndex = vialTargetIndexRef.current ?? activeIndex
    const nextIndex = (baseIndex + offset + stagePeptides.length) % stagePeptides.length
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
    if (stagePeptides.length <= 1 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
    e.preventDefault()
    if (vialWheelCooldownRef.current !== null) return

    selectPeptideOffset(e.deltaY > 0 ? 1 : -1)
    vialWheelCooldownRef.current = window.setTimeout(() => {
      vialWheelCooldownRef.current = null
    }, 280)
  }
  /**
   * Erst wischen, dann tippen.
   *
   * Ein Tipp auf einen NACHBARN waehlt ihn nur aus — man holt ihn in die
   * Mitte. Ein Tipp auf das Objekt, das schon in der Mitte steht, oeffnet das
   * Vollbild. So braucht es keine zweite Schaltflaeche, und ein Fehltipp beim
   * Wischen kostet hoechstens einen Schritt, nie einen Bildschirmwechsel.
   */
  const handleVialCarouselItemClick = (index: number) => {
    if (vialSuppressClickRef.current) return
    if (index !== activeIndex) {
      pushVialSlosh(index > activeIndex ? 1 : -1)
      selectPeptideIndex(index)
      return
    }
    const objekt = vialCarouselRef.current?.querySelector<HTMLElement>(`[data-vial-index="${index}"]`)
    if (objekt) setDetailUrsprung(objekt.getBoundingClientRect())
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

  /**
   * Alles zu dem Eintrag, der auf der Buehne steht.
   *
   * Steht NICHT mehr unter dem Karussell: dort ist jetzt das Objekt, sein
   * Name und eine Zeile — sonst nichts. Erst das Antippen oeffnet das hier,
   * im Vollbild. Als Funktion im Komponenten statt als eigene Datei, weil
   * der Block auf zwei Dutzend Zustaende und Handler zugreift, die alle
   * hier leben; herauszuloesen hiesse, sie alle durchzureichen.
   */
  const eintragDetails = () => (
    <>
                {(() => {
                  const invItem = activePeptide.inventory_item_id ? inventory.find(i => i.id === activePeptide.inventory_item_id) : null
                  const pCycles = cyclesOf(activePeptide.id)
                  const activeCycle = pCycles.find(c => c.active) ?? null
                  const activeQuantity = activeCycle ? dosePlanViewFor(activeCycle).current : null
                  const cycleStart = activeCycle ? parseISO(activeCycle.start_date) : null
                  const cycleEnd = activeCycle?.end_date ? parseISO(activeCycle.end_date) : null
                  const cycleDay = cycleStart ? Math.max(1, differenceInDays(new Date(), cycleStart) + 1) : null
                  const cycleTotalDays = cycleStart && cycleEnd ? Math.max(1, differenceInDays(cycleEnd, cycleStart) + 1) : null
                  const cycleDayLabel = cycleDay ? `${cycleDay} / ${cycleTotalDays ?? t('ende_offen')}` : '-'
                  const activeIntake = activeCycle ? intakeLabel(activeCycle) : null
                  const activeFrequency = activeCycle
                    ? [freqLabel(activeCycle), activeIntake].filter(Boolean).join(' · ')
                    : null
                  const notSet = 'Nicht gesetzt'
                  /**
                   * Die Angaben, nach Form ausgesucht.
                   *
                   * Welche ueberhaupt vorkommen, entscheidet `detailAbschnitte`
                   * aus dem, was die Form ueber sich sagt — ein Pflaster kennt
                   * kein Anmischen, also steht dort auch keine Zeile dazu. Was
                   * hier steht, ist nur noch der TEXT dazu.
                   */
                  const form = getDosageForm(activePeptide.dosage_form)
                  const wirkstoffLabel = {
                    pro_vial: 'Wirkstoff pro Vial',
                    pro_volumen: 'Wirkstoff pro ml',
                    pro_einheit: `Wirkstoff pro ${String(t(form.labelKey))}`,
                    pro_masse: 'Wirkstoff pro g',
                    roh: 'Wirkstoff',
                  }[wirkstoffBezug(form)]
                  /**
                   * Die Angaben kommen aus der Leseschicht, nicht direkt aus
                   * den Altspalten.
                   *
                   * Vorher stand hier `activePeptide.vial_amount_mg` und so
                   * fort — also genau die Spalten, die NUR die
                   * Tracking-Details schreiben. Ein Eintrag aus dem
                   * Assistenten zeigte deshalb ueberall „Nicht gesetzt",
                   * obwohl seine Angaben in `stack_item_ingredients` und
                   * `stack_item_inventory` standen. Siehe `produktAngaben.ts`.
                   */
                  const angaben = produktAngaben({
                    item: activePeptide,
                    vorratsposten: invItem,
                    zyklusMethode: activeCycle?.method ?? null,
                  })
                  const methodeText = (m: string) => String(t(METHOD_KEYS[m] ?? m))
                  const zutatText = (z: Zutat, mitNamen: boolean) => [
                    mitNamen ? z.name : null,
                    `${z.wert ?? '-'} ${z.einheit ?? ''}`.trim(),
                    z.basis != null ? `/ ${z.basis} ${z.basisEinheit ?? ''}`.trim() : null,
                  ].filter(Boolean).join(' ')
                  const angabeText = (feld: DetailFeld, a: Angabe): string => {
                    switch (a.art) {
                      case 'leer': return notSet
                      case 'zutaten':
                        return a.zutaten.map(z => zutatText(z, a.zutaten.length > 1)).join(' · ')
                      case 'menge': return `${a.wert} ${a.einheit ?? ''}`.trim()
                      case 'vorrat':
                        // Alt zaehlt Vials, neu zaehlt, was auf der Packung
                        // steht — „12 von 30 Tabletten".
                        return a.einheit == null
                          ? String(t('vials_vorratig', { n: a.rest }))
                          : a.packung != null
                            ? `${a.rest} / ${a.packung} ${a.einheit}`
                            : `${a.rest} ${a.einheit}`
                      case 'datum': return format(parseISO(a.iso), 'dd.MM.yyyy')
                      case 'tage': return `${a.n} Tage`
                      case 'datei': return a.url.split('/').pop() || 'Öffnen'
                      case 'text':
                        if (feld === 'kategorie') return String(t(`stack_category_${a.text}`))
                        if (feld === 'applikation') return methodeText(a.text)
                        return a.text
                    }
                  }
                  // „Haltbar danach" zaehlt ab dem Anmischen, „Haltbar bis"
                  // steht auf der Packung. Welche der beiden es ist, sagt die
                  // Angabe selbst — nicht die Form.
                  const haltbarkeitLabel = angaben.haltbarkeit.art === 'datum' ? 'Haltbar bis' : 'Haltbar danach'
                  const FELD_LABEL: Record<DetailFeld, string> = {
                    wirkstoff: wirkstoffLabel,
                    kategorie: 'Kategorie',
                    marke: 'Marke',
                    fluessigkeit: 'Zugefügte Flüssigkeit',
                    rekonstituiert_am: 'Angemischt am',
                    haltbarkeit: haltbarkeitLabel,
                    vorrat: 'Vorrat',
                    // „Methode" und nicht „Applikationsart": im Zyklusknopf
                    // steht dasselbe Feld unter demselben Namen.
                    applikation: String(t('methode')),
                    batch: 'Batch',
                    quelle: 'Quelle',
                    analyse: 'Analyse-Dokument',
                    notizen: 'Notizen',
                  }
                  const zeileFuer = (feld: DetailFeld): InfoRow => {
                    const a = angaben[feld]
                    const wert = angabeText(feld, a)
                    // Ueber zwei Spalten, wo eine Zeile sonst abgeschnitten
                    // waere: ein Kombipraeparat, ein Dateiname, eine Notiz.
                    const wide = feld === 'analyse' || feld === 'notizen'
                      || (a.art === 'zutaten' && a.zutaten.length > 1)
                    if (a.art === 'datei') {
                      return {
                        label: FELD_LABEL[feld], wide,
                        valueNode: (
                          <a className="truncate text-cyan-300 hover:text-cyan-200" href={a.url} target="_blank" rel="noopener noreferrer">
                            {wert}
                          </a>
                        ),
                      }
                    }
                    return { label: FELD_LABEL[feld], value: wert, wide }
                  }
                  // Wie der Produktabschnitt heisst, folgt seinem INHALT —
                  // „Rekonstitution", wo eine Fluessigkeit zugefuegt wird,
                  // sonst „Bestand". Siehe `produktTitel`.
                  const ABSCHNITT_TITEL: Record<'substanz' | 'rekonstitution' | 'bestand', string> = {
                    substanz: 'Substanz',
                    rekonstitution: 'Rekonstitution',
                    bestand: 'Bestand',
                  }
                  return (
                    <>
                    {/* Bestand und Substanz: offen, nicht hinter einem
                        Akkordeon. Wer das Vollbild oeffnet, will sie sehen —
                        ein Klappknopf davor war eine Huerde ohne Gegenwert.
                        Die Darreichungsform entscheidet, welche Zeilen es
                        ueberhaupt gibt. */}
                    {detailAbschnitte(form).map(abschnitt => (
                      <section key={abschnitt.id} data-stack-detail={abschnitt.id} className="mx-1 mt-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/50">
                        <h3 className="border-b border-slate-800 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {ABSCHNITT_TITEL[abschnitt.id === 'substanz' ? 'substanz' : produktTitel(abschnitt)]}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 p-2 text-xs">
                          {abschnitt.felder.map(feld => {
                            const zeile = zeileFuer(feld)
                            return (
                              <div key={feld} data-stack-detail-field={feld} className={`min-h-14 rounded-lg border border-slate-800 bg-slate-900/55 px-2.5 py-2 ${'wide' in zeile && zeile.wide ? 'col-span-2' : ''}`}>
                                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{zeile.label}</p>
                                <div className="mt-1 truncate text-sm font-semibold text-slate-200">
                                  {'valueNode' in zeile ? zeile.valueNode : zeile.value}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </section>
                    ))}

                    {/*
                        Der Zyklus als KNOPF, nicht als Feld — und nach den
                        Angaben, nicht davor: erst was das IST (Substanz,
                        Zusammensetzung), dann was damit LAEUFT.
                        
                        Alles, was hier frueher ausgebreitet stand — Frequenz,
                        Start und Ende, Erinnerung, geplante Mengen,
                        Dosisanpassungen samt Bearbeiten und Loeschen —, zeigt
                        der Zyklusverwalter ohnehin. Es stand also zweimal da,
                        und die Vollbildseite wurde davon lang. Was bleibt, ist
                        die Zeile, die man im Vorbeigehen liest: wo im Zyklus
                        man steht, und ob er laeuft.

                        Der Schalter legt `active` um, der Punkt daneben zeigt
                        es. Beides nur, wenn es einen aktiven Zyklus gibt —
                        ohne einen waere ein Schalter ohne Gegenstueck.
                    */}
                    <div data-stack-detail="zyklus" className="mx-1 mt-2">
                      {activeCycle ? (
                        <div className="flex items-stretch gap-2">
                          <button
                            type="button"
                            onClick={() => setCycleManagerPeptide(activePeptide)}
                            className="flex min-h-14 flex-1 items-center gap-3 rounded-xl border border-violet-500/25 bg-slate-950/55 px-3 text-left transition-colors hover:border-violet-400/45"
                          >
                            <span className="relative flex h-2.5 w-2.5 shrink-0" data-zyklus-live>
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-white">{activeCycle.name}</span>
                              <span className="mt-0.5 block truncate text-xs text-slate-400">
                                {[t('tag') + ' ' + cycleDayLabel, activeQuantity ? `${activeQuantity.dose} ${activeQuantity.unit}` : null, activeFrequency]
                                  .filter(Boolean).join(' · ')}
                              </span>
                            </span>
                            <ChevronRight size={16} className="shrink-0 text-slate-600" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleCycleActive(activeCycle)}
                            aria-pressed={activeCycle.active}
                            aria-label={String(t('deaktivieren_title'))}
                            className="flex min-h-14 w-14 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-[10px] font-bold uppercase tracking-wide text-emerald-300 transition-colors hover:border-emerald-400/45"
                          >
                            <Pause size={15} />
                            {t('aktiv_badge')}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => (pCycles.length > 0 ? setCycleManagerPeptide(activePeptide) : openNewCycle(activePeptide))}
                          className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/55 px-3 text-left transition-colors hover:border-violet-400/35"
                        >
                          <Activity size={16} className="shrink-0 text-slate-600" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-white">
                              {pCycles.length > 0 ? t('kein_aktiver_zyklus') : t('noch_kein_zyklus')}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-slate-500">
                              {pCycles.length > 0
                                ? `${pCycles.length === 1 ? t('zyklus_count_one') : t('zyklus_count_many', { n: pCycles.length })} · ${t('keiner_aktiv')}`
                                : t('noch_kein_zyklus_desc')}
                            </span>
                          </span>
                          {pCycles.length > 0
                            ? <ChevronRight size={16} className="shrink-0 text-slate-600" />
                            : <Plus size={16} className="shrink-0 text-violet-300" />}
                        </button>
                      )}
                    </div>

                    {/* Verwalten zuletzt. Oben standen diese vier Knoepfe als
                        Erstes — mitsamt dem Loeschen, direkt unter dem Daumen,
                        bevor man ueberhaupt gesehen hat, was man da vor sich
                        hat. Was man liest, gehoert nach oben; was man am
                        Eintrag AENDERT, nach unten. */}
                    <div data-stack-detail="verwalten" className="mt-3 border-t border-slate-800/70 px-1 pt-3">
                      <h3 className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Verwalten</h3>
                <div className="flex flex-col gap-2 px-1 text-xs font-semibold">
                  {/* Dieselbe Regel wie bei den Angaben: wer nicht anmischt,
                      braucht auch keinen Knopf dafuer. Bei einem Pflaster stand
                      er hier und war fuer immer ausgegraut. */}
                  {zeigtFeld(form, 'fluessigkeit') && (
                  <button
                    type="button"
                    onClick={() => handleRekonstitution(activePeptide)}
                    disabled={!activePeptide.inventory_item_id}
                    className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-3 text-cyan-200 transition-colors hover:border-cyan-400/40 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/60 disabled:text-slate-600"
                  >
                    <RefreshCw size={14} /> Erneut anmischen
                  </button>
                  )}
                  {/* Zwei Tueren in denselben Raum: „Bearbeiten" fuehrt in den
                      Assistenten, „Vial-Tracking" in das aeltere Formular, und
                      die beiden schreiben in verschiedene Spalten (siehe
                      `produktAngaben.ts`). Solange das so ist, heisst hier
                      jede, was sie oeffnet — ein Zahnrad ohne Wort verschweigt
                      den Unterschied bloss. Das Vial-Tracking nur dort, wo es
                      ueberhaupt etwas tut: `openTrackingDetails` steigt bei
                      einer Form ohne Buehnenobjekt sofort wieder aus. */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEditPeptide(activePeptide)}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/70 px-2 text-slate-200 transition-colors hover:border-sky-400/40 hover:text-sky-300"
                    >
                      <Pencil size={14} /> Bearbeiten
                    </button>
                    {isStageRenderable(activePeptide.dosage_form) && (
                      <button
                        type="button"
                        onClick={() => openTrackingDetails(activePeptide)}
                        className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 px-2 text-violet-300 transition-colors hover:border-violet-400/40 hover:bg-violet-500/10"
                      >
                        <SlidersHorizontal size={14} /> Vial-Tracking
                      </button>
                    )}
                  </div>
                  {/* Abgesetzt und zuletzt. Es stand einmal ganz oben, direkt
                      unter dem Daumen. */}
                  <button
                    type="button"
                    onClick={() => removePeptide(activePeptide.id)}
                    className="mt-1 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-300 transition-colors hover:border-red-400/40 hover:bg-red-500/10"
                  >
                    <Trash2 size={14} /> Substanz löschen
                  </button>
                </div>                    </div>
                    </>
                  )
                })()}
    </>
  )

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
                          value={wirksameSortierung}
                          aria-label={t('sort_aria_label')}
                          onChange={e => setSortBy(e.target.value as PeptideSortKey)}
                        >
                          <option value="active_name">{t('sort_option_active_name')}</option>
                          {PEPTIDE_SORT_GROUPS
                            .filter(group => !group.needs || moeglicheSortierungen.has(group.needs))
                            .map(group => (
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

          {FEATURES.planTimelineV2 && timelineLoadError && (
            <div role="alert" className="mb-4 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
              <p>{t('my_stack_plan_load_error', { defaultValue: 'Die Einnahmepläne konnten nicht geladen werden. Die übrigen Daten bleiben sichtbar.' })}</p>
              <button
                type="button"
                disabled={timelineLoading}
                onClick={() => { void loadTimelines() }}
                className="mt-2 min-h-10 rounded-lg border border-rose-200/30 px-3 font-semibold disabled:opacity-50"
              >
                {t('lab_retry', { defaultValue: 'Erneut versuchen' })}
              </button>
            </div>
          )}

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
              <div
                className="pt-1"
                style={{
                  /*
                   * Die Buehne bekommt, was uebrig ist — statt einer geratenen
                   * Bildschirmhoehe.
                   *
                   * Vorher standen dort 46vh mit Deckel bei 26rem. Auf einem
                   * grossen Telefon blieb darunter ein totes Feld: 46 % einer
                   * hohen Anzeige sind weniger als das, was zwischen Reitern
                   * und Fussleiste frei ist. Jetzt wird abgezogen statt
                   * geschaetzt. Die 208 px sind die Summe dessen, was ober- und
                   * unterhalb der Buehne FEST steht, jede Zahl aus einer Klasse
                   * in diesem Bildschirm:
                   *
                   *   16  pt-4 am Seiteninhalt (Layout)
                   *   52  Kopfzeile: h-9 plus mb-4
                   *    4  pt-1 hier
                   *   48  Reiter: min-h-9, pb-1, mb-2
                   *   40  Zeile mit Pfeilen und Kennzeichen: h-9 plus mb-1
                   *    8  pb-2 am Streifen
                   *   20  Zeile fuer den Fuellstand: eine Zeile text-xs, mt-1
                   *   14  Positionsleiste: h-2.5 plus mt-1
                   *    6  Reserve gegen Rundung und andere Schriftgroessen
                   *
                   * dvh und nicht vh: auf dem Telefon zaehlt die Flaeche, die
                   * gerade zu sehen ist, nicht die ohne Adressleiste.
                   */
                  '--buehne-hoehe':
                    'calc(100dvh - var(--bottom-nav-height) - env(safe-area-inset-bottom) - 208px)',
                } as CSSProperties}
              >
                {/* Die Reiter: „Alle" und alle sechs Kategorien, feste Plaetze.
                    Leere bleiben stehen und sind gedimmt — „Medikamente" ohne
                    Inhalt sagt, dass die App das auch kann; versteckt saehe
                    das niemand. Die Leiste wischt waagerecht, das Karussell
                    darunter auch: deshalb ist sie flach, mit Pillen, und
                    deutlich abgesetzt. */}
                <div
                  data-stack-tabs
                  role="tablist"
                  aria-label={String(t('my_stack_category', { defaultValue: 'Kategorie' }))}
                  className="no-scrollbar -mx-3 mb-2 flex snap-x gap-2 overflow-x-auto px-3 pb-1"
                >
                  {STACK_TABS.map(reiter => {
                    const anzahl = reiterZaehler.get(reiter.key) ?? 0
                    const offen = reiter.key === activeTab
                    return (
                      <button
                        key={reiter.key}
                        type="button"
                        role="tab"
                        aria-selected={offen}
                        data-stack-tab={reiter.key}
                        data-stack-tab-count={anzahl}
                        onClick={() => reiterWechseln(reiter.key)}
                        className={`flex min-h-9 shrink-0 snap-start cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${offen
                          ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
                          : anzahl === 0
                            ? 'border-white/[0.06] bg-white/[0.02] text-slate-600'
                            : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-400/25'
                        }`}
                      >
                        {t(reiter.labelKey, { defaultValue: reiter.defaultValue })}
                        {anzahl > 0 && (
                          <span className={`text-xs font-semibold tabular-nums ${offen ? 'text-cyan-100/70' : 'text-slate-500'}`}>
                            {anzahl}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="mb-1 flex items-center justify-between px-3">
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
                          {activeIndex + 1} / {stagePeptides.length}
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
                  {/* Der breite, weichgezeichnete Spot ueber der ganzen
                      Flaeche liess das Objekt in Dunst schweben. Was „steht
                      auf etwas" macht, ist ein SCHMALER Schatten direkt unter
                      ihm — und ein Licht, das nur die Mitte trifft, nicht die
                      ganze Bahn. */}
                  <div
                    data-vial-detail="carousel-spotlight"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-1/4 top-6 bottom-14 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.16),rgba(34,211,238,0.05)_46%,transparent_74%)] blur-2xl"
                  />
                  <div
                    data-vial-detail="carousel-contact-shadow"
                    aria-hidden="true"
                    className="pointer-events-none absolute bottom-[3.25rem] left-1/2 h-3 w-[38%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.55),transparent_70%)] blur-[6px]"
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
                    // Die Buehne beherrscht den Bildschirm; die Nachbarn lugen
                    // nur noch herein. Damit man trotzdem weiss, wie viele es
                    // sind, stehen die Punkte darunter — sie sind hier keine
                    // Zierde, sondern der Ersatz fuer das, was die Breite
                    // verdeckt.
                    paddingInline: 'calc((100% - min(15rem, 62vw)) / 2)',
                    // Acht Pixel Schlupf, und zwar mit Absicht: ohne sie waere
                    // das Fangfenster (Streifenbreite minus diesem Rand) genau
                    // so breit wie ein Eintrag. Bei Gleichstand faellt das
                    // Einrasten laut Spezifikation von „mittig" auf „an die
                    // Kante" zurueck, und ein halbes Pixel Rundung entscheidet,
                    // welche der beiden Regeln gerade gilt. Genau so sah der
                    // Sprung aus, der nach dem Wischen kam: 25 bis 33 px
                    // daneben, und beim naechsten Anlass zurueck.
                    scrollPaddingInline: 'calc((100% - min(15rem, 62vw)) / 2 - 8px)',
                  }}
                >
                  <div
                    data-vial-add
                    data-vial-add-slot
                    className={`${vialItemSnapClassName} flex origin-bottom items-end min-h-[var(--buehne-hoehe)] shrink-0 rounded-2xl px-2 py-2 ${
                      isVialCarouselDragging ? 'transition-none' : 'transition-all duration-300'
                    } ${addTileActive ? 'scale-100' : 'scale-[0.82] opacity-45'}`}
                    style={{ width: 'min(15rem, 62vw)' }}
                  >
                    <AddVialTile
                      active={addTileActive}
                      onClick={() => { if (!vialSuppressClickRef.current) handleNewPeptide() }}
                      label={t('neues_peptid_title')}
                    />
                  </div>
                  {stagePeptides.map((p, index) => {
                    const isActive = p.id === activePeptide.id
                    const peptideColor = p.color_hex ?? getStableStackItemColor(p.id)
                    const vialPct = Math.round(getVialFillPct(p) ?? 100)
                    // Only forms whose fill level says something show it. A
                    // sealed ampoule would otherwise read "100 %" forever.
                    const showsFillPct = getDosageForm(p.dosage_form).stageForm?.hasMeaningfulFill ?? false

                    return (
                      <div
                        key={p.id}
                        data-vial-index={index}
                        // `origin-bottom`: alle Objekte stehen auf DERSELBEN
                        // Standlinie. Ohne das skaliert jedes um seine eigene
                        // Mitte, also schrumpfen die Nachbarn nach oben UND
                        // unten weg und schweben ueber dem Boden. Beim
                        // Formular-Karussell war das laengst entschieden; hier
                        // fehlte es, und bei 62 % Breite faellt es auf.
                        className={`${vialItemSnapClassName} origin-bottom shrink-0 rounded-2xl px-2 py-2 ${
                          isVialCarouselDragging ? 'transition-none' : 'transition-all duration-300'
                        } ${
                          isActive ? 'scale-100' : 'scale-[0.88] opacity-65 saturate-75'
                        }`}
                        style={{ width: 'min(15rem, 62vw)' }}
                        aria-label={p.name}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleVialCarouselItemClick(index)}
                        onKeyDown={e => handleVialCarouselItemKeyDown(e, index)}
                      >
                        {/* Eingepasst statt fest bemessen: jede Form bringt
                            eigene Pixelmasse mit — ein Pen ist 589 px hoch,
                            eine Kapsel 364 px breit. `StageFit` misst und
                            skaliert, damit beide die Flaeche fuellen, ohne
                            dass in elf Dateien elf neue Zahlen stehen.

                            `size="large"` und nicht `carousel`: die Buehne ist
                            gross, also muss die GEZEICHNETE Vorlage gross
                            sein. Mit `carousel` (80–125 px) lag der Faktor bei
                            rund 3 — und eine CSS-Skalierung vergroessert nicht
                            die Zeichnung, sondern das fertige Bild: laufende
                            Animationen und SVG-Filter (`feGaussianBlur` in
                            Vial und Tube) legen die Form auf eine eigene
                            Ebene, die in ihrer Layoutgroesse gerastert und
                            danach hochgezogen wird. Dazu ist die kleine
                            Zeichnung fuer klein entworfen: 1-px-Linien werden
                            zu 3-px-Balken, der Schriftanteil ist zu fett. Mit
                            `large` liegt der Faktor zwischen 0,64 (Pen) und
                            1,3 (Vial) — meist also VERKLEINERN, und das ist
                            immer scharf. Die Groesse auf dem Schirm aendert
                            sich nicht: eingepasst wird in dieselbe Flaeche. */}
                        <StageFit className="h-[var(--buehne-hoehe)] w-full" maxScale={1.6}>
                          <StackStage
                            key={animationEpoch}
                            item={{ ...p, color_hex: peptideColor }}
                            fillPct={vialPct}
                            animateOnMount={true}
                            isActive={isActive}
                            size="large"
                            stageLightRef={handle => {
                              const handles = vialStageLightHandlesRef.current
                              if (handle) handles.set(index, handle)
                              else handles.delete(index)
                            }}
                          />
                        </StageFit>
                        {/* Die Zeile steht IMMER, auch wenn nichts darin steht.
                            Sonst waere jeder Eintrag ohne Fuellstand — ein
                            Spray, ein Pflaster — eine Zeile kuerzer als einer
                            mit, und die Positionsleiste darunter huepfte bei
                            jedem Wisch mit. Reserviert wird der Platz mit
                            einem geschuetzten Leerzeichen; fuer die Vorlesung
                            ist die leere Zeile ausgeblendet. */}
                        <p
                          className="mt-1 text-center text-xs font-semibold tabular-nums text-slate-400"
                          aria-hidden={isActive && showsFillPct ? undefined : true}
                        >
                          {isActive && showsFillPct ? `${Math.round(vialPct)}%` : '\u00a0'}
                        </p>
                      </div>
                    )
                  })}
                </div>
                </SloshProvider>
                </div>

                {/* Wo bin ich. Bei 62 % Breite sind die Nachbarn nur noch
                    angeschnitten — ohne diese Zeile wuesste niemand, ob nach
                    dem dritten Wisch noch fuenf kommen oder einer. Bis zu
                    sieben Eintraege als Punkte zum Antippen, darueber eine
                    Leiste, weil fuenfzehn Punkte niemand mehr zaehlt. */}
                {stagePeptides.length > 1 && (
                  <div data-vial-position className="mt-1 flex items-center justify-center gap-1.5">
                    {stagePeptides.length <= 7 ? stagePeptides.map((p, index) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => scrollToPeptideIndex(index)}
                        aria-label={p.name}
                        aria-current={index === activeIndex}
                        data-vial-dot={index}
                        className={`h-2.5 rounded-full transition-all duration-300 ${
                          index === activeIndex ? 'w-6 bg-cyan-300' : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                        }`}
                      />
                    )) : (
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-cyan-300 transition-all duration-300"
                          style={{
                            width: `${100 / stagePeptides.length}%`,
                            marginInlineStart: `${(activeIndex / stagePeptides.length) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}


              </div>
            </div>
          )}

          {/* ── Peptid-Liste ────────────────────────────────────────────── */}
          <div className={`space-y-3 ${!loading && listPeptides.length > 0 ? '' : 'hidden'}`}>
            {/* Share the page slosh engine so list vials get the ambient living
                surface ripple. No impulses are pushed here, so the liquid never
                tilts/sloshes — only the surface breathes at rest. */}
            <SloshProvider engine={sloshEngine}>
            {listPeptides.map(p => {
              const pCycles   = cyclesOf(p.id)
              const pTimelines = timelinesOf(p.id)
              const planCount = FEATURES.planTimelineV2 ? pTimelines.length : pCycles.length
              const isOpen    = expandedId === p.id
              const hasActive = pCycles.some(c => c.active)
              const stageRenderable = isStageRenderable(p.dosage_form)
              const vialPct = getVialFillPct(p)
              const peptideColor = p.color_hex ?? getStableStackItemColor(p.id)
              const invItem = p.inventory_item_id ? inventory.find(i => i.id === p.inventory_item_id) : null

              return (
                <div key={p.id} className="card bg-slate-950">
                  {/* Kopfzeile */}
                  <div className="flex items-start gap-3">
                    {stageRenderable && (
                      <div className="flex w-16 shrink-0 flex-col items-center gap-0.5">
                        <StackStage
                          key={animationEpoch}
                          item={{ ...p, color_hex: peptideColor }}
                          fillPct={vialPct ?? 100}
                          animateOnMount={true}
                          isActive={false}
                          size="mini"
                          showLabel={false}
                        />
                        {vialPct !== null && (
                          <span className="text-[10px] font-bold tabular-nums leading-none text-slate-500">
                            {Math.round(vialPct)}%
                          </span>
                        )}
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
                          {stageRenderable ? (
                            <>
                              <span>{t(METHOD_KEYS[p.default_method] ?? p.default_method)}</span>
                              {p.vial_amount_mg && <span>Vial: {p.vial_amount_mg} {p.vial_amount_unit ?? 'mg'}</span>}
                            </>
                          ) : (
                            <>
                              <span>{t(`dosage_form_${p.dosage_form}`)}</span>
                              {p.ingredients.map(ingredient => {
                                const loadedIngredient = ingredient as LoadedStackItemIngredient
                                const ingredientName = ingredient.custom_name || loadedIngredient.substance_catalog?.canonical_name || p.name
                                return (
                                  <span key={ingredient.id ?? ingredient.position}>
                                    {ingredientName}: {ingredient.amount_value ?? '-'} {ingredient.amount_unit ?? ''} / {ingredient.basis_value ?? '-'} {ingredient.basis_unit ?? ''}
                                  </span>
                                )
                              })}
                            </>
                          )}
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
                          aria-label={t('bearbeiten')}
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
                          aria-label={t('loeschen')}
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
                      {planCount > 0 ? (planCount === 1 ? t('zyklus_count_one') : t('zyklus_count_many', { n: planCount })) : t('keine_zyklen')}
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
                      {planCount === 0 && (
                        <p className="text-slate-500 text-sm text-center py-4">
                          {t('noch_kein_zyklus')}
                        </p>
                      )}
                      {FEATURES.planTimelineV2 && pTimelines.map(timeline => planManagementSection(p, timeline))}
                      {!FEATURES.planTimelineV2 && pCycles.map(c => {
                        const pEscs = escalationsOf(c.id)
                        return (
                          <div data-cycle-id={c.id} key={c.id} className={`rounded-xl border ${c.active ? 'border-violet-500/30 bg-violet-500/5' : 'border-slate-800 opacity-60'}`}>
                            <div className="flex items-start justify-between gap-2 p-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-white truncate">{c.name}</p>
                                <div className="flex flex-wrap gap-x-3 text-slate-400 text-xs mt-0.5">
                                  {dosePlanCapabilities(p.tracking_level).permanent && (
                                    <span className="font-medium text-slate-300">{currentQuantityLabel(c)}</span>
                                  )}
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
                                {dosePlanCapabilities(p.tracking_level).permanent && plannedQuantityRows(c)}
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
                                <button
                                  className="p-1.5 text-slate-400 hover:text-sky-400 transition-colors"
                                  aria-label={t('bearbeiten')}
                                  onClick={() => openEditCycle(p, c.id)}
                                ><Pencil size={13} /></button>
                                <button className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                                  onClick={() => removeCycle(c.id)}><Trash2 size={13} /></button>
                              </div>
                            </div>

                            {dosePlanCapabilities(p.tracking_level).titration && (
                            /* Dosisanpassungen */
                            <div className="border-t border-slate-800/60 px-3 pb-3 pt-2">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                  <SlidersHorizontal size={12} className="text-orange-400" /> {t('dosiserhoehungen')}
                                </span>
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
                                            <AdjustmentIcon size={11} /> {escalationQuantityLabel(c, e)}
                                          </span>
                                          {!escalationIsActive(c, e) && <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('dose_plan_planned', { defaultValue: 'Geplant' })}</span>}
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
                              <div className="mt-2">
                                <DosePlanActions
                                  trackingLevel={p.tracking_level}
                                  onPermanent={() => openEditCycle(p, c.id)}
                                  onTitration={() => openNewEsc(c)}
                                />
                              </div>
                            </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            </SloshProvider>
          </div>
      </div>

      {/* ZYKLUS-MANAGER */}
      {cycleManagerPeptide && FEATURES.planTimelineV2 && (
        <div className="fixed inset-0 z-50 flex justify-center bg-slate-950" data-app-modal>
          <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-slate-950">
            <div className="shrink-0 border-b border-slate-800 px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top))]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
                    {t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' })}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-bold text-white">{cycleManagerPeptide.name}</h2>
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
              {timelinesOf(cycleManagerPeptide.id).map(timeline => (
                planManagementSection(cycleManagerPeptide, timeline)
              ))}
              {timelinesOf(cycleManagerPeptide.id).length === 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                  <p className="text-sm font-semibold text-white">{t('noch_kein_zyklus')}</p>
                  <p className="mt-1 text-xs text-slate-500">{t('noch_kein_zyklus_desc')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {cycleManagerPeptide && !FEATURES.planTimelineV2 && (() => {
        const managerCycles = cyclesOf(cycleManagerPeptide.id)
        const activeCycles = managerCycles.filter(c => c.active)
        const inactiveCycles = managerCycles.filter(c => !c.active)

        const cycleIcons = (c: Cycle) => (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => { openEditCycle(cycleManagerPeptide, c.id); setCycleManagerPeptide(null) }}
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
              {dosePlanCapabilities(cycleManagerPeptide.tracking_level).permanent && (
                <span className="font-semibold text-slate-200">{currentQuantityLabel(c)}</span>
              )}
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
            {dosePlanCapabilities(cycleManagerPeptide.tracking_level).permanent && plannedQuantityRows(c)}
            {/* Die Planstufen samt „Stufe zuruecknehmen" standen frueher auf der
                Vollbildseite. Seit der Zyklus dort nur noch ein Knopf ist, gehoeren
                sie hierher — nicht in den Papierkorb. */}
            {planStufenListe(c)}
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
          if (!dosePlanCapabilities(cycleManagerPeptide.tracking_level).titration) return null
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
                    <span className="shrink-0 font-semibold text-white">{scheduledQuantityLabel(c, parseISO(c.start_date))}</span>
                  </div>
                  {pEscs.map((e, idx) => {
                    const AdjustmentIcon = doseAdjustmentIcon(c, e)
                    return (
                      <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                        <div className="min-w-0 text-xs">
                          <p className="flex items-center gap-1 truncate font-semibold text-white">
                            <AdjustmentIcon size={12} /> #{idx + 1} {escalationQuantityLabel(c, e)}
                          </p>
                          {!escalationIsActive(c, e) && <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('dose_plan_planned', { defaultValue: 'Geplant' })}</p>}
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
                  <DosePlanActions
                    trackingLevel={cycleManagerPeptide.tracking_level}
                    onPermanent={() => { openEditCycle(cycleManagerPeptide, c.id); setCycleManagerPeptide(null) }}
                    onTitration={() => { openNewEsc(c); setCycleManagerPeptide(null) }}
                  />
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
                    {dosePlanCapabilities(cycleManagerPeptide.tracking_level).permanent ? currentQuantityLabel(c) : ''}
                    {c.end_date ? ` · ${t('bis_datum', { date: format(parseISO(c.end_date), 'dd.MM.yyyy') })}` : ''}
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
      {/* Das Vollbild hinter einem Objekt. Der Uebergang ist FLIP: das Objekt
          wird an seinem Platz im Karussell gemessen und fliegt von dort an
          seine Stelle hier oben, dabei verkleinert. Waehrend des Flugs ist die
          Fluessigkeitsphysik still. */}
      {detailUrsprung && activePeptide && (
        <StageDetailSheet
          originRect={detailUrsprung}
          onClose={() => setDetailUrsprung(null)}
          onFlightChange={imFlug => sloshEngine.setEnabled(!imFlug)}
          title={activePeptide.name}
          subtitle={(() => {
            // Die eine Zeile unter dem Namen: was der laufende Plan sagt.
            const laufend = cyclesOf(activePeptide.id).find(c => c.active)
            if (!laufend) return null
            return [freqLabel(laufend), intakeLabel(laufend)].filter(Boolean).join(' · ')
          })()}
          stage={(
            <SloshProvider engine={sloshEngine}>
              <div style={{ width: 'min(9rem, 38vw)' }}>
                <StackStage
                  item={{ ...activePeptide, color_hex: activePeptide.color_hex ?? getStableStackItemColor(activePeptide.id) }}
                  fillPct={Math.round(getVialFillPct(activePeptide) ?? 100)}
                  isActive
                  size="carousel"
                />
              </div>
            </SloshProvider>
          )}
        >
          {eintragDetails()}
        </StageDetailSheet>
      )}

      {showPeptideForm && (
        <StackItemWizard
          catalogEntries={catalogEntries}
          catalogUnavailable={catalogUnavailable}
          existingItems={peptides}
          existingItem={editingPeptideId ? peptides.find(item => item.id === editingPeptideId) : undefined}
          {...(planEditContext
            ? { planEditContext, onSavePlanChange: saveVersionChange }
            : {
                existingPlan: editingPeptideId && wizardCycleId && !wizardNeuerZyklus
                  ? cycles.find(cycle => cycle.id === wizardCycleId && cycle.stack_item_id === editingPeptideId)
                    ? cycleAsIntakePlanDraft(
                        cycles.find(cycle => cycle.id === wizardCycleId && cycle.stack_item_id === editingPeptideId)!,
                        new Date(),
                      )
                    : undefined
                  : undefined,
              })}
          initialColorHex={wizardInitialColor}
          intent={wizardIntent}
          onClose={() => {
            setShowPeptideForm(false)
            setWizardIntent(undefined)
            setWizardNeuerZyklus(false)
            setWizardCycleId(null)
            setPlanEditContext(null)
            if (!planSaveRecoveryRef.current?.committed) planSaveRecoveryRef.current = null
          }}
          onSave={handleSaveStackItem}
          onOpenExisting={openExistingStackItem}
        />
      )}

      {showTrackingForm && (
        <VialTrackingEditor
          editingPeptideId={editingPeptideId}
          pForm={pForm}
          setPForm={setPForm}
          batchFile={batchFile}
          setBatchFile={setBatchFile}
          savingPeptide={savingPeptide}
          uploadingFile={uploadingFile}
          onClose={() => setShowTrackingForm(false)}
          onSave={saveTrackingDetails}
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
        <StackArchive
          ref={archiveDialogRef}
          labelledBy="archive-title"
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
                          <StackStage
                            item={{ ...p, color_hex: '#64748b' }}
                            fillPct={0}
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
                            data-archive-info-button={p.id}
                            onClick={() => openArchiveInfo(p)}
                            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-300 transition-colors hover:border-cyan-400/45 hover:bg-cyan-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                            aria-label={t('infos')}
                            title={t('infos')}
                          >
                            <Info size={16} />
                          </button>
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
          {archiveInfoPeptide && (() => {
            const p = archiveInfoPeptide
            const archivedCycles = cycles
              .filter(c => c.stack_item_id === p.id)
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
            const invItem = inventory.find(item => item.id === p.inventory_item_id)
            const syringeMl = p.syringe_type?.split(':')[0]
            const syringeUnits = p.syringe_type?.split(':')[1]
            const dateFormatter = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language)
            const formatStoredDate = (value: string | null) => value ? dateFormatter.format(parseISO(value)) : '-'
            const expiryDate = p.reconstitution_date && p.expiry_days
              ? dateFormatter.format(addDays(parseISO(p.reconstitution_date), p.expiry_days))
              : '-'
            const archivedDate = formatStoredDate(p.archived_at)
            const applicationRows: InfoRow[] = [
              {
                label: t('wirkstoff_pro_vial'),
                value: p.vial_amount_mg !== null ? `${p.vial_amount_mg} ${p.vial_amount_unit ?? 'mg'}` : '-',
              },
              {
                label: t('zugefuegte_fluessigkeit'),
                value: p.reconstitution_ml !== null ? `${p.reconstitution_ml} mL` : '-',
              },
              {
                label: t('applikation_info'),
                value: p.default_method ? t(METHOD_KEYS[p.default_method] ?? p.default_method) : '-',
              },
              {
                label: t('spritzen_typ'),
                value: syringeMl && syringeUnits ? `${syringeMl} mL ? ${syringeUnits} ${t('einh_kurz')}` : '-',
              },
            ]
            const stockRows: InfoRow[] = [
              { label: t('datum_rekonstitution'), value: formatStoredDate(p.reconstitution_date) },
              { label: t('haltbarkeit_tage'), value: p.expiry_days !== null ? `${p.expiry_days}` : '-' },
              { label: t('ablauf_label'), value: expiryDate },
              {
                label: t('bestand_section'),
                value: p.vials_in_stock !== null
                  ? `${p.vials_in_stock} / ${p.vials_initial ?? '-'} ${t('vials')}`
                  : '-',
              },
              {
                label: t('vorraetige_vials'),
                value: invItem ? t('vials_vorratig', { n: invItem.vials_count }) : '-',
                wide: true,
              },
            ]
            const documentationRows: InfoRow[] = [
              { label: t('batch'), value: p.batch_number || '-' },
              { label: t('quelle'), value: p.batch_source || '-' },
              {
                label: t('analyse_dokument_section'),
                wide: true,
                valueNode: p.batch_file_url
                  ? (
                    <a
                      href={p.batch_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-2 text-cyan-300 hover:text-cyan-200"
                    >
                      <span className="truncate">{p.batch_file_url.split('/').pop() || t('dokument_oeffnen')}</span>
                      <ExternalLink size={14} className="shrink-0" />
                    </a>
                  )
                  : <span>-</span>,
              },
              { label: t('notizen_section'), value: p.notes || '-', wide: true },
            ]
            const renderInfoRows = (rows: InfoRow[]) => (
              <dl className="grid grid-cols-1 gap-x-5 sm:grid-cols-2">
                {rows.map(row => (
                  <div
                    key={row.label}
                    className={`min-w-0 border-b border-slate-800/70 py-3 ${row.wide ? 'sm:col-span-2' : ''}`}
                  >
                    <dt className="text-xs font-medium text-slate-500">{row.label}</dt>
                    <dd className="mt-1 break-words text-sm font-semibold text-slate-200">
                      {row.valueNode ?? row.value ?? '-'}
                    </dd>
                  </div>
                ))}
              </dl>
            )

            return (
              <div
                data-archive-info-detail={p.id}
                className="fixed inset-0 z-[60] flex min-h-dvh flex-col bg-slate-950"
                role="dialog"
                aria-modal="true"
                aria-labelledby="archive-info-title"
              >
                <header className="shrink-0 border-b border-slate-800 bg-slate-950/95 pt-[env(safe-area-inset-top)] backdrop-blur">
                  <div className="mx-auto flex min-h-16 w-full max-w-3xl items-center gap-3 px-4">
                    <button
                      type="button"
                      ref={archiveInfoBackButtonRef}
                      onClick={() => {
                        setArchiveInfoPeptide(null)
                        window.requestAnimationFrame(() => {
                          document.querySelector<HTMLButtonElement>(`[data-archive-info-button="${p.id}"]`)?.focus()
                        })
                      }}
                      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:border-slate-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                      aria-label={t('back')}
                      title={t('back')}
                    >
                      <ChevronLeft size={19} />
                    </button>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('archiv')}</p>
                      <h2 id="archive-info-title" className="truncate text-lg font-bold text-white">{p.name}</h2>
                    </div>
                  </div>
                </header>

                <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <div className="mx-auto w-full max-w-3xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
                    <div className="flex items-center gap-5 py-5">
                      <div className="flex w-20 shrink-0 justify-center opacity-80" aria-hidden="true">
                        <StackStage
                          item={{ ...p, color_hex: '#64748b' }}
                          fillPct={0}
                          animateOnMount={false}
                          isActive={false}
                          size="compact"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-xl font-bold text-white">{p.name}</p>
                        {p.archived_at && (
                          <p className="mt-1 text-sm text-slate-500">
                            {t('archiviert_am', { date: archivedDate })}
                          </p>
                        )}
                      </div>
                    </div>

                    <section className="border-t border-slate-800 py-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                        {t('wirkstoff_rekonstitution')}
                      </h3>
                      {renderInfoRows(applicationRows)}
                    </section>

                    <section className="border-t border-slate-800 py-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                        {t('haltbarkeit_section_info')} &amp; {t('bestand_section')}
                      </h3>
                      {renderInfoRows(stockRows)}
                    </section>

                    <section className="border-t border-slate-800 py-4">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                        {t('batch_herkunft_section')}
                      </h3>
                      {renderInfoRows(documentationRows)}
                    </section>

                    <section className="border-t border-slate-800 py-4">
                      <button
                        type="button"
                        onClick={() => setArchiveCyclesOpen(open => !open)}
                        aria-expanded={archiveCyclesOpen}
                        aria-controls="archive-cycle-list"
                        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
                          {t('zyklen_header')}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-xs font-medium text-slate-500">
                            {t(archivedCycles.length === 1 ? 'zyklus_count_one' : 'zyklus_count_many', { n: archivedCycles.length })}
                          </span>
                          {archiveCyclesOpen
                            ? <ChevronUp size={16} className="text-slate-400" />
                            : <ChevronDown size={16} className="text-slate-400" />}
                        </span>
                      </button>

                      {archiveCyclesOpen && (
                        <div id="archive-cycle-list">
                      {archivedCycles.length === 0 ? (
                        <p className="py-6 text-center text-sm text-slate-500">{t('keine_zyklen')}</p>
                      ) : (
                        <div className="mt-2 divide-y divide-slate-800/80">
                          {archivedCycles.map(c => (
                            <article key={c.id} data-archive-cycle className="py-4">
                              <div className="flex items-start justify-between gap-3">
                                <p className="min-w-0 break-words text-sm font-bold text-white">{c.name}</p>
                                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${c.active ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                                  {t(c.active ? 'aktiv_badge' : 'inaktiv_badge')}
                                </span>
                              </div>
                              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                                <div className="col-span-2 sm:col-span-3">
                                  <dt className="text-xs text-slate-500">{t('obx_cycdates_title')}</dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-200">
                                    {formatStoredDate(c.start_date)} - {c.end_date ? formatStoredDate(c.end_date) : t('ende_offen')}
                                  </dd>
                                </div>
                                {dosePlanCapabilities(p.tracking_level).permanent && (
                                  <div>
                                    <dt className="text-xs text-slate-500">{t('dosis_label')}</dt>
                                    <dd className="mt-0.5 text-sm font-medium text-slate-200">{currentQuantityLabel(c)}</dd>
                                  </div>
                                )}
                                <div>
                                  <dt className="text-xs text-slate-500">{t('frequenz')}</dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-200">{freqLabel(c)}</dd>
                                </div>
                                <div>
                                  <dt className="text-xs text-slate-500">{t('methode')}</dt>
                                  <dd className="mt-0.5 text-sm font-medium text-slate-200">
                                    {t(METHOD_KEYS[c.method] ?? c.method)}
                                  </dd>
                                </div>
                              </dl>
                            </article>
                          ))}
                        </div>
                      )}
                        </div>
                      )}
                    </section>
                  </div>
                </main>
              </div>
            )
          })()}
        </StackArchive>
      )}

      {/* ══ ZYKLUS-FORMULAR ══════════════════════════════════════════════════ */}
      {/* Das eigene Zyklusformular ist entfallen. Es schrieb direkt in
          `cycles` — am RPC vorbei, ohne dessen Pruefungen, und mit einer
          zweiten, engeren Segmentlogik. „Plan aendern" fuehrt jetzt durch
          den Assistenten (`intent: 'plan'`) und damit durch
          `save_stack_item_with_plan`. */}

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
                  {editingEscId ? t('esc_bearbeiten') : t('dose_plan_add_titration', { defaultValue: 'Titrationsschritt hinzufügen' })}
                </h2>
              </div>
              {escForCycle && <p className="text-slate-400 text-sm mt-0.5 ml-6">{escForCycle.name}</p>}
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {t('dose_plan_titration_disclaimer', {
                  defaultValue: 'Die App dokumentiert deinen Titrationsplan; sie empfiehlt weder eine Dosis noch eine Titration.',
                })}
              </p>
            </div>

            <div data-ob="esc-core" className="space-y-4">
            <div data-ob="esc-amount">
              <label className="label">Absolute Zieldosis</label>
              <div className="flex gap-2">
                <input className="input flex-1" type="number"
                  value={eForm.increase_amount}
                  onChange={e => setEForm(f => f ? { ...f, increase_amount: e.target.value } : f)} />
                <DoseUnitControl
                  label={t('einheit_label')}
                  unit={eForm.unit}
                  units={UNITS}
                  locked
                  className="w-28"
                  onChange={() => undefined}
                />
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
                    onClick={() => setEForm(f => {
                      if (!f || !escForCycle) return f
                      return withEffectiveEscalationUnit(escForCycle, { ...f, start_type: opt.value })
                    })}
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
                  onChange={e => setEForm(f => {
                    if (!f || !escForCycle) return f
                    return withEffectiveEscalationUnit(escForCycle, { ...f, start_date: e.target.value })
                  })} />
              </div>
            )}
            {eForm.start_type === 'after_days' && (
              <div data-ob="esc-when-detail">
                <label className="label">{t('tage_nach_start')}</label>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm shrink-0">{t('nach_prefix')}</span>
                  <input className="input w-24" type="number" min="1"
                    value={eForm.start_after_days}
                    onChange={e => setEForm(f => {
                      if (!f || !escForCycle) return f
                      return withEffectiveEscalationUnit(escForCycle, { ...f, start_after_days: e.target.value })
                    })} />
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
                    onChange={e => setEForm(f => {
                      if (!f || !escForCycle) return f
                      return withEffectiveEscalationUnit(escForCycle, { ...f, start_after_days: e.target.value })
                    })} />
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
