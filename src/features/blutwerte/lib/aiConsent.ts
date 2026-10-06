/**
 * Einwilligung in die KI-Auswertung von Befunden.
 *
 * Der Import schickt Foto oder PDF an Anthropic (Edge Function
 * `bloodwork-extract`). Vorher muss der Nutzer ausdruecklich einwilligen
 * (Apple 5.1.2(i), Art. 9 DSGVO); gespeichert in
 * `profiles.ai_import_consent_at`, null heisst nicht erteilt oder widerrufen.
 * Die Edge Function prueft dasselbe Feld — die App ist nur die Oberflaeche.
 */

interface QueryError { message: string }

export interface ConsentClient {
  from(table: 'profiles'): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: { ai_import_consent_at: string | null } | null; error: QueryError | null }>
      }
    }
    update(values: { ai_import_consent_at: string | null }): {
      eq(column: string, value: string): PromiseLike<{ error: QueryError | null }>
    }
  }
}

/** Zeitpunkt der Einwilligung oder null. Wirft bei Lesefehlern. */
export async function ladeKiEinwilligung(client: ConsentClient, userId: string): Promise<string | null> {
  const { data, error } = await client.from('profiles').select('ai_import_consent_at').eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data?.ai_import_consent_at ?? null
}

/** Einwilligung erteilen (Zeitpunkt) oder widerrufen (null). */
export async function setzeKiEinwilligung(client: ConsentClient, userId: string, zeitpunkt: Date | null): Promise<string | null> {
  const wert = zeitpunkt ? zeitpunkt.toISOString() : null
  const { error } = await client.from('profiles').update({ ai_import_consent_at: wert }).eq('id', userId)
  if (error) throw new Error(error.message)
  return wert
}

/** Der Fehlercode der Edge Function, wenn die Einwilligung fehlt. */
export const EINWILLIGUNG_FEHLT = 'consent_required'
