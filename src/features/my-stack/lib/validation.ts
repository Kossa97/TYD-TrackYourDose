import type { StackItemDraft, StackItemIngredient } from '../types'

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

function validateIngredient(ingredient: StackItemIngredient): IngredientValidationErrors {
  const errors: IngredientValidationErrors = {}

  if (!ingredient.catalog_substance_id && !ingredient.custom_name.trim()) errors.name = 'required'
  if (ingredient.amount_value === null) errors.amountValue = 'required'
  if (!ingredient.amount_unit?.trim()) errors.amountUnit = 'required'
  if (ingredient.basis_value === null) errors.basisValue = 'required'
  if (!ingredient.basis_unit?.trim()) errors.basisUnit = 'required'

  return errors
}

export function validateStackItemDraft(draft: StackItemDraft): StackItemDraftValidationErrors {
  const errors: StackItemDraftValidationErrors = {}

  if (!draft.dosageForm) errors.dosageForm = 'required'

  if (draft.ingredients.length === 0) {
    errors.ingredients = [{ name: 'required' }]
  } else {
    const ingredientErrors = draft.ingredients.map(validateIngredient)
    if (ingredientErrors.some(row => Object.keys(row).length > 0)) errors.ingredients = ingredientErrors
  }

  return errors
}
