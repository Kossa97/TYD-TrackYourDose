import { parseISO } from 'date-fns'
import { scheduleForDay, type ScheduleCycle, type ScheduleSegment } from '../../../lib/intakeSchedule'
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

interface PermanentScheduleChange extends TrackedDose {
  trackingLevel: TrackingLevel
  effectiveFrom: string
}

interface TitrationStep {
  trackingLevel: TrackingLevel
  cycleId: string
  targetDose: number
  effectiveDose: number | null
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

function assertPlannable(level: TrackingLevel, effectiveBaseDose: number | null): asserts effectiveBaseDose is number {
  if (!dosePlanCapabilities(level).oneOff || effectiveBaseDose == null) {
    throw new Error('Für diese Einnahme ist keine Dosisplanung verfügbar.')
  }
}

export function buildOneOffActualDose(
  entry: RoutineConfirmationEntry,
  actual: TrackedDose,
): RoutineConfirmationEntry & { cycleUpdate?: never } {
  assertPlannable(entry.trackingLevel, entry.dose)
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
  const activeSegment = scheduleForDay(cycle, parseISO(change.effectiveFrom))
  assertPlannable(change.trackingLevel, activeSegment.dose)

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
    dose: change.dose,
    unit: change.unit,
    schedule_history: nextHistory,
  }
}

export function buildTitrationStep(step: TitrationStep) {
  assertPlannable(step.trackingLevel, step.effectiveDose)
  return {
    cycle_id: step.cycleId,
    increase_amount: step.targetDose - step.effectiveDose,
    unit: step.unit,
    start_type: step.startType,
    start_date: step.startDate,
    start_after_days: step.startAfterDays,
  }
}
