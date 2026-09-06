import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DOSAGE_FORMS, isStageRenderable } from '../lib/dosageForms'
import type { DosageFormKey } from '../types'
import { DosageFormIcon } from './DosageFormIcon'
import { DosageFormPreview } from './DosageFormPreview'

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
  suggestedForms: readonly DosageFormKey[]
  error?: boolean
  // Die schon gewaehlte Eintragsfarbe. Steht sie noch nicht fest, zeigen die
  // Objekte das Material der Form — nicht irgendein Blau, das spaeter nicht
  // stimmt.
  colorHex?: string | null
  onSelect: (dosageForm: DosageFormKey) => void
}

// Die Objekte stehen auf EINER Flaeche, nicht jedes in seinem eigenen Kasten.
// Vierzehn gerahmte Kacheln lesen sich als vierzehn Bedienelemente; vierzehn
// Gegenstaende auf einem Tisch lesen sich als das, was sie sind — eine Auswahl
// von Dingen. Die Buttons bleiben Buttons, sie tragen nur keine Kante mehr.
const FLAECHE = 'rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:p-5'

// Der Standplatz. Die Formen stehen darin auf einer gemeinsamen Bodenlinie und
// behalten ihre Groessenverhaeltnisse: ein Pen ist hoeher als eine Tablette,
// und das ist eine wahre Aussage ueber die Objekte. 100 px, weil der Pen in
// Miniaturgroesse 96,9 px misst — die groesste Form gibt das Mass vor, sonst
// wuerde sie beschnitten.
const STANDPLATZ = 'relative flex h-[100px] w-full items-end justify-center'

// Was nicht gewaehlt ist, steht im Halbschatten — mit demselben Fokusregler,
// den auch das Karussell benutzt. Ganz aus waere zu wenig: man soll die
// Alternativen noch erkennen koennen.
const FOKUS_GEWAEHLT = 1
const FOKUS_RUHEND = 0.62

const RASTER = 'grid grid-cols-3 gap-x-2 gap-y-3 sm:grid-cols-4'

export function DosageFormPicker({
  value,
  suggestedForms,
  error = false,
  colorHex,
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
        className={`flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-xl px-1 pt-2 pb-1.5 text-center text-xs font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none ${selected
          ? 'text-sky-200'
          : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {/* Das Objekt selbst, ohne Aufschrift: der Knopf hat seine eigene
            Beschriftung darunter, und eine zweite auf dem Glas waere in dieser
            Groesse nur ein Fleck — und stuende ausserdem im zugaenglichen
            Namen des Knopfes. */}
        <span className={STANDPLATZ} aria-hidden="true">
          {/* Das Licht der Auswahl liegt UNTER dem Objekt, wie ein Spot auf
              der Buehne. Ein Rahmen darum wuerde die gemeinsame Flaeche
              wieder in Kacheln zerlegen. */}
          <span
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-3/4 rounded-full bg-[radial-gradient(60%_60%_at_50%_78%,rgba(56,189,248,0.22),transparent_70%)] transition-opacity duration-200 motion-reduce:transition-none ${selected ? 'opacity-100' : 'opacity-0'}`}
          />
          {isStageRenderable(form.key) ? (
            <DosageFormPreview
              dosageForm={form.key}
              colorHex={colorHex}
              size="mini"
              showLabel={false}
              focus={selected ? FOKUS_GEWAEHLT : FOKUS_RUHEND}
            />
          ) : (
            <span className={`relative pb-6 ${selected ? 'text-sky-300' : 'text-slate-500'}`}>
              <DosageFormIcon form={form.key} />
            </span>
          )}
        </span>
        <span className="min-w-0 break-words leading-tight">{t(form.labelKey)}</span>
      </button>
    )
  }

  return (
    <fieldset data-field="dosageForm" tabIndex={-1} aria-invalid={error || undefined} aria-describedby={error ? 'stack-dosage-form-error' : undefined}>
      <legend className="mb-3 text-sm font-semibold text-slate-200">
        {t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}
      </legend>

      <div className={FLAECHE}>
        {selectedForm && (
          <div role="group" aria-labelledby="stack-dosage-current-label" className="mb-4">
            <p id="stack-dosage-current-label" className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('my_stack_current_dosage_form', { defaultValue: 'Aktuell ausgewählt' })}
            </p>
            <div className={RASTER}>
              {renderForm(selectedForm)}
            </div>
          </div>
        )}

        <div role="group" aria-labelledby="stack-dosage-primary-label">
          <p id="stack-dosage-primary-label" className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t('my_stack_common_dosage_forms', { defaultValue: 'Häufige Darreichungsformen' })}
          </p>
          <div className={RASTER}>
            {primaryForms.map(renderForm)}
          </div>
        </div>

        {secondaryForms.length > 0 && (
          <>
            {/* Eine Linie trennt die Gruppen, kein zweiter Kasten: die Flaeche
                bleibt eine. */}
            <div className="mt-4 border-t border-white/[0.07] pt-1">
              <button
                type="button"
                aria-expanded={showMore}
                aria-controls="stack-dosage-more"
                onClick={() => setShowMore(current => !current)}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-400 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
              >
                {showMore
                  ? t('my_stack_hide_more_dosage_forms', { defaultValue: 'Weitere Darreichungsformen ausblenden' })
                  : t('my_stack_show_more_dosage_forms', { defaultValue: 'Weitere Darreichungsformen anzeigen' })}
                {showMore
                  ? <ChevronUp aria-hidden="true" className="size-4" />
                  : <ChevronDown aria-hidden="true" className="size-4" />}
              </button>
            </div>

            {showMore && (
              <div
                id="stack-dosage-more"
                role="group"
                aria-label={t('my_stack_more_dosage_forms', { defaultValue: 'Weitere Darreichungsformen' })}
                className={`mt-1 ${RASTER}`}
              >
                {secondaryForms.map(renderForm)}
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <p id="stack-dosage-form-error" role="alert" className="mt-3 text-sm text-rose-300">
          {t('my_stack_dosage_form_required', { defaultValue: 'Bitte wähle eine Darreichungsform.' })}
        </p>
      )}
    </fieldset>
  )
}
