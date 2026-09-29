import { lazy, useEffect, useRef, type ComponentType } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Veraltete Version nach einem Deployment.
 *
 * Der Service Worker (src/sw.ts) uebernimmt eine neue Version sofort
 * (`skipWaiting` + `clientsClaim`) und raeumt den alten Zwischenspeicher
 * weg — waehrend die alte Version im Fenster weiterlaeuft. Laedt sie danach
 * einen Programmteil nach (etwa den Kalender), gibt es ihn nicht mehr:
 * JAVASCRIPT-REACT-2.
 *
 * Deshalb zwei Stufen:
 * 1. Ursache: Hat eine neue Version uebernommen, laedt die App beim
 *    naechsten Seitenwechsel neu — nicht sofort, damit niemand ein halb
 *    ausgefuelltes Formular verliert. Ein Seitenwechsel verwirft ohnehin,
 *    was auf der alten Seite stand. (`ReloadOnUpdate`)
 * 2. Netz: Scheitert eine Seite trotzdem beim Nachladen, einmal neu laden.
 *    Hoechstens einmal, bis wieder etwas geladen hat; nicht ohne Netz; und
 *    nicht endlos wartend. (`lazyPage`)
 */

const RELOAD_KEY = 'tyd_stale_chunk_reload'
const RELOAD_TIMEOUT_MS = 8_000

const CHUNK_LOAD_MESSAGES = [
  /Failed to fetch dynamically imported module/i, // Chrome, Edge
  /Importing a module script failed/i, // Safari
  /error loading dynamically imported module/i, // Firefox
]

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'ChunkLoadError' || CHUNK_LOAD_MESSAGES.some(pattern => pattern.test(error.message))
}

function storage(): Storage | null {
  try { return window.sessionStorage } catch { return null }
}

/**
 * Laedt die Seite neu, wenn in dieser Sitzung seit dem letzten Erfolg noch
 * nicht neu geladen wurde. `true`: es wird neu geladen.
 *
 * Ohne Netz nicht: dann liegt es nicht am alten Stand, und ein Neuladen
 * braechte nur die Offline-Seite des Browsers. Ohne Speicher auch nicht —
 * ohne Merker liesse sich eine Schleife nicht verhindern.
 */
export function reloadForStaleChunk(reload = () => window.location.reload()): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  const merker = storage()
  if (!merker) return false
  try {
    if (merker.getItem(RELOAD_KEY)) return false
    merker.setItem(RELOAD_KEY, '1')
  } catch {
    return false
  }
  reload()
  return true
}

/** Etwas hat geladen: die App laeuft — ein spaeterer Fehler darf wieder neu laden. */
export function markChunkLoaded(): void {
  try { storage()?.removeItem(RELOAD_KEY) } catch { /* ohne Speicher: nichts zu merken */ }
}

/**
 * Nachladen mit Netz. Bis das Neuladen greift, bleibt die Ladeanzeige stehen —
 * greift es nicht (abgebrochen, WebView ohne reload), kommt nach einigen
 * Sekunden doch der urspruengliche Fehler.
 */
export function importWithReload<T>(load: () => Promise<T>): () => Promise<T> {
  return () => load().then(
    module => {
      markChunkLoaded()
      return module
    },
    error => {
      if (!isChunkLoadError(error) || !reloadForStaleChunk()) throw error
      return new Promise<T>((_, reject) => { window.setTimeout(() => reject(error), RELOAD_TIMEOUT_MS) })
    },
  )
}

/**
 * Eine nachgeladene Seite. `name` ist der benannte Export des Moduls.
 * Neue Seiten bitte hierueber, nicht mit blossem `lazy(() => import(...))` —
 * sonst fehlt ihnen der Schutz.
 */
export function lazyPage<M extends Record<string, unknown>, K extends keyof M>(
  load: () => Promise<M>,
  name: K,
) {
  return lazy(importWithReload(() => load().then(module => ({ default: module[name] as ComponentType }))))
}

let updateTookOver = false

/**
 * Merkt sich, wenn eine neue Version des Service Workers die Seite
 * uebernimmt. Nur bei einem Wechsel — nicht beim allerersten Einrichten, wo
 * es noch keinen alten Stand gab.
 */
export function installUpdateWatch(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) updateTookOver = true
  })
}

/** Im Router: beim naechsten Seitenwechsel nach einer Uebernahme neu laden. */
export function ReloadOnUpdate() {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (updateTookOver) window.location.reload()
  }, [pathname])
  return null
}
