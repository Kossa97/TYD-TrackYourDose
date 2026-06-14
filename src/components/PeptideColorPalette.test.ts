import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { PEPTIDE_COLORS } from '../lib/peptideColors'
import { PeptideColorPalette } from './PeptideColorPalette'

describe('PeptideColorPalette', () => {
  test('renders every curated color as a selectable swatch', () => {
    const html = renderToStaticMarkup(createElement(PeptideColorPalette, {
      value: PEPTIDE_COLORS[0],
      onChange: () => undefined,
    }))

    expect(html.match(/data-color-swatch=/g)?.length).toBe(PEPTIDE_COLORS.length)
  })

  test('marks the currently selected color', () => {
    const selected = PEPTIDE_COLORS[3]
    const html = renderToStaticMarkup(createElement(PeptideColorPalette, {
      value: selected,
      onChange: () => undefined,
    }))

    expect(html).toContain(`aria-label="Farbe ${selected} ausgewählt"`)
  })
})
