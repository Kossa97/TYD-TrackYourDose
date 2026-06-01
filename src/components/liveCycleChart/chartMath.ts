export interface ChartPoint { ts: number; level: number }
export interface MarkerPoint { ts: number; level: number }
export interface NamedMarker { ts: number; label: string; color: string }

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

/** Neues Fenster-Ende beim Wischen. Finger nach rechts (dx>0) → Vergangenheit (kleiner). */
export function panViewEnd(startViewEnd: number, dxPx: number, widthPx: number, windowMs: number): number {
  if (widthPx <= 0) return startViewEnd
  return startViewEnd - (dxPx / widthPx) * windowMs
}

/** Begrenzt das Fenster-Ende: rechts nicht über jetzt, links nicht über (erster Punkt + Fenster). */
export function clampViewEnd(viewEnd: number, dataStart: number, now: number, windowMs: number): number {
  const lower = Math.min(dataStart + windowMs, now)
  if (viewEnd < lower) return lower
  if (viewEnd > now) return now
  return viewEnd
}

const DAY_MS = 24 * 3_600_000

/**
 * Tages-ausgerichtete X-Ticks für [startTs, endTs]. Wählt ein Tages-Vielfaches als
 * Schrittweite, sodass bei gegebener Pixelbreite der Mindestabstand minPxPerTick
 * eingehalten wird (keine überlappenden Labels).
 */
export function pickDayTicks(startTs: number, endTs: number, widthPx: number, minPxPerTick: number): number[] {
  if (endTs <= startTs || widthPx <= 0) return []
  const span = endTs - startTs
  const maxTicks = Math.max(1, Math.floor(widthPx / minPxPerTick))
  let stepDays = 1
  while (span / DAY_MS / stepDays > maxTicks) stepDays *= 2
  const stepMs = stepDays * DAY_MS
  const first = Math.ceil(startTs / DAY_MS) * DAY_MS
  const ticks: number[] = []
  for (let t = first; t <= endTs; t += stepMs) ticks.push(t)
  return ticks
}

/**
 * Achsen-Ticks mit "schönen" Schrittweiten (1·10ⁿ, 2·10ⁿ, 5·10ⁿ), sodass bei
 * gegebener Pixelbreite der Mindestabstand minPxPerTick grob eingehalten wird.
 * Für beliebige numerische Achsen (z.B. Stunden nach Injektion).
 */
export function pickNiceTicks(start: number, end: number, widthPx: number, minPxPerTick: number): number[] {
  if (end <= start || widthPx <= 0) return []
  const maxTicks = Math.max(1, Math.floor(widthPx / minPxPerTick))
  const rawStep = (end - start) / maxTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const mult = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  const step = mult * mag
  const first = Math.ceil(start / step) * step
  const ticks: number[] = []
  for (let t = first; t <= end + step * 1e-6; t += step) {
    ticks.push(Math.round(t * 1000) / 1000)
  }
  return ticks
}
