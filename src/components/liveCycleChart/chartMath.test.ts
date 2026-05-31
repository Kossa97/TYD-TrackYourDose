import { describe, it, expect } from 'vitest'
import { lerpLevel, type ChartPoint } from './chartMath'

const pts: ChartPoint[] = [
  { ts: 0, level: 0 },
  { ts: 10, level: 100 },
  { ts: 20, level: 50 },
]

describe('lerpLevel', () => {
  it('interpoliert zwischen zwei Punkten', () => {
    expect(lerpLevel(pts, 5)).toBeCloseTo(50)
    expect(lerpLevel(pts, 15)).toBeCloseTo(75)
  })
  it('liefert exakte Werte an Stützstellen', () => {
    expect(lerpLevel(pts, 10)).toBeCloseTo(100)
  })
  it('klemmt außerhalb des Bereichs', () => {
    expect(lerpLevel(pts, -5)).toBeCloseTo(0)
    expect(lerpLevel(pts, 99)).toBeCloseTo(50)
  })
  it('gibt 0 bei leerer Liste', () => {
    expect(lerpLevel([], 5)).toBe(0)
  })
})
