import { useTranslation } from 'react-i18next'
import { DOSAGE_FORMS, type DosageFormDefinition } from '../lib/dosageForms'
import type { DosageFormKey } from '../types'
import { DosageFormCarousel } from './DosageFormCarousel'

const COMMON_DOSAGE_FORMS: readonly DosageFormKey[] = [
  'tablet',
  'capsule',
  'vial',
  'drops',
  'powder',
]

export interface DosageFormPickerProps {
  value: DosageFormKey | null
  suggestedForms: readonly DosageFormKey[]
  error?: boolean
  onSelect: (dosageForm: DosageFormKey) => void
}

// Zwei grosse Karussells: die empfohlenen oben, alle uebrigen darunter. Die
// Wischmechanik steckt in `DosageFormCarousel` — einmal geschrieben, zweimal
// gerendert, damit sich beide Reihen garantiert gleich anfuehlen.
//
// Die Hoehe steht nicht in `dvh`, sondern kommt aus dem, was der Schritt
// tatsaechlich uebrig hat: beide Reihen teilen sich den Platz (`flex-1`).
// Feste 27dvh liessen unten Rand stehen und liefen auf kleineren Geraeten
// oben ueber — und die Objekte wurden davon ohnehin nicht groesser, weil sie
// feste Pixelgroessen mitbringen.
export function DosageFormPicker({
  value,
  suggestedForms,
  error = false,
  onSelect,
}: DosageFormPickerProps) {
  const { t } = useTranslation()
  const suggestedKeys = Array.from(new Set(suggestedForms))
  // Schlaegt der Katalog etwas vor, steht in der oberen Reihe nicht mehr, was
  // haeufig ist, sondern was zu dieser Substanz passt — bei Vitamin D3 genau
  // eine Kapsel. Unter „Haeufige Darreichungsformen" war das eine falsche
  // Aussage: Vial, Tablette und Tropfen sind haeufig, standen aber unten.
  const ausKatalog = suggestedKeys.length > 0
  const primaryKeys = ausKatalog ? suggestedKeys : COMMON_DOSAGE_FORMS
  const primaryForms = primaryKeys
    .map(key => DOSAGE_FORMS.find(form => form.key === key))
    .filter((form): form is DosageFormDefinition => form !== undefined)
  const secondaryForms = DOSAGE_FORMS.filter(form => !primaryKeys.includes(form.key))
  const selectedForm = value ? DOSAGE_FORMS.find(form => form.key === value) : undefined
  const inVordererReihe = Boolean(value) && primaryForms.some(form => form.key === value)

  // Der Name steht unter dem Objekt, das er benennt — also unter der Reihe,
  // in der die Auswahl gerade liegt, und dort mittig. Er wandert mit, statt
  // an einer festen Stelle zu stehen und auf eine der beiden Reihen zu
  // zeigen, ohne zu sagen auf welche.
  //
  // Beide Reihen halten die Zeile frei, auch die ohne Namen: liesse man sie
  // dort weg, waere die eine Reihe 28 px hoeher als die andere, und beim
  // Wechsel zwischen ihnen sprungen die Hoehen — woran wiederum die
  // Objektgroessen haengen (`skalenMessen`). Beschriftet ist immer nur eine,
  // deshalb steht der Name im Bild genau einmal.
  const namensZeile = (beschriftet: boolean) => (
    beschriftet ? (
      <p
        data-dosage-form-selected
        aria-live="polite"
        className="mt-2 min-h-5 text-center text-sm font-semibold text-sky-200"
      >
        {selectedForm ? t(selectedForm.labelKey) : ''}
      </p>
    ) : (
      <p aria-hidden="true" className="mt-2 min-h-5" />
    )
  )

  return (
    <fieldset
      // Ein <fieldset> hat min-inline-size: min-content und weigert sich damit,
      // schmaler zu werden als sein Inhalt. Ohne min-w-0 waeren die Karussells
      // so breit wie alle Objekte zusammen und wuerden nirgends scrollen.
      className="flex h-full min-w-0 flex-col"
      data-field="dosageForm"
      tabIndex={-1} aria-invalid={error || undefined} aria-describedby={error ? 'stack-dosage-form-error' : undefined}>
      {/* Nur fuer Screenreader: „Darreichungsform" steht schon als Untertitel
          ueber dem Schritt, ein zweites Mal daruntergeschrieben war es
          doppelt. Als <legend> muss es trotzdem das erste Kind des
          <fieldset> bleiben, sonst verliert die Gruppe ihren Namen. */}
      <legend className="sr-only">
        {t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}
      </legend>

      {/* Kein Rahmen, kein Radius, eine durchgehend dunkle Flaeche: die zwei
          Karussells sind nicht zwei Kacheln, die man einrahmen muesste. Was
          sie trennt, sind ihre Ueberschriften — dafuer braucht es keine
          zusaetzliche Linie dazwischen. `-mx-4` holt die Flaeche bis an den
          Rand des Dialogs, damit die angeschnittenen Nachbarn am Rand
          ausblenden statt an einer Kante zu enden. */}
      <div className="-mx-4 flex min-h-0 flex-1 flex-col gap-5 bg-slate-950/60 px-4 py-4 sm:-mx-6 sm:px-6">
        <div className="flex min-h-0 flex-1 flex-col">
          <p id="stack-dosage-primary-label" className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {ausKatalog
              ? t('my_stack_suggested_dosage_forms', { defaultValue: 'Für diese Substanz' })
              : t('my_stack_common_dosage_forms', { defaultValue: 'Häufige Darreichungsformen' })}
          </p>
          <DosageFormCarousel
            formen={primaryForms}
            value={value}
            labelId="stack-dosage-primary-label"
            waehltBeimStart
            onSelect={onSelect}
          />
          {namensZeile(inVordererReihe)}
        </div>

        {secondaryForms.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col">
            <p id="stack-dosage-more-label" className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('my_stack_more_dosage_forms', { defaultValue: 'Weitere Darreichungsformen' })}
            </p>
            <DosageFormCarousel
              formen={secondaryForms}
              value={value}
              labelId="stack-dosage-more-label"
              onSelect={onSelect}
            />
            {namensZeile(!inVordererReihe)}
          </div>
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
