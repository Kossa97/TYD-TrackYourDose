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
import type { StackItem, StackItemSetupDraft, SubstanceCatalogEntry } from '../types'
import {
  didIdentityChange,
  firstInvalidField,
  initialWizardState,
  wizardReducer,
  wizardSteps,
  type WizardSaveMode,
  type WizardStep,
} from '../lib/wizardState'
import { validateIntakePlan, validateStackItemDraft } from '../lib/validation'
import { evaluatePkReadiness, toPkMilligrams } from '../lib/pkReadiness'
import { DosageFormPicker } from './DosageFormPicker'
import { IngredientEditor } from './IngredientEditor'
import { IntakePlanEditor } from './IntakePlanEditor'
import { StrengthEditor } from './StrengthEditor'
import { TrackingLevelPicker } from './TrackingLevelPicker'
import { SubstanceSearch } from './SubstanceSearch'

export interface StackItemWizardProps {
  catalogEntries: SubstanceCatalogEntry[]
  existingItems: StackItem[]
  existingItem?: StackItem
  existingPlan?: StackItemSetupDraft['plan']
  initialColorHex?: string
  catalogUnavailable?: boolean
  onClose: () => void
  onSave: (draft: StackItemSetupDraft, mode: WizardSaveMode) => Promise<void>
  onOpenExisting: (item: StackItem) => void
  intent?: 'pk'
}

