import { describe, expect, it } from 'vitest'
import { calculateLiquid, convertLiquidValue, type LiquidValues } from './liquidCalculation'

const values = (overrides: Partial<LiquidValues> = {}): LiquidValues => ({
  mode: 'amount', amount: '5', volume: '2', concentration: '', container: '',
  target: '250', frequency: '', sourceUnit: 'mg', targetUnit: 'mcg', capacityMl: '1', capacityUnits: '100',
  ...overrides,
})

describe('liquid calculation', () => {
  it('uses final total volume to calculate a draw and complete withdrawals', () => {
    expect(calculateLiquid(values({ frequency: '5' }))).toEqual({
      concentration: 2.5, drawMl: 0.1, drawUnits: 10, fullWithdrawals: 20, days: 28,
      error: null, fieldErrors: {}, concentrationError: false,
    })
  })

  it.each([
    { sourceUnit: 'g', amount: '0,005', targetUnit: 'mg', target: '0,25' },
    { sourceUnit: 'mcg', amount: '5e3', targetUnit: 'g', target: '0.00025' },
  ] as const)('normalizes source $sourceUnit and target $targetUnit to mg', input => {
    expect(calculateLiquid(values(input))).toMatchObject({ concentration: 2.5, drawMl: 0.1, drawUnits: 10 })
  })

  it('calculates an IU draw using only an IU source', () => {
    expect(calculateLiquid(values({ sourceUnit: 'iu', amount: '5000', targetUnit: 'iu', target: '250' })))
      .toMatchObject({ concentration: 2500, drawMl: 0.1, drawUnits: 10, fullWithdrawals: 20, error: null })
  })

  it.each([
    { sourceUnit: 'iu', targetUnit: 'mg' },
    { sourceUnit: 'mg', targetUnit: 'iu' },
  ] as const)('rejects $sourceUnit to $targetUnit', units => {
    expect(calculateLiquid(values(units))).toMatchObject({ drawMl: null, drawUnits: null, error: 'incompatible_units' })
  })

  it('accepts a known concentration without requiring a container', () => {
    expect(calculateLiquid(values({ mode: 'concentration', concentration: '2500', sourceUnit: 'mcg' })))
      .toMatchObject({ concentration: 2.5, drawMl: 0.1, drawUnits: 10, fullWithdrawals: null, days: null, error: null })
  })

  it('counts only complete withdrawals and derives days from weekly frequency', () => {
    expect(calculateLiquid(values({ mode: 'concentration', concentration: '2', container: '1', target: '300', frequency: '3,5' })))
      .toMatchObject({ drawMl: 0.15, fullWithdrawals: 6, days: 12 })
  })

  it('does not lose a withdrawal to floating point division', () => {
    expect(calculateLiquid(values({ targetUnit: 'ml', target: '0.1', volume: '0.3' })).fullWithdrawals).toBe(3)
  })

  it('does not round a genuine fractional withdrawal up at large magnitudes', () => {
    expect(calculateLiquid(values({ targetUnit: 'ml', target: '1', volume: '1000000000000000.5' })).fullWithdrawals)
      .toBe(1000000000000000)
  })

  it('uses the selected syringe capacity and scale', () => {
    expect(calculateLiquid(values({ capacityMl: '0.5', capacityUnits: '20' })))
      .toMatchObject({ drawMl: 0.1, drawUnits: 4 })
  })

  it.each(['amount', 'volume', 'target', 'capacityMl', 'capacityUnits'] as const)('keeps missing required %s quiet', field => {
    expect(calculateLiquid(values({ [field]: ' ' }))).toMatchObject({ drawMl: null, drawUnits: null, error: null, fieldErrors: {} })
  })

  it('requires the known concentration for a mass target', () => {
    expect(calculateLiquid(values({ mode: 'concentration' }))).toMatchObject({ drawMl: null, error: null })
  })

  it.each(['0', '-1', 'words', '1.2.3'])('rejects invalid target %s', target => {
    expect(calculateLiquid(values({ target }))).toMatchObject({ drawMl: null, error: 'positive', fieldErrors: { target: 'positive' } })
  })

  it.each(['1e309', '1e-999'])('reports numeric range for target %s', target => {
    expect(calculateLiquid(values({ target }))).toMatchObject({ drawMl: null, error: 'numeric_range', fieldErrors: { target: 'numeric_range' } })
  })

  it('allows a direct mL draw without concentration inputs', () => {
    expect(calculateLiquid(values({ amount: '', volume: '', targetUnit: 'ml', target: '0,2' })))
      .toMatchObject({ concentration: null, drawMl: 0.2, drawUnits: 20, fullWithdrawals: null, error: null, fieldErrors: {} })
  })

  it('keeps an invalid source visible without blocking a direct mL draw', () => {
    expect(calculateLiquid(values({ amount: '-5', targetUnit: 'ml', target: '0.2' })))
      .toMatchObject({ concentration: null, concentrationError: true, drawMl: 0.2, fullWithdrawals: 10, error: null, fieldErrors: { amount: 'positive' } })
  })

  it('keeps optional errors separate from a valid draw', () => {
    expect(calculateLiquid(values({ mode: 'concentration', concentration: '2.5', container: '-2', frequency: 'no' })))
      .toMatchObject({ drawMl: 0.1, drawUnits: 10, fullWithdrawals: null, days: null, error: null, fieldErrors: { container: 'positive', frequency: 'positive' } })
  })

  it('ignores inputs belonging to the other source mode', () => {
    expect(calculateLiquid(values({ mode: 'concentration', concentration: '2.5', amount: '-1', volume: '-1' })))
      .toMatchObject({ drawMl: 0.1, error: null, fieldErrors: {} })
  })

  it.each([
    { mode: 'amount', volume: '0.1' },
    { mode: 'concentration', concentration: '2.5', container: '0.1' },
  ] as const)('limits direct mL to the supplied container in $mode mode', input => {
    expect(calculateLiquid(values({ ...input, targetUnit: 'ml', target: '0.2' })))
      .toMatchObject({ drawMl: null, drawUnits: null, error: 'exceeds_container' })
  })

  it('rejects a draw above the syringe capacity', () => {
    expect(calculateLiquid(values({ targetUnit: 'ml', target: '1.01' })))
      .toMatchObject({ drawMl: null, error: 'exceeds_syringe' })
  })

  it('accepts floating point noise at the capacity boundary', () => {
    expect(calculateLiquid(values({ targetUnit: 'ml', target: '0.30000000000000004', volume: '0.3', capacityMl: '0.3', capacityUnits: '30' })))
      .toMatchObject({ error: null, fullWithdrawals: 1 })
  })

  it('does not allow a tiny draw to exceed a much smaller syringe', () => {
    expect(calculateLiquid(values({ targetUnit: 'ml', target: '1e-15', capacityMl: '1e-20' })))
      .toMatchObject({ drawMl: null, error: 'exceeds_syringe' })
  })

  it.each([
    { amount: '1e300', volume: '1e-100' },
    { amount: '1e-300', volume: '1e100' },
  ])('rejects unrepresentable concentration %#', source => {
    expect(calculateLiquid(values(source))).toMatchObject({ concentration: null, concentrationError: true, drawMl: null, error: 'numeric_range' })
  })

  it('preserves direct mL draws when source arithmetic overflows', () => {
    expect(calculateLiquid(values({ amount: '1e300', volume: '1e-100', targetUnit: 'ml', target: '1e-101' })))
      .toMatchObject({ concentration: null, concentrationError: true, drawMl: 1e-101, error: null })
  })

  it('rejects a converted target that underflows', () => {
    expect(calculateLiquid(values({ target: '5e-324', targetUnit: 'mcg' })))
      .toMatchObject({ drawMl: null, error: 'numeric_range' })
  })

  it('retains finite results when an intermediate multiplication could overflow', () => {
    expect(calculateLiquid(values({ amount: '1e308', sourceUnit: 'g', volume: '1e308', target: '1', targetUnit: 'mg' })))
      .toMatchObject({ concentration: 1000, drawMl: 0.001, drawUnits: 0.1, error: null })
  })

  it('omits a withdrawal count outside safe integer range', () => {
    expect(calculateLiquid(values({ targetUnit: 'ml', target: '1e-20' })))
      .toMatchObject({ drawMl: 1e-20, fullWithdrawals: null, days: null, error: null })
  })

  it('omits overflow in optional days without losing the draw or count', () => {
    expect(calculateLiquid(values({ frequency: '5e-324' })))
      .toMatchObject({ drawMl: 0.1, fullWithdrawals: 20, days: null, error: null })
  })
})

