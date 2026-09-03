import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS, getDosageForm, isStageRenderable } from './dosageForms'

describe('DOSAGE_FORMS', () => {
  it('enthält alle freigegebenen stabilen Schlüssel genau einmal', () => {
    expect(DOSAGE_FORMS.map(form => form.key)).toEqual([
      'vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops', 'liquid',
      'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube', 'other',
    ])
  })

  it('modelliert Tabletten als teilbar und Vials als rekonstituierbar', () => {
    expect(getDosageForm('tablet').capabilities).toContain('divisible')
    expect(getDosageForm('vial').capabilities).toEqual(expect.arrayContaining([
      'injectable', 'reconstitutable', 'concentration_based', 'inventory_capable',
    ]))
  })

  it('aktiviert genau die Formen mit fertiger Bühnengrafik', () => {
    expect(DOSAGE_FORMS.filter(form => form.stageRenderer).map(form => form.key)).toEqual(['vial', 'ampoule', 'pen', 'tablet', 'capsule', 'nasal_spray', 'tube'])
  })

  it('gibt jeder freigeschalteten Form ihre Bühnenbeschreibung mit', () => {
    for (const form of DOSAGE_FORMS.filter(f => f.stageRenderer)) {
      expect(form.stageForm, form.key).toBeDefined()
    }
    for (const form of DOSAGE_FORMS.filter(f => !f.stageRenderer)) {
      expect(form.stageForm, form.key).toBeUndefined()
    }
  })

  it('trennt Etikett und Füllstand: beide Glasformen tragen eines, nur das Vial hat einen Pegel', () => {
    expect(getDosageForm('vial').stageForm?.chamber).not.toBeNull()
    expect(getDosageForm('ampoule').stageForm?.chamber).not.toBeNull()
    expect(getDosageForm('vial').stageForm?.hasMeaningfulFill).toBe(true)
    expect(getDosageForm('ampoule').stageForm?.hasMeaningfulFill).toBe(false)
  })

  it('liefert formgerechte Bezugsgrößen', () => {
    expect(getDosageForm('capsule').basisUnits).toContain('capsule')
    expect(getDosageForm('drops').basisUnits).toContain('drop')
    expect(getDosageForm('liquid').basisUnits).toContain('ml')
  })

  it('erkennt die sieben fertigen Formen als darstellbar, den Rest noch nicht', () => {
    expect(isStageRenderable('vial')).toBe(true)
    expect(isStageRenderable('ampoule')).toBe(true)
    expect(isStageRenderable('pen')).toBe(true)
    expect(isStageRenderable('tablet')).toBe(true)
    expect(isStageRenderable('capsule')).toBe(true)
    expect(isStageRenderable('nasal_spray')).toBe(true)
    expect(isStageRenderable('tube')).toBe(true)
    expect(isStageRenderable('drops')).toBe(false)
    expect(isStageRenderable('gel')).toBe(false)
    expect(isStageRenderable('spray')).toBe(false)
    expect(isStageRenderable('patch')).toBe(false)
    expect(isStageRenderable('powder')).toBe(false)
  })
})
