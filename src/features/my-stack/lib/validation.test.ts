import { describe, expect, it } from 'vitest'
import type { IntakePlanDraft, StackItemDraft, StackItemIngredient } from '../types'
import { validateIntakePlan, validateStackItemDraft } from './validation'

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
  trackingLevel: 'complete',
  category: 'vitamin',
  dosageForm: 'capsule',
  brand: '',
  colorHex: '',
  notes: '',
  ingredients: [ingredient],
}

const validPlan: IntakePlanDraft = {
  name: 'Vitamin D3',
  dose: 1,
  unit: 'capsule',
  method: 'Oral',
  frequency: 'daily',
  xDaysInterval: null,
  scheduleDays: [],
  startDate: '2026-07-29',
  endDate: null,
  routineGroup: 'morning',
  time: null,
  reminders: [],
}

describe('validateStackItemDraft', () => {
  it('requires a positive dose and unit only when tracking quantity', () => {
    const planWithoutQuantity = { ...validPlan, dose: null, unit: null }

    expect(validateIntakePlan(planWithoutQuantity, 'intake_only')).toEqual({})
    expect(validateIntakePlan(planWithoutQuantity, 'with_amount')).toEqual({
      dose: 'required',
      unit: 'required',
    })
    expect(validateIntakePlan({ ...validPlan, name: ' ', frequency: '', routineGroup: '' as never }, 'complete')).toEqual({
      name: 'required',
      frequency: 'required',
      routineGroup: 'required',
    })
  })

  it('requires a method and a start/effective date for every tracking level', () => {
    for (const trackingLevel of ['intake_only', 'with_amount', 'complete'] as const) {
      expect(validateIntakePlan({ ...validPlan, method: ' ', startDate: '' }, trackingLevel))
        .toMatchObject({ method: 'required', startDate: 'required' })
    }
  })

  it('allows missing strength for intake_only and with_amount', () => {
    for (const trackingLevel of ['intake_only', 'with_amount'] as const) {
      const errors = validateStackItemDraft({
        ...validVitaminD,
        trackingLevel,
        ingredients: [{ ...ingredient, amount_value: null, amount_unit: null }],
      })
      expect(errors.ingredients?.[0]?.amountValue).toBeUndefined()
    }
  })

  it('requires product strength for complete', () => {
    const errors = validateStackItemDraft({
      ...validVitaminD,
      trackingLevel: 'complete',
      ingredients: [{ ...ingredient, amount_value: null, amount_unit: null }],
    })
    expect(errors.ingredients?.[0]?.amountValue).toBe('required_for_complete')
  })

  it('rejects non-positive complete strength and basis values before SQL', () => {
    const errors = validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, amount_value: 0, basis_value: 0 }],
    })

    expect(errors.ingredients?.[0]).toMatchObject({
      amountValue: 'required_for_complete',
      basisValue: 'required_for_complete',
    })
  })

  it('rejects non-finite tracked quantities and complete strength before SQL', () => {
    expect(validateIntakePlan({ ...validPlan, dose: Number.POSITIVE_INFINITY }, 'with_amount').dose)
      .toBe('required')
    expect(validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, amount_value: Number.POSITIVE_INFINITY }],
    }).ingredients?.[0]?.amountValue).toBe('required_for_complete')
  })

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

  it('behandelt eine reine Leerraum-Katalog-ID als fehlend', () => {
    const errors = validateStackItemDraft({
      ...validVitaminD,
      ingredients: [{ ...ingredient, catalog_substance_id: '   ', custom_name: ' ' }],
    })

    expect(errors.ingredients?.[0].name).toBeTruthy()
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
