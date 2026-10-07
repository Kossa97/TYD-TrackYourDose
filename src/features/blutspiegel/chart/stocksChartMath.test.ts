import { describe, expect, it } from 'vitest'
import {
  indexAtOrBefore,
  levelAt,
  niceYDomain,
  rangeBounds,
  timeStep,
  timeTicks,
  visibleSlice,
  yDomainFor,
} from './stocksChartMath'

const H = 3_600_000
const D = 24 * H
const NOW = new Date('2026-10-07T12:00:00').getTime()

describe('stocksChartMath', () => {
  it('endet jeden Zeitraum bei jetzt und beginnt nicht vor dem Verlauf', () => {
    expect(rangeBounds('1d', NOW, NOW - 30 * D)).toEqual({ start: NOW - D, end: NOW })
    expect(rangeBounds('1w', NOW, NOW - 3 * D)).toEqual({ start: NOW - 3 * D, end: NOW })
    expect(rangeBounds('cycle', NOW, NOW - 40 * D)).toEqual({ start: NOW - 40 * D, end: NOW })
    // Verlauf erst seit Minuten: mindestens eine Stunde Fenster
    expect(rangeBounds('1m', NOW, NOW - 60_000).start).toBe(NOW - H)
  })

  it('findet und interpoliert Punkte', () => {
    const pts = [{ ts: 0, level: 0 }, { ts: 10, level: 100 }, { ts: 20, level: 50 }]
    expect(indexAtOrBefore(pts, -1)).toBe(-1)
    expect(indexAtOrBefore(pts, 15)).toBe(1)
    expect(levelAt(pts, 5)).toBe(50)
    expect(levelAt(pts, 25)).toBeNull()
    expect(visibleSlice(pts, 12, 14)).toEqual([pts[1], pts[2]])
  })

  it('skaliert Y auf den sichtbaren Ausschnitt mit runden Schritten', () => {
    const d = niceYDomain(62, 81)
    expect(d.lo).toBeLessThanOrEqual(62)
    expect(d.hi).toBeGreaterThanOrEqual(81)
    expect(d.lo).toBeGreaterThan(40)
    expect(d.ticks[0]).toBe(d.lo)
    expect(d.ticks[d.ticks.length - 1]).toBe(d.hi)
    expect(niceYDomain(0, 0.3).lo).toBe(0)
    // nie ueber 100, wenn der Spiegel 100 nicht ueberschreitet
    expect(niceYDomain(0, 100).hi).toBe(100)
    expect(niceYDomain(20, 99).hi).toBe(100)
    // flache Kurve wird nicht zum Gebirge
    const flat = niceYDomain(50, 50.1)
    expect(flat.hi - flat.lo).toBeGreaterThanOrEqual(2)
  })

  it('nimmt fuer Y nur den sichtbaren Ausschnitt', () => {
    const pts = [{ ts: 0, level: 100 }, { ts: 10 * H, level: 40 }, { ts: 20 * H, level: 30 }]
    const d = yDomainFor(pts, 12 * H, 20 * H)
    expect(d.hi).toBeLessThan(60)
  })

  it('legt Zeit-Ticks auf lokale Stunden bzw. Mitternacht', () => {
    expect(timeStep(NOW - D, NOW, 360)).toBe(6 * H)
    const ticks = timeTicks(NOW - D, NOW, 6 * H)
    expect(ticks.every(t => new Date(t).getHours() % 6 === 0 && new Date(t).getMinutes() === 0)).toBe(true)
    const days = timeTicks(NOW - 7 * D, NOW, D)
    expect(days).toHaveLength(7)
    expect(days.every(t => new Date(t).getHours() === 0)).toBe(true)
  })
})
