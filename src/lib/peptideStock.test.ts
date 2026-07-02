// src/lib/peptideStock.test.ts
import { describe, expect, it } from 'vitest'
import { computeNextVialStock, doseToVialDelta, type StockPeptide } from './peptideStock'

const peptide = (overrides: Partial<StockPeptide> = {}): StockPeptide => ({
  vial_amount_mg: 10,
  reconstitution_ml: 2,
  reconstitution_date: null,
  vials_in_stock: 1,
  vials_initial: 1,
  ...overrides,
})

describe('doseToVialDelta', () => {
  it('converts mcg against the vial mg amount', () => {
    // 250 mcg = 0.25 mg of a 10 mg vial → 0.025 vials
    expect(doseToVialDelta(250, 'mcg', peptide())).toBeCloseTo(0.025, 6)
  })

  it('converts mg directly', () => {
    expect(doseToVialDelta(5, 'mg', peptide({ vial_amount_mg: 10 }))).toBeCloseTo(0.5, 6)
  })

  it('uses reconstitution volume for ml doses', () => {
    expect(doseToVialDelta(0.5, 'ml', peptide({ reconstitution_ml: 2 }))).toBeCloseTo(0.25, 6)
  })

  it('returns null for unknown unit or missing vial data', () => {
    expect(doseToVialDelta(1, 'IU', peptide())).toBeNull()
    expect(doseToVialDelta(1, 'mg', peptide({ vial_amount_mg: null }))).toBeNull()
    expect(doseToVialDelta(1, 'ml', peptide({ reconstitution_ml: 0 }))).toBeNull()
  })
})

describe('computeNextVialStock', () => {
  it('debits the delta and never drops below zero', () => {
    expect(computeNextVialStock(peptide({ vials_in_stock: 1 }), 250, 'mcg', 'debit')).toBe(0.975)
    expect(computeNextVialStock(peptide({ vials_in_stock: 0.01 }), 5, 'mg', 'debit')).toBe(0)
  })

  it('credits back, capped at the initial count', () => {
    expect(computeNextVialStock(peptide({ vials_in_stock: 0.5, vials_initial: 1 }), 5, 'mg', 'credit')).toBe(1)
    expect(computeNextVialStock(peptide({ vials_in_stock: 0.5, vials_initial: 0 }), 5, 'mg', 'credit')).toBe(1)
  })

  it('does not credit a dose logged before the current reconstitution', () => {
    const p = peptide({ vials_in_stock: 0.5, reconstitution_date: '2026-06-10T00:00:00.000Z' })
    expect(computeNextVialStock(p, 5, 'mg', 'credit', '2026-06-09T08:00:00.000Z')).toBeNull()
    expect(computeNextVialStock(p, 5, 'mg', 'credit', '2026-06-11T08:00:00.000Z')).toBe(1)
  })

  it('returns null when the delta is unknown', () => {
    expect(computeNextVialStock(peptide(), 1, 'IU', 'debit')).toBeNull()
  })
})
