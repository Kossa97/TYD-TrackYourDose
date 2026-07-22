import { describe, expect, it } from 'vitest'
import type { StackItem, SubstanceCatalogEntry } from '../types'
import {
  RENDERED_WIZARD_STEPS,
  canContinue,
  didIdentityChange,
  firstInvalidField,
  initialWizardState,
  wizardReducer,
} from './wizardState'

const vitaminD3: SubstanceCatalogEntry = {
  id: 'vitamin-d3',
  canonical_name: 'Vitamin D3',
  aliases: ['Cholecalciferol'],
  default_category: 'vitamin',
  suggested_units: ['IU', 'mcg'],
  suggested_dosage_forms: ['capsule', 'drops'],
  pk_profile_id: null,
  active: true,
}

const existingVitaminD: StackItem = {
  id: 'stack-1',
  user_id: 'user-1',
  display_name: 'Vitamin D3',
  category: 'vitamin',
  dosage_form: 'capsule',
  brand: 'Example Brand',
  color_hex: '#abcdef',
  notes: 'With breakfast',
  configuration_status: 'complete',
  archived: false,
  archived_at: null,
  created_at: '2026-07-21T10:00:00.000Z',
  updated_at: '2026-07-21T10:00:00.000Z',
  ingredients: [{
    id: 'ingredient-1',
    stack_item_id: 'stack-1',
    catalog_substance_id: 'vitamin-d3',
    custom_name: '',
    amount_value: 5000,
    amount_unit: 'IU',
    basis_value: 1,
    basis_unit: 'capsule',
    position: 0,
  }],
}

