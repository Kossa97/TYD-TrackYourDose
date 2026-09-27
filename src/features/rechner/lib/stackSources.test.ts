import { describe, expect, it } from 'vitest'
import type { LoadedStackItem, LoadedStackItemIngredient } from '../../my-stack/services/stackItems'
import type { StackItemInventory } from '../../my-stack/types'
import { getCalculatorSources } from './stackSources'

function ingredient(overrides: Partial<LoadedStackItemIngredient> = {}): LoadedStackItemIngredient {
  return {
    id: 'ingredient-1', catalog_substance_id: null, custom_name: 'Substance',
    amount_value: 10, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial',
    position: 0, substance_catalog: null, ...overrides,
  }
}

function item(overrides: Partial<LoadedStackItem> & {
  vial_amount_mg?: number | null
  vial_amount_unit?: string | null
  reconstitution_ml?: number | null
} = {}): LoadedStackItem {
  return {
    id: 'item-1', user_id: 'user-1', display_name: 'Product', category: 'peptide',
    dosage_form: 'vial', brand: null, color_hex: null, notes: null,
    configuration_status: 'complete', archived: false, tracking_level: 'complete',
    pk_profile_method: null, archived_at: null, created_at: '', updated_at: '',
    ingredients: [ingredient()], ...overrides,
  }
}

function inventory(overrides: Partial<StackItemInventory> = {}): StackItemInventory {
  return {
    enabled: true, package_quantity: 1, package_unit: 'vial', remaining_quantity: 1,
    batch_number: null, expires_at: null, reconstitution_ml: 1.5, ...overrides,
  }
}

