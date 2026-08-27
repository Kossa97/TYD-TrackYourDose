// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOSAGE_FORMS } from '../lib/dosageForms'
import { DosageFormPicker } from './DosageFormPicker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

afterEach(cleanup)

describe('DosageFormPicker', () => {
  function renderedIcon(labelKey: string) {
    render(<DosageFormPicker value={null} onSelect={() => undefined} />)
    return screen.getByRole('button', { name: labelKey }).querySelector('svg')!
  }

  it('renders one visually unique, form-specific symbol for every dosage form', () => {
    render(<DosageFormPicker value={null} onSelect={() => undefined} />)

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
})
