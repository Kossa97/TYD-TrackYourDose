import { describe, expect, it } from 'vitest'
import { normalizeMarker } from './markerCatalog'
import { GUIDANCE_MARKERS, markerGuidance } from './markerGuidance'

describe('markerGuidance', () => {
  it('gehoert nur zu Katalogmarkern und hat beide Sprachen vollstaendig', () => {
    expect(GUIDANCE_MARKERS.length).toBeGreaterThan(0)
    for (const name of GUIDANCE_MARKERS) {
      expect(normalizeMarker(name)?.name).toBe(name)
      for (const sprache of ['de', 'en']) {
        const g = markerGuidance(name, sprache)!
        expect(g.text.hinweis).not.toBe('')
        for (const teil of [g.text.niedrig, g.text.bereich, g.text.hoch]) expect(teil.length).toBeGreaterThan(0)
        expect(g.quellen.every(q => q.url.startsWith('https://'))).toBe(true)
      }
      // Deutsch und Englisch haben gleich viele Punkte je Abschnitt.
      const de = markerGuidance(name, 'de')!.text
      const en = markerGuidance(name, 'en')!.text
      expect(en.niedrig.length).toBe(de.niedrig.length)
      expect(en.hoch.length).toBe(de.hoch.length)
    }
  })

  it('englisch fuer andere Sprachen, null fuer Marker ohne Einordnung', () => {
    expect(markerGuidance('Ferritin', 'fr')!.text.hinweis).toMatch(/iron stores/)
    expect(markerGuidance('Natrium', 'de')).toBeNull()
  })
})
