import { CalendarCheck, ChartNoAxesCombined, Gauge } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TrackingLevel } from '../types'

export interface TrackingLevelPickerProps {
  value: TrackingLevel | null
  substanceName: string
  pkProfileAvailable: boolean
  error?: boolean
  onChange: (value: TrackingLevel) => void
}

const LEVELS: readonly TrackingLevel[] = ['intake_only', 'with_amount', 'complete']

export function TrackingLevelPicker({
  value,
  substanceName,
  pkProfileAvailable,
  error = false,
  onChange,
}: TrackingLevelPickerProps) {
  const { t } = useTranslation()
  const name = substanceName.trim() || String(t('my_stack_this_substance', { defaultValue: 'diese Substanz' }))
  const content = {
    intake_only: {
      title: t('my_stack_tracking_intake_only_title', { defaultValue: 'Nur Einnahme' }),
      recorded: t('my_stack_tracking_intake_only_recorded', {
        defaultValue: 'Erfasst, ob und wann du {{substanceName}} eingenommen hast.',
        substanceName: name,
      }),
      omitted: t('my_stack_tracking_intake_only_omitted', {
        defaultValue: 'Menge, Produktstärke und PK-Daten sind nicht erforderlich.',
      }),
      example: t('my_stack_tracking_intake_only_example', {
        defaultValue: 'Beispiel: „Heute eingenommen“ ohne Mengenangabe.',
      }),
      next: t('my_stack_tracking_intake_only_next', {
        defaultValue: 'Als Nächstes: Rhythmus und Tageszeit festlegen.',
      }),
      Icon: CalendarCheck,
    },
    with_amount: {
      title: t('my_stack_tracking_with_amount_title', { defaultValue: 'Mit Menge' }),
      recorded: t('my_stack_tracking_with_amount_recorded', {
        defaultValue: 'Erfasst die Einnahme und die geplante oder tatsächliche Menge von {{substanceName}}.',
        substanceName: name,
      }),
      omitted: t('my_stack_tracking_with_amount_omitted', {
        defaultValue: 'Die Produktstärke ist nicht erforderlich. PK-Kurven gibt es erst auf der nächsten Stufe.',
      }),
      example: t('my_stack_tracking_with_amount_example', {
        defaultValue: 'Beispiel: „1 Kapsel morgens“ oder „0,5 Tablette abends“.',
      }),
      next: t('my_stack_tracking_with_amount_next', {
        defaultValue: 'Als Nächstes: Rhythmus, Tageszeit und Menge festlegen.',
      }),
      Icon: Gauge,
    },
    complete: {
      title: t('my_stack_tracking_complete_title', { defaultValue: 'Mit Wirkstärke' }),
      recorded: t('my_stack_tracking_complete_recorded', {
        defaultValue: 'Erfasst Einnahme, Menge und die Produktstärke je Einheit.',
      }),
      omitted: t('my_stack_tracking_complete_omitted', {
        defaultValue: 'PK benötigt ein verknüpftes Profil sowie vollständige Plan- und Einnahmedaten.',
      }),
      example: t('my_stack_tracking_complete_example', {
        defaultValue: 'Beispiel: „5.000 IU pro Kapsel, 1 Kapsel morgens“.',
      }),
      next: t('my_stack_tracking_complete_next', {
        defaultValue: 'Als Nächstes: Inhaltsstoffe, Produktstärke und Einnahmeplan festlegen.',
      }),
      Icon: ChartNoAxesCombined,
    },
  } as const

  return (
    <fieldset
      data-field="trackingLevel"
      tabIndex={-1}
      aria-invalid={error || undefined}
      aria-describedby={error ? 'stack-tracking-level-error' : undefined}
      className="min-w-0"
    >
      <legend className="text-base font-semibold text-white">
        {t('my_stack_tracking_question', { defaultValue: 'Wie genau möchtest du tracken?' })}
      </legend>
      <p className="mt-1 text-[13px] leading-snug text-slate-400">
        {t('my_stack_tracking_intro', {
          defaultValue: 'Wähle nur die Tiefe, die du im Alltag zuverlässig pflegen möchtest.',
        })}
      </p>

      <div className="mt-3 grid min-w-0 gap-2.5">
        {LEVELS.map(level => {
          const selected = value === level
          const item = content[level]
          const Icon = item.Icon
          return (
            <label
              key={level}
              className={`flex min-h-11 min-w-0 cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors duration-200 focus-within:ring-2 focus-within:ring-sky-400 motion-reduce:transition-none ${selected
                ? 'border-sky-400/50 bg-sky-400/10 shadow-[0_0_22px_rgba(0,204,245,0.09),inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'border-white/10 bg-white/[0.035] hover:border-sky-400/25 hover:bg-white/[0.06]'
              }`}
            >
              <input
                type="radio"
                name="stack-tracking-level"
                value={level}
                checked={selected}
                onChange={() => onChange(level)}
                required
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-sky-400 focus-visible:outline-none"
              />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2 font-semibold text-white">
                  <Icon aria-hidden="true" size={19} className="shrink-0 text-sky-300" />
                  <span className="min-w-0 break-words">{item.title}</span>
                </span>
                <span className="mt-1.5 block space-y-1 text-[13px] leading-snug text-slate-300">
                  <span data-tracking-card="recorded" className="block">{item.recorded}</span>
                  <span data-tracking-card="omitted" className="block text-slate-400">{item.omitted}</span>
                  <span data-tracking-card="example" className="block text-slate-400">{item.example}</span>
                  <span data-tracking-card="next" className="block text-slate-300">{item.next}</span>
                  {level === 'complete' && (
                    <span data-tracking-card="pk" className="block text-sky-200">
                      {pkProfileAvailable
                        ? t('my_stack_tracking_pk_available', {
                            defaultValue: 'Für {{substanceName}} ist ein PK-Profil verfügbar. Eine Kurve erscheint nur bei vollständigen Pflichtangaben.',
                            substanceName: name,
                          })
                        : t('my_stack_tracking_pk_unavailable', {
                            defaultValue: 'Für {{substanceName}} ist derzeit kein PK-Profil verknüpft; die Stufe lässt sich trotzdem wählen.',
                            substanceName: name,
                          })}
                    </span>
                  )}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      {/* Einmal unter der Gruppe statt dreimal in den Karten: der Satz gilt
          fuer die Wahl, nicht fuer eine einzelne Stufe. Dreimal derselbe Satz
          verlaengert nur die Strecke bis zur Entscheidung. */}
      <p className="mt-3 text-xs text-slate-500">
        {t('my_stack_tracking_change_later', {
          defaultValue: 'Du kannst diese Auswahl später jederzeit ändern.',
        })}
      </p>

      {error && (
        <p id="stack-tracking-level-error" role="alert" className="mt-3 text-sm text-rose-300">
          {t('my_stack_tracking_level_required', {
            defaultValue: 'Bitte wähle eine Tracking-Tiefe.',
          })}
        </p>
      )}
    </fieldset>
  )
}
