import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { DailyLogEntry, DateRange } from '../types'
import { filterByDateRange } from './range'

export type ValueOverviewKey =
  | 'energie'
  | 'schlaf'
  | 'wohlbefinden'
  | 'libido'
  | 'body_fat_pct'

export type ValueOverviewTone = 'positive' | 'neutral' | 'warning' | 'negative'
export type ValueOverviewDirection = 'up' | 'down' | 'flat'

export interface ValueOverviewRow {
  key: ValueOverviewKey
  label: string
  unit: '' | '%'
  average: number | null
  delta: number | null
  tone: ValueOverviewTone
  direction: ValueOverviewDirection | null
}

const METRICS: ReadonlyArray<{
  key: ValueOverviewKey
  label: string
  unit: '' | '%'
}> = [
  { key: 'energie', label: 'Energie', unit: '' },
  { key: 'schlaf', label: 'Schlaf', unit: '' },
  { key: 'wohlbefinden', label: 'Wohlbefinden', unit: '' },
  { key: 'libido', label: 'Libido', unit: '' },
  { key: 'body_fat_pct', label: 'KFA', unit: '%' },
]

const isoDate = (date: Date) => format(date, 'yyyy-MM-dd')
const roundOne = (value: number) => Math.round(value * 10) / 10

export function splitValueOverviewRange(range: DateRange): {
  first: DateRange | null
  second: DateRange
} {
  const from = parseISO(range.from)
  const days = Math.max(1, differenceInCalendarDays(parseISO(range.to), from) + 1)
  const firstDays = Math.floor(days / 2)

  return {
    first: firstDays === 0
      ? null
      : { from: range.from, to: isoDate(addDays(from, firstDays - 1)) },
    second: { from: isoDate(addDays(from, firstDays)), to: range.to },
  }
}

function valuesFor(
  logs: DailyLogEntry[],
  range: DateRange | null,
  key: ValueOverviewKey,
): number[] {
  if (!range) return []
  return filterByDateRange(logs, range, entry => entry.log_date)
    .map(entry => entry[key])
    .filter((value): value is number => value != null && Number.isFinite(value))
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function classifyChange(
  key: ValueOverviewKey,
  delta: number,
): Pick<ValueOverviewRow, 'tone' | 'direction'> {
  const magnitude = Math.abs(delta)
  if (magnitude < 0.2 - 1e-9) return { tone: 'neutral', direction: 'flat' }

  const direction: ValueOverviewDirection = delta > 0 ? 'up' : 'down'
  const improved = key === 'body_fat_pct' ? delta < 0 : delta > 0
  if (improved) return { tone: 'positive', direction }

  return {
    tone: magnitude >= 1 - 1e-9 ? 'negative' : 'warning',
    direction,
  }
}

export function buildValueOverview(
  logs: DailyLogEntry[],
  range: DateRange,
): ValueOverviewRow[] {
  const halves = splitValueOverviewRange(range)

  return METRICS.map(metric => {
    const first = valuesFor(logs, halves.first, metric.key)
    const second = valuesFor(logs, halves.second, metric.key)
    const firstAverage = average(first)
    const secondAverage = average(second)
    const rawDelta = first.length >= 2 && second.length >= 2
      && firstAverage != null && secondAverage != null
      ? secondAverage - firstAverage
      : null
    const status = rawDelta == null
      ? { tone: 'neutral' as const, direction: null }
      : classifyChange(metric.key, rawDelta)

    return {
      ...metric,
      average: secondAverage == null ? null : roundOne(secondAverage),
      delta: rawDelta == null ? null : roundOne(rawDelta),
      ...status,
    }
  })
}
