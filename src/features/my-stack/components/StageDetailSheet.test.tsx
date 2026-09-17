// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StageDetailSheet } from './StageDetailSheet'

const rechteck = (teile: Partial<DOMRect> = {}): DOMRect => ({
  x: 40, y: 300, left: 40, top: 300, width: 240, height: 240,
  right: 280, bottom: 540, toJSON: () => ({}), ...teile,
} as DOMRect)

function zeichne(teile: Partial<Parameters<typeof StageDetailSheet>[0]> = {}) {
  const onClose = vi.fn()
  const onFlightChange = vi.fn()
  render(
    <StageDetailSheet
      originRect={rechteck()}
      stage={<div data-testid="objekt" />}
      title="Semaglutid"
      subtitle="0,5 mg · morgens"
      onClose={onClose}
      onFlightChange={onFlightChange}
      {...teile}
    >
      <p>Alle Infos</p>
    </StageDetailSheet>,
  )
  return { onClose, onFlightChange }
}

describe('StageDetailSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Das Zielrechteck: kleiner als der Ursprung — das Objekt verkleinert sich.
    Element.prototype.getBoundingClientRect = vi.fn(() => rechteck({
      left: 120, top: 80, width: 96, height: 96,
    })) as unknown as typeof Element.prototype.getBoundingClientRect
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
  })
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })

  it('startet das Objekt dort, wo es angetippt wurde', () => {
    // FLIP: der Startzustand ist die DIFFERENZ zwischen Karussellplatz und
    // Zielstelle. Ohne ihn stünde das Objekt sofort oben und es gäbe gar
    // keine Bewegung.
    zeichne()

    const objekt = document.querySelector('[data-stage-detail-object]') as HTMLElement
    // Ursprung 240 px breit, Ziel 96 px → Faktor 2,5; Versatz 40-120 / 300-80.
    expect(objekt.style.transform).toBe('translate(-80px, 220px) scale(2.5)')
    expect(objekt.style.transformOrigin).toBe('top left')
  })

  it('meldet den Flug an und wieder ab', () => {
    // Währenddessen ist die Flüssigkeitsphysik still — ein schwappendes Vial
    // im Flug wirkt falsch.
    const { onFlightChange } = zeichne()

    expect(onFlightChange).toHaveBeenCalledWith(true)
    act(() => { vi.advanceTimersByTime(400) })
    expect(onFlightChange).toHaveBeenLastCalledWith(false)
  })

  it('zeigt die Angaben erst, wenn das Objekt steht', () => {
    zeichne()
    const koerper = () => document.querySelector('[data-stage-detail-body]')!

    expect(koerper().className).toContain('opacity-0')
    act(() => { vi.advanceTimersByTime(400) })
    expect(koerper().className).toContain('opacity-100')
  })

  it('verzichtet auf den Flug, wenn weniger Bewegung gewünscht ist', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    zeichne()

    const objekt = document.querySelector('[data-stage-detail-object]') as HTMLElement
    expect(objekt.style.transform).toBe('')
    expect(document.querySelector('[data-stage-detail-body]')!.className).toContain('opacity-100')
  })

  it('schließt über den Knopf und über Escape', () => {
    const { onClose } = zeichne()

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('bleibt stehen, wenn die Zielstelle noch keine Größe hat', () => {
    // Ohne diese Zusicherung teilte die Rechnung durch 0 und das Objekt
    // verschwände hinter einer unendlichen Skalierung.
    Element.prototype.getBoundingClientRect = vi.fn(() => rechteck({
      width: 0, height: 0,
    })) as unknown as typeof Element.prototype.getBoundingClientRect
    zeichne()

    const objekt = document.querySelector('[data-stage-detail-object]') as HTMLElement
    expect(objekt.style.transform).toBe('')
    expect(document.querySelector('[data-stage-detail-body]')!.className).toContain('opacity-100')
  })
})
