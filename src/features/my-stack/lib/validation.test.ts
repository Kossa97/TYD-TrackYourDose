import { describe, expect, it } from 'vitest'
import type { StackItemDraft, StackItemIngredient } from '../types'
import { validateStackItemDraft } from './validation'

const ingredient: StackItemIngredient = {
  catalog_substance_id: 'vitamin-d3',
  custom_name: '',
  amount_value: 5000,
  amount_unit: 'IU',
  basis_value: 1,
  basis_unit: 'capsule',
  position: 0,
}

const validVitaminD: StackItemDraft = {
  displayName: 'Vitamin D3',
  category: 'vitamin',
  dosageForm: 'capsule',
  brand: '',
  colorHex: '',
  notes: '',
  ingredients: [ingredient],
}

describe('validateStackItemDraft', () => {
  it('akzeptiert einen vollständigen Entwurf', () => {
    expect(validateStackItemDraft(validVitaminD)).toEqual({})
  })

  it('verlangt eine Darreichungsform', () => {
    expect(validateStackItemDraft({ ...validVitaminD, dosageForm: null }).dosageForm).toBeTruthy()
  })

  it('verlangt mindestens einen Inhaltsstoff', () => {
    expect(validateStackItemDraft({ ...validVitaminD, ingredients: [] }).ingredients).toBeTruthy()
  })

  it('markiert fehlende Stärke und Bezugsgröße an der Inhaltsstoffzeile', () => {
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, amount_value: null }],
    }).ingredients?.[0].amountValue).toBeTruthy()
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, amount_unit: null }],
    }).ingredients?.[0].amountUnit).toBeTruthy()
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, basis_value: null }],
    }).ingredients?.[0].basisValue).toBeTruthy()
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, basis_unit: null }],
    }).ingredients?.[0].basisUnit).toBeTruthy()
  })

  it('akzeptiert freie und katalogbasierte Inhaltsstoffe', () => {
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, catalog_substance_id: null, custom_name: 'Vitamin D3' }],
    })).toEqual({})
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, custom_name: '' }],
    })).toEqual({})
  })

  it('markiert bei Mehrfachwirkstoffen nur fehlerhafte Zeilen', () => {
    const errors = validateStackItemDraft({
      ...validVitaminD,
      ingredients: [
        ingredient,
        {
          ...ingredient,
          catalog_substance_id: null,
          custom_name: ' ',
          position: 1,
        },
      ],
    })

    expect(errors.ingredients?.[0]).toEqual({})
    expect(errors.ingredients?.[1].name).toBeTruthy()
  })
})
