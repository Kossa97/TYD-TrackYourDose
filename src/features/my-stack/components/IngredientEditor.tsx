import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { IngredientValidationErrors } from '../lib/validation'
import type { StackItemIngredient } from '../types'

type IngredientChanges = Partial<Omit<StackItemIngredient, 'position'>>

export interface IngredientEditorProps {
  displayName: string
  ingredients: StackItemIngredient[]
  catalogNames?: Readonly<Record<string, string>>
  errors?: IngredientValidationErrors[]
  onDisplayNameChange: (displayName: string) => void
  onIngredientChange: (index: number, changes: IngredientChanges) => void
  onAddIngredient: () => void
  onRemoveIngredient: (index: number) => void
}

export function IngredientEditor({
  displayName,
  ingredients,
  catalogNames = {},
  errors = [],
  onDisplayNameChange,
  onIngredientChange,
  onAddIngredient,
  onRemoveIngredient,
}: IngredientEditorProps) {
  const { t } = useTranslation()

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="stack-product-name" className="mb-2 block text-sm font-semibold text-slate-200">
          {t('my_stack_product_name', { defaultValue: 'Produktname' })}
        </label>
        <input
          id="stack-product-name"
          value={displayName}
          onChange={event => onDisplayNameChange(event.target.value)}
          data-field="displayName"
          className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        />
      </div>

      <div className="space-y-3">
        {ingredients.map((ingredient, index) => {
          const labelKey = `my_stack_ingredient_${index + 1}`
          const fieldError = errors[index]?.name
          const catalogName = ingredient.catalog_substance_id
            ? catalogNames[ingredient.catalog_substance_id]
            : undefined

          return (
            <div key={`${ingredient.position}-${ingredient.catalog_substance_id ?? 'custom'}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor={`stack-ingredient-${index}`} className="text-sm font-semibold text-slate-200">
                  {t(labelKey, { defaultValue: `Inhaltsstoff ${index + 1}` })}
                </label>
                {ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveIngredient(index)}
                    aria-label={String(t('remove', { defaultValue: 'Entfernen' }))}
                    className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl text-slate-400 transition-colors duration-200 hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                )}
              </div>
              {catalogName ? (
                <input
                  id={`stack-ingredient-${index}`}
                  value={catalogName}
                  readOnly
                  aria-readonly="true"
                  className="min-h-11 w-full rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-3 font-medium text-sky-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              ) : (
                <input
                  id={`stack-ingredient-${index}`}
                  value={ingredient.custom_name}
                  onChange={event => onIngredientChange(index, { custom_name: event.target.value, catalog_substance_id: null })}
                  data-field={`ingredients.${index}.name`}
                  aria-invalid={Boolean(fieldError) || undefined}
                  aria-describedby={fieldError ? `stack-ingredient-${index}-error` : undefined}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              )}
              {fieldError && (
                <p id={`stack-ingredient-${index}-error`} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
                  <AlertCircle aria-hidden="true" size={16} />
                  {t('my_stack_ingredient_required', { defaultValue: 'Bitte benenne den Inhaltsstoff.' })}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onAddIngredient}
        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-semibold text-slate-200 transition-colors duration-200 hover:border-sky-400/25 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
      >
        <Plus aria-hidden="true" size={18} />
        {t('my_stack_add_ingredient', { defaultValue: 'Inhaltsstoff hinzufügen' })}
      </button>
    </div>
  )
}
