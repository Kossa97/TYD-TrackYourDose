import { describe, it, expect } from 'vitest'
import {
  CHART_WINDOWS,
  DEFAULT_CHART_WINDOW,
  windowMsFor,
  rangeBounds,
} from './chartWindow'

const DAY = 24 * 3_600_000

describe('CHART_WINDOWS', () => {
  it('bietet genau 30T und 3M', () => {
    expect(CHART_WINDOWS.map(w => w.key)).toEqual(['30t', '3m'])
    expect(CHART_WINDOWS.map(w => w.label)).toEqual(['30T', '3M'])
  })

  it('Default ist 3M', () => {
    expect(DEFAULT_CHART_WINDOW).toBe('3m')
  })
})

describe('windowMsFor', () => {
  it('30T sind 30 Tage', () => {
    expect(windowMsFor('30t')).toBe(30 * DAY)
  })

  it('3M sind 90 Tage', () => {
    expect(windowMsFor('3m')).toBe(90 * DAY)
  })
})

describe('rangeBounds', () => {
  it('wandelt from/to in Timestamps um', () => {
    const { start, now } = rangeBounds({ from: '2026-01-01', to: '2026-01-31' })
    expect(now - start).toBe(30 * DAY)
  })

  it('klemmt now nicht unter start', () => {
    const { start, now } = rangeBounds({ from: '2026-02-01', to: '2026-01-01' })
    expect(now).toBe(start)
  })

  it('faellt bei kaputtem Datum auf einen gueltigen Bereich zurueck', () => {
    const { start, now } = rangeBounds({ from: 'quatsch', to: 'quatsch' })
    expect(Number.isFinite(start)).toBe(true)
    expect(now).toBeGreaterThanOrEqual(start)
  })
})
