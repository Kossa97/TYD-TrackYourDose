import { describe, expect, it } from 'vitest'
import {
  cycleStartsAtHover,
  cycleStartsNearCursor,
  hoverDateIso,
  resolveTooltipCycleStarts,
} from './chartTooltip'

describe('chartTooltip', () => {
  const bands = [
    { id: 'a', startDate: '2026-01-23', x1: Date.parse('2026-01-23T12:00:00') },
    { id: 'b', startDate: '2026-01-23', x1: Date.parse('2026-01-23T12:00:00') },
    { id: 'c', startDate: '2026-02-15', x1: Date.parse('2026-02-15T12:00:00') },
  ]

  it('finds overlapping cycle starts on the same day', () => {
    const starts = cycleStartsAtHover(bands, '2026-01-23')
    expect(starts.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('finds a single cycle start by hover timestamp', () => {
    const hoverTs = Date.parse('2026-02-15T12:00:00')
    const starts = cycleStartsAtHover(bands, hoverDateIso(hoverTs), hoverTs)
    expect(starts.map(s => s.id)).toEqual(['c'])
  })

  it('matches visible bar start when clipped to range', () => {
    const clipped = [{ id: 'd', startDate: '2026-01-01', x1: Date.parse('2026-02-15T12:00:00') }]
    const starts = cycleStartsAtHover(clipped, '2026-02-15')
    expect(starts.map(s => s.id)).toEqual(['d'])
  })

  it('finds cycle starts near cursor x position', () => {
    const xScale = (value: number) => (value === bands[0].x1 ? 40 : 200)
    const plotArea = { x: 10 }
    const starts = cycleStartsNearCursor(bands, 50, xScale, plotArea, 14)
    expect(starts.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('merges date and cursor matches without duplicates', () => {
    const xScale = (value: number) => (value === bands[2].x1 ? 100 : 0)
    const plotArea = { x: 0 }
    const starts = resolveTooltipCycleStarts({
      bands,
      dateIso: '2026-02-15',
      hoverTs: bands[2].x1,
      cursorX: 100,
      xScale,
      plotArea,
    })
    expect(starts.map(s => s.id)).toEqual(['c'])
  })
})
