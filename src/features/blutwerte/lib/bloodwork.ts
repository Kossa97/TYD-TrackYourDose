import type { BloodworkEntry } from '../types'
import type { Kategorie, KategorieFilter, MarkerDef } from './markerCatalog'
import { KATEGORIEN, MARKER_CATALOG, SONSTIGE, normalizeMarker } from './markerCatalog'
import { convert } from './unitConversion'

export interface EffectiveRange {
  min: number | null
  max: number | null
  /** Woher der Bereich stammt: Labor-Referenz, Katalog oder gar nicht vorhanden. */
  source: 'lab' | 'catalog' | 'none'
}

export type Trend = 'up' | 'down' | 'same' | null

export type SortMode = 'kategorie' | 'name' | 'zuletzt' | 'status'

export interface MarkerPoint {
  entry: BloodworkEntry
  /** Wert in displayUnit; null, wenn die Einheit nicht sicher umrechenbar ist. */
  value: number | null
}

export interface MarkerSummary {
  /** Kanonischer Name (Katalog) oder Rohname (Custom-Marker). */
  name: string
  def: MarkerDef | null
  kategorie: KategorieFilter
  /** Alle Einträge, absteigend nach Datum. */
  entries: BloodworkEntry[]
  latest: BloodworkEntry | null
  /** Einheit, in der Chart, Trend und aktueller Wert dargestellt werden. */
  displayUnit: string
  /** Neuester Wert in displayUnit. null, wenn nicht umrechenbar. */
  displayValue: number | null
  /** Einträge (neueste zuerst) mit Wert in displayUnit. */
  points: MarkerPoint[]
  range: EffectiveRange
  inRange: boolean | null
  trend: Trend
  diff: number
}

export function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
}

/** Labor-Referenz am Eintrag schlägt Katalog-Standard; sonst kein Bereich. */
export function effectiveRange(entry: BloodworkEntry | null, def: MarkerDef | null): EffectiveRange {
  if (entry && (entry.ref_min != null || entry.ref_max != null)) {
    return { min: entry.ref_min ?? null, max: entry.ref_max ?? null, source: 'lab' }
  }
  if (def && (def.refMin != null || def.refMax != null)) {
    return { min: def.refMin ?? null, max: def.refMax ?? null, source: 'catalog' }
  }
  return { min: null, max: null, source: 'none' }
}

export function isInRange(value: number, range: EffectiveRange): boolean | null {
  if (range.min == null && range.max == null) return null
  if (!Number.isFinite(value)) return null
  if (range.min != null && value < range.min) return false
  if (range.max != null && value > range.max) return false
  return true
}

/**
 * Erwartet Einträge absteigend nach Datum. Vergleicht die zwei jüngsten Werte,
 * die sich in displayUnit umrechnen lassen (nicht umrechenbare werden übersprungen).
 * Ohne displayUnit wird die Einheit des neuesten Eintrags verwendet.
 */
export function computeTrend(entries: BloodworkEntry[], displayUnit?: string): { trend: Trend; diff: number } {
  const unit = displayUnit ?? entries[0]?.unit ?? ''
  const values: number[] = []
  for (const e of entries) {
    const v = convert(toNumber(e.value), e.unit, unit)
    if (v != null) values.push(v)
    if (values.length === 2) break
  }
  if (values.length < 2) return { trend: null, diff: 0 }
  const diff = values[0] - values[1]
  if (diff > 0) return { trend: 'up', diff }
  if (diff < 0) return { trend: 'down', diff }
  return { trend: 'same', diff: 0 }
}

/** Drückt einen Referenzbereich in displayUnit aus. Katalog-Bereiche sind bereits
 *  in displayUnit; Labor-Bereiche werden aus der Eintrags-Einheit umgerechnet. */
function rangeInDisplayUnit(range: EffectiveRange, fromUnit: string | undefined, toUnit: string): EffectiveRange {
  if (range.source !== 'lab' || !fromUnit) return range
  const min = range.min != null ? convert(range.min, fromUnit, toUnit) : null
  const max = range.max != null ? convert(range.max, fromUnit, toUnit) : null
  // Wenn eine vorhandene Grenze nicht umrechenbar ist, bleibt der Roh-Bereich stehen.
  if ((range.min != null && min == null) || (range.max != null && max == null)) return range
  return { min, max, source: 'lab' }
}