describe('getCalculatorSources', () => {
  it('imports a new wizard vial without legacy amount or assumed diluent', () => {
    expect(getCalculatorSources([item()])).toEqual([
      { id: 'item-1', label: 'Product', vialAmountMg: 10, diluentMl: null },
    ])
  })

  it.each([['mcg', 5000, 5], ['mg', 5, 5], ['g', 0.005, 5]])(
    'normalizes structured %s amounts to mg', (unit, value, expected) => {
      expect(getCalculatorSources([item({ ingredients: [ingredient({ amount_unit: unit, amount_value: value })] })])[0].vialAmountMg).toBe(expected)
    },
  )

  it('normalizes a strength given for multiple vials to one vial', () => {
    expect(getCalculatorSources([item({ ingredients: [ingredient({ basis_value: 2, basis_unit: 'Vial' })], reconstitution_ml: 3 })])[0])
      .toEqual({ id: 'item-1', label: 'Product', vialAmountMg: 5, diluentMl: 3 })
  })

  it('imports a mass per volume strength as a concentration-equivalent reference', () => {
    expect(getCalculatorSources([item({ ingredients: [ingredient({ amount_value: 20, basis_value: 2, basis_unit: 'mL' })], reconstitution_ml: 5 })])[0])
      .toEqual({ id: 'item-1', label: 'Product', vialAmountMg: 20, diluentMl: 2 })
  })

  it('prefers current structured mass over frozen legacy mass', () => {
    expect(getCalculatorSources([item({ vial_amount_mg: 999, vial_amount_unit: 'mg' })]))
      .toEqual([{ id: 'item-1', label: 'Product', vialAmountMg: 10, diluentMl: null }])
  })

  it('prefers the current ready-solution reference over frozen legacy concentration', () => {
    expect(getCalculatorSources([item({
      category: 'hormone',
      ingredients: [ingredient({ amount_value: 10, basis_value: 2, basis_unit: 'ml' })],
      vial_amount_mg: 10, vial_amount_unit: 'mg', reconstitution_ml: 5,
    })])).toEqual([{ id: 'item-1', label: 'Product', vialAmountMg: 10, diluentMl: 2 }])
  })

  it('prefers enabled vial inventory dilution over frozen legacy dilution', () => {
    expect(getCalculatorSources([item({ inventory: inventory(), reconstitution_ml: 2 })]))
      .toEqual([{ id: 'item-1', label: 'Product', vialAmountMg: 10, diluentMl: 1.5 }])
  })

  it('preserves a ready-solution reference when inventory also contains dilution', () => {
    expect(getCalculatorSources([item({
      category: 'hormone', inventory: inventory(),
      ingredients: [ingredient({ amount_value: 250, basis_value: 1, basis_unit: 'ml' })],
    })])).toEqual([{ id: 'item-1', label: 'Product', vialAmountMg: 250, diluentMl: 1 }])
  })

  it.each([{ enabled: false }, { package_unit: 'ml' }])('ignores inapplicable inventory dilution %j', overrides => {
    expect(getCalculatorSources([item({ inventory: inventory(overrides), reconstitution_ml: 2 })])[0].diluentMl).toBe(2)
  })

  it.each([null, 0, -1, Infinity, NaN])('falls back from invalid inventory dilution %s', value => {
    expect(getCalculatorSources([item({ inventory: inventory({ reconstitution_ml: value }), reconstitution_ml: 2 })])[0].diluentMl).toBe(2)
    expect(getCalculatorSources([item({ inventory: inventory({ reconstitution_ml: value }) })])[0].diluentMl).toBeNull()
  })

  it('accepts equivalent legacy and structured concentrations using different references', () => {
    expect(getCalculatorSources([item({
      ingredients: [ingredient({ amount_value: 10, basis_value: 2, basis_unit: 'ml' })],
      vial_amount_mg: 20, vial_amount_unit: 'mg', reconstitution_ml: 4,
    })])[0]).toEqual({ id: 'item-1', label: 'Product', vialAmountMg: 10, diluentMl: 2 })
  })

  it('imports a powder vial whose mixing volume has not been entered', () => {
    expect(getCalculatorSources([item({ ingredients: [ingredient({ basis_value: null, basis_unit: 'ml' })] })])[0])
      .toEqual({ id: 'item-1', label: 'Product', vialAmountMg: 10, diluentMl: null })
  })

  it.each(['peptide', 'other'] as const)('uses inventory dilution for a %s powder with unset volume basis', category => {
    expect(getCalculatorSources([item({
      category, inventory: inventory(),
      ingredients: [ingredient({ basis_value: null, basis_unit: 'ml' })],
    })])).toEqual([{ id: 'item-1', label: 'Product', vialAmountMg: 10, diluentMl: 1.5 }])
  })

  it('does not invent a ready-solution concentration from inventory dilution when its basis is absent', () => {
    expect(getCalculatorSources([item({
      category: 'hormone', inventory: inventory(),
      ingredients: [ingredient({ basis_value: null, basis_unit: 'ml' })],
    })])).toEqual([])
  })

  it('imports a unit-aware legacy vial only when no structured ingredients exist', () => {
    expect(getCalculatorSources([item({ ingredients: [], vial_amount_mg: 5000, vial_amount_unit: 'mcg', reconstitution_ml: 2 })]))
      .toEqual([{ id: 'item-1', label: 'Product', vialAmountMg: 5, diluentMl: 2 }])
  })

  it('uses current inventory dilution with a legacy-only mass', () => {
    expect(getCalculatorSources([item({
      ingredients: [], inventory: inventory(),
      vial_amount_mg: 5000, vial_amount_unit: 'mcg', reconstitution_ml: 2,
    })])).toEqual([{ id: 'item-1', label: 'Product', vialAmountMg: 5, diluentMl: 1.5 }])
  })

  it('supports legacy records whose amount unit was not stored', () => {
    expect(getCalculatorSources([item({ ingredients: [], vial_amount_mg: 5 })])[0].vialAmountMg).toBe(5)
  })

  it.each(['IU', '%'])('never falls back to legacy when structured %s is unsupported', unit => {
    expect(getCalculatorSources([item({ ingredients: [ingredient({ amount_unit: unit })], vial_amount_mg: 5, vial_amount_unit: 'mg' })])).toEqual([])
  })

  it.each([0, -1, Infinity, NaN])('rejects invalid strength or basis %s', value => {
    expect(getCalculatorSources([item({ ingredients: [ingredient({ amount_value: value })] })])).toEqual([])
    expect(getCalculatorSources([item({ ingredients: [ingredient({ basis_value: value })] })])).toEqual([])
  })

  it('rejects unsupported basis and absent structured basis', () => {
    expect(getCalculatorSources([item({ ingredients: [ingredient({ basis_unit: 'tablet' })] })])).toEqual([])
    expect(getCalculatorSources([item({ ingredients: [ingredient({ basis_value: null })] })])).toEqual([])
  })

  it.each([null, 0, -1, Infinity, NaN])('preserves missing or invalid diluent %s as null', value => {
    expect(getCalculatorSources([item({ reconstitution_ml: value })])[0].diluentMl).toBeNull()
  })

  it('excludes archived, incomplete, review-required and non-vial records', () => {
    expect(getCalculatorSources([
      item({ archived: true }), item({ configuration_status: 'needs_review' }),
      item({ tracking_level: 'with_amount' }), item({ tracking_level: 'intake_only' }),
      item({ dosage_form: 'tablet' }), item({ dosage_form: 'ampoule' }),
    ])).toEqual([])
  })

  it('exposes each eligible blend ingredient with an explicit label and unique id', () => {
    expect(getCalculatorSources([item({ ingredients: [
      ingredient({ id: 'first', custom_name: 'A', amount_value: 2 }),
      ingredient({ id: 'second', custom_name: 'B', amount_value: 5, position: 1 }),
      ingredient({ id: 'third', custom_name: 'C', amount_unit: 'IU', position: 2 }),
    ] })])).toEqual([
      { id: 'item-1:first', label: 'Product · A', vialAmountMg: 2, diluentMl: null },
      { id: 'item-1:second', label: 'Product · B', vialAmountMg: 5, diluentMl: null },
    ])
  })

  it('rejects legacy IU and invalid legacy mass', () => {
    expect(getCalculatorSources([item({ ingredients: [], vial_amount_mg: 10, vial_amount_unit: 'IU' })])).toEqual([])
    expect(getCalculatorSources([item({ ingredients: [], vial_amount_mg: -1 })])).toEqual([])
  })
})
