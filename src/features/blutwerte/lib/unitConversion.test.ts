import { describe, expect, it } from 'vitest'
import { canConvert, convert, normalizeUnitString } from './unitConversion'

describe('normalizeUnitString', () => {
  it('vereinheitlicht Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(normalizeUnitString('  NG/DL ')).toBe('ng/dl')
  })

  it('vereinheitlicht Mikro-Schreibweisen (µ, u, mc)', () => {
    expect(normalizeUnitString('µg/l')).toBe(normalizeUnitString('ug/l'))
    expect(normalizeUnitString('mcg/l')).toBe(normalizeUnitString('µg/l'))
  })
})

describe('convert', () => {
  it('gibt den Wert unverändert zurück, wenn Einheiten gleich sind', () => {
    expect(convert(500, 'ng/dL', 'ng/dL')).toBe(500)
  })

  it('behandelt gleiche Einheiten auch bei unbekannter Einheit als identisch', () => {
    expect(convert(7, 'U/L', 'U/L')).toBe(7)
    expect(convert(7, 'u/l', 'U/L')).toBe(7)
  })

  it('rechnet den realen Testosteron-Fall korrekt um (µg/l -> ng/dL)', () => {
    expect(convert(13.1, 'µg/l', 'ng/dL')).toBeCloseTo(1310, 6)
  })

  it('rechnet zurück (ng/dL -> µg/l)', () => {
    expect(convert(612, 'ng/dL', 'µg/l')).toBeCloseTo(6.12, 6)
  })

  it('rechnet ng/mL und µg/l als gleich (1:1)', () => {
    expect(convert(5, 'ng/mL', 'µg/l')).toBeCloseTo(5, 6)
  })

  it('rechnet pg/mL -> ng/mL', () => {
    expect(convert(1000, 'pg/mL', 'ng/mL')).toBeCloseTo(1, 6)
  })

  it('rechnet µg/dL -> ng/mL', () => {
    expect(convert(1, 'µg/dL', 'ng/mL')).toBeCloseTo(10, 6)
  })

  it('rechnet mg/L -> ng/mL', () => {
    expect(convert(1, 'mg/L', 'ng/mL')).toBeCloseTo(1000, 6)
  })

  it('rechnet mg/dL -> ng/mL', () => {
    expect(convert(1, 'mg/dL', 'ng/mL')).toBeCloseTo(10000, 6)
  })

  it('ist über einen Roundtrip stabil', () => {
    const there = convert(738, 'ng/dL', 'µg/l')!
    expect(convert(there, 'µg/l', 'ng/dL')).toBeCloseTo(738, 6)
  })

  it('gibt null für molare Einheiten zurück (kein Raten ohne Molekulargewicht)', () => {
    expect(convert(21, 'nmol/L', 'ng/dL')).toBeNull()
    expect(convert(500, 'ng/dL', 'nmol/L')).toBeNull()
  })

  it('gibt null für unbekannte oder inkompatible Einheiten zurück', () => {
    expect(convert(5, 'U/L', 'ng/dL')).toBeNull()
    expect(convert(5, '%', 'ng/mL')).toBeNull()
    expect(convert(5, 'ng/dL', '')).toBeNull()
  })

  it('gibt null bei nicht-endlichem Wert zurück', () => {
    expect(convert(Number.NaN, 'ng/dL', 'µg/l')).toBeNull()
  })
})

describe('canConvert', () => {
  it('ist true für gleiche Einheiten', () => {
    expect(canConvert('U/L', 'U/L')).toBe(true)
  })

  it('ist true für kompatible Masse-Einheiten', () => {
    expect(canConvert('ng/dL', 'µg/l')).toBe(true)
  })

  it('ist false für molare oder unbekannte Einheiten', () => {
    expect(canConvert('nmol/L', 'ng/dL')).toBe(false)
    expect(canConvert('U/L', 'ng/dL')).toBe(false)
  })
})
