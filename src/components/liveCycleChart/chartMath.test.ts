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

import { pickNiceTicks } from './chartMath'

describe('pickNiceTicks', () => {
  it('grobe, runde Schritte bei großem Bereich (kein Überlappen)', () => {
    // 0..840h, breit: maxTicks=25, rawStep=33.6 → nice 50
    expect(pickNiceTicks(0, 840, 1800, 70)).toEqual([
      0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800,
    ])
  })
  it('feine Schritte bei kleinem Bereich', () => {
    // 0..20h, breit: rawStep≈0.8 → nice 1
    expect(pickNiceTicks(0, 20, 1800, 70)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ])
  })
  it('wenig Platz → wenige Ticks', () => {
    expect(pickNiceTicks(0, 100, 140, 70)).toEqual([0, 50, 100])
  })
  it('leeres Array bei ungültigem Bereich', () => {
    expect(pickNiceTicks(5, 5, 700, 70)).toEqual([])
    expect(pickNiceTicks(0, 100, 0, 70)).toEqual([])
  })
})

import {
  pickSixHourScrollingTicks,
  pickChartTimeTicks,
  pickWindowTimeTicks,
  panHapticStepMs,
  LIVE_CHART_WINDOW_MS_MOBILE,
} from './chartMath'

const HOUR = 3_600_000
const SIX_HOUR = 6 * HOUR

function tickX(ts: number, viewStart: number, win: number, width = 300): number {
  return ((ts - viewStart) / win) * width
}

describe('pickSixHourScrollingTicks', () => {
  it('liefert 6h-Abstände im sichtbaren Fenster', () => {
    const viewEnd = Date.UTC(2024, 5, 3, 18, 0, 0)
    const viewStart = viewEnd - LIVE_CHART_WINDOW_MS_MOBILE
    const ticks = pickSixHourScrollingTicks(viewStart, viewEnd)
    expect(ticks.length).toBeGreaterThanOrEqual(4)
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i] - ticks[i - 1]).toBe(SIX_HOUR)
    }
    for (const t of ticks) {
      expect(t).toBeGreaterThanOrEqual(viewStart)
      expect(t).toBeLessThanOrEqual(viewEnd)
    }
  })

  it('verschiebt Tick-Positionen auf dem Screen beim Wischen', () => {
    const viewEnd = Date.UTC(2024, 5, 3, 18, 0, 0)
    const viewStart1 = viewEnd - LIVE_CHART_WINDOW_MS_MOBILE
    const viewStart2 = viewStart1 + 3 * HOUR
    const ticks1 = pickSixHourScrollingTicks(viewStart1, viewEnd)
    const ticks2 = pickSixHourScrollingTicks(viewStart2, viewEnd)
    const shared = ticks1.filter(t => t >= viewStart2)
    expect(shared.length).toBeGreaterThan(0)
    const t = shared[0]
    expect(tickX(t, viewStart1, LIVE_CHART_WINDOW_MS_MOBILE)).not.toBeCloseTo(
      tickX(t, viewStart2, LIVE_CHART_WINDOW_MS_MOBILE),
    )
    // Viewport-relative Ticks bleiben dagegen an festen Bildschirmpositionen
    const w1 = pickWindowTimeTicks(viewStart1, viewEnd, 300, 56)
    const w2 = pickWindowTimeTicks(viewStart2, viewEnd, 300, 56)
    expect(tickX(w1[0], viewStart1, LIVE_CHART_WINDOW_MS_MOBILE)).toBeCloseTo(0)
    expect(tickX(w2[0], viewStart2, LIVE_CHART_WINDOW_MS_MOBILE)).toBeCloseTo(0)
  })
})

describe('pickChartTimeTicks (24h mobil)', () => {
  it('nutzt 6h-Scroll-Raster für 24h-Fenster', () => {
    const viewEnd = Date.UTC(2024, 5, 3, 12, 0, 0)
    const viewStart = viewEnd - LIVE_CHART_WINDOW_MS_MOBILE
    expect(pickChartTimeTicks(viewStart, viewEnd, 300, 56)).toEqual(
      pickSixHourScrollingTicks(viewStart, viewEnd),
    )
  })

  it('panHapticStepMs ist 6h im 24h-Fenster', () => {
    const viewEnd = Date.UTC(2024, 5, 3, 12, 0, 0)
    const viewStart = viewEnd - LIVE_CHART_WINDOW_MS_MOBILE
    expect(panHapticStepMs(viewStart, viewEnd, 300, 56)).toBe(SIX_HOUR)
  })
})
