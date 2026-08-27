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
})
