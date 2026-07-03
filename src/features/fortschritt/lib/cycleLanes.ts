export interface TimeInterval {
  x1: number
  x2: number
}

export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  return a.x1 < b.x2 && b.x1 < a.x2
}

/**
 * Packt Intervalle in minimale Zeilen: überlappende Zyklen in separate Zeilen,
 * nicht überlappende teilen sich eine Zeile.
 */
export function assignLanes<T extends TimeInterval>(items: T[]): (T & { lane: number })[] {
  if (items.length === 0) return []

  const sorted = [...items].sort((a, b) => {
    if (a.x1 !== b.x1) return a.x1 - b.x1
    return (b.x2 - b.x1) - (a.x2 - a.x1)
  })

  const laneIntervals: TimeInterval[][] = []
  const placed: (T & { lane: number })[] = []

  for (const item of sorted) {
    let lane = laneIntervals.findIndex(existing =>
      !existing.some(other => intervalsOverlap(other, item)),
    )
    if (lane === -1) {
      lane = laneIntervals.length
      laneIntervals.push([])
    }
    laneIntervals[lane].push({ x1: item.x1, x2: item.x2 })
    placed.push({ ...item, lane })
  }

  return placed
}

export const LANE_HEIGHT = 0.55
export const LANE_GAP = 0.1

export function laneCount(bands: { lane: number }[]): number {
  if (bands.length === 0) return 0
  return Math.max(...bands.map(b => b.lane)) + 1
}

export function bandAxisMax(lanes: number): number {
  if (lanes === 0) return 0
  return lanes * (LANE_HEIGHT + LANE_GAP) + LANE_GAP
}

export function bandAxisDomain(lanes: number, metricClearance = 6): number {
  if (lanes === 0) return 1
  return metricClearance + bandAxisMax(lanes)
}

export function laneYBounds(lane: number): { y1: number; y2: number } {
  const y1 = lane * (LANE_HEIGHT + LANE_GAP)
  return { y1, y2: y1 + LANE_HEIGHT }
}
