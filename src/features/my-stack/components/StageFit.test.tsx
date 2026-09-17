// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StageFit } from './StageFit'

function masse(platz: { width: number; height: number }, objekt: { width: number; height: number }) {
  Element.prototype.getBoundingClientRect = vi.fn(function (this: Element) {
    const istFlaeche = (this as HTMLElement).dataset?.stageFit !== undefined
    const m = istFlaeche ? platz : objekt
    return { ...m, x: 0, y: 0, top: 0, left: 0, right: m.width, bottom: m.height, toJSON: () => ({}) } as DOMRect
  }) as unknown as typeof Element.prototype.getBoundingClientRect
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

  it('skaliert vom Boden, damit alle auf einer Standlinie stehen', () => {
    masse({ width: 240, height: 340 }, { width: 92, height: 32 })
    render(<StageFit><div /></StageFit>)

    expect((document.querySelector('[data-stage-fit-object]') as HTMLElement).style.transformOrigin)
      .toBe('bottom center')
  })
})
