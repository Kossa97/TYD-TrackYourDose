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
  it('haelt den Lichtteich am Boden klein und tut ihn nicht als Fleck hin', () => {
    // Der Teich war fest 48 x 15 gross und mit 0,58 Weiss die hellste Flaeche
    // im Bild. In einer flachen, breiten Kammer — dem Nasenspray — war das
    // kein Lichtreflex mehr, sondern ein weisser Fleck ueber dem halben Boden.
    const html = renderToStaticMarkup(createElement(LiquidGraphic, base))
    const verlauf = html.slice(html.indexOf('id="probe-caustic"'))
    const block = verlauf.slice(0, verlauf.indexOf('</radialGradient>'))

    expect(block).toContain('rgba(255,255,255,0.32)')
    expect(block).not.toContain('rgba(255,255,255,0.58)')
    // Ein weicher Rand, der frueher anfaengt: ohne Zwischenstufe war der Teich
    // bis weit nach aussen hell.
    expect(block).toContain('offset="55%"')
  })

  it('bemisst den Lichtteich an der Fuellung, nicht an der Kammer', () => {
    // Steht wenig drin, liegt der Boden nah unter der Oberflaeche und das
    // Licht sammelt sich auf kleinerer Flaeche. Eine feste Groesse deckte in
    // einer flachen Kammer den ganzen Boden zu.
    const radius = (html: string) => {
      const treffer = /<ellipse cx="60" cy="187" rx="([\d.]+)" ry="([\d.]+)"/.exec(html)
      return treffer ? [Number(treffer[1]), Number(treffer[2])] : null
    }
    const voll = radius(renderToStaticMarkup(createElement(LiquidGraphic, { ...base, fill: 1 })))
    const wenig = radius(renderToStaticMarkup(createElement(LiquidGraphic, { ...base, fill: 0.1 })))

    expect(voll, 'voll').not.toBeNull()
    expect(wenig, 'wenig').not.toBeNull()
    expect(voll![0]).toBeGreaterThan(wenig![0])
    expect(voll![1]).toBeGreaterThan(wenig![1])
    // Und nie so breit, dass er den Boden zudeckt (Kammer ist 120 breit).
    expect(voll![0] * 2).toBeLessThan(120 * 0.75)
  })

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
