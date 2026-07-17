import { describe, expect, it } from 'vitest'
import { parseExtractResult } from './extractResult'

const gueltig = {
  tested_at: '2026-07-10',
  lab_name: 'Labor XY',
  values: [
    { marker: 'Testosteron', matched: true, value: 620, unit: 'ng/dL', ref_min: 300, ref_max: 1000 },
  ],
}

describe('parseExtractResult', () => {
  it('akzeptiert ein gültiges Ergebnis', () => {
    expect(parseExtractResult(gueltig)).toEqual(gueltig)
  })

  it('lehnt Nicht-Objekte ab', () => {
    expect(parseExtractResult(null)).toBeNull()
    expect(parseExtractResult('text')).toBeNull()
    expect(parseExtractResult([])).toBeNull()
  })

  it('lehnt ein fehlendes oder falsch formatiertes Datum ab', () => {
    expect(parseExtractResult({ ...gueltig, tested_at: '10.07.2026' })).toBeNull()
    expect(parseExtractResult({ ...gueltig, tested_at: undefined })).toBeNull()
  })

  it('akzeptiert ein fehlendes Labor als null', () => {
    expect(parseExtractResult({ ...gueltig, lab_name: undefined })?.lab_name).toBeNull()
  })

  it('lehnt ein fehlendes values-Array ab', () => {
    expect(parseExtractResult({ ...gueltig, values: undefined })).toBeNull()
  })

  it('akzeptiert ein leeres values-Array', () => {
    expect(parseExtractResult({ ...gueltig, values: [] })?.values).toEqual([])
  })

  it('verwirft einzelne Werte ohne Marker oder mit unbrauchbarem Wert', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [
        ...gueltig.values,
        { marker: '', matched: false, value: 5, unit: 'U/L', ref_min: null, ref_max: null },
        { marker: 'GPT (ALT)', matched: false, value: 'unleserlich', unit: 'U/L', ref_min: null, ref_max: null },
        { marker: 'GOT (AST)', matched: false, value: Number.NaN, unit: 'U/L', ref_min: null, ref_max: null },
      ],
    })
    expect(result?.values.map(v => v.marker)).toEqual(['Testosteron'])
  })

  it('normalisiert fehlende Referenzgrenzen zu null', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [{ marker: 'CRP', matched: true, value: 0.8, unit: 'mg/L' }],
    })
    expect(result?.values[0]).toEqual({
      marker: 'CRP', matched: true, value: 0.8, unit: 'mg/L', ref_min: null, ref_max: null,
    })
  })

  it('setzt eine fehlende Einheit auf einen leeren String', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [{ marker: 'HOMA-Index', matched: true, value: 1.4 }],
    })
    expect(result?.values[0].unit).toBe('')
  })

  it('akzeptiert Zahlen als Strings mit Komma', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [{ marker: 'CRP', matched: true, value: '0,8', unit: 'mg/L' }],
    })
    expect(result?.values[0].value).toBe(0.8)
  })

  it('erzwingt matched als echten Boolean', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [{ marker: 'CRP', matched: 'ja', value: 1, unit: 'mg/L' }],
    })
    expect(result?.values[0].matched).toBe(false)
  })

  it('verwirft Werte, die kein Objekt sind', () => {
    const result = parseExtractResult({ ...gueltig, values: ['quatsch', null, 42] })
    expect(result?.values).toEqual([])
  })

  it('trimmt Marker und Einheit', () => {
    const result = parseExtractResult({
      ...gueltig,
      values: [{ marker: '  CRP  ', matched: true, value: 1, unit: '  mg/L  ' }],
    })
    expect(result?.values[0].marker).toBe('CRP')
    expect(result?.values[0].unit).toBe('mg/L')
  })
})
