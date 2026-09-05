import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PowderVisual } from './PowderVisual'

const render = (props: Partial<Parameters<typeof PowderVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(PowderVisual, { name: 'Kreatin', color: '#38bdf8', ...props }))

describe('PowderVisual', () => {
  it('meldet sich als Pulver-Renderer', () => {
    expect(render()).toContain('data-powder-detail="root"')
  })

  it('zeichnet Korpus, Deckel, Riffelung und Schulter', () => {
    const html = render()
    expect(html).toContain('data-powder-detail="body"')
    expect(html).toContain('data-powder-detail="lid"')
    expect(html).toContain('data-powder-detail="lid-ribs"')
    // Aus dem dunklen Band am oberen Rand ist eine echte Deckflaeche
    // geworden: eine eigene Ebene mit eigenem Licht und eingesenktem Spiegel.
    expect(html).toContain('data-powder-detail="lid-crown"')
    expect(html).toContain('data-powder-detail="crown-inset"')
    expect(html).toContain('data-powder-detail="label"')
    // Die Schulter ist der Schatten des Deckelrands auf dem Korpus. Ohne sie
    // schwebt der Deckel auf der Dose.
    expect(html).toContain('data-powder-detail="shoulder"')
  })

  it('faerbt den Deckel, nicht den Korpus', () => {
    const html = render({ color: '#a3e635' })
    expect(html).toMatch(/data-powder-detail="lid"[^>]*fill="#a3e635"/)
    expect(html).not.toMatch(/data-powder-detail="body"[^>]*fill="#a3e635"/)
  })

  it('zeichnet den Korpus vor dem Deckel, damit er die Naht deckt', () => {
    const source = readFileSync(new URL('./PowderVisual.tsx', import.meta.url), 'utf8')
    expect(source.indexOf('data-powder-detail="body"'))
      .toBeLessThan(source.indexOf('data-powder-detail="lid"'))
  })

  it('beschneidet jedes wandernde Licht auf sein Teil', () => {
    // Derselbe Fehler wie beim Tabletten-Glanz: unbeschnitten malt es daneben.
    const source = readFileSync(new URL('./PowderVisual.tsx', import.meta.url), 'utf8')
    // Jedes bewegliche Licht steht hinter der Clip-Gruppe seines Teils.
    expect(source.indexOf('bodyClip)`}>'))
      .toBeLessThan(source.indexOf('data-powder-detail="sheen"'))
    expect(source.indexOf('lidClip)`}>'))
      .toBeLessThan(source.indexOf('data-powder-detail="lid-light"'))
    // Das Licht auf der Deckflaeche liegt in ihrer eigenen Gruppe.
    expect(source.indexOf('data-powder-detail="lid-crown"'))
      .toBeLessThan(source.indexOf('data-powder-detail="crown-light"'))
    expect(render({ lightOffset: 1 })).toMatch(/data-powder-detail="sheen"[^>]*translate\(16/)
    expect(render({ lightOffset: -1 })).toMatch(/data-powder-detail="sheen"[^>]*translate\(-16/)
  })

  it('zeigt weder Etikettband noch Fuellstand', () => {
    const html = render()
    // Das Etikettband gehoert Behaeltern mit Fluessigkeit. Eine Dose hat
    // keine Kammer, also auch keins.
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    const source = readFileSync(new URL('./PowderVisual.tsx', import.meta.url), 'utf8')
    // Kein Etikettband und keine Mengenzeile: die Komponente kennt weder
    // amount noch unit, es gibt also gar nichts zu zeigen.
    expect(source).not.toContain('<StageLabel')
    expect(source).not.toContain('fillPct')
    expect(source).not.toContain('SloshProvider')
    expect(source).not.toContain('amount')
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    // Eine Sprosse unter Vial und Ampulle: 115,5 -> 146,7 statt 146,7 ->
    // 186,4. Der Schritt bleibt x1,2706.
    expect(render({ size: 'large' })).toContain('h-[287.3px]')
    expect(render({ size: 'carousel' })).toContain('h-[115.5px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[146.7px]')
    expect(render({ size: 'compact' })).toContain('h-[86.6px]')
    expect(render({ size: 'mini' })).toContain('h-[47.2px]')
  })

  it('setzt den Namen auf den Korpus, mit Durchlauf wie bei der Tube', () => {
    const html = render({ name: 'Beta-Alanin Pulver ohne Zusaetze' })
    expect(html).toContain('data-powder-detail="name"')
    expect(html).toContain('vial-label-marquee')
    expect(html).toContain('Beta-Alanin Pulver ohne Zusaetze')
  })
})
