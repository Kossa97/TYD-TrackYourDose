import { describe, expect, it } from 'vitest'
import {
  buildSnapAnchors,
  buildTooltipSnapDates,
  cycleStartsAtHover,
  hoverDateIso,
  metricValueAtDate,
  nearestSnapHoverDate,
  resolveFluidChartHover,
  resolveFluidCursorX,
  resolveTooltipCycleStarts,
} from './chartTooltip'

describe('chartTooltip', () => {
  const bands = [
    { id: 'a', startDate: '2026-01-23', x1: Date.parse('2026-01-23T12:00:00') },
    { id: 'b', startDate: '2026-01-23', x1: Date.parse('2026-01-23T12:00:00') },
    { id: 'c', startDate: '2026-04-12', x1: Date.parse('2026-04-12T12:00:00') },
  ]

  const chartData = [
    { date: '2026-02-15', value: 87 },
    { date: '2026-04-12', value: 84 },
  ]

  it('finds overlapping cycle starts on the same day', () => {
    const starts = cycleStartsAtHover(bands, '2026-01-23')
    expect(starts.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('resolves cursor date from inverse scale', () => {
    const aprilTs = Date.parse('2026-04-12T12:00:00')
    const xScale = (value: number) => {
      if (value === aprilTs) return 120
      return 0
    }
    const plotArea = { x: 10 }
    const snap = nearestSnapHoverDate(130, ['2026-04-12'], xScale, plotArea)
    expect(snap?.dateIso).toBe('2026-04-12')
  })

  it('reads metric value for cursor date, not another day', () => {
    expect(metricValueAtDate(chartData, '2026-04-12')).toBe(84)
    expect(metricValueAtDate(chartData, '2026-02-15')).toBe(87)
  })

  it('tooltip cycle starts use only the cursor date', () => {
    const starts = resolveTooltipCycleStarts(bands, '2026-04-12', Date.parse('2026-04-12T12:00:00'))
    expect(starts.map(s => s.id)).toEqual(['c'])
  })

  it('merges metric dates with visible cycle start dates', () => {
    const dates = buildTooltipSnapDates(
      ['2026-02-15', '2026-04-12'],
      [
        { x1: Date.parse('2026-01-23T12:00:00'), startDate: '2026-01-23' },
        { x1: Date.parse('2026-04-12T12:00:00'), startDate: '2026-04-12' },
      ],
    )
    expect(dates).toEqual(['2026-01-23', '2026-02-15', '2026-04-12'])
  })

  it('keeps cursor free far from anchors and blends near snap points', () => {
    const xScale = (value: number) => {
      if (value === Date.parse('2026-02-15T12:00:00')) return 40
      if (value === Date.parse('2026-04-12T12:00:00')) return 120
      return 0
    }
    const plotArea = { x: 10 }
    const anchors = buildSnapAnchors(['2026-02-15', '2026-04-12'], xScale, plotArea)

    const free = resolveFluidCursorX(95, anchors)
    expect(free.x).toBe(95)
    expect(free.snapStrength).toBe(0)

    const snapped = resolveFluidCursorX(58, anchors)
    expect(snapped.x).toBeGreaterThan(50)
    expect(snapped.x).toBeLessThan(58)
    expect(snapped.snapStrength).toBeGreaterThan(0)
  })

  it('resolves fluid hover with inverse scale between snap points', () => {
    const febTs = Date.parse('2026-02-15T12:00:00')
    const aprilTs = Date.parse('2026-04-12T12:00:00')
    const xScale = (value: number) => {
      if (value === febTs) return 40
      if (value === aprilTs) return 120
      return 0
    }
    const xInverseScale = (pixelX: number) => febTs + ((pixelX - 50) / 70) * (aprilTs - febTs)
    const plotArea = { x: 10 }
    const hover = resolveFluidChartHover(
      95,
      ['2026-02-15', '2026-04-12'],
      xScale,
      xInverseScale,
      plotArea,
    )

    expect(hover?.fluidX).toBe(95)
    expect(hover?.snapStrength).toBe(0)
    expect(hover?.dateIso).toMatch(/^2026-03/)
  })

  it('snaps hover to nearest cycle or metric date by pixel distance', () => {
    const aprilTs = Date.parse('2026-04-12T12:00:00')
    const febTs = Date.parse('2026-02-15T12:00:00')
    const xScale = (value: number) => {
      if (value === aprilTs) return 120
      if (value === febTs) return 40
      return 0
    }
    const plotArea = { x: 10 }
    const snap = nearestSnapHoverDate(55, ['2026-02-15', '2026-04-12'], xScale, plotArea)
    expect(snap?.dateIso).toBe('2026-02-15')
  })
})
