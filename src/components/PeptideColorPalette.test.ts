import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { STACK_ITEM_COLORS } from '../features/my-stack/lib/colors'
import { PeptideColorPalette } from './PeptideColorPalette'

describe('PeptideColorPalette', () => {
  test('renders every curated color as a selectable swatch', () => {
    const html = renderToStaticMarkup(createElement(PeptideColorPalette, {
      value: STACK_ITEM_COLORS[0],
      onChange: () => undefined,
    }))

    expect(html.match(/data-color-swatch=/g)?.length).toBe(STACK_ITEM_COLORS.length)
  })

  test('marks the currently selected color', () => {
    const selected = STACK_ITEM_COLORS[3]
    const html = renderToStaticMarkup(createElement(PeptideColorPalette, {
      value: selected,
      onChange: () => undefined,
    }))

    expect(html).toContain(`aria-label="Farbe ${selected} ausgewählt"`)
  })
})
