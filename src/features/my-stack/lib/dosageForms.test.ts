import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS, getDosageForm, getIntakePlanUnitSuggestions, intakeUnitLabelKey, isStageRenderable, strengthBasisDefault, strengthHintKey } from './dosageForms'
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

  it('gibt jeder Form eine Staerke-Form und einen Hinweis dazu', () => {
    for (const form of DOSAGE_FORMS) {
      expect(form.strengthShape, form.key).toBeTruthy()
      expect(strengthHintKey(form.key), form.key).toBe(
        form.strengthShape === 'free'
          ? 'my_stack_no_dosage_advice'
          : `my_stack_strength_hint_${form.strengthShape}`,
      )
    }
  })

  it('ordnet jede Form der Staerke zu, die sie tatsaechlich hat', () => {
    const shape = (key: Parameters<typeof getDosageForm>[0]) => getDosageForm(key).strengthShape

    // Stueckware: die Staerke steckt in einem Stueck.
    expect(shape('tablet')).toBe('per_unit')
    expect(shape('capsule')).toBe('per_unit')
    expect(shape('patch')).toBe('per_unit')
    // Ein Spruehstoss ist auch ein Stueck — abgezaehlt, nicht abgemessen.
    expect(shape('nasal_spray')).toBe('per_unit')
    expect(shape('spray')).toBe('per_unit')

    // Fluessiges traegt eine Konzentration.
    expect(shape('ampoule')).toBe('per_volume')
    expect(shape('pen')).toBe('per_volume')
    expect(shape('drops')).toBe('per_volume')

    // Das Pulver-Vial bekommt seine Konzentration erst beim Aufloesen.
    expect(shape('vial')).toBe('reconstituted')

    // Abgewogenes.
    expect(shape('powder')).toBe('per_mass')
    expect(shape('gel')).toBe('per_mass')
    expect(shape('tube')).toBe('per_mass')

    // Unbekannte Form: keine Annahme.
    expect(shape('other')).toBe('free')
  })

  it('belegt die Produktmenge aus der Form vor — und beim Vial gerade nicht', () => {
    // Eine Kapsel traegt ihre Staerke „pro 1 Kapsel", eine Ampulle „pro 1 ml".
    expect(strengthBasisDefault('capsule')).toEqual({ value: 1, unit: 'capsule' })
    expect(strengthBasisDefault('tablet')).toEqual({ value: 1, unit: 'tablet' })
    expect(strengthBasisDefault('nasal_spray')).toEqual({ value: 1, unit: 'spray' })
    expect(strengthBasisDefault('ampoule')).toEqual({ value: 1, unit: 'ml' })
    expect(strengthBasisDefault('pen')).toEqual({ value: 1, unit: 'ml' })
    expect(strengthBasisDefault('gel')).toEqual({ value: 1, unit: 'g' })

    // Wie viel Loesungsmittel ins Vial kommt, steht auf keinem Etikett.
    expect(strengthBasisDefault('vial')).toEqual({ value: null, unit: 'ml' })

    // Ueber eine unbekannte Form wird nichts behauptet.
    expect(strengthBasisDefault('other')).toEqual({ value: null, unit: 'unit' })
  })

  it('schlaegt nur Einheiten vor, die die Form auch kennt', () => {
    for (const form of DOSAGE_FORMS) {
      const vorgabe = strengthBasisDefault(form.key)
      if (vorgabe.unit === null) continue
      expect([...form.basisUnits, 'ml', 'g'], form.key).toContain(vorgabe.unit)
    }
  })
})

