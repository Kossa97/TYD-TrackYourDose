import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SprayVisual } from './SprayVisual'

const render = (props: Partial<Parameters<typeof SprayVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(SprayVisual, { name: 'Testspray', color: '#a3e635', ...props }))

const source = () => readFileSync(new URL('./SprayVisual.tsx', import.meta.url), 'utf8')

describe('SprayVisual', () => {
  it('meldet sich als Spray-Renderer', () => {
    expect(render()).toContain('data-spray-detail="root"')
  })

  it('zeichnet Glas, Fluessigkeit, Steigrohr, Kopf und Etikett', () => {
    const html = render()
    expect(html).toContain('data-spray-detail="glass"')
    expect(html).toContain('data-spray-detail="outer-contour"')
    expect(html).toContain('data-spray-detail="inner-contour"')
    expect(html).toContain('data-spray-detail="liquid-window"')
    expect(html).toContain('data-spray-detail="dip-tube"')
    expect(html).toContain('data-spray-detail="actuator"')
    expect(html).toContain('data-spray-detail="nozzle"')
    expect(html).toContain('data-spray-detail="nozzle-mouth"')
    expect(html).toContain('data-spray-detail="collar"')
    // Dasselbe Band wie bei den anderen Glasformen.
    expect(html).toContain('data-spray-detail="label"')
    expect(html).toContain('border-y border-white/40 bg-white/28')
  })

  it('faerbt den Kopf einfarbig, nicht das Glas', () => {
    // Dieselbe Entscheidung wie beim Tropfenkopf: alle drei Teile in einer
    // Farbe, Licht und Schatten als eigene Ebene darueber.
    const html = render({ color: '#f97316' })
    expect(html).toMatch(/data-spray-detail="actuator"[^>]*fill="#f97316"/)
    expect(html).toMatch(/data-spray-detail="nozzle"[^>]*fill="#f97316"/)
    expect(html).toMatch(/data-spray-detail="collar"[^>]*fill="#f97316"/)
    expect(html).not.toMatch(/data-spray-detail="outer-contour"[^>]*fill="#f97316"/)
  })

  it('benutzt dasselbe Klarglas wie die anderen Glasformen', () => {
    // Byteweise dieselben Stops wie Vial, Ampulle, Nasenspray und Tropfen —
    // sonst steht eine Flasche aus anderem Material in der Reihe.
    const src = source()
    expect(src).toContain('<stop offset="0%" stopColor="rgba(2,6,23,0.62)" />')
    expect(src).toContain('<stop offset="100%" stopColor="rgba(2,6,23,0.72)" />')
  })

  it('haengt an derselben Fluessigkeit und demselben Etikett wie die Familie', () => {
    const src = source()
    expect(src).toContain('LiquidGraphic')
    expect(src).toContain('<StageLabel')
  })

  it('beschneidet Fluessigkeit und Rohr auf die INNEN-Kontur', () => {
    // Auf die aeussere beschnitten klebte die Fluessigkeit an der Aussenwand
    // und der Glasboden fehlte.
    const src = source()
    const fenster = src.slice(src.indexOf('data-spray-detail="liquid-window"'))
    expect(fenster.startsWith('data-spray-detail="liquid-window" clipPath={`url(#${uid}-innerClip)`}')).toBe(true)
    const rohr = src.slice(src.indexOf('data-spray-detail="dip-tube"'))
    expect(rohr.startsWith('data-spray-detail="dip-tube" clipPath={`url(#${uid}-innerClip)`}')).toBe(true)
    // Das Rohr steht IM Glas, wird also nach der Fluessigkeit gezeichnet.
    expect(src.indexOf('data-spray-detail="liquid-window"'))
      .toBeLessThan(src.indexOf('data-spray-detail="dip-tube"'))
  })

  it('zeichnet die Duese vor dem Druckkopf', () => {
    // Der Kopf muss die Ueberlappung abdecken, sonst sieht die Duese
    // angeklebt aus.
    const src = source()
    expect(src.indexOf('data-spray-detail="nozzle"'))
      .toBeLessThan(src.indexOf('data-spray-detail="actuator"'))
  })

  it('beschneidet jedes wandernde Licht auf sein Teil', () => {
    // Unbeschnitten malte das Kopflicht einen hellen Streifen in die Luft
    // neben der Duese — derselbe Fehler wie bei den Kantenlichtern der Ampulle.
    const src = source()
    expect(src.indexOf('outerClip)`}>')).toBeLessThan(src.indexOf('data-spray-detail="bloom"'))
    expect(src.indexOf('headClip)`}>')).toBeLessThan(src.indexOf('data-spray-detail="head-light"'))
    // Schatten weg von der Lampe, Glanz zu ihr hin.
    expect(render({ lightOffset: 1 })).toMatch(/data-spray-detail="glass-sweep"[^>]*translate\(18/)
    expect(render({ lightOffset: -1 })).toMatch(/data-spray-detail="glass-sweep"[^>]*translate\(-18/)
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    // Eine Sprosse unter dem Nasenspray: 186,4 -> 146,7. Schritt x1,2706.
    expect(render({ size: 'large' })).toContain('h-[365px]')
    expect(render({ size: 'carousel' })).toContain('h-[146.7px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[186.4px]')
    expect(render({ size: 'compact' })).toContain('h-[110px]')
    expect(render({ size: 'mini' })).toContain('h-[60px]')
  })

  it('setzt Namen und Menge ins Band, weiss und zentriert', () => {
    const html = render({ name: 'Vitamin B12 Methylcobalamin', amount: 1000, unit: 'IU / spray' })
    expect(html).toContain('vial-label-marquee')
    expect(html).toContain('font-black text-white tracking-normal')
    expect(html).toContain('1000 IU / spray')
    expect(html).toContain('text-center')
  })

  it('laesst die Detailzeile weg, wenn keine Menge bekannt ist', () => {
    // Kein erfundener Platzhalter.
    const html = render({ amount: null, unit: null })
    expect(html).not.toContain('uppercase tracking-wide text-white/90')
  })
})
