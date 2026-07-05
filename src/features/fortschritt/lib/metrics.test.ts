import { describe, expect, it } from 'vitest'
import {
  computeDelta,
  computeTopChanges,
  passesThreshold,
  wellnessAverage,
} from './metrics'
import type { BloodworkEntry, DailyLogEntry, WeightLogEntry } from '../types'

const range = { from: '2026-05-01', to: '2026-07-03' }

describe('computeDelta', () => {
  it('returns null with fewer than 3 points', () => {
    expect(computeDelta([{ date: '2026-06-01', value: 80 }])).toBeNull()
    expect(computeDelta([
      { date: '2026-06-01', value: 80 },
      { date: '2026-06-02', value: 81 },
    ])).toBeNull()
  })

  it('computes delta from first to last point', () => {
    const result = computeDelta([
      { date: '2026-06-01', value: 84.2 },
      { date: '2026-06-15', value: 83 },
      { date: '2026-07-01', value: 82.1 },
    ])
    expect(result).toEqual({ from: 84.2, to: 82.1, delta: -2.1 })
  })
})

describe('passesThreshold', () => {
  it('respects weight threshold', () => {
    expect(passesThreshold('weight', 0.2, 80)).toBe(false)
    expect(passesThreshold('weight', -0.4, 80)).toBe(true)
  })

  it('respects wellness threshold', () => {
    expect(passesThreshold('energie', 0.3, 5)).toBe(false)
    expect(passesThreshold('energie', 0.6, 5)).toBe(true)
  })
})

describe('computeTopChanges', () => {
  const weights: WeightLogEntry[] = [
    { logged_at: '2026-06-01T08:00:00Z', weight_kg: 84.2 },
    { logged_at: '2026-06-10T08:00:00Z', weight_kg: 83.5 },
    { logged_at: '2026-06-20T08:00:00Z', weight_kg: 82.1 },
  ]

  const dailyLogs: DailyLogEntry[] = [
    { log_date: '2026-06-01', energie: 5.2, schlaf: 6, wohlbefinden: 5.5, libido: 5, body_fat_pct: null },
    { log_date: '2026-06-10', energie: 6.5, schlaf: 6.2, wohlbefinden: 6, libido: 5.5, body_fat_pct: null },
    { log_date: '2026-06-20', energie: 7.8, schlaf: 6.3, wohlbefinden: 6.5, libido: 5.6, body_fat_pct: null },
  ]

  const bloodwork: BloodworkEntry[] = [
    { id: '1', marker: 'IGF-1', value: 142, unit: 'ng/mL', tested_at: '2026-06-01' },
    { id: '2', marker: 'IGF-1', value: 170, unit: 'ng/mL', tested_at: '2026-06-20' },
    { id: '3', marker: 'IGF-1', value: 198, unit: 'ng/mL', tested_at: '2026-07-01' },
  ]

  it('returns at most 3 changes above threshold', () => {
    const changes = computeTopChanges(range, weights, dailyLogs, bloodwork)
    expect(changes.length).toBeLessThanOrEqual(3)
    expect(changes.length).toBeGreaterThan(0)
    expect(changes.some(c => c.label === 'Gewicht')).toBe(true)
    expect(changes.some(c => c.label === 'Energie')).toBe(true)
  })

  it('returns empty when nothing moves enough', () => {
    const flatLogs: DailyLogEntry[] = [
      { log_date: '2026-06-01', energie: 7, schlaf: 7, wohlbefinden: 7, libido: 7, body_fat_pct: null },
      { log_date: '2026-06-10', energie: 7.1, schlaf: 7, wohlbefinden: 7, libido: 7, body_fat_pct: null },
      { log_date: '2026-06-20', energie: 7.1, schlaf: 7.05, wohlbefinden: 7, libido: 7, body_fat_pct: null },
    ]
    const changes = computeTopChanges(range, [], flatLogs, [])
    expect(changes).toHaveLength(0)
  })
})

describe('wellnessAverage', () => {
  it('averages daily wellness scores in range', () => {
    const logs: DailyLogEntry[] = [
      { log_date: '2026-06-01', energie: 6, schlaf: 8, wohlbefinden: 7, libido: 5, body_fat_pct: null },
      { log_date: '2026-06-02', energie: 8, schlaf: 6, wohlbefinden: 7, libido: 7, body_fat_pct: null },
    ]
    expect(wellnessAverage(logs, { from: '2026-06-01', to: '2026-06-02' })).toBe(6.8)
  })
})
