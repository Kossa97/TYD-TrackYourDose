/**
 * Konto in der App loeschen (Apple 5.1.1(v), Google Play „Account deletion").
 *
 * Reihenfolge:
 *   1. eigene Dateien im Speicher entfernen — Fortschrittsfotos und
 *      Chargen-Dokumente liegen unter `<user-id>/…`; SQL darf den Speicher
 *      nicht anfassen, deshalb tut es die App vorher selbst
 *   2. `delete_my_account()` — loescht Blutwerte, Gewicht und das Konto;
 *      alles andere haengt mit `on delete cascade` daran
 *   3. abmelden
 * Schlaegt 2 fehl, bleibt das Konto bestehen und der Fehler wird geworfen.
 */

export const NUTZER_BUCKETS = ['progress-photos', 'batch-files'] as const

interface StorageError { message: string }

export interface AccountClient {
  storage: {
    from(bucket: string): {
      list(path: string, options: { limit: number; offset: number }): Promise<{ data: { name: string }[] | null; error: StorageError | null }>
      remove(paths: string[]): Promise<{ error: StorageError | null }>
    }
  }
  rpc(fn: string): PromiseLike<{ error: StorageError | null }>
  auth: { signOut(): Promise<unknown> }
}

const SEITE = 100

/** Alle Dateien eines Nutzers in einem Bucket; liefert die Anzahl. */
export async function loescheNutzerDateien(client: AccountClient, bucket: string, userId: string): Promise<number> {
  const ablage = client.storage.from(bucket)
  let geloescht = 0
  // Nach jedem Loeschen rutscht die Liste nach — deshalb immer ab 0 lesen.
  // Die Obergrenze schuetzt vor einer Endlosschleife, falls ein Loeschen
  // still nichts bewirkt.
  for (let runde = 0; runde < 1000; runde++) {
    const { data, error } = await ablage.list(userId, { limit: SEITE, offset: 0 })
    if (error) throw new Error(error.message)
    const dateien = (data ?? []).filter(eintrag => eintrag.name && eintrag.name !== '.emptyFolderPlaceholder')
    if (dateien.length === 0) return geloescht
    const { error: fehler } = await ablage.remove(dateien.map(datei => `${userId}/${datei.name}`))
    if (fehler) throw new Error(fehler.message)
    geloescht += dateien.length
    if (dateien.length < SEITE) return geloescht
  }
  return geloescht
}

export async function loescheKonto(client: AccountClient, userId: string): Promise<void> {
  for (const bucket of NUTZER_BUCKETS) await loescheNutzerDateien(client, bucket, userId)
  const { error } = await client.rpc('delete_my_account')
  if (error) throw new Error(error.message)
  await client.auth.signOut()
}
