import type {
  DosageFormKey,
  StackCategory,
  StackItem,
  StackItemDraft,
  StackItemIngredient,
  SubstanceCatalogEntry,
} from '../types'
import { buildDuplicateFingerprint } from './duplicateFingerprint'
import { getDosageForm } from './dosageForms'
import { validateStackItemDraft } from './validation'

export type WizardStep =
  | 'substance'
  | 'ingredients'
  | 'dosage_form'
  | 'strength'
  | 'details'
  | 'tracking'
  | 'review'

export const RENDERED_WIZARD_STEPS: readonly WizardStep[] = [
  'substance',
  'ingredients',
  'dosage_form',
  'strength',
  'details',
  'review',
] as const

export type WizardSaveMode = 'create' | 'update' | 'duplicate'

export interface WizardState {
  step: WizardStep
  draft: StackItemDraft
  original: StackItem | null
  saveMode: WizardSaveMode
}

type IngredientChanges = Partial<Omit<StackItemIngredient, 'position'>>

export type WizardAction =
  | { type: 'step_selected'; step: WizardStep }
  | { type: 'catalog_selected'; entry: SubstanceCatalogEntry }
  | { type: 'custom_started'; name: string }
  | { type: 'display_name_changed'; displayName: string }
  | { type: 'category_selected'; category: StackCategory }
  | { type: 'ingredient_added' }
  | { type: 'ingredient_changed'; index: number; changes: IngredientChanges }
  | { type: 'ingredient_removed'; index: number }
  | { type: 'dosage_form_selected'; dosageForm: DosageFormKey }
  | { type: 'details_changed'; changes: Partial<Pick<StackItemDraft, 'brand' | 'colorHex' | 'notes'>> }
  | { type: 'save_mode_selected'; mode: Extract<WizardSaveMode, 'update' | 'duplicate'> }

function emptyIngredient(position: number): StackItemIngredient {
  return {
    catalog_substance_id: null,
    custom_name: '',
    amount_value: null,
    amount_unit: null,
    basis_value: null,
    basis_unit: null,
    position,
  }
}

function suggestedBasisUnit(dosageForm: DosageFormKey | null): string | null {
  return dosageForm ? getDosageForm(dosageForm).basisUnits[0] ?? null : null
}

function draftFromStackItem(existing: StackItem): StackItemDraft {
  return {
    id: existing.id,
    displayName: existing.display_name,
    category: existing.category,
    dosageForm: existing.dosage_form,
    brand: existing.brand ?? '',
    colorHex: existing.color_hex ?? '',
    notes: existing.notes ?? '',
    ingredients: existing.ingredients.map(ingredient => ({ ...ingredient })),
  }
}

