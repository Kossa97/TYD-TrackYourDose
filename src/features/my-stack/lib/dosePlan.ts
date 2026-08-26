import { format, isValid, parseISO } from 'date-fns'
import { effectiveQuantity, scheduleForDay, type EscalationRow, type ScheduleCycle, type ScheduleSegment } from '../../../lib/intakeSchedule'
import type { RoutineConfirmationEntry } from '../../routines/intakeGroups'
import type { TrackingLevel } from '../types'

export interface DosePlanCapabilitySet {
  oneOff: boolean
  permanent: boolean
  titration: boolean
}

export interface TrackedDose {
  dose: number
  unit: string
}

export interface PlannedDose extends TrackedDose {
  effectiveFrom: string
  status: 'Geplant'
}

export function backfillMessageKey(count: number): 'dose_plan_backfilled_one' | 'dose_plan_backfilled_other' {
  return count === 1 ? 'dose_plan_backfilled_one' : 'dose_plan_backfilled_other'
}

interface PermanentScheduleChange extends TrackedDose {
  trackingLevel: TrackingLevel
  effectiveFrom: string
}

interface TitrationStep {
  trackingLevel: TrackingLevel
  cycleId: string
  targetDose: number
  effectiveDose: number | null
  effectiveUnit: string | null
  unit: string
  startType: 'date' | 'after_days' | 'after_weeks'
  startDate: string | null
  startAfterDays: number | null
}

export function dosePlanCapabilities(level: TrackingLevel): DosePlanCapabilitySet {
  const quantified = level !== 'intake_only'
  return {
    oneOff: quantified,
    permanent: quantified,
    titration: quantified,
  }
}

export function dosePlanQuantitiesForDay(
  cycle: ScheduleCycle,
  day: Date,
  escalations: EscalationRow[],
): { current: TrackedDose | null; planned: PlannedDose[] } {
  const dayKey = format(day, 'yyyy-MM-dd')
  return {
    current: effectiveQuantity(cycle, day, escalations),
    planned: (cycle.schedule_history ?? [])
      .filter(segment => segment.effective_from > dayKey)
      .filter((segment): segment is ScheduleSegment & TrackedDose => (
        segment.dose != null
        && Number.isFinite(segment.dose)
        && segment.dose > 0
        && Boolean(segment.unit?.trim())
      ))
      .sort((left, right) => left.effective_from.localeCompare(right.effective_from))
      .map(segment => ({
        effectiveFrom: segment.effective_from,
        dose: segment.dose,
        unit: segment.unit,
        status: 'Geplant',
      })),
  }
}

function assertPositiveDose(dose: number | null): asserts dose is number {
  if (dose == null || !Number.isFinite(dose) || dose <= 0) {
    throw new Error('Für diese Einnahme ist keine Dosisplanung verfügbar.')
  }
}

function assertMatchingUnit(baseUnit: string | null, targetUnit: string): asserts baseUnit is string {
  if (!baseUnit?.trim() || !targetUnit.trim() || baseUnit !== targetUnit) {
    throw new Error('Die Einheit muss der aktuellen Planeinheit entsprechen.')
  }
}

function assertPlannable(level: TrackingLevel, effectiveBaseDose: number | null): asserts effectiveBaseDose is number {
  if (!dosePlanCapabilities(level).oneOff) {
    throw new Error('Für diese Einnahme ist keine Dosisplanung verfügbar.')
  }
  assertPositiveDose(effectiveBaseDose)
}

function assertIsoDay(value: string | null): asserts value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Ein gültiges Datum ist erforderlich.')
  }
  const parsed = parseISO(value)
  if (!isValid(parsed) || format(parsed, 'yyyy-MM-dd') !== value) {
    throw new Error('Ein gültiges Datum ist erforderlich.')
  }
}

export function buildOneOffActualDose(
  entry: RoutineConfirmationEntry,
  actual: TrackedDose,
): RoutineConfirmationEntry & { cycleUpdate?: never } {
  assertPlannable(entry.trackingLevel, entry.dose)
  assertPositiveDose(actual.dose)
  assertMatchingUnit(entry.unit, actual.unit)
  return {
    ...entry,
    actualDose: actual.dose,
    actualUnit: actual.unit,
  }
}

export function buildPermanentScheduleChange(
  cycle: ScheduleCycle,
  change: PermanentScheduleChange,
): ScheduleCycle {
  assertIsoDay(change.effectiveFrom)
  const activeSegment = scheduleForDay(cycle, parseISO(change.effectiveFrom))
  assertPlannable(change.trackingLevel, activeSegment.dose)
  assertPositiveDose(change.dose)
  assertMatchingUnit(activeSegment.unit, change.unit)

  const history = cycle.schedule_history?.length
    ? cycle.schedule_history
    : [{
        effective_from: cycle.start_date,
        frequency: cycle.frequency,
        x_days_interval: cycle.x_days_interval,
        schedule_days: cycle.schedule_days,
        intake_time: cycle.intake_time,
        intake_time_custom: cycle.intake_time_custom,
        dose: cycle.dose,
        unit: cycle.unit,
      }]
  const nextSegment: ScheduleSegment = {
    ...activeSegment,
    effective_from: change.effectiveFrom,
    dose: change.dose,
    unit: change.unit,
  }
  const nextHistory = history
    .filter(segment => segment.effective_from !== change.effectiveFrom)
    .map(segment => segment.effective_from > change.effectiveFrom
      ? { ...segment, dose: change.dose, unit: change.unit }
      : segment)
  nextHistory.push(nextSegment)
  nextHistory.sort((left, right) => left.effective_from.localeCompare(right.effective_from))

  return {
    ...cycle,
    schedule_history: nextHistory,
  }
}

export function buildTitrationStep(step: TitrationStep) {
  assertPlannable(step.trackingLevel, step.effectiveDose)
  assertPositiveDose(step.targetDose)
  assertMatchingUnit(step.effectiveUnit, step.unit)
  if (step.startType === 'date') {
    assertIsoDay(step.startDate)
    if (step.startAfterDays != null) throw new Error('Für ein festes Datum ist kein Versatz zulässig.')
  } else if (
    step.startDate != null
    || step.startAfterDays == null
    || !Number.isFinite(step.startAfterDays)
    || !Number.isInteger(step.startAfterDays)
    || step.startAfterDays <= 0
  ) {
    throw new Error('Ein gültiger Startversatz ist erforderlich.')
  }
  return {
    cycle_id: step.cycleId,
    increase_amount: step.targetDose - step.effectiveDose,
    unit: step.unit,
    start_type: step.startType,
    start_date: step.startDate,
    start_after_days: step.startAfterDays,
  }
}
