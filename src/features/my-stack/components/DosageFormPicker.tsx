import { useEffect, useRef } from 'react'
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

// Zwei Reihen zum Durchwischen statt eines Rasters aus Kacheln: die
// empfohlenen oben, alle uebrigen darunter. Beide sind immer da — das
// Aufklappen entfaellt, weil eine Reihe nichts verstecken muss, was man
// wegwischen kann.
// Die Kanten laufen weich aus. Ohne Scrollbalken ist das der einzige
// Hinweis, dass die Reihe weitergeht — ein hart abgeschnittenes Objekt am
// Rand liest sich als Fehler, ein ausblendendes als Fortsetzung.
const REIHE = 'flex snap-x snap-mandatory gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)]'

// Der Standplatz. Die Formen stehen darin auf einer gemeinsamen Bodenlinie und
// behalten ihre Groessenverhaeltnisse: ein Pen ist hoeher als eine Tablette,
// und das ist eine wahre Aussage ueber die Objekte. 100 px, weil der Pen in
// Miniaturgroesse 96,9 px misst — die groesste Form gibt das Mass vor, sonst
// wuerde sie beschnitten.
const STANDPLATZ = 'relative flex h-[100px] w-[76px] shrink-0 items-end justify-center'

// Was nicht gewaehlt ist, steht im Halbschatten — mit demselben Fokusregler,
// den auch das Karussell im Stack benutzt. Ganz aus waere zu wenig: man soll
// die Alternativen noch erkennen koennen.
const FOKUS_GEWAEHLT = 1
const FOKUS_RUHEND = 0.55

export function DosageFormPicker({
  value,
  suggestedForms,
  error = false,
  colorHex,
  onSelect,
}: DosageFormPickerProps) {
  const { t } = useTranslation()
  const suggestedKeys = Array.from(new Set(suggestedForms))
  const primaryKeys = suggestedKeys.length > 0 ? suggestedKeys : COMMON_DOSAGE_FORMS
  const primaryForms = primaryKeys
    .map(key => DOSAGE_FORMS.find(form => form.key === key))
    .filter(form => form !== undefined)
  const secondaryForms = DOSAGE_FORMS.filter(form => !primaryKeys.includes(form.key))
  const selectedForm = value ? DOSAGE_FORMS.find(form => form.key === value) : undefined

  // Beim Oeffnen eines bestehenden Eintrags kann die gewaehlte Form weit rechts
  // in ihrer Reihe liegen. Sie wird hereingeholt, sonst sieht man beim
  // Bearbeiten nicht, was eingestellt ist.
  const gewaehltRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    gewaehltRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [value])

  const renderForm = (form: (typeof DOSAGE_FORMS)[number]) => {
    const selected = value === form.key

    return (
      <button
        key={form.key}
        ref={selected ? gewaehltRef : undefined}
        type="button"
        aria-pressed={selected}
        // Ohne Aufschrift unter dem Objekt braucht der Knopf seinen Namen hier.
        aria-label={String(t(form.labelKey))}
        onClick={() => onSelect(form.key)}
        // min-h-11: die 44-px-Regel fuer Tippziele. Der Standplatz ist mit
        // 100 px ohnehin hoeher, aber der Vertrag steht am Knopf, nicht am
        // Inhalt — sonst faellt er beim naechsten Umbau still weg.
        className="flex min-h-11 shrink-0 cursor-pointer snap-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <span className={STANDPLATZ} aria-hidden="true">
          {/* Das Licht der Auswahl liegt UNTER dem Objekt, wie ein Spot auf der
              Buehne. Ein Rahmen darum wuerde die Reihe wieder in Kacheln
              zerlegen. */}
          <span
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-3/4 rounded-full bg-[radial-gradient(62%_60%_at_50%_78%,rgba(56,189,248,0.26),transparent_70%)] transition-opacity duration-200 motion-reduce:transition-none ${selected ? 'opacity-100' : 'opacity-0'}`}
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
      </button>
    )
  }

  return (
    <fieldset
      // Ein <fieldset> hat min-inline-size: min-content und weigert sich damit,
      // schmaler zu werden als sein Inhalt. Ohne min-w-0 waeren die Reihen so
      // breit wie alle Objekte zusammen und wuerden nirgends scrollen.
      className="min-w-0"
      data-field="dosageForm"
      tabIndex={-1} aria-invalid={error || undefined} aria-describedby={error ? 'stack-dosage-form-error' : undefined}>
      <legend className="mb-3 text-sm font-semibold text-slate-200">
        {t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}
      </legend>

      <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-3 sm:px-4">
        <p id="stack-dosage-primary-label" className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t('my_stack_common_dosage_forms', { defaultValue: 'Häufige Darreichungsformen' })}
        </p>
        <div role="group" aria-labelledby="stack-dosage-primary-label" className={REIHE}>
          {primaryForms.map(renderForm)}
        </div>

        {secondaryForms.length > 0 && (
          <>
            {/* Eine Linie trennt die Reihen, kein zweiter Kasten: die Flaeche
                bleibt eine. */}
            <p id="stack-dosage-more-label" className="mt-3 mb-1 border-t border-white/[0.07] pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('my_stack_more_dosage_forms', { defaultValue: 'Weitere Darreichungsformen' })}
            </p>
            <div role="group" aria-labelledby="stack-dosage-more-label" className={REIHE}>
              {secondaryForms.map(renderForm)}
            </div>
          </>
        )}

        {/* Der einzige Text im Bild: wie das heisst, was gerade gewaehlt ist.
            Vierzehn Aufschriften unter vierzehn Objekten waren zu viel; keine
            einzige waere ein Raetsel. */}
        <p
          data-dosage-form-selected
          aria-live="polite"
          className="mt-3 min-h-5 border-t border-white/[0.07] pt-3 text-center text-sm font-semibold text-sky-200"
        >
          {selectedForm ? t(selectedForm.labelKey) : ''}
        </p>
      </div>

      {error && (
        <p id="stack-dosage-form-error" role="alert" className="mt-3 text-sm text-rose-300">
          {t('my_stack_dosage_form_required', { defaultValue: 'Bitte wähle eine Darreichungsform.' })}
        </p>
      )}
    </fieldset>
  )
}
