import { describe, expect, it } from 'vitest'
import { MAX_EDGE, targetSize } from './imageResize'

describe('targetSize', () => {
  it('lässt kleine Bilder unverändert', () => {
    expect(targetSize(800, 600)).toEqual({ width: 800, height: 600 })
  })

  it('lässt ein Bild genau auf der Grenze unverändert', () => {
    expect(targetSize(MAX_EDGE, 400)).toEqual({ width: MAX_EDGE, height: 400 })
  })

  it('skaliert ein breites Bild auf die maximale Kante', () => {
    expect(targetSize(4000, 2000)).toEqual({ width: MAX_EDGE, height: MAX_EDGE / 2 })
  })

  it('skaliert ein hohes Bild auf die maximale Kante', () => {
    expect(targetSize(2000, 4000)).toEqual({ width: MAX_EDGE / 2, height: MAX_EDGE })
  })

  it('rundet auf ganze Pixel', () => {
    const size = targetSize(3000, 1777)
    expect(Number.isInteger(size.width)).toBe(true)
    expect(Number.isInteger(size.height)).toBe(true)
  })

  it('erhält das Seitenverhältnis', () => {
    const size = targetSize(4000, 3000)
    expect(size.width / size.height).toBeCloseTo(4 / 3, 2)
  })
})
