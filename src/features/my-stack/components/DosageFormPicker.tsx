import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DOSAGE_FORMS } from '../lib/dosageForms'
import type { DosageFormKey } from '../types'
import { DosageFormIcon } from './DosageFormIcon'

const COMMON_DOSAGE_FORMS: readonly DosageFormKey[] = [
  'tablet',
  'capsule',
  'vial',
  'drops',
  'liquid',
  'powder',
]

export interface DosageFormPickerProps {
  value: DosageFormKey | null
  substanceName: string
  suggestedForms: readonly DosageFormKey[]
  error?: boolean
  onSelect: (dosageForm: DosageFormKey) => void
}

export function DosageFormPicker({
  value,
  substanceName,
  suggestedForms,
  error = false,
  onSelect,
}: DosageFormPickerProps) {
  const { t } = useTranslation()
  const [showMore, setShowMore] = useState(false)
  const suggestedKeys = Array.from(new Set(suggestedForms))
  const primaryKeys = suggestedKeys.length > 0 ? suggestedKeys : COMMON_DOSAGE_FORMS
  const primaryForms = primaryKeys
    .map(key => DOSAGE_FORMS.find(form => form.key === key))
    .filter(form => form !== undefined)
  const selectedForm = value && !primaryKeys.includes(value)
    ? DOSAGE_FORMS.find(form => form.key === value)
    : undefined
  const secondaryForms = DOSAGE_FORMS.filter(form => (
    !primaryKeys.includes(form.key) && form.key !== selectedForm?.key
  ))

  const renderForm = (form: (typeof DOSAGE_FORMS)[number]) => {
    const selected = value === form.key

    return (
      <button
        key={form.key}
        type="button"
        aria-pressed={selected}
        onClick={() => onSelect(form.key)}
        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none ${selected
          ? 'border-sky-400/50 bg-sky-400/10 text-sky-200 shadow-[0_0_22px_rgba(0,204,245,0.09),inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-sky-400/25 hover:bg-white/[0.06]'
        }`}
      >
        <span className={`shrink-0 ${selected ? 'text-sky-300' : 'text-slate-500'}`}>
          <DosageFormIcon form={form.key} />
        </span>
        <span className="min-w-0 break-words">{t(form.labelKey)}</span>
      </button>
    )
  }

  return (
    <fieldset data-field="dosageForm" tabIndex={-1} aria-invalid={error || undefined} aria-describedby={error ? 'stack-dosage-form-error' : undefined}>
      <legend className="mb-3 text-sm font-semibold text-slate-200">
        {t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}
      </legend>
      {selectedForm && (
        <div role="group" aria-labelledby="stack-dosage-current-label" className="mb-5">
          <p id="stack-dosage-current-label" className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t('my_stack_current_dosage_form', { defaultValue: 'Aktuell ausgewählt' })}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {renderForm(selectedForm)}
          </div>
        </div>
      )}

      <div role="group" aria-labelledby="stack-dosage-primary-label">
        <p id="stack-dosage-primary-label" className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {suggestedKeys.length > 0
            ? t('my_stack_recommended_dosage_forms', {
              substanceName,
              defaultValue: 'Empfohlen für {{substanceName}}',
            })
            : t('my_stack_common_dosage_forms', { defaultValue: 'Häufige Darreichungsformen' })}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {primaryForms.map(renderForm)}
        </div>
      </div>

      {secondaryForms.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            aria-expanded={showMore}
            aria-controls="stack-dosage-more"
            onClick={() => setShowMore(current => !current)}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-400 transition-colors hover:bg-white/[0.035] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
          >
            {showMore
              ? t('my_stack_hide_more_dosage_forms', { defaultValue: 'Weitere Darreichungsformen ausblenden' })
              : t('my_stack_show_more_dosage_forms', { defaultValue: 'Weitere Darreichungsformen anzeigen' })}
            {showMore
              ? <ChevronUp aria-hidden="true" className="size-4" />
              : <ChevronDown aria-hidden="true" className="size-4" />}
          </button>

          {showMore && (
            <div
              id="stack-dosage-more"
              role="group"
              aria-label={t('my_stack_more_dosage_forms', { defaultValue: 'Weitere Darreichungsformen' })}
              className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
              {secondaryForms.map(renderForm)}
            </div>
          )}
        </div>
      )}
      {error && (
        <p id="stack-dosage-form-error" role="alert" className="mt-3 text-sm text-rose-300">
          {t('my_stack_dosage_form_required', { defaultValue: 'Bitte wähle eine Darreichungsform.' })}
        </p>
      )}
    </fieldset>
  )
}