describe('wizard state', () => {
  it('enthält tracking nur als nicht gerenderten Erweiterungspunkt', () => {
    expect(RENDERED_WIZARD_STEPS).toEqual([
      'substance', 'ingredients', 'dosage_form', 'strength', 'details', 'review',
    ])
  })
  it('übernimmt die bisherige Zufallsfarbe nur für neue Einträge', () => {
    expect(initialWizardState(undefined, '#123456').draft.colorHex).toBe('#123456')
    expect(initialWizardState(existingVitaminD, '#123456').draft.colorHex).toBe('#abcdef')
  })


  it('übernimmt beim Katalogtreffer Name, Kategorie und einen Inhaltsstoff', () => {
    const next = wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 })

    expect(next.draft.displayName).toBe('Vitamin D3')
    expect(next.draft.category).toBe('vitamin')
    expect(next.draft.ingredients).toHaveLength(1)
    expect(next.draft.ingredients[0]).toMatchObject({
      catalog_substance_id: 'vitamin-d3',
      custom_name: '',
      amount_value: null,
      amount_unit: 'IU',
      basis_value: null,
      basis_unit: null,
      position: 0,
    })
  })

  it('erlaubt freie Eingabe ohne Katalog-ID', () => {
    const next = wizardReducer(initialWizardState(), { type: 'custom_started', name: 'Eigene Mischung' })

    expect(next.draft.displayName).toBe('Eigene Mischung')
    expect(next.draft.ingredients[0].catalog_substance_id).toBeNull()
    expect(next.draft.ingredients[0].custom_name).toBe('Eigene Mischung')
  })

  it('resets the catalog category when switching to custom input', () => {
    const catalogState = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: vitaminD3,
    })
    const next = wizardReducer(catalogState, { type: 'custom_started', name: 'Eigene Mischung' })

    expect(next.draft.category).toBeNull()
    expect(canContinue(next)).toBe(false)
    expect(firstInvalidField(next)).toBe('category')
  })

  it('keeps selected form suggestion when catalog selection replaces ingredients', () => {
    const stateWithDosageForm = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'dosage_form_selected', dosageForm: 'capsule' },
    )
    const next = wizardReducer(stateWithDosageForm, { type: 'catalog_selected', entry: vitaminD3 })

    expect(next.draft.dosageForm).toBe('capsule')
    expect(next.draft.ingredients[0].basis_unit).toBe('capsule')
  })

  it('keeps selected form suggestion when custom input replaces ingredients', () => {
    const stateWithDosageForm = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'dosage_form_selected', dosageForm: 'capsule' },
    )
    const next = wizardReducer(stateWithDosageForm, {
      type: 'custom_started',
      name: 'Eigene Mischung',
    })

    expect(next.draft.dosageForm).toBe('capsule')
    expect(next.draft.ingredients[0].basis_unit).toBe('capsule')
  })

  it('fügt Mehrfachwirkstoffe hinzu und hält Positionen stabil', () => {
    const stateWithOneIngredient = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: vitaminD3,
    })
    const next = wizardReducer(stateWithOneIngredient, { type: 'ingredient_added' })

    expect(next.draft.ingredients.map(row => row.position)).toEqual([0, 1])
  })

  it('uses the selected form suggestion for ingredients added later', () => {
    const stateWithDosageForm = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'dosage_form_selected', dosageForm: 'capsule' },
    )
    const next = wizardReducer(stateWithDosageForm, { type: 'ingredient_added' })

    expect(next.draft.ingredients[1].basis_unit).toBe('capsule')
  })

  it('nummeriert Positionen nach dem Entfernen stabil neu', () => {
    const stateWithTwoIngredients = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'ingredient_added' },
    )
    const next = wizardReducer(stateWithTwoIngredients, { type: 'ingredient_removed', index: 0 })

    expect(next.draft.ingredients).toHaveLength(1)
    expect(next.draft.ingredients[0].position).toBe(0)
  })

  it('setzt formabhängige Bezugsgrößen nur als editierbaren Vorschlag', () => {
    const stateWithVitaminD = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: vitaminD3,
    })
    const withDosageForm = wizardReducer(stateWithVitaminD, {
      type: 'dosage_form_selected',
      dosageForm: 'capsule',
    })
    const next = wizardReducer(withDosageForm, {
      type: 'ingredient_changed',
      index: 0,
      changes: { basis_unit: 'portion' },
    })

    expect(withDosageForm.draft.ingredients[0].basis_unit).toBe('capsule')
    expect(withDosageForm.draft.ingredients[0].amount_value).toBeNull()
    expect(withDosageForm.draft.ingredients[0].basis_value).toBeNull()
    expect(next.draft.ingredients[0].basis_unit).toBe('portion')
  })

  it('unterscheidet Update und neue Variante beim Editieren', () => {
    const editState = initialWizardState(existingVitaminD)

    expect(editState.saveMode).toBe('update')
    expect(wizardReducer(editState, { type: 'save_mode_selected', mode: 'duplicate' }).saveMode)
      .toBe('duplicate')
  })

  it('befüllt beim Editieren alle Entwurfsfelder ohne die Quelle zu teilen', () => {
    const editState = initialWizardState(existingVitaminD)

    expect(editState.draft).toEqual({
      id: 'stack-1',
      displayName: 'Vitamin D3',
      category: 'vitamin',
      dosageForm: 'capsule',
      brand: 'Example Brand',
      colorHex: '#abcdef',
      notes: 'With breakfast',
      ingredients: existingVitaminD.ingredients,
    })
    expect(editState.draft.ingredients).not.toBe(existingVitaminD.ingredients)
    expect(editState.draft.ingredients[0]).not.toBe(existingVitaminD.ingredients[0])
  })

  it('lässt erst nach einer identifizierbaren Substanz weitergehen', () => {
    const initial = initialWizardState()
    const custom = wizardReducer(initial, { type: 'custom_started', name: 'Eigene Mischung' })

    expect(canContinue(initial)).toBe(false)
    expect(firstInvalidField(initial)).toBe('displayName')
    expect(canContinue(custom)).toBe(false)
    expect(firstInvalidField(custom)).toBe('category')
    expect(canContinue(wizardReducer(custom, { type: 'category_selected', category: 'supplement' })))
      .toBe(true)
  })

  it('fokussiert bei Mehrfachwirkstoffen die erste unbenannte Zeile', () => {
    const state = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 }),
      { type: 'ingredient_added' },
    )
    const ingredientStep = wizardReducer(state, { type: 'step_selected', step: 'ingredients' })

    expect(canContinue(ingredientStep)).toBe(false)
    expect(firstInvalidField(ingredientStep)).toBe('ingredients.1.name')
  })

  it('verwendet die Entwurfsvalidierung für Form und Stärke', () => {
    const catalogState = wizardReducer(initialWizardState(), {
      type: 'catalog_selected',
      entry: vitaminD3,
    })
    const dosageFormStep = wizardReducer(catalogState, {
      type: 'step_selected',
      step: 'dosage_form',
    })
    const withDosageForm = wizardReducer(dosageFormStep, {
      type: 'dosage_form_selected',
      dosageForm: 'capsule',
    })
    const strengthStep = wizardReducer(withDosageForm, { type: 'step_selected', step: 'strength' })
    const complete = wizardReducer(strengthStep, {
      type: 'ingredient_changed',
      index: 0,
      changes: { amount_value: 5000, basis_value: 1 },
    })

    expect(canContinue(dosageFormStep)).toBe(false)
    expect(firstInvalidField(dosageFormStep)).toBe('dosageForm')
    expect(canContinue(withDosageForm)).toBe(true)
    expect(canContinue(strengthStep)).toBe(false)
    expect(firstInvalidField(strengthStep)).toBe('ingredients.0.amountValue')
    expect(canContinue(complete)).toBe(true)
    expect(firstInvalidField(complete)).toBeNull()
  })
})

describe('didIdentityChange', () => {
  it('ignoriert reine Produktdetail- und Metadatenänderungen', () => {
    const draft = initialWizardState(existingVitaminD).draft

    expect(didIdentityChange(existingVitaminD, {
      ...draft,
      displayName: 'Vitamin D3 Premium',
      category: 'supplement',
      brand: 'Another Brand',
      colorHex: '#123456',
      notes: 'Updated notes',
    })).toBe(false)
  })

  it('erkennt Form- und Stärkeänderungen als neue Identität', () => {
    const draft = initialWizardState(existingVitaminD).draft

    expect(didIdentityChange(existingVitaminD, { ...draft, dosageForm: 'drops' })).toBe(true)
    expect(didIdentityChange(existingVitaminD, {
      ...draft,
      ingredients: [{ ...draft.ingredients[0], amount_value: 10000 }],
    })).toBe(true)
  })
})
