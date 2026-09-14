import type { IntakePlanDraft, StackItemDraft, StackItemIngredient, TrackingLevel } from '../types'
import { MAX_INTAKE_SLOTS, isOnDemand } from './intakeFrequency'
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
  endDate?: string
  /** Ein Eintrag je fehlerhaftem Einnahmezeitpunkt, in derselben Reihenfolge. */
  slots?: string[]
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

  // Ein Ende VOR dem Start ist keine Kur, sondern ein Tippfehler. Leer bleibt
  // erlaubt: das ist der Dauerfall und der haeufigere.
  const ende = plan.endDate?.trim() ?? ''
  if (ende && plan.startDate.trim() && ende < plan.startDate.trim()) errors.endDate = 'before_start'

  // „Bei Bedarf" hat keinen geplanten Zeitpunkt — dort nach einer Tageszeit zu
  // fragen waere eine Pflichtangabe ohne Bedeutung. Jede andere Frequenz
  // braucht mindestens einen; wie viele es werden, entscheidet der Nutzer.
  if (!isOnDemand(plan.frequency)) {
    const slotFehler: string[] = plan.slots.map(slot => (slot.routineGroup ? '' : 'required'))
    if (plan.slots.length === 0) slotFehler.push('required')
    if (plan.slots.length > MAX_INTAKE_SLOTS) {
      slotFehler[MAX_INTAKE_SLOTS] = 'too_many'
    }

    // Zwei Zeitpunkte, die sich in nichts unterscheiden, sind einer. Dieselbe
    // Tageszeit zweimal ist erlaubt — aber dann mit verschiedenen Uhrzeiten,
    // sonst weiss weder die App noch der Nutzer, welcher welcher ist.
    const gesehen = new Set<string>()
    plan.slots.forEach((slot, index) => {
      const schluessel = `${slot.routineGroup}|${slot.time ?? ''}`
      if (gesehen.has(schluessel)) slotFehler[index] = 'duplicate'
      gesehen.add(schluessel)
    })

    if (slotFehler.some(Boolean)) errors.slots = slotFehler
  }
  if (trackingCapabilities(level).quantity) {
    if (plan.dose == null || !Number.isFinite(plan.dose) || plan.dose <= 0) errors.dose = 'required'
    if (!plan.unit?.trim()) errors.unit = 'required'
  }
  return errors
}
