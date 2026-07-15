import type { DateRange } from '../types'
import { dayToTsSafe } from './dates'

const DAY_MS = 24 * 3_600_000

export type ChartWindowKey = '30t' | '3m'

export const DEFAULT_CHART_WINDOW: ChartWindowKey = '3m'

export const CHART_WINDOWS: { key: ChartWindowKey; label: string; days: number }[] = [
  { key: '30t', label: '30T', days: 30 },
  { key: '3m', label: '3M', days: 90 },
]

/** Fensterbreite in ms. Unbekannter Key → Default-Fenster. */
export function windowMsFor(key: ChartWindowKey): number {
  const def = CHART_WINDOWS.find(w => w.key === key)
    ?? CHART_WINDOWS.find(w => w.key === DEFAULT_CHART_WINDOW)!
  return def.days * DAY_MS
}

/**
 * Datengrenzen des Charts als Timestamps (12:00, wie die Punkte im Chart).
 * `now` ist nie kleiner als `start`, damit clampViewEnd nicht kippt.
 */
export function rangeBounds(range: DateRange): { start: number; now: number } {
  const fallback = Date.now()
  const start = dayToTsSafe(range.from, 12) ?? fallback
  const to = dayToTsSafe(range.to, 12) ?? fallback
  return { start, now: Math.max(start, to) }
}
