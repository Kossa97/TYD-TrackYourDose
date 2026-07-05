import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { ActiveSubstance, CycleRow, CycleSubstance, DateRange, OngoingSubstance } from '../types'
import { substanceColor } from './colors'

export const todayIso = () => format(new Date(), 'yyyy-MM-dd')

function embedName(peptides: CycleRow['peptides']): string | null {
  if (!peptides) return null
  return Array.isArray(peptides) ? (peptides[0]?.name ?? null) : peptides.name
}

export function normalizeCycles(rows: CycleRow[] | null | undefined): CycleSubstance[] {
  return (rows ?? []).map((row, index) => ({
    id: row.id,
    name: embedName(row.peptides) ?? row.name,
    mode: 'cycle' as const,
    startDate: row.start_date,
    endDate: row.end_date,
    active: row.active,
    color: substanceColor(index),
    peptideId: row.peptide_id,
  }))
}

export function cycleEndDate(cycle: Pick<CycleSubstance, 'endDate'>): string {
  return cycle.endDate ?? todayIso()
}

export function substanceDayCount(substance: ActiveSubstance, refDate = todayIso()): number {
  const end = substance.mode === 'cycle' && substance.endDate
    ? substance.endDate
    : refDate
  return Math.max(1, differenceInCalendarDays(parseISO(`${end}T00:00:00`), parseISO(`${substance.startDate}T00:00:00`)) + 1)
}

export function rangeFromActiveSubstances(
  cycles: CycleSubstance[],
  ongoing: OngoingSubstance[] = [],
): DateRange {
  const all = [...cycles.filter(c => c.active), ...ongoing]
  if (all.length === 0) {
    const to = todayIso()
    const from = format(new Date(Date.now() - 30 * 86_400_000), 'yyyy-MM-dd')
    return { from, to }
  }
  const from = all.map(s => s.startDate).sort()[0]
  return { from, to: todayIso() }
}

export function formatSubstanceEnd(cycle: CycleSubstance): string {
  if (!cycle.active && cycle.endDate) {
    return format(parseISO(`${cycle.endDate}T00:00:00`), 'dd.MM.')
  }
  if (cycle.endDate) {
    return `bis ${format(parseISO(`${cycle.endDate}T00:00:00`), 'dd.MM.')}`
  }
  return 'offen'
}

export function countLoggedDays(logDates: string[]): number {
  return new Set(logDates).size
}

export function isInRange(date: string, range: DateRange): boolean {
  return date >= range.from && date <= range.to
}

export function dateKeyFromTimestamp(ts: string): string {
  return ts.slice(0, 10)
}
