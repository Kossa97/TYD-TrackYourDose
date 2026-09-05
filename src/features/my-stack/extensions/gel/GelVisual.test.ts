import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GelVisual } from './GelVisual'

const render = (props: Partial<Parameters<typeof GelVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(GelVisual, { name: 'Testogel', color: '#a3e635', ...props }))

const source = () => readFileSync(new URL('./GelVisual.tsx', import.meta.url), 'utf8')

describe('GelVisual', () => {
  it('meldet sich als Gel-Renderer', () => {
    expect(render()).toContain('data-gel-detail="root"')
  })

  it('zeichnet Glas, Masse, Oberflaeche, Deckel und Etikett', () => {
    const html = render()
    expect(html).toContain('data-gel-detail="glass"')
    expect(html).toContain('data-gel-detail="gel"')
    expect(html).toContain('data-gel-detail="gel-surface"')
    expect(html).toContain('data-gel-detail="gel-dome"')
    expect(html).toContain('data-gel-detail="lid"')
    expect(html).toContain('data-gel-detail="crown-chamfer"')
    expect(html).toContain('data-gel-detail="label"')
  })

  it('faerbt Deckel und Masse, nicht das Glas', () => {
    const html = render({ color: '#f97316' })
    expect(html).toMatch(/data-gel-detail="lid"[^>]*fill="#f97316"/)
    expect(html).toMatch(/data-gel-detail="gel-surface"[^>]*fill="#f97316"/)
    expect(html).not.toMatch(/data-gel-detail="glass"[^>]*fill="#f97316"/)
  })

  it('benutzt keine Fluessigkeitsphysik', () => {
    // Der inhaltliche Kern der Form: Gel nivelliert sich nicht, schwappt nicht
    // und hat keinen aussagekraeftigen Pegel. Nichts aus dem
    // Fluessigkeitsstapel darf hier auftauchen.
    const src = source()
    expect(src).not.toContain('LiquidGraphic')
    expect(src).not.toContain('SloshProvider')
    expect(src).not.toContain('sloshEngine')
    expect(src).not.toContain('fillPct')
    expect(src).not.toContain('<StageLabel')
  })

  it('zeichnet beide Konturen vor dem Deckel', () => {
    // Beide Pfade schliessen oben waagerecht. Als letztes gezeichnet legte
    // dieser Ringschluss einen geraden Strich quer ueber den Deckel — genau
    // der Fehler, der bei der Pulverdose auftrat.
    const src = source()
    expect(src.indexOf('data-gel-detail="outline"')).toBeLessThan(src.indexOf('data-gel-detail="lid"'))
    expect(src.indexOf('data-gel-detail="inner-contour"')).toBeLessThan(src.indexOf('data-gel-detail="lid"'))
  })

  it('beschneidet jedes wandernde Licht auf sein Teil', () => {
    // Derselbe Fehler wie beim Tabletten-Glanz: unbeschnitten malt es daneben.
    const src = source()
    expect(src.indexOf('bodyClip)`}>')).toBeLessThan(src.indexOf('data-gel-detail="bloom"'))
    expect(src.indexOf('bodyClip)`}>')).toBeLessThan(src.indexOf('data-gel-detail="sheen"'))
    expect(src.indexOf('gelClip)`}>')).toBeLessThan(src.indexOf('data-gel-detail="gel-gloss"'))
    expect(render({ lightOffset: 1 })).toMatch(/data-gel-detail="sheen"[^>]*translate\(20/)
    expect(render({ lightOffset: -1 })).toMatch(/data-gel-detail="sheen"[^>]*translate\(-20/)
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    // Die Sprosse unter der Pulverdose: 90,9 -> 115,5. Schritt x1,2706.
    expect(render({ size: 'large' })).toContain('h-[226.1px]')
    expect(render({ size: 'carousel' })).toContain('h-[90.9px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[115.5px]')
    expect(render({ size: 'compact' })).toContain('h-[68.2px]')
    expect(render({ size: 'mini' })).toContain('h-[37.1px]')
  })

  it('setzt den Namen auf das Etikett, mit Durchlauf wie bei der Tube', () => {
    const html = render({ name: 'Hydrocortison Acetat Creme 1 Prozent' })
    expect(html).toContain('data-gel-detail="name"')
    expect(html).toContain('vial-label-marquee')
    expect(html).toContain('Hydrocortison Acetat Creme 1 Prozent')
  })
})
