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

export function laneCount(bands: { lane: number }[]): number {
  if (bands.length === 0) return 0
  return Math.max(...bands.map(b => b.lane)) + 1
}

/** Ab dieser Zeilenanzahl erreichen die Balken ihre maximale Blockhöhe */
export const MAX_BLOCK_LANE_COUNT = 5

/**
 * Anteil der Plot-Höhe, den der Balken-Block höchstens einnimmt. Über den ganzen
 * Plot gezogen überdecken die Bänder Kurve, Punkte und Werte — der Rest bleibt frei.
 */
export const BAND_BLOCK_MAX_RATIO = 0.55

/**
 * Vertikale Aufteilung der Zyklus-Balken:
 * Weniger parallele Zyklen → geringere Gesamthöhe, mehr Zyklen → höherer Block,
 * gedeckelt auf BAND_BLOCK_MAX_RATIO der Plot-Höhe.
 */
export function computeCycleBandLayout(plotHeight: number, lanes: number): {
  blockHeight: number
  laneHeight: number
  laneGap: number
} {
  if (lanes <= 0 || plotHeight <= 0) {
    return { blockHeight: 0, laneHeight: 0, laneGap: 0 }
  }

  const laneGap = Math.max(3, Math.round(plotHeight * 0.012))
  const fillRatio = Math.min(1, lanes / MAX_BLOCK_LANE_COUNT) * BAND_BLOCK_MAX_RATIO
  const blockHeight = plotHeight * fillRatio
  const laneHeight = Math.max(4, (blockHeight - (lanes - 1) * laneGap) / lanes)
  const actualBlock = lanes * laneHeight + (lanes - 1) * laneGap

  return { blockHeight: actualBlock, laneHeight, laneGap }
}
