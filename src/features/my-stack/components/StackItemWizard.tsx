import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  LoaderCircle,
  Save,
  X,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { findDuplicate } from '../services/stackItems'
import type { StackItem, StackItemDraft, SubstanceCatalogEntry } from '../types'
import {
  RENDERED_WIZARD_STEPS,
  didIdentityChange,
  firstInvalidField,
  initialWizardState,
  wizardReducer,
  type WizardSaveMode,
  type WizardStep,
} from '../lib/wizardState'
import { validateStackItemDraft } from '../lib/validation'
import { DosageFormPicker } from './DosageFormPicker'
import { IngredientEditor } from './IngredientEditor'
import { StrengthEditor } from './StrengthEditor'
import { SubstanceSearch } from './SubstanceSearch'

export interface StackItemWizardProps {
  catalogEntries: SubstanceCatalogEntry[]
  existingItems: StackItem[]
  existingItem?: StackItem
  catalogUnavailable?: boolean
  onClose: () => void
  onSave: (draft: StackItemDraft, mode: WizardSaveMode) => Promise<void>
  onOpenExisting: (item: StackItem) => void
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const STEP_LABEL_KEYS: Record<Exclude<WizardStep, 'tracking'>, string> = {
  substance: 'my_stack_step_substance',
  ingredients: 'my_stack_step_ingredients',
  dosage_form: 'my_stack_step_dosage_form',
  strength: 'my_stack_step_strength',
  details: 'my_stack_step_details',
  review: 'my_stack_step_review',
}

function stepForInvalidField(field: string): WizardStep {
  if (field === 'displayName' || field === 'category') return 'substance'
  if (field === 'dosageForm') return 'dosage_form'
  if (field.endsWith('.name')) return 'ingredients'
  return 'strength'
}

export function StackItemWizard({
  catalogEntries,
  existingItems,
  existingItem,
  catalogUnavailable = false,
  onClose,
  onSave,
  onOpenExisting,
}: StackItemWizardProps) {
  const { t } = useTranslation()
  const [state, dispatch] = useReducer(wizardReducer, existingItem, initialWizardState)
  const [showErrors, setShowErrors] = useState(false)
  const [identityChoiceMade, setIdentityChoiceMade] = useState(false)
  const [identityChoiceError, setIdentityChoiceError] = useState(false)
  const [duplicateCandidate, setDuplicateCandidate] = useState<StackItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  const currentStepIndex = RENDERED_WIZARD_STEPS.indexOf(state.step)
  const validationErrors = showErrors ? validateStackItemDraft(state.draft) : {}
  const catalogNames = useMemo(() => Object.fromEntries(
    catalogEntries.map(entry => [entry.id, entry.canonical_name]),
  ), [catalogEntries])
  const matchingEntries = useMemo(() => {
    const normalizedQuery = state.draft.displayName.trim().toLocaleLowerCase()
    if (!normalizedQuery) return []

    return catalogEntries.filter(entry => (
      entry.canonical_name.toLocaleLowerCase().includes(normalizedQuery)
      || entry.aliases.some(alias => alias.toLocaleLowerCase().includes(normalizedQuery))
    ))
  }, [catalogEntries, state.draft.displayName])
  const identityChanged = Boolean(state.original && didIdentityChange(state.original, state.draft))

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    dialogRef.current?.querySelector<HTMLElement>('[data-step-autofocus]')?.focus()

    return () => returnFocusRef.current?.focus()
  }, [])

  function focusField(field: string): void {
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>(`[data-field="${field}"]`)?.focus()
    })
  }

  function selectStep(step: WizardStep): void {
    dispatch({ type: 'step_selected', step })
    setShowErrors(false)
    setSaveError(null)
    setDuplicateCandidate(null)
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-step-autofocus]')?.focus()
    })
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'Tab') {
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      ).filter(element => element.offsetParent !== null)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  function handleContinue(): void {
    const invalidField = firstInvalidField(state)
    if (invalidField) {
      setShowErrors(true)
      focusField(invalidField)
      return
    }

    const nextStep = RENDERED_WIZARD_STEPS[currentStepIndex + 1]
    if (nextStep) selectStep(nextStep)
  }

  function handleBack(): void {
    const previousStep = RENDERED_WIZARD_STEPS[currentStepIndex - 1]
    if (previousStep) selectStep(previousStep)
    else onClose()
  }

  function chooseSaveMode(mode: Extract<WizardSaveMode, 'update' | 'duplicate'>): void {
    dispatch({ type: 'save_mode_selected', mode })
    setIdentityChoiceMade(true)
    setIdentityChoiceError(false)
  }

  async function handleSave(allowDuplicate = false): Promise<void> {
    const invalidField = firstInvalidField(state)
    if (invalidField) {
      const invalidStep = stepForInvalidField(invalidField)
      setShowErrors(true)
      if (state.step !== invalidStep) dispatch({ type: 'step_selected', step: invalidStep })
      focusField(invalidField)
      return
    }

    if (identityChanged && !identityChoiceMade) {
      setIdentityChoiceError(true)
      focusField('saveMode')
      return
    }

    const duplicate = findDuplicate(existingItems, state.draft)
    if (duplicate && !allowDuplicate) {
      setDuplicateCandidate(duplicate)
      setSaveError(null)
      return
    }

    const mode: WizardSaveMode = allowDuplicate
      ? 'duplicate'
      : identityChanged ? state.saveMode : state.original ? 'update' : 'create'
    const draftForSave = mode === 'duplicate'
      ? { ...state.draft, id: undefined }
      : state.draft

    setSaving(true)
    setSaveError(null)
    try {
      await onSave(draftForSave, mode)
      onClose()
    } catch {
      setSaveError(String(t('my_stack_save_error', {
        defaultValue: 'Speichern ist fehlgeschlagen. Deine Eingaben bleiben erhalten. Bitte versuche es erneut.',
      })))
    } finally {
      setSaving(false)
    }
  }

  function renderStep() {
    switch (state.step) {
      case 'substance':
        return (
          <SubstanceSearch
            query={state.draft.displayName}
            entries={matchingEntries}
            category={state.draft.category}
            catalogUnavailable={catalogUnavailable}
            nameError={showErrors && !state.draft.displayName.trim()}
            categoryError={showErrors && !state.draft.category}
            onQueryChange={value => {
              dispatch({ type: 'custom_started', name: value })
              setShowErrors(false)
            }}
            onSelect={entry => {
              dispatch({ type: 'catalog_selected', entry })
              setShowErrors(false)
            }}
            onAddCustom={name => {
              dispatch({ type: 'custom_started', name })
              setShowErrors(false)
            }}
            onCategoryChange={category => dispatch({ type: 'category_selected', category })}
          />
        )
      case 'ingredients':
        return (
          <IngredientEditor
            displayName={state.draft.displayName}
            ingredients={state.draft.ingredients}
            catalogNames={catalogNames}
            errors={validationErrors.ingredients}
            onDisplayNameChange={displayName => dispatch({ type: 'display_name_changed', displayName })}
            onIngredientChange={(index, changes) => dispatch({ type: 'ingredient_changed', index, changes })}
            onAddIngredient={() => dispatch({ type: 'ingredient_added' })}
            onRemoveIngredient={index => dispatch({ type: 'ingredient_removed', index })}
          />
        )
      case 'dosage_form':
        return (
          <DosageFormPicker
            value={state.draft.dosageForm}
            error={showErrors && Boolean(validationErrors.dosageForm)}
            onSelect={dosageForm => dispatch({ type: 'dosage_form_selected', dosageForm })}
          />
        )
      case 'strength':
        return state.draft.dosageForm ? (
          <div className="space-y-4">
            {state.draft.ingredients.map((ingredient, index) => (
              <StrengthEditor
                key={`${ingredient.position}-${ingredient.catalog_substance_id ?? 'custom'}`}
                dosageForm={state.draft.dosageForm!}
                ingredient={ingredient}
                ingredientIndex={index}
                ingredientName={ingredient.catalog_substance_id
                  ? catalogNames[ingredient.catalog_substance_id]
                  : ingredient.custom_name}
                errors={validationErrors.ingredients?.[index]}
                onChange={changes => dispatch({ type: 'ingredient_changed', index, changes })}
              />
            ))}
          </div>
        ) : null
      case 'details':
        return (
          <div className="space-y-5">
            <div>
              <label htmlFor="stack-brand" className="mb-2 block text-sm font-semibold text-slate-200">
                {t('my_stack_brand_optional', { defaultValue: 'Marke (optional)' })}
              </label>
              <input
                id="stack-brand"
                value={state.draft.brand}
                onChange={event => dispatch({ type: 'details_changed', changes: { brand: event.target.value } })}
                className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            </div>
            <div>
              <label htmlFor="stack-color" className="mb-2 block text-sm font-semibold text-slate-200">
                {t('my_stack_color_optional', { defaultValue: 'Farbe (optional)' })}
              </label>
              <input
                id="stack-color"
                value={state.draft.colorHex}
                onChange={event => dispatch({ type: 'details_changed', changes: { colorHex: event.target.value } })}
                placeholder="#00ccf5"
                className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            </div>
            <div>
              <label htmlFor="stack-notes" className="mb-2 block text-sm font-semibold text-slate-200">
                {t('my_stack_notes_optional', { defaultValue: 'Notizen (optional)' })}
              </label>
              <textarea
                id="stack-notes"
                rows={4}
                value={state.draft.notes}
                onChange={event => dispatch({ type: 'details_changed', changes: { notes: event.target.value } })}
                className="input min-h-11 w-full resize-y text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            </div>
          </div>
        )
      case 'review':
        return (
          <div className="space-y-5">
            {identityChanged && (
              <fieldset
                data-field="saveMode"
                tabIndex={-1}
                aria-invalid={identityChoiceError || undefined}
                aria-describedby={identityChoiceError ? 'stack-save-mode-error' : undefined}
                className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-4"
              >
                <legend className="px-1 text-sm font-semibold text-sky-100">
                  {t('my_stack_identity_changed', { defaultValue: 'Wie möchtest du mit der geänderten Variante fortfahren?' })}
                </legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    aria-pressed={identityChoiceMade && state.saveMode === 'update'}
                    onClick={() => chooseSaveMode('update')}
                    className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 transition-colors duration-200 hover:border-sky-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
                  >
                    {t('my_stack_update_existing', { defaultValue: 'Bestehenden Eintrag ändern' })}
                  </button>
                  <button
                    type="button"
                    aria-pressed={identityChoiceMade && state.saveMode === 'duplicate'}
                    onClick={() => chooseSaveMode('duplicate')}
                    className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-slate-200 transition-colors duration-200 hover:border-sky-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
                  >
                    {t('my_stack_create_variant', { defaultValue: 'Als neue Variante anlegen' })}
                  </button>
                </div>
                {identityChoiceError && (
                  <p id="stack-save-mode-error" role="alert" className="mt-3 text-sm text-rose-300">
                    {t('my_stack_variant_choice_required', { defaultValue: 'Bitte wähle, wie die Variante gespeichert werden soll.' })}
                  </p>
                )}
              </fieldset>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <h3 className="font-semibold text-white">{state.draft.displayName}</h3>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_category', { defaultValue: 'Kategorie' })}</dt>
                  <dd className="font-medium text-slate-200">{state.draft.category && t(`stack_category_${state.draft.category}`)}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}</dt>
                  <dd className="font-medium text-slate-200">{state.draft.dosageForm && t(`dosage_form_${state.draft.dosageForm}`)}</dd>
                </div>
                {state.draft.ingredients.map((ingredient, index) => (
                  <div key={ingredient.position} className="border-t border-white/10 pt-3">
                    <dt className="text-slate-400">
                      {ingredient.catalog_substance_id
                        ? catalogNames[ingredient.catalog_substance_id]
                        : ingredient.custom_name || t(`my_stack_ingredient_${index + 1}`)}
                    </dt>
                    <dd className="mt-1 break-words font-medium text-slate-200">
                      {ingredient.amount_value} {ingredient.amount_unit} / {ingredient.basis_value} {ingredient.basis_unit}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {duplicateCandidate && (
              <div role="alert" className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.07] p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-300" size={19} />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-amber-100">
                      {t('my_stack_duplicate_found', { defaultValue: 'Diese Variante ist bereits in My Stack.' })}
                    </h3>
                    <p className="mt-1 break-words text-sm text-amber-100/80">{duplicateCandidate.display_name}</p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenExisting(duplicateCandidate)
                      onClose()
                    }}
                    className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 motion-reduce:transition-none"
                  >
                    <ExternalLink aria-hidden="true" size={18} />
                    {t('my_stack_open_existing', { defaultValue: 'Bestehenden Eintrag öffnen' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave(true)}
                    disabled={saving}
                    className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-semibold text-slate-200 transition-colors duration-200 hover:border-sky-400/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  >
                    {t('my_stack_add_separately', { defaultValue: 'Trotzdem separat hinzufügen' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDuplicateCandidate(null)}
                    className="min-h-11 cursor-pointer rounded-xl px-4 py-3 font-semibold text-slate-400 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
                  >
                    {t('cancel', { defaultValue: 'Abbrechen' })}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      case 'tracking':
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/80 p-0 sm:items-center sm:p-3" data-app-modal>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stack-item-wizard-title"
        aria-describedby="stack-item-wizard-description"
        onKeyDown={handleDialogKeyDown}
        className="flex h-[100dvh] max-h-[100dvh] w-full min-w-0 flex-col overflow-hidden border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] sm:max-w-2xl sm:rounded-3xl sm:border"
      >
        <header className="shrink-0 border-b border-white/10 px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-400">
                {t('my_stack_title', { defaultValue: 'My Stack' })}
              </p>
              <h2 id="stack-item-wizard-title" className="mt-1 text-xl font-bold text-white">
                {existingItem
                  ? t('my_stack_edit_item', { defaultValue: 'Eintrag bearbeiten' })
                  : t('my_stack_add_item', { defaultValue: 'Substanz hinzufügen' })}
              </h2>
              <p id="stack-item-wizard-description" className="mt-1 text-sm leading-relaxed text-slate-400">
                {t(STEP_LABEL_KEYS[state.step as Exclude<WizardStep, 'tracking'>])}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label={String(t('close', { defaultValue: 'Schließen' }))}
              className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl text-slate-400 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={RENDERED_WIZARD_STEPS.length} aria-valuenow={currentStepIndex + 1}>
            {RENDERED_WIZARD_STEPS.map((step, index) => (
              <span
                key={step}
                className={`h-1.5 flex-1 rounded-full ${index <= currentStepIndex ? 'bg-sky-400' : 'bg-white/10'}`}
              />
            ))}
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-5 sm:px-6" data-step-autofocus tabIndex={-1}>
          {renderStep()}
          {saveError && (
            <p role="alert" className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] p-4 text-sm text-rose-100">
              <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
              {saveError}
            </p>
          )}
        </main>

        <footer className="flex shrink-0 gap-3 border-t border-white/10 bg-slate-950/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={saving}
            className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 font-semibold text-slate-300 transition-colors duration-200 hover:border-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            <ArrowLeft aria-hidden="true" size={18} />
            <span className="hidden sm:inline">
              {currentStepIndex === 0 ? t('cancel', { defaultValue: 'Abbrechen' }) : t('back', { defaultValue: 'Zurück' })}
            </span>
          </button>

          {state.step === 'review' ? (
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || Boolean(duplicateCandidate)}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 font-bold text-slate-950 transition-colors duration-200 hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {saving ? (
                <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" size={18} />
              ) : (
                <Save aria-hidden="true" size={18} />
              )}
              {saving ? t('loading', { defaultValue: 'Speichert …' }) : t('save', { defaultValue: 'Speichern' })}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleContinue}
              disabled={saving}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 font-bold text-slate-950 transition-colors duration-200 hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              {currentStepIndex === RENDERED_WIZARD_STEPS.length - 2 ? <Check aria-hidden="true" size={18} /> : <ArrowRight aria-hidden="true" size={18} />}
              {t('continue', { defaultValue: 'Weiter' })}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
