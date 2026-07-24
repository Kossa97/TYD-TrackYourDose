import { describe, expect, it } from 'vitest'
import {
  buildLegacyStackItemSave,
  toLegacyPeptideRow,
  type LegacyPeptidePayload,
} from './legacyMyStackPersistence'

const payload: LegacyPeptidePayload = {
  name: 'BPC-157',
  default_unit: 'mcg',
  default_dose: null,
  default_method: 'Subkutan',
  vial_amount_mg: 10,
  vial_amount_unit: 'mg',
  reconstitution_ml: 2,
  syringe_type: '1:100',
  notes: 'Abends',
  vials_in_stock: 0.75,
  vials_initial: 1,
  reconstitution_date: '2026-07-24',
  expiry_days: 28,
  batch_number: 'LOT-42',
  batch_source: 'Labor',
  batch_file_url: null,
  inventory_item_id: 'inventory-1',
  pk_profile_id: 'profile-1',
}

describe('buildLegacyStackItemSave', () => {
  it('translates the old peptide form into the new atomic stack contract', () => {
    expect(buildLegacyStackItemSave(payload, null, '#06B6D4')).toEqual({
      rpc: {
        p_item: {
          id: null,
          display_name: 'BPC-157',
          category: 'peptide',
          dosage_form: 'vial',
          brand: null,
          color_hex: '#06B6D4',
          notes: 'Abends',
        },
        p_ingredients: [{
          catalog_substance_id: null,
          custom_name: 'BPC-157',
          amount_value: 10,
          amount_unit: 'mg',
          basis_value: 1,
          basis_unit: 'vial',
          position: 0,
        }],
      },
      tracking: {
        default_unit: 'mcg',
        default_dose: null,
        default_method: 'Subkutan',
        vial_amount_mg: 10,
        vial_amount_unit: 'mg',
        reconstitution_ml: 2,
        syringe_type: '1:100',
        notes: 'Abends',
        vials_in_stock: 0.75,
        vials_initial: 1,
        reconstitution_date: '2026-07-24',
        expiry_days: 28,
        batch_number: 'LOT-42',
        batch_source: 'Labor',
        batch_file_url: null,
        inventory_item_id: 'inventory-1',
        pk_profile_id: 'profile-1',
      },
    })
  })

  it('preserves the old optional-strength behavior as a reviewable ingredient', () => {
    const result = buildLegacyStackItemSave({
      ...payload,
      vial_amount_mg: null,
      vial_amount_unit: null,
    }, 'stack-item-1', '')

    expect(result.rpc.p_item.id).toBe('stack-item-1')
    expect(result.rpc.p_item.color_hex).toBeNull()
    expect(result.rpc.p_ingredients[0]).toMatchObject({
      amount_value: null,
      amount_unit: null,
    })
  })
})

describe('toLegacyPeptideRow', () => {
  it('exposes display_name under the name expected by the old UI', () => {
    expect(toLegacyPeptideRow({
      id: 'stack-item-1',
      display_name: 'BPC-157',
      archived: false,
    })).toEqual({
      id: 'stack-item-1',
      display_name: 'BPC-157',
      name: 'BPC-157',
      archived: false,
    })
  })
})
