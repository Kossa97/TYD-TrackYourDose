import { describe, expect, it } from 'vitest'
import { inventoryDeltaForDose } from './inventoryMath'

describe('inventoryDeltaForDose', () => {
  it('converts an ingredient dose to product basis units', () => {
    expect(inventoryDeltaForDose({
      dose: 5000,
      doseUnit: 'IU',
      amountValue: 5000,
      amountUnit: 'IU',
      basisValue: 1,
      basisUnit: 'capsule',
    })).toBe(1)
  })

  it('uses direct countable dose units', () => {
    expect(inventoryDeltaForDose({
      dose: 2,
      doseUnit: 'tablet',
      amountValue: 10,
      amountUnit: 'mg',
      basisValue: 2,
      basisUnit: 'tablet',
    })).toBe(2)
  })

  it('converts mg to mcg without converting IU to mass', () => {
    expect(inventoryDeltaForDose({
      dose: 0.5,
      doseUnit: 'mg',
      amountValue: 500,
      amountUnit: 'mcg',
      basisValue: 1,
      basisUnit: 'capsule',
    })).toBe(1)
    expect(inventoryDeltaForDose({
      dose: 5000,
      doseUnit: 'IU',
      amountValue: 5,
      amountUnit: 'mg',
      basisValue: 1,
      basisUnit: 'capsule',
    })).toBeNull()
  })

  it('returns null instead of guessing incompatible units', () => {
    expect(inventoryDeltaForDose({
      dose: 10,
      doseUnit: 'ml',
      amountValue: 5000,
      amountUnit: 'IU',
      basisValue: 1,
      basisUnit: 'capsule',
    })).toBeNull()
  })

  it('returns null when multiple ingredients imply different product quantities', () => {
    expect(inventoryDeltaForDose({
      dose: 10,
      doseUnit: 'mg',
      ingredients: [{
        amountValue: 10,
        amountUnit: 'mg',
        basisValue: 1,
        basisUnit: 'tablet',
      }, {
        amountValue: 5,
        amountUnit: 'mg',
        basisValue: 1,
        basisUnit: 'tablet',
      }],
    })).toBeNull()
  })
})
