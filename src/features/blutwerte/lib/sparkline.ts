import type { MarkerSummary } from './bloodwork'

/**
 * Geometrie der Mini-Kurve in der Uebersicht — nach dem Vorbild der
 * Aktien-App: die Messwerte als Linie, die Grenzen des Referenzbereichs als
 * gestrichelte Linien (dort ist es der Vortagesschluss). Die Grenzen gehoeren
 * in die Skala, damit man sieht, wo die Werte im Bereich liegen.
 */
export interface SparklineGeometry {
  /** SVG-Pfad der Linie; leer bei nur einem Messwert. */
  line: string
  /** Flaeche unter der Linie bis zum unteren Rand. */
  area: string
  /** Letzter Messpunkt */
  last: { x: number; y: number } | null
  /** y der gestrichelten Grenzen (min, max), soweit vorhanden. */
  bounds: number[]
}

export function sparklineGeometry(summary: MarkerSummary, width: number, height: number, pad = 3): SparklineGeometry {
  // Chronologisch; nicht umrechenbare Werte fallen heraus.
  const values = summary.points
    .filter((p): p is { entry: typeof p.entry; value: number } => p.value != null && Number.isFinite(p.value))
    .slice()
    .reverse()
    .map(p => p.value)
  const empty: SparklineGeometry = { line: '', area: '', last: null, bounds: [] }
  if (!values.length) return empty

  const limits = [summary.range.min, summary.range.max].filter((v): v is number => v != null && Number.isFinite(v))
  let lo = Math.min(...values, ...limits)
  let hi = Math.max(...values, ...limits)
  if (hi - lo < 1e-9) {
    const spread = Math.abs(hi) * 0.1 || 1
    lo -= spread
    hi += spread
  }
  const yOf = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (height - 2 * pad)
  const xOf = (i: number) => values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - 2 * pad)

  const pts = values.map((v, i) => ({ x: xOf(i), y: yOf(v) }))
  const r = (n: number) => Math.round(n * 10) / 10
  const line = pts.length > 1 ? pts.map((p, i) => `${i ? 'L' : 'M'}${r(p.x)},${r(p.y)}`).join('') : ''
  const area = line ? `${line}L${r(pts[pts.length - 1].x)},${height}L${r(pts[0].x)},${height}Z` : ''
  return { line, area, last: pts[pts.length - 1], bounds: limits.map(v => r(yOf(v))) }
}

/** Veraenderung zur vorherigen Messung in Anzeigeeinheit; null bei nur einem Wert. */
export function changeSincePrevious(summary: MarkerSummary): number | null {
  return summary.trend === null ? null : summary.diff
}

export type MarkerStatus = 'in' | 'out' | 'unchecked' | 'none'

export function markerStatus(summary: MarkerSummary): MarkerStatus {
  if (!summary.latest) return 'none'
  if (summary.inRange === true) return 'in'
  if (summary.inRange === false) return 'out'
  return 'unchecked'
}
