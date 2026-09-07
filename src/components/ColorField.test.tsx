// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ColorField } from './ColorField'
import { hexToHsv } from '../features/my-stack/lib/colorField'

afterEach(cleanup)

function aufbauen(value = '#00ccf5') {
  const onChange = vi.fn()
  const { container, rerender } = render(<ColorField value={value} onChange={onChange} />)
  return {
    onChange,
    rerender,
    flaeche: container.querySelector('[data-color-field="area"]') as HTMLElement,
    schiene: container.querySelector('[data-color-field="hue"]') as HTMLElement,
    griff: () => container.querySelector('[data-color-field="area-thumb"]') as HTMLElement,
    tonGriff: () => container.querySelector('[data-color-field="hue-thumb"]') as HTMLElement,
    container,
  }
}

describe('ColorField', () => {
  it('setzt den Griff dorthin, wo die uebergebene Farbe liegt', () => {
    const { griff, tonGriff } = aufbauen('#00ccf5')
    const hsv = hexToHsv('#00ccf5')!

    expect(griff().style.left).toBe(`${hsv.s * 100}%`)
    expect(griff().style.top).toBe(`${(1 - hsv.v) * 100}%`)
    expect(tonGriff().style.left).toBe(`${(hsv.h / 360) * 100}%`)
  })

  it('laesst sich mit den Pfeiltasten bedienen, nicht nur mit dem Finger', () => {
    const { schiene, flaeche, onChange } = aufbauen('#00ccf5')

    fireEvent.keyDown(schiene, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0]).toMatch(/^#[0-9a-f]{6}$/)

    fireEvent.keyDown(flaeche, { key: 'ArrowDown' })
    expect(onChange).toHaveBeenCalledTimes(2)
    // Dunkler geworden, nicht heller.
    expect(hexToHsv(onChange.mock.calls[1][0])!.v).toBeLessThan(hexToHsv('#00ccf5')!.v)
  })

  it('haelt am Rand an, statt umzuschlagen', () => {
    const { flaeche, onChange } = aufbauen('#000000')

    for (let i = 0; i < 5; i += 1) fireEvent.keyDown(flaeche, { key: 'ArrowDown' })

    expect(onChange).toHaveBeenLastCalledWith('#000000')
  })

  it('faehrt beim Farbton im Kreis, statt an 0 stehenzubleiben', () => {
    const { schiene, onChange } = aufbauen('#ff0000') // Farbton 0
    fireEvent.keyDown(schiene, { key: 'ArrowLeft' })

    // 0 minus ein Schritt ist nicht 0, sondern kurz vor 360.
    expect(hexToHsv(onChange.mock.calls[0][0])!.h).toBeGreaterThan(300)
  })

  it('folgt dem Finger und faengt ihn ein, damit der Zug nicht abreisst', () => {
    // touch-action: none, sonst scrollt die Seite statt zu ziehen.
    const { flaeche, schiene } = aufbauen()
    expect(flaeche.className).toContain('touch-none')
    expect(schiene.className).toContain('touch-none')

    const setPointerCapture = vi.fn()
    flaeche.setPointerCapture = setPointerCapture
    flaeche.hasPointerCapture = () => true
    flaeche.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect

    fireEvent.pointerDown(flaeche, { pointerId: 1, clientX: 100, clientY: 50 })
    expect(setPointerCapture).toHaveBeenCalledWith(1)
  })

  it('meldet beim Ziehen laufend, nicht erst beim Loslassen', () => {
    // Das Objekt ueber dem Feld soll waehrend des Zugs mitfaerben.
    const { flaeche, onChange } = aufbauen()
    flaeche.setPointerCapture = vi.fn()
    flaeche.hasPointerCapture = () => true
    flaeche.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect

    fireEvent.pointerDown(flaeche, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(flaeche, { pointerId: 1, clientX: 100, clientY: 50 })
    fireEvent.pointerMove(flaeche, { pointerId: 1, clientX: 200, clientY: 0 })

    expect(onChange).toHaveBeenCalledTimes(3)
    // Ecke oben links ist Weiss, oben rechts der volle Ton.
    expect(onChange.mock.calls[0][0]).toBe('#ffffff')
    expect(hexToHsv(onChange.mock.calls[2][0])!.s).toBeCloseTo(1, 2)
  })

  it('zieht ausserhalb der Flaeche nicht weiter, als es die Flaeche gibt', () => {
    const { flaeche, onChange } = aufbauen()
    flaeche.setPointerCapture = vi.fn()
    flaeche.hasPointerCapture = () => true
    flaeche.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect

    fireEvent.pointerDown(flaeche, { pointerId: 1, clientX: -500, clientY: 500 })

    // Links unten: Saettigung 0, Helligkeit 0 — also Schwarz, nicht NaN.
    expect(onChange).toHaveBeenCalledWith('#000000')
  })

  it('markiert unsere eigenen Farbtoene auf der Schiene', () => {
    const { container } = aufbauen()
    const marken = container.querySelectorAll('[data-color-field-mark]')

    expect(marken).toHaveLength(5)
    expect(container.querySelector('[data-color-field-mark="accent"]')).not.toBeNull()
  })

  it('nimmt eine Farbe von aussen an, ohne den eigenen Ruf zurueckzuspielen', () => {
    // Beim Ziehen durch Weiss ist die Saettigung 0 — dort haben alle Farbtoene
    // dieselbe Farbe. Wuerde der eigene Ruf zurueckkommen, ginge der Ton
    // verloren und der Griff der Schiene spraenge auf Rot.
    const { schiene, onChange, rerender, tonGriff } = aufbauen('#00ccf5')
    const vorher = tonGriff().style.left

    fireEvent.keyDown(schiene, { key: 'ArrowUp' })
    const gemeldet = onChange.mock.calls[0][0]
    rerender(<ColorField value={gemeldet} onChange={onChange} />)

    expect(tonGriff().style.left).not.toBe(vorher)
    // Der Griff steht auf dem INNEREN Wert, nicht auf dem aus dem Hex
    // zurueckgerechneten: ein Hex hat 8 Bit je Kanal, der genaue Farbton
    // ueberlebt die Rundung nicht. Genau deshalb spielt die Komponente den
    // eigenen Ruf nicht zurueck — sonst wanderte der Griff bei jedem Schritt
    // ein Stueck.
    const zurueck = (hexToHsv(gemeldet)!.h / 360) * 100
    expect(Number.parseFloat(tonGriff().style.left)).toBeCloseTo(zurueck, 1)
  })
})
