import type { DosageFormDefinition } from './dosageForms'

/**
 * Welche Angaben im Vollbild einer Substanz ueberhaupt Sinn ergeben.
 *
 * Bisher zeigte das Vollbild fuer JEDE Form dieselben Felder. Bei einem
 * Pflaster standen dort vier Kacheln „Nicht gesetzt" — Fluessigkeit,
 * Rekonstitution, Haltbarkeit danach, Wirkstoff pro Vial —, weil ein Pflaster
 * nichts davon kennt. Das sieht nicht nach „nicht ausgefuellt" aus, sondern
 * nach kaputt.
 *
 * Entschieden wird das nicht hier neu, sondern aus dem, was die Form ohnehin
 * ueber sich sagt (`capabilities`, `strengthShape` in `dosageForms.ts`). Eine
 * zweite Liste, welche Form was kann, waere die zweite Wahrheit.
 *
 * Die Regel dabei: eine Angabe, die die FORM nicht kennt, faellt weg. Eine,
 * die sie kennt und die nur LEER ist, bleibt stehen — dort ist „Nicht
 * gesetzt" eine Aufforderung und keine Panne.
 */

export type DetailFeld =
  | 'wirkstoff'
  | 'fluessigkeit'
  | 'rekonstituiert_am'
  | 'haltbarkeit'
  | 'vorrat'
  | 'applikation'
  | 'batch'
  | 'quelle'
  | 'analyse'
  | 'notizen'

export type AbschnittId = 'bestand' | 'substanz'

export interface DetailAbschnitt {
  id: AbschnittId
  felder: readonly DetailFeld[]
}

/**
 * Wie die Staerke dieser Form heisst.
 *
 * „Wirkstoff pro Vial" stimmt beim Vial und sonst nirgends. Der Marker kommt
 * aus `strengthShape`; den Text dazu setzt die Oberflaeche, denn er gehoert
 * zur Sprache und nicht zur Rechnung.
 */
export type WirkstoffBezug = 'pro_vial' | 'pro_volumen' | 'pro_einheit' | 'pro_masse' | 'roh'

export function wirkstoffBezug(form: DosageFormDefinition | undefined): WirkstoffBezug {
  switch (form?.strengthShape) {
    case 'reconstituted': return 'pro_vial'
    case 'per_volume': return 'pro_volumen'
    case 'per_unit': return 'pro_einheit'
    case 'per_mass': return 'pro_masse'
    default: return 'roh'
  }
}

export function detailAbschnitte(form: DosageFormDefinition | undefined): DetailAbschnitt[] {
  const kann = (faehigkeit: string) => form?.capabilities.includes(faehigkeit as never) ?? false

  const bestand: DetailFeld[] = []
  // Aufloesen heisst: Pulver im Glas, das man selbst anmischt. Nur dort gibt es
  // eine zugefuegte Fluessigkeit, ein Datum dafuer und eine Haltbarkeit DANACH.
  if (kann('reconstitutable')) bestand.push('fluessigkeit', 'rekonstituiert_am', 'haltbarkeit')
  if (kann('inventory_capable')) bestand.push('vorrat')

  const substanz: DetailFeld[] = ['wirkstoff', 'applikation', 'batch', 'quelle', 'analyse', 'notizen']

  const abschnitte: DetailAbschnitt[] = []
  // Ein Abschnitt ohne Felder erscheint gar nicht — eine leere Ueberschrift
  // ist schlimmer als eine fehlende.
  if (bestand.length > 0) abschnitte.push({ id: 'bestand', felder: bestand })
  abschnitte.push({ id: 'substanz', felder: substanz })
  return abschnitte
}

/** Kommt dieses Feld bei dieser Form vor? */
export function zeigtFeld(form: DosageFormDefinition | undefined, feld: DetailFeld) {
  return detailAbschnitte(form).some(abschnitt => abschnitt.felder.includes(feld))
}