/**
 * Baut je eine Zusammenfassung pro Katalog-Marker plus je eine pro Custom-Marker,
 * für den Einträge existieren.
 */
export function buildMarkerSummaries(entries: BloodworkEntry[]): MarkerSummary[] {
  const byName = new Map<string, { def: MarkerDef | null; entries: BloodworkEntry[] }>()

  MARKER_CATALOG.forEach(def => byName.set(def.name, { def, entries: [] }))

  entries.forEach(entry => {
    const def = normalizeMarker(entry.marker)
    const key = def ? def.name : entry.marker.trim()
    if (!key) return
    const bucket = byName.get(key) ?? { def, entries: [] }
    bucket.entries.push(entry)
    byName.set(key, bucket)
  })

  return Array.from(byName.entries()).map(([name, bucket]) => {
    const sorted = bucket.entries.slice().sort((a, b) => b.tested_at.localeCompare(a.tested_at))
    const latest = sorted[0] ?? null
    const displayUnit = bucket.def?.einheit || latest?.unit || ''

    const points: MarkerPoint[] = sorted.map(e => ({
      entry: e,
      value: convert(toNumber(e.value), e.unit, displayUnit),
    }))
    const displayValue = latest ? convert(toNumber(latest.value), latest.unit, displayUnit) : null

    const rawRange = effectiveRange(latest, bucket.def)
    const range = rangeInDisplayUnit(rawRange, latest?.unit, displayUnit)

    const { trend, diff } = computeTrend(sorted, displayUnit)

    // inRange bevorzugt den umgerechneten Wert; ist er nicht umrechenbar,
    // wird der Roh-Wert gegen den Roh-Bereich geprüft (beide in Eintrags-Einheit).
    const inRange =
      displayValue != null
        ? isInRange(displayValue, range)
        : latest
          ? isInRange(toNumber(latest.value), rawRange)
          : null

    return {
      name,
      def: bucket.def,
      kategorie: bucket.def ? bucket.def.kategorie : SONSTIGE,
      entries: sorted,
      latest,
      displayUnit,
      displayValue,
      points,
      range,
      inRange,
      trend,
      diff,
    }
  })
}

export function filterByKategorie(
  summaries: MarkerSummary[],
  kategorie: KategorieFilter | null,
): MarkerSummary[] {
  if (!kategorie) return summaries
  return summaries.filter(s => s.kategorie === kategorie)
}

/** Sonstige landet ans Ende, Katalog-Kategorien in Katalog-Reihenfolge. */
const kategorieRang = (kategorie: KategorieFilter): number => {
  const index = KATEGORIEN.indexOf(kategorie as Kategorie)
  return index === -1 ? KATEGORIEN.length : index
}

export function sortSummaries(summaries: MarkerSummary[], mode: SortMode): MarkerSummary[] {
  const sorted = summaries.slice()
  switch (mode) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    case 'zuletzt':
      return sorted.sort((a, b) => {
        if (!a.latest && !b.latest) return a.name.localeCompare(b.name, 'de')
        if (!a.latest) return 1
        if (!b.latest) return -1
        return b.latest.tested_at.localeCompare(a.latest.tested_at)
      })
    case 'status':
      return sorted.sort((a, b) => {
        const rang = (s: MarkerSummary) => (s.inRange === false ? 0 : s.latest ? 1 : 2)
        const diff = rang(a) - rang(b)
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'de')
      })
    case 'kategorie':
    default:
      return sorted.sort((a, b) => {
        const diff = kategorieRang(a.kategorie) - kategorieRang(b.kategorie)
        return diff !== 0 ? diff : a.name.localeCompare(b.name, 'de')
      })
  }
}

/** Marker, deren letzter Wert außerhalb der effektiven Referenz liegt. */
export function auffaelligeWerte(summaries: MarkerSummary[]): MarkerSummary[] {
  return summaries.filter(s => s.inRange === false)
}
