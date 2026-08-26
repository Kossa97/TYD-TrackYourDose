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
  method?: string
  frequency?: string
  xDaysInterval?: string
  scheduleDays?: string
  startDate?: string
  routineGroup?: string
}

export const MIN_EVERY_X_DAYS = 2
export const MAX_EVERY_X_DAYS = 30
export const VALID_SCHEDULE_DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

export function validateRecurrence(
  frequency: string,
  xDaysInterval: number | null,
  scheduleDays: string[],
): Pick<IntakePlanValidationErrors, 'xDaysInterval' | 'scheduleDays'> {
  if (
    frequency === 'Alle X Tage'
    && (
      xDaysInterval == null
      || !Number.isFinite(xDaysInterval)
      || !Number.isInteger(xDaysInterval)
      || xDaysInterval < MIN_EVERY_X_DAYS
      || xDaysInterval > MAX_EVERY_X_DAYS
    )
  ) return { xDaysInterval: 'invalid_interval' }

  if (frequency === 'Wochentage wählen') {
    const validDays = new Set<string>(VALID_SCHEDULE_DAYS)
    if (
      scheduleDays.length === 0
      || scheduleDays.some(day => !validDays.has(day))
      || new Set(scheduleDays).size !== scheduleDays.length
    ) return { scheduleDays: 'invalid_weekdays' }
  }

  return {}
}

function validateIngredient(
  ingredient: StackItemIngredient,
  level: TrackingLevel,
): IngredientValidationErrors {
  const errors: IngredientValidationErrors = {}
  const catalogSubstanceId = ingredient.catalog_substance_id?.trim()

  if (!catalogSubstanceId && !ingredient.custom_name.trim()) errors.name = 'required'
  if (trackingCapabilities(level).productStrength) {
    if (
      ingredient.amount_value === null
      || !Number.isFinite(ingredient.amount_value)
      || ingredient.amount_value <= 0
    ) errors.amountValue = 'required_for_complete'
    if (!ingredient.amount_unit?.trim()) errors.amountUnit = 'required_for_complete'
    if (
      ingredient.basis_value === null
      || !Number.isFinite(ingredient.basis_value)
      || ingredient.basis_value <= 0
    ) errors.basisValue = 'required_for_complete'
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
  if (!plan.method.trim()) errors.method = 'required'
  if (!plan.frequency.trim()) errors.frequency = 'required'
  Object.assign(errors, validateRecurrence(plan.frequency, plan.xDaysInterval, plan.scheduleDays))
  if (!plan.startDate.trim()) errors.startDate = 'required'
  if (!plan.routineGroup) errors.routineGroup = 'required'
  if (trackingCapabilities(level).quantity) {
    if (plan.dose == null || !Number.isFinite(plan.dose) || plan.dose <= 0) errors.dose = 'required'
    if (!plan.unit?.trim()) errors.unit = 'required'
  }
  return errors
}
