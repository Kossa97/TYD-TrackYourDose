import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LiquidGraphic } from './LiquidGraphic'

const base = {
  uid: 'probe',
  fill: 0.94,
  chamberAspect: 0.483,
  x: 29.4,
  y: 146.6,
  width: 61.2,
  height: 126.8,
  color: '#e0a23f',
}

describe('LiquidGraphic', () => {
  it('draws body, glow, surface and rim as one coherent graphic', () => {
    const html = renderToStaticMarkup(createElement(LiquidGraphic, base))

    expect(html).toContain('data-vial-detail="liquid-body"')
    expect(html).toContain('data-vial-detail="liquid-glow"')
    expect(html).toContain('data-vial-detail="liquid-surface"')
    expect(html).toContain('data-vial-detail="liquid-rim"')
  })

  it('places the chamber where the form asked for it', () => {
    const html = renderToStaticMarkup(createElement(LiquidGraphic, base))

    expect(html).toContain('x="29.4"')
    expect(html).toContain('y="146.6"')
    expect(html).toContain('width="61.2"')
    expect(html).toContain('height="126.8"')
  })

  it('still fits the vial chamber it was extracted from', () => {
    const html = renderToStaticMarkup(createElement(LiquidGraphic, {
      ...base, chamberAspect: undefined, x: 4, y: 36, width: 112, height: 247,
    }))

    expect(html).toContain('x="4"')
    expect(html).toContain('y="36"')
    expect(html).toContain('height="247"')
  })

  it('omits bubbles when the form switches them off', () => {
    const on = renderToStaticMarkup(createElement(LiquidGraphic, base))
    const off = renderToStaticMarkup(createElement(LiquidGraphic, { ...base, bubbles: false }))

    expect(on).toContain('data-vial-detail="liquid-bubble"')
    expect(off).not.toContain('data-vial-detail="liquid-bubble"')
  })

  it('holds the bubbles still under reduced motion', () => {
    const html = renderToStaticMarkup(createElement(LiquidGraphic, { ...base, reducedMotion: true }))

    expect(html).not.toContain('data-vial-detail="liquid-bubble"')
  })

  it('carries the colour through so each item keeps its own liquid', () => {
    const html = renderToStaticMarkup(createElement(LiquidGraphic, {
      ...base, motionStyle: { color: '#e0a23f' },
    }))

    expect(html).toContain('#e0a23f')
    expect(html).toContain('currentColor')
  })

  it('damps a narrow chamber more than a wide one', () => {
    const wide = renderToStaticMarkup(createElement(LiquidGraphic, { ...base, chamberAspect: 0.794, tilt: 1 }))
    const narrow = renderToStaticMarkup(createElement(LiquidGraphic, { ...base, chamberAspect: 0.483, tilt: 1 }))

    expect(wide).not.toBe(narrow)
  })
})
