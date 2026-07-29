import { describe, expect, it } from 'vitest'
import { formatTrackedQuantity, hasTrackedQuantity } from './quantityPresentation'

describe('formatTrackedQuantity', () => {
  it('returns the supplied fallback when quantity is unknown', () => {
    expect(formatTrackedQuantity(null, null, 'Menge nicht getrackt')).toBe('Menge nicht getrackt')
  })

  it('returns the supplied fallback when the unit is blank', () => {
    expect(formatTrackedQuantity(0.5, ' ', 'Menge nicht getrackt')).toBe('Menge nicht getrackt')
  })

  it('preserves the supplied unit label when formatting half a tablet', () => {
    expect(formatTrackedQuantity(0.5, 'tablet', 'Menge nicht getrackt')).toBe('\u00BD tablet')
    expect(formatTrackedQuantity(0.5, 'Tablette', 'Menge nicht getrackt')).toBe('\u00BD Tablette')
  })

  it('formats thirds and quarters for countable units', () => {
    expect(formatTrackedQuantity(0.333333, 'tablet', 'Menge nicht getrackt')).toBe('\u2153 tablet')
    expect(formatTrackedQuantity(0.25, 'tablet', 'Menge nicht getrackt')).toBe('\u00BC tablet')
  })

  it('keeps up to three decimal places without trailing zeroes', () => {
    expect(formatTrackedQuantity(1.2, 'mg', 'Menge nicht getrackt')).toBe('1.2 mg')
    expect(formatTrackedQuantity(1.23456, 'mg', 'Menge nicht getrackt')).toBe('1.235 mg')
  })
})

describe('hasTrackedQuantity', () => {
  it.each([
    [{ dose: null, unit: 'mcg' }, false],
    [{ dose: 100, unit: null }, false],
    [{ dose: 100, unit: '' }, false],
    [{ dose: 100, unit: ' ' }, false],
    [{ dose: 0, unit: 'mcg' }, true],
  ])('identifies whether a quantity can be used for stock tracking', (quantity, expected) => {
    expect(hasTrackedQuantity(quantity)).toBe(expected)
  })
})
