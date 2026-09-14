import { BellRing, Clock, Moon, Plus, Sun, Sunrise, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getDosageForm, getIntakePlanUnitSuggestions } from '../lib/dosageForms'
import {
  INTAKE_FREQUENCIES,
  MAX_INTAKE_SLOTS,
  isOnDemand,
  needsInterval,
  needsWeekdays,
} from '../lib/intakeFrequency'
import { naechsterSlot } from '../lib/wizardState'
import { trackingCapabilities } from '../lib/trackingDepth'
import type { IntakePlanValidationErrors } from '../lib/validation'
import type {
  DosageFormKey,
  IntakePlanDraft,
  IntakeSlotDraft,
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

const METHODS = [
  'Subkutan',
  'Intramuskulär',
  'Nasal',
  'Oral',
  'Transdermal',
  'Intravenös',
  'Andere',
] as const
const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const
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
  const unitSuggestions = getIntakePlanUnitSuggestions(
    dosageForm,
    catalogEntry?.suggested_units,
  )
  const canSuggestFractions = dosageForm === 'tablet' && form.capabilities.includes('divisible')

  function selectFrequency(frequency: string): void {
    // Die Zahl der Einnahmezeitpunkte setzt der Reducer (`slotsFuerFrequenz`) —
    // hier fallen nur die Begleitfelder weg, die zur neuen Frequenz nicht
    // gehoeren.
    onChange({
      frequency,
      xDaysInterval: needsInterval(frequency) ? plan.xDaysInterval : null,
      scheduleDays: needsWeekdays(frequency) ? plan.scheduleDays : [],
    })
  }

  function changeSlot(index: number, changes: Partial<IntakeSlotDraft>): void {
    onChange({
      slots: plan.slots.map((slot, position) => (
        position === index ? { ...slot, ...changes } : slot
      )),
    })
  }

  // Wie oft am Tag ist eine eigene Frage — unabhaengig davon, an welchen Tagen.
  // Mo/Mi/Fr morgens UND abends ist ein normaler Plan; solange die Zahl in der
  // Frequenz steckte, liess er sich nicht ausdruecken.
  function addSlot(): void {
    if (plan.slots.length >= MAX_INTAKE_SLOTS) return
    onChange({ slots: [...plan.slots, naechsterSlot(plan.slots)] })
  }

  function removeSlot(index: number): void {
    if (plan.slots.length <= 1) return
    onChange({ slots: plan.slots.filter((_, position) => position !== index) })
  }

  function toggleWeekday(day: string): void {
    onChange({
      scheduleDays: plan.scheduleDays.includes(day)
        ? plan.scheduleDays.filter(value => value !== day)
        : [...plan.scheduleDays, day],
    })
  }

  return (
    <div className="min-w-0 space-y-5">
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
          {METHODS.map(method => <option key={method} value={method}>{method}</option>)}
        </select>
        {errors.method && (
          <p id="stack-plan-method-error" role="alert" className="mt-2 text-sm text-rose-300">
            {t('my_stack_plan_method_required', { defaultValue: 'Bitte wähle eine Methode.' })}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="stack-plan-frequency" className="mb-2 block text-sm font-semibold text-slate-200">
          {t('my_stack_plan_frequency', { defaultValue: 'Frequenz' })}
        </label>
        <select
          id="stack-plan-frequency"
          value={plan.frequency}
          onChange={event => selectFrequency(event.target.value)}
          data-field="plan.frequency"
          aria-invalid={Boolean(errors.frequency) || undefined}
          aria-describedby={errors.frequency ? 'stack-plan-frequency-error' : undefined}
          required
          className="select min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          {INTAKE_FREQUENCIES.map(frequency => <option key={frequency} value={frequency}>{frequency}</option>)}
        </select>
        {errors.frequency && (
          <p id="stack-plan-frequency-error" role="alert" className="mt-2 text-sm text-rose-300">
            {t('my_stack_plan_frequency_required', { defaultValue: 'Bitte wähle eine Frequenz.' })}
          </p>
        )}
      </div>

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

      {/* Das Ende. Es fehlte ganz — der Entwurf trug das Feld, das Formular
          fragte nie danach. Fuer alles, was man laenger nimmt, bleibt es leer;
          eine Antibiotikakur oder ein Kortisonstoss hat hier ein Datum, und
          erst damit ist sie als das erkennbar, was sie ist. */}
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

      {needsInterval(plan.frequency) && (
        <div>
          <label htmlFor="stack-plan-interval" className="mb-2 block text-sm font-semibold text-slate-200">
            {t('my_stack_plan_interval', { defaultValue: 'Intervall in Tagen' })}
          </label>
          <input
            id="stack-plan-interval"
            type="number"
            inputMode="numeric"
            min="2"
            max="30"
            value={plan.xDaysInterval ?? ''}
            onChange={event => onChange({ xDaysInterval: numericValue(event.target.value) })}
            data-field="plan.xDaysInterval"
            aria-invalid={Boolean(errors.xDaysInterval) || undefined}
            aria-describedby={errors.xDaysInterval ? 'stack-plan-interval-error' : undefined}
            className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          {errors.xDaysInterval && (
            <p id="stack-plan-interval-error" role="alert" className="mt-2 text-sm text-rose-300">
              {t('alle_x_tage_frage', { defaultValue: 'Alle wie viele Tage?' })}
            </p>
          )}
        </div>
      )}

      {needsWeekdays(plan.frequency) && (
        <fieldset
          data-field="plan.scheduleDays"
          tabIndex={-1}
          className="min-w-0"
          aria-label={String(t('my_stack_plan_weekdays', { defaultValue: 'Wochentage' }))}
          aria-invalid={Boolean(errors.scheduleDays) || undefined}
          aria-describedby={errors.scheduleDays ? 'stack-plan-weekdays-error' : undefined}
        >
          <div className="grid min-w-0 grid-cols-4 gap-2 sm:grid-cols-7">
            {WEEKDAYS.map(day => {
              const selected = plan.scheduleDays.includes(day)
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
            <p id="stack-plan-weekdays-error" role="alert" className="mt-2 text-sm text-rose-300">
              {t('wochentag_auswaehlen_hint', { defaultValue: 'Mindestens einen Wochentag auswählen' })}
            </p>
          )}
        </fieldset>
      )}

      {/* „Bei Bedarf" hat keinen geplanten Zeitpunkt — nach einer Tageszeit zu
          fragen waere eine Pflichtangabe ohne Bedeutung. */}
      {isOnDemand(plan.frequency) ? (
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
      ) : plan.slots.map((slot, index) => (
        <div key={index} data-plan-slot={index} className="min-w-0 space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          {plan.slots.length > 1 && (
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
              {/* Bei einem einzigen Zeitpunkt bleibt die Aufschrift, wie sie
                  war — „Tageszeit 1 von 1" waere eine Zahl ohne Anlass. */}
              {/* `einnahme_nr` gibt es laengst in allen vierzehn Sprachen — aus
                  der aelteren Oberflaeche, die 2x/3x taeglich schon anbot. */}
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
                  : t('my_stack_plan_routine_required', { defaultValue: 'Bitte wähle eine Tageszeit.' })}
              </p>
            )}
          </fieldset>

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
              className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
          </div>
        </div>
      ))}

      {!isOnDemand(plan.frequency) && plan.slots.length < MAX_INTAKE_SLOTS && (
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

      {tracksQuantity && (
        <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="stack-plan-quantity" className="mb-2 block text-sm font-semibold text-slate-200">
                {t('my_stack_plan_quantity', { defaultValue: quantityLabel(form) })}
              </label>
              <input
                id="stack-plan-quantity"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={plan.dose ?? ''}
                onChange={event => onChange({ dose: numericValue(event.target.value) })}
                data-field="plan.dose"
                aria-invalid={Boolean(errors.dose) || undefined}
                aria-describedby={errors.dose ? 'stack-plan-dose-error' : undefined}
                className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
              {errors.dose && (
                <p id="stack-plan-dose-error" role="alert" className="mt-2 text-sm text-rose-300">
                  {t('my_stack_plan_quantity_required', { defaultValue: 'Bitte gib eine Menge größer als 0 an.' })}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="stack-plan-unit" className="mb-2 block text-sm font-semibold text-slate-200">
                {t('my_stack_plan_unit', { defaultValue: 'Einheit der geplanten Menge' })}
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
                className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              />
              <datalist id="stack-plan-unit-suggestions">
                {unitSuggestions.map(unit => <option key={unit} value={unit} />)}
              </datalist>
              {errors.unit && (
                <p id="stack-plan-unit-error" role="alert" className="mt-2 text-sm text-rose-300">
                  {t('my_stack_plan_unit_required', { defaultValue: 'Bitte wähle oder benenne eine Einheit.' })}
                </p>
              )}
            </div>
          </div>

          {canSuggestFractions && (
            <div className="mt-3 flex min-w-0 flex-wrap gap-2">
              {TABLET_FRACTIONS.map(fraction => (
                <button
                  key={fraction.label}
                  type="button"
                  onClick={() => onChange({ dose: fraction.value, unit: plan.unit ?? 'tablet' })}
                  className="min-h-11 cursor-pointer rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-semibold text-slate-300 transition-colors duration-200 hover:border-sky-400/30 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
                >
                  {fraction.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="flex min-w-0 items-start gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-sm leading-relaxed text-slate-400">
        <BellRing aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-slate-500" />
        <span>
          {t('my_stack_plan_reminders_optional', {
            defaultValue: 'Erinnerungen sind optional und können nach dem Speichern eingerichtet werden.',
          })}
        </span>
      </p>
    </div>
  )
}
