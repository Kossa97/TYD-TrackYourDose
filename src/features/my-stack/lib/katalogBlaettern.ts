import type { StackCategory, SubstanceCatalogEntry } from '../types'

// Den Katalog durchblaettern statt durchsuchen.
//
// Das Suchfeld zeigt nichts, solange niemand tippt. Wer nicht weiss, wie ein
// Stoff heisst — oder was ueberhaupt drin ist —, hatte damit keinen Weg. Bei
// 26 Substanzen war das zu verschmerzen, bei 182 nicht mehr.
//
// Hier steht nur das Sortieren und Gruppieren. Die Liste selbst zeichnet
// `SubstanceBrowser`.

export interface KatalogBuchstabe {
  /** Der Buchstabe, unter dem die Gruppe steht. Ziffern und Zeichen: '#'. */
  readonly buchstabe: string
  readonly eintraege: readonly SubstanceCatalogEntry[]
}

/**
 * Unter welchem Buchstaben ein Name einsortiert wird.
 *
 * Umlaute kommen zu ihrem Grundbuchstaben: „Östradiol" steht unter O, nicht
 * unter Ö. Ein eigenes Ö-Fach haette zwei Eintraege und liesse den suchen, der
 * unter O nachsieht. Alles, was nicht mit einem Buchstaben anfaengt — „5-HTP",
 * „AOD-9604" faengt schon mit A an —, landet unter '#'.
 */
export function anfangsbuchstabe(name: string): string {
  const erstes = name.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toLocaleUpperCase('de')
  return /^[A-Z]$/.test(erstes) ? erstes : '#'
}

/** Alphabetisch nach deutschen Regeln — „Ö" neben „O", nicht hinter „Z". */
function nachNamen(a: SubstanceCatalogEntry, b: SubstanceCatalogEntry): number {
  return a.canonical_name.localeCompare(b.canonical_name, 'de', { sensitivity: 'base' })
}

export function nachKategorie(
  eintraege: readonly SubstanceCatalogEntry[],
  kategorie: StackCategory,
): SubstanceCatalogEntry[] {
  return eintraege
    .filter(eintrag => eintrag.active && eintrag.default_category === kategorie)
    .sort(nachNamen)
}

/**
 * Gruppiert eine bereits gefilterte Liste nach Anfangsbuchstaben.
 *
 * Leere Buchstaben kommen nicht vor: die Sprungleiste soll nur zeigen, wo
 * wirklich etwas steht. Ein Buchstabe, der ins Leere springt, ist schlimmer
 * als einer, der fehlt.
 */
export function nachBuchstaben(
  eintraege: readonly SubstanceCatalogEntry[],
): KatalogBuchstabe[] {
  const gruppen = new Map<string, SubstanceCatalogEntry[]>()
  for (const eintrag of [...eintraege].sort(nachNamen)) {
    const buchstabe = anfangsbuchstabe(eintrag.canonical_name)
    const gruppe = gruppen.get(buchstabe)
    if (gruppe) gruppe.push(eintrag)
    else gruppen.set(buchstabe, [eintrag])
  }

  // '#' ganz nach hinten: Ziffern und Zeichen sind die Ausnahme, nicht der
  // Anfang der Liste.
  return [...gruppen.entries()]
    .sort(([a], [b]) => {
      if (a === '#') return 1
      if (b === '#') return -1
      return a.localeCompare(b, 'de')
    })
    .map(([buchstabe, gruppe]) => ({ buchstabe, eintraege: gruppe }))
}
