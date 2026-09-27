import { expect, it } from 'vitest'
import { calculateReconstitution } from './reconstitution'

it('rejects a target that would overflow the number of portions', () => {
  expect(() => calculateReconstitution({ vialAmountMg: 5, diluentMl: 2, targetDose: 1e-307, targetUnit: 'mcg', syringeCapacityMl: 1, syringeUnits: 100 })).toThrow('numeric_range')
})

it('accepts an exactly full syringe despite floating-point division noise', () => {
  const input = { vialAmountMg: 0.5, diluentMl: 3, targetDose: 50, targetUnit: 'mcg' as const, syringeCapacityMl: 0.3, syringeUnits: 30 }
  expect(calculateReconstitution(input).drawMl).toBe(0.3)
  expect(calculateReconstitution(input).drawUnits).toBe(30)
  expect(() => calculateReconstitution({ ...input, targetDose: 50.000001 })).toThrow('target_exceeds_syringe_capacity')
})

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
