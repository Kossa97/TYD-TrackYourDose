import { addDays, format, parseISO } from 'date-fns'
import { effectiveQuantity, type EscalationRow, type ScheduleCycle } from './intakeSchedule'

export interface DoseAdjustmentBackfillLog {
  id: string
  stack_item_id: string
  logged_at: string
  taken: boolean | null
  dose: number | null
  unit: string | null
}

export interface DoseAdjustmentBackfillUpdate {
  id: string
  dose: number
  unit: string | null
}

function adjustmentStartDay(cycle: ScheduleCycle, adjustment: EscalationRow): string | null {
  if (adjustment.start_type === 'date') return adjustment.start_date
  if (adjustment.start_after_days == null) return null
  return format(addDays(parseISO(cycle.start_date), adjustment.start_after_days), 'yyyy-MM-dd')
}

function earliestAdjustmentStartDay(cycle: ScheduleCycle, adjustments: EscalationRow[]): string | null {
  const starts = adjustments
    .filter(adjustment => adjustment.cycle_id === cycle.id)
    .map(adjustment => adjustmentStartDay(cycle, adjustment))
    .filter((day): day is string => !!day)
    .sort()
  return starts[0] ?? null
}

function logDay(log: DoseAdjustmentBackfillLog): string {
  return format(parseISO(log.logged_at), 'yyyy-MM-dd')
}

export function buildDoseAdjustmentBackfillUpdates(
  cycle: ScheduleCycle,
  adjustments: EscalationRow[],
  logs: DoseAdjustmentBackfillLog[],
  affectedAdjustments: EscalationRow[] = adjustments,
  affectedFromDay?: string,
): DoseAdjustmentBackfillUpdate[] {
  const fromDay = [earliestAdjustmentStartDay(cycle, affectedAdjustments), affectedFromDay]
    .filter((day): day is string => !!day)
    .sort()[0] ?? null
  if (!fromDay) return []

  return logs.flatMap(log => {
    if (log.stack_item_id !== cycle.stack_item_id) return []
    if (log.taken === true) return []
    if (log.dose == null || !log.unit?.trim()) return []

    const dayKey = logDay(log)
    if (dayKey < cycle.start_date) return []
    if (cycle.end_date && dayKey > cycle.end_date) return []
    if (dayKey < fromDay) return []

    const day = parseISO(dayKey)
    const quantity = effectiveQuantity(cycle, day, adjustments)
    if (!quantity) return []

    return [{
      id: log.id,
      dose: quantity.dose,
      unit: quantity.unit,
    }]
  })
}
