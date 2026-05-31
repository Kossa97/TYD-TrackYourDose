export interface ChartPoint { ts: number; level: number }
export interface MarkerPoint { ts: number; level: number }

/** Lineare Interpolation des Levels am Zeitpunkt ts über aufsteigend sortierte Punkte. */
export function lerpLevel(points: ChartPoint[], ts: number): number {
  if (!points.length) return 0
  if (ts <= points[0].ts) return points[0].level
  const last = points[points.length - 1]
  if (ts >= last.ts) return last.level
  let lo = 0, hi = points.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (points[mid].ts <= ts) lo = mid
    else hi = mid
  }
  const span = points[hi].ts - points[lo].ts
  if (span <= 0) return points[lo].level
  const t = (ts - points[lo].ts) / span
  return points[lo].level + t * (points[hi].level - points[lo].level)
}
