// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IngredientEditor } from './IngredientEditor'
import type { StackItemIngredient, SubstanceCatalogEntry } from '../types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

afterEach(cleanup)

function zutat(position: number, name: string): StackItemIngredient {
  return {
    position,
    catalog_substance_id: null,
    custom_name: name,
    amount_value: null,
    amount_unit: null,
    basis_value: null,
    basis_unit: null,
  }
}

function aufbauen(zutaten: StackItemIngredient[] = [zutat(1, 'TB-500')]) {
  return render(
    <IngredientEditor
      ingredients={zutaten}
      onIngredientChange={() => undefined}
      onAddIngredient={() => undefined}
      onRemoveIngredient={() => undefined}
    />,
  )
}

const KATALOG: SubstanceCatalogEntry[] = [
  {
    id: 'ipa', canonical_name: 'Ipamorelin', aliases: [], default_category: 'peptide',
    suggested_units: ['mcg', 'mg'], suggested_dosage_forms: ['vial'], pk_profile_id: 'pk-ipa', active: true,
  },
  {
    id: 'k2', canonical_name: 'Vitamin K2', aliases: ['Menachinon', 'MK-7'], default_category: 'vitamin',
    suggested_units: ['mcg'], suggested_dosage_forms: ['capsule'], pk_profile_id: null, active: true,
  },
]

describe('IngredientEditor — die zweite Zeile haengt am Katalog', () => {
  // Bis hierher hing nur die erste Zutat am Katalog; sie kommt aus dem
  // Substanzschritt. Jede weitere war reiner Freitext — der zweite Wirkstoff
  // eines Kombipraeparats hatte damit weder Einheitenvorschlaege noch ein
  // PK-Profil. Er war nur ein Wort.
  type Aenderung = Partial<Omit<StackItemIngredient, 'position'>>
  function mitZweiter(
    zweite: StackItemIngredient,
    onIngredientChange: (index: number, changes: Aenderung) => void = () => undefined,
  ) {
    return render(
      <IngredientEditor
        ingredients={[zutat(1, 'CJC-1295 ohne DAC'), zweite]}
        catalogEntries={KATALOG}
        onIngredientChange={onIngredientChange}
        onAddIngredient={() => undefined}
        onRemoveIngredient={() => undefined}
      />,
    )
  }

  it('schlaegt beim Tippen Katalogeintraege vor', () => {
    mitZweiter(zutat(2, 'Ipa'))
    const treffer = document.querySelector('[data-ingredient-treffer]')!
    expect(within(treffer as HTMLElement).getByText('Ipamorelin')).toBeTruthy()
  })

  it('findet auch ueber den Alias, nicht nur ueber den Namen', () => {
    mitZweiter(zutat(2, 'Menachinon'))
    const treffer = document.querySelector('[data-ingredient-treffer]')!
    expect(within(treffer as HTMLElement).getByText('Vitamin K2')).toBeTruthy()
  })

  it('schweigt bei einem einzelnen Buchstaben', () => {
    // Ein Buchstabe trifft die halbe Datenbank — das ist keine Hilfe.
    mitZweiter(zutat(2, 'I'))
    expect(document.querySelector('[data-ingredient-treffer]')).toBeNull()
  })

  it('haengt die Zeile beim Waehlen an den Eintrag, mit Namen', () => {
    const rufe: Array<[number, Aenderung]> = []
    mitZweiter(zutat(2, 'Ipa'), (index, changes) => { rufe.push([index, changes]) })

    fireEvent.click(screen.getByText('Ipamorelin'))
    expect(rufe).toEqual([[1, { catalog_substance_id: 'ipa', custom_name: 'Ipamorelin' }]])
  })

  it('zeigt die gewaehlte Zutat als Wahl, samt PK-Hinweis', () => {
    mitZweiter({ ...zutat(2, 'Ipamorelin'), catalog_substance_id: 'ipa' })

    const gewaehlt = document.querySelector('[data-ingredient-catalog="ipa"]')!
    expect(gewaehlt.textContent).toContain('Ipamorelin')
    expect(gewaehlt.textContent).toContain('PK-Profil')
    // Und kein Suchfeld mehr daneben: die Wahl steht, bis man sie loest.
    expect(document.querySelector('[data-ingredient-treffer]')).toBeNull()
  })

  it('laesst die Wahl wieder loesen, ohne den Namen zu verlieren', () => {
    const rufe: Array<[number, Aenderung]> = []
    mitZweiter({ ...zutat(2, 'Ipamorelin'), catalog_substance_id: 'ipa' }, (index, changes) => {
      rufe.push([index, changes])
    })

    fireEvent.click(screen.getByLabelText('Auswahl lösen'))
    expect(rufe).toEqual([[1, { catalog_substance_id: null }]])
  })

  it('laesst die erste Zeile, wie sie war', () => {
    // Sie ist die Substanz des Eintrags und kommt aus dem Substanzschritt —
    // eine zweite Suche dort waere dieselbe Frage ein zweites Mal.
    mitZweiter(zutat(2, ''))
    const erste = document.getElementById('stack-ingredient-0')!
    expect(erste.getAttribute('type')).not.toBe('search')
  })
})

describe('IngredientEditor', () => {
  it('erklaert, was der Schritt will, statt nur ein Feld hinzustellen', () => {
    // Der Schritt zeigte nur den schon eingetragenen Namen und einen Knopf.
    // Was ein Inhaltsstoff hier ist und warum es mehr als einer sein koennte,
    // musste man raten.
    aufbauen()

    const frage = screen.getByRole('heading', { level: 3 })
    expect(frage.textContent).toContain('Was steckt in deinem Produkt?')
    expect(screen.getByText(/Meist ein einziger Wirkstoff/)).toBeTruthy()
  })

  it('sagt, wozu die Angabe im naechsten Schritt gebraucht wird', () => {
    aufbauen()

    const hinweis = document.querySelector('[data-ingredients-next]')
    expect(hinweis).not.toBeNull()
    expect(hinweis!.textContent).toMatch(/n(ä|ae)chsten Schritt/)
    expect(hinweis!.textContent).toMatch(/Produkteinheit/)
  })

  it('wiederholt die Schrittbezeichnung nicht als Ueberschrift', () => {
    // „Inhaltsstoffe" steht schon als Untertitel ueber dem Schritt. Ein
    // zweites Mal daruntergeschrieben waere dieselbe Doppelung, die aus dem
    // Formschritt schon geflogen ist.
    aufbauen()

    expect(screen.getByRole('heading', { level: 3 }).textContent).not.toBe('Inhaltsstoffe')
  })

  it('beschriftet jede Zeile durchgezaehlt und bietet das Hinzufuegen an', () => {
    aufbauen([zutat(1, 'Vitamin D3'), zutat(2, 'Vitamin K2')])

    expect(screen.getByText('Inhaltsstoff 1')).toBeTruthy()
    expect(screen.getByText('Inhaltsstoff 2')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Inhaltsstoff hinzufügen/ })).toBeTruthy()
  })
})
