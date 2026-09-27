import { describe, expect, it } from 'vitest'
import { convertMass, convertSyringe, convertVolume, formatCalculatorNumber, parseDecimalInput } from './units'
import type { MassUnit, VolumeUnit } from './units'

describe('mass and volume conversion', () => {
  it('converts known mass values without limiting scalar magnitude', () => {
    expect(convertMass(1, 'g', 'mg')).toBe(1000)
    expect(convertMass(0.25, 'mg', 'mcg')).toBe(250)
    expect(convertMass(500, 'mcg', 'mg')).toBe(0.5)
    expect(convertMass(1000000, 'g', 'mcg')).toBe(1e12)
    expect(convertMass(Number.MAX_VALUE, 'g', 'g')).toBe(Number.MAX_VALUE)
    expect(convertMass(0, 'g', 'mcg')).toBe(0)
  })
  it('converts known volume values and round trips', () => {
    expect(convertVolume(0.1, 'ml', 'ul')).toBe(100)
    expect(convertVolume(250, 'ul', 'ml')).toBe(0.25)
    expect(convertVolume(convertVolume(0.3, 'ml', 'ul'), 'ul', 'ml')).toBeCloseTo(0.3)
    expect(convertVolume(0, 'ml', 'ul')).toBe(0)
    expect(convertVolume(convertVolume(4e-7, 'ml', 'ul'), 'ul', 'ml')).toBeCloseTo(4e-7, 15)
    expect(convertMass(convertMass(4e-7, 'mg', 'mcg'), 'mcg', 'mg')).toBeCloseTo(4e-7, 15)
  })
  it.each([-1, NaN, Infinity, -Infinity])('rejects invalid scalar %s', value => {
    expect(() => convertMass(value, 'mg', 'mcg')).toThrow()
    expect(() => convertVolume(value, 'ml', 'ul')).toThrow()
  })
  it('rejects unknown units and numeric overflow', () => {
    expect(() => convertMass(1, 'IU' as MassUnit, 'mg')).toThrow()
    expect(() => convertMass(1, 'mg', 'unknown' as MassUnit)).toThrow()
    expect(() => convertVolume(1, 'l' as VolumeUnit, 'ml')).toThrow()
    expect(() => convertVolume(1, 'ml', 'unknown' as VolumeUnit)).toThrow()
    expect(() => convertMass(Number.MAX_VALUE, 'g', 'mcg')).toThrow()
    expect(() => convertVolume(Number.MAX_VALUE, 'ml', 'ul')).toThrow()
  })
})

describe('syringe conversion', () => {
  it.each([[1, 100, 10], [0.5, 50, 10], [0.3, 30, 10], [2, 200, 10], [1, 40, 4]])(
    'uses actual capacity %s ml / %s units', (ml, units, expected) => {
      const drawUnits = convertSyringe(0.1, 'ml-to-units', ml, units)
      expect(drawUnits).toBeCloseTo(expected)
      expect(convertSyringe(drawUnits, 'units-to-ml', ml, units)).toBeCloseTo(0.1)
      expect(convertSyringe(0, 'ml-to-units', ml, units)).toBe(0)
    },
  )
  it.each([0, -1, NaN, Infinity])('rejects invalid syringe configuration %s', value => {
    expect(() => convertSyringe(1, 'ml-to-units', value, 100)).toThrow()
    expect(() => convertSyringe(1, 'units-to-ml', 1, value)).toThrow()
  })
  it('rejects invalid values, unknown direction and numeric overflow', () => {
    expect(() => convertSyringe(-1, 'ml-to-units', 1, 100)).toThrow()
    expect(() => convertSyringe(NaN, 'ml-to-units', 1, 100)).toThrow()
    expect(() => convertSyringe(1, 'other' as 'ml-to-units', 1, 100)).toThrow()
    expect(() => convertSyringe(Number.MAX_VALUE, 'ml-to-units', 1, 100)).toThrow()
  })
  it('converts scalar amounts above capacity and tiny positive volumes', () => {
    expect(convertSyringe(2, 'ml-to-units', 1, 100)).toBe(200)
    const tinyUnits = convertSyringe(4e-7, 'ml-to-units', 0.3, 30)
    expect(tinyUnits).toBeCloseTo(4e-5, 15)
    expect(convertSyringe(tinyUnits, 'units-to-ml', 0.3, 30)).toBeCloseTo(4e-7, 15)
  })
})

describe('decimal input', () => {
  it.each([['2,5', 2.5], ['2.5', 2.5], ['  -0,25  ', -0.25], ['+3', 3], ['.5', 0.5], [',5', 0.5], ['1e-3', 0.001], ['0', 0]])(
    'parses %s', (input, expected) => expect(parseDecimalInput(input)).toBe(expected),
  )
  it.each(['', '  ', '1.000,5', '1,000.5', '2 mg', '1.2.3', 'Infinity', 'NaN', '1e309', '-', '1 000']) (
    'rejects incomplete or malformed input %s', input => expect(parseDecimalInput(input)).toBeNull(),
  )
})

describe('calculator formatting', () => {
  it('formats with meaningful precision and localized decimals', () => {
    expect(formatCalculatorNumber(0.1, 'de')).toBe('0,1')
    expect(formatCalculatorNumber(0.1, 'en')).toBe('0.1')
    expect(formatCalculatorNumber(100, 'de')).toBe('100')
    expect(formatCalculatorNumber(0, 'de')).toBe('0')
    expect(formatCalculatorNumber(1 / 3, 'de')).toBe('0,333333')
  })
  it('preserves positive tiny values instead of displaying zero', () => {
    expect(formatCalculatorNumber(0.0000004, 'de')).toBe('0,0000004')
    expect(formatCalculatorNumber(Number.MIN_VALUE, 'de')).not.toBe('0')
  })
})
