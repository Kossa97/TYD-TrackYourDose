import { describe, expect, it } from 'vitest'
import type { DosageFormKey, StackItemDraft, StackItemIngredient } from '../types'
import { buildDuplicateFingerprint } from './duplicateFingerprint'

function ingredient(
  name: string,
  amountValue: number,
  amountUnit: string,
  basisValue: number,
  basisUnit: string,
): StackItemIngredient {
  return {
    catalog_substance_id: null,
    custom_name: name,
    amount_value: amountValue,
    amount_unit: amountUnit,
    basis_value: basisValue,
    basis_unit: basisUnit,
    position: 0,
  }
}

function draft(dosageForm: DosageFormKey, ingredients: StackItemIngredient[]): StackItemDraft {
  return {
    displayName: 'Produktname',
    trackingLevel: 'complete',
    category: 'vitamin',
    dosageForm,
    brand: '',
    colorHex: '',
    notes: '',
    ingredients,
  }
}

const d3Capsule1000 = draft('capsule', [ingredient('Vitamin D3', 1000, 'IU', 1, 'capsule')])
const d3Drops1000 = draft('drops', [ingredient('Vitamin D3', 1000, 'IU', 1, 'drop')])
const d3Capsule5000 = draft('capsule', [ingredient('Vitamin D3', 5000, 'IU', 1, 'capsule')])

describe('buildDuplicateFingerprint', () => {
  it('ignoriert Reihenfolge, Großschreibung und Dezimalformat', () => {
    const a = draft('capsule', [
      ingredient('Vitamin D3', 5000, 'IU', 1, 'capsule'),
      ingredient('K2', 100, 'mcg', 1, 'capsule'),
    ])
    const b = draft('capsule', [
      ingredient(' k2 ', 100.0, 'MCG', 1.0, 'CAPSULE'),
      ingredient('vitamin d3', 5000.00, 'iu', 1, 'capsule'),
    ])

    expect(buildDuplicateFingerprint(a)).toBe(buildDuplicateFingerprint(b))
  })

  it('unterscheidet Form und Stärke, aber nicht Marke', () => {
    expect(buildDuplicateFingerprint(d3Capsule1000)).not.toBe(buildDuplicateFingerprint(d3Drops1000))
    expect(buildDuplicateFingerprint(d3Capsule1000)).not.toBe(buildDuplicateFingerprint(d3Capsule5000))
    expect(buildDuplicateFingerprint({ ...d3Capsule1000, brand: 'A' }))
      .toBe(buildDuplicateFingerprint({ ...d3Capsule1000, brand: 'B' }))
  })

  it('schließt Anzeige-, Farb- und Notizfelder aus', () => {
    const a = {
      ...d3Capsule1000,
      displayName: 'Vitamin D3 A',
      colorHex: '#000000',
      notes: 'Erste Notiz',
    }
    const b = {
      ...d3Capsule1000,
      displayName: 'Vitamin D3 B',
      colorHex: '#ffffff',
      notes: 'Andere Notiz',
    }

    expect(buildDuplicateFingerprint(a)).toBe(buildDuplicateFingerprint(b))
  })

  it('verwendet bei Katalogzeilen die stabile Katalog-ID', () => {
    const a = draft('capsule', [{
      ...ingredient('', 1000, 'IU', 1, 'capsule'),
      catalog_substance_id: 'vitamin-d3',
    }])
    const b = draft('capsule', [{
      ...ingredient('Ignorierter Anzeigename', 1000, 'iu', 1, 'CAPSULE'),
      catalog_substance_id: 'vitamin-d3',
    }])

    expect(buildDuplicateFingerprint(a)).toBe(buildDuplicateFingerprint(b))
  })

  it('behandelt eine reine Leerraum-Katalog-ID als freie Substanz', () => {
    const whitespaceId = draft('capsule', [{
      ...ingredient('Vitamin D3', 1000, 'IU', 1, 'capsule'),
      catalog_substance_id: '   ',
    }])
    const absentId = draft('capsule', [ingredient('vitamin d3', 1000, 'iu', 1, 'CAPSULE')])
    const otherCustomName = draft('capsule', [{
      ...ingredient('Vitamin K2', 1000, 'IU', 1, 'capsule'),
      catalog_substance_id: '   ',
    }])

    expect(buildDuplicateFingerprint(whitespaceId)).toBe(buildDuplicateFingerprint(absentId))
    expect(buildDuplicateFingerprint(whitespaceId)).not.toBe(buildDuplicateFingerprint(otherCustomName))
  })
})
