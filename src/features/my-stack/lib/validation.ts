import type { IntakePlanDraft, StackItemDraft, StackItemIngredient, TrackingLevel } from '../types'
import { trackingCapabilities } from './trackingDepth'

export interface IngredientValidationErrors {
  name?: string
  amountValue?: string
  amountUnit?: string
  basisValue?: string
  basisUnit?: string
}

export interface StackItemDraftValidationErrors {
  dosageForm?: string
  ingredients?: IngredientValidationErrors[]
}

export interface IntakePlanValidationErrors {
  name?: string
  dose?: string
  unit?: string
  frequency?: string
  routineGroup?: string
}

function validateIngredient(
  ingredient: StackItemIngredient,
  level: TrackingLevel,
): IngredientValidationErrors {
  const errors: IngredientValidationErrors = {}
  const catalogSubstanceId = ingredient.catalog_substance_id?.trim()

  if (!catalogSubstanceId && !ingredient.custom_name.trim()) errors.name = 'required'
  if (trackingCapabilities(level).productStrength) {
    if (ingredient.amount_value === null) errors.amountValue = 'required_for_complete'
    if (!ingredient.amount_unit?.trim()) errors.amountUnit = 'required_for_complete'
    if (ingredient.basis_value === null) errors.basisValue = 'required_for_complete'
    if (!ingredient.basis_unit?.trim()) errors.basisUnit = 'required_for_complete'
  }

  return errors
}

export function validateStackItemDraft(draft: StackItemDraft): StackItemDraftValidationErrors {
  const errors: StackItemDraftValidationErrors = {}

  if (!draft.dosageForm) errors.dosageForm = 'required'

  if (draft.ingredients.length === 0) {
    errors.ingredients = [{ name: 'required' }]
  } else {
    const ingredientErrors = draft.ingredients.map(ingredient => validateIngredient(ingredient, draft.trackingLevel))
    if (ingredientErrors.some(row => Object.keys(row).length > 0)) errors.ingredients = ingredientErrors
  }

  return errors
}

export function validateIntakePlan(
  plan: IntakePlanDraft,
  level: TrackingLevel,
): IntakePlanValidationErrors {
  const errors: IntakePlanValidationErrors = {}
  if (!plan.name.trim()) errors.name = 'required'
  if (!plan.frequency.trim()) errors.frequency = 'required'
  if (!plan.routineGroup) errors.routineGroup = 'required'
  if (trackingCapabilities(level).quantity) {
    if (plan.dose == null || plan.dose <= 0) errors.dose = 'required'
    if (!plan.unit?.trim()) errors.unit = 'required'
  }
  return errors
}
