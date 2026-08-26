import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, startOfWeek, endOfWeek, isSameMonth, addDays,
  differenceInDays, parseISO,
} from 'date-fns'
import {
  Bell, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Clock,
  Moon, Pin, RotateCcw, Sun, Sunrise, Syringe, TrendingUp, X, XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { getStackItemColor } from '../features/my-stack/lib/colors'
import { getDateLocale } from '../i18n/dateLocales'
import { cycleAppliesToDay, effectiveQuantity, resolveScheduleSlots, scheduleForDay, AUTO_MISSED_NOTE, type ResolvedRoutineGroup, type ScheduleSegment } from '../lib/intakeSchedule'
import { debitPeptideStockForDoseById } from '../features/my-stack/extensions/peptide/vialStock'
import { formatTrackedQuantity, hasTrackedQuantity } from '../features/routines/quantityPresentation'
import {
  groupRoutineIntakes,
  routineGroupFromMinutes,
  type RoutineConfirmationEntry,
  type RoutineGroupModel,
  type RoutineIntake,
} from '../features/routines/intakeGroups'
import { confirmIntakeGroup, quantifiedVialEntries, type IntakeConfirmationClient } from '../features/routines/services/intakeConfirmation'
import { RoutineConfirmationSheet } from '../features/routines/components/RoutineConfirmationSheet'
import {
  applyInventoryConfirmation,
  InventoryConfirmationError,
  reverseInventoryConfirmation,
} from '../features/my-stack/services/stackInventory'
import { buildInjectionTrackerUrl, isInjectableMethod } from '../lib/injectionDeepLink'
import { GlassPanel, PageShell } from '../components/ui/DesignSystem'
import { CarouselCounter, CarouselPagination } from '../components/CarouselChrome'

interface DoseLog {
  id: string
  stack_item_id: string
  dose: number | null
  unit: string | null
  method: string
  logged_at: string
  notes: string | null
  taken: boolean | null
  stack_items: { display_name: string }
}

interface Cycle {
  id: string
  name: string
  stack_item_id: string
  dose: number | null
  unit: string | null
  method: string
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  start_date: string
  end_date: string | null
  active: boolean
  intake_time: string | null
  intake_time_custom: string | null
  schedule_history: ScheduleSegment[] | null
  stack_items: { display_name: string; tracking_level: 'intake_only' | 'with_amount' | 'complete' }
}

interface StackItem {
  id: string; display_name: string; default_method: string
  dosage_form: string | null
  tracking_level: 'intake_only' | 'with_amount' | 'complete'
  vial_amount_mg: number | null; reconstitution_ml: number | null
  vials_in_stock: number | null; vials_initial: number | null
  reconstitution_date: string | null; expiry_days: number | null
}

interface Escalation {
  id: string
  cycle_id: string
  increase_amount: number
  unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null
  start_after_days: number | null
}

interface DashboardRoutineIntakeInput {
  key: string
  cycleId: string
  pendingLogId: string | null
  stackItemId: string
  stackItemName: string
  trackingLevel: Cycle['stack_items']['tracking_level']
  routineGroup: ResolvedRoutineGroup
  minutes: number
  scheduledAt: string
  dose: number | null
  unit: string | null
  method: string
}

export function buildDashboardRoutineIntake(input: DashboardRoutineIntakeInput): RoutineIntake {
  const intakeOnly = input.trackingLevel === 'intake_only'
  return {
    key: input.key,
    cycleId: input.cycleId,
    pendingLogId: input.pendingLogId,
    stackItemId: input.stackItemId,
    stackItemName: input.stackItemName,
    trackingLevel: input.trackingLevel,
    group: input.routineGroup,
    scheduledAt: input.scheduledAt,
    dose: intakeOnly ? null : input.dose,
    unit: intakeOnly ? null : input.unit,
    method: input.method,
    injectable: isInjectableMethod(input.method),
  }
}

interface DashboardQuantity {
  dose: number | null
  unit: string | null
}

function resolveDashboardCycleQuantity(
  cycle: Cycle,
  day: Date,
  escalations: Escalation[],
): DashboardQuantity {
  if (cycle.stack_items?.tracking_level === 'intake_only') return { dose: null, unit: null }
  return effectiveQuantity(cycle, day, escalations) ?? { dose: null, unit: null }
}

function cycleIntakeMinutes(c: Cycle, day: Date): number {
  return resolveScheduleSlots(scheduleForDay(c, day))[0]?.minutes ?? 25 * 60
}

interface DaySlot {
  key: string
  minutes: number
  time: string
  groupKey: IntakeGroupKey
  routineGroup: ResolvedRoutineGroup
}

// Expand a cycle's intake times into individual day-slots for a given day (segment-resolved).
function cycleSlots(c: Cycle, day: Date): DaySlot[] {
  const seg = scheduleForDay(c, day)
  const out: DaySlot[] = resolveScheduleSlots(seg).map(slot => ({
    key: slot.key === 'custom' ? slot.time : slot.key,
    minutes: slot.minutes,
    time: slot.time,
    groupKey: slot.routineGroup === 'morning'
      ? 'morgens' as const
      : slot.routineGroup === 'midday'
        ? 'mittags' as const
        : 'abends' as const,
    routineGroup: slot.routineGroup,
  }))
  if (out.length === 0) out.push({ key: 'later', minutes: 25 * 60, time: '', groupKey: 'later', routineGroup: 'morning' })
  return out
}

// Timestamp on a given day at the slot's planned minute (defaults to noon for "later").
function slotTimestamp(day: Date, minutes: number): string {
  const d = new Date(day)
  const safe = minutes >= 24 * 60 ? 12 * 60 : minutes
  d.setHours(Math.floor(safe / 60), safe % 60, 0, 0)
  return d.toISOString()
}

type IntakeGroupKey = 'morgens' | 'mittags' | 'abends' | 'custom' | 'later'

function intakePeriodFromMinutes(minutes: number): 'morgens' | 'mittags' | 'abends' {
  const group = routineGroupFromMinutes(minutes)
  if (group === 'morning') return 'morgens'
  if (group === 'midday') return 'mittags'
  return 'abends'
}

type PeriodKey = 'morgens' | 'mittags' | 'abends'

function slotPeriod(slot: { groupKey: IntakeGroupKey; minutes: number }): PeriodKey {
  if (slot.groupKey === 'morgens' || slot.groupKey === 'mittags' || slot.groupKey === 'abends') {
    return slot.groupKey
  }
  return intakePeriodFromMinutes(slot.minutes)
}

const PERIOD_ORDER: PeriodKey[] = ['morgens', 'mittags', 'abends']
const PERIOD_TO_ROUTINE_GROUP = {
  morgens: 'morning',
  mittags: 'midday',
  abends: 'evening',
} as const

function defaultDuePeriod(
  day: Date,
  periods: { key: PeriodKey; slots: unknown[] }[],
): PeriodKey {
  if (isToday(day)) {
    const now = new Date()
    return intakePeriodFromMinutes(now.getHours() * 60 + now.getMinutes())
  }
  return periods.find(period => period.slots.length > 0)?.key ?? 'morgens'
}

function intakeGroupMeta(key: IntakeGroupKey, t: (key: string) => string): { icon: LucideIcon; label: string } {
  if (key === 'morgens') return { icon: Sunrise, label: t('morgens') }
  if (key === 'mittags') return { icon: Sun, label: t('mittags') }
  if (key === 'abends') return { icon: Moon, label: t('abends') }
  if (key === 'custom') return { icon: Clock, label: t('uhrzeit_label') }
  return { icon: Pin, label: t('ausstehend') }
}

function timeLabel(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const date = new Date(dateStr)
  const h    = date.getHours()
  const time = format(date, 'HH:mm')
  if (h >= 5  && h < 12) return t('morgens_uhr', { time })
  if (h >= 12 && h < 18) return t('mittags_uhr', { time })
  if (h >= 18)            return t('abends_uhr', { time })
  return `${time} Uhr`
}

function cycleLogTimestamp(cycle: Cycle, day: Date): string {
  const date = new Date(day)
  const minutes = cycleIntakeMinutes(cycle, day)
  const safeMinutes = minutes >= 24 * 60 ? 12 * 60 : minutes
  date.setHours(Math.floor(safeMinutes / 60), safeMinutes % 60, 0, 0)
  return date.toISOString()
}

const calendarLegendText: CSSProperties = {
  fontSize: '0.66rem',
  color: 'var(--text-dim)',
  fontWeight: 700,
}

function CalendarInfoPill({
  label,
  value,
  accent,
}: {
  label: string
  value: number | string
  accent: string
}) {
  return (
    <div
      style={{
        minWidth: 0,
        borderRadius: 14,
        border: `1px solid ${accent}2d`,
        background: `linear-gradient(145deg, ${accent}14, rgba(6,10,24,0.72))`,
        padding: '8px 10px',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 14px ${accent}10`,
      }}
    >
      <p style={{ color: accent, fontWeight: 900, fontSize: '0.95rem', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ color: 'var(--text-dim)', fontSize: '0.6rem', fontWeight: 780, marginTop: 4 }}>
        {label}
      </p>
    </div>
  )
}

function IntakePeriodCarousel<T>({
  items,
  getKey,
  renderItem,
}: {
  items: T[]
  getKey: (item: T) => string
  renderItem: (item: T) => ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const hasMultiple = items.length > 1

  const updateScrollHints = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const pageWidth = Math.max(1, el.clientWidth)
    const index = Math.round(el.scrollLeft / pageWidth)
    setActiveIndex(Math.min(items.length - 1, Math.max(0, index)))
    setCanScrollLeft(el.scrollLeft > 6)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6)
  }, [items.length])

  useEffect(() => {
    updateScrollHints()
  }, [items.length, updateScrollHints])

  const scrollToIndex = (index: number) => {
    const el = scrollRef.current
    if (!el) return
    const next = Math.min(items.length - 1, Math.max(0, index))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }

  const scrollByPage = (direction: -1 | 1) => {
    scrollToIndex(activeIndex + direction)
  }

  const arrowClass = (active: boolean) => [
    'flex shrink-0 items-center justify-center transition-opacity duration-200',
    'w-[14px] text-sky-300/25 hover:text-sky-300/55',
    hasMultiple ? '' : 'invisible pointer-events-none',
    active ? 'opacity-100' : 'opacity-35 pointer-events-none',
  ].join(' ')

  const trackRow = (
    <div className="grid grid-cols-[14px_minmax(0,1fr)_14px] items-stretch gap-0.5">
      <button
        type="button"
        aria-label="Vorherige Einnahme"
        aria-hidden={!hasMultiple}
        disabled={!hasMultiple || !canScrollLeft}
        onClick={() => scrollByPage(-1)}
        className={arrowClass(canScrollLeft)}
      >
        <ChevronLeft size={13} strokeWidth={1.5} />
      </button>
      <div
        ref={scrollRef}
        onScroll={updateScrollHints}
        className={[
          'min-w-0 flex-1 flex overflow-x-auto snap-x snap-mandatory select-none',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        ].join(' ')}
        style={{ touchAction: 'pan-x' }}
      >
        {items.map(item => (
          <div
            key={getKey(item)}
            className="w-full shrink-0 snap-center snap-always"
          >
            {renderItem(item)}
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-hidden={!hasMultiple}
        disabled={!hasMultiple || !canScrollRight}
          aria-label="Nächste Einnahme"
          onClick={() => scrollByPage(1)}
        className={arrowClass(canScrollRight)}
      >
        <ChevronRight size={13} strokeWidth={1.5} />
      </button>
    </div>
  )

  return (
    <div className="space-y-2">
      {trackRow}
      <div className="relative flex h-5 items-center px-0.5">
        {hasMultiple && (
          <>
            <CarouselCounter activeIndex={activeIndex} count={items.length} tone="amber" />
            <div className="pointer-events-none absolute inset-x-0 flex justify-center">
              <div className="pointer-events-auto">
                <CarouselPagination
                  count={items.length}
                  activeIndex={activeIndex}
                  onSelect={scrollToIndex}
                  accent="#fbbf24"
                  label="Einnahme"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Minimum horizontal swipe distance to trigger month change
const SWIPE_THRESHOLD = 80

interface DashboardProps {
  dashboardDataClient?: typeof supabase
}

export function Dashboard({ dashboardDataClient = supabase }: DashboardProps = {}) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const locale = getDateLocale()
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [logs, setLogs] = useState<DoseLog[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [stackItems, setStackItems] = useState<StackItem[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])

  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  // Einnahme-Bestätigungs-Sheet
  interface ConfirmSheet { cycle?: Cycle; log?: DoseLog }
  const [confirmSheet, setConfirmSheet] = useState<ConfirmSheet | null>(null)
  const [routineGroupSheet, setRoutineGroupSheet] = useState<RoutineGroupModel | null>(null)
  const [confirmTime, setConfirmTime]   = useState('')
  const [completedExpanded, setCompletedExpanded] = useState(false)
  const [inventoryRetryIds, setInventoryRetryIds] = useState<string[]>([])
  const [calendarExpanded, setCalendarExpanded] = useState(false)
  const [activeDuePeriod, setActiveDuePeriod] = useState<PeriodKey>('morgens')

  // Horizontal swipe state
  const calendarSwipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const [calendarDragX, setCalendarDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [peekDir, setPeekDir] = useState<-1 | 0 | 1>(0)

  const changeMonth = useCallback((delta: number) => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }, [])

  const changeWeek = useCallback((delta: number) => {
    setSelectedDay(prev => {
      const next = new Date(prev)
      next.setDate(next.getDate() + delta * 7)
      setCurrentDate(new Date(next.getFullYear(), next.getMonth(), 1))
      return next
    })
  }, [])

  const selectCalendarDay = useCallback((day: Date) => {
    setSelectedDay(day)
    if (day.getMonth() !== currentDate.getMonth() || day.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(day.getFullYear(), day.getMonth(), 1))
    }
  }, [currentDate])

  const handleCalendarPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    calendarSwipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    setIsDragging(true)
  }

  const handleCalendarPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = calendarSwipeStart.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    // Only track if horizontal movement is meaningful and dominant
    if (Math.abs(deltaX) < 6) return
    if (Math.abs(deltaY) > Math.abs(deltaX) * 0.8) return
    event.preventDefault()
    setCalendarDragX(deltaX)
    const dir = (deltaX < 0 ? 1 : -1) as -1 | 1
    if (peekDir !== dir) setPeekDir(dir)
  }

  const handleCalendarPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = calendarSwipeStart.current
    calendarSwipeStart.current = null
    setIsDragging(false)
    setCalendarDragX(0)
    setPeekDir(0)
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y

    // Tap: select day
    if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-calendar-date]')
      const dateKey = button?.dataset.calendarDate
      if (dateKey) {
        const [year, month, date] = dateKey.split('-').map(Number)
        selectCalendarDay(new Date(year, month - 1, date))
      }
      return
    }

    // Swipe: require horizontal dominance + minimum distance
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      if (calendarExpanded) changeMonth(deltaX < 0 ? 1 : -1)
      else changeWeek(deltaX < 0 ? 1 : -1)
    }
  }

  const handleCalendarPointerCancel = () => {
    calendarSwipeStart.current = null
    setIsDragging(false)
    setCalendarDragX(0)
    setPeekDir(0)
  }

  const loadLogs = useCallback(async () => {
    if (!user) return
    const today = new Date()
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const rangeStart = monthStart < today ? monthStart : today
    const rangeEnd = monthEnd > today ? monthEnd : today
    const start = format(rangeStart, 'yyyy-MM-dd')
    const end = format(rangeEnd, 'yyyy-MM-dd')
    const { data } = await dashboardDataClient
      .from('dose_logs')
      .select('*, stack_items(display_name)')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lte('logged_at', end + 'T23:59:59')
      .order('logged_at', { ascending: true })
    if (data) setLogs(data as DoseLog[])
  }, [currentDate, dashboardDataClient, user])

  const loadCycles = useCallback(async () => {
    if (!user) return
    const { data } = await dashboardDataClient
      .from('cycles')
      .select('*, stack_items(display_name, tracking_level)')
      .eq('user_id', user.id)
      .eq('active', true)
    if (data) setCycles(data as Cycle[])
  }, [dashboardDataClient, user])

  const loadStackItems = useCallback(async () => {
    if (!user) return
    const { data } = await dashboardDataClient.from('stack_items').select('*').eq('user_id', user.id).eq('archived', false).order('display_name')
    if (data) setStackItems(data)
  }, [dashboardDataClient, user])

  const loadEscalations = useCallback(async () => {
    if (!user) return
    const { data } = await dashboardDataClient.from('dose_escalations').select('*').eq('user_id', user.id)
    if (data) setEscalations(data as Escalation[])
  }, [dashboardDataClient, user])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        void loadLogs()
        void loadCycles()
      }
    })
    return () => { cancelled = true }
  }, [loadCycles, loadLogs])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        void loadStackItems()
        void loadEscalations()
      }
    })
    return () => { cancelled = true }
  }, [loadEscalations, loadStackItems])

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
  })

  const weekStart = startOfWeek(selectedDay, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(selectedDay, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const visibleCalendarDays = calendarExpanded ? calendarDays : weekDays

  const weekTitle = isSameMonth(weekStart, weekEnd)
    ? `${format(weekStart, 'd.', { locale })}–${format(weekEnd, 'd. MMMM yyyy', { locale })}`
    : `${format(weekStart, 'd. MMM', { locale })} – ${format(weekEnd, 'd. MMM yyyy', { locale })}`
  const monthTitle = format(currentDate, 'MMMM yyyy', { locale })
  const calendarTitle = calendarExpanded ? monthTitle : weekTitle

  // Peek month/week (adjacent period shown while swiping)
  const peekDate = peekDir !== 0
    ? calendarExpanded
      ? new Date(currentDate.getFullYear(), currentDate.getMonth() + peekDir, 1)
      : addDays(selectedDay, peekDir * 7)
    : null
  const peekCalendarDays = peekDate
    ? calendarExpanded
      ? eachDayOfInterval({
          start: startOfWeek(startOfMonth(peekDate), { weekStartsOn: 1 }),
          end: endOfWeek(endOfMonth(peekDate), { weekStartsOn: 1 }),
        })
      : eachDayOfInterval({
          start: startOfWeek(peekDate, { weekStartsOn: 1 }),
          end: endOfWeek(peekDate, { weekStartsOn: 1 }),
        })
    : []

  const logsForDay = (day: Date) => logs.filter(l => isSameDay(new Date(l.logged_at), day))
  const cyclesForDay = (day: Date) => cycles.filter(c => cycleAppliesToDay(c, day))

  const selLogs     = logsForDay(selectedDay)
  const selCycles   = cyclesForDay(selectedDay)
  const isTodaySelected = isToday(selectedDay)
  // Vergangener Tag (vor heute): nicht bestätigte Slots gelten als „verpasst".
  const isPastSelected = format(selectedDay, 'yyyy-MM-dd') < format(new Date(), 'yyyy-MM-dd')
  const selectedDayTitle = isTodaySelected
    ? t('heutige_einnahmen')
    : format(selectedDay, 'EEEE, d. MMMM', { locale })
  const confirmedLogs = selLogs.filter(log => log.taken !== null)
  const confirmedLogsSorted = [...confirmedLogs].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())

  // Per-slot due list: expand each cycle into its individual intake slots, then drop the
  // slots already covered (in time order) by decided logs (taken !== null) for that stack item.
  // Reset logs (taken === null) keep a slot "due" and are reused on confirm to avoid duplicates.
  interface DueSlot { key: string; cycle: Cycle; minutes: number; time: string; groupKey: IntakeGroupKey; routineGroup: ResolvedRoutineGroup; pendingLog?: DoseLog }
  const decidedByStackItem = new Map<string, number>()
  const pendingByStackItem = new Map<string, DoseLog[]>()
  for (const log of selLogs) {
    if (log.taken !== null) decidedByStackItem.set(log.stack_item_id, (decidedByStackItem.get(log.stack_item_id) ?? 0) + 1)
    else { const arr = pendingByStackItem.get(log.stack_item_id) ?? []; arr.push(log); pendingByStackItem.set(log.stack_item_id, arr) }
  }
  const slotsByStackItem = new Map<string, DueSlot[]>()
  for (const cycle of selCycles) {
    for (const s of cycleSlots(cycle, selectedDay)) {
      const arr = slotsByStackItem.get(cycle.stack_item_id) ?? []
      arr.push({ key: `${cycle.id}-${s.minutes}`, cycle, minutes: s.minutes, time: s.time, groupKey: s.groupKey, routineGroup: s.routineGroup })
      slotsByStackItem.set(cycle.stack_item_id, arr)
    }
  }
  const dueSlots: DueSlot[] = []
  let totalDaySlots = 0
  for (const [stackItemId, slots] of slotsByStackItem) {
    totalDaySlots += slots.length
    const ordered = [...slots].sort((a, b) => a.minutes - b.minutes)
    const decided = decidedByStackItem.get(stackItemId) ?? 0
    const pendings = [...(pendingByStackItem.get(stackItemId) ?? [])]
    ordered.slice(decided).forEach(slot => {
      slot.pendingLog = pendings.shift()
      dueSlots.push(slot)
    })
  }
  const completedDaySlots = totalDaySlots - dueSlots.length
  const dueSlotByKey = new Map(dueSlots.map(slot => [slot.key, slot]))
  const dueRoutineGroups = groupRoutineIntakes(dueSlots.map(slot => {
    const trackingLevel = slot.cycle.stack_items?.tracking_level ?? 'complete'
    return buildDashboardRoutineIntake({
      key: slot.key,
      cycleId: slot.cycle.id,
      pendingLogId: slot.pendingLog?.id ?? null,
      stackItemId: slot.cycle.stack_item_id,
      stackItemName: slot.cycle.stack_items?.display_name ?? '',
      trackingLevel,
      routineGroup: slot.routineGroup,
      minutes: slot.minutes,
      scheduledAt: slot.pendingLog?.logged_at ?? slotTimestamp(selectedDay, slot.minutes),
      ...resolveDashboardCycleQuantity(slot.cycle, selectedDay, escalations),
      method: slot.cycle.method,
    })
  }))
  const dueRoutineGroupByKey = new Map(dueRoutineGroups.map(group => [group.key, group]))
  const duePeriodCarousels = PERIOD_ORDER.map(key => {
    const routineGroup = dueRoutineGroupByKey.get(PERIOD_TO_ROUTINE_GROUP[key]) ?? null
    return {
      key,
      ...intakeGroupMeta(key, t),
      routineGroup,
      slots: routineGroup?.items.map(item => dueSlotByKey.get(item.key)).filter((slot): slot is DueSlot => Boolean(slot)) ?? [],
    }
  })
  const activeDuePeriodData = duePeriodCarousels.find(period => period.key === activeDuePeriod)
    ?? duePeriodCarousels[0]

  useEffect(() => {
    setActiveDuePeriod(defaultDuePeriod(selectedDay, duePeriodCarousels))
  }, [selectedDay])

  useEffect(() => {
    if (location.hash !== '#due-intakes') return
    const dateParam = new URLSearchParams(location.search).get('date')
    const parsed = dateParam ? parseISO(dateParam) : null
    const target = parsed && !isNaN(parsed.getTime()) ? parsed : new Date()
    setSelectedDay(target)
    setCurrentDate(new Date(target.getFullYear(), target.getMonth(), 1))
  }, [location.hash, location.search])

  useEffect(() => {
    if (location.hash !== '#due-intakes') return
    const scrollToDue = () => {
      document.getElementById('due-intakes')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    const timer = window.setTimeout(scrollToDue, 150)
    return () => window.clearTimeout(timer)
  }, [location.hash, location.search, dueSlots.length, selCycles.length, logs.length])

  const applyGenericInventory = async (doseLogId: string, showPageRetry = true) => {
    try {
      await applyInventoryConfirmation(dashboardDataClient, doseLogId)
      if (showPageRetry) {
        setInventoryRetryIds(current => current.filter(id => id !== doseLogId))
      }
      return true
    } catch {
      if (showPageRetry) {
        setInventoryRetryIds(current => current.includes(doseLogId) ? current : [...current, doseLogId])
        toast.error(t('inventory_update_failed', { defaultValue: 'Bestand konnte nicht aktualisiert werden' }))
      }
      return false
    }
  }

  const deleteLog = async (log: DoseLog) => {
    if (!confirm(t('eintrag_loeschen'))) return
    const stackItem = stackItems.find(item => item.id === log.stack_item_id)
    const reversesInventory = log.taken === true
      && (stackItem?.dosage_form === 'vial' || stackItem?.tracking_level === 'complete')
    if (reversesInventory) {
      try {
        await reverseInventoryConfirmation(dashboardDataClient, log.id, 'delete')
      } catch {
        return toast.error(t('error'))
      }
    } else {
      const { error } = await dashboardDataClient.from('dose_logs').delete().eq('id', log.id)
      if (error) return toast.error(t('error'))
    }
    toast.success(t('deleted')); loadLogs(); loadStackItems()
  }

  const confirmDose = async (log: DoseLog, taken: boolean, loggedAt?: string, quantity?: DashboardQuantity) => {
    const previousTaken = log.taken
    const stackItem = stackItems.find(item => item.id === log.stack_item_id)
    const update: Record<string, unknown> = { taken }
    if (taken && loggedAt) update.logged_at = loggedAt
    if (quantity) {
      update.dose = quantity.dose
      update.unit = quantity.unit
    }
    const reversesInventory = previousTaken === true
      && taken !== true
      && (stackItem?.dosage_form === 'vial' || stackItem?.tracking_level === 'complete')
    if (reversesInventory) {
      try {
        await reverseInventoryConfirmation(dashboardDataClient, log.id, 'skip')
      } catch {
        return toast.error(t('error'))
      }
    } else {
      const { error } = await dashboardDataClient.from('dose_logs').update(update).eq('id', log.id)
      if (error) return toast.error(t('error'))
    }
    const confirmedQuantity = quantity ?? log
    if (previousTaken !== true && taken === true && hasTrackedQuantity(confirmedQuantity)) {
      if (stackItem?.dosage_form === 'vial') {
        await applyGenericInventory(log.id)
      } else if (stackItem?.tracking_level === 'complete') {
        await applyGenericInventory(log.id)
      }
    }
    loadLogs(); loadStackItems()
    if (taken) toast.success(t('einnahme_bestaetigt'))
    else toast(t('einnahme_uebersp_toast'), { icon: '⏭️' })
  }

  const undoDose = async (log: DoseLog) => {
    const stackItem = stackItems.find(item => item.id === log.stack_item_id)
    const reversesInventory = log.taken === true
      && (stackItem?.dosage_form === 'vial' || stackItem?.tracking_level === 'complete')
    if (reversesInventory) {
      try {
        await reverseInventoryConfirmation(dashboardDataClient, log.id, 'undo')
      } catch {
        return toast.error(t('error'))
      }
    } else {
      const { error } = await dashboardDataClient.from('dose_logs').update({ taken: null }).eq('id', log.id)
      if (error) return toast.error(t('error'))
    }
    loadLogs(); loadStackItems()
    toast.success(t('dose_undo_success', { defaultValue: 'Einnahme zurückgesetzt' }))
  }

  const confirmCycleDose = async (cycle: Cycle, taken: boolean, loggedAt?: string) => {
    if (!user) return
    const quantity = resolveDashboardCycleQuantity(cycle, selectedDay, escalations)
    const { data: savedLog, error } = await dashboardDataClient.from('dose_logs').insert({
      user_id: user.id,
      stack_item_id: cycle.stack_item_id,
      dose: quantity.dose,
      unit: quantity.unit,
      method: cycle.method,
      logged_at: loggedAt ?? cycleLogTimestamp(cycle, selectedDay),
      taken,
    }).select('id').single()
    if (error) return toast.error(t('fehler_speichern'))
    const stackItem = stackItems.find(item => item.id === cycle.stack_item_id)
    if (taken && hasTrackedQuantity(quantity)) {
      if (stackItem?.dosage_form === 'vial') {
        if (savedLog?.id) await applyGenericInventory(savedLog.id)
      } else if (
        cycle.stack_items?.tracking_level === 'complete'
        && savedLog?.id
      ) {
        await applyGenericInventory(savedLog.id)
      }
    }
    loadLogs(); loadStackItems()
    if (taken) toast.success(t('einnahme_bestaetigt'))
    else toast(t('einnahme_uebersp_toast'), { icon: '⏭️' })
  }

  // ── Bestätigungs-Sheet ───────────────────────────────────────────────────
  const openConfirmSheet = (cycle?: Cycle, log?: DoseLog, slotTime?: string) => {
    let defaultTime: string
    if (cycle && slotTime) {
      defaultTime = slotTime
    } else if (cycle) {
      const intakeMin = cycleIntakeMinutes(cycle, selectedDay)
      const safe = intakeMin >= 24 * 60 ? 12 * 60 : intakeMin
      defaultTime = `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`
    } else if (log) {
      const d = new Date(log.logged_at)
      defaultTime = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    } else {
      const now = new Date()
      defaultTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    }
    setConfirmTime(defaultTime)
    setConfirmSheet({ cycle, log })
  }

  const openInjectionTrackerForSlot = (slot: DueSlot) => {
    const returnTo = `/kalender?date=${format(selectedDay, 'yyyy-MM-dd')}#due-intakes`
    navigate(buildInjectionTrackerUrl({
      doseLogId: slot.pendingLog?.id ?? null,
      cycleId: slot.cycle.id,
      scheduledAt: slot.pendingLog?.logged_at ?? slotTimestamp(selectedDay, slot.minutes),
      returnTo,
    }))
  }

  const handleConfirmSheet = async () => {
    if (!confirmSheet) return
    const [h, m] = confirmTime.split(':').map(Number)
    if (confirmSheet.cycle) {
      const day = new Date(selectedDay)
      day.setHours(h, m, 0, 0)
      if (confirmSheet.log) await confirmDose(
        confirmSheet.log,
        true,
        day.toISOString(),
        resolveDashboardCycleQuantity(confirmSheet.cycle, selectedDay, escalations),
      )
      else                  await confirmCycleDose(confirmSheet.cycle, true, day.toISOString())
    } else if (confirmSheet.log) {
      const logDate = new Date(confirmSheet.log.logged_at)
      logDate.setHours(h, m, 0, 0)
      await confirmDose(confirmSheet.log, true, logDate.toISOString())
    }
    setConfirmSheet(null)
  }

  const confirmRoutineGroup = async (entries: RoutineConfirmationEntry[]): Promise<string[]> => {
    return confirmIntakeGroup(
      dashboardDataClient as unknown as IntakeConfirmationClient,
      entries,
    )
  }

  const afterRoutineGroupConfirmed = async (
    entries: RoutineConfirmationEntry[],
    savedLogIds: string[],
  ) => {
    const vialStackItemIds = new Set(
      stackItems.filter(item => item.dosage_form === 'vial').map(item => item.id),
    )
    const selectedEntries = entries.filter(entry => entry.selected)
    const confirmedEntries = selectedEntries.map((entry, index) => ({
      entry,
      doseLogId: savedLogIds[index],
    })).filter(item => Boolean(item.doseLogId))
    const stockUpdates = user
      ? quantifiedVialEntries(entries, vialStackItemIds).map(async entry => {
          const doseLogId = confirmedEntries.find(item => item.entry.key === entry.key)?.doseLogId
          if (!doseLogId) return
          await debitPeptideStockForDoseById(dashboardDataClient, doseLogId)
        })
      : []
    const genericEntries = confirmedEntries.filter(({ entry }) => (
      entry.trackingLevel === 'complete'
      && !vialStackItemIds.has(entry.stackItemId)
    ))
    const [stockResults, inventoryResults] = await Promise.all([
      Promise.allSettled(stockUpdates),
      Promise.allSettled(genericEntries.map(({ doseLogId }) => (
        applyGenericInventory(doseLogId, false)
      ))),
    ])
    await loadLogs()
    await loadStackItems()
    toast.success(t('einnahme_bestaetigt', { defaultValue: 'Einnahme bestätigt' }))
    const failedVialIds = quantifiedVialEntries(entries, vialStackItemIds)
      .map(entry => confirmedEntries.find(item => item.entry.key === entry.key)?.doseLogId)
      .filter((doseLogId, index): doseLogId is string => (
        Boolean(doseLogId) && stockResults[index].status === 'rejected'
      ))
    const failedInventoryIds = genericEntries
      .filter((_, index) => (
        inventoryResults[index].status === 'rejected'
        || inventoryResults[index].value === false
      ))
      .map(item => item.doseLogId)
    const failedDoseLogIds = [...failedVialIds, ...failedInventoryIds]
    if (failedDoseLogIds.length > 0) {
      throw new InventoryConfirmationError(failedDoseLogIds)
    }
  }

  const openRoutineInjection = (entry: RoutineIntake, doseLogId: string) => {
    const returnTo = `/kalender?date=${format(selectedDay, 'yyyy-MM-dd')}#due-intakes`
    navigate(buildInjectionTrackerUrl({
      doseLogId,
      cycleId: entry.cycleId,
      scheduledAt: entry.scheduledAt,
      returnTo,
    }))
  }

  const snoozeDose = (log: DoseLog, minutes: number) => {
    const time = minutes < 60 ? `${minutes} min` : `${minutes / 60} h`
    toast(t('erinnerung_toast', { time }), { icon: '⏰' })
    setTimeout(() => {
      toast(
        t('dose_nicht_best', { name: log.stack_items?.display_name, dose: log.dose, unit: log.unit }),
        { icon: <Syringe size={18} />, duration: 10000 }
      )
    }, minutes * 60 * 1000)
  }

  // ── Day cell renderer ─────────────────────────────────────────────────────
  const today = new Date()
  const renderDayCell = (day: Date, monthDate: Date, key: number, isPeek: boolean, weekMode = false) => {
    const inMonth = weekMode || day.getMonth() === monthDate.getMonth()
    const isSelected = !isPeek && isSameDay(day, selectedDay)
    const isTodayDay = isToday(day)
    // Tag-genau vergleichen (nicht mit Uhrzeit) — sonst gilt „morgen" < 24h als heute/vergangen.
    const dayKey = format(day, 'yyyy-MM-dd')
    const todayKey = format(today, 'yyyy-MM-dd')
    const isFuture = dayKey > todayKey

    const dayCycles = isPeek ? [] : cyclesForDay(day)
    const dayLogsList = isPeek ? [] : logsForDay(day)

    // Status nur für Tage des angezeigten Monats — Füll-Tage des Vor-/Folgemonats
    // bleiben neutral (deren Logs sind im aktuellen Bereich nicht geladen → sonst
    // fälschlich „verpasst"/rot).
    const hasCycle = inMonth && dayCycles.length > 0

    // All planned cycles for this day have been taken
    const fullyTracked = !isFuture && hasCycle
      && dayCycles.every(c => dayLogsList.some(l => l.stack_item_id === c.stack_item_id && l.taken === true))

    // At least one escalation is active on this day
    const hasEscalation = hasCycle && dayCycles.some(c => {
      const cycleStart = parseISO(c.start_date)
      return escalations.some(e => {
        if (e.cycle_id !== c.id) return false
        if (e.start_type === 'date' && e.start_date) return day >= parseISO(e.start_date)
        if (e.start_after_days != null)
          return differenceInDays(day, cycleStart) >= e.start_after_days
        return false
      })
    })

    // Vergangener Tag mit geplanter, aber nicht (vollständig) genommener Einnahme → verpasst.
    const isPastDay = dayKey < todayKey
    const hasMissed = isPastDay && hasCycle && !fullyTracked

    return (
      <button
        key={key}
        data-calendar-date={!isPeek ? format(day, 'yyyy-MM-dd') : undefined}
        {...(isTodayDay && !isPeek ? { 'data-ob': 'ob-cal-today' } : {})}
        className={[
          'relative flex flex-col items-center border-r border-b last:border-r-0 transition-all duration-150 select-none',
          !inMonth ? 'opacity-20' : '',
          isPeek ? 'pointer-events-none' : '',
        ].filter(Boolean).join(' ')}
        style={{
          padding: '8px 0 6px',
          minHeight: 52,
          borderColor: 'var(--border)',
          background: isSelected
            ? 'linear-gradient(145deg, rgba(0,190,240,0.85), rgba(0,120,210,0.75))'
            : hasMissed ? 'rgba(239,68,68,0.10)'
            : fullyTracked ? 'rgba(16,185,129,0.10)'
            : 'transparent',
          boxShadow: isSelected
            ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 16px rgba(0,200,240,0.25)'
            : undefined,
        }}
      >
        {/* Today ring */}
        {isTodayDay && !isSelected && (
          <span
            className="absolute inset-0.5 rounded-xl pointer-events-none"
            style={{ boxShadow: '0 0 0 1.5px rgba(0,204,245,0.60), 0 0 6px rgba(0,204,245,0.12)' }}
          />
        )}

        {/* Date number */}
        <span className={`text-sm font-black leading-none ${
          isSelected ? 'text-white' :
          isTodayDay ? 'text-sky-400' :
          hasMissed ? 'text-red-400' :
          inMonth ? 'text-slate-200' : 'text-slate-600'
        }`}>
          {format(day, 'd')}
        </span>

        {/* Three markers */}
        <div className="flex gap-0.5 mt-1.5 h-1.5 items-center">
          {/* Cyan: dose planned but not yet fully tracked (heute/zukünftig) */}
          {hasCycle && !fullyTracked && !hasMissed && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: isSelected ? 'rgba(255,255,255,0.85)' : 'var(--accent)',
                boxShadow: isSelected ? undefined : '0 0 4px #00ccf555',
              }}
            />
          )}
          {/* Rot: vergangener Tag mit verpasster Einnahme */}
          {hasMissed && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: isSelected ? 'rgba(255,255,255,0.85)' : '#ef4444',
                boxShadow: isSelected ? undefined : '0 0 4px #ef444455',
              }}
            />
          )}
          {/* Orange: escalation active */}
          {hasEscalation && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: isSelected ? 'rgba(255,255,255,0.85)' : '#f97316',
                boxShadow: isSelected ? undefined : '0 0 4px #f9731655',
              }}
            />
          )}
          {/* Green: all doses taken */}
          {fullyTracked && (
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: isSelected ? 'rgba(255,255,255,0.85)' : '#10b981',
                boxShadow: isSelected ? undefined : '0 0 4px #10b98155',
              }}
            />
          )}
        </div>
      </button>
    )
  }

  const renderDueSlotCard = (slot: DueSlot) => {
    const c = slot.cycle
    const segment = scheduleForDay(c, selectedDay)
    const { dose, unit } = resolveDashboardCycleQuantity(c, selectedDay, escalations)
    const baseDose = c.stack_items?.tracking_level === 'intake_only' ? null : segment.dose
    const isEscalated = dose != null && baseDose != null && dose !== baseDose
    const doseLabel = formatTrackedQuantity(dose, unit, String(t('quantity_not_tracked', { defaultValue: 'Menge nicht getrackt' })))
    const pendingLog = slot.pendingLog
    const cycleEscs = escalations.filter(e => e.cycle_id === c.id)
    const activeEscCount = cycleEscs.filter(e => {
      if (e.start_type === 'date' && e.start_date)
        return selectedDay >= parseISO(e.start_date)
      if (e.start_after_days != null)
        return differenceInDays(selectedDay, parseISO(c.start_date)) >= e.start_after_days
      return false
    }).length
    const slotMeta = intakeGroupMeta(slot.groupKey, t)
    const stackItemColor = getStackItemColor(stackItems.findIndex(item => item.id === c.stack_item_id))

    return (
      <div
        className="h-[188px] w-full rounded-xl border px-3 py-2.5 transition-colors"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: stackItemColor, boxShadow: `0 0 10px ${stackItemColor}80` }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white">{c.stack_items?.display_name}</span>
              <span className={`text-xs font-semibold ${isEscalated ? 'text-orange-400' : 'text-slate-300'}`}>
                {doseLabel}
              </span>
              {isEscalated && (
                <span className="flex items-center gap-0.5 text-orange-400 text-xs">
                  <TrendingUp size={11} /> {t('stufe_n', { n: activeEscCount })}
                </span>
              )}
              <span className="text-slate-500 text-xs">{c.method}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-amber-400 flex items-center gap-1">
                {(() => { const Ic = slotMeta.icon; return <Ic size={12} /> })()}
                {slot.time || slotMeta.label}
              </span>
              {isEscalated && unit?.trim() && (
                <span className="text-slate-600 text-xs">
                  {t('basis_label')} {baseDose} {unit} · +{dose - baseDose} {unit}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="mt-2 rounded-xl border px-2.5 py-2"
          style={isPastSelected ? {
            background: 'linear-gradient(90deg, rgba(239,68,68,0.14), rgba(239,68,68,0.05))',
            borderColor: 'rgba(239,68,68,0.34)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
          } : {
            background: 'linear-gradient(90deg, rgba(245,158,11,0.14), rgba(245,158,11,0.055))',
            borderColor: 'rgba(245,158,11,0.34)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 16px rgba(245,158,11,0.12)',
          }}
        >
          <div className={`mb-2 flex items-center gap-2 ${isPastSelected ? 'text-red-300' : 'text-amber-300'}`}>
            {isPastSelected ? <XCircle size={12} /> : <Bell size={12} className="animate-pulse" />}
            <span className="text-[11px] font-extrabold uppercase tracking-wide">
              {isPastSelected
                ? t('verpasst', { defaultValue: 'Verpasst' })
                : t('dose_confirm_pending_badge', { defaultValue: 'Bestätigung offen' })}
            </span>
          </div>
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => openConfirmSheet(c, pendingLog ?? undefined, slot.time || undefined)}
                className="flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25">
                <Check size={11} /> <span className="truncate">{isPastSelected ? t('dose_mark_taken', { defaultValue: 'Doch eingenommen' }) : t('eingenommen')}</span>
              </button>
              <button
                onClick={() => pendingLog
                  ? confirmDose(pendingLog, false, undefined, resolveDashboardCycleQuantity(c, selectedDay, escalations))
                  : confirmCycleDose(c, false, slotTimestamp(selectedDay, slot.minutes))}
                className="flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-lg border border-red-500/25 bg-red-500/15 px-2 py-1 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/25">
                <XCircle size={11} /> <span className="truncate">{t('uebersprungen')}</span>
              </button>
            </div>
            <div className="h-9">
              {isInjectableMethod(c.method) && (
              <button
                onClick={() => openInjectionTrackerForSlot(slot)}
                className="flex h-full w-full min-w-0 items-center justify-center gap-1 rounded-lg border border-sky-500/25 bg-sky-500/15 px-2.5 py-1 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/25">
                <Syringe size={11} /> <span className="truncate">Mit Injektion bestätigen</span>
              </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderConfirmedLog = (log: DoseLog) => (
    <div key={log.id} className={`px-3 py-2.5 border rounded-xl transition-colors ${
      log.taken === true
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : log.taken === false
          ? 'bg-red-500/5 border-red-500/20'
          : 'bg-sky-500/5 border-sky-500/15'
    }`}>
      <div className="flex items-center gap-3">
        <Syringe size={14} className={`shrink-0 ${
          log.taken === true ? 'text-emerald-400' :
          log.taken === false ? 'text-red-400' : 'text-sky-400'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm">{log.stack_items?.display_name ?? t('geloeschte_substanz')}</span>
            <span className={`text-xs font-semibold ${
              log.taken === true ? 'text-emerald-400' :
              log.taken === false ? 'text-red-400' : 'text-sky-400'
            }`}>{formatTrackedQuantity(log.dose, log.unit, String(t('quantity_not_tracked', { defaultValue: 'Menge nicht getrackt' })))}</span>
            <span className="text-slate-500 text-xs">{log.method}</span>
            {log.taken === true && (
              <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-medium">
                <Check size={11} /> {t('eingenommen')}
              </span>
            )}
            {log.taken === false && (
              <span className="flex items-center gap-0.5 text-red-400 text-xs font-medium">
                <XCircle size={11} /> {log.notes === AUTO_MISSED_NOTE
                  ? t('verpasst', { defaultValue: 'Verpasst' })
                  : t('uebersprungen')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-slate-500 text-xs">{timeLabel(log.logged_at, t)}</span>
            {log.notes && log.notes !== AUTO_MISSED_NOTE && <span className="text-slate-600 text-xs truncate">· {log.notes}</span>}
          </div>
        </div>
        <button aria-label={t('eintrag_loeschen')} className="p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
          onClick={() => deleteLog(log)}>
          <X size={13} />
        </button>
      </div>

      {log.taken === null && (
        <div className="flex gap-2 mt-2 ml-[26px]">
          <button
            onClick={() => openConfirmSheet(undefined, log)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors">
            <Check size={11} /> {t('eingenommen')}
          </button>
          <button
            onClick={() => confirmDose(log, false)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors">
            <XCircle size={11} /> {t('uebersprungen')}
          </button>
        </div>
      )}

      {log.taken !== null && (
        <div className="flex gap-2 mt-2 ml-[26px]">
          {log.taken === false && (
            <button
              onClick={() => openConfirmSheet(undefined, log)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors">
              <Check size={11} /> {t('dose_mark_taken', { defaultValue: 'Doch eingenommen' })}
            </button>
          )}
          <button
            onClick={() => undoDose(log)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60 transition-colors">
            <RotateCcw size={11} /> {t('dose_undo', { defaultValue: 'Rückgängig' })}
          </button>
        </div>
      )}

      {log.taken === false && (
        <div className="mt-2 ml-[26px]">
          <p className="text-slate-500 text-xs mb-1.5 flex items-center gap-1">
            <Bell size={10} /> {t('erinnere_nochmal')}
          </p>
          <div className="flex gap-1.5 flex-wrap">
            {[15, 30, 60, 120].map(min => (
              <button
                key={min}
                onClick={() => snoozeDose(log, min)}
                className="text-xs px-2 py-0.5 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60 transition-colors">
                {min < 60 ? `${min} min` : `${min / 60} h`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
    <PageShell>
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="shrink-0 text-sky-400" />
        <h2 className="font-semibold text-white">{t('nav_kalender')}</h2>
      </div>

      {inventoryRetryIds.length > 0 && (
        <div role="alert" className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm font-bold text-amber-200">
          <p>{t('inventory_committed_retry', { defaultValue: 'Die Einnahme ist gespeichert, aber der Bestand wurde nicht aktualisiert.' })}</p>
          <button
            type="button"
            onClick={() => void Promise.all(inventoryRetryIds.map(id => applyGenericInventory(id)))}
            className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/15 px-3 text-sm font-black text-amber-100 transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <RotateCcw size={15} aria-hidden="true" /> {t('inventory_retry', { defaultValue: 'Bestand erneut versuchen' })}
          </button>
        </div>
      )}

      {/* ── Kalender ──────────────────────────────────────────────────────── */}
      <div data-ob="calendar-main" data-ob-self>
      <GlassPanel accent="#00ccf5" padding="sm" style={{ padding: 0 }}>

        {/* Header */}
        <div style={{ padding: '12px 12px 10px' }}>
          <div className="flex items-center justify-between gap-2">
            {/* Month title with arrow buttons */}
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => calendarExpanded ? changeMonth(-1) : changeWeek(-1)}
                aria-label={calendarExpanded
                  ? t('prev_month', { defaultValue: 'Vorheriger Monat' })
                  : t('prev_week', { defaultValue: 'Vorherige Woche' })}
                className="p-1.5 rounded-xl text-sky-400 hover:bg-sky-400/10 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <h2
                className="text-base font-black tracking-[-0.03em] text-white text-center"
                style={{ minWidth: calendarExpanded ? 140 : 168 }}
              >
                {calendarTitle}
              </h2>
              <button
                onClick={() => calendarExpanded ? changeMonth(1) : changeWeek(1)}
                aria-label={calendarExpanded
                  ? t('next_month', { defaultValue: 'Nächster Monat' })
                  : t('next_week', { defaultValue: 'Nächste Woche' })}
                className="p-1.5 rounded-xl text-sky-400 hover:bg-sky-400/10 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
            <button
              className="shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-bold text-sky-200"
              onClick={() => { setSelectedDay(new Date()); setCurrentDate(new Date()) }}
              style={{ borderColor: 'var(--accent-border)', background: 'var(--accent-weak)' }}
            >
              {t('heute_link')}
            </button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 border-y border-slate-800">
          {[t('mon'),t('tue'),t('wed'),t('thu'),t('fri'),t('sat'),t('sun')].map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-500">{d}</div>
          ))}
        </div>

        {/* Calendar grid — horizontal swipe to change month */}
        <div
          className="relative overflow-hidden"
          style={{ touchAction: 'pan-y', cursor: isDragging ? 'grabbing' : 'default' }}
          onPointerDown={handleCalendarPointerDown}
          onPointerMove={handleCalendarPointerMove}
          onPointerUp={handleCalendarPointerUp}
          onPointerCancel={handleCalendarPointerCancel}
        >
          {/* Current month */}
          <div
            className="grid grid-cols-7 select-none"
            style={{
              transform: `translateX(${calendarDragX}px)`,
              transition: isDragging ? 'none' : 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
              willChange: 'transform',
            }}
          >
            {visibleCalendarDays.map((day, i) => renderDayCell(
              day,
              calendarExpanded ? currentDate : selectedDay,
              i,
              false,
              !calendarExpanded,
            ))}
          </div>

          {/* Peek period — slides in from the side while swiping */}
          {peekDir !== 0 && (
            <div
              className="absolute inset-x-0 top-0 grid grid-cols-7 select-none pointer-events-none"
              style={{
                transform: `translateX(calc(${peekDir === 1 ? '100%' : '-100%'} + ${calendarDragX}px))`,
                transition: isDragging ? 'none' : 'transform 0.26s cubic-bezier(0.4,0,0.2,1)',
                willChange: 'transform',
              }}
            >
              {peekCalendarDays.map((day, i) => renderDayCell(
                day,
                calendarExpanded ? peekDate! : peekDate!,
                i,
                true,
                !calendarExpanded,
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setCalendarExpanded(expanded => {
              if (!expanded) {
                setCurrentDate(new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1))
              }
              return !expanded
            })
          }}
          className="flex w-full items-center justify-center gap-1.5 border-t border-slate-800 px-4 py-2.5 text-xs font-bold text-sky-300/90 transition-colors hover:bg-sky-400/5"
        >
          {calendarExpanded
            ? t('calendar_collapse_week', { defaultValue: 'Wochenansicht' })
            : t('calendar_expand_month', { defaultValue: 'Monat anzeigen' })}
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${calendarExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 px-4 py-3" style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
        }}>
          <div className="flex items-center gap-1.5" style={calendarLegendText}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)', boxShadow: '0 0 4px #00ccf555' }} />
            {t('geplant', { defaultValue: 'Geplant' })}
          </div>
          <div className="flex items-center gap-1.5" style={calendarLegendText}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#f97316', boxShadow: '0 0 4px #f9731655' }} />
            {t('erhoehung')}
          </div>
          <div className="flex items-center gap-1.5" style={calendarLegendText}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#10b981', boxShadow: '0 0 4px #10b98155' }} />
            {t('erfolgreich', { defaultValue: 'Erfolgreich' })}
          </div>
          <div className="flex items-center gap-1.5" style={calendarLegendText}>
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#ef4444', boxShadow: '0 0 4px #ef444455' }} />
            {t('verpasst', { defaultValue: 'Verpasst' })}
          </div>
        </div>

      </GlassPanel>
      </div>

      {/* ── Tages-Panel ───────────────────────────────────────────────────── */}
      <div id="due-intakes">
      <GlassPanel accent="#00ccf5" padding="md">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <ClipboardList size={17} color="#00ccf5" />
            <h2 className="text-base font-extrabold text-white leading-tight truncate">
              {selectedDayTitle}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isTodaySelected && (
              <button
                onClick={() => { setSelectedDay(new Date()); setCurrentDate(new Date()) }}
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                {t('heute_link')}
              </button>
            )}
            <span className="text-xs font-semibold text-slate-400 tabular-nums">
              {format(selectedDay, 'dd.MM.yyyy')}
            </span>
          </div>
        </div>

        {/* Noch fällig */}
        {dueSlots.length > 0 && (
          <div className="mb-3 space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-300/80">
                {t('due_intakes_title', { defaultValue: 'Noch fällig' })}
              </p>
              {totalDaySlots > 0 && (
                <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-300/80 tabular-nums">
                  {completedDaySlots}/{totalDaySlots}
                </span>
              )}
            </div>

            <div
              role="tablist"
              aria-label={t('due_intakes_title', { defaultValue: 'Noch fällig' })}
              className="grid grid-cols-3 gap-1 rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-1"
            >
              {duePeriodCarousels.map(period => {
                const PeriodIcon = period.icon
                const active = activeDuePeriod === period.key
                return (
                  <button
                    key={period.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveDuePeriod(period.key)}
                    className={[
                      'flex min-w-0 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] transition-colors',
                      active
                        ? 'bg-amber-400/15 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'text-slate-500 hover:text-slate-300',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-1.5">
                      <PeriodIcon size={13} />
                      <span className="truncate">{period.label}</span>
                    </span>
                    {period.slots.length > 0 && (
                      <span className={[
                        'rounded-full px-1.5 py-0.5 text-[9px] tabular-nums leading-none',
                        active ? 'bg-amber-400/20 text-amber-100' : 'bg-slate-800 text-slate-400',
                      ].join(' ')}>
                        {period.slots.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {activeDuePeriodData.slots.length > 0 ? (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => activeDuePeriodData.routineGroup && setRoutineGroupSheet(activeDuePeriodData.routineGroup)}
                  className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-3 text-sm font-black text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <Check size={15} aria-hidden="true" /> {t('routine_confirmation_confirm_all', { defaultValue: 'Alle als eingenommen markieren' })}
                </button>
                <IntakePeriodCarousel
                  key={activeDuePeriod}
                  items={activeDuePeriodData.slots}
                  getKey={slot => slot.key}
                  renderItem={slot => renderDueSlotCard(slot)}
                />
              </div>
            ) : (
              <p className="px-1 text-xs text-slate-600">
                {t('period_no_open_intakes', { defaultValue: 'Keine offenen Einnahmen' })}
              </p>
            )}
          </div>
        )}

        {/* Bereits protokolliert — ausklappbar */}
        {confirmedLogsSorted.length > 0 ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setCompletedExpanded(expanded => !expanded)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5 text-left transition-colors hover:bg-emerald-500/10"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-300/80">
                  {t('completed_intakes_title', { defaultValue: 'Bereits protokolliert' })}
                </p>
                <p className="text-xs text-slate-500">
                  {t('completed_intakes_hint', { defaultValue: 'Bestätigte und übersprungene Einnahmen.' })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">
                  {confirmedLogsSorted.length}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-emerald-300/80 transition-transform duration-200 ${completedExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </button>
            {completedExpanded && (
              <div className="space-y-2">
                {confirmedLogsSorted.map(log => renderConfirmedLog(log))}
              </div>
            )}
          </div>
        ) : dueSlots.length === 0 && selCycles.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">
            {isTodaySelected ? t('noch_nichts_heute') : t('kein_eintrag_tag')}
          </p>
        ) : dueSlots.length === 0 ? (
          <p className="text-slate-600 text-xs text-center py-2">
            {t('all_intakes_done', { defaultValue: 'Alle geplanten Einnahmen sind bestätigt.' })}
          </p>
        ) : null}
      </GlassPanel>
      </div>

    </PageShell>

      {routineGroupSheet && (
        <RoutineConfirmationSheet
          group={routineGroupSheet}
          onClose={() => setRoutineGroupSheet(null)}
          onConfirm={confirmRoutineGroup}
          onAfterConfirm={afterRoutineGroupConfirmed}
          onAddInjection={openRoutineInjection}
        />
      )}

      {/* ── Einnahme-Zeitpunkt-Sheet ──────────────────────────────────────── */}
      {confirmSheet && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setConfirmSheet(null)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border border-white/10 pb-10"
            style={{ background: 'var(--surface)' }}
          >
            <div style={{ padding: '20px 18px 0' }}>
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
              <div className="flex items-center gap-2 mb-1">
                <Check size={15} className="text-emerald-400" />
                <h2 className="text-base font-black text-white">Einnahme bestätigen</h2>
              </div>
              <p className="text-xs text-slate-500 mb-5">
                Wann hast du tatsächlich eingenommen? Vorausgefüllt mit der geplanten Zykluszeit.
              </p>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-500">
                  Uhrzeit
                </label>
                <button
                  type="button"
                  onClick={() => setConfirmTime(format(new Date(), 'HH:mm'))}
                  className="flex items-center gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1 text-[0.65rem] font-bold text-sky-400 transition-colors hover:bg-sky-500/20"
                >
                  <Clock size={11} />
                  {t('confirm_time_now', { defaultValue: 'Jetzt' })}
                </button>
              </div>
              <input
                type="time"
                value={confirmTime}
                onChange={e => setConfirmTime(e.target.value)}
                className="mb-5 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white outline-none focus:border-sky-500/50 transition-colors"
                style={{ background: 'var(--surface-input)', colorScheme: 'dark' }}
              />
              <div className="flex gap-3">
                <button onClick={() => setConfirmSheet(null)} className="btn-secondary flex-1">
                  Abbrechen
                </button>
                <button
                  onClick={() => void handleConfirmSheet()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Check size={14} /> Eingenommen
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
