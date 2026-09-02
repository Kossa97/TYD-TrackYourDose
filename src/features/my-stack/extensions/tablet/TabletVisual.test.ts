import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TabletVisual } from './TabletVisual'

const base = { name: 'Ibuprofen', color: '#d9c39a' }
const render = (props: Partial<Parameters<typeof TabletVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(TabletVisual, { ...base, ...props }))

describe('TabletVisual', () => {
  it('meldet sich als Tabletten-Renderer', () => {
    expect(render()).toContain('data-tablet-detail="root"')
  })

  it('zeichnet einen Kreis mit waagerechter Bruchrille', () => {
    const html = render()
    expect(html).toContain('data-tablet-detail="body"')
    expect(html).toContain('data-tablet-detail="score"')
    // waagerecht: gleiche y-Koordinate an beiden Enden
    expect(html).toMatch(/data-tablet-detail="score"[^>]*y1="50"[^>]*y2="50"/)
  })

  it('bleibt bei jeder Groesse rund', () => {
    for (const size of ['large', 'carousel', 'compact', 'mini'] as const) {
      expect(render({ size })).toContain('aspect-square')
    }
  })

  it('haelt die im Spec festgelegten Durchmesser ein', () => {
    expect(render({ size: 'large' })).toContain('w-[160px]')
    expect(render({ size: 'carousel' })).toContain('w-[62px]')
    expect(render({ size: 'compact' })).toContain('w-[96px]')
    expect(render({ size: 'mini' })).toContain('w-[40px]')
  })

  it('faerbt das Material selbst statt eine Toenung darueberzulegen', () => {
    const html = render({ color: '#7dd3fc' })
    expect(html).toContain('#7dd3fc')
    // undurchsichtig: kein Glas-Malstapel
    expect(html).not.toContain('data-tablet-detail="sweep"')
  })

  it('setzt den Namen unter die Rille und beschneidet ihn am Kreis', () => {
    const html = render()
    expect(html).toContain('data-tablet-detail="name"')
    expect(html).toContain('top:62%')
    expect(html).toContain('clipPathUnits="objectBoundingBox"')
  })

  it('laesst den Durchlauf bis an die Kreiswand reichen', () => {
    const html = render()
    // Sehne auf Namenshoehe statt pauschalem Rand — die Kontur schneidet die
    // Enden, statt dass der Text an einer geraden Kante ausläuft.
    expect(html).toContain('left:3.52%')
    expect(html).toContain('right:3.52%')
    expect(html).not.toContain('inset-x-[12%]')
  })

  it('beschriftet wie alle anderen Formen', () => {
    const html = render()
    expect(html).toContain('font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]')
    expect(html).toContain('Ibuprofen')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Tablette')
  })

  it('bekommt weder Etikett noch Fuellstand', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
  })

  it('zeichnet keinen SVG-Text', () => {
    const source = readFileSync(new URL('./TabletVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('<text')
  })

  it('rollt an: alles wandert, aber nur die Materialspuren drehen sich mit', () => {
    const html = render()
    expect(html).toContain('data-tablet-detail="roll"')

    // Ein Kreis zeigt keine Drehung — die Rille ist der einzige Drehanzeiger,
    // den eine Tablette von oben hat. Der Lichtfleck gehoert nicht dazu: eine
    // Reflexion kommt von der feststehenden Lampe, nicht vom Koerper.
    const spin = html.match(/<g data-tablet-detail="spin">(.*?)<\/g>/s)?.[1] ?? ''
    expect(spin).toContain('data-tablet-detail="score"')
    expect(spin).not.toContain('data-tablet-detail="glint"')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-tablet-focus="0.42"')
    expect(html).toContain('data-tablet-light-offset="-0.35"')
  })
})
