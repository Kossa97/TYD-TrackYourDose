import { addDays, format, parseISO } from 'date-fns'
import { effectiveDose, type EscalationRow, type ScheduleCycle } from './intakeSchedule'

export interface DoseAdjustmentBackfillLog {
  id: string
  peptide_id: string
  logged_at: string
  taken: boolean | null
}

export interface DoseAdjustmentBackfillUpdate {
  id: string
  dose: number
  unit: string
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
): DoseAdjustmentBackfillUpdate[] {
  const fromDay = earliestAdjustmentStartDay(cycle, affectedAdjustments)
  if (!fromDay) return []

  return logs.flatMap(log => {
    if (log.peptide_id !== cycle.peptide_id) return []
    if (log.taken === true) return []

    const dayKey = logDay(log)
    if (dayKey < cycle.start_date) return []
    if (cycle.end_date && dayKey > cycle.end_date) return []
    if (dayKey < fromDay) return []

    return [{
      id: log.id,
      dose: effectiveDose(cycle, parseISO(dayKey), adjustments),
      unit: cycle.unit,
    }]
  })
}
