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

  it('legt die empfohlenen in die erste Reihe und alle uebrigen darunter', () => {
    render(
      <DosageFormPicker
        value={null}
        suggestedForms={['ampoule', 'vial', 'gel']}
        onSelect={() => undefined}
      />,
    )

    const empfohlen = screen.getByRole('group', { name: 'Häufige Darreichungsformen' })
    expect(within(empfohlen).getAllByRole('button')).toHaveLength(3)
    for (const key of ['dosage_form_ampoule', 'dosage_form_vial', 'dosage_form_gel']) {
      expect(within(empfohlen).getByRole('button', { name: key })).toBeTruthy()
    }

    // Beide Reihen stehen immer da: eine Reihe zum Wischen muss nichts
    // verstecken, was man wegwischen kann.
    const uebrige = screen.getByRole('group', { name: 'Weitere Darreichungsformen' })
    expect(within(uebrige).getAllByRole('button')).toHaveLength(DOSAGE_FORMS.length - 3)
    expect(screen.queryByRole('button', { name: /anzeigen/ })).toBeNull()

    // Und jede Form steht genau einmal da.
    for (const form of DOSAGE_FORMS) {
      expect(screen.getAllByRole('button', { name: form.labelKey }), form.key).toHaveLength(1)
    }
  })

  it('nennt die gewaehlte Form im Klartext, sonst steht kein Wort im Bild', () => {
    // Vierzehn Aufschriften unter vierzehn Objekten waren zu viel; keine
    // einzige waere ein Raetsel. Also genau eine: die gewaehlte.
    const { rerender } = render(
      <DosageFormPicker value={null} suggestedForms={[]} onSelect={() => undefined} />,
    )
    expect(document.querySelector('[data-dosage-form-selected]')?.textContent).toBe('')

    rerender(
      <DosageFormPicker value="powder" suggestedForms={[]} onSelect={() => undefined} />,
    )
    expect(document.querySelector('[data-dosage-form-selected]')?.textContent).toBe('dosage_form_powder')
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

  it('holt die gewaehlte Form in ihrer Reihe ins Bild', () => {
    // Beim Bearbeiten eines bestehenden Eintrags kann sie weit rechts liegen.
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    render(
      <DosageFormPicker value="patch" suggestedForms={['ampoule', 'vial', 'gel']} onSelect={() => undefined} />,
    )

    expect(screen.getByRole('button', { name: 'dosage_form_patch' }).getAttribute('aria-pressed')).toBe('true')
    expect(scrollIntoView).toHaveBeenCalled()
  })
})
