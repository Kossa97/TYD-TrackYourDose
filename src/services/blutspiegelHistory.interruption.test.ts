import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateHistoryBlutspiegelCurve, splitQuantifiedDoseHistory } from './blutspiegelHistory'

function log(timestamp: string, taken: boolean, dose: number | null, unit: string | null) {
  return { timestamp, taken, dose, unit }
}

describe('splitQuantifiedDoseHistory', () => {
  it('cuts the quantified series at a taken log with unknown quantity', () => {
    const result = splitQuantifiedDoseHistory([
      log('2026-07-20', true, 5, 'mg'),
      log('2026-07-21', true, null, null),
      log('2026-07-22', true, 5, 'mg'),
    ])

    expect(result.events.map(event => event.timestamp)).toEqual(['2026-07-20'])
    expect(result.events.map(event => ({ dose: event.dose, unit: event.unit }))).toEqual([
      { dose: 5, unit: 'mg' },
    ])
    expect(result.interruptedAt).toBe('2026-07-21')
  })

  it('does not interrupt for a skipped log', () => {
    const result = splitQuantifiedDoseHistory([
      log('2026-07-20', false, null, null),
      log('2026-07-21', true, 5, 'mg'),
    ])

    expect(result.events.map(event => event.timestamp)).toEqual(['2026-07-21'])
    expect(result.interruptedAt).toBeNull()
  })

  it('keeps the quantified dose paired with its recorded unit', () => {
    const result = splitQuantifiedDoseHistory([
      log('2026-07-20', true, 500, 'mcg'),
      log('2026-07-21', true, 1, 'mg'),
    ])

    expect(result.events.map(event => [event.dose, event.unit])).toEqual([
      [500, 'mcg'],
      [1, 'mg'],
    ])
  })
})

describe('calculateHistoryBlutspiegelCurve interruption', () => {
  afterEach(() => vi.useRealTimers())

  it('marks projections after the latest quantified event as planned', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T04:00:00.000Z'))

    const curve = calculateHistoryBlutspiegelCurve([{
      timestamp: new Date('2026-07-20T00:00:00.000Z'),
      dose: 1,
      unit: 'mg',
      status: 'taken',
    }], 4, 1, 1, 60)

    expect(curve[0].status).toBe('actual')
    expect(curve.slice(1).every(point => point.status === 'planned')).toBe(true)
  })

  it('does not emit a point at or beyond the interruption timestamp', () => {
    const interruptedAt = new Date('2026-07-20T03:00:00.000Z')
    const curve = calculateHistoryBlutspiegelCurve([{
      timestamp: new Date('2026-07-20T00:00:00.000Z'),
      dose: 1,
      unit: 'mg',
      status: 'taken',
    }], 4, 1, 1, 60, interruptedAt)

    expect(curve.map(point => point.time.toISOString())).toEqual([
      '2026-07-20T00:00:00.000Z',
      '2026-07-20T01:00:00.000Z',
      '2026-07-20T02:00:00.000Z',
    ])
  })
})
