import { BellRing, CalendarDays, CalendarRange, Clock, HandHelping, Moon, Plus, Repeat, Sun, Sunrise, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getDosageForm,
  getIntakePlanUnitSuggestions,
  methodChoicesFor,
} from '../lib/dosageForms'
import { MAX_INTAKE_SLOTS } from '../lib/intakeFrequency'
import {
  INTERVAL_BOUNDS,
  INTERVAL_UNITS,
  WEEKDAY_KEYS,
  emptyRhythm,
  rhythmSummary,
  rhythmText,
} from '../lib/intakeRhythm'
import { naechsterSlot } from '../lib/wizardState'
import { trackingCapabilities } from '../lib/trackingDepth'
import type { IntakePlanValidationErrors } from '../lib/validation'
import type {
  DosageFormKey,
  IntakePlanDraft,
  IntakeRhythm,
  IntakeRhythmKind,
  IntakeSlotDraft,
  IntervalUnit,
  RoutineGroup,
  SubstanceCatalogEntry,
  TrackingLevel,
} from '../types'

export interface IntakePlanEditorProps {
  trackingLevel: TrackingLevel
  plan: IntakePlanDraft
  dosageForm: DosageFormKey
  catalogEntry?: SubstanceCatalogEntry
  errors?: IntakePlanValidationErrors
  onChange: (changes: Partial<IntakePlanDraft>) => void
}

// Der Rhythmus als vier Formen statt als Liste fester Texte. Eine Liste deckt
// immer nur ab, was jemand hineingeschrieben hat — ein Depot alle zehn Wochen
// oder drei Wochen Pille mit einer Woche Pause standen nicht darin und haetten
// je einen neuen Eintrag gebraucht. Diese vier decken den Kalender ab.
const RHYTHM_OPTIONS: readonly {
  kind: IntakeRhythmKind
  labelKey: string
  defaultValue: string
  Icon: typeof CalendarDays
}[] = [
  { kind: 'daily', labelKey: 'my_stack_rhythm_daily', defaultValue: 'Täglich', Icon: CalendarDays },
  { kind: 'weekdays', labelKey: 'my_stack_rhythm_weekdays', defaultValue: 'Wochentage', Icon: CalendarRange },
  { kind: 'interval', labelKey: 'my_stack_rhythm_interval', defaultValue: 'Im Abstand von', Icon: Repeat },
  { kind: 'cycle', labelKey: 'my_stack_rhythm_cycle', defaultValue: 'Im Wechsel', Icon: Repeat },
  // „Nur bei Bedarf" ist die fuenfte Form, nicht ein Haken darunter: erst vier
  // Schalter anzubieten und dann „eigentlich doch nicht" liest sich rueckwaerts.
  { kind: 'on_demand', labelKey: 'my_stack_rhythm_on_demand', defaultValue: 'Nur bei Bedarf', Icon: HandHelping },
]

/** Die drei Vorlaufzeiten, die der Push-Cron kennt. */
const REMINDER_OPTIONS = [
  { value: 'on_time', labelKey: 'reminder_on_time', defaultValue: 'Bei Einnahme' },
  { value: '2h', labelKey: 'reminder_2h', defaultValue: '2 Std vorher' },
  { value: '1day', labelKey: 'reminder_1day', defaultValue: '1 Tag vorher' },
] as const

const INTERVAL_UNIT_LABELS: Record<IntervalUnit, { labelKey: string; defaultValue: string }> = {
  day: { labelKey: 'my_stack_rhythm_unit_day', defaultValue: 'Tagen' },
  week: { labelKey: 'my_stack_rhythm_unit_week', defaultValue: 'Wochen' },
  month: { labelKey: 'my_stack_rhythm_unit_month', defaultValue: 'Monaten' },
}

const ROUTINE_GROUPS: readonly {
  value: RoutineGroup
  labelKey: string
  defaultValue: string
  Icon: typeof Sunrise
}[] = [
  { value: 'morning', labelKey: 'my_stack_routine_morning', defaultValue: 'Morgens', Icon: Sunrise },
  { value: 'midday', labelKey: 'my_stack_routine_midday', defaultValue: 'Mittags', Icon: Sun },
  { value: 'evening', labelKey: 'my_stack_routine_evening', defaultValue: 'Abends', Icon: Moon },
]

