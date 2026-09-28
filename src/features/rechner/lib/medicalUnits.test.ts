import { describe, expect, it } from 'vitest'
import { MARKER_CATALOG } from '../../blutwerte/lib/markerCatalog'
import { compatibleUnits, convertMedicalUnit, defaultMarkerUnit, unitsForMarker } from './medicalUnits'

const targets = (from: string, marker = '') => compatibleUnits(from, marker).map(unit => unit.id)

describe('medical unit compatibility', () => {
  it('keeps quantities, concentrations, activity and syringe scales separate', () => {
    expect(targets('mg')).toContain('mcg')
    expect(targets('mg')).not.toContain('mL')
    expect(targets('mg/dL')).toContain('g/L')
    expect(targets('mg/dL')).not.toContain('mmol/L')
    expect(targets('IU')).not.toContain('mg')
    expect(targets('IU/L')).not.toContain('U/L')
    expect(targets('scale')).toContain('mL')
    expect(targets('scale')).not.toContain('IU')
    expect(targets('scale')).not.toContain('mg')
  })

  it('only allows mass-to-molar conversions for a supported blood marker', () => {
    expect(targets('mg/dL', 'Glukose')).toContain('mmol/L')
    for (const marker of ['', 'Lipoprotein (a)', 'Prolaktin', 'Insulin', 'unknown']) {
      expect(() => convertMedicalUnit(100, 'mg/dL', 'mmol/L', marker)).toThrow()
    }
    expect(targets('µIU/mL', 'Insulin')).not.toContain('pmol/L')
    expect(targets('mg/dL', 'Glukose')).not.toContain('IU/L')
  })

  it('covers every dimensional blood marker already offered by the app', () => {
    for (const marker of MARKER_CATALOG.filter(marker => marker.einheit)) {
      const unit = defaultMarkerUnit(marker.name)
      expect(unitsForMarker(marker.name).map(unit => unit.id), marker.name).toContain(unit)
      expect(targets(unit, marker.name).filter(target => target !== unit).length, marker.name).toBeGreaterThan(0)
    }
  })
})

describe('medical unit calculations', () => {
  it.each([
    [2.5, 'mg', 'mcg', '', 2500],
    [0.25, 'mL', 'µL', '', 250],
    [90, 'fL', 'pL', 'MCV', 0.09],
    [14, 'g/dL', 'g/L', 'Hämoglobin', 140],
    [5, 'Mio/µL', '10^12/L', 'Erythrozyten', 5],
    [4.5, '/nL', '/µL', 'Leukozyten', 4500],
    [60, 'U/L', 'µkat/L', 'GPT (ALT)', 1],
    [3, 'µIU/mL', 'mIU/L', 'TSH', 3],
    [20, 'mIU/mL', 'IU/L', 'LH', 20],
    [45, '%', 'fraction', 'Hämatokrit', 0.45],
    [90, 'mL/min/1.73m²', 'mL/s/1.73m²', 'eGFR', 1.5],
    [100, 'mg/dL', 'mmol/L', 'Glukose', 5.55],
    [200, 'mg/dL', 'mmol/L', 'Cholesterin gesamt', 5.18],
    [100, 'mg/dL', 'mmol/L', 'Triglyceride', 1.13],
    [1, 'mg/dL', 'µmol/L', 'Kreatinin', 88.4],
    [500, 'ng/dL', 'nmol/L', 'Testosteron', 17.35],
    [100, 'pg/mL', 'pmol/L', 'Freies Testosteron', 346.72],
    [100, 'pg/mL', 'pmol/L', 'Östradiol', 367.1],
    [1, 'ng/dL', 'pmol/L', 'fT4', 12.87],
    [30, 'ng/mL', 'nmol/L', 'Vitamin D', 74.88],
    [500, 'pg/mL', 'pmol/L', 'Vitamin B12', 369],
  ])('%s %s → %s (%s)', (value, from, to, marker, expected) => {
    expect(convertMedicalUnit(value, from, to, marker)).toBeCloseTo(expected, 8)
    expect(convertMedicalUnit(expected, to, from, marker)).toBeCloseTo(value, 8)
  })

  it('uses the HbA1c master equation rather than treating it as a fraction', () => {
    expect(convertMedicalUnit(7, 'hba1c-percent', 'hba1c-mmol')).toBeCloseTo(53, 1)
    expect(convertMedicalUnit(53, 'hba1c-mmol', 'hba1c-percent')).toBeCloseTo(7, 2)
    expect(targets('%')).not.toContain('hba1c-mmol')
    expect(() => convertMedicalUnit(1, 'hba1c-percent', 'hba1c-mmol')).toThrow()
  })

  it('rejects invalid, incompatible, overflowing and underflowing results', () => {
    for (const value of [-1, NaN, Infinity]) expect(() => convertMedicalUnit(value, 'mg', 'mcg')).toThrow()
    expect(() => convertMedicalUnit(1, 'mg', 'mL')).toThrow()
    expect(() => convertMedicalUnit(1, 'bogus', 'mg')).toThrow()
    expect(() => convertMedicalUnit(1e308, 'g', 'pg')).toThrow()
    expect(() => convertMedicalUnit(Number.MIN_VALUE, 'pg', 'g')).toThrow()
    expect(convertMedicalUnit(0, 'mg', 'mcg')).toBe(0)
  })
})
