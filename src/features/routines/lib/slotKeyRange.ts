/**
 * Routine-Slots ueber ihren Schluesselbereich suchen statt sie aufzuzaehlen.
 *
 * Ein Slot-Schluessel ist `<cycle-uuid>@<lokale Wanduhr>` (siehe
 * `slotKey.ts`). Der Kalender hat bisher alle sichtbaren Schluessel im
 * Browser erzeugt und sie der Datenbank als Liste uebergeben -- bis zu hundert
 * Stueck, siebentausend Zeichen Adresse. Gemessen am 2026-09-20:
 *
 *   3031 Anfragen an /rest/v1/dose_logs  ->  2751 VERSCHIEDENE Adressen
 *   2383 davon mussten zuerst einen CORS-Preflight verhandeln
 *
 * Der Browser fuehrt seinen Preflight-Cache je Adresse. Weil die Schluesselliste
 * sich mit jedem angezeigten Tag aenderte, war jede Adresse neu und keine
 * Verhandlung wiederverwendbar. Zum Vergleich: `/rest/v1/cycles` kam mit 17
 * Adressen auf 3138 Anfragen aus und brauchte 45 Preflights.
 *
 * Dieselbe Menge laesst sich ohne Aufzaehlung treffen. `YYYY-MM-DDTHH:MM` hat
 * feste Breite, also ist der Zeitteil lexikografisch chronologisch; und weil
 * Anfang und Ende eines Bereichs denselben UUID-Praefix tragen, kann kein
 * fremder Zyklus hineinfallen -- ein anderer Schluessel unterscheidet sich
 * schon im Praefix und liegt damit ganz ausserhalb.
 *
 * Die Grenzen sind **lokale Tage**, keine Zeitpunkte. Das ist kein Detail,
 * sondern dieselbe Entscheidung wie im Schluessel selbst: ein Bereich, der
 * aus Instants gebaut waere, verschoebe sich beim Reisen gegen die Menge,
 * die er treffen soll.
 *
 * Was daran haengt: die Adresse ergibt sich nur noch aus den Zyklus-ids und dem
 * Zeitfenster. Beide bleiben gleich, solange man denselben Monat ansieht -- die
 * Verhandlung von eben gilt also noch.
 */

import { slotSchluesselGrenze } from './slotKey'

/** Ein Zeitfenster, fuer das Slots gesucht werden. */
export interface SchluesselFenster {
  /** Lokaler Tag `YYYY-MM-DD`, einschliesslich. */
  start: string
  /** Lokaler Tag `YYYY-MM-DD`, ausschliesslich. */
  end: string
}

/**
 * Was den Ausdruck sprengen wuerde.
 *
 * Erst stand hier eine UUID-Pruefung. Die war zu streng am falschen Ort: sie
 * warf bei jeder unerwarteten id und riss damit den ganzen Ladevorgang mit --
 * eine Seite, die nichts mehr anzeigt, ist schlimmer als eine Abfrage, die
 * nichts findet. Gefaehrlich ist nur, was aus den Anfuehrungszeichen
 * ausbricht; alles andere traegt das Zitat.
 */
const GEFAEHRLICH = /["\\]/

/**
 * Baut die `or`-Ausdruecke fuer PostgREST -- einen je Abfrage.
 *
 * Je Zyklus und Fenster entsteht eine Bereichsbedingung. Sie werden gebuendelt,
 * damit die Adresse nicht ueber jedes Mass waechst; die Buendelung ist
 * deterministisch, sonst waere die Adresse wieder bei jedem Aufruf anders und
 * der Preflight-Cache liefe erneut ins Leere.
 */
export function slotKeyBereiche(
  cycleIds: readonly string[],
  fenster: readonly SchluesselFenster[],
  bedingungenJeAbfrage = 40,
): string[] {
  if (!Number.isInteger(bedingungenJeAbfrage) || bedingungenJeAbfrage < 1) {
    throw new Error('Bedingungen je Abfrage muss eine positive ganze Zahl sein')
  }

  // Sortiert und ohne Dubletten: dieselbe Auswahl muss dieselbe Adresse
  // ergeben, egal in welcher Reihenfolge die Zyklen geladen wurden.
  const ids = [...new Set(cycleIds)].sort()
  const fensterSortiert = [...fenster]
    .filter(f => f.end > f.start)
    .sort((a, b) => a.start.localeCompare(b.start))

  const bedingungen: string[] = []
  for (const id of ids) {
    if (GEFAEHRLICH.test(id)) throw new Error(`Unzulaessige Zyklus-id: ${id}`)
    for (const f of fensterSortiert) {
      const von = slotSchluesselGrenze(id, f.start)
      const bis = slotSchluesselGrenze(id, f.end)
      // Die Werte tragen `:` und `.`; ohne Anfuehrungszeichen liest PostgREST
      // den Punkt als Trennzeichen und der Ausdruck zerfaellt.
      bedingungen.push(
        `and(routine_slot_key.gte."${von}",routine_slot_key.lt."${bis}")`,
      )
    }
  }

  const abfragen: string[] = []
  for (let start = 0; start < bedingungen.length; start += bedingungenJeAbfrage) {
    abfragen.push(bedingungen.slice(start, start + bedingungenJeAbfrage).join(','))
  }
  return abfragen
}

/**
 * Faengt der Bereich diesen Schluessel?
 *
 * Nur fuer Tests und zur Selbstpruefung -- die Datenbank filtert selbst. Die
 * Funktion beschreibt, was die Bedingung oben bedeutet, damit sich beides
 * gegeneinander pruefen laesst.
 */
export function imBereich(
  schluessel: string,
  cycleId: string,
  fenster: SchluesselFenster,
): boolean {
  const von = slotSchluesselGrenze(cycleId, fenster.start)
  const bis = slotSchluesselGrenze(cycleId, fenster.end)
  return schluessel >= von && schluessel < bis
}
