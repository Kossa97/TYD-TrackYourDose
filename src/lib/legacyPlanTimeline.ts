import { addDays, format, isValid, parseISO } from 'date-fns'
import {
  type EscalationRow,
  type ScheduleCycle,
  type ScheduleSegment,
} from './intakeSchedule'
import type {
  CyclePlanVersion,
  CycleTimeline,
  PlanChangeKind,
  PlanScheduleSnapshot,
} from './planTimeline'

export interface LegacyScheduleCycle extends ScheduleCycle {
  method: string
  active: boolean
  started_at?: string | null
  ended_at?: string | null
}

export interface LegacyEscalationRow extends EscalationRow {
  id: string
}

export interface LegacyTimelineConversion {
  timeline: CycleTimeline
  issues: Array<{
    code: 'unit_mismatch' | 'invalid_boundary'
    sourceId: string
  }>
}

interface ValidHistorySegment {
  sourceId: string
  boundary: string
  segment: ScheduleSegment
}

interface ValidEscalation {
  row: LegacyEscalationRow
  boundary: string
}

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function validLocalDate(value: string | null | undefined): value is string {
  if (!value || !LOCAL_DATE_PATTERN.test(value)) return false
  const parsed = parseISO(value)
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === value
}

function localMidnightUtc(value: string): string {
  return `${value}T00:00:00.000Z`
}

function lifecycleEnd(cycle: LegacyScheduleCycle): string | null {
  if (cycle.ended_at) return cycle.ended_at
  if (!cycle.end_date || !validLocalDate(cycle.end_date)) return null
  return localMidnightUtc(format(addDays(parseISO(cycle.end_date), 1), 'yyyy-MM-dd'))
}

function flatSegment(cycle: LegacyScheduleCycle): ScheduleSegment {
  return {
    effective_from: cycle.start_date,
    frequency: cycle.frequency,
    x_days_interval: cycle.x_days_interval,
    interval_unit: cycle.interval_unit ?? null,
    cycle_on_days: cycle.cycle_on_days ?? null,
    cycle_off_days: cycle.cycle_off_days ?? null,
    schedule_days: cycle.schedule_days,
    intake_time: cycle.intake_time,
    intake_time_custom: cycle.intake_time_custom,
    slot_doses: cycle.slot_doses ?? null,
    slot_days: cycle.slot_days ?? null,
    dose: cycle.dose,
    unit: cycle.unit,
  }
}

function resolvedHistorySegment(
  cycle: LegacyScheduleCycle,
  history: ValidHistorySegment[],
  boundary: string,
): ScheduleSegment {
  if (history.length === 0) return flatSegment(cycle)
  const sorted = [...history].sort((left, right) => left.boundary.localeCompare(right.boundary))
  let active = sorted[0].segment
  for (const candidate of sorted) {
    if (candidate.boundary <= boundary) active = candidate.segment
    else break
  }
  return active
}

function escalationBoundary(
  cycle: LegacyScheduleCycle,
  row: LegacyEscalationRow,
): string | null {
  if (row.start_type === 'date') {
    return validLocalDate(row.start_date) ? row.start_date : null
  }
  if (
    !Number.isInteger(row.start_after_days)
    || row.start_after_days == null
    || row.start_after_days < 0
  ) return null
  return format(addDays(parseISO(cycle.start_date), row.start_after_days), 'yyyy-MM-dd')
}

