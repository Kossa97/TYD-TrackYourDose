import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StageLabel } from './StageLabel'

describe('StageLabel', () => {
  it('renders name and detail with the data attributes the caller supplies', () => {
    const html = renderToStaticMarkup(createElement(StageLabel, {
      name: 'Testosteron Enantat',
      detail: '250 mg / ml',
      className: 'left-0 right-0',
      nameClassName: 'text-sm',
      detailClassName: 'text-xs',
      wrapperProps: { 'data-vial-detail': 'label-glass-wrap' },
      innerProps: { 'data-vial-detail': 'full-width-label' },
    }))

    expect(html).toContain('data-vial-detail="label-glass-wrap"')
    expect(html).toContain('data-vial-detail="full-width-label"')
    expect(html).toContain('Testosteron Enantat')
    expect(html).toContain('250 mg / ml')
    expect(html).toContain('vial-label-marquee')
    expect(html).toContain('whitespace-nowrap')
  })

  it('stellt die Aufschrift mittig ins Band, egal ob eine Zeile oder zwei', () => {
    // Die meisten Formen geben dem Band eine feste Hoehe (top/height in
    // Prozent). Ein Block ohne Ausrichtung faengt am oberen Rand an — solange
    // zwei Zeilen darin standen, fiel das kaum auf; seit die Mengenzeile
    // wegfaellt, sobald keine Menge eingetragen ist, klebte der Name allein an
    // der Oberkante (gemeldet an der Ampulle).
    //
    // `justify-center` richtet den INHALT aus, nicht die Zeilen einzeln: eine
    // Zeile sitzt in der Mitte, zwei sitzen als Block in der Mitte.
    for (const detail of ['250 mg / ml', null]) {
      const html = renderToStaticMarkup(createElement(StageLabel, {
        name: 'Semaglutid',
        detail,
        className: 'left-0 right-0',
        nameClassName: 'text-sm',
        detailClassName: 'text-xs',
      }))
      const band = html.slice(0, html.indexOf('>'))
      expect(band, String(detail)).toContain('flex')
      expect(band, String(detail)).toContain('flex-col')
      expect(band, String(detail)).toContain('justify-center')
    }
  })

  it('leaves the detail line out instead of printing an empty one', () => {
    const html = renderToStaticMarkup(createElement(StageLabel, {
      name: 'Ampulle ohne Menge',
      detail: null,
      className: '',
      nameClassName: '',
      detailClassName: '',
    }))

    expect(html).toContain('Ampulle ohne Menge')
    expect(html).not.toContain('<p')
  })

  it('trägt keinen Hintergrund-Durchgriff', () => {
    // `backdrop-filter` liest, was hinter dem Band liegt — aber nur aus
    // derselben Zeichenebene. Solange die Füllanimation läuft, liegt die
    // Flüssigkeit auf einer eigenen (jede laufende CSS-Animation legt sie
    // dorthin), und WebKit nimmt die nicht in den Hintergrund auf: beim Laden
    // blieb das Band dunkel, während darüber und darunter schon Grün stand,
    // und wurde erst richtig, wenn die Animation endete oder ein Wisch die
    // Ebenen neu zusammensetzte. Zwei Pixel Unschärfe über einer fast
    // einfarbigen Flüssigkeit sind das nicht wert.
    const source = readFileSync(new URL('./StageLabel.tsx', import.meta.url), 'utf8')
    const klassen = source.match(/className=\{`absolute [^`]*`\}/)

    expect(klassen).not.toBeNull()
    expect(klassen![0]).not.toContain('backdrop-')
    // Durchscheinend war das Band nie wegen der Unschärfe, sondern wegen
    // dieser Fläche — sie muss bleiben, sonst verschwindet der Füllstand
    // hinter dem Band.
    expect(klassen![0]).toContain('bg-white/28')
  })

  it('measures real overflow rather than guessing from the name length', () => {
    const source = readFileSync(new URL('./StageLabel.tsx', import.meta.url), 'utf8')

    expect(source).toContain('ResizeObserver')
    expect(source).toContain('inner.scrollWidth - wrap.clientWidth')
    expect(source).toContain('inner.animate(')
    expect(source).not.toContain('.length >')
  })
})
