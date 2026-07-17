import { format, parseISO, subDays } from 'date-fns'
import type { ActiveSubstance, CycleSubstance, DateRange } from '../types'
import { cycleEndDate } from './substances'

export type RangeChipKey = '30t' | '90t' | '6m' | '1j' | 'alles'

export const DEFAULT_RANGE_CHIP: RangeChipKey = 'alles'

export const RANGE_CHIPS: { key: RangeChipKey; label: string; days: number | null }[] = [
  { key: '30t', label: '30T', days: 30 },
  { key: '90t', label: '90T', days: 90 },
  { key: '6m', label: '6M', days: 180 },
  { key: '1j', label: '1J', days: 365 },
  { key: 'alles', label: 'Alles', days: null },
]

export function rangeFromChip(chip: RangeChipKey, baseRange: DateRange): DateRange {
  const chipDef = RANGE_CHIPS.find(c => c.key === chip)
  const to = baseRange.to
  if (!chipDef?.days) return baseRange
  const from = format(subDays(parseISO(`${to}T00:00:00`), chipDef.days), 'yyyy-MM-dd')
  const clampedFrom = from < baseRange.from ? baseRange.from : from
  return { from: clampedFrom, to }
}

export function substancesOnDate(
  cycles: CycleSubstance[],
  ongoing: ActiveSubstance[],
  date: string,
): string[] {
  const names: string[] = []
  for (const c of cycles) {
    const end = cycleEndDate(c)
    if (date >= c.startDate && date <= end) names.push(c.name)
  }
  for (const o of ongoing) {
    if (date >= o.startDate) names.push(o.name)
  }
  return names
}

export function barPosition(
  startDate: string,
  endDate: string,
  range: DateRange,
): { left: number; width: number } {
  const rangeStart = parseISO(`${range.from}T00:00:00`).getTime()
  const rangeEnd = parseISO(`${range.to}T00:00:00`).getTime()
  const span = Math.max(rangeEnd - rangeStart, 86_400_000)
  const start = parseISO(`${startDate}T00:00:00`).getTime()
  const end = parseISO(`${endDate}T00:00:00`).getTime()
  const left = Math.max(0, ((start - rangeStart) / span) * 100)
  const right = Math.min(100, ((end - rangeStart) / span) * 100)
  return { left, width: Math.max(0.5, right - left) }
}

export function formatRangeLabel(range: DateRange): string {
  const from = format(parseISO(`${range.from}T00:00:00`), 'd. MMM')
  const to = format(parseISO(`${range.to}T00:00:00`), 'd. MMM')
  return `${from} – ${to}`
}