function scheduleSnapshot(
  cycle: LegacyScheduleCycle,
  segment: ScheduleSegment,
  activeEscalations: ValidEscalation[],
  issues: LegacyTimelineConversion['issues'],
): PlanScheduleSnapshot {
  const baseDose = segment.dose
  const baseUnit = segment.unit?.trim() || null
  let adjustment = 0

  for (const escalation of activeEscalations) {
    if (baseDose == null || !Number.isFinite(baseDose) || baseDose <= 0 || !baseUnit) continue
    if (escalation.row.unit.trim() !== baseUnit) {
      if (!issues.some(issue => issue.code === 'unit_mismatch' && issue.sourceId === escalation.row.id)) {
        issues.push({ code: 'unit_mismatch', sourceId: escalation.row.id })
      }
      continue
    }
    adjustment += escalation.row.increase_amount
  }

  const adjustedDose = baseDose != null && Number.isFinite(baseDose)
    ? baseDose + adjustment
    : null
  const adjustedSlotDoses = segment.slot_doses == null
    ? null
    : segment.slot_doses
      .split(',')
      .map(value => {
        if (!value.trim()) return ''
        const amount = Number(value)
        return Number.isFinite(amount) ? String(amount + adjustment) : value
      })
      .join(',')

  return {
    frequency: segment.frequency,
    x_days_interval: segment.x_days_interval,
    interval_unit: segment.interval_unit ?? null,
    cycle_on_days: segment.cycle_on_days ?? null,
    cycle_off_days: segment.cycle_off_days ?? null,
    schedule_days: [...(segment.schedule_days ?? [])],
    intake_time: segment.intake_time ?? 'morgens',
    intake_time_custom: segment.intake_time_custom ?? null,
    slot_doses: adjustedSlotDoses,
    slot_days: segment.slot_days ?? null,
    dose: adjustedDose != null && Number.isFinite(adjustedDose) && adjustedDose > 0
      ? adjustedDose
      : null,
    unit: baseUnit,
    method: cycle.method,
  }
}

export function legacyCycleToTimeline(
  cycle: LegacyScheduleCycle,
  escalations: LegacyEscalationRow[],
): LegacyTimelineConversion {
  const issues: LegacyTimelineConversion['issues'] = []
  const cycleEscalations = escalations.filter(row => row.cycle_id === cycle.id)
  const legacyHistory = cycle.schedule_history ?? []
  const history: ValidHistorySegment[] = legacyHistory.flatMap((segment, index) => {
    const sourceId = `${cycle.id}:history:${index}`
    if (!validLocalDate(segment.effective_from)) {
      issues.push({ code: 'invalid_boundary', sourceId })
      return []
    }
    return [{ sourceId, boundary: segment.effective_from, segment: { ...segment } }]
  })

  if (!validLocalDate(cycle.start_date)) {
    issues.push({ code: 'invalid_boundary', sourceId: cycle.id })
  }

  const validEscalations: ValidEscalation[] = cycleEscalations.flatMap(row => {
    const boundary = validLocalDate(cycle.start_date)
      ? escalationBoundary(cycle, row)
      : null
    if (
      !boundary
      || !Number.isFinite(row.increase_amount)
      || !row.unit?.trim()
    ) {
      issues.push({ code: 'invalid_boundary', sourceId: row.id })
      return []
    }

    const segment = resolvedHistorySegment(cycle, history, boundary)
    if (segment.dose != null && segment.unit?.trim() && segment.unit.trim() !== row.unit.trim()) {
      issues.push({ code: 'unit_mismatch', sourceId: row.id })
      return []
    }
    return [{ row: { ...row }, boundary }]
  })

  const scheduleBoundaries = legacyHistory.length > 0
    ? [
      ...(history.length > 0 && validLocalDate(cycle.start_date) ? [cycle.start_date] : []),
      ...history.map(entry => entry.boundary),
    ]
    : validLocalDate(cycle.start_date) ? [cycle.start_date] : []
  const allBoundaries = [...new Set([
    ...scheduleBoundaries,
    ...validEscalations.map(entry => entry.boundary),
  ])].sort()
  const scheduleBoundarySet = new Set(scheduleBoundaries)

  const versions: CyclePlanVersion[] = allBoundaries.map((boundary, index) => {
    const segment = resolvedHistorySegment(cycle, history, boundary)
    const activeEscalations = validEscalations.filter(entry => entry.boundary <= boundary)
    const changeKind: PlanChangeKind = index === 0
      ? 'initial'
      : scheduleBoundarySet.has(boundary) ? 'schedule' : 'titration'
    return {
      id: `legacy:${cycle.id}:${boundary}`,
      cycle_id: cycle.id,
      effective_kind: 'local_date',
      effective_at: null,
      effective_local_date: boundary,
      change_kind: changeKind,
      ...scheduleSnapshot(cycle, segment, activeEscalations, issues),
    }
  })

  return {
    timeline: {
      cycle: {
        id: cycle.id,
        stack_item_id: cycle.stack_item_id,
        started_at: cycle.started_at ?? (
          validLocalDate(cycle.start_date)
            ? localMidnightUtc(cycle.start_date)
            : `${cycle.start_date}T00:00:00.000Z`
        ),
        ended_at: lifecycleEnd(cycle),
      },
      versions,
      pauses: [],
    },
    issues,
  }
}
