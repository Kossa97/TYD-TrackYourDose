// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DOSAGE_FORMS } from '../lib/dosageForms'
import type { DosageFormKey } from '../types'
import { DosageFormIcon } from './DosageFormIcon'

afterEach(cleanup)

// Diese Prüfungen standen bis zum Umbau der Auswahlkacheln in
// DosageFormPicker.test.tsx. Dort zeigen die Kacheln jetzt die echten
// Bühnenformen; das Symbol ist nur noch der Rückfall für `liquid` und `other`.
// Die Aussagen über die Symbole selbst gelten weiter — sie gehören nur an
// diese Datei, zur Komponente, die sie zeichnet.

function icon(form: DosageFormKey) {
  const { container } = render(<DosageFormIcon form={form} />)
  return container.querySelector('svg')!
}

describe('DosageFormIcon', () => {
  it('zeichnet für jede Darreichungsform ein eigenes Symbol', () => {
    const formen = DOSAGE_FORMS.map(form => icon(form.key).innerHTML)

    expect(formen).toHaveLength(DOSAGE_FORMS.length)
    expect(new Set(formen).size).toBe(DOSAGE_FORMS.length)
  })

  it('zeichnet die Tablette als längliche Form mit Bruchrille', () => {
    const svg = icon('tablet')

    expect(svg.querySelector('rect[rx="5"]')).not.toBeNull()
    expect(svg.querySelector('circle')).toBeNull()
  })

  it('zeichnet die Tropfen als drei geschlossene Tropfen', () => {
    const paths = Array.from(icon('drops').querySelectorAll('path'))

    expect(paths).toHaveLength(3)
    expect(paths.every(path => path.getAttribute('d')?.endsWith('Z'))).toBe(true)
  })

  it('zeichnet das Pflaster mit eigener Wirkfläche', () => {
    const svg = icon('patch')

    expect(svg.querySelectorAll('rect')).toHaveLength(2)
    expect(svg.querySelector('circle')).toBeNull()
  })
})
