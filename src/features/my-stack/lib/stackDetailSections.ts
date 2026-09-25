import type { DosageFormDefinition } from './dosageForms'

/**
 * Welche Angaben im Vollbild einer Substanz stehen.
 *
 * Das Vollbild zeigt, WAS eine Substanz ist und woraus sie besteht. Alles zur
 * einzelnen Packung — Vorrat, Anmischen/Oeffnen, Haltbarkeit danach, Charge —
 * liegt in der Bestand-Ansicht (`BestandSheet`), fuer jede Form nach dem,
 * was sie kennt (`anbruchArt` in `bestand.ts`). So steht bei einem Pflaster
 * auch keine Kachel „Zugefuegte Fluessigkeit: Nicht gesetzt" mehr.
 *
 * Wie die Staerke heisst, sagt weiterhin die Form (`strengthShape` in
 * `dosageForms.ts`, siehe `wirkstoffBezug`).
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
 * `produkt` sagt, woraus diese Darreichung besteht. Was DIESE Packung ist —
 * angemischt, haltbar, wie viel noch da — steht in der Bestand-Ansicht.
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

export function detailAbschnitte(): DetailAbschnitt[] {
  // Die Wirkstoffmenge beschreibt die Zusammensetzung dieser Darreichung,
  // nicht die Identitaet der Substanz.
  //
  // Was DIESE Packung betrifft — Vorrat, angemischt/geoeffnet am, Haltbarkeit
  // danach, zugefuegte Fluessigkeit, Charge, Quelle, Analyse-Dokument — steht
  // nicht mehr hier, sondern in der Bestand-Ansicht (`BestandSheet`). Das
  // Vollbild zeigt davon nur die Kurzfassung als eigene Karte.
  const produkt: DetailFeld[] = ['wirkstoff']

  // Kategorie und Marke standen bis eben in einer zweiten Darstellung
  // DARUEBER (`StackItemDetails`), zusammen mit Name, Zutaten und Notizen —
  // also dreimal dasselbe untereinander, aus zwei verschiedenen Quellen. Was
  // dort einzigartig war, steht jetzt hier; die Darreichungsform nennt schon
  // die Ueberschrift des Wirkstoffs („Wirkstoff pro Pflaster"), und der Name
  // steht auf dem Objekt darueber.
  const substanz: DetailFeld[] = ['kategorie', 'applikation', 'marke', 'notizen']

  // Zuerst WAS es ist, dann woraus es besteht.
  return [
    { id: 'substanz', felder: substanz },
    { id: 'produkt', felder: produkt },
  ]
}
