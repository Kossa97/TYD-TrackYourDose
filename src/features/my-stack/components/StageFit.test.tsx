// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StageFit } from './StageFit'

function masse(platz: { width: number; height: number }, objekt: { width: number; height: number }) {
  // Die Flaeche wird ueber `clientWidth`/`clientHeight` gemessen, nicht ueber
  // `getBoundingClientRect` — das ist der Kern: Layoutmasse, die eine
  // Skalierung des Eintrags nicht mitnehmen.
  Object.defineProperty(Element.prototype, 'clientWidth', {
    configurable: true,
    get(this: Element) { return (this as HTMLElement).dataset?.stageFit !== undefined ? platz.width : 0 },
  })
  Object.defineProperty(Element.prototype, 'clientHeight', {
    configurable: true,
    get(this: Element) { return (this as HTMLElement).dataset?.stageFit !== undefined ? platz.height : 0 },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: objekt.width })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: objekt.height })
}

const skalaVon = () => (document.querySelector('[data-stage-fit-object]') as HTMLElement).style.transform

describe('StageFit', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {} unobserve() {} disconnect() {}
    })
  })
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('rechnet den Faktor aus der engeren der beiden Achsen', () => {
    // Ein Pen ist schmal und hoch: die Höhe begrenzt, nicht die Breite.
    masse({ width: 240, height: 340 }, { width: 31, height: 237 })
    render(<StageFit><div /></StageFit>)

    // 340/237 ≈ 1,43 ist enger als 240/31 ≈ 7,7.
    expect(skalaVon()).toBe('scale(1.4345991561181435)')
  })

  it('nimmt bei einer breiten Form die Breite', () => {
    // Eine liegende Kapsel ist breit und flach — dort begrenzt die Breite.
    masse({ width: 240, height: 340 }, { width: 92, height: 32 })
    render(<StageFit maxScale={4}><div /></StageFit>)

    expect(skalaVon()).toBe('scale(2.608695652173913)')
  })

  it('vergroessert von sich aus hoechstens um zwei Drittel', () => {
    // Skalieren vergroessert das fertige Bild, nicht die Zeichnung: laufende
    // Animationen und SVG-Filter legen eine Form auf eine eigene Ebene, die in
    // ihrer Layoutgroesse gerastert und danach hochgezogen wird. Der Aufrufer
    // gibt deshalb die grosse Vorlage herein; die Voreinstellung hier ist die
    // Notbremse, falls er es vergisst.
    masse({ width: 240, height: 340 }, { width: 92, height: 32 })
    render(<StageFit><div /></StageFit>)

    expect(skalaVon()).toBe('scale(1.6)')
  })

  it('zieht ein winziges Objekt nicht ins Gigantische', () => {
    masse({ width: 900, height: 900 }, { width: 10, height: 10 })
    render(<StageFit maxScale={3}><div /></StageFit>)

    expect(skalaVon()).toBe('scale(3)')
  })

  it('bleibt bei 1, solange nichts gemessen werden kann', () => {
    // Vor dem ersten Layout sind alle Maße 0 — dann darf nicht durch 0
    // geteilt werden.
    masse({ width: 0, height: 0 }, { width: 0, height: 0 })
    render(<StageFit><div /></StageFit>)

    expect(skalaVon()).toBe('scale(1)')
  })

  it('skaliert von der unteren linken Ecke in den Kasten hinein', () => {
    // Der aeussere Kasten IST das fertige Bild; das Objekt fuellt ihn von
    // seiner unteren linken Ecke aus genau aus. Die Standlinie unten bleibt
    // damit fuer alle Formen dieselbe.
    masse({ width: 240, height: 340 }, { width: 92, height: 32 })
    render(<StageFit><div /></StageFit>)

    expect((document.querySelector('[data-stage-fit-object]') as HTMLElement).style.transformOrigin)
      .toBe('bottom left')
  })

  it('macht den Kasten so gross wie das fertige Bild', () => {
    // Das ist der Kern: `scale()` aendert das Bild, nicht das Layout. Ohne
    // diesen Kasten belegte eine auf 240 px heruntergerechnete Kapsel im
    // Layout weiterhin ihre 364 px — sie ragte aus dem Karussellplatz heraus
    // und verbreiterte den scrollbaren Streifen.
    masse({ width: 240, height: 340 }, { width: 92, height: 32 })
    render(<StageFit maxScale={4}><div /></StageFit>)

    const kasten = document.querySelector('[data-stage-fit-box]') as HTMLElement
    // 92 x 2,6087 = 240 (die Flaechenbreite), 32 x 2,6087 = 83,48.
    expect(kasten.style.width).toBe('240px')
    expect(kasten.style.height).toBe('83.47826086956522px')
  })

  it('steht mittig, ohne dass die gemessene Breite daran haengt', () => {
    // Die Mitte kommt aus `left-1/2 -translate-x-1/2` am Kasten, nicht aus
    // einer Flussmessung. Sonst verschoebe jede Aenderung an der Objektbreite
    // — erste Messung, Schriftnachladung, Etikettenwechsel — das Objekt
    // seitlich, und genau das hat nach dem Wischen kurz gezuckt.
    masse({ width: 240, height: 340 }, { width: 92, height: 32 })
    render(<StageFit><div /></StageFit>)

    const kasten = document.querySelector('[data-stage-fit-box]') as HTMLElement
    expect(kasten.className).toContain('left-1/2')
    expect(kasten.className).toContain('-translate-x-1/2')
    expect(kasten.className).toContain('absolute')
  })

  it('misst die Flaeche als Layoutmass, nicht als Bildmass', () => {
    // Im Karussell steht jeder Eintrag unter einem `scale()`. `getBounding-
    // ClientRect()` liefert die Masse NACH dieser Skalierung, `offsetWidth`
    // davor — wer beides mischt, rechnet den Faktor eines Nachbarn um dessen
    // Eintragsskalierung zu klein (im Browser gemessen: 0,998 statt 1,217) und
    // laesst das Objekt um 22 % springen, sobald der Eintrag aktiv wird.
    masse({ width: 240, height: 340 }, { width: 92, height: 32 })
    const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect')

    render(<StageFit maxScale={4}><div /></StageFit>)

    expect(skalaVon()).toBe('scale(2.608695652173913)')
    expect(rect).not.toHaveBeenCalled()
  })

  it('rastet einen Faktor dicht an 1 auf genau 1 ein', () => {
    // `scale(1)` ist die Identitaet — der Browser rechnet das Bild dann gar
    // nicht um. Bei 1,04 wird jede Kante neu abgetastet, fuer vier Prozent
    // mehr Groesse, die niemand sieht.
    masse({ width: 104, height: 1000 }, { width: 100, height: 100 })
    render(<StageFit><div /></StageFit>)

    expect(skalaVon()).toBe('scale(1)')
  })

  it('laesst einen Faktor ausserhalb der Totzone stehen', () => {
    masse({ width: 120, height: 1000 }, { width: 100, height: 100 })
    render(<StageFit><div /></StageFit>)

    expect(skalaVon()).toBe('scale(1.2)')
  })

  it('zeigt nichts, bevor gemessen wurde', () => {
    // Gemessen wird im Layout-Effekt, also vor dem ersten Anzeigen. Bliebe das
    // Objekt sichtbar, saehe man einen Bildwechsel von Vorlagengroesse auf
    // eingepasst.
    masse({ width: 0, height: 0 }, { width: 0, height: 0 })
    render(<StageFit><div /></StageFit>)

    expect((document.querySelector('[data-stage-fit-object]') as HTMLElement).style.visibility)
      .toBe('hidden')
  })
})
