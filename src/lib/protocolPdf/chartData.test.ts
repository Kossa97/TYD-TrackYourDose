import { describe, expect, it } from 'vitest'
import {
  averageByWeek,
  isoWeekStartMs,
  prepareLongRangePoints,
  MAX_RAW_CHART_POINTS,
  type ChartPoint,
} from './chartData'
import { buildProtocolPdf } from './renderProtocolPdf'
import type { ProtocolData, PdfBuildOptions } from './types'

function dayMs(iso: string): number {
  return new Date(`${iso}T00:00:00`).getTime()
}

describe('chartData', () => {
  it('isoWeekStartMs mappt auf Montag', () => {
    // 2026-06-10 = Mittwoch → Montag 2026-06-08
    const mon = isoWeekStartMs(dayMs('2026-06-10'))
    const monday = new Date(mon)
    expect(monday.getDay()).toBe(1)
    expect([monday.getFullYear(), monday.getMonth() + 1, monday.getDate()]).toEqual([2026, 6, 8])
  })

  it('averageByWeek mittelt Werte derselben Woche', () => {
    const points: ChartPoint[] = [
      { t: dayMs('2026-06-08'), v: 4 },
      { t: dayMs('2026-06-09'), v: 6 },
      { t: dayMs('2026-06-15'), v: 10 }, // nächste Woche
    ]
    const weeks = averageByWeek(points)
    expect(weeks).toHaveLength(2)
    expect(weeks[0].v).toBe(5)
    expect(weeks[1].v).toBe(10)
  })

  it('prepareLongRangePoints behält kurze Serien roh', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({
      t: dayMs('2026-01-01') + i * 86400000,
      v: 5 + (i % 3),
    }))
    const out = prepareLongRangePoints(points)
    expect(out.weekly).toBe(false)
    expect(out.points).toHaveLength(10)
  })

  it('prepareLongRangePoints aggregiert lange Serien zu Wochenmitteln', () => {
    const points = Array.from({ length: MAX_RAW_CHART_POINTS + 20 }, (_, i) => ({
      t: dayMs('2025-01-01') + i * 86400000,
      v: 5 + (i % 5),
    }))
    const out = prepareLongRangePoints(points)
    expect(out.weekly).toBe(true)
    expect(out.points.length).toBeLessThan(points.length)
    expect(out.points.length).toBeGreaterThan(5)
  })
})

describe('renderWellness long range', () => {
  it('rendert getrennte Charts auch bei vielen Daily-Logs', async () => {
    const dailyLogs = Array.from({ length: 120 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 0, 1 + i))
      const iso = d.toISOString().slice(0, 10)
      return {
        log_date: iso,
        energie: 4 + (i % 6),
        schlaf: 5 + (i % 5),
        libido: 3 + (i % 7),
      }
    })
    const data: ProtocolData = {
      profile: null,
      cycles: [],
      doseLogs: [],
      weightLogs: [],
      bloodwork: [],
      effects: [],
      reviews: [],
      dailyLogs,
      stackItemNames: new Map(),
    }
    const opts: PdfBuildOptions = {
      lang: 'de',
      range: { from: '2025-01-01', to: '2025-04-30' },
      sections: ['wellness'],
      note: '',
      preset: 'coach',
    }
    const doc = await buildProtocolPdf(data, opts)
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2)
    const bytes = doc.output('arraybuffer') as ArrayBuffer
    expect(bytes.byteLength).toBeGreaterThan(2000)
  })
})
