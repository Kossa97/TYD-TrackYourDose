import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, format, parseISO } from 'date-fns'
import { CalendarDays, Clock, Flag, Moon, Pause, Pencil, Play, RotateCcw, Sun, Sunrise, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { findNextTimelineIntake, type ResolvedRoutineGroup } from '../../../lib/intakeSchedule'
import {
  localDateTimeKey,
  resolveCycleAt,
  type CyclePlanVersion,
  type CycleTimeline,
} from '../../../lib/planTimeline'
import { planVersionSegments } from '../lib/planSegments'
import {
  WEEKDAY_KEYS,
  isOnDemandRhythm,
  rhythmFromStorage,
  rhythmSummary,
  rhythmText,
} from '../lib/intakeRhythm'
import type { IntakeRhythm } from '../types'
import {
  inclusiveDayCount,
  planCardSlots,
  planStepRows,
  type PlanCardSlot,
  type PlanStepRow,
} from '../lib/planCard'

export interface PlanManagementSectionProps {
  timeline: CycleTimeline
  now: Date
  timeZone: string
  onAdjustDose(version: CyclePlanVersion): void
  onAdjustSchedule(version: CyclePlanVersion): void
  onEditFuture(version: CyclePlanVersion): void
  onRemoveFuture(version: CyclePlanVersion): Promise<void>
  onPause(endsAt: string | null): Promise<void>
  onSetPauseEnd(endsAt: string | null): Promise<void>
  onResume(): Promise<void>
  onEnd(): Promise<void>
  onRestart(sourceCycleId: string): Promise<void>
  needsReview?: boolean
  onResolveConflict?(): Promise<void>
}

type DialogState =
  | { kind: 'pause' }
  | { kind: 'pause_end' }
  | { kind: 'remove'; version: CyclePlanVersion }
  | { kind: 'end' }

type Translate = (key: string, options?: Record<string, unknown>) => unknown

function versionRhythm(version: CyclePlanVersion): IntakeRhythm {
  const legacyFrequency: Record<string, string> = {
    daily: 'Täglich',
    weekdays: 'Wochentage wählen',
    interval: 'Alle X Tage',
    cycle: 'Im Wechsel',
    on_demand: 'Bei Bedarf',
  }
  return rhythmFromStorage({
    frequency: legacyFrequency[version.frequency] ?? version.frequency,
    x_days_interval: version.x_days_interval,
    interval_unit: version.interval_unit,
    cycle_on_days: version.cycle_on_days,
    cycle_off_days: version.cycle_off_days,
    schedule_days: version.schedule_days,
  })
}

function rhythmLabel(version: CyclePlanVersion, t: Translate): string {
  return rhythmText(rhythmSummary(versionRhythm(version)), t)
}

/** „Bei Bedarf" hat keine Einnahmezeiten — die gespeicherte Tageszeit bedeutet dort nichts. */
function versionSlots(version: CyclePlanVersion): PlanCardSlot[] {
  return isOnDemandRhythm(versionRhythm(version)) ? [] : planCardSlots(version)
}

function slotDoseLabel(slot: PlanCardSlot): string | null {
  if (slot.dose == null) return null
  return `${slot.dose} ${slot.unit ?? ''}`.trim()
}

// Ein beliebiger Montag (UTC), um Wochentagsnamen in der App-Sprache zu bilden.
const WEEKDAY_REFERENCE_UTC = Date.UTC(2026, 0, 5)

function weekdayLabel(day: string, language: string): string {
  const index = WEEKDAY_KEYS.indexOf(day as (typeof WEEKDAY_KEYS)[number])
  if (index < 0) return day
  return new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(WEEKDAY_REFERENCE_UTC + index * 86_400_000))
    .replace(/\.$/, '')
}

const ROUTINE_LABEL: Record<ResolvedRoutineGroup, { key: string; defaultValue: string }> = {
  morning: { key: 'my_stack_routine_morning', defaultValue: 'Morgens' },
  midday: { key: 'my_stack_routine_midday', defaultValue: 'Mittags' },
  evening: { key: 'my_stack_routine_evening', defaultValue: 'Abends' },
}

function RoutineIcon({ group }: { group: ResolvedRoutineGroup }) {
  if (group === 'morning') return <Sunrise size={16} aria-hidden="true" className="shrink-0 text-amber-300" />
  if (group === 'midday') return <Sun size={16} aria-hidden="true" className="shrink-0 text-yellow-200" />
  return <Moon size={16} aria-hidden="true" className="shrink-0 text-indigo-300" />
}

