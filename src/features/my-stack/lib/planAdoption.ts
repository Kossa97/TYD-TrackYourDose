import type { PlanChangeKind, PlanScheduleSnapshot } from '../../../lib/planTimeline'
import type { IntakePlanDraft } from '../types'
import { planCardSlots } from './planCard'

/**
 * Wenn ein Plan geaendert wird, waehrend spaetere Stufen schon geplant sind.
 *
 * Jede Stufe speichert den ganzen Plan. Eine Titrationsstufe, die vor der
 * Aenderung angelegt wurde, traegt deshalb noch die alten Tage, Tageszeiten
 * und die alte Methode in sich — ab ihrem Datum gaelte wieder der alte Plan.
 *
 * Deshalb zeigt der Assistent vor dem Speichern jede geplante Stufe hinter dem
 * gewaehlten Tag („Geplante Aenderungen"): so, wie sie mit dem neuen Plan
 * aussaehe, mit Datum und Mengen zum Anpassen oder zum Entfernen. Gespeichert
 * wird erst, wenn man das bestaetigt.
 */

export interface LaterPlanStep {
  versionId: string
  /** `YYYY-MM-DD` — geplante Stufen beginnen immer an einem Kalendertag. */
  effectiveLocalDate: string
  changeKind: PlanChangeKind
  snapshot: PlanScheduleSnapshot
  /** Dieselbe Stufe als Formularstand — zum Vorbelegen einer neuen Stufe. */
  draft: IntakePlanDraft
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

function sameSnapshot(left: PlanScheduleSnapshot, right: PlanScheduleSnapshot): boolean {
  return (Object.keys(left) as (keyof PlanScheduleSnapshot)[]).every(field => (
    JSON.stringify(left[field] ?? null) === JSON.stringify(right[field] ?? null)
  ))
}

function byDate(left: LaterPlanStep, right: LaterPlanStep): number {
  return left.effectiveLocalDate.localeCompare(right.effectiveLocalDate)
}

/**
 * Die Stufen um den gewaehlten Tag herum.
 *
 * `before` ist die geplante Stufe, die an diesem Tag bisher gegolten haette
 * (keine: es gilt die jetzige), `after` alles, was danach beginnt. Wird eine
 * geplante Stufe selbst bearbeitet, zaehlt sie weder davor noch danach.
 */
export function stepsAround(input: {
  laterSteps: readonly LaterPlanStep[]
  /** `YYYY-MM-DD` bei „ab Datum", null bei „ab sofort". */
  boundary: string | null
  exceptVersionId?: string | null
}): { before: LaterPlanStep | null; after: LaterPlanStep[] } {
  const { boundary } = input
  const others = input.laterSteps
    .filter(step => step.versionId !== input.exceptVersionId)
    .sort(byDate)
  if (boundary == null) return { before: null, after: others }
  // Eine Stufe, die genau am Stichtag beginnt, ist weder davor noch danach:
  // an dem Tag kann keine zweite beginnen (`takenEffectiveDates`).
  return {
    before: others.filter(step => step.effectiveLocalDate < boundary).at(-1) ?? null,
    after: others.filter(step => step.effectiveLocalDate > boundary),
  }
}

/**
 * Der Plan, der am Stichtag bisher gilt — daran wird gemessen, was sich
 * aendert und welche spaeteren Stufen den neuen Plan uebernehmen.
 *
 * Sonst: die letzte geplante Stufe davor, ohne sie der jetzige Plan. Wird
 * eine geplante Stufe selbst bearbeitet und bleibt sie zwischen denselben
 * Nachbarn, ist es ihr alter Stand — die Stufen dahinter tragen ihn noch.
 * Rueckt sie an anderen Stufen vorbei, gilt wieder die Regel von oben.
 */
export function planBaseAt(input: {
  laterSteps: readonly LaterPlanStep[]
  boundary: string | null
  current: IntakePlanDraft
  editing?: { versionId: string; originalDate: string | null; draft: IntakePlanDraft } | null
}): IntakePlanDraft {
  const { laterSteps, boundary, editing } = input
  if (editing) {
    const from = editing.originalDate
    const crossed = from != null && boundary != null && laterSteps.some(step => (
      step.versionId !== editing.versionId
      && step.effectiveLocalDate > (from < boundary ? from : boundary)
      && step.effectiveLocalDate < (from < boundary ? boundary : from)
    ))
    if (!crossed) return editing.draft
  }
  const { before } = stepsAround({ laterSteps, boundary, exceptVersionId: editing?.versionId })
  return before?.draft ?? input.current
}

/**
 * Welche spaeteren Stufen den neuen Plan uebernehmen.
 *
 * `base` ist der Plan, der am gewaehlten Tag bisher gegolten haette. Nur
 * Stufen, die diesen ALTEN Plan tragen — also reine Mengenstufen darauf.
 * Die erste Stufe mit einem eigenen, anderen Plan ist eine bewusste
 * Planaenderung („ab Woche 4 zusaetzlich abends"): dort und dahinter bleibt
 * der Plan, wie er ist.
 */
export function stepsToAdopt(input: {
  base: PlanScheduleSnapshot
  changed: PlanScheduleSnapshot
  after: readonly LaterPlanStep[]
}): LaterPlanStep[] {
  if (sameSchedule(input.base, input.changed)) return []
  const adopt: LaterPlanStep[] = []
  for (const step of input.after) {
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

/** Die Menge an Stelle `index`; ohne `slot_doses` gilt ueberall `dose`. */
function doseAt(snapshot: PlanScheduleSnapshot, index: number): string {
  if (snapshot.slot_doses != null) return positions(snapshot.slot_doses)[index] ?? ''
  return snapshot.dose != null ? String(snapshot.dose) : ''
}

/**
 * Die Mengen je Stelle eingesetzt — nach denselben Regeln wie beim Speichern
 * (`planScheduleSnapshot`): `dose` ist die erste Menge, `slot_doses` steht
 * nur, wenn sich die Mengen unterscheiden.
 */
function withDoses(snapshot: PlanScheduleSnapshot, doses: readonly string[]): PlanScheduleSnapshot {
  const lead = doses.find(dose => dose !== '')
  return {
    ...snapshot,
    dose: lead != null ? Number(lead) : snapshot.dose,
    slot_doses: new Set(doses).size > 1 ? doses.join(',') : null,
  }
}

/**
 * Die Stufe mit dem neuen Plan: Tage, Tageszeiten und Methode aus `plan`,
 * die Mengen aus `step`. Eine Einnahme, die es in der Stufe schon gab, behaelt
 * ihre Menge; eine neue bekommt die Menge aus dem neuen Plan (bei gleicher
 * Einheit), sonst die Grundmenge der Stufe.
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
  return withDoses(merged, doses)
}

/** Eine geplante Stufe auf der Seite „Geplante Aenderungen". */
export interface ReviewStep {
  versionId: string
  changeKind: PlanChangeKind
  originalDate: string
  original: PlanScheduleSnapshot
  /** Der vorgeschlagene Plan der Stufe, ohne die Mengen aus `amounts`. */
  proposed: PlanScheduleSnapshot
  /** Uebernimmt die Stufe Tage, Tageszeiten oder Methode des neuen Plans? */
  adopts: boolean
  /** Hat die Stufe einen anderen Plan als den neuen (bewusst so geplant)? */
  ownPlan: boolean
  /** Einnahmen, die die Stufe bisher nicht hatte (Slot-ID). */
  newSlotIds: string[]
  date: string
  /** Menge je Einnahme (Slot-ID), so wie sie im Feld steht. */
  amounts: Record<string, string>
  /** Die vorbelegten Mengen — unveraendert heisst: `proposed` gilt, wie es ist. */
  initialAmounts: Record<string, string>
  removed: boolean
}

function amountsOf(snapshot: PlanScheduleSnapshot): Record<string, string> {
  return Object.fromEntries(planCardSlots(snapshot).map(slot => [slot.id, slot.dose == null ? '' : String(slot.dose)]))
}

/** Die Seite „Geplante Aenderungen": jede Stufe nach dem Tag, vorbelegt. */
export function buildReview(input: {
  base: PlanScheduleSnapshot
  changed: PlanScheduleSnapshot
  after: readonly LaterPlanStep[]
}): ReviewStep[] {
  const adopting = new Set(stepsToAdopt(input).map(step => step.versionId))
  return input.after.map(step => {
    const adopts = adopting.has(step.versionId)
    const proposed = adopts ? adoptSchedule(input.changed, step.snapshot) : step.snapshot
    const before = new Set(slotIds(step.snapshot.intake_time))
    return {
      versionId: step.versionId,
      changeKind: step.changeKind,
      originalDate: step.effectiveLocalDate,
      original: step.snapshot,
      proposed,
      adopts,
      ownPlan: !sameSchedule(proposed, input.changed),
      newSlotIds: slotIds(proposed.intake_time).filter(id => !before.has(id)),
      date: step.effectiveLocalDate,
      amounts: amountsOf(proposed),
      initialAmounts: amountsOf(proposed),
      removed: false,
    }
  })
}

/** Eine eingegebene Menge als Zahl: Komma oder Punkt, groesser als null. */
export function parseAmount(value: string): number | null {
  const number = Number(value.trim().replace(',', '.'))
  return value.trim() !== '' && Number.isFinite(number) && number > 0 ? number : null
}

/** Der Plan der Stufe mit den eingegebenen Mengen. Null: eine Menge fehlt. */
export function reviewedSnapshot(step: ReviewStep): PlanScheduleSnapshot | null {
  // Ohne Einheit wird keine Menge gefuehrt („nur Einnahme") — dann gibt es
  // auch nichts einzusetzen.
  if (step.proposed.unit == null) return step.proposed
  if (JSON.stringify(step.amounts) === JSON.stringify(step.initialAmounts)) return step.proposed
  const ids = slotIds(step.proposed.intake_time)
  const doses: string[] = []
  for (const [index, id] of ids.entries()) {
    const raw = step.amounts[id]
    // Nicht angefasst: der gespeicherte Wert bleibt, auch ein leerer.
    if (raw === undefined || raw === step.initialAmounts[id]) {
      doses.push(doseAt(step.proposed, index))
      continue
    }
    const amount = parseAmount(raw)
    if (amount == null) return null
    doses.push(String(amount))
  }
  return withDoses(step.proposed, doses)
}

/** Hat sich an der Stufe gegenueber dem Gespeicherten etwas geaendert? */
export function reviewStepChanged(step: ReviewStep, snapshot: PlanScheduleSnapshot): boolean {
  return step.removed || step.date !== step.originalDate || !sameSnapshot(snapshot, step.original)
}

/**
 * Die Seite neu aufgebaut (etwa nach „Zurueck" und einer Aenderung am Plan),
 * ohne zu verlieren, was man dort schon getan hat: entfernte Stufen,
 * verschobene Tage und selbst eingegebene Mengen bleiben.
 */
export function carryOverReview(previous: readonly ReviewStep[], next: readonly ReviewStep[]): ReviewStep[] {
  return next.map(step => {
    const before = previous.find(candidate => candidate.versionId === step.versionId)
    if (!before) return step
    const amounts = { ...step.amounts }
    for (const id of Object.keys(amounts)) {
      const edited = before.amounts[id]
      if (edited !== undefined && edited !== before.initialAmounts[id]) amounts[id] = edited
    }
    return {
      ...step,
      removed: before.removed,
      date: before.date !== before.originalDate ? before.date : step.date,
      amounts,
    }
  })
}
