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

import { panViewEnd, clampViewEnd } from './chartMath'

const DAY = 24 * 3_600_000

describe('panViewEnd', () => {
  it('Finger nach rechts (dx>0) verschiebt in die Vergangenheit (kleineres viewEnd)', () => {
    expect(panViewEnd(1000, 100, 200, 200)).toBeCloseTo(900)
  })
  it('Finger nach links (dx<0) verschiebt Richtung jetzt (größeres viewEnd)', () => {
    expect(panViewEnd(1000, -100, 200, 200)).toBeCloseTo(1100)
  })
  it('ohne Breite unverändert', () => {
    expect(panViewEnd(1000, 100, 0, 200)).toBe(1000)
  })
})

describe('clampViewEnd', () => {
  const dataStart = 0
  const now = 10 * DAY
  const win = 7 * DAY
  it('klemmt nicht über jetzt hinaus', () => {
    expect(clampViewEnd(now + DAY, dataStart, now, win)).toBe(now)
  })
  it('klemmt nicht vor das erste Datum + Fenster', () => {
    expect(clampViewEnd(0, dataStart, now, win)).toBe(dataStart + win)
  })
  it('lässt Werte im Bereich unverändert', () => {
    expect(clampViewEnd(8 * DAY, dataStart, now, win)).toBe(8 * DAY)
  })
  it('bei zu wenig Daten ist jetzt die einzige Position', () => {
    expect(clampViewEnd(5 * DAY, dataStart, 3 * DAY, win)).toBe(3 * DAY)
  })
})

import { pickDayTicks } from './chartMath'

describe('pickDayTicks', () => {
  it('tägliche Ticks wenn genug Platz', () => {
    const ticks = pickDayTicks(0, 7 * DAY, 700, 56)
    expect(ticks).toEqual([0, DAY, 2 * DAY, 3 * DAY, 4 * DAY, 5 * DAY, 6 * DAY, 7 * DAY])
  })
  it('gröbere Ticks wenn wenig Platz (kein Überlappen)', () => {
    const ticks = pickDayTicks(0, 7 * DAY, 140, 56)
    expect(ticks).toEqual([0, 4 * DAY])
  })
  it('leeres Array bei ungültigem Bereich', () => {
    expect(pickDayTicks(10, 10, 700, 56)).toEqual([])
    expect(pickDayTicks(0, 7 * DAY, 0, 56)).toEqual([])
  })
})
