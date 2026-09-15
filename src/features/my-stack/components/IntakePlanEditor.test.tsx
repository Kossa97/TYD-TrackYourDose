// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DosageFormKey,
  IntakePlanDraft,
  SubstanceCatalogEntry,
  TrackingLevel,
} from '../types'
import { IntakePlanEditor } from './IntakePlanEditor'
import { emptyRhythm } from '../lib/intakeRhythm'

const i18nTestState = vi.hoisted(() => ({ translations: {} as Record<string, string> }))

// Der Mock interpoliert {{platzhalter}} wie i18next selbst — sonst liesse
// sich ein zusammengesetzter Satz wie die Planvorschau gar nicht pruefen.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const vorlage = i18nTestState.translations[key]
        ?? (options?.defaultValue as string | undefined)
        ?? key
      return vorlage.replace(/\{\{(\w+)\}\}/g, (treffer, name: string) => (
        options && name in options ? String(options[name]) : treffer
      ))
    },
  }),
}))

const vitaminD3: SubstanceCatalogEntry = {
  id: 'vitamin-d3',
  canonical_name: 'Vitamin D3',
  aliases: ['Cholecalciferol'],
  default_category: 'vitamin',
  suggested_units: ['IU', 'mcg'],
  suggested_dosage_forms: ['tablet', 'capsule', 'drops'],
  pk_profile_id: null,
  active: true,
}

const plan: IntakePlanDraft = {
  name: 'Vitamin D3',
  unit: null,
  method: '',
  rhythm: emptyRhythm(),
  startDate: '2026-08-16',
  endDate: null,
  slots: [{ routineGroup: 'morning', time: null, dose: null, weekdays: [] }],
  reminders: [],
}

function PlanHarness({
  trackingLevel,
  dosageForm,
  initialPlan = plan,
}: {
  trackingLevel: TrackingLevel
  dosageForm: DosageFormKey
  initialPlan?: IntakePlanDraft
}) {
  const [value, setValue] = useState(initialPlan)
  return (
    <IntakePlanEditor
      trackingLevel={trackingLevel}
      plan={value}
      dosageForm={dosageForm}
      catalogEntry={vitaminD3}
      onChange={changes => setValue(current => ({ ...current, ...changes }))}
    />
  )
}

afterEach(cleanup)
beforeEach(() => {
  i18nTestState.translations = {}
})

