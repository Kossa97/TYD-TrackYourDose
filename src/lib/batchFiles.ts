/**
 * Dateien im Speicher `batch-files` (Analyse-Dokumente, alte Fortschrittsfotos).
 *
 * Der Bucket ist privat: angezeigt wird ueber signierte Links mit begrenzter
 * Laufzeit. In der Datenbank steht entweder der Pfad (neu) oder noch die
 * fruehere oeffentliche URL (alt) — beides fuehrt hier zum selben Pfad,
 * ohne die gespeicherten Daten anzufassen.
 */

export const BATCH_BUCKET = 'batch-files'

/** Laufzeit eines signierten Links. Laenger offene Seiten holen vorher einen neuen. */
export const BATCH_LINK_SEKUNDEN = 60 * 60

const MARKEN = ['/object/public/', '/object/sign/', '/object/authenticated/', '/object/'].map(teil => `/storage/v1${teil}${BATCH_BUCKET}/`)

/**
 * Pfad im Bucket zu einem gespeicherten Wert. `null`, wenn leer oder eine
 * Adresse ausserhalb des Buckets (die bleibt dann, wie sie ist).
 */
export function batchDateiPfad(wert: string | null | undefined): string | null {
  const roh = wert?.trim()
  if (!roh) return null
  if (!/^https?:\/\//i.test(roh)) return roh.replace(/^\/+/, '')
  let url: URL
  try {
    url = new URL(roh)
  } catch {
    return null
  }
  for (const marke of MARKEN) {
    const stelle = url.pathname.indexOf(marke)
    if (stelle >= 0) {
      const pfad = url.pathname.slice(stelle + marke.length)
      try {
        return decodeURIComponent(pfad) || null
      } catch {
        return pfad || null
      }
    }
  }
  return null
}

export interface BatchSignClient {
  storage: {
    from(bucket: typeof BATCH_BUCKET): {
      createSignedUrls(paths: string[], expiresIn: number): PromiseLike<{
        data: Array<{ path: string | null; signedUrl: string | null; error: string | null }> | null
        error: { message: string } | null
      }>
    }
  }
}

/**
 * Anzeigbare Links zu gespeicherten Werten: Bucket-Dateien signiert, fremde
 * Adressen unveraendert, Unaufloesbares fehlt in der Antwort.
 */
export async function signiereBatchDateien(
  client: BatchSignClient,
  werte: readonly string[],
  sekunden = BATCH_LINK_SEKUNDEN,
): Promise<Map<string, string>> {
  const links = new Map<string, string>()
  const pfadZuWerten = new Map<string, string[]>()
  for (const wert of werte) {
    const pfad = batchDateiPfad(wert)
    if (pfad) pfadZuWerten.set(pfad, [...(pfadZuWerten.get(pfad) ?? []), wert])
    else if (/^https?:\/\//i.test(wert.trim())) links.set(wert, wert.trim())
  }
  if (pfadZuWerten.size === 0) return links
  const { data, error } = await client.storage.from(BATCH_BUCKET).createSignedUrls([...pfadZuWerten.keys()], sekunden)
  if (error) throw new Error(error.message)
  for (const eintrag of data ?? []) {
    if (!eintrag.path || !eintrag.signedUrl) continue
    for (const wert of pfadZuWerten.get(eintrag.path) ?? []) links.set(wert, eintrag.signedUrl)
  }
  return links
}
