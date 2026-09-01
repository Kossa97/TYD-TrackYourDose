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



  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Kapsel')
  })

  it('beschriftet sich wie Vial und Ampulle: HTML-Text mit denselben Klassen', () => {
    const html = render()
    expect(html).toContain('data-capsule-detail="name"')
    // exakt die Klassen des Etikettnamens
    expect(html).toContain('font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]')
    expect(html).toContain('Vitamin D3')
  })

  it('nutzt denselben Durchlauf wie das Etikett statt eines eigenen', () => {
    const source = readFileSync(new URL('./CapsuleVisual.tsx', import.meta.url), 'utf8')
    expect(source).toContain('StageMarquee')
    expect(source).not.toContain('buildMarqueeMotion')
  })

  it('traegt denselben Licht-Sheen ueber der Schrift wie das Etikettband', () => {
    const html = render({ lightOffset: 0.5, focus: 1 })
    expect(html).toContain('from-black/10 via-white/10 to-black/10')
    expect(html).toContain('translateX(5%)')
  })

  it('zeichnet keinen SVG-Text mehr, damit die Glaettung stimmt', () => {
    const source = readFileSync(new URL('./CapsuleVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('<text')
  })

})
