import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CapsuleVisual } from './CapsuleVisual'

const base = { name: 'Vitamin D3', color: '#f0b357' }
const render = (props: Partial<Parameters<typeof CapsuleVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(CapsuleVisual, { ...base, ...props }))

describe('CapsuleVisual', () => {
  it('meldet sich als Kapsel-Renderer', () => {
    expect(render()).toContain('data-capsule-detail="root"')
  })

  it('zeichnet Grundkoerper, Kappe und beide Innenkonturen', () => {
    const html = render()
    expect(html).toContain('data-capsule-detail="shell"')
    expect(html).toContain('data-capsule-detail="cap"')
    expect(html).toContain('data-capsule-detail="shell-inner"')
    expect(html).toContain('data-capsule-detail="cap-inner"')
  })

  it('haelt die Huellenkante bei jeder Groesse sichtbar', () => {
    expect(render({ size: 'carousel' })).toContain('vector-effect="non-scaling-stroke"')
  })

  it('teilt einen absoluten Verlauf zwischen Kappe und Koerper', () => {
    // Bei objektbezogenen Einheiten springt die Toenung an der Naht, weil die
    // beiden Pfade unterschiedlich hoch sind.
    expect(render()).toContain('gradientUnits="userSpaceOnUse"')
  })

  it('setzt die Schrift erhaben auf die Huelle: Schattenkante unten, Lichtkante oben', () => {
    const html = render()
    expect(html).toContain('data-capsule-detail="engraving"')
    // lichtabgewandte Seite nach unten rechts, beleuchtete Oberkante nach oben links
    expect(html).toContain('transform="translate(0.5 0.7)"')
    expect(html).toContain('transform="translate(-0.25 -0.4)"')
  })

  it('laesst den Glanz der Schrift mit dem Licht wandern', () => {
    const html = render({ lightOffset: 0.5 })
    expect(html).toContain('data-capsule-detail="text-gloss"')
    expect(html).toContain('translate(29 0)')
  })

  it('beschneidet den Schriftzug mit der Innenkontur, damit die Rundung mitschneidet', () => {
    const html = render()
    const window = html.match(/id="([^"]*-engravingWindow)"/)?.[1]
    expect(window).toBeTruthy()
    const clipDef = html.slice(html.indexOf(`id="${window}"`), html.indexOf(`id="${window}"`) + 260)
    expect(clipDef).toContain('<path')
    expect(clipDef).not.toContain('<rect')
  })

  it('zentriert die Gravur auf der Kapselmitte', () => {
    expect(render()).toContain('x="120"')
  })

  it('behaelt liegend das Seitenverhaeltnis bei jeder Groesse', () => {
    for (const size of ['large', 'carousel', 'compact', 'mini'] as const) {
      expect(render({ size })).toContain('aspect-[240/84]')
    }
  })

  it('waechst am sm-Breakpoint nicht mit, schrumpft aber mit einem engen Slot', () => {
    const html = render({ size: 'carousel' })
    expect(html).toContain('w-[92px] max-w-full')
    expect(html).not.toContain('sm:')
  })

  it('bekommt weder Etikett noch Fuellstand', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
  })

  it('haengt nicht an der Slosh-Physik', () => {
    const source = readFileSync(new URL('./CapsuleVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('SloshContext')
    expect(source).not.toContain('sloshEngine')
    expect(source).not.toContain('useSloshSubscribe')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-capsule-focus="0.42"')
    expect(html).toContain('data-capsule-light-offset="-0.35"')
  })

  it('graviert in der Etikettschrift statt in einer eigenen', () => {
    const html = render()
    expect(html).toContain('Inter')
    expect(html).toContain('font-weight="900"')
    expect(html).toContain('Vitamin D3')
  })

  it('kuerzt lange Namen nicht, sondern laesst sie wie beim Etikett durchlaufen', () => {
    const long = render({ name: 'Acetyl-L-Carnitin Hydrochlorid Komplex' })
    // vollstaendig im Markup, nur optisch vom Sichtfenster beschnitten
    expect(long).toContain('Acetyl-L-Carnitin Hydrochlorid Komplex')
    expect(long).not.toContain('…')
    expect(long).toContain('engravingWindow')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Kapsel')
  })

  it('teilt die Marquee-Bewegung mit dem Etikett', () => {
    const source = readFileSync(new URL('./CapsuleVisual.tsx', import.meta.url), 'utf8')
    expect(source).toContain('buildMarqueeMotion')
  })
})
