/**
 * Veraltete Version nach einem Deployment.
 *
 * Die installierte App laeuft mit dem Stand, den der Service Worker
 * zwischengespeichert hat. Wird inzwischen neu ausgeliefert, tragen die
 * Programmteile neue Namen — und ein Teil, den die alte Version erst beim
 * Oeffnen einer Seite nachlaedt (etwa den Kalender), gibt es nicht mehr. Der
 * Import scheitert, React meldet einen Absturz.
 *
 * Statt dessen: einmal neu laden, dann kommt die aktuelle Version. Nicht
 * endlos — scheitert es gleich danach wieder, liegt es nicht am alten Stand,
 * und der Fehler geht normal weiter (und an Sentry).
 */

const RELOAD_KEY = 'tyd_stale_chunk_reload_at'
const LOOP_GUARD_MS = 10_000

const CHUNK_LOAD_MESSAGES = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /Importing a module script failed/i, // Safari
  /error loading dynamically imported module/i, // Firefox
  /Unable to preload CSS/i, // Vite
]

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'ChunkLoadError' || CHUNK_LOAD_MESSAGES.some(pattern => pattern.test(error.message))
}

/**
 * Laedt die Seite neu, wenn das nicht gerade eben schon passiert ist.
 * `true`: es wird neu geladen. `false`: gerade erst — nicht noch einmal.
 */
export function reloadForStaleChunk(now = Date.now(), reload = () => window.location.reload()): boolean {
  // Ohne Speicher gibt es keinen Merker gegen eine Schleife — dann lieber
  // nicht neu laden und den Fehler normal melden.
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (now - last < LOOP_GUARD_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(now))
  } catch {
    return false
  }
  reload()
  return true
}

/**
 * Fuer `React.lazy`: scheitert das Nachladen an einem veralteten Stand, wird
 * neu geladen, und bis dahin bleibt die Ladeanzeige stehen.
 */
export function importWithReload<T>(load: () => Promise<T>): () => Promise<T> {
  return () => load().catch(error => {
    if (isChunkLoadError(error) && reloadForStaleChunk()) return new Promise<T>(() => {})
    throw error
  })
}

/** Vite meldet gescheiterte Vorab-Ladungen eigens; dort genauso. */
export function installStaleChunkReload(): void {
  window.addEventListener('vite:preloadError', event => {
    if (reloadForStaleChunk()) event.preventDefault()
  })
}
