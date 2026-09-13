import { describe, expect, it } from 'vitest'
import { anfangsbuchstabe, nachBuchstaben, nachKategorie } from './katalogBlaettern'
import type { StackCategory, SubstanceCatalogEntry } from '../types'

function eintrag(
  name: string,
  category: StackCategory = 'supplement',
  active = true,
): SubstanceCatalogEntry {
  return {
    id: name,
    canonical_name: name,
    aliases: [],
    default_category: category,
    suggested_units: [],
    suggested_dosage_forms: [],
    pk_profile_id: null,
    active,
  }
}

describe('anfangsbuchstabe', () => {
  it('sortiert Umlaute unter ihren Grundbuchstaben', () => {
    // „Östradiol" gehoert zu O. Ein eigenes Oe-Fach haette zwei Eintraege und
    // liesse den suchen, der unter O nachsieht.
    expect(anfangsbuchstabe('Östradiol')).toBe('O')
    expect(anfangsbuchstabe('Azelainsäure')).toBe('A')
    expect(anfangsbuchstabe('Über')).toBe('U')
  })

  it('wirft alles ohne Anfangsbuchstaben in ein Fach', () => {
    expect(anfangsbuchstabe('5-HTP')).toBe('#')
    expect(anfangsbuchstabe('  ')).toBe('#')
  })

  it('nimmt den Buchstaben auch aus Namen mit Bindestrich und Ziffern', () => {
    expect(anfangsbuchstabe('AOD-9604')).toBe('A')
    expect(anfangsbuchstabe('CJC-1295 ohne DAC')).toBe('C')
    expect(anfangsbuchstabe('SLU-PP-332')).toBe('S')
  })
})

describe('nachKategorie', () => {
  it('nimmt nur die gewaehlte Kategorie, alphabetisch', () => {
    const alle = [
      eintrag('Zink'), eintrag('Ibuprofen', 'medication'), eintrag('Ashwagandha'),
    ]

    expect(nachKategorie(alle, 'supplement').map(e => e.canonical_name))
      .toEqual(['Ashwagandha', 'Zink'])
  })

  it('laesst stillgelegte Eintraege weg', () => {
    // `active` ist das Feld, mit dem eine Substanz aus dem Katalog genommen
    // wird, ohne die Verweise bestehender Eintraege zu brechen.
    const alle = [eintrag('Zink'), eintrag('Alt', 'supplement', false)]

    expect(nachKategorie(alle, 'supplement').map(e => e.canonical_name)).toEqual(['Zink'])
  })
})

describe('nachBuchstaben', () => {
  it('gruppiert alphabetisch und haelt die Reihenfolge innerhalb der Gruppe', () => {
    const gruppen = nachBuchstaben([
      eintrag('Zink'), eintrag('Arnika'), eintrag('Aloe Vera'), eintrag('Baldrian'),
    ])

    expect(gruppen.map(g => g.buchstabe)).toEqual(['A', 'B', 'Z'])
    expect(gruppen[0].eintraege.map(e => e.canonical_name)).toEqual(['Aloe Vera', 'Arnika'])
  })

  it('stellt das Zeichen-Fach ans Ende, nicht an den Anfang', () => {
    const gruppen = nachBuchstaben([eintrag('5-HTP'), eintrag('Arnika'), eintrag('Zink')])

    expect(gruppen.map(g => g.buchstabe)).toEqual(['A', 'Z', '#'])
  })

  it('gibt keine leeren Buchstaben zurueck', () => {
    // Die Sprungleiste zeigt nur, wo wirklich etwas steht. Ein Buchstabe, der
    // ins Leere springt, ist schlimmer als einer, der fehlt.
    const gruppen = nachBuchstaben([eintrag('Arnika'), eintrag('Zink')])

    expect(gruppen.every(g => g.eintraege.length > 0)).toBe(true)
    expect(gruppen).toHaveLength(2)
  })

  it('sortiert Umlaute an ihren Platz, nicht hinter Z', () => {
    const gruppen = nachBuchstaben([eintrag('Zink'), eintrag('Östradiol'), eintrag('Omega-3')])

    expect(gruppen.map(g => g.buchstabe)).toEqual(['O', 'Z'])
    expect(gruppen[0].eintraege.map(e => e.canonical_name)).toEqual(['Omega-3', 'Östradiol'])
  })

  it('kommt mit einer leeren Liste zurecht', () => {
    expect(nachBuchstaben([])).toEqual([])
  })
})
