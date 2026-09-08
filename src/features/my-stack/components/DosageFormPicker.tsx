import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DOSAGE_FORMS, isStageRenderable, type DosageFormDefinition } from '../lib/dosageForms'
import type { DosageFormKey } from '../types'
import { DosageFormIcon } from './DosageFormIcon'
import { DosageFormPreview } from './DosageFormPreview'

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
  // Die schon gewaehlte Eintragsfarbe. Steht sie noch nicht fest, zeigen die
  // Objekte das Material der Form — nicht irgendein Blau, das spaeter nicht
  // stimmt.
  colorHex?: string | null
  onSelect: (dosageForm: DosageFormKey) => void
}

// Zwei grosse Karussells statt zwei schmaler Wischreihen: die empfohlenen
// oben, alle uebrigen darunter, beide fast bildschirmhoch. Objekte werden
// beim Wischen heller, je naeher sie der Mitte stehen — dieselbe Mechanik wie
// beim Vial-Karussell auf der My-Stack-Seite (MyStackPage.updateVialFocus) —
// und das zentrierte Objekt WIRD die Auswahl, ohne dass man extra antippen
// muss. Tippen bleibt daneben moeglich, fuer Tastatur und Screenreader.
const KARUSSELL_HOEHE = 'h-[27dvh] min-h-[190px] sm:h-[240px]'

// Die Kanten laufen weich aus. Ohne Scrollbalken ist das der einzige
// Hinweis, dass die Reihe weitergeht — ein hart abgeschnittenes Objekt am
// Rand liest sich als Fehler, ein ausblendendes als Fortsetzung.
const REIHE = 'flex snap-x snap-mandatory gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]'

// Der Standplatz. Die Formen stehen darin auf einer gemeinsamen Bodenlinie
// und behalten ihre Groessenverhaeltnisse: ein Pen ist hoeher als eine
// Tablette, und das ist eine wahre Aussage ueber die Objekte. Keine feste
// Breite mehr — bei "carousel"-Groesse ist ein Patch (190 px) breiter als
// eine Ampulle (49 px), eine erzwungene Breite haette den Patch beschnitten.
const STANDPLATZ = 'relative flex h-full min-w-[84px] shrink-0 items-end justify-center px-2'

// Falloff wie im Vial-Karussell: direkt neben der Mitte noch gut sichtbar,
// am Rand nie ganz schwarz — man soll die Nachbarn erkennen koennen.
const FOKUS_BODEN = 0.22
const FOKUS_ABFALL = 0.78

