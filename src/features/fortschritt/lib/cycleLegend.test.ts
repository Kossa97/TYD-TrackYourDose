import { describe, expect, test } from 'vitest'
import type { CycleSubstance, OngoingSubstance } from '../types'
import { buildCycleLegendItems } from './cycleLegend'

function cycle(overrides: Partial<CycleSubstance>): CycleSubstance {
  return {
    id: 'cycle-1',
    name: 'BPC-157',
    mode: 'cycle',
    startDate: '2026-01-01',
    endDate: '2026-01-14',
    active: false,
    color: '#06b6d4',
    peptideId: 'p1',
    ...overrides,
  }
}

function ongoing(overrides: Partial<OngoingSubstance>): OngoingSubstance {
  return {
    id: 'ongoing-1',
    name: 'CJC-1295',
    mode: 'ongoing',
    startDate: '2026-02-01',
    color: '#a855f7',
    ...overrides,
  }
}

describe('buildCycleLegendItems', () => {
  test('includes every selected substance even when its bar is outside the current window', () => {
    const items = buildCycleLegendItems(
      [cycle({ id: 'outside-window', name: 'BPC-157' })],
      [ongoing({ id: 'visible-now' })],
    )

    expect(items).toEqual([
      { name: 'BPC-157', color: '#06b6d4', filled: true },
      { name: 'CJC-1295', color: '#a855f7', filled: false },
    ])
  })
})
