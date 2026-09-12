// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IngredientEditor } from './IngredientEditor'
import type { StackItemIngredient } from '../types'

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