function routineLabel(slot: PlanCardSlot, t: Translate): string {
  const label = ROUTINE_LABEL[slot.routineGroup]
  return String(t(label.key, { defaultValue: label.defaultValue }))
}

function localDay(value: string, timeZone: string): string {
  return localDateTimeKey(new Date(value), timeZone).slice(0, 10)
}

function shiftLocalDay(day: string, offset: number): string {
  return format(addDays(parseISO(day), offset), 'yyyy-MM-dd')
}

/**
 * Erster und letzter Tag des Zyklus. Das Ende ist in der Datenbank eine
 * Grenze („ab hier nicht mehr") — der letzte Einnahmetag ist der Tag davor.
 */
function cyclePeriod(
  timeline: CycleTimeline,
  timeZone: string,
): { first: string; last: string | null; endKey: string | null } {
  const { cycle } = timeline
  const first = cycle.start_local_date ?? localDay(cycle.started_at, timeZone)
  if (cycle.end_local_date) {
    return { first, last: shiftLocalDay(cycle.end_local_date, -1), endKey: `${cycle.end_local_date}|00:00:00` }
  }
  if (cycle.ended_at) {
    return {
      first,
      last: localDay(new Date(new Date(cycle.ended_at).getTime() - 1).toISOString(), timeZone),
      endKey: localDateTimeKey(new Date(cycle.ended_at), timeZone),
    }
  }
  return { first, last: null, endKey: null }
}

function timelineForIntakeResolution(timeline: CycleTimeline): CycleTimeline {
  const legacyFrequencies: Record<string, string> = {
    daily: 'Täglich',
    weekdays: 'Wochentage wählen',
    interval: 'Alle X Tage',
    cycle: 'Im Wechsel',
    on_demand: 'Bei Bedarf',
  }
  return {
    ...timeline,
    versions: timeline.versions.map(version => ({
      ...version,
      frequency: legacyFrequencies[version.frequency] ?? version.frequency,
    })),
  }
}

function dateLabel(value: string, language: string, timeZone: string): string {
  const instant = value.includes('|')
    ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
    : new Date(value)
  return new Intl.DateTimeFormat(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: value.includes('|') ? 'UTC' : timeZone,
  }).format(instant)
}

function wallClockToIso(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error('Invalid local date-time')
  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const calendarCheck = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (
    calendarCheck.getUTCFullYear() !== year
    || calendarCheck.getUTCMonth() !== month - 1
    || calendarCheck.getUTCDate() !== day
    || hour > 23
    || minute > 59
  ) {
    throw new Error('Invalid local date-time')
  }

  const formatter = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const target = `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}`
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  for (let candidate = guess - 16 * 60 * 60_000; candidate <= guess + 16 * 60 * 60_000; candidate += 60_000) {
    const parts = new Map(formatter.formatToParts(new Date(candidate)).map(part => [part.type, part.value]))
    const candidateWallClock = `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}T${parts.get('hour')}:${parts.get('minute')}`
    if (candidateWallClock === target) return new Date(candidate).toISOString()
  }
  throw new Error(`Local date-time does not exist in ${timeZone}`)
}

// Einzahl und Mehrzahl waehlt der Code, nicht i18next: Sprachen mit mehr
// Pluralformen (ru, ar) faenden sonst keinen Schluessel und zeigten ihn roh.
function durationLabel(days: number, t: Translate): string {
  return String(days === 1
    ? t('my_stack_plan_duration_single', { days, defaultValue: '{{days}} Tag' })
    : t('my_stack_plan_duration_multiple', { days, defaultValue: '{{days}} Tage' }))
}

function slotCountLabel(slots: number, t: Translate): string {
  return String(slots === 1
    ? t('my_stack_plan_slot_count_single', { slots, defaultValue: '{{slots}} Einnahmezeit' })
    : t('my_stack_plan_slot_count_multiple', { slots, defaultValue: '{{slots}} Einnahmezeiten' }))
}

function stepKindLabel(version: CyclePlanVersion, t: Translate): string {
  const copy = {
    initial: { key: 'my_stack_plan_step_start', defaultValue: 'Start' },
    dose: { key: 'my_stack_plan_step_dose', defaultValue: 'Dosis' },
    schedule: { key: 'my_stack_plan_step_schedule', defaultValue: 'Plan' },
    titration: { key: 'my_stack_plan_step_titration', defaultValue: 'Titration' },
  }[version.change_kind]
  return String(t(copy.key, { defaultValue: copy.defaultValue }))
}

