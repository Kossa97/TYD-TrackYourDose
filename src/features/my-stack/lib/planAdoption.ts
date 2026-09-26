import type { PlanChangeKind, PlanScheduleSnapshot } from '../../../lib/planTimeline'

/**
 * Wenn ein Plan geaendert wird, waehrend spaetere Stufen schon geplant sind.
 *
 * Jede Stufe speichert den ganzen Plan. Eine Titrationsstufe, die vor der
 * Aenderung angelegt wurde, traegt deshalb noch die alten Tage, Tageszeiten
 * und die alte Methode in sich — ab ihrem Datum gaelte wieder der alte Plan.
 * Hier steht, welche Stufen das betrifft und wie sie den neuen Plan
 * uebernehmen, ohne ihre Mengen zu verlieren.
 */

export interface LaterPlanStep {
  versionId: string
  effectiveLocalDate: string | null
  effectiveAt: string | null
  changeKind: PlanChangeKind
  snapshot: PlanScheduleSnapshot
}

/** Alles am Plan ausser den Mengen — dieselbe Liste wie `changeKindFor`. */
export const SCHEDULE_FIELDS = [
  'frequency', 'x_days_interval', 'interval_unit', 'cycle_on_days', 'cycle_off_days',
  'schedule_days', 'intake_time', 'intake_time_custom', 'slot_days', 'method',
] as const satisfies readonly (keyof PlanScheduleSnapshot)[]

export function sameSchedule(left: PlanScheduleSnapshot, right: PlanScheduleSnapshot): boolean {
  return SCHEDULE_FIELDS.every(field => (
    JSON.stringify(left[field] ?? null) === JSON.stringify(right[field] ?? null)
  ))
}

/** Beginnt die Stufe nach dem Stichtag? `boundary` ist `YYYY-MM-DD` oder null fuer „ab sofort". */
function beginsAfter(step: LaterPlanStep, boundary: string | null, now: Date): boolean {
  if (step.effectiveLocalDate) return boundary == null ? true : step.effectiveLocalDate > boundary
  if (step.effectiveAt) {
    const at = new Date(step.effectiveAt)
    return boundary == null ? at > now : at.toISOString().slice(0, 10) > boundary
  }
  return false
}

function stepOrder(step: LaterPlanStep): string {
  return step.effectiveLocalDate ?? step.effectiveAt ?? ''
}

/**
 * Welche spaeteren Stufen den neuen Plan uebernehmen sollten.
 *
 * Nur Stufen, die den ALTEN Plan tragen — also reine Mengenstufen darauf.
 * Die erste Stufe mit einem eigenen, anderen Plan ist eine bewusste
 * Planaenderung („ab Woche 4 zusaetzlich abends"): dort und dahinter bleibt
 * alles, wie es ist.
 */
export function stepsToAdopt(input: {
  base: PlanScheduleSnapshot
  changed: PlanScheduleSnapshot
  laterSteps: readonly LaterPlanStep[]
  /** `YYYY-MM-DD` bei „ab Datum", null bei „ab sofort". */
  boundary: string | null
  exceptVersionId?: string | null
  now: Date
}): LaterPlanStep[] {
  if (sameSchedule(input.base, input.changed)) return []
  const later = input.laterSteps
    .filter(step => step.versionId !== input.exceptVersionId && beginsAfter(step, input.boundary, input.now))
    .sort((left, right) => stepOrder(left).localeCompare(stepOrder(right)))
  const adopt: LaterPlanStep[] = []
  for (const step of later) {
    if (!sameSchedule(step.snapshot, input.base)) break
    adopt.push(step)
  }
  return adopt
}

function positions(value: string | null): string[] {
  return (value ?? '').split(',')
}

/** Tageszeit und laufende Nummer je Stelle — wie `planCardSlots` („der zweite Morgen"). */
function slotIds(intakeTime: string | null): string[] {
  const zaehler = new Map<string, number>()
  return positions(intakeTime).map(key => {
    const nummer = zaehler.get(key) ?? 0
    zaehler.set(key, nummer + 1)
    return `${key}#${nummer}`
  })
}

/**
 * Die Stufe mit dem neuen Plan: Tage, Tageszeiten und Methode aus `plan`,
 * die Mengen aus `step`. Eine Einnahme, die es in der Stufe schon gab, behaelt
 * ihre Menge; eine neue bekommt die Menge aus dem neuen Plan (bei gleicher
 * Einheit), sonst die Grundmenge der Stufe.
 */
export function adoptSchedule(plan: PlanScheduleSnapshot, step: PlanScheduleSnapshot): PlanScheduleSnapshot {
  const planIds = slotIds(plan.intake_time)
  const planDoses = positions(plan.slot_doses)
  const stepIds = slotIds(step.intake_time)
  const stepDoses = positions(step.slot_doses)
  const sameUnit = plan.unit === step.unit

  const doses = planIds.map((id, index) => {
    const inStep = stepIds.indexOf(id)
    if (inStep >= 0) return stepDoses[inStep] ?? ''
    if (!sameUnit) return ''
    return planDoses[index] || (plan.dose != null ? String(plan.dose) : '')
  })

  const merged: PlanScheduleSnapshot = { ...step }
  for (const field of SCHEDULE_FIELDS) {
    (merged as unknown as Record<string, unknown>)[field] = plan[field]
  }
  merged.slot_doses = doses.some(dose => dose !== '') ? doses.join(',') : null
  return merged
}
