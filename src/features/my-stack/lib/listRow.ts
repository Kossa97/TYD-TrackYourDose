import { differenceInCalendarDays, parseISO } from 'date-fns'
import { localDateTimeKey, resolveCycleAt, type CycleTimeline } from '../../../lib/planTimeline'
import { shiftLocalDay } from './localDays'
import { haltbarBis } from './bestand'
import type { StackItemInventory } from '../types'

/**
 * Was eine Zeile der Listenansicht ueber eine Substanz sagt — fuer jede
 * Darreichungsform gleich: ob sie gerade laeuft und bis wann sie haelt.
 * Name und Zusammensetzung liest die Zeile direkt vom Eintrag.
 *
 * Reine Rechnung, damit Liste und Tests dieselbe Antwort sehen.
 */

/** Ab so wenigen Tagen heisst es „Läuft in n Tagen ab" statt „Haltbar bis". */
export const ABLAUF_BALD_TAGE = 7

export interface Haltbarkeit {
  /** Der frueheste Tag, an dem etwas ablaeuft (`YYYY-MM-DD`). */
  bis: string
  /** Kalendertage bis dahin: 0 heute, negativ abgelaufen. */
  tage: number
}

export interface HaltbarkeitsEintrag {
  reconstitution_date?: string | null
  expiry_days?: number | null
  inventory?: StackItemInventory | null
}

/**
 * Bis wann die Substanz haelt. Es gibt zwei Fristen, und beide koennen
 * zugleich gelten: die nach dem Anmischen oder Oeffnen (Tage ab dem Datum)
 * und das Datum auf der Packung. Es zaehlt die fruehere — was zuerst
 * ablaeuft, ist die Grenze.
 *
 * Aeltere Eintraege tragen die erste Frist noch an sich selbst
 * (`reconstitution_date` + `expiry_days`), neuere im Bestand.
 */
export function haltbarkeitFuer(item: HaltbarkeitsEintrag, now: Date, timeZone: string): Haltbarkeit | null {
  const fristen: string[] = []
  const nachOeffnen = item.inventory ? haltbarBis(item.inventory) : null
  if (nachOeffnen) fristen.push(nachOeffnen)
  else if (item.reconstitution_date && item.expiry_days) {
    fristen.push(shiftLocalDay(item.reconstitution_date.slice(0, 10), Number(item.expiry_days)))
  }
  if (item.inventory?.expires_at) fristen.push(item.inventory.expires_at.slice(0, 10))
  if (fristen.length === 0) return null

  const bis = fristen.sort()[0]
  const heute = localDateTimeKey(now, timeZone).slice(0, 10)
  return { bis, tage: differenceInCalendarDays(parseISO(bis), parseISO(heute)) }
}

/** Aktiv heisst: ein Zyklus laeuft jetzt — nicht pausiert, nicht erst geplant, nicht beendet. */
export function istAktiv(timelines: readonly CycleTimeline[], now: Date, timeZone: string): boolean {
  return timelines.some(timeline => resolveCycleAt(timeline, now, timeZone).status === 'active')
}
