import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PenVisual } from './PenVisual'

const render = (props: Partial<Parameters<typeof PenVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(PenVisual, { name: 'Semaglutid', color: '#3f7fbf', ...props }))

describe('PenVisual', () => {
  it('meldet sich als Pen-Renderer', () => {
    expect(render()).toContain('data-pen-detail="root"')
  })

  it('zeichnet Kappe, Koerper, Ring, Dosisfenster und Knopf', () => {
    const html = render()
    expect(html).toContain('data-pen-detail="cap"')
    expect(html).toContain('data-pen-detail="body"')
    expect(html).toContain('data-pen-detail="ring"')
    expect(html).toContain('data-pen-detail="dose-window"')
    expect(html).toContain('data-pen-detail="knob"')
  })

  it('zeigt kein Kartuschenfenster und keine Fluessigkeit', () => {
    const source = readFileSync(new URL('./PenVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('LiquidGraphic')
    expect(source).not.toContain('SloshContext')
    expect(render()).not.toContain('data-pen-detail="cartridge"')
  })

  it('verbindet den Knopf ueber eine konische Schulter statt stumpf zu stossen', () => {
    const html = render()
    expect(html).toContain('data-pen-detail="knob-shoulder"')
    // Der Knopf ist keine Stufe mehr, sondern ein Umriss mit Schraege.
    expect(html).toMatch(/data-pen-detail="knob" d="M4 246/)
  })

  it('faerbt nur den Ring mit der Eintragsfarbe', () => {
    // Das Gehaeuse bleibt neutral; die Farbe erscheint ausschliesslich im Ring.
    const html = render({ color: '#a3e635' })
    expect(html).toMatch(/data-pen-detail="ring"[^>]*fill="#a3e635"/)
    expect(html).not.toMatch(/data-pen-detail="body"[^>]*fill="#a3e635"/)
  })

  it('beschneidet das wandernde Glanzband auf den Koerper', () => {
    // Der Pen ist die schmalste Form — unbeschnitten malte das Band beim
    // Wischen neben das Gehaeuse. Derselbe Fehler wie beim Tabletten-Glanz.
    const source = readFileSync(new URL('./PenVisual.tsx', import.meta.url), 'utf8')
    const band = source.match(/bodyClip[\s\S]{0,300}?data-pen-detail="sweep"/)?.[0] ?? ''
    expect(band).not.toBe('')
  })

  it('laesst das Glanzband mit dem Licht wandern', () => {
    expect(render({ lightOffset: 0 })).toMatch(/data-pen-detail="sweep"[^>]*translate\(0/)
    expect(render({ lightOffset: 1 })).toMatch(/data-pen-detail="sweep"[^>]*translate\(14/)
    expect(render({ lightOffset: -1 })).toMatch(/data-pen-detail="sweep"[^>]*translate\(-14/)
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    expect(render({ size: 'large' })).toContain('h-[589.2px]')
    expect(render({ size: 'large' })).toContain('w-[76.6px]')
    expect(render({ size: 'carousel' })).toContain('h-[236.8px]')
    expect(render({ size: 'carousel' })).toContain('w-[30.8px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[300.9px]')
    expect(render({ size: 'carousel' })).toContain('sm:w-[39.1px]')
    expect(render({ size: 'compact' })).toContain('h-[177.6px]')
    expect(render({ size: 'mini' })).toContain('h-[96.9px]')
  })

  it('setzt den Namen laengs in einer gedrehten Huelle', () => {
    const html = render()
    expect(html).toContain('data-pen-detail="name"')
    expect(html).toContain('rotate(-90deg)')
    // 210,26 % der Breite entsprechen der Laufstrecke auf dem Bildschirm,
    // 8,33 % der Hoehe seiner Breite — beide Masse kommen vom Bildschirm.
    expect(html).toContain('width:210.26%')
    expect(html).toContain('height:8.33%')
  })

  it('laesst zu lange Namen laengs durchlaufen statt sie abzuschneiden', () => {
    // Der Pen ist die schmalste Form; laengs hat er zwar mehr Platz als jede
    // andere Form quer, aber lange Wirkstoffnamen sprengen ihn trotzdem. Die
    // Huelle schneidet ab, der geteilte StageMarquee schiebt den Text durch.
    const html = render({ name: 'Insulin glargin 300 Einheiten pro Milliliter' })
    expect(html).toMatch(/data-pen-detail="name"[^>]*overflow-hidden/)
    expect(html).toContain('vial-label-marquee')
    // StageMarquee misst clientWidth der aeusseren Huelle gegen scrollWidth
    // der inneren. In einer Flexbox schrumpft die aeussere auf ihren Inhalt,
    // misst also gegen sich selbst und loest nie aus — deshalb w-full.
    expect(html).toMatch(
      /<span class="block overflow-hidden whitespace-nowrap w-full[^"]*"><span class="vial-label-marquee[^"]*">Insulin glargin/,
    )
  })

  it('setzt den Namen auf einen Bildschirm statt ihn aufzudrucken', () => {
    const html = render()
    expect(html).toContain('data-pen-detail="screen"')
    expect(html).toContain('data-pen-detail="screen-bezel"')
  })

  it('beschneidet den wandernden Glasglanz auf den Bildschirm', () => {
    // Derselbe Fehler wie beim Tabletten-Glanz: unbeschnitten malt er neben
    // das Feld.
    const source = readFileSync(new URL('./PenVisual.tsx', import.meta.url), 'utf8')
    const glanz = source.match(/screenClip[\s\S]{0,600}?data-pen-detail="screen-glint"/)?.[0] ?? ''
    expect(glanz).not.toBe('')
    expect(render({ lightOffset: 1 })).toMatch(/data-pen-detail="screen-glint"[^>]*translate\(9/)
    expect(render({ lightOffset: -1 })).toMatch(/data-pen-detail="screen-glint"[^>]*translate\(-9/)
  })

  it('schreibt Name und Ziffer als HTML, nicht als SVG-Text', () => {
    const source = readFileSync(new URL('./PenVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('<text')
    expect(render()).toContain('data-pen-detail="dose-value"')
  })

  it('zeigt im Dosisfenster eine 0', () => {
    expect(render()).toMatch(/data-pen-detail="dose-value"[^>]*>0</)
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Pen')
  })

  it('bekommt weder Etikettband noch Fuellstand', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
    const source = readFileSync(new URL('./PenVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('<StageLabel')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-pen-focus="0.42"')
    expect(html).toContain('data-pen-light-offset="-0.35"')
  })
})
