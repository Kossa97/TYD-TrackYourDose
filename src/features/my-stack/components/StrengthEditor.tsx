import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getDosageForm } from '../lib/dosageForms'
import type { IngredientValidationErrors } from '../lib/validation'
import type { DosageFormKey, StackItemIngredient } from '../types'

type IngredientChanges = Partial<Omit<StackItemIngredient, 'position'>>

export interface StrengthEditorProps {
  dosageForm: DosageFormKey
  ingredient: StackItemIngredient
  ingredientIndex: number
  ingredientName?: string
  errors?: IngredientValidationErrors
  onChange: (changes: IngredientChanges) => void
}

function numericValue(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function StrengthEditor({
  dosageForm,
  ingredient,
  ingredientIndex,
  ingredientName,
  errors = {},
  onChange,
}: StrengthEditorProps) {
  const { t } = useTranslation()
  const form = getDosageForm(dosageForm)
  const amountUnits = ingredient.amount_unit && !form.suggestedUnits.includes(ingredient.amount_unit)
    ? [...form.suggestedUnits, ingredient.amount_unit]
    : form.suggestedUnits
  const basisUnits = ingredient.basis_unit && !form.basisUnits.includes(ingredient.basis_unit)
    ? [...form.basisUnits, ingredient.basis_unit]
    : form.basisUnits

  const amountValueErrorId = `stack-strength-${ingredientIndex}-amount-value-error`
  const amountUnitErrorId = `stack-strength-${ingredientIndex}-amount-unit-error`
  const basisValueErrorId = `stack-strength-${ingredientIndex}-basis-value-error`
  const basisUnitErrorId = `stack-strength-${ingredientIndex}-basis-unit-error`
  const displayedIngredientName = ingredientName || t(
    `my_stack_ingredient_${ingredientIndex + 1}`,
    { defaultValue: `Inhaltsstoff ${ingredientIndex + 1}` },
  )
  const hasPreview = (
    ingredient.amount_value !== null
    && Boolean(ingredient.amount_unit?.trim())
    && ingredient.basis_value !== null
    && Boolean(ingredient.basis_unit?.trim())
  )

  return (
    <fieldset className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <legend className="px-1 text-sm font-semibold text-slate-200">
        {displayedIngredientName}
      </legend>

      <p className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-xs leading-relaxed text-slate-400">
        {t('my_stack_no_dosage_advice', { defaultValue: 'Wie viel Wirkstoff ist in welcher Produktmenge enthalten? Trage ein, was auf der Verpackung steht. Beispiel: 250 mg/ml = 250 mg pro 1 ml. Keine Dosierungsempfehlung.' })}
      </p>

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
        <div className="min-w-0">
          <label htmlFor={`stack-strength-${ingredientIndex}-amount-value`} className="mb-2 block text-sm font-medium text-slate-300">
            {t('my_stack_strength_value', { defaultValue: 'Wirkstoffmenge' })}
          </label>
          <input
            id={`stack-strength-${ingredientIndex}-amount-value`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={ingredient.amount_value ?? ''}
            onChange={event => onChange({ amount_value: numericValue(event.target.value) })}
            data-field={`ingredients.${ingredientIndex}.amountValue`}
            aria-invalid={Boolean(errors.amountValue) || undefined}
            aria-describedby={errors.amountValue ? amountValueErrorId : undefined}
            className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          {errors.amountValue && (
            <p id={amountValueErrorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
              <AlertCircle aria-hidden="true" size={16} />
              {t('my_stack_strength_value_required', { defaultValue: 'Bitte gib die Wirkstoffmenge an.' })}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor={`stack-strength-${ingredientIndex}-amount-unit`} className="mb-2 block text-sm font-medium text-slate-300">
            {t('my_stack_strength_unit', { defaultValue: 'Wirkstoffeinheit' })}
          </label>
          <input
            id={`stack-strength-${ingredientIndex}-amount-unit`}
            list={`stack-strength-${ingredientIndex}-amount-units`}
            value={ingredient.amount_unit ?? ''}
            onChange={event => onChange({ amount_unit: event.target.value || null })}
            data-field={`ingredients.${ingredientIndex}.amountUnit`}
            aria-invalid={Boolean(errors.amountUnit) || undefined}
            aria-describedby={errors.amountUnit ? amountUnitErrorId : undefined}
            autoComplete="off"
            className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          <datalist id={`stack-strength-${ingredientIndex}-amount-units`}>
            {amountUnits.map(unit => <option key={unit} value={unit} />)}
          </datalist>
          {errors.amountUnit && (
            <p id={amountUnitErrorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
              <AlertCircle aria-hidden="true" size={16} />
              {t('my_stack_strength_unit_required', { defaultValue: 'Bitte wähle eine Wirkstoffeinheit.' })}
            </p>
          )}
        </div>

        <div className="col-span-2 min-w-0 sm:col-span-1">
          <span aria-hidden="true" className="mb-2 hidden h-5 sm:block">&nbsp;</span>
          <span className="flex min-h-6 items-center justify-center text-sm font-semibold text-cyan-300 sm:min-h-11">
            {t('my_stack_per', { defaultValue: 'pro' })}
          </span>
        </div>

        <div className="min-w-0">
          <label htmlFor={`stack-strength-${ingredientIndex}-basis-value`} className="mb-2 block text-sm font-medium text-slate-300">
            {t('my_stack_basis_value', { defaultValue: 'Produktmenge' })}
          </label>
          <input
            id={`stack-strength-${ingredientIndex}-basis-value`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={ingredient.basis_value ?? ''}
            onChange={event => onChange({ basis_value: numericValue(event.target.value) })}
            data-field={`ingredients.${ingredientIndex}.basisValue`}
            aria-invalid={Boolean(errors.basisValue) || undefined}
            aria-describedby={errors.basisValue ? basisValueErrorId : undefined}
            className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          {errors.basisValue && (
            <p id={basisValueErrorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
              <AlertCircle aria-hidden="true" size={16} />
              {t('my_stack_basis_value_required', { defaultValue: 'Bitte gib die Produktmenge an.' })}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor={`stack-strength-${ingredientIndex}-basis-unit`} className="mb-2 block text-sm font-medium text-slate-300">
            {t('my_stack_basis_unit', { defaultValue: 'Produkteinheit' })}
          </label>
          <input
            id={`stack-strength-${ingredientIndex}-basis-unit`}
            list={`stack-strength-${ingredientIndex}-basis-units`}
            value={ingredient.basis_unit ?? ''}
            onChange={event => onChange({ basis_unit: event.target.value || null })}
            data-field={`ingredients.${ingredientIndex}.basisUnit`}
            aria-invalid={Boolean(errors.basisUnit) || undefined}
            aria-describedby={errors.basisUnit ? basisUnitErrorId : undefined}
            autoComplete="off"
            className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          <datalist id={`stack-strength-${ingredientIndex}-basis-units`}>
            {basisUnits.map(unit => <option key={unit} value={unit} />)}
          </datalist>
          {errors.basisUnit && (
            <p id={basisUnitErrorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
              <AlertCircle aria-hidden="true" size={16} />
              {t('my_stack_basis_unit_required', { defaultValue: 'Bitte wähle eine Produkteinheit.' })}
            </p>
          )}
        </div>
      </div>

      {hasPreview && (
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-4 rounded-xl border border-cyan-400/15 bg-cyan-400/[0.05] px-3 py-2 text-sm text-cyan-100"
        >
          {displayedIngredientName}: {ingredient.amount_value} {ingredient.amount_unit} {t('my_stack_per', { defaultValue: 'pro' })} {ingredient.basis_value} {ingredient.basis_unit}
        </p>
      )}
    </fieldset>
  )
}
