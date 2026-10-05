/**
 * Abfrage des Tagebuchs: Filter, Suche und Sortierung laufen in der Datenbank,
 * damit seitenweises Laden dieselben Treffer liefert wie eine volle Liste.
 */
export const PAGE_SIZE = 50

export type SortBy = 'date_new' | 'date_old' | 'sev_high' | 'sev_low'

/** Spalten in Sortierreihenfolge; `id` zuletzt, damit Seitengrenzen stabil sind. */
export const ORDER: Record<SortBy, ReadonlyArray<readonly [column: string, ascending: boolean]>> = {
  date_new: [['occurred_at', false], ['id', true]],
  date_old: [['occurred_at', true], ['id', true]],
  sev_high: [['severity', false], ['occurred_at', false], ['id', true]],
  sev_low:  [['severity', true], ['occurred_at', false], ['id', true]],
}

/**
 * PostgREST-`or` für die Suche: Beschreibung enthält den Text, oder die
 * Substanz heißt so. Substanznamen stehen nicht in `effects` — gesucht wird
 * deshalb über die passenden `stack_item_id`s.
 *
 * Der Suchtext ist Nutzereingabe: LIKE-Platzhalter werden maskiert, und der
 * Wert steht in Anführungszeichen, damit Komma und Klammern den Filter nicht
 * zerlegen.
 */
export function searchFilter(search: string, stackItems: ReadonlyArray<{ id: string; display_name: string }>): string | null {
  const term = search.trim()
  if (!term) return null
  const like = term.replace(/[\\%_]/g, '\\$&')
  const quoted = `"%${like.replace(/["\\]/g, '\\$&')}%"`
  const parts = [`description.ilike.${quoted}`]
  const lower = term.toLowerCase()
  const ids = stackItems.filter(item => item.display_name.toLowerCase().includes(lower)).map(item => item.id)
  if (ids.length) parts.push(`stack_item_id.in.(${ids.join(',')})`)
  return parts.join(',')
}
