import { expect, it } from 'vitest'
import { calculateReconstitution } from './reconstitution'

const valid = { vialAmountMg: 5, diluentMl: 2, targetDose: 250, targetUnit: 'mcg' as const, syringeCapacityMl: 1, syringeUnits: 100 }
it('normalizes mass and calculates volume and scale units', () => {
  expect(calculateReconstitution(valid)).toEqual({ concentrationMcgPerMl: 2500, drawMl: 0.1, drawUnits: 10, dosesPerVial: 20 })
  expect(calculateReconstitution({ ...valid, targetUnit: 'mg', targetDose: 0.25 }).drawMl).toBe(0.1)
})
it.each([0, -1, NaN, Infinity])('rejects invalid values %s', value => {
  for (const field of ['vialAmountMg', 'diluentMl', 'targetDose', 'syringeCapacityMl', 'syringeUnits']) {
    expect(() => calculateReconstitution({ ...valid, [field]: value })).toThrow(field)
  }
})
it('rejects unsupported units and impossible draws', () => {
  expect(() => calculateReconstitution({ ...valid, targetUnit: 'IU' as 'mg' })).toThrow('targetUnit')
  expect(() => calculateReconstitution({ ...valid, targetDose: 3000 })).toThrow('target_exceeds_syringe_capacity')
  expect(() => calculateReconstitution({ ...valid, targetDose: 6000, syringeCapacityMl: 3 })).toThrow('target_exceeds_vial')
})