const TABLET_FRACTIONS = [
  { label: '1/2 Tablette', value: 0.5 },
  { label: '1/3 Tablette', value: 0.333333 },
  { label: '1/4 Tablette', value: 0.25 },
] as const

function numericValue(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function quantityLabel(form: ReturnType<typeof getDosageForm>): string {
  if (form.capabilities.includes('injectable')) return 'Injektionsmenge pro Einnahme'
  if (form.capabilities.includes('liquid')) return 'Flüssigkeitsmenge pro Einnahme'
  return 'Geplante Menge pro Einnahme'
}

export function IntakePlanEditor({
  trackingLevel,
  plan,
  dosageForm,
  catalogEntry,
  errors = {},
  onChange,
}: IntakePlanEditorProps) {
  const { t } = useTranslation()
  const form = getDosageForm(dosageForm)
  const tracksQuantity = trackingCapabilities(trackingLevel).quantity
  const unitSuggestions = getIntakePlanUnitSuggestions(dosageForm, catalogEntry?.suggested_units)
  const canSuggestFractions = dosageForm === 'tablet' && form.capabilities.includes('divisible')
  const rhythm = plan.rhythm
  const onDemand = rhythm.kind === 'on_demand'
  const methodChoices = methodChoicesFor(dosageForm)
  const einheit = plan.unit?.trim() ?? ''

  // Ein Reiter je gewaehltem Wochentag, in Wochenreihenfolge und hoechstens
  // sieben. Nur „Wochentage waehlen" kennt einzelne Tage — taeglich, im
  // Abstand oder im Wechsel gibt es nichts zu unterscheiden.
  const tage = rhythm.kind === 'weekdays'
    ? WEEKDAY_KEYS.filter(tag => rhythm.weekdays.includes(tag))
    : []
  const [gewaehlterTag, setGewaehlterTag] = useState<string | null>(null)
  // Abgeleitet statt gespeichert: nimmt man den offenen Tag aus dem Rhythmus
  // heraus, faellt der Reiter auf den ersten zurueck, ohne dass ein Effekt
  // hinterherraeumen muss.
  const offenerTag = tage.length === 0
    ? null
    : tage.find(tag => tag === gewaehlterTag) ?? tage[0]
  const amTag = (tag: string | null) => plan.slots.filter(slot => (
    tag == null || slot.weekdays.length === 0 || slot.weekdays.includes(tag)
  ))
  const sichtbareSlots = plan.slots
    .map((slot, index) => ({ slot, index }))
    .filter(({ slot }) => (
      offenerTag == null || slot.weekdays.length === 0 || slot.weekdays.includes(offenerTag)
    ))

  function toggleReminder(value: string): void {
    onChange({
      reminders: plan.reminders.includes(value)
        ? plan.reminders.filter(eintrag => eintrag !== value)
        : [...plan.reminders, value],
    })
  }

  /** Was der Plan sagt, in einem Satz — zusammengesetzt aus allen drei Achsen. */
  function planSatz(): string {
    const teile = [rhythmText(rhythmSummary(rhythm), t)]
    if (!onDemand) {
      // Je Tag gesammelt. Sagen alle Tage dasselbe — der Normalfall —, steht es
      // einmal da: welche Tage es sind, hat der Rhythmus schon gesagt. Erst wo
      // sie sich unterscheiden, bekommt jeder Tag seine eigene Zeile.
      const jeTag = new Map<string, string[]>()
      plan.slots.forEach(slot => {
        const tageszeit = ROUTINE_GROUPS.find(gruppe => gruppe.value === slot.routineGroup)
        const wann = [
          tageszeit ? String(t(tageszeit.labelKey, { defaultValue: tageszeit.defaultValue })) : '',
          slot.time ?? '',
        ].filter(Boolean).join(' ')
        const menge = tracksQuantity && slot.dose != null ? `${slot.dose} ${einheit}`.trim() : ''
        const text = [wann, menge].filter(Boolean).join(' · ')
        if (!text) return
        const tag = slot.weekdays[0] ?? ''
        jeTag.set(tag, [...(jeTag.get(tag) ?? []), text])
      })
      const gruppen = [...jeTag.entries()]
      if (gruppen.length > 0) {
        const erste = gruppen[0][1].join(' + ')
        const gleich = gruppen.every(([, texte]) => texte.join(' + ') === erste)
        teile.push(gleich
          ? erste
          : gruppen.map(([tag, texte]) => (tag ? `${tag}: ` : '') + texte.join(' + ')).join(' / '))
      }
    } else if (tracksQuantity && plan.slots[0]?.dose != null) {
      teile.push(`${plan.slots[0].dose} ${einheit}`.trim())
    }
    return teile.join(' — ')
  }

  // Laesst die Form nur EINE Route zu, wird das Feld nicht gezeigt — dann muss
  // der Wert trotzdem stehen. Ohne diese Zusicherung blockierte der Schritt
  // lautlos: eine Pflichtangabe, die niemand sehen und also auch nicht
  // nachtragen kann.
  const einzigeRoute = methodChoices.length === 1 ? methodChoices[0] : null
  useEffect(() => {
    if (einzigeRoute && plan.method !== einzigeRoute) onChange({ method: einzigeRoute })
  }, [einzigeRoute, plan.method, onChange])

  function changeRhythm(changes: Partial<IntakeRhythm>): void {
    onChange({ rhythm: { ...rhythm, ...changes } })
  }

  function selectKind(kind: IntakeRhythmKind): void {
    if (rhythm.kind === kind) return
    // Die Zahlen der anderen Formen bleiben stehen: wer zwischen „Abstand" und
    // „Wechsel" hin und her tippt, soll seine Eingaben wiederfinden. Nur was
    // fehlt, wird auf einen brauchbaren Vorschlag gesetzt.
    const vorgabe = emptyRhythm()
    changeRhythm({
      kind,
      intervalValue: rhythm.intervalValue ?? vorgabe.intervalValue,
      onDays: rhythm.onDays ?? vorgabe.onDays,
      offDays: rhythm.offDays ?? vorgabe.offDays,
    })
  }

  function toggleWeekday(day: string): void {
    changeRhythm({
      weekdays: rhythm.weekdays.includes(day)
        ? rhythm.weekdays.filter(value => value !== day)
        : [...rhythm.weekdays, day],
    })
  }

  function changeSlot(index: number, changes: Partial<IntakeSlotDraft>): void {
    onChange({
      slots: plan.slots.map((slot, position) => (
        position === index ? { ...slot, ...changes } : slot
      )),
    })
  }

  // Wie oft am Tag ist eine eigene Frage — und sie wird JE TAG beantwortet.
  // Gezaehlt wird darum, was am offenen Reiter haengt: „montags dreimal,
  // freitags zweimal" sind fuenf Zeitpunkte und an keinem Tag zu viele.
  function addSlot(): void {
    if (amTag(offenerTag).length >= MAX_INTAKE_SLOTS) return
    const neuerSlot = naechsterSlot(amTag(offenerTag), offenerTag ? [offenerTag] : [])
    onChange({ slots: [...plan.slots, neuerSlot] })
  }

  function removeSlot(index: number): void {
    const tag = plan.slots[index]?.weekdays[0] ?? null
    if (amTag(tag).length <= 1) return
    onChange({ slots: plan.slots.filter((_, position) => position !== index) })
  }

  // Menge und Einheit gehoeren nebeneinander: man tippt „500" und liest gleich
  // daneben „mg". Die Einheit gilt fuer den ganzen Plan, es gibt sie also nur
  // einmal — an der ersten Karte zum Eingeben, an weiteren nur noch zu lesen.
  const mengeUndEinheit = (index: number) => (
    <div>
      <div className="flex min-w-0 items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`stack-plan-quantity-${index}`} className="mb-2 block text-sm font-semibold text-slate-200">
            {t('my_stack_plan_quantity', { defaultValue: quantityLabel(form) })}
          </label>
          <input
            id={`stack-plan-quantity-${index}`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={plan.slots[index]?.dose ?? ''}
            onChange={event => changeSlot(index, { dose: numericValue(event.target.value) })}
            data-field={index === 0 ? 'plan.dose' : `plan.slots.${index}.dose`}
            aria-invalid={Boolean(errors.doses?.[index]) || undefined}
            aria-describedby={errors.doses?.[index] ? `stack-plan-dose-${index}-error` : undefined}
            className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>
        {index === 0 ? (
          <div className="w-24 shrink-0">
            <label htmlFor="stack-plan-unit" className="mb-2 block text-sm font-semibold text-slate-200">
              {t('my_stack_plan_unit', { defaultValue: 'Einheit' })}
            </label>
            <input
              id="stack-plan-unit"
              list="stack-plan-unit-suggestions"
              value={plan.unit ?? ''}
              onChange={event => onChange({ unit: event.target.value || null })}
              data-field="plan.unit"
              aria-invalid={Boolean(errors.unit) || undefined}
              aria-describedby={errors.unit ? 'stack-plan-unit-error' : undefined}
              autoComplete="off"
              size={6}
              className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
            <datalist id="stack-plan-unit-suggestions">
              {unitSuggestions.map(unit => <option key={unit} value={unit} />)}
            </datalist>
          </div>
        ) : plan.unit?.trim() ? (
          <span className="flex h-11 shrink-0 items-center text-sm font-semibold text-slate-400">
            {plan.unit}
          </span>
        ) : null}
      </div>
      {/* An DIESER Karte, nicht unten bei der Einheit: bei drei Einnahmen
          sagte der Hinweis dort nicht, welche fehlt. */}
      {errors.doses?.[index] && (
        <p id={`stack-plan-dose-${index}-error`} role="alert" className="mt-2 text-sm text-rose-300">
          {t('my_stack_plan_quantity_required', { defaultValue: 'Bitte gib eine Menge größer als 0 an.' })}
        </p>
      )}
      {index === 0 && errors.unit && (
        <p id="stack-plan-unit-error" role="alert" className="mt-2 text-sm text-rose-300">
          {t('my_stack_plan_unit_required', { defaultValue: 'Bitte wähle oder benenne eine Einheit.' })}
        </p>
      )}
      {canSuggestFractions && (
        <div className="mt-2 flex min-w-0 flex-wrap gap-2">
          {TABLET_FRACTIONS.map(fraction => (
            <button
              key={fraction.label}
              type="button"
              onClick={() => {
                changeSlot(index, { dose: fraction.value })
                if (!plan.unit) onChange({ unit: 'tablet' })
              }}
              className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-semibold text-slate-300 transition-colors duration-200 hover:border-sky-400/30 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
            >
              {fraction.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="min-w-0 space-y-5">
      {/* Die Route folgt fast immer aus der Form — eine Tablette wird
          geschluckt. Nur wo es wirklich mehrere gibt (was man spritzt, kann
          subkutan, intramuskulaer oder intravenoes gehen), bleibt die Wahl. */}
      {methodChoices.length > 1 && (
        <div>
          <label htmlFor="stack-plan-method" className="mb-2 block text-sm font-semibold text-slate-200">
            {t('my_stack_plan_method', { defaultValue: 'Methode' })}
          </label>
          <select
            id="stack-plan-method"
            value={plan.method}
            onChange={event => onChange({ method: event.target.value })}
            data-field="plan.method"
            aria-invalid={Boolean(errors.method) || undefined}
            aria-describedby={errors.method ? 'stack-plan-method-error' : undefined}
            required
            className="select min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <option value="">{t('my_stack_plan_method_placeholder', { defaultValue: 'Methode wählen' })}</option>
            {methodChoices.map(method => <option key={method} value={method}>{method}</option>)}
          </select>
          {errors.method && (
            <p id="stack-plan-method-error" role="alert" className="mt-2 text-sm text-rose-300">
              {t('my_stack_plan_method_required', { defaultValue: 'Bitte wähle eine Methode.' })}
            </p>
          )}
        </div>
      )}

      {/* ── WANN ────────────────────────────────────────────────────────── */}
      <section className="min-w-0 space-y-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {t('my_stack_plan_section_when', { defaultValue: 'Wann' })}
      </h3>
      <fieldset data-field="plan.frequency" tabIndex={-1} className="min-w-0">
        <legend className="mb-2 text-sm font-semibold text-slate-200">
          {t('my_stack_plan_rhythm', { defaultValue: 'An welchen Tagen?' })}
        </legend>
        <div className="grid min-w-0 grid-cols-2 gap-2">
          {RHYTHM_OPTIONS.map(({ kind, labelKey, defaultValue, Icon }) => (
            <button
              key={kind}
              type="button"
              aria-pressed={rhythm.kind === kind}
              data-rhythm-kind={kind}
              onClick={() => selectKind(kind)}
              className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none ${rhythm.kind === kind
                ? 'border-sky-400/50 bg-sky-400/10 text-sky-200'
                : 'cursor-pointer border-white/10 bg-white/[0.035] text-slate-300 hover:border-sky-400/25'
              }`}
            >
              <Icon aria-hidden="true" size={17} className="shrink-0" />
              <span className="min-w-0 break-words text-left">{t(labelKey, { defaultValue })}</span>
            </button>
          ))}
        </div>

        {/* „Taeglich" heisst: an jedem Tag dasselbe. Wer montags morgens und
            dienstags abends nimmt, braucht die Reiter — und die haengen an
            „Wochentage waehlen". Alle sieben Tage anzuwaehlen ist fuer den
            Kalender dasselbe wie taeglich, also fuehrt ein Satz dorthin,
            statt die Frage im leeren Raum stehen zu lassen. */}
        {rhythm.kind === 'daily' && (
          <button
            type="button"
            data-rhythm-per-day
            onClick={() => changeRhythm({ kind: 'weekdays', weekdays: [...WEEKDAY_KEYS] })}
            className="mt-3 min-h-11 cursor-pointer text-left text-sm font-semibold text-sky-300 underline decoration-sky-400/40 underline-offset-4 transition-colors duration-200 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
          >
            {t('my_stack_plan_daily_per_day', {
              defaultValue: 'An jedem Tag eine andere Tageszeit?',
            })}
          </button>
        )}

        {!onDemand && rhythm.kind === 'weekdays' && (
          <div
            data-field="plan.scheduleDays"
            className="mt-3 min-w-0"
            aria-invalid={Boolean(errors.scheduleDays) || undefined}
          >
            <div className="grid min-w-0 grid-cols-4 gap-2 sm:grid-cols-7">
              {WEEKDAY_KEYS.map(day => {
                const selected = rhythm.weekdays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleWeekday(day)}
                    className={`min-h-11 min-w-0 cursor-pointer rounded-xl border px-2 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none ${selected
                      ? 'border-sky-400/50 bg-sky-400/15 text-sky-200'
                      : 'border-white/10 bg-white/[0.035] text-slate-400 hover:border-sky-400/25 hover:text-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
            {errors.scheduleDays && (
              <p role="alert" className="mt-2 text-sm text-rose-300">
                {errors.scheduleDays === 'day_without_intake'
                  ? t('my_stack_plan_day_without_intake', { defaultValue: 'An mindestens einem gewählten Tag steht keine Einnahme.' })
                  : t('wochentag_auswaehlen_hint', { defaultValue: 'Mindestens einen Wochentag auswählen' })}
              </p>
            )}
          </div>
        )}

        {!onDemand && rhythm.kind === 'interval' && (
          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <input
              id="stack-plan-interval"
              type="number"
              inputMode="numeric"
              min={INTERVAL_BOUNDS[rhythm.intervalUnit].min}
              max={INTERVAL_BOUNDS[rhythm.intervalUnit].max}
              value={rhythm.intervalValue ?? ''}
              onChange={event => changeRhythm({ intervalValue: numericValue(event.target.value) })}
              data-field="plan.xDaysInterval"
              aria-label={String(t('my_stack_rhythm_interval_value', { defaultValue: 'Abstand' }))}
              aria-invalid={Boolean(errors.xDaysInterval) || undefined}
              className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
            <select
              value={rhythm.intervalUnit}
              onChange={event => changeRhythm({ intervalUnit: event.target.value as IntervalUnit })}
              aria-label={String(t('my_stack_rhythm_interval_unit', { defaultValue: 'Einheit des Abstands' }))}
              className="select min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {INTERVAL_UNITS.map(unit => (
                <option key={unit} value={unit}>
                  {t(INTERVAL_UNIT_LABELS[unit].labelKey, { defaultValue: INTERVAL_UNIT_LABELS[unit].defaultValue })}
                </option>
              ))}
            </select>
            {errors.xDaysInterval && (
              <p role="alert" className="text-sm text-rose-300 sm:col-span-2">
                {t('my_stack_rhythm_interval_invalid', { defaultValue: 'Bitte gib einen Abstand innerhalb der gewählten Einheit an.' })}
              </p>
            )}
          </div>
        )}

        {!onDemand && rhythm.kind === 'cycle' && (
          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
            <label className="min-w-0 text-sm text-slate-300">
              <span className="mb-1 block font-semibold text-slate-200">
                {t('my_stack_rhythm_cycle_on', { defaultValue: 'Tage an' })}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                value={rhythm.onDays ?? ''}
                onChange={event => changeRhythm({ onDays: numericValue(event.target.value) })}
                data-field="plan.cycleOnDays"
                aria-invalid={Boolean(errors.scheduleDays) || undefined}
                className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            </label>
            <label className="min-w-0 text-sm text-slate-300">
              <span className="mb-1 block font-semibold text-slate-200">
                {t('my_stack_rhythm_cycle_off', { defaultValue: 'Tage Pause' })}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={90}
                value={rhythm.offDays ?? ''}
                onChange={event => changeRhythm({ offDays: numericValue(event.target.value) })}
                data-field="plan.cycleOffDays"
                aria-invalid={Boolean(errors.scheduleDays) || undefined}
                className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            </label>
            {errors.scheduleDays && (
              <p role="alert" className="text-sm text-rose-300 sm:col-span-2">
                {t('my_stack_rhythm_cycle_invalid', { defaultValue: 'Ein Wechsel braucht mindestens einen Tag an und einen Tag Pause.' })}
              </p>
            )}
          </div>
        )}

      </fieldset>
      {/* ── WAS JE EINNAHME — direkt unter „An welchen Tagen?", denn die
             Zeitpunkte gehoeren zu den Tagen und nicht hinter den Zeitraum. */}
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {t('my_stack_plan_section_each', { defaultValue: 'Was je Einnahme' })}
      </h3>

      {/* Ein Reiter je Tag. Die Zahl daneben sagt, wie viele Einnahmen dieser
          Tag hat — „Mo 2 · Mi 1 · Fr 1" steht damit lesbar da, ohne dass man
          sich durch die Reiter klicken muss. */}
      {!onDemand && tage.length > 0 && (
        <div
          role="tablist"
          data-plan-day-tabs
          aria-label={String(t('my_stack_plan_day_tabs', { defaultValue: 'Tage des Plans' }))}
          className="flex min-w-0 flex-wrap gap-2"
        >
          {tage.map(tag => {
            const anzahl = amTag(tag).length
            const offen = tag === offenerTag
            return (
              <button
                key={tag}
                type="button"
                role="tab"
                id={`stack-plan-day-tab-${tag}`}
                aria-selected={offen}
                aria-controls={`stack-plan-day-panel-${tag}`}
                data-plan-day-tab={tag}
                data-plan-day-count={anzahl}
                aria-label={String(t('my_stack_plan_day_tab', {
                  defaultValue: '{{day}}: {{count}} Einnahmen',
                  day: tag,
                  count: anzahl,
                }))}
                onClick={() => setGewaehlterTag(tag)}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none ${offen
                  ? 'border-sky-400/50 bg-sky-400/15 text-sky-200'
                  : 'border-white/10 bg-white/[0.035] text-slate-400 hover:border-sky-400/25 hover:text-slate-200'
                }`}
              >
                <span aria-hidden="true">{tag}</span>
                <span
                  aria-hidden="true"
                  className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-semibold ${offen ? 'bg-sky-400/25 text-sky-100' : 'bg-white/[0.06] text-slate-400'}`}
                >
                  {anzahl}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {onDemand ? (
        <div className="min-w-0 space-y-3">
          <p
            data-plan-on-demand
            className="flex min-w-0 items-start gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm leading-relaxed text-slate-400"
          >
            <Clock aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-slate-500" />
            <span>
              {t('my_stack_plan_on_demand_hint', {
                defaultValue: 'Kein fester Zeitpunkt: nichts wird fällig, nichts gilt als verpasst. Du trägst die Einnahme ein, wenn sie stattgefunden hat.',
              })}
            </span>
          </p>
          {/* Eine Menge braucht es trotzdem: „400 mg je Einnahme". Sie haengt
              am selben einen Zeitpunkt, der nur seine Tageszeit nicht zeigt. */}
          {tracksQuantity && mengeUndEinheit(0)}
        </div>
      ) : (
        <div
          role={offenerTag ? 'tabpanel' : undefined}
          id={offenerTag ? `stack-plan-day-panel-${offenerTag}` : undefined}
          aria-labelledby={offenerTag ? `stack-plan-day-tab-${offenerTag}` : undefined}
          className="min-w-0 space-y-3"
        >
          {sichtbareSlots.map(({ slot, index }) => (
        <div key={index} data-plan-slot={index} className="min-w-0 space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          {sichtbareSlots.length > 1 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => removeSlot(index)}
                aria-label={String(t('my_stack_plan_remove_slot', { defaultValue: 'Einnahmezeitpunkt entfernen' }))}
                className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl text-slate-400 transition-colors duration-200 hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
              >
                <Trash2 aria-hidden="true" size={18} />
              </button>
            </div>
          )}
          <fieldset
            data-field={`plan.slots.${index}.routineGroup`}
            tabIndex={-1}
            aria-invalid={Boolean(errors.slots?.[index]) || undefined}
            aria-describedby={errors.slots?.[index] ? `stack-plan-routine-${index}-error` : undefined}
            className="min-w-0"
          >
            <legend className="mb-2 text-sm font-semibold text-slate-200">
              {/* `einnahme_nr` gibt es laengst in allen vierzehn Sprachen. Bei
                  einem einzigen Zeitpunkt bleibt die Aufschrift, wie sie war —
                  „Einnahme 1 von 1" waere eine Zahl ohne Anlass. */}
              {plan.slots.length > 1
                ? t('einnahme_nr', { defaultValue: `Einnahme ${index + 1}`, n: index + 1 })
                : t('my_stack_plan_routine_group', { defaultValue: 'Tageszeit' })}
            </legend>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
              {ROUTINE_GROUPS.map(({ value, labelKey, defaultValue, Icon }) => (
                <label
                  key={value}
                  className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors duration-200 focus-within:ring-2 focus-within:ring-sky-400 motion-reduce:transition-none ${slot.routineGroup === value
                    ? 'border-sky-400/50 bg-sky-400/10 text-sky-200'
                    : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-sky-400/25'
                  }`}
                >
                  <input
                    type="radio"
                    name={`stack-plan-routine-${index}`}
                    value={value}
                    checked={slot.routineGroup === value}
                    onChange={() => changeSlot(index, { routineGroup: value })}
                    required
                    className="h-5 w-5 shrink-0 cursor-pointer accent-sky-400"
                  />
                  <Icon aria-hidden="true" size={18} className="shrink-0" />
                  <span className="min-w-0 break-words">{t(labelKey, { defaultValue })}</span>
                </label>
              ))}
            </div>
            {errors.slots?.[index] && (
              <p id={`stack-plan-routine-${index}-error`} role="alert" className="mt-2 text-sm text-rose-300">
                {errors.slots[index] === 'duplicate'
                  ? t('my_stack_plan_slot_duplicate', { defaultValue: 'Dieser Zeitpunkt steht schon da — gib ihm eine eigene Uhrzeit.' })
                  : errors.slots[index] === 'unknown_day'
                    ? t('my_stack_plan_slot_unknown_day', { defaultValue: 'Dieser Zeitpunkt liegt an einem Tag, den der Plan nicht auswählt.' })
                    : t('my_stack_plan_routine_required', { defaultValue: 'Bitte wähle eine Tageszeit.' })}
              </p>
            )}
          </fieldset>

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`stack-plan-time-${index}`} className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Clock aria-hidden="true" size={17} className="text-slate-400" />
                {t('my_stack_plan_time', { defaultValue: 'Genaue Uhrzeit (optional)' })}
              </label>
              <input
                id={`stack-plan-time-${index}`}
                type="time"
                value={slot.time ?? ''}
                onChange={event => changeSlot(index, { time: event.target.value || null })}
                className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
            </div>

            {tracksQuantity && mengeUndEinheit(index)}
          </div>
            </div>
          ))}

          {/* Zaehlt den offenen Reiter: an einem Tag hoechstens vier, im Plan
              so viele, wie die Tage zusammen ergeben. */}
          {sichtbareSlots.length < MAX_INTAKE_SLOTS && (
            <button
              type="button"
              onClick={addSlot}
              data-plan-add-slot
              className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-semibold text-slate-200 transition-colors duration-200 hover:border-sky-400/25 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
            >
              <Plus aria-hidden="true" size={18} />
              {t('my_stack_plan_add_slot', { defaultValue: 'Weitere Einnahme am selben Tag' })}
            </button>
          )}
        </div>
      )}

      {/* Der Zeitraum steht hinter den Zeitpunkten: erst was, dann ab wann. */}

      <div>
        <label htmlFor="stack-plan-start-date" className="mb-2 block text-sm font-semibold text-slate-200">
          {t('my_stack_plan_start_date', { defaultValue: 'Start / gültig ab' })}
        </label>
        <input
          id="stack-plan-start-date"
          type="date"
          value={plan.startDate}
          onChange={event => onChange({ startDate: event.target.value })}
          data-field="plan.startDate"
          aria-invalid={Boolean(errors.startDate) || undefined}
          aria-describedby={errors.startDate ? 'stack-plan-start-date-error' : undefined}
          required
          className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        />
        {errors.startDate && (
          <p id="stack-plan-start-date-error" role="alert" className="mt-2 text-sm text-rose-300">
            {t('my_stack_plan_start_date_required', { defaultValue: 'Bitte wähle ein Startdatum.' })}
          </p>
        )}
      </div>

      {/* Das Ende. Fuer alles, was man laenger nimmt, bleibt es leer; eine
          Antibiotikakur oder ein Kortisonstoss hat hier ein Datum. */}
      <div>
        <label htmlFor="stack-plan-end-date" className="mb-2 block text-sm font-semibold text-slate-200">
          {t('my_stack_plan_end_date', { defaultValue: 'Ende (optional)' })}
        </label>
        <input
          id="stack-plan-end-date"
          type="date"
          value={plan.endDate ?? ''}
          min={plan.startDate || undefined}
          onChange={event => onChange({ endDate: event.target.value || null })}
          data-field="plan.endDate"
          aria-invalid={Boolean(errors.endDate) || undefined}
          aria-describedby={errors.endDate ? 'stack-plan-end-date-error' : 'stack-plan-end-date-hint'}
          className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        />
        {errors.endDate ? (
          <p id="stack-plan-end-date-error" role="alert" className="mt-2 text-sm text-rose-300">
            {t('my_stack_plan_end_date_before_start', { defaultValue: 'Das Ende liegt vor dem Start.' })}
          </p>
        ) : (
          <p id="stack-plan-end-date-hint" className="mt-2 text-xs leading-relaxed text-slate-400">
            {t('my_stack_plan_end_date_hint', { defaultValue: 'Leer lassen, wenn du es dauerhaft nimmst. Für eine Kur das letzte Einnahmedatum.' })}
          </p>
        )}
      </div>

      </section>

      {/* ── ERINNERUNG ──────────────────────────────────────────────────── */}
      {/* Hier stand bisher nur ein Satz: „Erinnerungen sind optional und
          koennen nach dem Speichern eingerichtet werden." Der Entwurf traegt
          `reminders`, die Tabelle die Spalte, der Push-Cron kennt die drei
          Vorlaufzeiten — nur gefragt hat der Assistent nie, und jeder neue
          Eintrag wurde mit 'none' gespeichert. Ein Versprechen ohne
          Einloesung. */}
      <section className="min-w-0 space-y-3">
        <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <BellRing aria-hidden="true" size={14} />
          {t('erinnerung_label', { defaultValue: 'Erinnerung' })}
        </h3>
        {onDemand ? (
          <p data-plan-reminders-off className="text-xs leading-relaxed text-slate-400">
            {t('my_stack_plan_reminders_on_demand', {
              defaultValue: 'Ohne festen Zeitpunkt gibt es nichts, woran erinnert werden könnte.',
            })}
          </p>
        ) : (
          <div data-plan-reminders className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
            {REMINDER_OPTIONS.map(({ value, labelKey, defaultValue }) => (
              <label
                key={value}
                className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition-colors duration-200 focus-within:ring-2 focus-within:ring-sky-400 motion-reduce:transition-none ${plan.reminders.includes(value)
                  ? 'border-sky-400/50 bg-sky-400/10 text-sky-200'
                  : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-sky-400/25'
                }`}
              >
                <input
                  type="checkbox"
                  checked={plan.reminders.includes(value)}
                  onChange={() => toggleReminder(value)}
                  className="h-5 w-5 shrink-0 cursor-pointer accent-sky-400"
                />
                <span className="min-w-0 break-words">{t(labelKey, { defaultValue })}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Was gerade dasteht, in einem Satz. Der Plan besteht aus drei Achsen
          ueber zehn Felder; ohne diese Zeile muss man sie im Kopf
          zusammensetzen. */}
      <p
        data-plan-summary
        className="flex min-w-0 items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 text-sm leading-relaxed text-sky-100"
      >
        <CalendarDays aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-sky-300/80" />
        <span>
          {t('my_stack_plan_summary', {
            defaultValue: 'Ab {{start}}: {{plan}}',
            start: plan.startDate || '—',
            plan: planSatz(),
          })}
          {plan.endDate
            ? ` ${t('my_stack_plan_summary_until', { defaultValue: 'Bis {{ende}}.', ende: plan.endDate })}`
            : ''}
        </span>
      </p>

    </div>
  )
}
