// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrackingLevel } from '../types'
import { TrackingLevelPicker } from './TrackingLevelPicker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const vorlage = options?.defaultValue
      if (typeof vorlage !== 'string') return key
      return vorlage.replace(/{{\s*(\w+)\s*}}/g, (_treffer, name: string) => (
        options?.[name] === undefined ? '' : String(options[name])
      ))
    },
  }),
}))

afterEach(cleanup)

describe('TrackingLevelPicker', () => {
  it('renders a required new-item choice with no radio silently preselected', () => {
    render(
      <TrackingLevelPicker
        value={null}
        substanceName="Vitamin D3"
        dosageForm="capsule"
        pkProfileAvailable={false}
        error
        onChange={() => undefined}
      />,
    )

    expect(screen.getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked))
      .toBe(true)
    expect(screen.getByRole('group').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toBe('Bitte wähle eine Tracking-Tiefe.')
  })

  it('zeigt vor der Wahl alle drei Eintraege zum Vergleich', () => {
    // Ein leerer Kasten mit „waehle etwas“ wuerde nichts erklaeren. Der
    // Unterschied zwischen den Stufen ist genau das, was ein Eintrag am Ende
    // enthaelt — also steht er da, dreimal nebeneinander.
    render(
      <TrackingLevelPicker
        value={null}
        substanceName="Vitamin D3"
        dosageForm="capsule"
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )

    const vorschau = document.querySelector('[data-tracking-preview]')!
    expect(vorschau.querySelectorAll('[data-tracking-entry]')).toHaveLength(3)
    // Die Steigerung ist im Eintrag sichtbar: nur der Name, dann die Menge in
    // Einnahmeeinheiten, dann die Wirkstaerke. Gemessen wird der INHALT, nicht
    // die Laenge — im Test steht statt „1 Kapsel" der Schluessel, und der ist
    // laenger als die Zeile, die er spaeter ersetzt.
    const text = (level: string) =>
      vorschau.querySelector(`[data-tracking-entry="${level}"]`)!.textContent!
    expect(text('intake_only')).toContain('Vitamin D3')
    expect(text('intake_only')).not.toContain('·')
    expect(text('with_amount')).toContain('my_stack_intake_unit_capsule')
    expect(text('with_amount')).not.toContain('mcg')
    expect(text('complete')).toContain('500 mcg')
  })

  it('zeigt nach der Wahl nur noch die gewaehlte Stufe, mit Bezeichnung und Satz', () => {
    render(
      <TrackingLevelPicker
        value="with_amount"
        substanceName="Vitamin D3"
        dosageForm="capsule"
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )

    const vorschau = document.querySelector('[data-tracking-preview]')!
    expect(vorschau.querySelectorAll('[data-tracking-entry]')).toHaveLength(1)
    expect(vorschau.querySelector('[data-tracking-entry="with_amount"]')).not.toBeNull()

    // Die Struktur steht fest, nicht der Wortlaut: die Bezeichnung zum
    // Adjektiv und der Satz, was die Stufe zusaetzlich erfasst.
    for (const zeile of ['subtitle', 'recorded']) {
      const feld = vorschau.querySelector(`[data-tracking-card="${zeile}"]`)
      expect(feld, zeile).not.toBeNull()
      expect(feld!.textContent?.trim(), zeile).not.toBe('')
    }
    // Der PK-Hinweis gehoert nur zur tiefsten Stufe.
    expect(vorschau.querySelector('[data-tracking-card="pk"]')).toBeNull()
  })

  it('haelt Versprechen und Aenderbarkeit aus den Stufen heraus', () => {
    // Beide Saetze gelten der Wahl, nicht einer Stufe. Dreimal derselbe Satz
    // verlaengert nur die Strecke bis zur Entscheidung.
    render(
      <TrackingLevelPicker
        value="intake_only"
        substanceName="Vitamin D3"
        dosageForm="capsule"
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )

    for (const radio of screen.getAllByRole('radio')) {
      const segment = radio.closest('label')!
      expect(within(segment).queryByText(/später jederzeit ändern/i)).toBeNull()
      expect(within(segment).queryByText(/fragt die App auch später nicht ab/i)).toBeNull()
    }

    expect(screen.getAllByText(/später jederzeit ändern/i)).toHaveLength(1)
    expect(screen.getAllByText(/fragt die App auch später nicht ab/i)).toHaveLength(1)
  })

  it('zaehlt den Beispieleintrag in der Einnahmeeinheit der Form', () => {
    // Hier stand fest „1 Kapsel" — auch bei einer Ampulle. Und danach „1
    // Ampulle", was die Packung beschrieb statt der Einnahme: aus einer
    // Ampulle wird mit der Spritze aufgezogen.
    const { rerender } = render(
      <TrackingLevelPicker
        value="with_amount"
        substanceName="Testosteron"
        dosageForm="ampoule"
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )

    const eintrag = (level: string) =>
      document.querySelector(`[data-tracking-entry="${level}"]`)!.textContent!

    // Der i18n-Ersatz liefert den Schluessel — dass genau DIESER ankommt, ist
    // der Punkt (so auch in DosageFormPicker.test).
    expect(eintrag('with_amount')).toContain('my_stack_intake_unit_syringe')
    expect(eintrag('with_amount')).not.toContain('dosage_form_ampoule')

    // Die tiefste Stufe zaehlt den WIRKSTOFF, nicht das Behaeltnis: „1
    // Spritze · 250 mg" nannte beides und liess offen, worauf sich die Menge
    // bezieht. Jetzt steht dort, worauf sie sich bezieht — die Einnahme.
    rerender(
      <TrackingLevelPicker
        value="complete"
        substanceName="Testosteron"
        dosageForm="ampoule"
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )
    expect(eintrag('complete')).toContain('pro Einnahme')
    expect(eintrag('complete')).toContain('250 mg')
    expect(eintrag('complete')).not.toContain('my_stack_intake_unit_syringe')

    // Und eine andere Form zaehlt in ihrer eigenen Einheit.
    rerender(
      <TrackingLevelPicker
        value="with_amount"
        substanceName="Vitamin D3"
        dosageForm="tablet"
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )
    expect(eintrag('with_amount')).toContain('my_stack_intake_unit_tablet')

    // Und ein Spray zaehlt in Spruehstoessen, nicht in Flaschen.
    rerender(
      <TrackingLevelPicker
        value="with_amount"
        substanceName="Melatonin"
        dosageForm="nasal_spray"
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )
    expect(eintrag('with_amount')).toContain('my_stack_intake_unit_spray')
    expect(eintrag('with_amount')).not.toContain('dosage_form_nasal_spray')
  })

  it('laesst das Detail weg, solange keine Form gewaehlt ist', () => {
    // „1 " allein waere eine halbe Aussage.
    render(
      <TrackingLevelPicker
        value="with_amount"
        substanceName="Testosteron"
        dosageForm={null}
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )

    const eintrag = document.querySelector('[data-tracking-entry="with_amount"]')!
    expect(eintrag.textContent).toContain('Testosteron')
    expect(eintrag.textContent).not.toContain('1 ')
  })

  it('zeigt bei der tiefsten Stufe, was sie einbringt: eine Beispielkurve', () => {
    // „Blutspiegel-Kurve" stand bisher nur als Wort da. Was die Stufe
    // einbringt, ist jetzt zu sehen — als Beispiel ausgewiesen, ohne Zahlen,
    // damit es keine Vorhersage behauptet.
    const { rerender } = render(
      <TrackingLevelPicker
        value="complete"
        substanceName="Vitamin D3"
        dosageForm="capsule"
        pkProfileAvailable
        onChange={() => undefined}
      />,
    )

    const kurve = document.querySelector('[data-tracking-curve]')!
    expect(kurve).not.toBeNull()
    expect(kurve.querySelector('svg')).not.toBeNull()
    expect(kurve.textContent).toContain('Beispiel')
    // Live-Spiegel und PK-Profil werden beide beim Namen genannt.
    expect(kurve.textContent).toContain('Live-Spiegel')
    expect(kurve.textContent).toContain('PK-Profil')

    // Nur dort: die flacheren Stufen rechnen keinen Verlauf.
    for (const flacher of ['intake_only', 'with_amount'] as const) {
      rerender(
        <TrackingLevelPicker
          value={flacher}
          substanceName="Vitamin D3"
          dosageForm="capsule"
          pkProfileAvailable
          onChange={() => undefined}
        />,
      )
      expect(document.querySelector('[data-tracking-curve]'), flacher).toBeNull()
    }
  })

  it('reports PK availability from the selected catalog entry without promising a curve', () => {
    const { rerender } = render(
      <TrackingLevelPicker
        value="complete"
        substanceName="Vitamin D3"
        dosageForm="capsule"
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )

    expect(screen.getByText(/Für Vitamin D3 ist derzeit kein PK-Profil verknüpft/)).toBeTruthy()
    expect(screen.queryByText(/garantiert.*Kurve/i)).toBeNull()

    rerender(
      <TrackingLevelPicker
        value="complete"
        substanceName="Vitamin D3"
        dosageForm="capsule"
        pkProfileAvailable
        onChange={() => undefined}
      />,
    )

    expect(screen.getByText(/Für Vitamin D3 ist ein PK-Profil verfügbar/)).toBeTruthy()
    expect(screen.getByText(/Eine Kurve erscheint nur bei vollständigen Pflichtangaben/)).toBeTruthy()
  })

  it('changes selection through the radio control', () => {
    let selected: TrackingLevel = 'intake_only'
    const { rerender } = render(
      <TrackingLevelPicker
        value={selected}
        substanceName="Vitamin D3"
        dosageForm="capsule"
        pkProfileAvailable={false}
        onChange={value => { selected = value }}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: /^Genau/ }))
    rerender(
      <TrackingLevelPicker
        value={selected}
        substanceName="Vitamin D3"
        dosageForm="capsule"
        pkProfileAvailable={false}
        onChange={value => { selected = value }}
      />,
    )

    expect((screen.getByRole('radio', { name: /^Genau/ }) as HTMLInputElement).checked).toBe(true)
  })
})
