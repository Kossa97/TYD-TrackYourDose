import type { CycleTimeline } from '../../../lib/planTimeline'
import { expiryDaysLeft } from '../../../lib/peptideExpiry'
import { nextIntakeFor, orderTimelines, versionSlots } from './planLabels'
import { reichweite, type Reichweite } from './bestand'
import type { StackItemIngredient, StackItemInventory } from '../types'

/**
 * Was eine Zeile der Listenansicht ueber eine Substanz sagt: wann die
 * naechste Einnahme ist, wie lange der Vorrat reicht und — hoechstens ein —
 * Hinweis, der Handeln verlangt.
 *
 * Reine Rechnung, damit Liste und Tests dieselbe Antwort sehen. Die Texte
 * dazu baut die Zeile selbst.
 */

/** Ab so wenigen Tagen Reichweite heisst es „Bald leer". */
export const KNAPP_BIS_TAGE = 7
/** Ab so wenigen Tagen Haltbarkeit heisst es „Läuft ab". */
export const ABLAUF_BALD_TAGE = 7

export type ZeilenPlan =
  | { art: 'naechste'; localDate: string; time: string; dose: number | null; unit: string | null }
  /** Laeuft, aber ohne feste Einnahmezeit — etwa „bei Bedarf". */
  | { art: 'ohne_termin' }
  | { art: 'pausiert' }
  /** Plan im Konflikt oder mit offener Zeitzone: Einnahmen sind gesperrt. */
  | { art: 'pruefen' }
  /** Nie einen Plan gehabt — oder alle beendet. */
  | { art: 'kein_plan'; hatteZyklen: boolean }

export type ZeilenHinweis =
  | { art: 'abgelaufen' }
  | { art: 'leer' }
  | { art: 'pruefen' }
  | { art: 'knapp'; tage: number }
  | { art: 'laeuft_ab'; tage: number }

export interface ZeilenStand {
  plan: ZeilenPlan
  /** Der dringendste Hinweis, oder null. Nie mehr als einer. */
  hinweis: ZeilenHinweis | null
  /** null, wenn kein Bestand gefuehrt wird. */
  reichweite: Reichweite | null
}

export interface ZeilenEintrag {
  configuration_status?: string | null
  reconstitution_date?: string | null
  expiry_days?: number | null
  inventory?: StackItemInventory | null
  ingredients: readonly StackItemIngredient[]
}

function zeilenPlan(timelines: readonly CycleTimeline[], now: Date, timeZone: string): ZeilenPlan {
  const best = orderTimelines([...timelines], now, timeZone)[0] ?? null
  if (!best || best.resolved.status === 'ended') return { art: 'kein_plan', hatteZyklen: timelines.length > 0 }
  if (best.resolved.status === 'paused') return { art: 'pausiert' }
  // Wie die Plan-Karte im Vollbild: ein Rhythmus ohne Einnahmezeiten hat
  // keine naechste Einnahme, auch wenn noch eine Uhrzeit gespeichert ist.
  const version = best.resolved.planVersion
  if (version && versionSlots(version).length === 0) return { art: 'ohne_termin' }
  const next = nextIntakeFor(best.timeline, best.resolved.status, now, timeZone)
  if (!next) return { art: 'ohne_termin' }
  return { art: 'naechste', localDate: next.localDate, time: next.time, dose: next.dose, unit: next.unit }
}

function mussGeprueftWerden(item: Pick<ZeilenEintrag, 'configuration_status'>, timelines: readonly CycleTimeline[]): boolean {
  return item.configuration_status === 'needs_review'
    || timelines.some(timeline => timeline.cycle.timezone_review_required)
}

/** Nur der Plan-Teil — ohne die Reichweite, die bis zu einem halben Jahr vorausrechnet. */
export function zeilenPlanFuer(input: {
  item: Pick<ZeilenEintrag, 'configuration_status'>
  timelines: readonly CycleTimeline[]
  now: Date
  timeZone: string
}): ZeilenPlan {
  const { item, timelines, now, timeZone } = input
  return mussGeprueftWerden(item, timelines) ? { art: 'pruefen' } : zeilenPlan(timelines, now, timeZone)
}

export function zeilenStand(input: {
  item: ZeilenEintrag
  timelines: readonly CycleTimeline[]
  now: Date
  timeZone: string
}): ZeilenStand {
  const { item, timelines, now, timeZone } = input
  const pruefen = mussGeprueftWerden(item, timelines)
  const plan = zeilenPlanFuer({ item, timelines, now, timeZone })

  const bestand = item.inventory?.enabled ? item.inventory : null
  const range = bestand
    ? reichweite({ inventory: bestand, ingredients: item.ingredients, timelines, now, timeZone })
    : null

  const tageHaltbar = expiryDaysLeft(item, now)

  // In dieser Reihenfolge: was schon eingetreten ist, vor dem, was droht.
  let hinweis: ZeilenHinweis | null = null
  if (tageHaltbar !== null && tageHaltbar < 0) hinweis = { art: 'abgelaufen' }
  else if (range?.art === 'leer') hinweis = { art: 'leer' }
  else if (pruefen) hinweis = { art: 'pruefen' }
  else if (range?.art === 'tage' && range.tage <= KNAPP_BIS_TAGE) hinweis = { art: 'knapp', tage: range.tage }
  else if (tageHaltbar !== null && tageHaltbar <= ABLAUF_BALD_TAGE) hinweis = { art: 'laeuft_ab', tage: tageHaltbar }

  return { plan, hinweis, reichweite: range }
}
