import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PatchVisual } from './PatchVisual'

const render = (props: Partial<Parameters<typeof PatchVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(PatchVisual, { name: 'Nikotinpflaster', color: '#7dd3fc', ...props }))

describe('PatchVisual', () => {
  it('meldet sich als Pflaster-Renderer', () => {
    expect(render()).toContain('data-patch-detail="root"')
  })

  it('zeichnet Koerper, abgehobene Ecke und Farbstreifen', () => {
    const html = render()
    expect(html).toContain('data-patch-detail="body"')
    expect(html).toContain('data-patch-detail="flap"')
    expect(html).toContain('data-patch-detail="flap-shadow"')
    expect(html).toContain('data-patch-detail="stripe"')
  })

  it('faerbt nur den Streifen mit der Eintragsfarbe', () => {
    const html = render({ color: '#a3e635' })
    expect(html).toMatch(/data-patch-detail="stripe"[^>]*fill="#a3e635"/)
    expect(html).not.toMatch(/data-patch-detail="body"[^>]*fill="#a3e635"/)
  })

  it('beschneidet Schimmer und Laschenschatten auf den Koerper', () => {
    // Beide wandern mit dem Licht; unbeschnitten malen sie neben das
    // Pflaster. Derselbe Fehler wie beim Tabletten-Glanz.
    const source = readFileSync(new URL('./PatchVisual.tsx', import.meta.url), 'utf8')
    const gruppe = source.match(/bodyClip\)`\}>[\s\S]*?<\/g>/)?.[0] ?? ''
    expect(gruppe).toContain('data-patch-detail="sheen"')
    expect(gruppe).toContain('data-patch-detail="flap-shadow"')
  })

  it('laesst Schimmer und Schatten mit dem Licht wandern', () => {
    expect(render({ lightOffset: 0 })).toMatch(/data-patch-detail="sheen"[^>]*translate\(0/)
    expect(render({ lightOffset: 1 })).toMatch(/data-patch-detail="sheen"[^>]*translate\(26/)
    expect(render({ lightOffset: -1 })).toMatch(/data-patch-detail="sheen"[^>]*translate\(-26/)
    // Der Schatten wandert gegenlaeufig: er faellt von der Lichtquelle weg.
    expect(render({ lightOffset: 1 })).toMatch(/data-patch-detail="flap-shadow"[^>]*translate\(-3/)
  })

  it('setzt den Namen waagerecht, nicht gedreht wie beim Pen', () => {
    // Das Querformat gibt ihm die Breite, und ungedrehter Text bekommt die
    // schaerfere Subpixel-Glaettung.
    const html = render()
    expect(html).toContain('data-patch-detail="name"')
    expect(html).not.toContain('rotate(-90deg)')
  })

  it('laesst zu lange Namen durchlaufen statt sie abzuschneiden', () => {
    const html = render({ name: 'Rivastigmin transdermal 9,5 mg pro 24 Stunden' })
    expect(html).toMatch(/data-patch-detail="name"[^>]*overflow-hidden/)
    // Die aeussere Huelle braucht eine feste Breite, sonst misst der Marquee
    // seinen Ueberhang gegen sich selbst und loest nie aus.
    expect(html).toMatch(
      /<span class="block overflow-hidden whitespace-nowrap w-full[^"]*"><span class="vial-label-marquee/,
    )
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    expect(render({ size: 'large' })).toContain('h-[236.9px]')
    expect(render({ size: 'carousel' })).toContain('h-[95.2px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[121px]')
    expect(render({ size: 'compact' })).toContain('h-[71.4px]')
    expect(render({ size: 'mini' })).toContain('h-[38.9px]')
  })

  it('bekommt weder Etikettband noch Fuellstand noch Schwappen', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
    const source = readFileSync(new URL('./PatchVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('LiquidGraphic')
    expect(source).not.toContain('SloshContext')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Pflaster')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-patch-focus="0.42"')
    expect(html).toContain('data-patch-light-offset="-0.35"')
  })
})
