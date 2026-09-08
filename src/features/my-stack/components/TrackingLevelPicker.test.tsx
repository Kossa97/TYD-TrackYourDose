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

  it('explains the full consequence and next step on every semantic radio card', () => {
    render(
      <TrackingLevelPicker
        value="intake_only"
        substanceName="Vitamin D3"
        pkProfileAvailable={false}
        onChange={() => undefined}
      />,
    )

    const cards = screen.getAllByRole('radio')
    expect(cards).toHaveLength(3)
    expect((cards[0] as HTMLInputElement).checked).toBe(true)

    for (const radio of cards) {
      const card = radio.closest('label')!
      // Die Struktur steht hier fest, nicht der Wortlaut: was erfasst wird,
      // was nicht noetig ist, ein Beispiel und der naechste Schritt. Der
      // Wortlaut gehoert in die Sprachdateien und darf sich aendern, ohne
      // dass dieser Test bricht.
      for (const zeile of ['title', 'subtitle', 'recorded', 'example']) {
        const feld = card.querySelector(`[data-tracking-card="${zeile}"]`)
        expect(feld, zeile).not.toBeNull()
        expect(feld!.textContent?.trim(), zeile).not.toBe('')
      }
      // Weder das Versprechen noch der Hinweis auf die spaetere Aenderbarkeit
      // steht in einer Karte: beide gelten der Wahl, nicht einer Stufe.
      expect(within(card).queryByText(/später jederzeit ändern/i)).toBeNull()
      expect(within(card).queryByText(/fragt die App auch später nicht ab/i)).toBeNull()
    }

    // Einmal, unter der Gruppe.
    expect(screen.getAllByText(/später jederzeit ändern/i)).toHaveLength(1)
    expect(screen.getAllByText(/fragt die App auch später nicht ab/i)).toHaveLength(1)
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