describe('IntakePlanEditor', () => {
  it('fragt die Route nur, wo die Form sie offenlässt', () => {
    // Eine Kapsel wird geschluckt — eine Pflichtwahl, deren Antwort feststeht,
    // ist eine Frage zu viel. Was man spritzt, kann dagegen subkutan,
    // intramuskulär oder intravenös gehen; dort bleibt die Wahl.
    const { rerender } = render(<PlanHarness trackingLevel="intake_only" dosageForm="capsule" />)
    expect(screen.queryByLabelText('Methode')).toBeNull()

    rerender(<PlanHarness trackingLevel="intake_only" dosageForm="vial" />)
    const method = screen.getByLabelText('Methode') as HTMLSelectElement
    expect(method.required).toBe(true)
    expect(Array.from(method.options).map(option => option.value))
      .toEqual(['', 'Subkutan', 'Intramuskulär', 'Intravenös'])
  })

  it('setzt die einzige Route selbst, damit der Schritt nicht lautlos blockiert', () => {
    // Das Feld ist bei der Kapsel unsichtbar — bliebe die Route leer, stünde
    // eine Pflichtangabe im Weg, die niemand sehen und also auch nicht
    // nachtragen kann.
    const onChange = vi.fn()
    render(
      <IntakePlanEditor
        trackingLevel="intake_only"
        plan={{ ...plan, method: '' }}
        dosageForm="capsule"
        onChange={onChange}
      />,
    )

    expect(onChange).toHaveBeenCalledWith({ method: 'Oral' })
  })

  it('stellt die Einheit neben die Mengen, nicht unter alle Karten', () => {
    // Seit die Menge am Zeitpunkt steht, tippte man „500" und musste an drei
    // Karten vorbeiscrollen, um „mg" zu finden.
    render(<PlanHarness
      trackingLevel="with_amount"
      dosageForm="tablet"
      initialPlan={{
        ...plan,
        slots: [
          { routineGroup: 'morning', time: '08:00', dose: 1000, weekdays: [] },
          { routineGroup: 'evening', time: '20:00', dose: 500, weekdays: [] },
        ],
      }}
    />)

    const einheit = screen.getByLabelText('Einheit der geplanten Menge')
    const ersteKarte = document.querySelector('[data-plan-slot="0"]')!
    // Die Einheit steht VOR der ersten Karte im Dokument.
    expect(ersteKarte.compareDocumentPosition(einheit) & Node.DOCUMENT_POSITION_PRECEDING)
      .toBeTruthy()
  })

  it('stellt den Mengenfehler an die Karte, in der die Zahl fehlt', () => {
    render(
      <IntakePlanEditor
        trackingLevel="with_amount"
        plan={{
          ...plan,
          unit: 'mg',
          slots: [
            { routineGroup: 'morning', time: '08:00', dose: 1000, weekdays: [] },
            { routineGroup: 'evening', time: '20:00', dose: null, weekdays: [] },
          ],
        }}
        dosageForm="tablet"
        errors={{ dose: 'required', doses: ['', 'required'] }}
        onChange={vi.fn()}
      />,
    )

    // Genau eine Meldung, und zwar in der zweiten Karte.
    const meldungen = screen.getAllByRole('alert')
    expect(meldungen).toHaveLength(1)
    expect(document.querySelector('[data-plan-slot="1"]')!.contains(meldungen[0])).toBe(true)
  })

  it('fragt die Erinnerung, statt sie zu versprechen', () => {
    // Vorher stand hier ein Satz „kann nach dem Speichern eingerichtet
    // werden" — und jeder neue Eintrag wurde mit 'none' gespeichert.
    render(<PlanHarness trackingLevel="intake_only" dosageForm="tablet" />)

    fireEvent.click(screen.getByLabelText('2 Std vorher'))
    expect((screen.getByLabelText('2 Std vorher') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText('Bei Einnahme') as HTMLInputElement).checked).toBe(false)
  })

  it('nimmt bei „Bei Bedarf" die Erinnerung weg und sagt warum', () => {
    render(<PlanHarness
      trackingLevel="intake_only"
      dosageForm="tablet"
      initialPlan={{ ...plan, rhythm: { ...emptyRhythm(), kind: 'on_demand' } }}
    />)

    expect(document.querySelector('[data-plan-reminders]')).toBeNull()
    expect(document.querySelector('[data-plan-reminders-off]')?.textContent)
      .toContain('nichts, woran erinnert werden könnte')
  })

  it('liest den Plan in einem Satz zurück', () => {
    // Der Plan besteht aus drei Achsen über zehn Felder; ohne diese Zeile muss
    // man sie im Kopf zusammensetzen.
    render(<PlanHarness
      trackingLevel="with_amount"
      dosageForm="tablet"
      initialPlan={{
        ...plan,
        unit: 'mg',
        rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo', 'Mi', 'Fr'] },
        slots: [
          { routineGroup: 'morning', time: '08:00', dose: 1000, weekdays: [] },
          { routineGroup: 'evening', time: '20:00', dose: 500, weekdays: [] },
        ],
      }}
    />)

    const satz = document.querySelector('[data-plan-summary]')?.textContent ?? ''
    expect(satz).toContain('Mo, Mi, Fr')
    expect(satz).toContain('Morgens 08:00 · 1000 mg')
    expect(satz).toContain('Abends 20:00 · 500 mg')
  })

  it('zeigt ein Startdatum, das sich ändern lässt', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="capsule" />)

    const startDate = screen.getByLabelText('Start / gültig ab') as HTMLInputElement
    expect(startDate.required).toBe(true)
    expect(startDate.value).toBe('2026-08-16')
  })

  it('fragt nach einem Ende — optional, und nie vor dem Start', () => {
    // Das Feld fehlte ganz: der Entwurf trug `endDate`, das Formular fragte
    // nie danach. Eine Antibiotikakur lief damit weiter, bis jemand sie von
    // Hand beendete.
    render(<PlanHarness trackingLevel="intake_only" dosageForm="capsule" />)

    const ende = screen.getByLabelText('Ende (optional)') as HTMLInputElement
    expect(ende.required).toBe(false)
    expect(ende.value).toBe('')
    expect(ende.min).toBe('2026-08-16')

    fireEvent.change(ende, { target: { value: '2026-08-23' } })
    expect((screen.getByLabelText('Ende (optional)') as HTMLInputElement).value).toBe('2026-08-23')
  })

  it('zeigt bei „2x täglich" zwei Einnahmezeitpunkte mit eigener Uhrzeit', () => {
    // Bei einem Antibiotikum ist das die Regel. Die Auswertung konnte mehrere
    // Zeitpunkte von Anfang an — das Formular bot nur einen an.
    render(<PlanHarness
      trackingLevel="intake_only"
      dosageForm="tablet"
      initialPlan={{
        ...plan,
        slots: [
          { routineGroup: 'morning', time: null, dose: null, weekdays: [] },
          { routineGroup: 'evening', time: null, dose: null, weekdays: [] },
        ],
      }}
    />)

    expect(document.querySelectorAll('[data-plan-slot]')).toHaveLength(2)
    expect(screen.getByText('Einnahme 1')).toBeTruthy()
    expect(screen.getByText('Einnahme 2')).toBeTruthy()

    const uhrzeiten = screen.getAllByLabelText('Genaue Uhrzeit (optional)') as HTMLInputElement[]
    expect(uhrzeiten).toHaveLength(2)

    // Jeder Zeitpunkt haelt seine eigene Uhrzeit.
    fireEvent.change(uhrzeiten[1], { target: { value: '20:00' } })
    const danach = screen.getAllByLabelText('Genaue Uhrzeit (optional)') as HTMLInputElement[]
    expect(danach[0].value).toBe('')
    expect(danach[1].value).toBe('20:00')
  })

  it('nimmt bei „Bei Bedarf" die Tageszeit weg und sagt warum', () => {
    render(<PlanHarness
      trackingLevel="intake_only"
      dosageForm="tablet"
      initialPlan={{ ...plan, rhythm: { ...emptyRhythm(), kind: 'on_demand' }, slots: [] }}
    />)

    expect(document.querySelectorAll('[data-plan-slot]')).toHaveLength(0)
    expect(screen.queryByLabelText('Genaue Uhrzeit (optional)')).toBeNull()
    expect(document.querySelector('[data-plan-on-demand]')?.textContent)
      .toContain('nichts gilt als verpasst')
  })

  it('fragt nach den Tagen in vier Formen statt in einer Liste', () => {
    // Eine Liste deckt immer nur ab, was jemand hineingeschrieben hat — ein
    // Depot alle zehn Wochen stand nie darin. Diese vier decken den Kalender.
    render(<PlanHarness trackingLevel="intake_only" dosageForm="tablet" />)

    expect([...document.querySelectorAll('[data-rhythm-kind]')]
      .map(knopf => knopf.getAttribute('data-rhythm-kind')))
      .toEqual(['daily', 'weekdays', 'interval', 'cycle', 'on_demand'])
  })

  it('erlaubt einen Abstand in Tagen, Wochen und Monaten', () => {
    // Der Fall, an dem die alte Liste scheiterte: ein Depot alle zehn Wochen,
    // Denosumab alle sechs Monate. „Alle X Tage" war auf 30 Tage begrenzt.
    render(<PlanHarness trackingLevel="intake_only" dosageForm="vial" />)

    fireEvent.click(screen.getByRole('button', { name: /Im Abstand von/ }))
    const abstand = screen.getByLabelText('Abstand') as HTMLInputElement
    const einheit = screen.getByLabelText('Einheit des Abstands') as HTMLSelectElement

    expect(Array.from(einheit.options).map(option => option.value)).toEqual(['day', 'week', 'month'])
    fireEvent.change(abstand, { target: { value: '10' } })
    fireEvent.change(einheit, { target: { value: 'week' } })

    expect((screen.getByLabelText('Abstand') as HTMLInputElement).value).toBe('10')
    expect((screen.getByLabelText('Einheit des Abstands') as HTMLSelectElement).value).toBe('week')
  })

  it('erlaubt einen Wechsel aus Einnahme- und Pausentagen', () => {
    // Die Pille: drei Wochen an, eine Woche Pause. Vorher gab es genau einen
    // fest verdrahteten Wechsel, „5 Tage an / 2 aus".
    render(<PlanHarness trackingLevel="intake_only" dosageForm="tablet" />)

    fireEvent.click(screen.getByRole('button', { name: /Im Wechsel/ }))
    fireEvent.change(screen.getByLabelText('Tage an'), { target: { value: '21' } })
    fireEvent.change(screen.getByLabelText('Tage Pause'), { target: { value: '7' } })

    expect((screen.getByLabelText('Tage an') as HTMLInputElement).value).toBe('21')
    expect((screen.getByLabelText('Tage Pause') as HTMLInputElement).value).toBe('7')
  })

  it('lässt weitere Einnahmen am selben Tag zu — auch bei „Wochentage wählen"', () => {
    // Genau der gemeldete Fall: Mo/Mi/Fr morgens UND abends.
    render(<PlanHarness
      trackingLevel="intake_only"
      dosageForm="tablet"
      initialPlan={{ ...plan, rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo', 'Mi', 'Fr'] } }}
    />)

    expect(document.querySelectorAll('[data-plan-slot]')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Weitere Einnahme am selben Tag' }))
    expect(document.querySelectorAll('[data-plan-slot]')).toHaveLength(2)
    expect(screen.getByText('Einnahme 1')).toBeTruthy()
    expect(screen.getByText('Einnahme 2')).toBeTruthy()

    // Die Wochentage bleiben, wo sie waren.
    expect(document.querySelector('[data-rhythm-kind="weekdays"]')?.getAttribute('aria-pressed'))
      .toBe('true')
    // „Mo" gibt es jetzt mehrfach: einmal im Rhythmus, einmal je Einnahme.
    // Gemeint ist der im Rhythmus.
    const rhythmusTage = document.querySelector('[data-field="plan.scheduleDays"]')!
    expect(within(rhythmusTage as HTMLElement).getByRole('button', { name: 'Mo' })
      .getAttribute('aria-pressed')).toBe('true')
  })

  it('lässt je Einnahme sagen, an welchen der gewählten Tage sie liegt', () => {
    // Genau der gefragte Fall: montags zweimal, mittwochs einmal.
    render(<PlanHarness
      trackingLevel="intake_only"
      dosageForm="tablet"
      initialPlan={{
        ...plan,
        rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo', 'Mi'] },
        slots: [
          { routineGroup: 'morning', time: '08:00', dose: null, weekdays: [] },
          { routineGroup: 'evening', time: '20:00', dose: null, weekdays: [] },
        ],
      }}
    />)

    // Je Einnahme eine Chipreihe, beide Tage zunächst an: der Normalfall ist
    // „an allen Tagen des Rhythmus".
    const zweite = document.querySelector('[data-plan-slot-days="1"]') as HTMLElement
    expect(zweite).not.toBeNull()
    expect(within(zweite).getByRole('button', { name: 'Mi' }).getAttribute('aria-pressed'))
      .toBe('true')

    // Mittwoch bei der Abendeinnahme abwählen → sie liegt nur noch montags.
    fireEvent.click(within(zweite).getByRole('button', { name: 'Mi' }))
    const danach = document.querySelector('[data-plan-slot-days="1"]') as HTMLElement
    expect(within(danach).getByRole('button', { name: 'Mo' }).getAttribute('aria-pressed'))
      .toBe('true')
    expect(within(danach).getByRole('button', { name: 'Mi' }).getAttribute('aria-pressed'))
      .toBe('false')
    // Und der Satz sagt es: die Abendeinnahme trägt ihren Tag.
    expect(document.querySelector('[data-plan-summary]')?.textContent).toContain('Mo · Abends 20:00')
  })

  it('zeigt die Tageswahl nur, wo es Wochentage gibt', () => {
    // Bei „täglich" oder „alle 3 Wochen" gibt es keine Tage, unter denen man
    // wählen könnte — dort wäre die Chipreihe eine Frage ohne Gegenstand.
    render(<PlanHarness trackingLevel="intake_only" dosageForm="tablet" />)
    expect(document.querySelector('[data-plan-slot-days]')).toBeNull()
    cleanup()

    // `PlanHarness` haelt den Plan in eigenem State — ein `rerender` mit
    // anderem `initialPlan` erreicht ihn nicht.
    render(<PlanHarness
      trackingLevel="intake_only"
      dosageForm="tablet"
      initialPlan={{ ...plan, rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo'] } }}
    />)
    expect(document.querySelector('[data-plan-slot-days]')).not.toBeNull()
  })

  it('nimmt einen Zeitpunkt wieder weg, aber nie den letzten', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="tablet" />)

    // Bei einem einzigen Zeitpunkt gibt es nichts zu entfernen.
    expect(screen.queryByRole('button', { name: 'Einnahmezeitpunkt entfernen' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Weitere Einnahme am selben Tag' }))
    const entfernen = screen.getAllByRole('button', { name: 'Einnahmezeitpunkt entfernen' })
    expect(entfernen).toHaveLength(2)

    fireEvent.click(entfernen[0])
    expect(document.querySelectorAll('[data-plan-slot]')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Einnahmezeitpunkt entfernen' })).toBeNull()
  })

  it('hört bei vier Einnahmen am Tag auf', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="tablet" />)

    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Weitere Einnahme am selben Tag' }))
    }

    expect(document.querySelectorAll('[data-plan-slot]')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Weitere Einnahme am selben Tag' })).toBeNull()
  })

  it('bietet bei „Bei Bedarf" gar keinen Zeitpunkt an', () => {
    render(<PlanHarness
      trackingLevel="intake_only"
      dosageForm="tablet"
      initialPlan={{ ...plan, rhythm: { ...emptyRhythm(), kind: 'on_demand' }, slots: [] }}
    />)

    expect(screen.queryByRole('button', { name: 'Weitere Einnahme am selben Tag' })).toBeNull()
  })

  it('omits planned quantity for intake-only tracking', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="tablet" />)

    expect(screen.queryByLabelText('Geplante Menge pro Einnahme')).toBeNull()
    expect(screen.queryByLabelText('Einheit der geplanten Menge')).toBeNull()
    expect(document.querySelector('[data-rhythm-kind="daily"]')).not.toBeNull()
  })

  it.each(['with_amount', 'complete'] as const)('shows quantity and unit for %s', trackingLevel => {
    render(<PlanHarness trackingLevel={trackingLevel} dosageForm="tablet" />)

    expect(screen.getByLabelText('Geplante Menge pro Einnahme')).toBeTruthy()
    expect(screen.getByLabelText('Einheit der geplanten Menge')).toBeTruthy()
    if (trackingLevel === 'complete') expect(screen.queryByLabelText('Stärke')).toBeNull()
  })

  it('requires a routine group while keeping exact time optional', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="capsule" />)

    expect((screen.getByRole('radio', { name: 'Morgens' }) as HTMLInputElement).required).toBe(true)
    expect((screen.getByLabelText('Genaue Uhrzeit (optional)') as HTMLInputElement).required).toBe(false)
    // Statt eines Satzes „kann später eingerichtet werden" stehen hier jetzt
    // die drei Vorlaufzeiten, die der Push-Cron ohnehin kennt.
    expect(document.querySelector('[data-plan-reminders]')).not.toBeNull()
  })

  it('renders translated routine labels without changing their stored ids', () => {
    i18nTestState.translations = {
      my_stack_routine_morning: 'Morning',
      my_stack_routine_midday: 'Midday',
      my_stack_routine_evening: 'Evening',
    }
    render(<PlanHarness trackingLevel="intake_only" dosageForm="capsule" />)

    expect((screen.getByRole('radio', { name: 'Morning' }) as HTMLInputElement).value).toBe('morning')
    expect((screen.getByRole('radio', { name: 'Midday' }) as HTMLInputElement).value).toBe('midday')
    const evening = screen.getByRole('radio', { name: 'Evening' }) as HTMLInputElement
    expect(evening.value).toBe('evening')
    fireEvent.click(evening)
    expect(evening.checked).toBe(true)
  })

  it('sets tablet fractions and never suggests splitting capsules', () => {
    const { rerender } = render(<PlanHarness trackingLevel="with_amount" dosageForm="tablet" />)
    const quantity = screen.getByLabelText('Geplante Menge pro Einnahme') as HTMLInputElement

    fireEvent.click(screen.getByRole('button', { name: '1/2 Tablette' }))
    expect(quantity.value).toBe('0.5')
    fireEvent.click(screen.getByRole('button', { name: '1/3 Tablette' }))
    expect(quantity.value).toBe('0.333333')
    fireEvent.click(screen.getByRole('button', { name: '1/4 Tablette' }))
    expect(quantity.value).toBe('0.25')

    rerender(<PlanHarness trackingLevel="with_amount" dosageForm="capsule" />)
    const capsuleQuantity = screen.getByLabelText('Geplante Menge pro Einnahme') as HTMLInputElement
    fireEvent.change(capsuleQuantity, { target: { value: '0.75' } })
    expect(capsuleQuantity.value).toBe('0.75')
    expect(screen.queryByRole('button', { name: /Kapsel/ })).toBeNull()
  })

  it('offers catalog units for Vitamin D3 tablets and capsules', () => {
    const { container, rerender } = render(
      <PlanHarness trackingLevel="with_amount" dosageForm="tablet" />,
    )

    expect(Array.from(container.querySelectorAll('datalist option')).map(option => option.getAttribute('value')))
      .toEqual(expect.arrayContaining(['IU', 'mcg', 'tablet']))

    rerender(<PlanHarness trackingLevel="with_amount" dosageForm="capsule" />)
    expect(Array.from(container.querySelectorAll('datalist option')).map(option => option.getAttribute('value')))
      .toEqual(expect.arrayContaining(['IU', 'mcg', 'capsule']))
  })

  it('does not reinsert an incompatible stale capsule unit for a liquid plan', () => {
    const staleCapsulePlan = { ...plan, unit: 'capsule' }
    const { container } = render(
      <PlanHarness
        trackingLevel="with_amount"
        dosageForm="drops"
        initialPlan={staleCapsulePlan}
      />,
    )

    const suggestions = Array.from(container.querySelectorAll('datalist option'))
      .map(option => option.getAttribute('value'))
    expect(suggestions).toContain('ml')
    expect(suggestions).not.toContain('capsule')
  })

  it('adapts quantity labels and controls to liquids and injectables', () => {
    const { rerender } = render(<PlanHarness trackingLevel="with_amount" dosageForm="drops" />)

    expect(screen.getByLabelText('Flüssigkeitsmenge pro Einnahme')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tablette/ })).toBeNull()

    rerender(<PlanHarness trackingLevel="with_amount" dosageForm="vial" />)
    expect(screen.getByLabelText('Injektionsmenge pro Einnahme')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Tablette/ })).toBeNull()
  })

  it('zeigt je Form nur ihr eigenes Feld', () => {
    render(<PlanHarness trackingLevel="intake_only" dosageForm="capsule" />)

    fireEvent.click(screen.getByRole('button', { name: /Wochentage/ }))
    expect(screen.getByRole('button', { name: 'Mo' })).toBeTruthy()
    expect(screen.queryByLabelText('Abstand')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Im Abstand von/ }))
    expect(screen.getByLabelText('Abstand')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Mo' })).toBeNull()
    expect(screen.queryByLabelText('Tage an')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Im Wechsel/ }))
    expect(screen.getByLabelText('Tage an')).toBeTruthy()
    expect(screen.queryByLabelText('Abstand')).toBeNull()
  })

  it('renders recurrence validation errors beside the active control', () => {
    const common = {
      trackingLevel: 'complete' as const,
      dosageForm: 'capsule' as const,
      catalogEntry: vitaminD3,
      onChange: vi.fn(),
    }
    const { rerender } = render(
      <IntakePlanEditor
        {...common}
        plan={{ ...plan, rhythm: { ...emptyRhythm(), kind: 'interval', intervalValue: null } }}
        errors={{ xDaysInterval: 'invalid_interval' }}
      />,
    )

    expect(screen.getByRole('alert').textContent).toContain('Abstand')
    rerender(
      <IntakePlanEditor
        {...common}
        plan={{ ...plan, rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: [] } }}
        errors={{ scheduleDays: 'invalid_weekdays' }}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('Wochentag')
  })
})