export function initialWizardState(existing?: StackItem, initialColorHex = ''): WizardState {
  return {
    step: 'substance',
    draft: existing
      ? draftFromStackItem(existing)
      : {
          displayName: '',
          category: null,
          dosageForm: null,
          brand: '',
          colorHex: initialColorHex,
          notes: '',
          ingredients: [],
        },
    original: existing ?? null,
    saveMode: existing ? 'update' : 'create',
  }
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'step_selected':
      return { ...state, step: action.step }
    case 'catalog_selected':
      return {
        ...state,
        draft: {
          ...state.draft,
          displayName: action.entry.canonical_name,
          category: action.entry.default_category,
          ingredients: [{
            ...emptyIngredient(0),
            catalog_substance_id: action.entry.id,
            amount_unit: action.entry.suggested_units[0] ?? null,
            basis_unit: suggestedBasisUnit(state.draft.dosageForm),
          }],
        },
      }
    case 'custom_started': {
      const firstIngredient = state.draft.ingredients[0]
      const wasCatalogSelection = state.draft.ingredients.length === 1
        && Boolean(firstIngredient?.catalog_substance_id)
      const isSingleCustomIdentity = state.draft.ingredients.length === 1
        && !firstIngredient?.catalog_substance_id
        && firstIngredient?.custom_name === state.draft.displayName
      const ingredients = state.draft.ingredients.length === 0 || wasCatalogSelection
        ? [{
            ...emptyIngredient(0),
            custom_name: action.name,
            basis_unit: suggestedBasisUnit(state.draft.dosageForm),
          }]
        : isSingleCustomIdentity
          ? [{ ...firstIngredient, custom_name: action.name }]
          : state.draft.ingredients

      return {
        ...state,
        draft: {
          ...state.draft,
          displayName: action.name,
          category: wasCatalogSelection ? null : state.draft.category,
          ingredients,
        },
      }
    }
    case 'display_name_changed':
      return { ...state, draft: { ...state.draft, displayName: action.displayName } }
    case 'category_selected':
      return { ...state, draft: { ...state.draft, category: action.category } }
    case 'ingredient_added':
      return {
        ...state,
        draft: {
          ...state.draft,
          ingredients: [
            ...state.draft.ingredients,
            {
              ...emptyIngredient(state.draft.ingredients.length),
              basis_unit: suggestedBasisUnit(state.draft.dosageForm),
            },
          ],
        },
      }
    case 'ingredient_changed':
      return {
        ...state,
        draft: {
          ...state.draft,
          ingredients: state.draft.ingredients.map((ingredient, index) => (
            index === action.index ? { ...ingredient, ...action.changes } : ingredient
          )),
        },
      }
    case 'ingredient_removed':
      return {
        ...state,
        draft: {
          ...state.draft,
          ingredients: state.draft.ingredients
            .filter((_, index) => index !== action.index)
            .map((ingredient, position) => ({ ...ingredient, position })),
        },
      }
    case 'dosage_form_selected': {
      const basisUnit = suggestedBasisUnit(action.dosageForm)
      return {
        ...state,
        draft: {
          ...state.draft,
          dosageForm: action.dosageForm,
          ingredients: state.draft.ingredients.map(ingredient => ({
            ...ingredient,
            basis_unit: basisUnit,
          })),
        },
      }
    }
    case 'details_changed':
      return { ...state, draft: { ...state.draft, ...action.changes } }
    case 'save_mode_selected':
      return { ...state, saveMode: action.mode }
  }
}

function firstIngredientError(
  state: WizardState,
  fields: readonly ('name' | 'amountValue' | 'amountUnit' | 'basisValue' | 'basisUnit')[],
): string | null {
  const errors = validateStackItemDraft(state.draft).ingredients

  if (!errors) return null

  for (let index = 0; index < errors.length; index += 1) {
    for (const field of fields) {
      if (errors[index]?.[field]) return `ingredients.${index}.${field}`
    }
  }

  return null
}

export function firstInvalidField(state: WizardState): string | null {
  const errors = validateStackItemDraft(state.draft)

  if (state.step === 'substance' || state.step === 'review') {
    if (!state.draft.displayName.trim()) return 'displayName'
    if (!state.draft.category) return 'category'
  }
  if (state.step === 'ingredients' && !state.draft.displayName.trim()) return 'displayName'

  if (state.step === 'substance' || state.step === 'ingredients' || state.step === 'review') {
    const nameError = firstIngredientError(state, ['name'])
    if (nameError) return nameError
  }

  if (state.step === 'dosage_form' || state.step === 'strength' || state.step === 'review') {
    if (errors.dosageForm) return 'dosageForm'
  }

  if (state.step === 'strength' || state.step === 'review') {
    return firstIngredientError(state, ['name', 'amountValue', 'amountUnit', 'basisValue', 'basisUnit'])
  }

  return null
}

export function canContinue(state: WizardState): boolean {
  return firstInvalidField(state) === null
}

export function didIdentityChange(original: StackItem, draft: StackItemDraft): boolean {
  return buildDuplicateFingerprint(draftFromStackItem(original)) !== buildDuplicateFingerprint(draft)
}
