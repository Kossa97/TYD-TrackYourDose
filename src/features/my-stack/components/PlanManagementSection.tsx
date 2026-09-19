import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Clock, Flag, Pause, Pencil, Play, RotateCcw, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { findNextTimelineIntake } from '../../../lib/intakeSchedule'
import {
  localDateTimeKey,
  resolveCycleAt,
  type CyclePlanVersion,
  type CycleTimeline,
} from '../../../lib/planTimeline'
import { planVersionSegments, type PlanVersionSegment } from '../lib/planSegments'
import { rhythmFromStorage, rhythmSummary, rhythmText } from '../lib/intakeRhythm'

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

function doseLabel(version: CyclePlanVersion): string {
  if (version.dose == null) return '–'
  return `${version.dose} ${version.unit ?? ''}`.trim()
}

function rhythmLabel(
  version: CyclePlanVersion,
  t: (key: string, options?: Record<string, unknown>) => unknown,
): string {
  const legacyFrequency: Record<string, string> = {
    daily: 'Täglich',
    weekdays: 'Wochentage wählen',
    interval: 'Alle X Tage',
    cycle: 'Im Wechsel',
    on_demand: 'Bei Bedarf',
  }
  const rhythm = rhythmFromStorage({
    frequency: legacyFrequency[version.frequency] ?? version.frequency,
    x_days_interval: version.x_days_interval,
    interval_unit: version.interval_unit,
    cycle_on_days: version.cycle_on_days,
    cycle_off_days: version.cycle_off_days,
    schedule_days: version.schedule_days,
  })
  return rhythmText(rhythmSummary(rhythm), t)
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

function HistoryRow({
  segment,
  language,
  timeZone,
  t,
}: {
  segment: PlanVersionSegment
  language: string
  timeZone: string
  t: (key: string, options?: Record<string, unknown>) => unknown
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-800/80 bg-slate-950/45 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-200">
          {dateLabel(segment.effectiveFrom, language, timeZone)}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {doseLabel(segment.version)} · {rhythmLabel(segment.version, t)}
        </p>
      </div>
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
  const historySegments = segments.filter(segment => segment.status !== 'future')
  const nextIntake = resolved.status === 'active' || resolved.status === 'planned'
    ? findNextTimelineIntake(timelineForIntakeResolution(timeline), now, timeZone)
    : null
  const nextFuture = futureSegments[0] ?? null
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pauseEnd, setPauseEnd] = useState('')
  const [pending, setPending] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const pauseInputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  pendingRef.current = pending

  const statusCopy = {
    planned: t('my_stack_plan_status_planned', { defaultValue: 'Geplant' }),
    active: t('my_stack_plan_status_active', { defaultValue: 'Aktiv' }),
    paused: t('my_stack_plan_status_paused', { defaultValue: 'Pausiert' }),
    ended: t('my_stack_plan_status_ended', { defaultValue: 'Beendet' }),
  }[resolved.status]

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
    setPending(true)
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
      setPending(false)
    }
  }

  const resume = async () => {
    setPending(true)
    setInlineError(null)
    try {
      await onResume()
    } catch {
      setInlineError(String(t('my_stack_plan_action_error', {
        defaultValue: 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
      })))
    } finally {
      setPending(false)
    }
  }

  const restart = async () => {
    setPending(true)
    setInlineError(null)
    try {
      await onRestart(timeline.cycle.id)
    } catch {
      setInlineError(String(t('my_stack_plan_restart_error', {
        defaultValue: 'Der Plan konnte nicht neu gestartet werden. Bitte versuche es erneut.',
      })))
    } finally {
      setPending(false)
    }
  }

  const resolveConflict = async () => {
    if (!onResolveConflict) return
    setPending(true)
    setInlineError(null)
    try {
      await onResolveConflict()
    } catch {
      setInlineError(String(t('my_stack_plan_conflict_error', {
        defaultValue: 'Der Konflikt konnte nicht aufgelöst werden. Bitte versuche es erneut.',
      })))
    } finally {
      setPending(false)
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
      className="rounded-2xl border border-white/10 bg-slate-900/55 p-4 shadow-[0_18px_60px_rgba(2,6,23,0.28)] backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
            {t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' })}
          </p>
          <span className="mt-2 inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-bold text-cyan-100">
            {statusCopy}
          </span>
        </div>
      </div>

      {resolved.status === 'ended' ? (
        <>
          <div className="mt-4">
            <h3 className="text-sm font-bold text-white">
              {t('my_stack_plan_history', { defaultValue: 'Verlauf' })}
            </h3>
            <ul className="mt-2 space-y-2">
              {segments.map(segment => (
                <HistoryRow key={segment.version.id} segment={segment} language={language} timeZone={timeZone} t={t} />
              ))}
            </ul>
          </div>
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
      ) : displayVersion ? (
        <>
          <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-500">{t('my_stack_plan_dose', { defaultValue: 'Dosis' })}</p>
                <p className="mt-1 font-semibold text-white">{doseLabel(displayVersion)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">{t('my_stack_plan_rhythm_label', { defaultValue: 'Rhythmus' })}</p>
                <p className="mt-1 font-semibold text-white">{rhythmLabel(displayVersion, t)}</p>
              </div>
            </div>

            {resolved.status === 'paused' ? (
              <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2.5 text-sm text-amber-100">
                {t('my_stack_plan_pause_neutral', { defaultValue: 'Während der Pause ist keine Einnahme fällig.' })}
              </p>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2.5">
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

            {nextFuture && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-violet-300/20 bg-violet-300/5 px-3 py-2.5">
                <CalendarDays size={15} className="mt-0.5 shrink-0 text-violet-300" />
                <div>
                  <p className="text-xs text-slate-500">{t('my_stack_plan_next_change', { defaultValue: 'Nächste Änderung' })}</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-100">
                    {dateLabel(nextFuture.effectiveFrom, language, timeZone)} · {doseLabel(nextFuture.version)}
                  </p>
                </div>
              </div>
            )}

            {currentVersion && (
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

          {futureSegments.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-white">
                {t('my_stack_plan_future_changes', { defaultValue: 'Geplante Änderungen' })}
              </h3>
              <ul className="mt-2 space-y-2">
                {futureSegments.map(segment => {
                  const effectiveDate = dateLabel(segment.effectiveFrom, language, timeZone)
                  return (
                    <li key={segment.version.id} className="flex items-center gap-3 rounded-xl border border-violet-300/15 bg-violet-300/5 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-violet-100">{effectiveDate}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-400">
                          {doseLabel(segment.version)} · {rhythmLabel(segment.version, t)}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onEditFuture(segment.version)}
                        aria-label={String(t('my_stack_plan_edit_future', {
                          defaultValue: 'Geplante Änderung vom {{date}} bearbeiten',
                          date: effectiveDate,
                        }))}
                        className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-violet-200 disabled:opacity-50"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openDialog({ kind: 'remove', version: segment.version })}
                        aria-label={String(t('my_stack_plan_remove_future', {
                          defaultValue: 'Geplante Änderung vom {{date}} entfernen',
                          date: effectiveDate,
                        }))}
                        className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {historySegments.some(segment => segment.status === 'past') && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-white">
                {t('my_stack_plan_history', { defaultValue: 'Verlauf' })}
              </h3>
              <ul className="mt-2 space-y-2">
                {historySegments.filter(segment => segment.status === 'past').map(segment => (
                  <HistoryRow key={segment.version.id} segment={segment} language={language} timeZone={timeZone} t={t} />
                ))}
              </ul>
            </div>
          )}

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
      ) : null}

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
