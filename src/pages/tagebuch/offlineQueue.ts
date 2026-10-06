/**
 * Neue Tagebuch-Einträge, die ohne Netz nicht gespeichert werden konnten.
 *
 * Sie warten im Gerät (localStorage, je Nutzer) und gehen raus, sobald die
 * Verbindung zurück ist — egal auf welcher Seite der Nutzer gerade ist
 * (useTagebuchOfflineSync hängt im Layout). Jeder Eintrag trägt seine eigene
 * id: kam eine Anfrage doch an und nur die Antwort ging verloren, legt der
 * zweite Versuch keine zweite Zeile an und überschreibt auch nichts.
 *
 * Nur neue Einträge — Bearbeiten und Löschen brauchen den aktuellen Stand der
 * Datenbank und melden ohne Netz einen Fehler. Beim Abmelden wird die
 * Warteschlange gelöscht: auf einem fremden Gerät bleiben keine
 * Gesundheitsdaten liegen.
 */
import { isNetworkFailureMessage } from '../../lib/networkErrors'

export interface PendingEffect {
  id: string
  user_id: string
  type: 'effect' | 'side_effect'
  description: string
  severity: number
  duration: string | null
  occurred_at: string
  stack_item_id: string | null
  dose_log_id: string | null
  notes: string | null
  status: 'eingetreten'
  /** Endgültig gescheitert (nicht am Netz) — wird nicht mehr gesendet, nur noch angezeigt. */
  failed?: true
}

export interface SendError { message?: string; code?: string }

const PREFIX = 'tyd_tagebuch_offline_'
const key = (userId: string) => `${PREFIX}${userId}`
/** Fenster-Ereignis bei jeder Änderung — Banner und Liste hören darauf. */
export const QUEUE_EVENT = 'tyd-tagebuch-queue'

function storage(): Storage | null {
  try { return window.localStorage } catch { return null }
}

export function readQueue(userId: string): PendingEffect[] {
  try {
    const raw = storage()?.getItem(key(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? (parsed as PendingEffect[]).filter(row => row && typeof row.id === 'string' && row.user_id === userId)
      : []
  } catch {
    return []
  }
}

function writeQueue(userId: string, rows: PendingEffect[]): void {
  const store = storage()
  if (store) {
    try {
      if (rows.length) store.setItem(key(userId), JSON.stringify(rows))
      else store.removeItem(key(userId))
    } catch { /* voll oder gesperrt */ }
  }
  try { window.dispatchEvent(new Event(QUEUE_EVENT)) } catch { /* ohne Fenster (Tests) */ }
}

export function enqueue(row: PendingEffect): void {
  writeQueue(row.user_id, [...readQueue(row.user_id).filter(other => other.id !== row.id), row])
}

export function queueCounts(userId: string): { waiting: number; failed: number } {
  const rows = readQueue(userId)
  const failed = rows.filter(row => row.failed).length
  return { waiting: rows.length - failed, failed }
}

export function discardFailed(userId: string): void {
  writeQueue(userId, readQueue(userId).filter(row => !row.failed))
}

/** Beim Abmelden: alle Warteschlangen dieses Geräts. */
export function clearAllQueues(): void {
  const store = storage()
  if (!store) return
  try {
    for (const name of Object.keys(store)) if (name.startsWith(PREFIX)) store.removeItem(name)
  } catch { /* gesperrt */ }
  try { window.dispatchEvent(new Event(QUEUE_EVENT)) } catch { /* ohne Fenster */ }
}

/** Kein Netz, oder die Anfrage kam nicht an — ein späterer Versuch hat Sinn. */
export function isNetworkError(error: SendError | null | undefined, online = navigator.onLine): boolean {
  return !online || isNetworkFailureMessage(error?.message)
}

/**
 * Fehler, die sich nie von selbst lösen: Verweise, die nicht (mehr) passen,
 * und Prüfungen der Datenbank. Alles andere (Zeitüberschreitung, 5xx) gilt
 * als vorübergehend — der Eintrag bleibt unverändert und kommt später dran.
 */
const PERMANENT_CODES = new Set(['42501', '23503', '23514', '23502', '22P02'])
function isPermanent(error: SendError): boolean {
  return PERMANENT_CODES.has(error.code ?? '') || /^effect_/.test(error.message ?? '')
}

/** Nur den Verweis lösen, der nicht passt. */
function withoutBrokenLinks(row: PendingEffect, error: SendError): PendingEffect | null {
  const message = error.message ?? ''
  if (message.startsWith('effect_dose_log_') && row.dose_log_id) return { ...row, dose_log_id: null }
  if ((message === 'effect_stack_item_not_owned' || error.code === '23503') && (row.stack_item_id || row.dose_log_id)) {
    return { ...row, stack_item_id: null, dose_log_id: null }
  }
  return null
}

/**
 * Schickt die wartenden Einträge der Reihe nach. Was klappt, verlässt die
 * Warteschlange. Netz weg oder vorübergehender Fehler: Abbruch, später weiter.
 * Passt ein Verweis nicht mehr (z. B. Substanz gelöscht), geht der Eintrag
 * ohne diesen Verweis raus. Scheitert er endgültig, wird er markiert und nie
 * still verworfen — der Nutzer sieht ihn und entscheidet.
 */
export async function flushQueue(
  userId: string,
  send: (row: PendingEffect) => Promise<{ error: SendError | null }>,
): Promise<{ sent: number; waiting: number; failed: number }> {
  let sent = 0
  for (const queued of readQueue(userId)) {
    if (queued.failed) continue
    let row = queued
    let { error } = await send(row)
    const repaired = error && isPermanent(error) ? withoutBrokenLinks(row, error) : null
    if (repaired) {
      row = repaired
      ;({ error } = await send(row))
    }
    if (error && (isNetworkError(error) || !isPermanent(error))) break
    const rest = readQueue(userId).filter(other => other.id !== queued.id)
    writeQueue(userId, error ? [...rest, { ...row, failed: true }] : rest)
    if (!error) sent += 1
  }
  return { sent, ...queueCounts(userId) }
}
