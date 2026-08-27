// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOSAGE_FORMS } from '../lib/dosageForms'
import { DosageFormPicker } from './DosageFormPicker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string; substanceName?: string }) => (
      (options?.defaultValue ?? key).replace('{{substanceName}}', options?.substanceName ?? '')
    ),
  }),
}))

afterEach(cleanup)

describe('DosageFormPicker', () => {
  function renderedIcon(labelKey: string) {
    render(
      <DosageFormPicker
        value={null}
        substanceName="Testsubstanz"
        suggestedForms={DOSAGE_FORMS.map(form => form.key)}
        onSelect={() => undefined}
      />,
    )
    return screen.getByRole('button', { name: labelKey }).querySelector('svg')!
  }

  it('renders one visually unique, form-specific symbol for every dosage form', () => {
    render(
      <DosageFormPicker
        value={null}
        substanceName="Testsubstanz"
        suggestedForms={DOSAGE_FORMS.map(form => form.key)}
        onSelect={() => undefined}
      />,
    )

    const renderedShapes = DOSAGE_FORMS.map(form => {
      const button = screen.getByRole('button', { name: form.labelKey })
      const icon = button.querySelector('svg')

      expect(icon).not.toBeNull()
      return icon!.innerHTML
    })

    expect(new Set(renderedShapes).size).toBe(DOSAGE_FORMS.length)
  })

  it('renders the selected oblong scored tablet silhouette', () => {
    const icon = renderedIcon('dosage_form_tablet')

    expect(icon.querySelector('rect[rx="5"]')).not.toBeNull()
    expect(icon.querySelector('circle')).toBeNull()
  })

  it('renders the selected three-droplet silhouette', () => {
    const paths = Array.from(renderedIcon('dosage_form_drops').querySelectorAll('path'))

    expect(paths).toHaveLength(3)
    expect(paths.every(path => path.getAttribute('d')?.endsWith('Z'))).toBe(true)
  })

  it('renders the selected patch with a separate active surface', () => {
    const icon = renderedIcon('dosage_form_patch')

    expect(icon.querySelectorAll('rect')).toHaveLength(2)
    expect(icon.querySelector('circle')).toBeNull()
  })

  it('shows catalog suggestions first in catalog order and hides remaining forms initially', () => {
    render(
      <DosageFormPicker
        value={null}
        substanceName="Testosteron"
        suggestedForms={['ampoule', 'vial', 'gel']}
        onSelect={() => undefined}
      />,
    )

    const recommended = screen.getByRole('group', { name: 'Empfohlen für Testosteron' })
    expect(within(recommended).getAllByRole('button').map(button => button.textContent)).toEqual([
      'dosage_form_ampoule',
      'dosage_form_vial',
      'dosage_form_gel',
    ])
    expect(screen.queryByRole('button', { name: 'dosage_form_tablet' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Weitere Darreichungsformen anzeigen' }).getAttribute('aria-expanded')).toBe('false')
  })

  it('reveals every remaining form without duplicating recommendations', () => {
    render(
      <DosageFormPicker
        value={null}
        substanceName="Testosteron"
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

  it('uses the neutral common forms when the catalog has no suggestions', () => {
    render(
      <DosageFormPicker
        value={null}
        substanceName="Eigene Substanz"
        suggestedForms={[]}
        onSelect={() => undefined}
      />,
    )

    const common = screen.getByRole('group', { name: 'Häufige Darreichungsformen' })
    expect(within(common).getAllByRole('button').map(button => button.textContent)).toEqual([
      'dosage_form_tablet',
      'dosage_form_capsule',
      'dosage_form_vial',
      'dosage_form_drops',
      'dosage_form_liquid',
      'dosage_form_powder',
    ])
  })

  it('keeps a selected non-recommended form visible while editing', () => {
    render(
      <DosageFormPicker
        value="patch"
        substanceName="Testosteron"
        suggestedForms={['ampoule', 'vial', 'gel']}
        onSelect={() => undefined}
      />,
    )

    const current = screen.getByRole('group', { name: 'Aktuell ausgewählt' })
    expect(within(current).getByRole('button', { name: 'dosage_form_patch' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'dosage_form_patch' })).toHaveLength(1)
  })
})
