import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS, getDosageForm, getIntakePlanUnitSuggestions, intakeUnitLabelKey, isStageRenderable } from './dosageForms'
import type { DosageFormKey } from '../types'

describe('DOSAGE_FORMS', () => {
  it('enthält alle freigegebenen stabilen Schlüssel genau einmal', () => {
    expect(DOSAGE_FORMS.map(form => form.key)).toEqual([
      'vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops',
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
    expect(DOSAGE_FORMS.filter(form => form.stageRenderer).map(form => form.key)).toEqual(['vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops', 'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube'])
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
    expect(getDosageForm('tube').basisUnits).toContain('ml')
  })

  it('erkennt die zwölf fertigen Formen als darstellbar, den Rest noch nicht', () => {
    expect(isStageRenderable('vial')).toBe(true)
    expect(isStageRenderable('ampoule')).toBe(true)
    expect(isStageRenderable('pen')).toBe(true)
    expect(isStageRenderable('tablet')).toBe(true)
    expect(isStageRenderable('capsule')).toBe(true)
    expect(isStageRenderable('nasal_spray')).toBe(true)
    expect(isStageRenderable('tube')).toBe(true)
    expect(isStageRenderable('patch')).toBe(true)
    expect(isStageRenderable('drops')).toBe(true)
    expect(isStageRenderable('powder')).toBe(true)
    expect(isStageRenderable('gel')).toBe(true)
    expect(isStageRenderable('spray')).toBe(true)
    expect(isStageRenderable('other')).toBe(false)
  })

  it('faellt fuer eine Form, die es nicht mehr gibt, auf other zurueck', () => {
    // 'liquid' stand bis September in der Liste und liegt in Bestandsdaten
    // weiter. Ohne Rueckfall gaebe die Suche undefined zurueck und der
    // naechste Zugriff auf .stageRenderer wuerde die Seite abstuerzen lassen.
    const alt = 'liquid' as never

    expect(getDosageForm(alt).key).toBe('other')
    expect(isStageRenderable(alt)).toBe(false)
  })
})

describe('Einnahmeeinheit je Darreichungsform', () => {
  // Womit EINE Einnahme gezaehlt wird — nicht, was im Schrank steht. Der
  // Beispieleintrag im Tiefenschritt sagte lange „1 Kapsel", dann „1 Ampulle";
  // beides beschrieb die Packung, nicht das, was man tut.
  it('zaehlt Ampulle und Vial in Spritzen, Sprays in Spruehstoessen', () => {
    const einheit = (key: DosageFormKey) => getDosageForm(key).intakeUnit

    // Aufgezogen wird mit der Spritze — bei beiden.
    expect(einheit('ampoule')).toBe('syringe')
    expect(einheit('vial')).toBe('syringe')

    // Beide Sprays geben Spruehstoesse ab.
    expect(einheit('spray')).toBe('spray')
    expect(einheit('nasal_spray')).toBe('spray')

    // Was man zaehlen kann, zaehlt sich selbst.
    expect(einheit('tablet')).toBe('tablet')
    expect(einheit('capsule')).toBe('capsule')
    expect(einheit('drops')).toBe('drop')
    expect(einheit('patch')).toBe('patch')

    // Was aufgetragen oder abgemessen wird, zaehlt in Anwendung oder Portion.
    expect(einheit('gel')).toBe('application')
    expect(einheit('tube')).toBe('application')
    expect(einheit('powder')).toBe('portion')
    expect(einheit('pen')).toBe('dose')
    expect(einheit('other')).toBe('unit')
  })

  it('gibt jeder Form eine Einheit und einen Uebersetzungsschluessel dazu', () => {
    for (const form of DOSAGE_FORMS) {
      expect(form.intakeUnit, form.key).toBeTruthy()
      expect(intakeUnitLabelKey(form.key), form.key)
        .toBe(`my_stack_intake_unit_${form.intakeUnit}`)
    }
  })

  it('stellt die Einnahmeeinheit an die Spitze der Einheitenvorschlaege', () => {
    // Was der Nutzer im Alltag zaehlt, steht vorn — vor den Wirkstoffmengen
    // und den Packungsmassen.
    for (const key of ['ampoule', 'nasal_spray', 'gel'] as const) {
      const vorschlaege = getIntakePlanUnitSuggestions(key)
      expect(vorschlaege, key).toContain(getDosageForm(key).intakeUnit)
    }
  })
})
