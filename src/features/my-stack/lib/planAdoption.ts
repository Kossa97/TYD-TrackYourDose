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
  /** `YYYY-MM-DD` — geplante Stufen beginnen immer an einem Kalendertag. */
  effectiveLocalDate: string
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

/**
 * Welche spaeteren Stufen den neuen Plan uebernehmen sollten.
 *
 * Verglichen wird mit dem Plan, der am Stichtag bisher gegolten haette: dem
 * der letzten Stufe davor, sonst dem, von dem das Formular ausging. Wird eine
 * geplante Stufe selbst bearbeitet, ist es ihr alter Plan.
 *
 * Nur Stufen, die diesen ALTEN Plan tragen — also reine Mengenstufen darauf.
 * Die erste Stufe mit einem eigenen, anderen Plan ist eine bewusste
 * Planaenderung („ab Woche 4 zusaetzlich abends"): dort und dahinter bleibt
 * alles, wie es ist.
 */
export function stepsToAdopt(input: {
  /** Der Plan, von dem das Formular ausging. */
  edited: PlanScheduleSnapshot
  changed: PlanScheduleSnapshot
  laterSteps: readonly LaterPlanStep[]
  /** `YYYY-MM-DD` bei „ab Datum", null bei „ab sofort". */
  boundary: string | null
  exceptVersionId?: string | null
}): LaterPlanStep[] {
  const { boundary } = input
  const editingStep = input.exceptVersionId != null
    && input.laterSteps.some(step => step.versionId === input.exceptVersionId)
  const others = input.laterSteps
    .filter(step => step.versionId !== input.exceptVersionId)
    .sort((left, right) => left.effectiveLocalDate.localeCompare(right.effectiveLocalDate))
  const before = boundary == null || editingStep
    ? undefined
    : others.filter(step => step.effectiveLocalDate <= boundary).at(-1)
  const base = before?.snapshot ?? input.edited

  if (sameSchedule(base, input.changed)) return []
  const adopt: LaterPlanStep[] = []
  for (const step of others) {
    if (boundary != null && step.effectiveLocalDate <= boundary) continue
    if (!sameSchedule(step.snapshot, base)) break
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

/** Die Menge an Stelle `index`; ohne `slot_doses` gilt ueberall `dose`. */
function doseAt(snapshot: PlanScheduleSnapshot, index: number): string {
  if (snapshot.slot_doses != null) return positions(snapshot.slot_doses)[index] ?? ''
  return snapshot.dose != null ? String(snapshot.dose) : ''
}

/**
 * Die Stufe mit dem neuen Plan: Tage, Tageszeiten und Methode aus `plan`,
 * die Mengen aus `step`. Eine Einnahme, die es in der Stufe schon gab, behaelt
 * ihre Menge; eine neue bekommt die Menge aus dem neuen Plan (bei gleicher
 * Einheit), sonst die Grundmenge der Stufe.
 *
 * `dose` und `slot_doses` folgen denselben Regeln wie beim Speichern
 * (`planScheduleSnapshot`): `dose` ist die erste Menge, `slot_doses` steht nur,
 * wenn sich die Mengen unterscheiden.
 */
export function adoptSchedule(plan: PlanScheduleSnapshot, step: PlanScheduleSnapshot): PlanScheduleSnapshot {
  const stepIds = slotIds(step.intake_time)
  const sameUnit = plan.unit === step.unit

  const doses = slotIds(plan.intake_time).map((id, index) => {
    const inStep = stepIds.indexOf(id)
    if (inStep >= 0) return doseAt(step, inStep)
    return sameUnit ? doseAt(plan, index) : doseAt(step, 0)
  })

  const merged: PlanScheduleSnapshot = { ...step }
  for (const field of SCHEDULE_FIELDS) {
    (merged as unknown as Record<string, unknown>)[field] = plan[field]
  }
  const lead = doses.find(dose => dose !== '')
  merged.dose = lead != null ? Number(lead) : step.dose
  merged.slot_doses = new Set(doses).size > 1 ? doses.join(',') : null
  return merged
}
