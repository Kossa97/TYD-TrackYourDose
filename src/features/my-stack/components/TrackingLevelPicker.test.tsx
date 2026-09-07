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
      expect(within(card).getByText(/^Erfasst:/)).toBeTruthy()
      expect(within(card).getByText(/^Nicht erforderlich:/)).toBeTruthy()
      expect(within(card).getByText(/^Beispiel:/)).toBeTruthy()
      expect(within(card).getByText(/^Als Nächstes:/)).toBeTruthy()
      // Der Hinweis auf die spaetere Aenderbarkeit steht NICHT in jeder Karte:
      // er gilt der Wahl, nicht einer Stufe. Dreimal derselbe Satz verlaengert
      // nur die Strecke bis zur Entscheidung.
      expect(within(card).queryByText(/später jederzeit ändern/i)).toBeNull()
    }

    // Einmal, unter der Gruppe.
    expect(screen.getAllByText(/später jederzeit ändern/i)).toHaveLength(1)
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

    expect(screen.getByText(/Für Vitamin D3 ist derzeit kein PK-Profil hinterlegt/)).toBeTruthy()
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
    expect(screen.getByText(/Eine Kurve erscheint nur, wenn die nötigen Angaben vorliegen/)).toBeTruthy()
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

    fireEvent.click(screen.getByRole('radio', { name: /^Mit Menge/ }))
    rerender(
      <TrackingLevelPicker
        value={selected}
        substanceName="Vitamin D3"
        pkProfileAvailable={false}
        onChange={value => { selected = value }}
      />,
    )

    expect((screen.getByRole('radio', { name: /^Mit Menge/ }) as HTMLInputElement).checked).toBe(true)
  })
})
