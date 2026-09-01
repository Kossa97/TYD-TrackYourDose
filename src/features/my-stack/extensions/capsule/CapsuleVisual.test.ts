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

  it('graviert ohne Fuellton im Buchstabeninneren', () => {
    const html = render()
    expect(html).toContain('data-capsule-detail="engraving"')
    const group = html.slice(html.indexOf('data-capsule-detail="engraving"'))
    expect(group.slice(0, 200)).toContain('fill="none"')
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
    expect(html).toContain('w-full max-w-[92px]')
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

  it('graviert den Namen in Versalien und kuerzt lange Namen ohne Punkte', () => {
    expect(render()).toContain('VITAMIN D3')
    const long = render({ name: 'Acetyl-L-Carnitin Hydrochlorid Komplex' })
    expect(long).toContain('ACETYL-L-CARNITIN')
    expect(long).not.toContain('…')
  })
})
