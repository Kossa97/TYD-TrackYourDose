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
// Der Rand, damit auch das erste und letzte Objekt bis in die Mitte wischen
// koennen, haengt als Margin an genau diesen beiden Kindern — nicht als
// Padding am Karussell. Als Padding bezog sich die Standplatzbreite auf die
// content-box, also auf die um das Padding verkuerzte Breite: der Standplatz
// war schmaler als angeschrieben und seine Mitte lag neben der sichtbaren
// Mitte (gemessen bei 430 px: 10 px daneben). Als Margin bezieht sich `w-`
// auf die volle Karussellbreite: 25% + 25% trifft die Mitte exakt, und bei
// nur einem einzigen Objekt (Katalogvorschlag) ergeben beide Margins
// zusammen mit ihm genau 100%.
// Die Blende faellt ueber 12px statt 24px ab, sonst frisst sie den schmalen
// Streifen, in dem der Nachbar zu sehen sein soll, gleich wieder auf.
const REIHE = 'flex snap-x snap-mandatory gap-1 overflow-x-auto [&>*:first-child]:ml-[25%] [&>*:last-child]:mr-[25%] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]'

// Der Standplatz hat eine feste Breite, unabhaengig vom Objekt darin. Vorher
// richtete sie sich nach dem Objekt selbst (ein Patch war 190 px, eine
// Ampulle 49 px), und mehrere Formen standen gleichzeitig gleich gross
// nebeneinander — welche in der Mitte stand, war nicht zu erkennen. Das
// Objekt bleibt im Standplatz zentriert und behaelt sein Groessenverhaeltnis.
const STANDPLATZ = 'relative flex h-full w-full items-end justify-center px-2'

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

    // Gemessen wird in Bildschirmkoordinaten, nicht ueber `offsetLeft`.
    // `offsetLeft` zaehlt vom offsetParent, und das ist das naechste
    // positionierte Element — das Karussell selbst ist keines. Gemessen bei
    // 430 px Fensterbreite kam dadurch auf jedes Objekt derselbe Zuschlag von
    // 29 px, waehrend die Mitte aus `scrollLeft + clientWidth / 2` ohne ihn
    // gerechnet wurde: der Nullpunkt sass um 29 px daneben. Beim Wischen galt
    // deshalb der Nachbar als zentriert und wurde gewaehlt, obwohl mittig
    // etwas anderes stand. `getBoundingClientRect` hat keinen Bezugspunkt, den
    // eine CSS-Aenderung woanders still verschieben kann, und enthaelt den
    // Scrollstand bereits.
    const rahmen = karussell.getBoundingClientRect()
    const mitte = rahmen.left + rahmen.width / 2
    const spanne = Math.max(1, rahmen.width * 0.48)

    let naechster: DosageFormKey | null = null
    let naechsteDistanz = Number.POSITIVE_INFINITY
    const helligkeiten: Partial<Record<DosageFormKey, number>> = {}

    for (const form of formen) {
      const el = karussell.querySelector<HTMLElement>(`[data-dosage-key="${form.key}"]`)
      if (!el) continue

      const elRahmen = el.getBoundingClientRect()
      const distanz = elRahmen.left + elRahmen.width / 2 - mitte
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
        // Genau ein Objekt im ganzen Feld traegt diese Marke. Zwei Karussells
        // heissen zwei Mitten: in beiden Reihen steht gleichzeitig etwas
        // zentriert und hell, aber nur eines davon ist wirklich gewaehlt.
        // Vorher sah man den Unterschied nicht — der Name unter der
        // Ueberschrift sagte „Vial", waehrend oben genauso hell eine Kapsel
        // stand.
        data-dosage-active={selected || undefined}
        type="button"
        aria-pressed={selected}
        // Ohne Aufschrift unter dem Objekt braucht der Knopf seinen Namen hier.
        aria-label={String(t(form.labelKey))}
        onClick={() => onSelect(form.key)}
        // min-h-11: die 44-px-Regel fuer Tippziele. Der Standplatz ist mit
        // dem Karussell ohnehin hoeher, aber der Vertrag steht am Knopf, nicht
        // am Inhalt — sonst faellt er beim naechsten Umbau still weg.
        // w-[50%]: der Standplatz nimmt die halbe Karussellbreite, links und
        // rechts bleiben je 25% fuer die angeschnittenen Nachbarn. Mit 70%
        // stand die Mitte zwar allein da, aber die Nachbarobjekte lagen
        // mittig in ihrem eigenen, dann sehr breiten Standplatz — und damit
        // komplett ausserhalb des schmalen Streifens, der von ihnen zu sehen
        // war. Gemessen bei 430 px: 186 px Standplatz, 93 px je Rand.
        className="flex h-full min-h-11 w-[50%] shrink-0 cursor-pointer snap-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <span className={STANDPLATZ} aria-hidden="true">
          {/* Das Licht liegt UNTER dem Objekt, wie ein Spot auf der Buehne.
              Ein Rahmen darum wuerde die Reihe wieder in Kacheln zerlegen.
              Zwei Staerken, weil das Licht zwei verschiedene Dinge sagen
              muss: farbig und kraeftig steht ueber der wirklich gewaehlten
              Form, farblos und schwach nur unter dem, was gerade zentriert
              ist. Beide zusammen in Blau hiessen „zweimal gewaehlt". */}
          <span
            className={`pointer-events-none absolute inset-x-0 bottom-0 h-3/4 rounded-full ${
              selected
                ? 'bg-[radial-gradient(62%_60%_at_50%_78%,rgba(56,189,248,0.42),transparent_70%)]'
                : 'bg-[radial-gradient(62%_60%_at_50%_78%,rgba(255,255,255,0.10),transparent_70%)]'
            }`}
            style={{ opacity: leuchtstaerke }}
          />
          {isStageRenderable(form.key) ? (
            <DosageFormPreview
              dosageForm={form.key}
              // Die Eintragsfarbe traegt nur die gewaehlte Form. Faerbte sie
              // alle, waere sie kein Zeichen mehr, sondern Hintergrund.
              colorHex={selected ? colorHex : null}
              size="carousel"
              showLabel={false}
              focus={fokus}
              // Etwas groesser, aber vom Boden aus: die Objekte stehen auf
              // einer gemeinsamen Linie, ein zentriertes Skalieren wuerde die
              // Gewaehlte darueber schweben lassen.
              className={`origin-bottom transition-transform duration-200 motion-reduce:transition-none ${
                selected ? 'scale-[1.08]' : 'scale-100'
              }`}
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
      {/* <legend> muss das erste Kind von <fieldset> bleiben, sonst geht die
          Verbindung zur Barrierefreiheit verloren — die Namensanzeige folgt
          deshalb als eigenes Element danach statt in einer gemeinsamen
          Wrapper-Zeile. */}
      <legend className="mb-1 text-sm font-semibold text-slate-200">
        {t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' })}
      </legend>
      {/* Direkt unter der Ueberschrift statt unter beiden Karussells: dort
          stand sie hinter zwei fast bildschirmhohen Reihen und war auf
          kleineren Handys erst nach Scrollen zu sehen — obwohl sie genau
          zeigen soll, was man gerade gewaehlt hat, sobald man es getan hat. */}
      <p
        data-dosage-form-selected
        aria-live="polite"
        className="mb-3 min-h-5 text-sm font-semibold text-sky-200"
      >
        {selectedForm ? t(selectedForm.labelKey) : ''}
      </p>

      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.025] px-3 py-4 sm:px-4">
        <div>
          <p id="stack-dosage-primary-label" className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {ausKatalog
              ? t('my_stack_suggested_dosage_forms', { defaultValue: 'Für diese Substanz' })
              : t('my_stack_common_dosage_forms', { defaultValue: 'Häufige Darreichungsformen' })}
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
      </div>

      {error && (
        <p id="stack-dosage-form-error" role="alert" className="mt-3 text-sm text-rose-300">
          {t('my_stack_dosage_form_required', { defaultValue: 'Bitte wähle eine Darreichungsform.' })}
        </p>
      )}
    </fieldset>
  )
}