/**
 * Kurze Beschriftung fuer die Tages-Chips. Zwei Zeichen der Kurzform, solange
 * das die Tage unterscheidet („Mo", „Di"); sonst die schmale Form — im
 * Arabischen etwa beginnt jeder Kurzname mit demselben Artikel.
 */
function chipLabels(language: string): string[] {
  const kurz = WEEKDAY_KEYS.map(day => weekdayLabel(day, language).slice(0, 2))
  if (new Set(kurz).size === kurz.length) return kurz
  const schmal = new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' })
  return WEEKDAY_KEYS.map((_, index) => schmal.format(new Date(WEEKDAY_REFERENCE_UTC + index * 86_400_000)))
}

function DayChips({ days, language }: { days: string[]; language: string }) {
  const labels = chipLabels(language)
  return (
    <span aria-hidden="true" className="mt-1.5 flex flex-wrap gap-0.5">
      {WEEKDAY_KEYS.map((day, index) => {
        const active = days.includes(day)
        return (
          <span
            key={day}
            className={`grid h-5 min-w-5 place-items-center rounded-full px-0.5 text-[10px] font-bold ${active
              ? 'bg-cyan-300/15 text-cyan-100'
              : 'border border-white/10 text-slate-600'}`}
          >
            {labels[index]}
          </span>
        )
      })}
    </span>
  )
}

function CurrentSlotRow({ slot, language, t }: { slot: PlanCardSlot; language: string; t: Translate }) {
  const dose = slotDoseLabel(slot)
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <RoutineIcon group={slot.routineGroup} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-100">
          {routineLabel(slot, t)} · {slot.time}
        </p>
        {slot.days.length > 0 && (
          <span className="sr-only">{slot.days.map(day => weekdayLabel(day, language)).join(', ')}</span>
        )}
      </div>
      {dose && <p className="whitespace-nowrap text-base font-bold text-white">{dose}</p>}
      {slot.days.length > 0 && (
        <div className="col-span-2 col-start-2 -mt-1.5">
          <DayChips days={slot.days} language={language} />
        </div>
      )}
    </li>
  )
}

function ChangeMarker({ change, t }: { change: PlanStepRow['change']; t: Translate }) {
  if (change === 'initial') return null
  if (change === 'same') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-500/25 px-1.5 py-px text-[10.5px] font-semibold text-slate-400">
        <span aria-hidden="true" className="text-xs leading-none">=</span>
        {String(t('my_stack_plan_change_same', { defaultValue: 'gleich' }))}
      </span>
    )
  }
  const copy = {
    increased: { text: t('my_stack_plan_change_increased', { defaultValue: 'erhöht' }), arrow: '↑', tone: 'bg-emerald-400/15 text-emerald-200' },
    decreased: { text: t('my_stack_plan_change_decreased', { defaultValue: 'reduziert' }), arrow: '↓', tone: 'bg-amber-300/15 text-amber-100' },
    changed: { text: t('my_stack_plan_change_changed', { defaultValue: 'geändert' }), arrow: '', tone: 'bg-violet-300/15 text-violet-100' },
    new: { text: t('my_stack_plan_change_new', { defaultValue: 'neu' }), arrow: '', tone: 'bg-cyan-300/15 text-cyan-100' },
    removed: { text: t('my_stack_plan_change_removed', { defaultValue: 'entfällt' }), arrow: '', tone: 'bg-rose-300/10 text-rose-200' },
  }[change]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-bold ${copy.tone}`}>
      {copy.arrow && <span aria-hidden="true">{copy.arrow}</span>}
      {String(copy.text)}
    </span>
  )
}

function StepSlotRow({ row, language, t }: { row: PlanStepRow; language: string; t: Translate }) {
  const { slot, previous, change } = row
  const quiet = change === 'same' || change === 'removed'
  const dose = slotDoseLabel(slot)
  const previousDose = previous ? slotDoseLabel(previous) : null
  const doseMoved = previous != null && change !== 'removed' && previousDose !== dose
  const timeMoved = previous != null && change !== 'removed' && previous.time !== slot.time
  const days = slot.days.map(day => weekdayLabel(day, language)).join(', ')
  return (
    <li
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border px-2.5 py-2 ${quiet
        ? 'border-white/[0.04]'
        : 'border-white/[0.08] bg-white/[0.045]'}`}
    >
      <RoutineIcon group={slot.routineGroup} />
      <div className="min-w-0">
        <p className={`text-[13px] font-semibold ${quiet ? 'text-slate-400' : 'text-slate-100'}`}>
          {routineLabel(slot, t)} · {timeMoved && <span className="font-medium text-slate-500">{previous.time} → </span>}{slot.time}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-slate-400">
          {days && <span>{days}</span>}
          <ChangeMarker change={change} t={t} />
        </p>
      </div>
      {dose && (
        <p className={`flex flex-col items-end whitespace-nowrap text-sm font-bold ${quiet ? 'text-slate-400' : 'text-white'} ${change === 'removed' ? 'line-through' : ''}`}>
          {doseMoved && previousDose && (
            <span className="text-[11px] font-medium text-slate-500">{previousDose} →</span>
          )}
          <span>{dose}</span>
        </p>
      )}
    </li>
  )
}

