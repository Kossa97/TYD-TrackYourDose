import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  AMPOULE_FILL,
  AMPOULE_INNER_PATH,
  AMPOULE_LABEL,
  AMPOULE_OUTER_PATH,
  AMPOULE_SPEC,
} from './ampouleShape'

describe('ampouleShape', () => {
  it('closes both contours so they work as fills and as clips', () => {
    expect(AMPOULE_OUTER_PATH.startsWith('M')).toBe(true)
    expect(AMPOULE_OUTER_PATH.trimEnd().endsWith('Z')).toBe(true)
    expect(AMPOULE_INNER_PATH.startsWith('M')).toBe(true)
    expect(AMPOULE_INNER_PATH.trimEnd().endsWith('Z')).toBe(true)
  })

  it('keeps the liquid chamber inside the inner contour', () => {
    const chamber = AMPOULE_SPEC.chamber!

    // inner contour: x 29.4..90.6, floor at y 273.4
    expect(chamber.x).toBeGreaterThanOrEqual(29.4)
    expect(chamber.x + chamber.width).toBeLessThanOrEqual(90.6)
    expect(chamber.y + chamber.height).toBeLessThanOrEqual(273.4)
  })

  it('leaves a glass floor under the liquid rather than ending on the outer edge', () => {
    const chamber = AMPOULE_SPEC.chamber!
    const outerBase = 277

    expect(outerBase - (chamber.y + chamber.height)).toBeGreaterThan(3)
  })

  it('describes a chamber narrower than the vial so the tilt gets damped', () => {
    expect(AMPOULE_SPEC.chamber?.aspect).toBeCloseTo(0.483, 3)
    expect(AMPOULE_SPEC.chamber!.aspect).toBeLessThan(0.794)
  })

  it('has no meaningful fill but does carry our label', () => {
    expect(AMPOULE_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(AMPOULE_SPEC)).toBe(true)
  })

  it('leaves head space under the tip instead of filling to the brim', () => {
    expect(AMPOULE_FILL).toBeGreaterThan(0.8)
    expect(AMPOULE_FILL).toBeLessThan(1)
  })

  it('centres the label on the straight glass body', () => {
    const { viewBox, chamber } = AMPOULE_SPEC
    // the straight body runs from the chamber top to the inner floor
    const bodyTop = (chamber!.y - viewBox.y) / viewBox.height
    const bodyBottom = (273.4 - viewBox.y) / viewBox.height
    const labelCentre = AMPOULE_LABEL.topPct + AMPOULE_LABEL.heightPct / 2

    expect(labelCentre).toBeCloseTo((bodyTop + bodyBottom) / 2, 2)
  })

  it('keeps the label clear of the meniscus and off the base rounding', () => {
    const surfacePct = (152 - 5) / 274
    const roundingPct = (261 - 5) / 274

    expect(AMPOULE_LABEL.topPct).toBeGreaterThan(surfacePct)
    expect(AMPOULE_LABEL.topPct + AMPOULE_LABEL.heightPct).toBeLessThan(roundingPct)
  })
})
