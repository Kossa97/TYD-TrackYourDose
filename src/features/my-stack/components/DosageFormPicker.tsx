import { Droplets, Package, Pill, SprayCan, Syringe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DOSAGE_FORMS, type DosageFormDefinition } from '../lib/dosageForms'
import type { DosageFormKey } from '../types'

export interface DosageFormPickerProps {
  value: DosageFormKey | null
  error?: boolean
  onSelect: (dosageForm: DosageFormKey) => void
}

function FormIcon({ form }: { form: DosageFormDefinition }) {
  if (form.capabilities.includes('injectable')) return <Syringe aria-hidden="true" size={20} />
  if (form.capabilities.includes('liquid')) return <Droplets aria-hidden="true" size={20} />
  if (form.key.includes('spray')) return <SprayCan aria-hidden="true" size={20} />
  if (form.capabilities.includes('countable')) return <Pill aria-hidden="true" size={20} />
  return <Package aria-hidden="true" size={20} />
}

export function DosageFormPicker({ value, error = false, onSelect }: DosageFormPickerProps) {
  const { t } = useTranslation()

  return (
    <fieldset data-field="dosageForm" tabIndex={-1} aria-invalid={error || undefined} aria-describedby={error ? 'stack-dosage-form-error' : undefined}>
      <legend className="mb-3 text-sm font-semibold text-slate-200">
        {t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}
      </legend>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {DOSAGE_FORMS.map(form => {
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
              <span className={selected ? 'text-sky-300' : 'text-slate-500'}><FormIcon form={form} /></span>
              <span className="min-w-0 break-words">{t(form.labelKey)}</span>
            </button>
          )
        })}
      </div>
      {error && (
        <p id="stack-dosage-form-error" role="alert" className="mt-3 text-sm text-rose-300">
          {t('my_stack_dosage_form_required', { defaultValue: 'Bitte wähle eine Darreichungsform.' })}
        </p>
      )}
    </fieldset>
  )
}