function fokusAusAbstand(distanzAnteil: number): number {
  return Math.max(FOKUS_BODEN, 1 - Math.abs(distanzAnteil) * FOKUS_ABFALL)
}

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
    .filter((form): form is DosageFormDefinition => form !== undefined)
  const secondaryForms = DOSAGE_FORMS.filter(form => !primaryKeys.includes(form.key))
  const selectedForm = value ? DOSAGE_FORMS.find(form => form.key === value) : undefined

  // Beim Oeffnen eines bestehenden Eintrags kann die gewaehlte Form weit rechts
  // in ihrem Karussell liegen. Sie wird hereingeholt, sonst sieht man beim
  // Bearbeiten nicht, was eingestellt ist.
  const gewaehltRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    gewaehltRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'center' })
  }, [value])

  const [fokusJeForm, setFokusJeForm] = useState<Partial<Record<DosageFormKey, number>>>({})
  const primaryRef = useRef<HTMLDivElement | null>(null)
  const secondaryRef = useRef<HTMLDivElement | null>(null)
  const primaryFrameRef = useRef<number | null>(null)
  const secondaryFrameRef = useRef<number | null>(null)
  // Was in diesem Karussell zuletzt der Mitte am naechsten war. Ein Wechsel
  // dagegen darf die Auswahl aendern; der erste, geratene Wert beim Start
  // nicht — sonst waehlte sich das Formular beim Oeffnen selbst etwas aus.
  const primaryLetzterRef = useRef<DosageFormKey | null>(null)
  const secondaryLetzterRef = useRef<DosageFormKey | null>(null)

  // Misst, welches Objekt der Mitte am naechsten steht, und wie hell jedes
  // stehen soll. `melden`: ob ein Wechsel des naechsten Objekts auch die
  // Auswahl aendern darf.
  function messen(
    karussell: HTMLDivElement | null,
    formen: readonly DosageFormDefinition[],
    letzterRef: { current: DosageFormKey | null },
    melden: boolean,
  ): void {
    if (!karussell) return

    const mitte = karussell.scrollLeft + karussell.clientWidth / 2
    const spanne = Math.max(1, karussell.clientWidth * 0.48)

    let naechster: DosageFormKey | null = null
    let naechsteDistanz = Number.POSITIVE_INFINITY
    const helligkeiten: Partial<Record<DosageFormKey, number>> = {}

    for (const form of formen) {
      const el = karussell.querySelector<HTMLElement>(`[data-dosage-key="${form.key}"]`)
      if (!el) continue

      const elMitte = el.offsetLeft + el.offsetWidth / 2
      const distanz = elMitte - mitte
      helligkeiten[form.key] = fokusAusAbstand(distanz / spanne)

      if (Math.abs(distanz) < naechsteDistanz) {
        naechsteDistanz = Math.abs(distanz)
        naechster = form.key
      }
    }

    setFokusJeForm(vorher => ({ ...vorher, ...helligkeiten }))

    if (naechster && melden && naechster !== letzterRef.current) onSelect(naechster)
    if (naechster) letzterRef.current = naechster
  }

  // Erstes Bild: nur die Helligkeit setzen, nichts auswaehlen.
  useEffect(() => {
    messen(primaryRef.current, primaryForms, primaryLetzterRef, false)
    messen(secondaryRef.current, secondaryForms, secondaryLetzterRef, false)
    // Nur beim ersten Bild — welche Formen es gibt, aendert sich danach nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function aufWischPlanen(
    karussellRef: { current: HTMLDivElement | null },
    formen: readonly DosageFormDefinition[],
    letzterRef: { current: DosageFormKey | null },
    frameRef: { current: number | null },
  ): void {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      messen(karussellRef.current, formen, letzterRef, true)
    })
  }

  const renderForm = (form: DosageFormDefinition) => {
    const selected = value === form.key
    const fokus = fokusJeForm[form.key] ?? (selected ? 1 : 0.55)
    // Das Leuchten unter dem Objekt folgt derselben Zahl: unsichtbar im
    // Ruhezustand, voll da, wo etwas wirklich in der Mitte steht.
    const leuchtstaerke = Math.max(0, (fokus - FOKUS_BODEN) / (1 - FOKUS_BODEN))

    return (
      <button
        key={form.key}
        ref={selected ? gewaehltRef : undefined}
        data-dosage-key={form.key}
        type="button"
        aria-pressed={selected}
        // Ohne Aufschrift unter dem Objekt braucht der Knopf seinen Namen hier.
        aria-label={String(t(form.labelKey))}
        onClick={() => onSelect(form.key)}
        // min-h-11: die 44-px-Regel fuer Tippziele. Der Standplatz ist mit
        // dem Karussell ohnehin hoeher, aber der Vertrag steht am Knopf, nicht
        // am Inhalt — sonst faellt er beim naechsten Umbau still weg.
        className="flex min-h-11 shrink-0 cursor-pointer snap-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <span className={STANDPLATZ} aria-hidden="true">
          {/* Das Licht der Auswahl liegt UNTER dem Objekt, wie ein Spot auf der
              Buehne. Ein Rahmen darum wuerde die Reihe wieder in Kacheln
              zerlegen. */}
          <span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3/4 rounded-full bg-[radial-gradient(62%_60%_at_50%_78%,rgba(56,189,248,0.26),transparent_70%)]"
            style={{ opacity: leuchtstaerke }}
          />
          {isStageRenderable(form.key) ? (
            <DosageFormPreview
              dosageForm={form.key}
              colorHex={colorHex}
              size="carousel"
              showLabel={false}
              focus={fokus}
            />
          ) : (
            <span className={`relative pb-8 ${selected ? 'text-sky-300' : 'text-slate-500'}`}>
              <DosageFormIcon form={form.key} size={40} />
            </span>
          )}
        </span>
      </button>
    )
  }

  return (
    <fieldset
      // Ein <fieldset> hat min-inline-size: min-content und weigert sich damit,
      // schmaler zu werden als sein Inhalt. Ohne min-w-0 waeren die Karussells
      // so breit wie alle Objekte zusammen und wuerden nirgends scrollen.
      className="min-w-0"
      data-field="dosageForm"
      tabIndex={-1} aria-invalid={error || undefined} aria-describedby={error ? 'stack-dosage-form-error' : undefined}>
      <legend className="mb-3 text-sm font-semibold text-slate-200">
        {t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}
      </legend>

      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-4 sm:px-4">
        <div>
          <p id="stack-dosage-primary-label" className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t('my_stack_common_dosage_forms', { defaultValue: 'Häufige Darreichungsformen' })}
          </p>
          <div
            ref={primaryRef}
            role="group"
            aria-labelledby="stack-dosage-primary-label"
            onScroll={() => aufWischPlanen(primaryRef, primaryForms, primaryLetzterRef, primaryFrameRef)}
            className={`${REIHE} ${KARUSSELL_HOEHE}`}
          >
            {primaryForms.map(renderForm)}
          </div>
        </div>

        {secondaryForms.length > 0 && (
          <div className="border-t border-white/[0.07] pt-4">
            <p id="stack-dosage-more-label" className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('my_stack_more_dosage_forms', { defaultValue: 'Weitere Darreichungsformen' })}
            </p>
            <div
              ref={secondaryRef}
              role="group"
              aria-labelledby="stack-dosage-more-label"
              onScroll={() => aufWischPlanen(secondaryRef, secondaryForms, secondaryLetzterRef, secondaryFrameRef)}
              className={`${REIHE} ${KARUSSELL_HOEHE}`}
            >
              {secondaryForms.map(renderForm)}
            </div>
          </div>
        )}

        {/* Der einzige Text im Bild: wie das heisst, was gerade zentriert
            steht. Vierzehn Aufschriften unter vierzehn Objekten waren zu
            viel; keine einzige waere ein Raetsel. Also genau eine, und sie
            folgt dem Wischen, nicht nur dem Antippen. */}
        <p
          data-dosage-form-selected
          aria-live="polite"
          className="min-h-5 border-t border-white/[0.07] pt-3 text-center text-sm font-semibold text-sky-200"
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
