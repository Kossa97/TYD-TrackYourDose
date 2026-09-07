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

  test('haengt eine gespeicherte Farbe an, die nicht mehr in der Palette steht', () => {
    // Sonst saehe ein alter Eintrag nach einem Palettenwechsel aus, als haette
    // er nie eine Farbe gehabt.
    const alt = '#a855f7'
    expect(STACK_ITEM_COLORS).not.toContain(alt)

    const html = renderToStaticMarkup(createElement(PeptideColorPalette, {
      value: alt,
      onChange: () => undefined,
    }))

    expect(html.match(/data-color-swatch=/g)?.length).toBe(STACK_ITEM_COLORS.length + 1)
    expect(html).toContain(`data-color-swatch="${alt}"`)
  })

  test('haengt nichts an, wenn die Farbe in der Palette steht', () => {
    const html = renderToStaticMarkup(createElement(PeptideColorPalette, {
      value: STACK_ITEM_COLORS[2],
      onChange: () => undefined,
    }))

    expect(html.match(/data-color-swatch=/g)?.length).toBe(STACK_ITEM_COLORS.length)
  })

  test('zeichnet jedes Feld als Perle, nicht als Flaeche', () => {
    // Die Objekte im Formular tragen Material und Licht; zwoelf flache Kreise
    // daneben saehen aus wie aus einem anderen Programm.
    const html = renderToStaticMarkup(createElement(PeptideColorPalette, {
      value: STACK_ITEM_COLORS[0],
      onChange: () => undefined,
    }))

    expect(html.match(/radial-gradient\(circle at 32% 26%/g)?.length).toBe(STACK_ITEM_COLORS.length)
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
