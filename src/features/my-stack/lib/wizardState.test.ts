import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IntakePlanDraft, StackItem, SubstanceCatalogEntry } from '../types'
import {
  canContinue,
  didIdentityChange,
  firstInvalidField,
  initialWizardState,
  wizardSteps,
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
  tracking_level: 'complete',
  pk_profile_method: null,
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

const activePlan: IntakePlanDraft = {
  id: 'cycle-1',
  name: 'Vitamin D breakfast',
  dose: 5000,
  unit: 'IU',
  method: 'Oral',
  frequency: 'Mo-Fr',
  xDaysInterval: null,
  scheduleDays: ['Mo', 'Di', 'Mi', 'Do', 'Fr'],
  startDate: '2025-01-01',
  endDate: '2026-12-31',
  routineGroup: 'morning',
  time: '08:30',
  reminders: ['on_time'],
}

afterEach(() => vi.useRealTimers())

describe('wizard state', () => {
  it('defaults a new plan start/effective date to the local current date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 16, 12, 0, 0))

    expect(initialWizardState().draft.plan.startDate).toBe('2026-08-16')
    expect(initialWizardState().draft.plan.method).toBe('')
  })

  it('hydrates an active plan for edits but makes its effective date local today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 16, 12, 0, 0))

    const state = initialWizardState(existingVitaminD, '', activePlan)

    expect(state.draft.plan).toEqual({ ...activePlan, startDate: '2026-08-16' })
    expect(state.draft.plan).not.toBe(activePlan)
  })

  it('hydrates optional generic inventory for an existing stack item', () => {
    const existingWithInventory = {
      ...existingVitaminD,
      inventory: {
        enabled: true,
        package_quantity: 60,
        package_unit: 'capsule',
        remaining_quantity: 42,
        batch_number: 'A-42',
        expires_at: '2027-08-01',
      },
    }

    expect(initialWizardState(existingWithInventory).draft.inventory).toEqual({
      enabled: true,
      packageQuantity: 60,
      packageUnit: 'capsule',
      remainingQuantity: 42,
      brand: '',
      batchNumber: 'A-42',
      expiresAt: '2027-08-01',
    })
  })

  it.each([
    ['intake_only', ['substance', 'dosage_form', 'tracking_level', 'plan', 'review']],
    ['with_amount', ['substance', 'dosage_form', 'tracking_level', 'plan', 'review']],
    ['complete', ['substance', 'dosage_form', 'tracking_level', 'ingredients', 'strength', 'details', 'plan', 'review']],
  ] as const)('builds the %s path', (trackingLevel, expected) => {
    const state = wizardReducer(
      initialWizardState(),
      { type: 'tracking_level_selected', trackingLevel },
    )

    expect(wizardSteps(state)).toEqual(expected)
  })

  it('requires an explicit tracking choice for new drafts but accepts an existing persisted level', () => {
    const initial = initialWizardState()
    const trackingStep = { ...initial, step: 'tracking_level' as const }

    expect(initial.trackingLevelSelected).toBe(false)
    expect(wizardSteps(initial)).toEqual(['substance', 'dosage_form', 'tracking_level'])
    expect(firstInvalidField(trackingStep)).toBe('trackingLevel')

    const selected = wizardReducer(
      trackingStep,
      { type: 'tracking_level_selected', trackingLevel: 'complete' },
    )
    expect(selected.trackingLevelSelected).toBe(true)
    expect(firstInvalidField(selected)).toBeNull()
    expect(wizardSteps(selected)).toEqual([
      'substance', 'dosage_form', 'tracking_level', 'ingredients', 'strength', 'details', 'plan', 'review',
    ])
    expect(initialWizardState(existingVitaminD).trackingLevelSelected).toBe(true)
  })

  it('keeps complete-only details when a lower tracking level hides their steps', () => {
    const initial = initialWizardState(existingVitaminD)
    const completeDraft = {
      ...initial.draft,
      inventory: {
        ...initial.draft.inventory,
        enabled: true,
        packageQuantity: 60,
        packageUnit: 'capsule',
        remainingQuantity: 42,
      },
      pkProfileMethod: 'oral',
    }
    const next = wizardReducer(
      { ...initial, draft: completeDraft },
      { type: 'tracking_level_selected', trackingLevel: 'intake_only' },
    )

    expect(next.draft.trackingLevel).toBe('intake_only')
    expect(next.draft.ingredients).toEqual(completeDraft.ingredients)
    expect(next.draft.brand).toBe('Example Brand')
    expect(next.draft.inventory).toEqual(completeDraft.inventory)
    expect(next.draft.pkProfileMethod).toBe('oral')
    expect(wizardSteps(next)).toEqual([
      'substance', 'dosage_form', 'tracking_level', 'plan', 'review',
    ])
  })

  it('clears an incompatible capsule plan unit when the dosage form changes to liquid', () => {
    const initial = initialWizardState()
    const capsuleState = {
      ...initial,
      draft: {
        ...initial.draft,
        dosageForm: 'capsule' as const,
        plan: { ...initial.draft.plan, unit: 'capsule' },
      },
    }

    const next = wizardReducer(capsuleState, {
      type: 'dosage_form_selected',
      dosageForm: 'liquid',
    })

    expect(next.draft.plan.unit).toBeNull()
  })

  it('preserves a plan unit that remains compatible with the new dosage form', () => {
    const initial = initialWizardState()
    const capsuleState = {
      ...initial,
      draft: {
        ...initial.draft,
        dosageForm: 'capsule' as const,
        plan: { ...initial.draft.plan, unit: 'IU' },
      },
    }

    const next = wizardReducer(capsuleState, {
      type: 'dosage_form_selected',
      dosageForm: 'liquid',
    })

    expect(next.draft.plan.unit).toBe('IU')
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

  it.each([
    ['ampoule', 'ampoule'],
    ['vial', 'ml'],
  ] as const)('preserves an existing %s product unit when its already-selected form is clicked again', (dosageForm, basisUnit) => {
    const existing = {
      ...existingVitaminD,
      dosage_form: dosageForm,
      ingredients: [{ ...existingVitaminD.ingredients[0], basis_unit: basisUnit }],
    }

    const next = wizardReducer(initialWizardState(existing), {
      type: 'dosage_form_selected',
      dosageForm,
    })

    expect(next.draft.ingredients[0].basis_unit).toBe(basisUnit)
  })

  it('continues to reset the product unit when the dosage form actually changes', () => {
    const existingAmpoule = {
      ...existingVitaminD,
      dosage_form: 'ampoule' as const,
      ingredients: [{ ...existingVitaminD.ingredients[0], basis_unit: 'ampoule' }],
    }

    const next = wizardReducer(initialWizardState(existingAmpoule), {
      type: 'dosage_form_selected',
      dosageForm: 'vial',
    })

    expect(next.draft.ingredients[0].basis_unit).toBe('vial')
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
      trackingLevel: 'complete',
      dosageForm: 'capsule',
      brand: 'Example Brand',
      colorHex: '#abcdef',
      notes: 'With breakfast',
      ingredients: existingVitaminD.ingredients,
      plan: {
        name: 'Vitamin D3',
        dose: null,
        unit: null,
        method: '',
        frequency: 'Täglich',
        xDaysInterval: null,
        scheduleDays: [],
        startDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        endDate: null,
        routineGroup: 'morning',
        time: null,
        reminders: [],
      },
      inventory: {
        enabled: false,
        packageQuantity: null,
        packageUnit: null,
        remainingQuantity: null,
        brand: '',
        batchNumber: '',
        expiresAt: null,
      },
      pkProfileMethod: null,
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

  it('validates the rendered plan according to tracking depth', () => {
    const initial = initialWizardState()
    const base = {
      ...initial,
      step: 'plan' as const,
      draft: {
        ...initial.draft,
        displayName: 'Vitamin D3',
        category: 'vitamin' as const,
        dosageForm: 'capsule' as const,
        plan: { ...initial.draft.plan, name: 'Vitamin D3', method: 'Oral' },
        ingredients: [{
          catalog_substance_id: 'vitamin-d3',
          custom_name: '',
          amount_value: null,
          amount_unit: 'IU',
          basis_value: null,
          basis_unit: 'capsule',
          position: 0,
        }],
      },
    }

    expect(firstInvalidField({
      ...base,
      draft: { ...base.draft, trackingLevel: 'intake_only' },
    })).toBeNull()
    expect(firstInvalidField({
      ...base,
      draft: { ...base.draft, trackingLevel: 'with_amount' },
    })).toBe('plan.dose')
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
