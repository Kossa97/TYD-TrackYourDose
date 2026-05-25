import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, startOfWeek, endOfWeek,
  differenceInDays, parseISO,
} from 'date-fns'
import { de, enUS, es, fr, it, pt, ru, tr, ar, hi, id, zhCN, ja, ko } from 'date-fns/locale'
import type { Locale } from 'date-fns'
import {
  Bell, CalendarDays, Check, CheckCircle2,
  ChevronDown, ChevronUp, Clock3, RotateCcw,
  Syringe, TrendingUp, X, XCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getPeptideColor } from '../lib/peptideColors'
import { GlassPanel, PageHero, PageShell, SectionHeader } from '../components/ui/DesignSystem'

const DATE_LOCALES: Record<string, Locale> = {
  de, en: enUS, es, fr, it, pt, ru, tr, ar, hi, id, zh: zhCN, ja, ko,
}

interface DoseLog {
  id: string
  peptide_id: string
  dose: number
  unit: string
  method: string
  logged_at: string
  notes: string | null
  taken: boolean | null
  peptides: { name: string }
}

interface Cycle {
  id: string
  name: string
  peptide_id: string
  dose: number
  unit: string
  method: string
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  start_date: string
  end_date: string | null
  active: boolean
  intake_time: string | null
  intake_time_custom: string | null
  peptides: { name: string }
}

interface Peptide {
  id: string; name: string; default_unit: string
  default_dose: number | null; default_method: string
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

const WEEKDAYS_DE: Record<number, string> = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 0: 'So' }

function cycleAppliesToDay(cycle: Cycle, day: Date): boolean {
  const start = parseISO(cycle.start_date)
  const end = cycle.end_date ? parseISO(cycle.end_date) : null
  if (day < start) return false
  if (end && day > end) return false

  const freq = cycle.frequency
  const dayOfWeek = WEEKDAYS_DE[day.getDay()]
  const diff = differenceInDays(day, start)

  // schedule_days override: applies to Wochentage wählen, Alle X Tage, and legacy 2x/3x täglich
  const hasDayFilter = (cycle.schedule_days ?? []).length > 0
  if (freq === 'Täglich' || freq === '2x täglich' || freq === '3x täglich')
    return hasDayFilter ? (cycle.schedule_days ?? []).includes(dayOfWeek) : true
  if (freq === 'Jeden 2. Tag') return diff % 2 === 0
  if (freq === 'Alle X Tage') {
    const intervalOk = diff % (cycle.x_days_interval ?? 2) === 0
    return intervalOk && (hasDayFilter ? (cycle.schedule_days ?? []).includes(dayOfWeek) : true)
  }
  if (freq === '5 Tage an / 2 aus') return diff % 7 < 5
  if (freq === 'Mo-Fr') return day.getDay() >= 1 && day.getDay() <= 5
  if (freq === 'Wöchentlich') return diff % 7 === 0
  if (freq === 'Wochentage wählen') return (cycle.schedule_days ?? []).includes(dayOfWeek)
  return false
}

function effectiveDose(cycle: Cycle, day: Date, escalations: Escalation[]): number {
  const cycleStart = parseISO(cycle.start_date)
  const daysFromStart = differenceInDays(day, cycleStart)
  let total = cycle.dose
  for (const esc of escalations.filter(e => e.cycle_id === cycle.id)) {
    if (esc.start_type === 'date' && esc.start_date) {
      if (day >= parseISO(esc.start_date)) total += esc.increase_amount
    } else if (esc.start_after_days != null) {
      if (daysFromStart >= esc.start_after_days) total += esc.increase_amount
    }
  }
  return total
}

const INTAKE_MINUTES: Record<string, number> = {
  morgens: 8 * 60, mittags: 12 * 60, abends: 20 * 60,
}
function cycleIntakeMinutes(c: Cycle): number {
  // Sort by first intake time slot
  const firstKey = (c.intake_time ?? '').split(',').filter(Boolean)[0] ?? ''
  if (INTAKE_MINUTES[firstKey]) return INTAKE_MINUTES[firstKey]
  if (firstKey === 'custom' && c.intake_time_custom) {
    const firstCustom = c.intake_time_custom.split(',')[0]
    const [h, m] = firstCustom.split(':').map(Number)
    return h * 60 + m
  }
  return 25 * 60
}