function pkIntentSteps(
  item: StackItem,
  plan: StackItemSetupDraft['plan'] | undefined,
): WizardStep[] {
  const steps: WizardStep[] = []
  if (item.tracking_level !== 'complete') steps.push('tracking_level')
  const strengthMissing = item.ingredients.some(ingredient => (
    ingredient.amount_value == null
    || !Number.isFinite(ingredient.amount_value)
    || ingredient.amount_value <= 0
    || !ingredient.amount_unit?.trim()
    || ingredient.basis_value == null
    || !Number.isFinite(ingredient.basis_value)
    || ingredient.basis_value <= 0
    || !ingredient.basis_unit?.trim()
  ))
  if (strengthMissing) steps.push('strength')
  const methodMatches = Boolean(
    plan?.method.trim()
    && item.pk_profile_method?.trim().toLocaleLowerCase() === plan.method.trim().toLocaleLowerCase(),
  )
  const planNeedsAttention = !methodMatches
    || plan?.dose == null
    || !plan.unit?.trim()
    || !plan.time?.trim()
    || (plan.dose != null && plan.unit != null && toPkMilligrams(plan.dose, plan.unit) == null)
  if (planNeedsAttention) steps.push('plan')
  return steps.length ? steps : ['plan']
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

const STEP_LABELS: Record<WizardStep, { key: string; defaultValue: string }> = {
  substance: { key: 'my_stack_step_substance', defaultValue: 'Substanz' },
  ingredients: { key: 'my_stack_step_ingredients', defaultValue: 'Inhaltsstoffe' },
  dosage_form: { key: 'my_stack_step_dosage_form', defaultValue: 'Darreichungsform' },
  tracking_level: { key: 'my_stack_step_tracking_level', defaultValue: 'Tracking-Tiefe' },
  strength: { key: 'my_stack_step_strength', defaultValue: 'Stärke' },
  details: { key: 'my_stack_step_details', defaultValue: 'Details' },
  plan: { key: 'my_stack_step_plan', defaultValue: 'Einnahmeplan' },
  review: { key: 'my_stack_step_review', defaultValue: 'Zusammenfassung' },
}

function stepForInvalidField(field: string): WizardStep {
  if (field === 'displayName' || field === 'category') return 'substance'
  if (field === 'dosageForm') return 'dosage_form'
  if (field === 'trackingLevel') return 'tracking_level'
  if (field.startsWith('plan.')) return 'plan'
  if (field.endsWith('.name')) return 'ingredients'
  return 'strength'
}

export function StackItemWizard({
  catalogEntries,
  existingItems,
  existingItem,
  existingPlan,
  catalogUnavailable = false,
  initialColorHex = '',
  onClose,
  onSave,
  onOpenExisting,
  intent,
}: StackItemWizardProps) {
  const { t } = useTranslation()
  const pkIntentStepsRef = useRef<WizardStep[] | null>(null)
  const [state, dispatch] = useReducer(
    wizardReducer,
    undefined,
    () => {
      const initial = initialWizardState(existingItem, initialColorHex, existingPlan)
      if (intent === 'pk' && existingItem) {
        const intentSteps = pkIntentSteps(existingItem, existingPlan)
        pkIntentStepsRef.current = intentSteps
        initial.step = intentSteps[0]
      }
      return initial
    },
  )
  const [pkProfileMethod, setPkProfileMethod] = useState(existingItem?.pk_profile_method ?? null)
  const [pkIntentError, setPkIntentError] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [identityChoiceMade, setIdentityChoiceMade] = useState(false)
  const [identityChoiceError, setIdentityChoiceError] = useState(false)
  const [duplicateCandidate, setDuplicateCandidate] = useState<StackItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const duplicateActionRef = useRef<HTMLButtonElement>(null)

  const steps = intent === 'pk' && pkIntentStepsRef.current
    ? pkIntentStepsRef.current
    : wizardSteps(state)
  const currentStepIndex = steps.indexOf(state.step)
  const validationErrors = showErrors ? validateStackItemDraft(state.draft) : {}
  const planValidationErrors = showErrors
    ? validateIntakePlan(state.draft.plan, state.draft.trackingLevel)
    : {}
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
  const selectedCatalogEntry = useMemo(() => {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]))
    return [...state.draft.ingredients]
      .sort((a, b) => a.position - b.position)
      .map(ingredient => ingredient.catalog_substance_id
        ? catalogById.get(ingredient.catalog_substance_id)
        : undefined)
      .find((entry): entry is SubstanceCatalogEntry => Boolean(entry))
  }, [catalogEntries, state.draft.ingredients])
  const selectedPkCatalogEntry = useMemo(() => {
    const catalogById = new Map(catalogEntries.map(entry => [entry.id, entry]))
    return [...state.draft.ingredients]
      .sort((a, b) => a.position - b.position)
      .map(ingredient => ingredient.catalog_substance_id
        ? catalogById.get(ingredient.catalog_substance_id)
        : undefined)
      .find((entry): entry is SubstanceCatalogEntry => Boolean(entry?.pk_profile_id))
  }, [catalogEntries, state.draft.ingredients])
  const identityChanged = Boolean(state.original && didIdentityChange(state.original, state.draft))

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    dialogRef.current?.querySelector<HTMLElement>('[data-step-autofocus]')?.focus()

    return () => returnFocusRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!duplicateCandidate) return
    requestAnimationFrame(() => {
      duplicateActionRef.current?.focus()
    })
  }, [duplicateCandidate])

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
    setPkIntentError(null)
    requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLElement>('[data-step-autofocus]')?.focus()
    })
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (saving) event.stopPropagation()
      else onClose()
      return
    }

    if (event.key === 'Tab') {
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      )
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

    const nextStep = steps[currentStepIndex + 1]
    if (nextStep) selectStep(nextStep)
    else if (intent === 'pk') void handleSave()
  }

  function handleBack(): void {
    if (saving) return
    const previousStep = steps[currentStepIndex - 1]
    if (previousStep) selectStep(previousStep)
    else onClose()
  }

  function chooseSaveMode(mode: Extract<WizardSaveMode, 'update' | 'duplicate'>): void {
    dispatch({ type: 'save_mode_selected', mode })
    setIdentityChoiceMade(true)
    setIdentityChoiceError(false)
  }

  async function handleSave(allowDuplicate = false): Promise<void> {
    if (saving) return
    const invalidField = firstInvalidField(state)
    if (invalidField) {
      const invalidStep = stepForInvalidField(invalidField)
      setShowErrors(true)
      if (state.step !== invalidStep) dispatch({ type: 'step_selected', step: invalidStep })
      focusField(invalidField)
      return
    }

    if (intent === 'pk') {
      const linkedProfileId = selectedPkCatalogEntry?.pk_profile_id ?? null
      const readiness = evaluatePkReadiness({
        trackingLevel: state.draft.trackingLevel,
        pkProfileId: linkedProfileId,
        pkProfileMethod,
        method: state.draft.plan.method,
        dose: state.draft.plan.dose,
        unit: state.draft.plan.unit,
        scheduledAt: state.draft.plan.time,
      })
      if (readiness.status !== 'ready') {
        const field = readiness.status === 'unsupported'
          ? readiness.reason === 'unit_conversion' ? 'plan.unit' : 'pkProfileMethod'
          : readiness.missing[0] === 'complete_tracking' ? 'trackingLevel'
            : readiness.missing[0] === 'dose' ? 'plan.dose'
              : readiness.missing[0] === 'unit' ? 'plan.unit'
                : readiness.missing[0] === 'time' ? 'plan.time'
                  : state.draft.plan.method.trim() ? 'pkProfileMethod' : 'plan.method'
        setPkIntentError(String(t('my_stack_pk_requirements_missing', {
          defaultValue: 'Vervollständige und bestätige alle PK-Angaben, bevor du speicherst.',
        })))
        focusField(field)
        return
      }
    }

    if (identityChanged && !identityChoiceMade) {
      setIdentityChoiceError(true)
      focusField('saveMode')
      return
    }

    const draftWithPkMethod = { ...state.draft, pkProfileMethod }
    const duplicate = findDuplicate(existingItems, draftWithPkMethod)
    if (duplicate && !allowDuplicate) {
      setDuplicateCandidate(duplicate)
      setSaveError(null)
      return
    }

    const mode: WizardSaveMode = allowDuplicate
      ? 'duplicate'
      : identityChanged ? state.saveMode : state.original ? 'update' : 'create'
    const draftForSave = mode === 'duplicate'
      ? { ...draftWithPkMethod, id: undefined, plan: { ...state.draft.plan, id: undefined } }
      : draftWithPkMethod

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
            displayNameError={showErrors && !state.draft.displayName.trim()}
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
            onSelect={dosageForm => dispatch({
              type: 'dosage_form_selected',
              dosageForm,
              catalogSuggestedUnits: selectedCatalogEntry?.suggested_units,
            })}
          />
        )
      case 'tracking_level':
        return (
          <TrackingLevelPicker
            value={state.trackingLevelSelected ? state.draft.trackingLevel : null}
            substanceName={state.draft.displayName}
            pkProfileAvailable={Boolean(selectedPkCatalogEntry?.pk_profile_id)}
            error={showErrors && !state.trackingLevelSelected}
            onChange={trackingLevel => {
              dispatch({ type: 'tracking_level_selected', trackingLevel })
              setShowErrors(false)
            }}
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
      case 'plan':
        return state.draft.dosageForm ? (
          <div className="space-y-5">
            <IntakePlanEditor
              trackingLevel={state.draft.trackingLevel}
              plan={state.draft.plan}
              dosageForm={state.draft.dosageForm}
              catalogEntry={selectedCatalogEntry}
              errors={planValidationErrors}
              onChange={changes => {
                dispatch({ type: 'plan_changed', changes })
                setPkIntentError(null)
              }}
            />
            {state.draft.trackingLevel === 'complete' && selectedPkCatalogEntry?.pk_profile_id && (
              <fieldset
                data-field="pkProfileMethod"
                tabIndex={-1}
                className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <legend className="px-1 text-sm font-semibold text-sky-100">
                  {t('my_stack_pk_method_title', { defaultValue: 'PK-Route bestätigen' })}
                </legend>
                <label className="mt-2 flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed text-slate-200">
                  <input
                    type="checkbox"
                    aria-label={String(t('my_stack_pk_method_confirm', { defaultValue: 'PK-Route bestätigen' }))}
                    checked={Boolean(
                      state.draft.plan.method.trim()
                      && pkProfileMethod?.trim().toLocaleLowerCase()
                        === state.draft.plan.method.trim().toLocaleLowerCase(),
                    )}
                    disabled={!state.draft.plan.method.trim()}
                    onChange={event => {
                      setPkProfileMethod(event.target.checked ? state.draft.plan.method.trim() : null)
                      setPkIntentError(null)
                    }}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <span>
                    {state.draft.plan.method.trim()
                      ? t('my_stack_pk_method_confirm_copy', {
                          defaultValue: 'Ich bestätige {{method}} als Route für das verknüpfte PK-Profil.',
                          method: state.draft.plan.method,
                        })
                      : t('my_stack_pk_method_choose_first', {
                          defaultValue: 'Wähle zuerst eine Route im Einnahmeplan.',
                        })}
                  </span>
                </label>
                {pkIntentError && (
                  <p role="alert" className="mt-2 text-sm text-rose-300">{pkIntentError}</p>
                )}
              </fieldset>
            )}
          </div>
        ) : null
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
                  <dt className="text-slate-400">{t('my_stack_tracking_level', { defaultValue: 'Tracking-Tiefe' })}</dt>
                  <dd className="font-medium text-slate-200">
                    {state.draft.trackingLevel === 'intake_only'
                      ? t('my_stack_tracking_intake_only_title', { defaultValue: 'Nur Einnahme' })
                      : state.draft.trackingLevel === 'with_amount'
                        ? t('my_stack_tracking_with_amount_title', { defaultValue: 'Mit Menge' })
                        : t('my_stack_tracking_complete_title', { defaultValue: 'Vollständig' })}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_daily_behavior', { defaultValue: 'Im Alltag' })}</dt>
                  <dd className="text-right font-medium text-slate-200">
                    {state.draft.trackingLevel === 'intake_only'
                      ? t('my_stack_daily_intake_only', { defaultValue: 'Einnahme abhaken' })
                      : state.draft.trackingLevel === 'with_amount'
                        ? t('my_stack_daily_with_amount', { defaultValue: 'Einnahme und Menge festhalten' })
                        : t('my_stack_daily_complete', { defaultValue: 'Einnahme und Menge mit Produktkontext festhalten' })}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}</dt>
                  <dd className="font-medium text-slate-200">{state.draft.dosageForm && t(`dosage_form_${state.draft.dosageForm}`)}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_plan_frequency', { defaultValue: 'Frequenz' })}</dt>
                  <dd className="font-medium text-slate-200">{state.draft.plan.frequency}</dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_plan_routine_group', { defaultValue: 'Tageszeit' })}</dt>
                  <dd className="font-medium text-slate-200">
                    {state.draft.plan.routineGroup === 'morning'
                      ? t('my_stack_routine_morning', { defaultValue: 'Morgens' })
                      : state.draft.plan.routineGroup === 'midday'
                        ? t('my_stack_routine_midday', { defaultValue: 'Mittags' })
                        : t('my_stack_routine_evening', { defaultValue: 'Abends' })}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_plan_exact_time', { defaultValue: 'Genaue Uhrzeit' })}</dt>
                  <dd className="font-medium text-slate-200">
                    {state.draft.plan.time || t('my_stack_no_exact_time', { defaultValue: 'Nicht festgelegt' })}
                  </dd>
                </div>
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-slate-400">{t('my_stack_plan_quantity_summary', { defaultValue: 'Menge' })}</dt>
                  <dd className="font-medium text-slate-200">
                    {state.draft.trackingLevel === 'intake_only'
                      ? t('my_stack_quantity_not_tracked', { defaultValue: 'Menge wird nicht getrackt' })
                      : `${state.draft.plan.dose} ${state.draft.plan.unit}`}
                  </dd>
                </div>
                {state.draft.trackingLevel === 'complete' && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-slate-400">{t('my_stack_pk_status', { defaultValue: 'PK-Status' })}</dt>
                    <dd className="text-right font-medium text-slate-200">
                      {selectedPkCatalogEntry?.pk_profile_id
                        ? t('my_stack_pk_available', { defaultValue: 'PK-Profil verfügbar; Kurve abhängig von vollständigen Angaben' })
                        : t('my_stack_pk_unavailable', { defaultValue: 'Kein PK-Profil hinterlegt' })}
                    </dd>
                  </div>
                )}
                {state.draft.brand.trim() && (
                  <div className="flex flex-wrap justify-between gap-2">
                    <dt className="text-slate-400">{t('my_stack_brand', { defaultValue: 'Marke' })}</dt>
                    <dd className="break-words font-medium text-slate-200">{state.draft.brand}</dd>
                  </div>
                )}
                {state.draft.trackingLevel === 'complete' && state.draft.ingredients.map((ingredient, index) => (
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
                    ref={duplicateActionRef}
                    type="button"
                    onClick={() => {
                      if (saving) return
                      onOpenExisting(duplicateCandidate)
                      onClose()
                    }}
                    disabled={saving}
                    className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 font-semibold text-slate-950 transition-colors duration-200 hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
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
                    onClick={() => { if (!saving) setDuplicateCandidate(null) }}
                    disabled={saving}
                    className="min-h-11 cursor-pointer rounded-xl px-4 py-3 font-semibold text-slate-400 transition-colors duration-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
                  >
                    {t('cancel', { defaultValue: 'Abbrechen' })}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
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
                {t(STEP_LABELS[state.step].key, { defaultValue: STEP_LABELS[state.step].defaultValue })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { if (!saving) onClose() }}
              disabled={saving}
              aria-label={String(t('close', { defaultValue: 'Schließen' }))}
              className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl text-slate-400 transition-colors duration-200 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={currentStepIndex + 1}>
            {steps.map((step, index) => (
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

          {state.step === 'review' || (intent === 'pk' && currentStepIndex === steps.length - 1) ? (
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
              {currentStepIndex === steps.length - 2 ? <Check aria-hidden="true" size={18} /> : <ArrowRight aria-hidden="true" size={18} />}
              {t('continue', { defaultValue: 'Weiter' })}
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
