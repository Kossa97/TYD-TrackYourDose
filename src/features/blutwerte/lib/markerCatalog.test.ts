import { describe, expect, it } from 'vitest'
import { CATALOG_MARKER_NAMES, KATEGORIEN, MARKER_CATALOG, normalizeMarker } from './markerCatalog'

describe('normalizeMarker', () => {
  it('findet einen Marker über den kanonischen Namen', () => {
    expect(normalizeMarker('Testosteron')?.name).toBe('Testosteron')
  })

  it('ignoriert Groß-/Kleinschreibung und Leerzeichen', () => {
    expect(normalizeMarker('  testosteron  ')?.name).toBe('Testosteron')
  })

  it('findet einen Marker über ein Synonym', () => {
    expect(normalizeMarker('Gesamttestosteron')?.name).toBe('Testosteron')
  })

  it('gibt null für unbekannte Marker zurück', () => {
    expect(normalizeMarker('Phantasiewert')).toBeNull()
  })

  it('gibt null für leere Eingaben zurück', () => {
    expect(normalizeMarker('   ')).toBeNull()
  })
})

describe('MARKER_CATALOG', () => {
  it('enthält alle bisher unterstützten Marker', () => {
    const bisher = [
      'IGF-1', 'Testosteron', 'Östradiol', 'SHBG', 'LH', 'FSH',
      'TSH', 'CRP', 'Vitamin D', 'Ferritin', 'Hämoglobin', 'Hämatokrit',
      'GH', 'Kortisol', 'Insulin',
    ]
    bisher.forEach(name => {
      expect(normalizeMarker(name), `${name} fehlt im Katalog`).not.toBeNull()
    })
  })

  it('hat für jeden Marker eine Erklärung und eine gültige Kategorie', () => {
    MARKER_CATALOG.forEach(def => {
      expect(def.erklaerung.length, `${def.name} ohne Erklärung`).toBeGreaterThan(20)
      expect(KATEGORIEN, `${def.name} mit unbekannter Kategorie`).toContain(def.kategorie)
    })
  })

  it('hat keine doppelten Namen oder Synonyme', () => {
    const alle = MARKER_CATALOG.flatMap(d => [d.name, ...d.synonyme]).map(s => s.toLowerCase())
    expect(new Set(alle).size).toBe(alle.length)
  })

  it('exportiert die Markernamen für den Extraktions-Prompt', () => {
    expect(CATALOG_MARKER_NAMES).toContain('Testosteron')
    expect(CATALOG_MARKER_NAMES.length).toBe(MARKER_CATALOG.length)
  })

  it('führt Differentialblutbild-Zellen getrennt als % und absolut', () => {
    const prozent = normalizeMarker('Basophile %')
    const absolut = normalizeMarker('Basophile absolut')
    expect(prozent?.name).toBe('Basophile %')
    expect(absolut?.name).toBe('Basophile absolut')
    expect(prozent?.einheit).toBe('%')
    expect(absolut?.einheit).toBe('/nl')
    expect(prozent?.name).not.toBe(absolut?.name)
  })

  it('kennt die Kategorie Enzyme', () => {
    expect(KATEGORIEN).toContain('Enzyme')
    expect(normalizeMarker('Kreatinkinase')?.kategorie).toBe('Enzyme')
  })
})
