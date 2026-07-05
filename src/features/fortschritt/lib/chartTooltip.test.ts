import { describe, expect, it } from 'vitest'
import {
  buildTooltipSnapDates,
  cycleStartsAtHover,
  cycleStartsNearCursor,
  hoverDateIso,
  metricValueAtDate,
  resolveCursorHoverDate,
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
    const xInverse = (x: number) => (x === 120 ? aprilTs : 0)
    const hover = resolveCursorHoverDate(120, xInverse)
    expect(hover?.dateIso).toBe('2026-04-12')
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
      [{ x1: Date.parse('2026-01-23T12:00:00') }, { x1: Date.parse('2026-04-12T12:00:00') }],
    )
    expect(dates).toEqual(['2026-01-23', '2026-02-15', '2026-04-12'])
  })
})
