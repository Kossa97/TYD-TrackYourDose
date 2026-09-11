// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TrackingLevel } from '../types'
import { TrackingLevelPicker } from './TrackingLevelPicker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; substanceName?: string }) => (
      options?.defaultValue?.replace('{{substanceName}}', options.substanceName ?? '') ?? key
    ),
  }),
}))

afterEach(cleanup)

describe('TrackingLevelPicker', () => {
  it('renders a required new-item choice with no radio silently preselected', () => {
    render(
      <TrackingLevelPicker
        value={null}
        substanceName="Vitamin D3"
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
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )

    const vorschau = document.querySelector('[data-tracking-preview]')!
    expect(vorschau.querySelectorAll('[data-tracking-entry]')).toHaveLength(3)
    // Die Steigerung ist im Eintrag sichtbar: nur der Name, dann die Menge,
    // dann die Wirkstaerke.
    const text = (level: string) =>
      vorschau.querySelector(`[data-tracking-entry="${level}"]`)!.textContent!
    expect(text('intake_only')).toContain('Vitamin D3')
    expect(text('intake_only').length).toBeLessThan(text('with_amount').length)
    expect(text('with_amount').length).toBeLessThan(text('complete').length)
  })

  it('zeigt nach der Wahl nur noch die gewaehlte Stufe, mit Bezeichnung und Satz', () => {
    render(
      <TrackingLevelPicker
        value="with_amount"
        substanceName="Vitamin D3"
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

  it('zeigt bei der tiefsten Stufe, was sie einbringt: eine Beispielkurve', () => {
    // „Blutspiegel-Kurve" stand bisher nur als Wort da. Was die Stufe
    // einbringt, ist jetzt zu sehen — als Beispiel ausgewiesen, ohne Zahlen,
    // damit es keine Vorhersage behauptet.
    const { rerender } = render(
      <TrackingLevelPicker
        value="complete"
        substanceName="Vitamin D3"
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
        pkProfileAvailable={false}
        onChange={value => { selected = value }}
      />,
    )

    fireEvent.click(screen.getByRole('radio', { name: /^Genau/ }))
    rerender(
      <TrackingLevelPicker
        value={selected}
        substanceName="Vitamin D3"
        pkProfileAvailable={false}
        onChange={value => { selected = value }}
      />,
    )

    expect((screen.getByRole('radio', { name: /^Genau/ }) as HTMLInputElement).checked).toBe(true)
  })
})
