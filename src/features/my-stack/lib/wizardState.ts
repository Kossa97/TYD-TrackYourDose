import type {
  DosageFormKey,
  IntakePlanDraft,
  InventoryDraft,
  StackCategory,
  StackItem,
  StackItemDraft,
  StackItemIngredient,
  StackItemSetupDraft,
  SubstanceCatalogEntry,
  TrackingLevel,
} from '../types'
import { format } from 'date-fns'
import { buildDuplicateFingerprint } from './duplicateFingerprint'
import { getDosageForm, getIntakePlanUnitSuggestions } from './dosageForms'
import { validateIntakePlan, validateStackItemDraft } from './validation'

export type WizardStep =
  | 'substance'
  | 'ingredients'
  | 'dosage_form'
  | 'strength'
  | 'details'
  | 'tracking_level'
  | 'plan'
  | 'review'

export type WizardSaveMode = 'create' | 'update' | 'duplicate'

export interface WizardState {
  step: WizardStep
  draft: StackItemSetupDraft
  original: StackItem | null
  saveMode: WizardSaveMode
  trackingLevelSelected: boolean
}

export function wizardSteps(state: WizardState): WizardStep[] {
  const commonSteps: WizardStep[] = ['substance', 'dosage_form', 'tracking_level']

  if (!state.trackingLevelSelected) return commonSteps

  if (state.draft.trackingLevel === 'complete') {
    return [
      ...commonSteps,
      'ingredients',
      'strength',
      'details',
      'plan',
      'review',
    ]
  }

  return [...commonSteps, 'plan', 'review']
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
  | {
      type: 'dosage_form_selected'
      dosageForm: DosageFormKey
      catalogSuggestedUnits?: readonly string[]
    }
  | { type: 'tracking_level_selected'; trackingLevel: TrackingLevel }
  | { type: 'details_changed'; changes: Partial<Pick<StackItemDraft, 'brand' | 'colorHex' | 'notes'>> }
  | { type: 'inventory_changed'; changes: Partial<InventoryDraft> }
  | { type: 'plan_changed'; changes: Partial<IntakePlanDraft> }
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

function emptyPlan(name: string): IntakePlanDraft {
  return {
    name,
    dose: null,
    unit: null,
    method: '',
    frequency: 'Täglich',
    xDaysInterval: null,
    scheduleDays: [],
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: null,
    routineGroup: 'morning',
    time: null,
    reminders: [],
  }
}

function emptyInventory(): InventoryDraft {
  return {
    enabled: false,
    packageQuantity: null,
    packageUnit: null,
    remainingQuantity: null,
    brand: '',
    batchNumber: '',
    expiresAt: null,
  }
}

function draftFromStackItem(
  existing: StackItem,
  existingPlan?: IntakePlanDraft,
): StackItemSetupDraft {
  return {
    id: existing.id,
    displayName: existing.display_name,
    trackingLevel: existing.tracking_level,
    category: existing.category,
    dosageForm: existing.dosage_form,
    brand: existing.brand ?? '',
    colorHex: existing.color_hex ?? '',
    notes: existing.notes ?? '',
    ingredients: existing.ingredients.map(ingredient => ({ ...ingredient })),
    plan: existingPlan
      ? {
          ...existingPlan,
          scheduleDays: [...existingPlan.scheduleDays],
          reminders: [...existingPlan.reminders],
          startDate: format(new Date(), 'yyyy-MM-dd'),
        }
      : emptyPlan(existing.display_name),
    inventory: existing.inventory
      ? {
          enabled: existing.inventory.enabled,
          packageQuantity: existing.inventory.package_quantity,
          packageUnit: existing.inventory.package_unit,
          remainingQuantity: existing.inventory.remaining_quantity,
          brand: '',
          batchNumber: existing.inventory.batch_number ?? '',
          expiresAt: existing.inventory.expires_at,
        }
      : emptyInventory(),
    pkProfileMethod: existing.pk_profile_method,
  }
}

export function initialWizardState(
  existing?: StackItem,
  initialColorHex = '',
  existingPlan?: IntakePlanDraft,
): WizardState {
  return {
    step: 'substance',
    draft: existing
      ? draftFromStackItem(existing, existingPlan)
      : {
          displayName: '',
          trackingLevel: 'complete',
          category: null,
          dosageForm: null,
          brand: '',
          colorHex: initialColorHex,
          notes: '',
          ingredients: [],
          plan: emptyPlan(''),
          inventory: emptyInventory(),
          pkProfileMethod: null,
        },
    original: existing ?? null,
    saveMode: existing ? 'update' : 'create',
    trackingLevelSelected: Boolean(existing),
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
          plan: { ...state.draft.plan, name: action.entry.canonical_name },
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
          plan: { ...state.draft.plan, name: action.name },
          ingredients,
        },
      }
    }
    case 'display_name_changed':
      return {
        ...state,
        draft: {
          ...state.draft,
          displayName: action.displayName,
          plan: { ...state.draft.plan, name: action.displayName },
        },
      }
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
      const compatiblePlanUnits = getIntakePlanUnitSuggestions(
        action.dosageForm,
        action.catalogSuggestedUnits,
      )
      const currentPlanUnit = state.draft.plan.unit
      return {
        ...state,
        draft: {
          ...state.draft,
          dosageForm: action.dosageForm,
          plan: {
            ...state.draft.plan,
            unit: currentPlanUnit && compatiblePlanUnits.includes(currentPlanUnit)
              ? currentPlanUnit
              : null,
          },
          ingredients: state.draft.ingredients.map(ingredient => ({
            ...ingredient,
            basis_unit: basisUnit,
          })),
        },
      }
    }
    case 'tracking_level_selected':
      return {
        ...state,
        trackingLevelSelected: true,
        draft: { ...state.draft, trackingLevel: action.trackingLevel },
      }
    case 'details_changed':
      return { ...state, draft: { ...state.draft, ...action.changes } }
    case 'inventory_changed':
      return {
        ...state,
        draft: {
          ...state.draft,
          inventory: { ...state.draft.inventory, ...action.changes },
        },
      }
    case 'plan_changed':
      return {
        ...state,
        draft: { ...state.draft, plan: { ...state.draft.plan, ...action.changes } },
      }
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
  if (state.step === 'tracking_level' && !state.trackingLevelSelected) return 'trackingLevel'

  if (state.step === 'substance' || state.step === 'ingredients' || state.step === 'review') {
    const nameError = firstIngredientError(state, ['name'])
    if (nameError) return nameError
  }

  if (state.step === 'dosage_form' || state.step === 'strength' || state.step === 'review') {
    if (errors.dosageForm) return 'dosageForm'
  }

  if (
    state.step === 'strength'
    || (state.step === 'review' && state.draft.trackingLevel === 'complete')
  ) {
    const strengthError = firstIngredientError(
      state,
      ['name', 'amountValue', 'amountUnit', 'basisValue', 'basisUnit'],
    )
    if (strengthError) return strengthError
  }

  if (state.step === 'plan' || state.step === 'review') {
    const planErrors = validateIntakePlan(state.draft.plan, state.draft.trackingLevel)
    if (planErrors.name) return 'displayName'
    if (planErrors.method) return 'plan.method'
    if (planErrors.frequency) return 'plan.frequency'
    if (planErrors.startDate) return 'plan.startDate'
    if (planErrors.routineGroup) return 'plan.routineGroup'
    if (planErrors.dose) return 'plan.dose'
    if (planErrors.unit) return 'plan.unit'
  }

  return null
}

export function canContinue(state: WizardState): boolean {
  return firstInvalidField(state) === null
}

export function didIdentityChange(original: StackItem, draft: StackItemDraft): boolean {
  return buildDuplicateFingerprint(draftFromStackItem(original)) !== buildDuplicateFingerprint(draft)
}
