import { describe, expect, it } from 'vitest'
import { estimateEngravingWidth, fitEngraving } from './engraving'
import { CAPSULE_ENGRAVING } from './capsuleShape'

describe('fitEngraving', () => {
  it('setzt kurze Namen in voller Groesse', () => {
    const fit = fitEngraving('Vitamin D3')
    expect(fit.text).toBe('VITAMIN D3')
    expect(fit.fontSize).toBe(CAPSULE_ENGRAVING.maxFontSize)
    expect(fit.truncated).toBe(false)
  })

  it('schrumpft die Schrift, bevor sie kuerzt', () => {
    const fit = fitEngraving('Magnesiumcitrat')
    expect(fit.fontSize).toBeLessThan(CAPSULE_ENGRAVING.maxFontSize)
    expect(fit.fontSize).toBeGreaterThanOrEqual(CAPSULE_ENGRAVING.minFontSize)
    expect(fit.text).toBe('MAGNESIUMCITRAT')
    expect(fit.truncated).toBe(false)
  })

  it('kuerzt hart, wenn auch die kleinste Groesse nicht reicht', () => {
    const fit = fitEngraving('Acetyl-L-Carnitin Hydrochlorid Komplex')
    expect(fit.fontSize).toBe(CAPSULE_ENGRAVING.minFontSize)
    expect(fit.truncated).toBe(true)
    expect(fit.text.endsWith('…')).toBe(false)
    expect(fit.text.endsWith('...')).toBe(false)
    expect(estimateEngravingWidth(fit.text, fit.fontSize)).toBeLessThanOrEqual(CAPSULE_ENGRAVING.maxWidth)
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck statt leer zu bleiben', () => {
    expect(fitEngraving('   ').text).toBe('KAPSEL')
    expect(fitEngraving('').text).toBe('KAPSEL')
  })

  it('bleibt bei jeder Eingabe innerhalb der nutzbaren Breite', () => {
    for (const name of ['A', 'Zink', 'Vitamin D3', 'Omega 3 Fischoel Konzentrat hochdosiert']) {
      const fit = fitEngraving(name)
      expect(estimateEngravingWidth(fit.text, fit.fontSize)).toBeLessThanOrEqual(CAPSULE_ENGRAVING.maxWidth)
    }
  })
})
