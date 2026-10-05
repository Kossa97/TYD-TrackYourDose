import type { Review, ReviewDraft } from '../lib/reviewModel'
import { zeileAus } from '../lib/reviewModel'

/**
 * Lesen und Schreiben der Bewertungen. Fehler werden geworfen, nicht
 * verschluckt — die Seite zeigt sie an, statt still leer zu bleiben.
 */

interface QueryResult<T> { data: T | null; error: { message: string } | null }

// Schmal gehalten, wie in planLifecycle: genug fuer supabase-js und die Tests.
export interface ReviewClient {
  from(table: string): any // eslint-disable-line @typescript-eslint/no-explicit-any
}

const SELECT = 'id, stack_item_id, cycle_id, rating, title, body, pros, cons, experience, wirkung, vertraeglichkeit, wieder_nehmen, is_public, hidden_by_moderation, created_at, updated_at, stack_items(display_name, archived)'

function pruefen<T>(result: QueryResult<T>): T {
  if (result.error) throw new Error(result.error.message)
  return result.data as T
}

export async function ladeBewertungen(client: ReviewClient, userId: string): Promise<Review[]> {
  const result = await client.from('reviews').select(SELECT).eq('user_id', userId).order('created_at', { ascending: false })
  return (pruefen<Review[]>(result) ?? []).map(row => ({
    ...row,
    // Eine eingebettete Zeile kann je nach Abfrage als Liste kommen.
    stack_items: Array.isArray(row.stack_items) ? row.stack_items[0] ?? null : row.stack_items,
  }))
}

export async function speichereBewertung(
  client: ReviewClient,
  draft: ReviewDraft,
  userId: string,
  vorher: Review | null,
): Promise<void> {
  const zeile = zeileAus(draft, userId, vorher)
  const id = vorher?.id ?? null
  const result = id
    ? await client.from('reviews').update(zeile).eq('id', id)
    : await client.from('reviews').insert(zeile)
  pruefen(result)
}

export async function loescheBewertung(client: ReviewClient, id: string): Promise<void> {
  pruefen(await client.from('reviews').delete().eq('id', id))
}
