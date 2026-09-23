import { ChevronRight, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { findNextTimelineIntake } from '../../../lib/intakeSchedule'
import { localDateTimeKey, resolveCycleAt, type CycleTimeline } from '../../../lib/planTimeline'
import { planVersionSegments } from '../lib/planSegments'
import { cyclePeriod, inclusiveDayCount, planStepRows } from '../lib/planCard'
import {
  dateLabel,
  durationLabel,
  rhythmLabel,
  slotCountLabel,
  slotDoseLabel,
  stepKindLabel,
  timelineForIntakeResolution,
  versionSlots,
  type Translate,
} from '../lib/planLabels'
import { CurrentSlotRow } from './planCardParts'

export interface PlanSummaryCardProps {
  timelines: CycleTimeline[]
  now: Date
  timeZone: string
  needsReview?: boolean
  /** Oeffnet die volle Plan-Uebersicht (Zyklusverwalter). */
  onOpen(): void
  onStartNew(): void
}

const STATUS_PRIORITY = { active: 0, paused: 1, planned: 2, ended: 3 } as const

/**
 * Der Zyklus, um den es geht: der laufende vor dem pausierten vor dem
 * geplanten vor dem beendeten — dieselbe Reihenfolge wie im Zyklusverwalter.
 */
function relevantTimeline(timelines: CycleTimeline[], now: Date, timeZone: string) {
  return timelines
    .map(timeline => ({ timeline, resolved: resolveCycleAt(timeline, now, timeZone) }))
    .sort((left, right) => (
      STATUS_PRIORITY[left.resolved.status] - STATUS_PRIORITY[right.resolved.status]
      || String(right.timeline.cycle.started_at).localeCompare(String(left.timeline.cycle.started_at))
    ))[0] ?? null
}

const CARD = 'mx-1 mt-2 flex flex-col gap-3 rounded-2xl border p-3.5'
const OPEN_BUTTON = 'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/15'
const QUIET_BUTTON = 'flex min-h-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 px-3 text-sm font-semibold text-slate-300 transition-colors hover:text-white'

/**
 * Der Plan in Kurzform, oben im Vollbild: was gerade gilt, wann die naechste
 * Einnahme ist und ob eine Stufe ansteht. Alles Weitere — Verlauf, Pause,
 * Aendern — steht in der vollen Uebersicht, ein Tipp entfernt.
 */
export function PlanSummaryCard({ timelines, now, timeZone, needsReview = false, onOpen, onStartNew }: PlanSummaryCardProps) {
  const { t, i18n } = useTranslation()
  const language = i18n?.language || 'de'
  const tr = t as Translate
  const openLabel = t('my_stack_plan_open_overview', { defaultValue: 'Plan & Verlauf öffnen' })

  if (needsReview) {
    return (
      <section data-plan-summary="review" aria-label={String(t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' }))} className={`${CARD} border-amber-300/25 bg-amber-300/5`}>
        <p className="text-sm font-bold text-amber-100">
          {t('my_stack_plan_conflict_title', { defaultValue: 'Welcher Plan läuft wirklich?' })}
        </p>
        <button type="button" onClick={onOpen} className={OPEN_BUTTON}>
          {openLabel} <ChevronRight size={16} aria-hidden="true" />
        </button>
      </section>
    )
  }

  const best = relevantTimeline(timelines, now, timeZone)
  const status = best?.resolved.status

  if (!best || !status || status === 'ended') {
    const period = best ? cyclePeriod(best.timeline, timeZone) : null
    return (
      <section data-plan-summary="none" aria-label={String(t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' }))} className={`${CARD} border-dashed border-slate-500/30 bg-slate-900/40`}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-300">
            {t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' })}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {best ? t('kein_aktiver_zyklus', { defaultValue: 'Kein aktiver Zyklus' }) : t('noch_kein_zyklus', { defaultValue: 'Noch kein Zyklus' })}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {period?.last && period.last >= period.first
              ? t('my_stack_plan_last_period', {
                defaultValue: 'Zuletzt: {{period}}',
                period: `${dateLabel(`${period.first}|00:00:00`, language, timeZone)} – ${dateLabel(`${period.last}|00:00:00`, language, timeZone)} · ${durationLabel(inclusiveDayCount(period.first, period.last), tr)}`,
              })
              : !best && t('noch_kein_zyklus_desc', { defaultValue: 'Lege einen Zyklus an, um Dosis, Frequenz und Reminder für diese Substanz zu planen.' })}
          </p>
        </div>
        <div className={`grid gap-2 ${best ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button type="button" onClick={onStartNew} className={OPEN_BUTTON}>
            {t('my_stack_plan_start_new', { defaultValue: 'Neuen Zyklus starten' })}
          </button>
          {best && (
            <button type="button" onClick={onOpen} className={QUIET_BUTTON}>
              {t('my_stack_plan_view_history', { defaultValue: 'Verlauf ansehen' })}
            </button>
          )}
        </div>
      </section>
    )
  }

  const { timeline, resolved } = best
  const segments = planVersionSegments(timeline, now, timeZone)
  const version = resolved.planVersion ?? segments.find(segment => segment.status === 'future')?.version ?? null
  if (!version) return null
  const slots = versionSlots(version)
  const period = cyclePeriod(timeline, timeZone)
  const today = localDateTimeKey(now, timeZone).slice(0, 10)
  const nextStep = segments.find(segment => segment.status === 'future' && segment.version.id !== version.id) ?? null
  const nextIntake = resolved.status === 'paused'
    ? null
    : findNextTimelineIntake(timelineForIntakeResolution(timeline), now, timeZone)

  // Was die naechste Stufe aendert, in einem Wort: die neue Menge, wenn es
  // genau eine ist — sonst die Art der Stufe.
  const nextStepText = nextStep
    ? (() => {
      const doses = new Set(planStepRows(nextStep.version, version)
        .filter(row => row.change !== 'same' && row.change !== 'removed')
        .map(row => slotDoseLabel(row.slot))
        .filter((dose): dose is string => dose !== null))
      return doses.size === 1 ? [...doses][0] : stepKindLabel(nextStep.version, tr)
    })()
    : null

  const isActive = status === 'active'
  const statusLabel = {
    active: t('aktiver_zyklus', { defaultValue: 'Aktiver Zyklus' }),
    paused: t('my_stack_plan_status_paused', { defaultValue: 'Pausiert' }),
    planned: t('my_stack_plan_status_planned', { defaultValue: 'Geplant' }),
  }[status]

  return (
    <section
      data-plan-summary={resolved.status}
      aria-label={String(t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' }))}
      className={`${CARD} ${isActive ? 'border-emerald-400/35 bg-emerald-950/20' : 'border-white/10 bg-slate-900/55'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${isActive
          ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
          : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'}`}>
          {isActive && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          {statusLabel}
        </span>
        <span className="text-xs text-slate-400">
          {resolved.status === 'planned' || today < period.first
            ? t('my_stack_plan_from_date', { defaultValue: 'Ab {{date}}', date: dateLabel(`${period.first}|00:00:00`, language, timeZone) })
            : t('my_stack_plan_since_day', {
              defaultValue: 'seit {{date}} · Tag {{day}}',
              date: dateLabel(`${period.first}|00:00:00`, language, timeZone),
              day: inclusiveDayCount(period.first, today),
            })}
        </span>
      </div>

      <div>
        <p className="text-xs text-slate-400">
          {rhythmLabel(version, tr)}
          {slots.length > 0 && ` · ${slotCountLabel(slots.length, tr)}`}
        </p>
        {slots.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {slots.map(slot => <CurrentSlotRow key={slot.id} slot={slot} language={language} t={tr} />)}
          </ul>
        )}
      </div>

      <div className={`grid gap-2 ${nextStepText ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {resolved.status === 'paused' ? (
          <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-100">
            {t('my_stack_plan_pause_neutral', { defaultValue: 'Während der Pause ist keine Einnahme fällig.' })}
          </p>
        ) : (
          <div className="min-w-0 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Clock size={12} aria-hidden="true" />
              {t('my_stack_plan_next_intake', { defaultValue: 'Nächste Einnahme' })}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-100">
              {nextIntake
                ? `${dateLabel(`${nextIntake.localDate}|00:00:00`, language, timeZone)} · ${nextIntake.time}`
                : t('my_stack_plan_next_intake_none', { defaultValue: 'Keine feste Einnahme geplant' })}
            </p>
          </div>
        )}
        {nextStep && nextStepText && (
          <div className="min-w-0 rounded-xl border border-violet-300/25 bg-violet-300/5 px-3 py-2">
            <p className="text-[11px] text-slate-500">{t('my_stack_plan_next_step', { defaultValue: 'Nächste Stufe' })}</p>
            <p className="mt-0.5 text-sm font-semibold text-violet-100">
              {dateLabel(nextStep.effectiveFrom, language, timeZone)} · {nextStepText}
            </p>
          </div>
        )}
      </div>

      <button type="button" onClick={onOpen} className={OPEN_BUTTON}>
        {openLabel} <ChevronRight size={16} aria-hidden="true" />
      </button>
    </section>
  )
}
