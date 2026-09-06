// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOSAGE_FORMS, isStageRenderable } from '../lib/dosageForms'
import { DosageFormPicker } from './DosageFormPicker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

afterEach(cleanup)

function renderAll(props: Partial<Parameters<typeof DosageFormPicker>[0]> = {}) {
  return render(
    <DosageFormPicker
      value={null}
      suggestedForms={DOSAGE_FORMS.map(form => form.key)}
      onSelect={() => undefined}
      {...props}
    />,
  )
}

const kachel = (labelKey: string) => screen.getByRole('button', { name: labelKey })

describe('DosageFormPicker', () => {
  it('zeigt auf jeder Kachel das Objekt, das man bekommt', () => {
    renderAll()

    for (const form of DOSAGE_FORMS.filter(f => isStageRenderable(f.key))) {
      const vorschau = kachel(form.labelKey).querySelector('[data-dosage-form-preview]')
      expect(vorschau, form.key).not.toBeNull()
      expect(vorschau!.getAttribute('data-dosage-form-preview')).toBe(form.key)
    }
  })

  it('faellt fuer Formen ohne Buehnengrafik auf das Symbol zurueck', () => {
    // `liquid` und `other` bekommen keine erfundene Grafik. Die Regel „Formen
    // ohne Buehnengrafik bleiben textlich" wird auch hier nicht aufgeweicht.
    renderAll()

    for (const key of ['liquid', 'other'] as const) {
      const form = DOSAGE_FORMS.find(f => f.key === key)!
      expect(isStageRenderable(key)).toBe(false)
      expect(kachel(form.labelKey).querySelector('[data-dosage-form-preview]')).toBeNull()
      expect(kachel(form.labelKey).querySelector('svg')).not.toBeNull()
    }
  })

  it('haelt die Aufschrift vom Objekt fern', () => {
    // Die Kachel beschriftet sich selbst. Eine zweite Aufschrift auf dem Glas
    // waere in Miniaturgroesse ein Fleck — und stuende im zugaenglichen Namen
    // des Knopfes.
    renderAll()

    const dose = kachel('dosage_form_powder')
    expect(dose.querySelector('.vial-label-marquee')).toBeNull()
    expect(dose.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('reicht die Eintragsfarbe an die Objekte durch', () => {
    renderAll({ colorHex: '#f97316' })

    const deckel = kachel('dosage_form_powder').querySelector('[data-powder-detail="lid"]')
    expect(deckel?.getAttribute('fill')).toBe('#f97316')
  })

  it('laesst halb getippte Farben stehen, statt durch Schwarz zu flackern', () => {
    // Im Farbfeld steht waehrend des Tippens jeder Zwischenstand.
    renderAll({ colorHex: '#f9' })

    const deckel = kachel('dosage_form_powder').querySelector('[data-powder-detail="lid"]')
    expect(deckel?.getAttribute('fill')).not.toBe('#f9')
  })

  it('zeigt zuerst nur die substanzspezifischen Formen', () => {
    render(
      <DosageFormPicker
        value={null}
        suggestedForms={['ampoule', 'vial', 'gel']}
        onSelect={() => undefined}
      />,
    )

    const common = screen.getByRole('group', { name: 'Häufige Darreichungsformen' })
    expect(within(common).getAllByRole('button').map(button => button.getAttribute('aria-pressed') === null ? null : button.textContent?.trim()))
      .toHaveLength(3)
    for (const key of ['dosage_form_ampoule', 'dosage_form_vial', 'dosage_form_gel']) {
      expect(within(common).getByRole('button', { name: key })).toBeTruthy()
    }
    expect(screen.queryByRole('button', { name: 'dosage_form_tablet' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Weitere Darreichungsformen anzeigen' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('klappt die restlichen Formen auf, ohne die haeufigen zu doppeln', () => {
    render(
      <DosageFormPicker
        value={null}
        suggestedForms={['ampoule', 'vial', 'gel']}
        onSelect={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Weitere Darreichungsformen anzeigen' }))

    expect(screen.getByRole('button', { name: 'Weitere Darreichungsformen ausblenden' }).getAttribute('aria-expanded')).toBe('true')
    for (const form of DOSAGE_FORMS) {
      expect(screen.getAllByRole('button', { name: form.labelKey })).toHaveLength(1)
    }
  })

  it('nimmt die neutralen haeufigen Formen, wenn der Katalog nichts vorschlaegt', () => {
    render(
      <DosageFormPicker
        value={null}
        suggestedForms={[]}
        onSelect={() => undefined}
      />,
    )

    const common = screen.getByRole('group', { name: 'Häufige Darreichungsformen' })
    const knoepfe = within(common).getAllByRole('button')
    expect(knoepfe).toHaveLength(6)
    for (const key of ['dosage_form_tablet', 'dosage_form_capsule', 'dosage_form_vial',
      'dosage_form_drops', 'dosage_form_liquid', 'dosage_form_powder']) {
      expect(within(common).getByRole('button', { name: key })).toBeTruthy()
    }
  })

  it('haelt eine gewaehlte Form ausserhalb der haeufigen sichtbar', () => {
    render(
      <DosageFormPicker
        value="patch"
        suggestedForms={['ampoule', 'vial', 'gel']}
        onSelect={() => undefined}
      />,
    )

    const current = screen.getByRole('group', { name: 'Aktuell ausgewählt' })
    expect(within(current).getByRole('button', { name: 'dosage_form_patch' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'dosage_form_patch' })).toHaveLength(1)
  })
})
