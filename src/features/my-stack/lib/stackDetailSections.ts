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
  | 'kategorie'
  | 'marke'
  | 'fluessigkeit'
  | 'rekonstituiert_am'
  | 'haltbarkeit'
  | 'vorrat'
  | 'applikation'
  | 'batch'
  | 'quelle'
  | 'analyse'
  | 'notizen'

/**
 * `substanz` sagt, WAS das ist — Kategorie, Methode, Herkunft. Das gilt fuer
 * jede Packung derselben Substanz gleich.
 *
 * `produkt` sagt, was DIESE Packung ist: angemischt, haltbar, wie viel noch da.
 * Wie der Abschnitt heisst, haengt an seinem Inhalt (siehe `produktTitel`).
 */
export type AbschnittId = 'substanz' | 'produkt'

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

  // Die Wirkstoffmenge beschreibt die Zusammensetzung dieser Darreichung,
  // nicht die Identitaet der Substanz. Beim Vial gehoert sie deshalb zur
  // Rekonstitution, bei allen anderen Formen zur Zusammensetzung.
  const produkt: DetailFeld[] = ['wirkstoff']
  // Aufloesen heisst: Pulver im Glas, das man selbst anmischt. Nur dort gibt es
  // eine zugefuegte Fluessigkeit, ein Datum dafuer und eine Haltbarkeit DANACH.
  if (kann('reconstitutable')) produkt.push('fluessigkeit', 'rekonstituiert_am', 'haltbarkeit')
  if (kann('inventory_capable')) produkt.push('vorrat')

  // Kategorie und Marke standen bis eben in einer zweiten Darstellung
  // DARUEBER (`StackItemDetails`), zusammen mit Name, Zutaten und Notizen —
  // also dreimal dasselbe untereinander, aus zwei verschiedenen Quellen. Was
  // dort einzigartig war, steht jetzt hier; die Darreichungsform nennt schon
  // die Ueberschrift des Wirkstoffs („Wirkstoff pro Pflaster"), und der Name
  // steht auf dem Objekt darueber.
  const substanz: DetailFeld[] = [
    'kategorie', 'applikation', 'marke',
    'batch', 'quelle', 'analyse', 'notizen',
  ]

  // Zuerst WAS es ist, dann was DIESE Packung ist.
  const abschnitte: DetailAbschnitt[] = [{ id: 'substanz', felder: substanz }]
  abschnitte.push({ id: 'produkt', felder: produkt })
  return abschnitte
}

/**
 * Wie der Produktabschnitt heisst.
 *
 * Wo eine Fluessigkeit zugefuegt wird, beschreibt der Abschnitt die
 * Rekonstitution. Bei allen anderen Formen beschreibt er die Zusammensetzung:
 * die formgerechte Wirkstoffstaerke und, sofern erfasst, den Vorrat.
 */
export function produktTitel(abschnitt: DetailAbschnitt): 'rekonstitution' | 'zusammensetzung' {
  return abschnitt.felder.includes('fluessigkeit') ? 'rekonstitution' : 'zusammensetzung'
}

/** Kommt dieses Feld bei dieser Form vor? */
export function zeigtFeld(form: DosageFormDefinition | undefined, feld: DetailFeld) {
  return detailAbschnitte(form).some(abschnitt => abschnitt.felder.includes(feld))
}
