export interface DailyLogRow {
  id: string
  log_date: string
  energie: number | null
  schlaf: number | null
  libido: number | null
  notes: string | null
}

export type DailyLogField = 'energie' | 'schlaf' | 'libido'

export const WELLNESS_MARKERS = ['Energie', 'Schlaf', 'Libido'] as const
export type WellnessMarker = (typeof WELLNESS_MARKERS)[number]

export const WELLNESS_MARKER_FIELD: Record<WellnessMarker, DailyLogField> = {
  Energie: 'energie',
  Schlaf: 'schlaf',
  Libido: 'libido',
}

export function isWellnessMarker(marker: string): marker is WellnessMarker {
  return (WELLNESS_MARKERS as readonly string[]).includes(marker)
}

export function wellnessSeries(logs: DailyLogRow[], marker: WellnessMarker) {
  const field = WELLNESS_MARKER_FIELD[marker]
  return logs
    .filter(row => row[field] != null)
    .map(row => ({ date: row.log_date, value: row[field] as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function wellnessMarkersWithData(logs: DailyLogRow[]): WellnessMarker[] {
  return WELLNESS_MARKERS.filter(marker =>
    logs.some(row => row[WELLNESS_MARKER_FIELD[marker]] != null),
  )
}

export function hasAnyRating(values: { energie: number | null; schlaf: number | null; libido: number | null }) {
  return values.energie != null || values.schlaf != null || values.libido != null
}