export function PlanManagementSection({
  timeline,
  now,
  timeZone,
  onAdjustDose,
  onAdjustSchedule,
  onEditFuture,
  onRemoveFuture,
  onPause,
  onSetPauseEnd,
  onResume,
  onEnd,
  onRestart,
  needsReview = false,
  onResolveConflict,
}: PlanManagementSectionProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language || 'de'
  const resolved = resolveCycleAt(timeline, now, timeZone)
  const segments = planVersionSegments(timeline, now, timeZone)
  const currentVersion = resolved.planVersion
  const futureSegments = segments.filter(segment => segment.status === 'future')
  const displayVersion = currentVersion ?? futureSegments[0]?.version ?? null
  const isEnded = resolved.status === 'ended'
  const period = cyclePeriod(timeline, timeZone)
  // Ein beendeter Zyklus zeigt nur, was wirklich galt: eine Stufe ab dem Ende
  // wurde nie erreicht — auch nicht, wenn ihr Datum inzwischen vorbei ist.
  // Und nichts an ihm „gilt jetzt".
  const steps = isEnded
    ? segments
      .filter(segment => period.endKey === null || segment.effectiveFrom < period.endKey)
      .map(segment => ({ ...segment, status: 'past' as const }))
    : segments
  const panelVersion = isEnded ? steps[steps.length - 1]?.version ?? null : displayVersion
  const panelSlots = panelVersion ? versionSlots(panelVersion) : []
  const currentSegment = segments.find(segment => segment.status === 'current') ?? null
  // Eine einzige Stufe steht schon oben — der Verlauf lohnt erst ab zwei. Eine
  // geplante Stufe zeigt er immer, denn nur dort laesst sie sich bearbeiten.
  const showHistory = steps.length >= 2 || steps.some(segment => segment.status === 'future')
  // Vor dem Start beendet: der Zyklus lief nie, es gibt keinen Zeitraum.
  const neverRan = period.last !== null && period.last < period.first
  const today = localDateTimeKey(now, timeZone).slice(0, 10)
  const nextIntake = resolved.status === 'active' || resolved.status === 'planned'
    ? findNextTimelineIntake(timelineForIntakeResolution(timeline), now, timeZone)
    : null
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pauseEnd, setPauseEnd] = useState('')
  const [pending, setPending] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const pauseInputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const changePending = (value: boolean) => {
    pendingRef.current = value
    setPending(value)
  }

  const statusCopy = {
    planned: t('my_stack_plan_status_planned', { defaultValue: 'Geplant' }),
    active: t('aktiver_zyklus', { defaultValue: 'Aktiver Zyklus' }),
    paused: t('my_stack_plan_status_paused', { defaultValue: 'Pausiert' }),
    ended: t('my_stack_plan_status_ended', { defaultValue: 'Beendet' }),
  }[resolved.status]
  const isActive = resolved.status === 'active'

  const openDialog = (next: DialogState) => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setInlineError(null)
    if (next.kind === 'pause_end') {
      const currentEnd = resolved.pause?.ends_at
      setPauseEnd(currentEnd
        ? localDateTimeKey(new Date(currentEnd), timeZone).replace('|', 'T').slice(0, 16)
        : '')
    } else {
      setPauseEnd('')
    }
    setDialog(next)
  }

  const closeDialog = () => {
    if (pendingRef.current) return
    setPauseEnd('')
    setInlineError(null)
    setDialog(null)
  }

  useEffect(() => {
    if (!dialog) return
    const overlay = dialogRef.current?.parentElement
    const background = [...document.body.children].filter(element => element !== overlay)
    const previous = background.map(element => ({
      element: element as HTMLElement,
      inert: (element as HTMLElement).inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }))
    for (const entry of previous) {
      entry.element.inert = true
      entry.element.setAttribute('aria-hidden', 'true')
    }

    const initialFocus = pauseInputRef.current
      ?? dialogRef.current?.querySelector<HTMLElement>('button:not([disabled])')
      ?? dialogRef.current
    initialFocus?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!pendingRef.current) closeDialog()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])]
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      for (const entry of previous) {
        entry.element.inert = entry.inert
        if (entry.ariaHidden === null) entry.element.removeAttribute('aria-hidden')
        else entry.element.setAttribute('aria-hidden', entry.ariaHidden)
      }
      previousFocusRef.current?.focus()
    }
  }, [dialog])

  const submitDialog = async () => {
    if (!dialog) return
    changePending(true)
    setInlineError(null)
    try {
      if (dialog.kind === 'pause' || dialog.kind === 'pause_end') {
        const pauseEndInstant = pauseEnd ? wallClockToIso(pauseEnd, timeZone) : null
        if (dialog.kind === 'pause') await onPause(pauseEndInstant)
        else await onSetPauseEnd(pauseEndInstant)
      }
      if (dialog.kind === 'remove') await onRemoveFuture(dialog.version)
      if (dialog.kind === 'end') await onEnd()
      setPauseEnd('')
      setDialog(null)
    } catch {
      setInlineError(String(t('my_stack_plan_action_error', {
        defaultValue: 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
      })))
    } finally {
      changePending(false)
    }
  }

  const resume = async () => {
    changePending(true)
    setInlineError(null)
    try {
      await onResume()
    } catch {
      setInlineError(String(t('my_stack_plan_action_error', {
        defaultValue: 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
      })))
    } finally {
      changePending(false)
    }
  }

  const restart = async () => {
    changePending(true)
    setInlineError(null)
    try {
      await onRestart(timeline.cycle.id)
    } catch {
      setInlineError(String(t('my_stack_plan_restart_error', {
        defaultValue: 'Der Plan konnte nicht neu gestartet werden. Bitte versuche es erneut.',
      })))
    } finally {
      changePending(false)
    }
  }

  const resolveConflict = async () => {
    if (!onResolveConflict) return
    changePending(true)
    setInlineError(null)
    try {
      await onResolveConflict()
    } catch {
      setInlineError(String(t('my_stack_plan_conflict_error', {
        defaultValue: 'Der Konflikt konnte nicht aufgelöst werden. Bitte versuche es erneut.',
      })))
    } finally {
      changePending(false)
    }
  }

  const dialogTitle = dialog?.kind === 'pause'
    ? t('my_stack_plan_pause_title', { defaultValue: 'Plan pausieren' })
    : dialog?.kind === 'pause_end'
      ? t('my_stack_plan_pause_end_title', { defaultValue: 'Pausenende festlegen' })
      : dialog?.kind === 'remove'
        ? t('my_stack_plan_remove_future_title', { defaultValue: 'Geplante Änderung entfernen' })
        : t('my_stack_plan_end_title', { defaultValue: 'Plan beenden' })

  const confirmLabel = dialog?.kind === 'pause'
    ? t('my_stack_plan_pause_confirm', { defaultValue: 'Pause bestätigen' })
    : dialog?.kind === 'pause_end'
      ? t('my_stack_plan_pause_end_confirm', { defaultValue: 'Pausenende speichern' })
      : dialog?.kind === 'remove'
        ? t('my_stack_plan_remove_future_confirm', { defaultValue: 'Änderung entfernen' })
        : t('my_stack_plan_end_confirm', { defaultValue: 'Plan beenden' })

  if (needsReview) {
    return (
      <section
        data-testid={`plan-management-${timeline.cycle.id}`}
        className="rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4 shadow-[0_18px_60px_rgba(2,6,23,0.28)]"
      >
        <p className="text-sm font-bold text-amber-100">
          {t('my_stack_plan_conflict_title', { defaultValue: 'Welcher Plan läuft wirklich?' })}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {t('my_stack_plan_conflict_copy', {
            defaultValue: 'Wähle den Plan, der gerade tatsächlich läuft. Deine bisherigen Einnahmen und der gesamte Verlauf bleiben erhalten.',
          })}
        </p>
        <p className="mt-3 text-xs font-semibold text-slate-400">
          {t('my_stack_plan_conflict_started', {
            defaultValue: 'Gestartet am {{date}}',
            date: dateLabel(timeline.cycle.started_at, language, timeZone),
          })}
        </p>
        <button
          type="button"
          disabled={pending || !onResolveConflict}
          onClick={() => void resolveConflict()}
          className="mt-4 min-h-11 w-full rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 text-sm font-bold text-amber-100 disabled:opacity-50"
        >
          {t('my_stack_plan_conflict_keep', { defaultValue: 'Diesen laufenden Plan behalten' })}
        </button>
        {inlineError && <p role="alert" className="mt-3 text-sm text-rose-200">{inlineError}</p>}
      </section>
    )
  }

  return (
    <section
      data-testid={`plan-management-${timeline.cycle.id}`}
      data-cycle-status={resolved.status}
      className={`rounded-2xl border p-4 backdrop-blur-xl ${isActive
        ? 'border-emerald-400/35 bg-emerald-950/20 shadow-[0_18px_60px_rgba(16,185,129,0.10)]'
        : 'border-white/10 bg-slate-900/55 shadow-[0_18px_60px_rgba(2,6,23,0.28)]'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isActive ? 'text-emerald-300' : 'text-cyan-300'}`}>
            {t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' })}
          </p>
          <span
            role="status"
            aria-label={String(statusCopy)}
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${isActive
              ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
              : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'}`}
          >
            {isActive && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]" />}
            {statusCopy}
          </span>
        </div>
      </div>

      {!isEnded && !displayVersion ? null : (
        <>
          <div className="mt-4 flex items-center gap-2.5">
            <CalendarDays size={16} aria-hidden="true" className={`shrink-0 ${isActive ? 'text-emerald-300' : 'text-cyan-300'}`} />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white">
                {dateLabel(`${period.first}|00:00:00`, language, timeZone)}
                {!neverRan && ' – '}
                {neverRan
                  ? null
                  : period.last
                    ? dateLabel(`${period.last}|00:00:00`, language, timeZone)
                    : t('my_stack_plan_open_end', { defaultValue: 'Ende offen' })}
              </p>
              {neverRan ? null : isEnded && period.last ? (
                <p className="mt-0.5 text-xs text-slate-400">
                  {durationLabel(Math.max(1, inclusiveDayCount(period.first, period.last)), t)}
                </p>
              ) : !isEnded && today >= period.first ? (
                <p className="mt-0.5 text-xs text-slate-400">
                  {period.last
                    ? t('my_stack_plan_day_of', {
                      day: Math.min(inclusiveDayCount(period.first, today), inclusiveDayCount(period.first, period.last)),
                      total: inclusiveDayCount(period.first, period.last),
                      defaultValue: 'Tag {{day}} von {{total}}',
                    })
                    : t('my_stack_plan_day', {
                      day: inclusiveDayCount(period.first, today),
                      defaultValue: 'Tag {{day}}',
                    })}
                </p>
              ) : null}
            </div>
          </div>

          {panelVersion && (
            <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold text-white">
                  {isEnded
                    ? t('my_stack_plan_last_plan', { defaultValue: 'Zuletzt' })
                    : resolved.status === 'planned'
                      ? t('my_stack_plan_from_date', {
                        date: dateLabel(`${period.first}|00:00:00`, language, timeZone),
                        defaultValue: 'Ab {{date}}',
                      })
                      : t('my_stack_plan_now', { defaultValue: 'Jetzt' })}
                </h3>
                {!isEnded && currentSegment && (
                  <p className="text-xs text-slate-400">
                    {t('my_stack_plan_valid_since', {
                      date: dateLabel(currentSegment.effectiveFrom, language, timeZone),
                      defaultValue: 'gilt seit {{date}}',
                    })}
                  </p>
                )}
              </div>
              <p className="mt-2 text-[13px] text-slate-300">
                {rhythmLabel(panelVersion, t)}
                {panelSlots.length > 0 && ` · ${slotCountLabel(panelSlots.length, t)}`}
              </p>
              {panelSlots.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {panelSlots.map(slot => (
                    <CurrentSlotRow key={slot.id} slot={slot} language={language} t={t} />
                  ))}
                </ul>
              )}

              {isEnded ? null : resolved.status === 'paused' ? (
                <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2.5 text-sm text-amber-100">
                  {t('my_stack_plan_pause_neutral', { defaultValue: 'Während der Pause ist keine Einnahme fällig.' })}
                </p>
              ) : (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2.5">
                  <Clock size={15} className="mt-0.5 shrink-0 text-cyan-300" />
                  <div>
                    <p className="text-xs text-slate-500">{t('my_stack_plan_next_intake', { defaultValue: 'Nächste Einnahme' })}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-100">
                      {nextIntake
                        ? `${dateLabel(`${nextIntake.localDate}|00:00:00`, language, timeZone)} · ${nextIntake.time}`
                        : t('my_stack_plan_next_intake_none', { defaultValue: 'Keine feste Einnahme geplant' })}
                    </p>
                  </div>
                </div>
              )}

              {!isEnded && currentVersion && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onAdjustDose(currentVersion)}
                    className="min-h-11 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 disabled:opacity-50"
                  >
                    {t('my_stack_plan_adjust_dose', { defaultValue: 'Dosis anpassen' })}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onAdjustSchedule(currentVersion)}
                    className="min-h-11 rounded-xl border border-violet-300/25 bg-violet-300/10 px-3 text-sm font-semibold text-violet-100 disabled:opacity-50"
                  >
                    {t('my_stack_plan_adjust_schedule', { defaultValue: 'Plan anpassen' })}
                  </button>
                </div>
              )}
            </div>
          )}

          {showHistory && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold text-white">
                  {t('my_stack_plan_dose_history', { defaultValue: 'Dosisverlauf' })}
                </h3>
                {futureSegments.length > 0 && !isEnded && (
                  <p className="text-[11.5px] text-slate-500">
                    {t('my_stack_plan_planned_count', {
                      planned: futureSegments.length,
                      defaultValue: '{{planned}} geplant',
                    })}
                  </p>
                )}
              </div>
              <ol className="mt-3">
                {steps.map((segment, index) => {
                  const previous = steps[index - 1]?.version ?? null
                  const effectiveDate = dateLabel(segment.effectiveFrom, language, timeZone)
                  const isLast = index === steps.length - 1
                  const rhythm = rhythmLabel(segment.version, t)
                  const previousRhythm = previous ? rhythmLabel(previous, t) : null
                  const rows = isOnDemandRhythm(versionRhythm(segment.version))
                    ? []
                    : planStepRows(segment.version, previous && !isOnDemandRhythm(versionRhythm(previous)) ? previous : null)
                  const actions = segment.status === 'future' && (
                    <div className="-my-2.5 -mr-1 flex shrink-0">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onEditFuture(segment.version)}
                        aria-label={String(t('my_stack_plan_edit_future', {
                          defaultValue: 'Geplante Änderung vom {{date}} bearbeiten',
                          date: effectiveDate,
                        }))}
                        className="grid h-11 w-11 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-violet-200 disabled:opacity-50"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={pending || segment.version.change_kind === 'initial' || timeline.versions.length === 1}
                        onClick={() => openDialog({ kind: 'remove', version: segment.version })}
                        aria-label={String(t('my_stack_plan_remove_future', {
                          defaultValue: 'Geplante Änderung vom {{date}} entfernen',
                          date: effectiveDate,
                        }))}
                        className="grid h-11 w-11 place-items-center rounded-lg text-slate-400 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                  const header = (
                    <>
                      <div className="flex items-start gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <p className={`text-[13px] font-bold ${segment.status === 'future' ? 'text-violet-100' : segment.status === 'current' ? 'text-white' : 'text-slate-300'}`}>
                            {effectiveDate} · {stepKindLabel(segment.version, t)}
                          </p>
                          {segment.status === 'current' && (
                            <span className="rounded-full bg-emerald-400/15 px-2 py-px text-[11px] font-bold text-emerald-200">
                              {t('my_stack_plan_step_current', { defaultValue: 'gilt jetzt' })}
                            </span>
                          )}
                          {segment.status === 'future' && (
                            <span className="rounded-full bg-violet-300/15 px-2 py-px text-[11px] font-bold text-violet-200">
                              {t('my_stack_plan_step_planned', { defaultValue: 'geplant' })}
                            </span>
                          )}
                        </div>
                        {actions}
                      </div>
                      {(previousRhythm === null || previousRhythm !== rhythm) && (
                        <p className="mt-1 text-[11.5px] text-slate-400">
                          {previousRhythm !== null && <span className="text-slate-500">{previousRhythm} → </span>}
                          {rhythm}
                        </p>
                      )}
                      {rows.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {rows.map(row => (
                            <StepSlotRow key={`${row.change}-${row.slot.id}`} row={row} language={language} t={t} />
                          ))}
                        </ul>
                      )}
                    </>
                  )
                  return (
                    <li key={segment.version.id} className="flex gap-3">
                      <div aria-hidden="true" className="flex w-4 shrink-0 flex-col items-center">
                        {segment.status === 'current' ? (
                          <span className="mt-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]" />
                        ) : segment.status === 'future' ? (
                          <span className="mt-1 h-3 w-3 rounded-full border-2 border-dashed border-violet-300" />
                        ) : (
                          <span className="mt-1 h-3 w-3 rounded-full border-2 border-slate-500" />
                        )}
                        {!isLast && <span className={`w-0.5 flex-1 ${steps[index + 1]?.status === 'future' ? 'bg-violet-300/35' : 'bg-slate-400/25'}`} />}
                      </div>
                      {segment.status === 'future' ? (
                        <div className={`-mt-1.5 min-w-0 flex-1 rounded-xl border border-violet-300/20 bg-violet-300/5 p-2.5 pl-3 ${isLast ? '' : 'mb-4'}`}>
                          {header}
                        </div>
                      ) : (
                        <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-4'}`}>{header}</div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {isEnded ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => void restart()}
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-bold text-cyan-100 transition-colors hover:bg-cyan-300/15"
              >
                <RotateCcw size={15} /> {t('my_stack_plan_restart', { defaultValue: 'Neu starten' })}
              </button>
              {inlineError && <p role="alert" className="mt-3 text-sm text-rose-200">{inlineError}</p>}
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                {resolved.status === 'paused' ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void resume()}
                      className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100 disabled:opacity-50"
                    >
                      <Play size={14} /> {t('my_stack_plan_resume', { defaultValue: 'Fortsetzen' })}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openDialog({ kind: 'pause_end' })}
                      className="min-h-10 flex-1 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100 disabled:opacity-50"
                    >
                      {t('my_stack_plan_pause_end', { defaultValue: 'Pausenende festlegen' })}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => openDialog({ kind: 'pause' })}
                    className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100 disabled:opacity-50"
                  >
                    <Pause size={14} /> {t('my_stack_plan_pause', { defaultValue: 'Pausieren' })}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openDialog({ kind: 'end' })}
                  className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 text-sm font-semibold text-rose-100 disabled:opacity-50"
                >
                  <Flag size={14} /> {t('my_stack_plan_end', { defaultValue: 'Beenden' })}
                </button>
              </div>
              {inlineError && !dialog && <p role="alert" className="mt-3 text-sm text-rose-200">{inlineError}</p>}
            </>
          )}
        </>
      )}

      {dialog && createPortal((
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-4 sm:items-center" data-app-modal>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={String(dialogTitle)}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-white">{dialogTitle}</h3>
              <button
                type="button"
                disabled={pending}
                onClick={closeDialog}
                data-app-back-close
                aria-label={String(t('close', { defaultValue: 'Schließen' }))}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {(dialog.kind === 'pause' || dialog.kind === 'pause_end') && (
              <label className="mt-4 block text-sm text-slate-300">
                {dialog.kind === 'pause'
                  ? t('my_stack_plan_pause_until_optional', { defaultValue: 'Pausieren bis (optional)' })
                  : t('my_stack_plan_pause_until', { defaultValue: 'Pausieren bis' })}
                <input
                  ref={pauseInputRef}
                  type="datetime-local"
                  value={pauseEnd}
                  disabled={pending}
                  onChange={event => setPauseEnd(event.target.value)}
                  className="input mt-2 w-full"
                />
              </label>
            )}

            {dialog.kind === 'end' && (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {t('my_stack_plan_end_copy', { defaultValue: 'Der Plan endet jetzt. Sein Verlauf bleibt erhalten.' })}
              </p>
            )}

            {dialog.kind === 'remove' && (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {t('my_stack_plan_remove_future_copy', { defaultValue: 'Diese geplante Änderung wird entfernt. Der aktuelle Plan bleibt unverändert.' })}
              </p>
            )}

            {inlineError && <p role="alert" className="mt-3 text-sm text-rose-200">{inlineError}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={closeDialog}
                className="min-h-11 flex-1 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-300 disabled:opacity-50"
              >
                {t('cancel', { defaultValue: 'Abbrechen' })}
              </button>
              <button
                type="button"
                disabled={pending || (dialog.kind === 'pause_end' && !pauseEnd)}
                onClick={() => void submitDialog()}
                className="min-h-11 flex-1 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 text-sm font-bold text-cyan-100 disabled:opacity-50"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </section>
  )
}
