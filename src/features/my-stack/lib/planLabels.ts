import { findNextTimelineIntake, type ResolvedRoutineGroup } from '../../../lib/intakeSchedule'
import {
  resolveCycleAt,
  type CycleLifecycleStatus,
  type CyclePlanVersion,
  type CycleTimeline,
} from '../../../lib/planTimeline'
import {
  WEEKDAY_KEYS,
  isOnDemandRhythm,
  rhythmFromStorage,
  rhythmSummary,
  rhythmText,
} from './intakeRhythm'
import type { IntakeRhythm } from '../types'
import { planCardSlots, type PlanCardSlot } from './planCard'

/**
 * Wie der Plan beschrieben wird — geteilt von der vollen Plan-Uebersicht
 * (`PlanManagementSection`) und der Kurzfassung im Vollbild
 * (`PlanSummaryCard`), damit beide denselben Plan gleich nennen.
 */

export type Translate = (key: string, options?: Record<string, unknown>) => unknown

// Plan-Versionen speichern die Frequenz als Schluessel ('daily'); die
// Rhythmus- und Einnahmelogik kennt die alten deutschen Texte.
const LEGACY_FREQUENCY: Readonly<Record<string, string>> = {
  daily: 'Täglich',
  weekdays: 'Wochentage wählen',
  interval: 'Alle X Tage',
  cycle: 'Im Wechsel',
  on_demand: 'Bei Bedarf',
}

function legacyFrequency(frequency: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_FREQUENCY, frequency) ? LEGACY_FREQUENCY[frequency] : frequency
}

export function versionRhythm(version: CyclePlanVersion): IntakeRhythm {
  return rhythmFromStorage({
    frequency: legacyFrequency(version.frequency),
    x_days_interval: version.x_days_interval,
    interval_unit: version.interval_unit,
    cycle_on_days: version.cycle_on_days,
    cycle_off_days: version.cycle_off_days,
    schedule_days: version.schedule_days,
  })
}

export function rhythmLabel(version: CyclePlanVersion, t: Translate): string {
  return rhythmText(rhythmSummary(versionRhythm(version)), t)
}

/** „Bei Bedarf" hat keine Einnahmezeiten — die gespeicherte Tageszeit bedeutet dort nichts. */
export function versionSlots(version: CyclePlanVersion): PlanCardSlot[] {
  return isOnDemandRhythm(versionRhythm(version)) ? [] : planCardSlots(version)
}

export function slotDoseLabel(slot: PlanCardSlot): string | null {
  if (slot.dose == null) return null
  return `${slot.dose} ${slot.unit ?? ''}`.trim()
}

// Ein beliebiger Montag (UTC), um Wochentagsnamen in der App-Sprache zu bilden.
const WEEKDAY_REFERENCE_UTC = Date.UTC(2026, 0, 5)

export function weekdayLabel(day: string, language: string): string {
  const index = WEEKDAY_KEYS.indexOf(day as (typeof WEEKDAY_KEYS)[number])
  if (index < 0) return day
  return new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(WEEKDAY_REFERENCE_UTC + index * 86_400_000))
    .replace(/\.$/, '')
}

export const ROUTINE_LABEL: Record<ResolvedRoutineGroup, { key: string; defaultValue: string }> = {
  morning: { key: 'my_stack_routine_morning', defaultValue: 'Morgens' },
  midday: { key: 'my_stack_routine_midday', defaultValue: 'Mittags' },
  evening: { key: 'my_stack_routine_evening', defaultValue: 'Abends' },
}

export function routineLabel(slot: PlanCardSlot, t: Translate): string {
  const label = ROUTINE_LABEL[slot.routineGroup]
  return String(t(label.key, { defaultValue: label.defaultValue }))
}


export function timelineForIntakeResolution(timeline: CycleTimeline): CycleTimeline {
  return {
    ...timeline,
    versions: timeline.versions.map(version => ({ ...version, frequency: legacyFrequency(version.frequency) })),
  }
}

const STATUS_PRIORITY: Record<CycleLifecycleStatus, number> = { active: 0, paused: 1, planned: 2, ended: 3 }

/**
 * Die Zyklen einer Substanz in der Reihenfolge, in der Uebersicht und
 * Plan-Karte sie zeigen: laufend, pausiert, geplant, beendet; darin der
 * neueste zuerst, bei Gleichstand nach Kennung.
 */
export function orderTimelines(timelines: CycleTimeline[], now: Date, timeZone: string) {
  return timelines
    .map(timeline => ({ timeline, resolved: resolveCycleAt(timeline, now, timeZone) }))
    .sort((left, right) => (
      STATUS_PRIORITY[left.resolved.status] - STATUS_PRIORITY[right.resolved.status]
      || String(right.timeline.cycle.started_at ?? '').localeCompare(String(left.timeline.cycle.started_at ?? ''))
      || right.timeline.cycle.id.localeCompare(left.timeline.cycle.id)
    ))
}

/** Die naechste Einnahme — nur fuer laufende und geplante Zyklen. */
export function nextIntakeFor(timeline: CycleTimeline, status: CycleLifecycleStatus, now: Date, timeZone: string) {
  return status === 'active' || status === 'planned'
    ? findNextTimelineIntake(timelineForIntakeResolution(timeline), now, timeZone)
    : null
}

export function dateLabel(value: string, language: string, timeZone: string): string {
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


// Einzahl und Mehrzahl waehlt der Code, nicht i18next: Sprachen mit mehr
// Pluralformen (ru, ar) faenden sonst keinen Schluessel und zeigten ihn roh.
export function durationLabel(days: number, t: Translate): string {
  return String(days === 1
    ? t('my_stack_plan_duration_single', { days, defaultValue: '{{days}} Tag' })
    : t('my_stack_plan_duration_multiple', { days, defaultValue: '{{days}} Tage' }))
}

export function slotCountLabel(slots: number, t: Translate): string {
  return String(slots === 1
    ? t('my_stack_plan_slot_count_single', { slots, defaultValue: '{{slots}} Einnahmezeit' })
    : t('my_stack_plan_slot_count_multiple', { slots, defaultValue: '{{slots}} Einnahmezeiten' }))
}

export function stepKindLabel(version: CyclePlanVersion, t: Translate): string {
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
export function chipLabels(language: string): string[] {
  const kurz = WEEKDAY_KEYS.map(day => weekdayLabel(day, language).slice(0, 2))
  if (new Set(kurz).size === kurz.length) return kurz
  const schmal = new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' })
  return WEEKDAY_KEYS.map((_, index) => schmal.format(new Date(WEEKDAY_REFERENCE_UTC + index * 86_400_000)))
}

