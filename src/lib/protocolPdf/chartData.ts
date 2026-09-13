/** Hilfen für PDF-Charts: Aggregation langer Zeiträume (Wochenmittel). */

export type ChartPoint = { t: number; v: number }

/** Ab dieser Punktzahl (oder ~6 Wochen täglich) auf Wochenmittel umschalten. */
export const MAX_RAW_CHART_POINTS = 42

/** Montag 00:00 lokal als Wochenanfang (ISO-ähnlich). */
export function isoWeekStartMs(ms: number): number {
  const d = new Date(ms)
  const day = (d.getDay() + 6) % 7 // Mo=0 … So=6
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d.getTime()
}

/** Mittelwert je ISO-Woche; Zeitstempel = Wochenbeginn. */
export function averageByWeek(points: ChartPoint[]): ChartPoint[] {
  if (points.length === 0) return []
  const buckets = new Map<number, number[]>()
  for (const p of points) {
    const key = isoWeekStartMs(p.t)
    const arr = buckets.get(key)
    if (arr) arr.push(p.v)
    else buckets.set(key, [p.v])
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, vals]) => ({
      t,
      v: vals.reduce((s, x) => s + x, 0) / vals.length,
    }))
}

/**
 * Bei vielen Punkten / langen Zeiträumen Wochenmittel verwenden,
 * sonst Originalserie — hält PDF-Charts lesbar.
 */
export function prepareLongRangePoints(
  points: ChartPoint[],
  maxRaw = MAX_RAW_CHART_POINTS,
): { points: ChartPoint[]; weekly: boolean } {
  const sorted = [...points].sort((a, b) => a.t - b.t)
  if (sorted.length <= maxRaw) return { points: sorted, weekly: false }
  return { points: averageByWeek(sorted), weekly: true }
}
