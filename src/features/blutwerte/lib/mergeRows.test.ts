import { describe, expect, it } from 'vitest'
import { markerKey, mergeIncoming, type MergeItem } from './mergeRows'

const item = (over: Partial<MergeItem> = {}): MergeItem => ({
  marker: 'Testosteron',
  value: 600,
  unit: 'ng/dL',
  ref_min: null,
  ref_max: null,
  ...over,
})

describe('markerKey', () => {
  it('normalisiert über den Katalog (Synonym -> kanonisch)', () => {
    expect(markerKey('Gesamttestosteron')).toBe(markerKey('Testosteron'))
  })

  it('nutzt für Custom-Marker den getrimmten Kleinbuchstaben-Namen', () => {
    expect(markerKey('  Xyz  ')).toBe(markerKey('xyz'))
  })

  it('unterscheidet verschiedene Marker', () => {
    expect(markerKey('CRP')).not.toBe(markerKey('Ferritin'))
  })
})

describe('mergeIncoming', () => {
  it('fügt neue Marker als added hinzu', () => {
    const r = mergeIncoming([item({ marker: 'Testosteron' })], [item({ marker: 'CRP', value: 1, unit: 'mg/L' })])
    expect(r.added.map(i => i.marker)).toEqual(['CRP'])
    expect(r.conflicts).toEqual([])
    expect(r.duplicates).toBe(0)
  })

  it('überspringt exakte Dubletten', () => {
    const r = mergeIncoming([item()], [item()])
    expect(r.added).toEqual([])
    expect(r.conflicts).toEqual([])
    expect(r.duplicates).toBe(1)
  })

  it('erkennt einen wertgleichen Eintrag in anderer Einheit als Dublette', () => {
    const r = mergeIncoming([item({ value: 612, unit: 'ng/dL' })], [item({ value: 6.12, unit: 'µg/l' })])
    expect(r.duplicates).toBe(1)
    expect(r.conflicts).toEqual([])
    expect(r.added).toEqual([])
  })

  it('meldet abweichende Werte als Konflikt', () => {
    const r = mergeIncoming([item({ value: 600 })], [item({ value: 700 })])
    expect(r.added).toEqual([])
    expect(r.duplicates).toBe(0)
    expect(r.conflicts).toHaveLength(1)
    expect(r.conflicts[0].existing.value).toBe(600)
    expect(r.conflicts[0].incoming.value).toBe(700)
    expect(r.conflicts[0].key).toBe(markerKey('Testosteron'))
  })

  it('matcht einen Konflikt auch über ein Synonym', () => {
    const r = mergeIncoming(
      [item({ marker: 'Testosteron', value: 600 })],
      [item({ marker: 'Gesamttestosteron', value: 700 })],
    )
    expect(r.conflicts).toHaveLength(1)
  })

  it('behandelt nicht umrechenbare, unterschiedliche Einheiten als Konflikt', () => {
    const r = mergeIncoming([item({ value: 20, unit: 'nmol/L' })], [item({ value: 600, unit: 'ng/dL' })])
    expect(r.conflicts).toHaveLength(1)
    expect(r.duplicates).toBe(0)
  })

  it('verarbeitet mehrere eingehende Werte gemischt', () => {
    const existing = [item({ marker: 'Testosteron', value: 600 }), item({ marker: 'CRP', value: 1, unit: 'mg/L' })]
    const incoming = [
      item({ marker: 'Testosteron', value: 600 }),          // Dublette
      item({ marker: 'CRP', value: 2, unit: 'mg/L' }),       // Konflikt
      item({ marker: 'Ferritin', value: 120, unit: 'ng/mL' }), // neu
    ]
    const r = mergeIncoming(existing, incoming)
    expect(r.added.map(i => i.marker)).toEqual(['Ferritin'])
    expect(r.conflicts.map(c => c.incoming.marker)).toEqual(['CRP'])
    expect(r.duplicates).toBe(1)
  })

  it('mutiert die Eingabe-Arrays nicht', () => {
    const existing = [item()]
    const incoming = [item({ value: 999 })]
    const beforeExisting = JSON.stringify(existing)
    const beforeIncoming = JSON.stringify(incoming)
    mergeIncoming(existing, incoming)
    expect(JSON.stringify(existing)).toBe(beforeExisting)
    expect(JSON.stringify(incoming)).toBe(beforeIncoming)
  })
})
