import { EINWILLIGUNG_FEHLT } from './aiConsent'

/**
 * Fehler der Edge Function `bloodwork-extract` — ein Code und ein Text fuer
 * den Toast. Gemeinsam fuer Import und Befund-Editor.
 */
export interface ExtraktionsFehler {
  code: string | null
  text: string
}

const ALLGEMEIN = 'Der Befund konnte nicht ausgelesen werden. Bitte manuell eintragen.'
const LIMIT = 'Import-Limit erreicht (10 pro Monat). Bitte später erneut versuchen.'
const ZU_GROSS = 'Datei ist zu groß (max. 10 MB).'

export async function beschreibeExtraktionsFehler(response: Response | undefined): Promise<ExtraktionsFehler> {
  if (!response) return { code: null, text: ALLGEMEIN }
  let code: string | null = null
  try {
    const body = await response.clone().json()
    code = typeof body?.error === 'string' ? body.error : null
  } catch {
    code = null
  }
  if (code === EINWILLIGUNG_FEHLT) return { code, text: '' }
  if (response.status === 429 || code === 'rate_limit') return { code, text: LIMIT }
  if (response.status === 413 || code === 'file_too_large') return { code, text: ZU_GROSS }
  if (code === 'no_bloodwork_found') return { code, text: 'Auf dem Bild wurde kein Laborbefund erkannt. Bitte manuell eintragen.' }
  return { code, text: ALLGEMEIN }
}
