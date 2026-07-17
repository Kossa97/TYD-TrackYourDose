export interface ExtractedValue {
  marker: string
  /** True, wenn der Marker im Katalog gefunden wurde (setzt die Edge Function). */
  matched: boolean
  value: number
  unit: string
  ref_min: number | null
  ref_max: number | null
}

export interface ExtractResult {
  /** ISO-Datum yyyy-MM-dd. */
  tested_at: string
  lab_name: string | null
  values: ExtractedValue[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const toFiniteNumber = (raw: unknown): number | null => {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (typeof raw === 'string') {
    const parsed = Number(raw.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const parseValue = (raw: unknown): ExtractedValue | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>

  const marker = typeof record.marker === 'string' ? record.marker.trim() : ''
  if (!marker) return null

  const value = toFiniteNumber(record.value)
  if (value === null) return null

  return {
    marker,
    matched: record.matched === true,
    value,
    unit: typeof record.unit === 'string' ? record.unit.trim() : '',
    ref_min: toFiniteNumber(record.ref_min),
    ref_max: toFiniteNumber(record.ref_max),
  }
}

/**
 * Validiert die Antwort der Edge Function. Gibt null zurück, wenn die Struktur
 * unbrauchbar ist; einzelne unbrauchbare Werte werden still verworfen.
 */
export function parseExtractResult(raw: unknown): ExtractResult | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>

  const tested_at = typeof record.tested_at === 'string' ? record.tested_at.trim() : ''
  if (!ISO_DATE.test(tested_at)) return null

  if (!Array.isArray(record.values)) return null

  const values = record.values
    .map(parseValue)
    .filter((v): v is ExtractedValue => v !== null)

  const lab_name =
    typeof record.lab_name === 'string' && record.lab_name.trim() ? record.lab_name.trim() : null

  return { tested_at, lab_name, values }
}