function cycleTimeLabel(c: Cycle, t: (key: string) => string): { emoji: string; label: string } | null {
  if (!c.intake_time) return null
  const keys = c.intake_time.split(',').filter(Boolean)
  const customs = (c.intake_time_custom ?? '').split(',')
  const parts = keys.map((key, i) => {
    if (key === 'morgens') return { emoji: '🌅', label: t('morgens') }
    if (key === 'mittags') return { emoji: '☀️', label: t('mittags') }
    if (key === 'abends')  return { emoji: '🌙', label: t('abends') }
    if (key === 'custom' && customs[i]) return { emoji: '🕐', label: customs[i] }
    return null
  }).filter(Boolean) as { emoji: string; label: string }[]
  if (parts.length === 0) return null
  return {
    emoji: parts.map(p => p.emoji).join(''),
    label: parts.map(p => p.label).join(' · '),
  }
}

type IntakeGroupKey = 'morgens' | 'mittags' | 'abends' | 'custom' | 'later'

function cycleTimeGroupKey(cycle: Cycle): IntakeGroupKey {
  const firstKey = (cycle.intake_time ?? '').split(',').filter(Boolean)[0] ?? ''
  if (firstKey === 'morgens' || firstKey === 'mittags' || firstKey === 'abends' || firstKey === 'custom') return firstKey
  return 'later'
}

function intakeGroupMeta(key: IntakeGroupKey, t: (key: string) => string): { emoji: string; label: string } {
  if (key === 'morgens') return { emoji: '🌅', label: t('morgens') }
  if (key === 'mittags') return { emoji: '☀️', label: t('mittags') }
  if (key === 'abends') return { emoji: '🌙', label: t('abends') }
  if (key === 'custom') return { emoji: '🕐', label: t('uhrzeit_label') }
  return { emoji: '📌', label: t('ausstehend') }
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
  const minutes = cycleIntakeMinutes(cycle)
  const safeMinutes = minutes >= 24 * 60 ? 12 * 60 : minutes
  date.setHours(Math.floor(safeMinutes / 60), safeMinutes % 60, 0, 0)
  return date.toISOString()
}

function doseToVialDelta(dose: number, unit: string, peptide: Peptide): number | null {
  const normalizedUnit = unit.toLowerCase()
  if (normalizedUnit === 'ml') {
    if (!peptide.reconstitution_ml || peptide.reconstitution_ml <= 0) return null
    return dose / peptide.reconstitution_ml
  }

  if (!peptide.vial_amount_mg || peptide.vial_amount_mg <= 0) return null
  const doseMg = normalizedUnit === 'mcg'
    ? dose / 1000
    : normalizedUnit === 'mg'
      ? dose
      : null
  if (doseMg == null) return null
  return doseMg / peptide.vial_amount_mg
}

function roundStock(value: number) {
  return Math.round(value * 10000) / 10000
}