describe('liquid quantity conversion for unit changes', () => {
  it.each([
    [250, 'mcg', 'mg', null, 0.25],
    [0.005, 'g', 'mcg', null, 5000],
    [250, 'iu', 'iu', null, 250],
    [0.1, 'ml', 'ml', null, 0.1],
    [250, 'mcg', 'ml', 2.5, 0.1],
    [0.1, 'ml', 'mcg', 2.5, 250],
    [0.1, 'ml', 'iu', 2500, 250],
    [250, 'iu', 'ml', 2500, 0.1],
  ] as const)('preserves %s %s when changed to %s', (value, from, to, concentration, expected) => {
    expect(convertLiquidValue(value, from, to, concentration)).toBe(expected)
  })

  it.each([
    [1, 'iu', 'mg', 2.5],
    [1, 'mg', 'iu', 2.5],
    [1, 'mg', 'ml', null],
    [1, 'ml', 'g', 0],
    [1, 'ml', 'g', Infinity],
    [-1, 'mg', 'mcg', null],
    [Infinity, 'mg', 'mg', null],
    [Number.MAX_VALUE, 'g', 'mg', null],
    [Number.MIN_VALUE, 'mcg', 'mg', null],
  ] as const)('rejects an incompatible or unrepresentable conversion %#', (value, from, to, concentration) => {
    expect(convertLiquidValue(value, from, to, concentration)).toBeNull()
  })
})
