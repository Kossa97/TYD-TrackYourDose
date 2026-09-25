import { describe, expect, it } from 'vitest'
import { rechnerVial } from './rechnerVial'

describe('rechnerVial', () => {
  it('prefers the ingredient per vial and the liquid from the stock', () => {
    expect(rechnerVial({
      id: 'a', display_name: 'A', vial_amount_mg: 5, vial_amount_unit: 'mg', reconstitution_ml: 2,
      inventory: { enabled: true, package_unit: 'vial', reconstitution_ml: 1.5 },
      ingredients: [{ amount_value: 10, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial' }],
    })).toEqual({ id: 'a', display_name: 'A', vial_amount_mg: 10, reconstitution_ml: 1.5 })
  })

  it('falls back to the old columns and converts mcg', () => {
    expect(rechnerVial({
      id: 'b', display_name: 'B', vial_amount_mg: 5000, vial_amount_unit: 'mcg', reconstitution_ml: 2, inventory: null, ingredients: [],
    })).toEqual({ id: 'b', display_name: 'B', vial_amount_mg: 5, reconstitution_ml: 2 })
  })

  it('does not guess a blend', () => {
    expect(rechnerVial({
      id: 'c', display_name: 'C', vial_amount_mg: null, reconstitution_ml: null,
      ingredients: [
        { amount_value: 10, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial' },
        { amount_value: 5, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial' },
      ],
    }).vial_amount_mg).toBeNull()
  })
})