const calendarLegendText: CSSProperties = {
  fontSize: '0.66rem',
  color: 'rgba(213,224,242,0.58)',
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
        borderRadius: 18,
        border: `1px solid ${accent}2d`,
        background: `linear-gradient(145deg, ${accent}16, rgba(6,10,24,0.72))`,
        padding: '10px 12px',
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px ${accent}12`,
      }}
    >
      <p style={{ color: accent, fontWeight: 900, fontSize: '1.05rem', lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ color: 'rgba(213,224,242,0.62)', fontSize: '0.64rem', fontWeight: 780, marginTop: 5 }}>
        {label}
      </p>
    </div>
  )
}

export function Dashboard() {
  const { t, i18n } = useTranslation()
  const locale = DATE_LOCALES[i18n.language] ?? enUS
  const { user } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [logs, setLogs] = useState<DoseLog[]>([])
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [peptides, setPeptides] = useState<Peptide[]>([])
  const [escalations, setEscalations] = useState<Escalation[]>([])

  // selectedDay steuert den Tages-Bereich unten — Standard = heute
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const calendarSwipeStart = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const calendarWheelLocked = useRef(false)
  const [calendarDragOffset, setCalendarDragOffset] = useState(0)
  const [calendarDragging, setCalendarDragging] = useState(false)

  const changeMonth = useCallback((delta: number) => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + delta, 1))
  }, [])

  const selectCalendarDay = useCallback((day: Date) => {
    setSelectedDay(day)
    if (day.getMonth() !== currentDate.getMonth() || day.getFullYear() !== currentDate.getFullYear()) {
      setCurrentDate(new Date(day.getFullYear(), day.getMonth(), 1))
    }
  }, [currentDate])

  const finishCalendarSwipe = (deltaX: number, deltaY: number) => {
    const absX = Math.abs(deltaX)
    const absY = Math.abs(deltaY)
    if (absY < 44 || absY < absX * 1.2) return false
    changeMonth(deltaY < 0 ? 1 : -1)
    return true
  }

  const handleCalendarPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    calendarSwipeStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    setCalendarDragging(true)
    setCalendarDragOffset(0)
  }

  const handleCalendarPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = calendarSwipeStart.current
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaY) < 6 || Math.abs(deltaY) < Math.abs(deltaX) * 0.75) return
    event.preventDefault()
    const dampened = Math.max(-64, Math.min(64, deltaY * 0.42))
    setCalendarDragOffset(dampened)
  }

  const handleCalendarPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = calendarSwipeStart.current
    calendarSwipeStart.current = null
    setCalendarDragging(false)
    setCalendarDragOffset(0)
    if (!start || start.pointerId !== event.pointerId) return
    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    const didSwipe = finishCalendarSwipe(deltaX, deltaY)
    if (didSwipe || Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) return

    const button = (event.target as Element | null)?.closest<HTMLButtonElement>('[data-calendar-date]')
    const dateKey = button?.dataset.calendarDate
    if (!dateKey) return
    const [year, month, date] = dateKey.split('-').map(Number)
    selectCalendarDay(new Date(year, month - 1, date))
  }

  const handleCalendarPointerCancel = () => {
    calendarSwipeStart.current = null
    setCalendarDragging(false)
    setCalendarDragOffset(0)
  }

  const handleCalendarWheel = (event: WheelEvent<HTMLDivElement>) => {
    const absX = Math.abs(event.deltaX)
    const absY = Math.abs(event.deltaY)
    if (absY < 40 || absY < absX * 1.2) return
    event.preventDefault()
    if (calendarWheelLocked.current) return
    calendarWheelLocked.current = true
    changeMonth(event.deltaY > 0 ? 1 : -1)
    window.setTimeout(() => { calendarWheelLocked.current = false }, 450)
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
    const { data } = await supabase
      .from('dose_logs')
      .select('*, peptides(name)')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lte('logged_at', end + 'T23:59:59')
      .order('logged_at', { ascending: true })
    if (data) setLogs(data as DoseLog[])
  }, [currentDate, user])

  const loadCycles = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('cycles')
      .select('*, peptides(name)')
      .eq('user_id', user.id)
      .eq('active', true)
    if (data) setCycles(data as Cycle[])
  }, [user])

  const loadPeptides = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('peptides').select('*').eq('user_id', user.id).order('name')
    if (data) setPeptides(data)
  }, [user])

  const loadEscalations = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('dose_escalations').select('*').eq('user_id', user.id)
    if (data) setEscalations(data as Escalation[])
  }, [user])

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
        void loadPeptides()
        void loadEscalations()
      }
    })
    return () => { cancelled = true }
  }, [loadEscalations, loadPeptides])

  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }),
  })

  const logsForDay = (day: Date) => logs.filter(l => isSameDay(new Date(l.logged_at), day))
  const cyclesForDay = (day: Date) => cycles.filter(c => cycleAppliesToDay(c, day))

  // ── Tages-Ansicht (unten) ────────────────────────────────────────────────
  const selLogs     = logsForDay(selectedDay)
  const selCycles   = cyclesForDay(selectedDay)
  const isTodaySelected = isToday(selectedDay)
  const monthTitle = format(currentDate, 'MMMM yyyy', { locale })
  const selectedDayTitle = isTodaySelected
    ? t('heutiges_protokoll')
    : format(selectedDay, 'EEEE, d. MMMM', { locale })
  const pendingLogItems = selLogs.filter(log => log.taken === null)
  const pendingCycles = selCycles.filter(cycle =>
    !selLogs.some(log => log.peptide_id === cycle.peptide_id)
  )
  const confirmedLogs = selLogs.filter(log => log.taken !== null)
  const confirmedLogsSorted = [...confirmedLogs].sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
  const dueCycles = [...selCycles]
    .filter(cycle => pendingLogItems.some(log => log.peptide_id === cycle.peptide_id) || pendingCycles.some(pending => pending.id === cycle.id))
    .sort((a, b) => cycleIntakeMinutes(a) - cycleIntakeMinutes(b))
  const dueCycleSections = (['morgens', 'mittags', 'abends', 'custom', 'later'] as IntakeGroupKey[])
    .map(key => ({ ...intakeGroupMeta(key, t), cycles: dueCycles.filter(cycle => cycleTimeGroupKey(cycle) === key) }))
    .filter(section => section.cycles.length > 0)
  const today = new Date()
  const todayLogs = logsForDay(today)
  const todayCycles = cyclesForDay(today)
  const todayPendingLogs = todayLogs.filter(log => log.taken === null)
  const todayPendingCycles = todayCycles.filter(cycle =>
    !todayLogs.some(log => log.peptide_id === cycle.peptide_id)
  )
  const todayDue = todayPendingLogs.length + todayPendingCycles.length
  const selectedPlanned = selCycles.length
  const activePeptideLegend = cycles
    .map(cycle => cycle.peptide_id)
    .filter((peptideId, index, all) => all.indexOf(peptideId) === index)
    .map(peptideId => peptides.find(peptide => peptide.id === peptideId))
    .filter(Boolean) as Peptide[]

  const adjustPeptideStockForDose = async (peptideId: string, dose: number, unit: string, mode: 'debit' | 'credit') => {
    if (!user) return false
    const peptide = peptides.find(p => p.id === peptideId)
    if (!peptide) return false
    const delta = doseToVialDelta(dose, unit, peptide)
    if (!delta || delta <= 0) return false

    const current = Number(peptide.vials_in_stock ?? 0)
    const maxStock = Number(peptide.vials_initial ?? 0)
    const next = mode === 'debit'
      ? Math.max(0, current - delta)
      : maxStock > 0
        ? Math.min(maxStock, current + delta)
        : current + delta
    const rounded = roundStock(next)

    const { error } = await supabase
      .from('peptides')
      .update({ vials_in_stock: rounded })
      .eq('id', peptideId)
      .eq('user_id', user.id)
    if (error) {
      toast.error(t('stock_update_failed', { defaultValue: 'Bestand konnte nicht aktualisiert werden' }))
      return false
    }

    setPeptides(currentPeptides => currentPeptides.map(p =>
      p.id === peptideId ? { ...p, vials_in_stock: rounded } : p
    ))
    return true
  }

  const deleteLog = async (log: DoseLog) => {
    if (!confirm(t('eintrag_loeschen'))) return
    const { error } = await supabase.from('dose_logs').delete().eq('id', log.id)
    if (error) return toast.error(t('error'))
    if (log.taken === true) await adjustPeptideStockForDose(log.peptide_id, log.dose, log.unit, 'credit')
    toast.success(t('deleted')); loadLogs(); loadPeptides()
  }

  const confirmDose = async (log: DoseLog, taken: boolean) => {
    const previousTaken = log.taken
    const { error } = await supabase.from('dose_logs').update({ taken }).eq('id', log.id)
    if (error) return toast.error(t('error'))
    if (previousTaken !== true && taken === true) await adjustPeptideStockForDose(log.peptide_id, log.dose, log.unit, 'debit')
    if (previousTaken === true && taken !== true) await adjustPeptideStockForDose(log.peptide_id, log.dose, log.unit, 'credit')
    loadLogs(); loadPeptides()
    if (taken) toast.success(t('einnahme_bestaetigt'))
    else toast(t('einnahme_uebersp_toast'), { icon: '⏭️' })
  }

  const undoDose = async (log: DoseLog) => {
    const { error } = await supabase.from('dose_logs').update({ taken: null }).eq('id', log.id)
    if (error) return toast.error(t('error'))
    if (log.taken === true) await adjustPeptideStockForDose(log.peptide_id, log.dose, log.unit, 'credit')
    loadLogs(); loadPeptides()
    toast.success(t('dose_undo_success', { defaultValue: 'Einnahme zurückgesetzt' }))
  }

  const confirmCycleDose = async (cycle: Cycle, taken: boolean) => {
    if (!user) return
    const dose = effectiveDose(cycle, selectedDay, escalations)
    const { error } = await supabase.from('dose_logs').insert({
      user_id: user.id,
      peptide_id: cycle.peptide_id,
      dose,
      unit: cycle.unit,
      method: cycle.method,
      logged_at: cycleLogTimestamp(cycle, selectedDay),
      taken,
    })
    if (error) return toast.error(t('fehler_speichern'))
    if (taken) await adjustPeptideStockForDose(cycle.peptide_id, dose, cycle.unit, 'debit')
    loadLogs(); loadPeptides()
    if (taken) toast.success(t('einnahme_bestaetigt'))
    else toast(t('einnahme_uebersp_toast'), { icon: '⏭️' })
  }

  const snoozeDose = (log: DoseLog, minutes: number) => {
    const time = minutes < 60 ? `${minutes} min` : `${minutes / 60} h`
    toast(t('erinnerung_toast', { time }), { icon: '⏰' })
    setTimeout(() => {
      toast(
        t('dose_nicht_best', { name: log.peptides?.name, dose: log.dose, unit: log.unit }),
        { icon: '💉', duration: 10000 }
      )
    }, minutes * 60 * 1000)
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <PageShell>
      <PageHero
        kicker={t('calendar_plan_kicker', { defaultValue: 'Peptid-Plan' })}
        title={t('nav_kalender')}
        subtitle={selectedDayTitle}
        icon={CalendarDays}
        accent="#00ccf5"
      />

      {/* ── Kalender ──────────────────────────────────────────────────────── */}
      <div data-ob="calendar-main" data-ob-self>
      <GlassPanel accent="#00ccf5" padding="sm" style={{ padding: 0 }}>
        <div style={{ padding: '16px 14px 12px' }}>
          <button
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-extrabold uppercase tracking-[0.12em] transition-colors"
            onClick={() => changeMonth(-1)}
            aria-label={t('prev_month', { defaultValue: 'Vorheriger Monat' })}
            style={{
              borderColor: 'rgba(0,204,245,0.20)',
              background: 'linear-gradient(180deg, rgba(0,204,245,0.12), rgba(0,204,245,0.035))',
              color: 'rgba(125,229,255,0.92)',
              boxShadow: '0 0 24px rgba(0,204,245,0.10), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            <ChevronUp size={16} />
            {t('prev_month_short', { defaultValue: 'Vorheriger Monat' })}
          </button>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                {t('month_overview_kicker', { defaultValue: 'Kalender' })}
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-[-0.05em] text-white">{monthTitle}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {t('month_overview_subtitle', { defaultValue: 'Tippe einen Tag an oder swipe vertikal zum Monatswechsel.' })}
              </p>
            </div>
            <button
              className="shrink-0 rounded-2xl border px-3 py-2 text-xs font-bold text-sky-200"
              onClick={() => { setSelectedDay(new Date()); setCurrentDate(new Date()) }}
              style={{
                borderColor: 'rgba(0,204,245,0.18)',
                background: 'rgba(0,204,245,0.08)',
              }}
            >
              {t('heute_link')}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <CalendarInfoPill
              label={t('stat_active_cycles', { defaultValue: 'Aktive Zyklen' })}
              value={cycles.length}
              accent="#8b5cf6"
            />
            <CalendarInfoPill
              label={t('today_due_short', { defaultValue: 'Heute fällig' })}
              value={todayDue}
              accent={todayDue > 0 ? '#f59e0b' : '#10b981'}
            />
            <CalendarInfoPill
              label={t('selected_planned_short', { defaultValue: 'Am Tag geplant' })}
              value={selectedPlanned}
              accent="#00ccf5"
            />
          </div>
        </div>

        {/* Wochentag-Kopf */}
        <div className="grid grid-cols-7 border-y border-slate-800">
          {[t('mon'),t('tue'),t('wed'),t('thu'),t('fri'),t('sat'),t('sun')].map(d => (
            <div key={d} className="py-3 text-center text-xs font-extrabold uppercase tracking-[0.08em] text-slate-500">{d}</div>
          ))}
        </div>

        {/* Tage */}
        <div className="relative overflow-hidden">
          <div
            className="grid grid-cols-7 select-none"
            onPointerDown={handleCalendarPointerDown}
            onPointerMove={handleCalendarPointerMove}
            onPointerUp={handleCalendarPointerUp}
            onPointerCancel={handleCalendarPointerCancel}
            onWheel={handleCalendarWheel}
            style={{
              touchAction: 'none',
              cursor: calendarDragging ? 'grabbing' : 'grab',
              transform: `translateY(${calendarDragOffset}px)`,
              transition: calendarDragging ? 'none' : 'transform 0.18s ease',
              willChange: 'transform',
            }}
          >
          {calendarDays.map((day, i) => {
            const dayLogs    = logsForDay(day)
            const dayCycles  = cyclesForDay(day)
            const inMonth    = day.getMonth() === currentDate.getMonth()
            const isSelected = isSameDay(day, selectedDay)
            const hasCycle   = dayCycles.length > 0
            const isFuture = differenceInDays(day, today) > 0
            const dayTaken = dayLogs.filter(log => log.taken === true).length
            const daySkipped = dayLogs.filter(log => log.taken === false).length
            const dayPendingLogs = dayLogs.filter(log => log.taken === null)
            const dayPendingCycles = dayCycles.filter(cycle =>
              !dayLogs.some(log => log.peptide_id === cycle.peptide_id)
            )
            const dayOpen = isFuture ? 0 : dayPendingLogs.length + dayPendingCycles.length
            const statusAccent = dayOpen > 0
              ? '#f59e0b'
              : daySkipped > 0
                ? '#ef4444'
                : dayTaken > 0
                  ? '#10b981'
                  : hasCycle
                    ? '#8b5cf6'
                    : 'rgba(255,255,255,0.08)'
            const statusBg = dayOpen > 0
              ? 'rgba(245,158,11,0.12)'
              : daySkipped > 0
                ? 'rgba(239,68,68,0.10)'
                : dayTaken > 0
                  ? 'rgba(16,185,129,0.10)'
                  : hasCycle
                    ? 'rgba(139,92,246,0.09)'
                    : 'transparent'

            return (
              <button
                key={i}
                data-calendar-date={format(day, 'yyyy-MM-dd')}
                className={`relative flex min-h-[82px] flex-col items-center justify-center py-3 transition-all duration-150
                  border-r border-b last:border-r-0
                  ${!inMonth ? 'opacity-20' : ''}
                `}
                style={{
                  borderColor: 'rgba(255,255,255,0.04)',
                  background: isSelected
                    ? 'linear-gradient(145deg, rgba(0,190,240,0.85), rgba(0,120,210,0.75))'
                    : statusBg,
                  boxShadow: isSelected
                    ? 'inset 0 1px 0 rgba(255,255,255,0.15), 0 0 16px rgba(0,200,240,0.25)'
                    : hasCycle || dayLogs.length > 0
                      ? `inset 0 1px 0 ${statusAccent}18`
                    : undefined,
                }}
              >
                {hasCycle && !isSelected && (
                  <span
                    className="absolute left-2 top-2 h-2 w-2 rounded-full"
                    style={{ background: statusAccent, boxShadow: `0 0 10px ${statusAccent}66` }}
                  />
                )}

                {/* Heute-Ring */}
                {isToday(day) && !isSelected && (
                  <span className="absolute inset-1 rounded-2xl pointer-events-none"
                    style={{ boxShadow: '0 0 0 1px rgba(0,204,245,0.50), 0 0 6px rgba(0,204,245,0.15)' }} />
                )}

                <span className={`text-lg font-black leading-none ${
                  isSelected ? 'text-white' :
                  isToday(day) ? 'text-sky-400' :
                  inMonth ? 'text-slate-200' : 'text-slate-600'
                }`}>
                  {format(day, 'd')}
                </span>

                {/* Indikatoren – je Punkt ein Peptid */}
                {(() => {
                  const logIds   = dayLogs.map(l => l.peptide_id)
                  const cycleIds = dayCycles.map(c => c.peptide_id)
                  const unique   = [...new Set([...logIds, ...cycleIds])].slice(0, 4)
                  if (unique.length === 0) return <div className="h-2.5 mt-2" />
                  return (
                    <div className="flex gap-1 mt-2 h-2.5">
                      {unique.map(pid => {
                        const idx   = peptides.findIndex(p => p.id === pid)
                        const color = isSelected ? '#ffffff' : getPeptideColor(idx)
                        return (
                          <span
                            key={pid}
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: color, boxShadow: `0 0 7px ${color}88` }}
                          />
                        )
                      })}
                    </div>
                  )
                })()}

                {(dayOpen > 0 || dayTaken > 0 || daySkipped > 0) && (
                  <div className="mt-2 flex items-center justify-center gap-1">
                    {dayOpen > 0 && (
                      <span className="h-1.5 w-4 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.55)]" />
                    )}
                    {dayTaken > 0 && (
                      <span className="h-1.5 w-4 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.45)]" />
                    )}
                    {daySkipped > 0 && (
                      <span className="h-1.5 w-4 rounded-full bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.45)]" />
                    )}
                  </div>
                )}
              </button>
            )
          })}
          </div>
        </div>

        {/* Legende */}
        <div className="flex flex-wrap gap-3 px-4 py-3" style={{
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(1,2,10,0.60)',
        }}>
          <div className="flex items-center gap-1.5" style={calendarLegendText}>
            <div className="flex gap-0.5">
              {[0,1,2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: getPeptideColor(i), boxShadow: `0 0 4px ${getPeptideColor(i)}88` }} />
              ))}
            </div>
            {t('per_dot_peptid')}
          </div>
          <div className="flex items-center gap-1.5" style={calendarLegendText}>
            <Clock3 size={11} style={{ color: '#f59e0b' }} /> {t('ausstehend')}
          </div>
          <div className="flex items-center gap-1.5" style={calendarLegendText}>
            <CheckCircle2 size={11} style={{ color: '#10b981' }} /> {t('eingenommen')}
          </div>
          <div className="flex items-center gap-1.5" style={calendarLegendText}>
            <XCircle size={11} style={{ color: '#ef4444' }} /> {t('uebersprungen')}
          </div>
          <div className="flex items-center gap-1.5" style={calendarLegendText}>
            <TrendingUp size={10} style={{ color: '#f59e0b' }} /> {t('erhoehung')}
          </div>
          {activePeptideLegend.slice(0, 4).map(peptide => {
            const idx = peptides.findIndex(p => p.id === peptide.id)
            const color = getPeptideColor(idx)
            return (
              <div key={peptide.id} className="flex items-center gap-1.5" style={calendarLegendText}>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: color, boxShadow: `0 0 6px ${color}99` }}
                />
                <span className="max-w-[92px] truncate">{peptide.name}</span>
              </div>
            )
          })}
        </div>

        <div
          className="px-4 py-3"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(4,7,18,0.72)',
          }}
        >
          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-xs font-extrabold uppercase tracking-[0.12em] transition-colors"
            onClick={() => changeMonth(1)}
            aria-label={t('next_month', { defaultValue: 'Nächster Monat' })}
            style={{
              borderColor: 'rgba(0,204,245,0.20)',
              background: 'linear-gradient(180deg, rgba(0,204,245,0.035), rgba(0,204,245,0.12))',
              color: 'rgba(125,229,255,0.92)',
              boxShadow: '0 0 24px rgba(0,204,245,0.10), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {t('next_month_short', { defaultValue: 'Nächster Monat' })}
            <ChevronDown size={16} />
          </button>
        </div>
      </GlassPanel>
      </div>

      {/* ── Tages-Panel (ausgewählter Tag / Standard = heute) ─────────────── */}
      <GlassPanel accent="#00ccf5" padding="md">
        {/* Header */}
        <div className="mb-3">
          <SectionHeader
            kicker={format(selectedDay, 'dd.MM.yyyy')}
            title={selectedDayTitle}
            icon={CalendarDays}
            accent="#00ccf5"
            action={!isTodaySelected && (
              <button
                onClick={() => { setSelectedDay(new Date()); setCurrentDate(new Date()) }}
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors">
                {t('heute_link')}
              </button>
            )}
          />
        </div>

        {/* Noch fällig */}
        {dueCycles.length > 0 && (
          <div className="mb-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-amber-300/80">
                  {t('due_intakes_title', { defaultValue: 'Noch fällig' })}
                </p>
                <p className="text-xs text-slate-500">
                  {t('due_intakes_hint', { defaultValue: 'Bitte Einnahme pro Peptid bestätigen oder überspringen.' })}
                </p>
              </div>
              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300">
                {dueCycles.length}
              </span>
            </div>

            {dueCycleSections.map(section => (
              <div key={section.label} className="space-y-1.5">
                <div className="flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                  <span>{section.emoji}</span>
                  <span>{section.label}</span>
                </div>

                {section.cycles.map(c => {
                  const dose = effectiveDose(c, selectedDay, escalations)
                  const isEscalated = dose !== c.dose
                  const pendingLog = pendingLogItems.find(log => log.peptide_id === c.peptide_id)
                  const cycleEscs = escalations.filter(e => e.cycle_id === c.id)
                  const activeEscCount = cycleEscs.filter(e => {
                    if (e.start_type === 'date' && e.start_date)
                      return selectedDay >= parseISO(e.start_date)
                    if (e.start_after_days != null)
                      return differenceInDays(selectedDay, parseISO(c.start_date)) >= e.start_after_days
                    return false
                  }).length
                  const tl = cycleTimeLabel(c, t)
                  const peptideColor = getPeptideColor(peptides.findIndex(peptide => peptide.id === c.peptide_id))
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border px-3 py-2.5 transition-colors"
                      style={{
                        background: 'rgba(8,14,30,0.68)',
                        borderColor: 'rgba(255,255,255,0.075)',
                      }}>
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: peptideColor, boxShadow: `0 0 10px ${peptideColor}80` }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white">{c.peptides?.name}</span>
                            <span className={`text-xs font-semibold ${isEscalated ? 'text-orange-400' : 'text-slate-300'}`}>
                              {dose} {c.unit}
                            </span>
                            {isEscalated && (
                              <span className="flex items-center gap-0.5 text-orange-400 text-xs">
                                <TrendingUp size={11} /> {t('stufe_n', { n: activeEscCount })}
                              </span>
                            )}
                            <span className="text-slate-500 text-xs">{c.method}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {tl && (
                              <span className="text-xs text-amber-400 flex items-center gap-1">
                                {tl.emoji} {tl.label}
                              </span>
                            )}
                            {isEscalated && (
                              <span className="text-slate-600 text-xs">
                                {t('basis_label')} {c.dose} {c.unit} · +{dose - c.dose} {c.unit}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-slate-600 text-xs shrink-0 hidden sm:block">{c.name}</span>
                      </div>

                      <div
                        className="mt-2 ml-[18px] rounded-xl border px-2.5 py-2"
                        style={{
                          background: 'linear-gradient(90deg, rgba(245,158,11,0.14), rgba(245,158,11,0.055))',
                          borderColor: 'rgba(245,158,11,0.34)',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 0 16px rgba(245,158,11,0.12)',
                        }}
                      >
                        <div className="mb-2 flex items-center gap-2 text-amber-300">
                          <Bell size={12} className="animate-pulse" />
                          <span className="text-[11px] font-extrabold uppercase tracking-wide">
                            {t('dose_confirm_pending_badge', { defaultValue: 'Bestätigung offen' })}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => pendingLog ? confirmDose(pendingLog, true) : confirmCycleDose(c, true)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors">
                            <Check size={11} /> {t('eingenommen')}
                          </button>
                          <button
                            onClick={() => pendingLog ? confirmDose(pendingLog, false) : confirmCycleDose(c, false)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors">
                            <XCircle size={11} /> {t('uebersprungen')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {/* Bereits protokolliert */}
        {confirmedLogsSorted.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-300/80">
                  {t('completed_intakes_title', { defaultValue: 'Bereits protokolliert' })}
                </p>
                <p className="text-xs text-slate-500">
                  {t('completed_intakes_hint', { defaultValue: 'Bestätigte und übersprungene Einnahmen.' })}
                </p>
              </div>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-300">
                {confirmedLogsSorted.length}
              </span>
            </div>
            {confirmedLogsSorted.map(log => (
              <div key={log.id} className={`px-3 py-2.5 border rounded-xl transition-colors ${
                log.taken === true
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : log.taken === false
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-sky-500/5 border-sky-500/15'
              }`}>
                {/* Zeile 1: Icon + Name + Dosis + Löschen */}
                <div className="flex items-center gap-3">
                  <Syringe size={14} className={`shrink-0 ${
                    log.taken === true ? 'text-emerald-400' :
                    log.taken === false ? 'text-red-400' : 'text-sky-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{log.peptides?.name}</span>
                      <span className={`text-xs font-semibold ${
                        log.taken === true ? 'text-emerald-400' :
                        log.taken === false ? 'text-red-400' : 'text-sky-400'
                      }`}>{log.dose} {log.unit}</span>
                      <span className="text-slate-500 text-xs">{log.method}</span>
                      {log.taken === true && (
                        <span className="flex items-center gap-0.5 text-emerald-400 text-xs font-medium">
                          <Check size={11} /> {t('eingenommen')}
                        </span>
                      )}
                      {log.taken === false && (
                        <span className="flex items-center gap-0.5 text-red-400 text-xs font-medium">
                          <XCircle size={11} /> {t('uebersprungen')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-500 text-xs">{timeLabel(log.logged_at, t)}</span>
                      {log.notes && <span className="text-slate-600 text-xs truncate">· {log.notes}</span>}
                    </div>
                  </div>
                  <button className="p-1.5 text-slate-600 hover:text-red-400 transition-colors shrink-0"
                    onClick={() => deleteLog(log)}>
                    <X size={13} />
                  </button>
                </div>

                {/* Zeile 2: Bestätigungs-Buttons (nur wenn noch nicht bestätigt) */}
                {log.taken === null && (
                  <div className="flex gap-2 mt-2 ml-[26px]">
                    <button
                      onClick={() => confirmDose(log, true)}
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
                    <button
                      onClick={() => undoDose(log)}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-700/60 text-slate-300 border border-slate-600/50 hover:bg-slate-600/60 transition-colors">
                      <RotateCcw size={11} /> {t('dose_undo', { defaultValue: 'Rückgängig' })}
                    </button>
                  </div>
                )}

                {/* Zeile 3: Snooze-Buttons (nur wenn übersprungen) */}
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
            ))}
          </div>
        ) : dueCycles.length === 0 && selCycles.length === 0 ? (
          <p className="text-slate-600 text-sm text-center py-4">
            {isTodaySelected ? t('noch_nichts_heute') : t('kein_eintrag_tag')}
          </p>
        ) : dueCycles.length === 0 ? (
          <p className="text-slate-600 text-xs text-center py-2">
            {t('all_intakes_done', { defaultValue: 'Alle geplanten Einnahmen sind bestätigt.' })}
          </p>
        ) : null}
      </GlassPanel>

    </PageShell>
  )
}
