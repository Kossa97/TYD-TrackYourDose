import { describe, expect, it } from 'vitest'
import type { DailyLogEntry, WeightLogEntry } from '../types'
import {
  bodyFatForDate,
  hasLogForDate,
  lastBodyFatBefore,
  lastWeightBefore,
  loadLogFormValues,
  weightForDate,
} from './metricDefaults'

describe('metricDefaults', () => {
  const weightLogs: WeightLogEntry[] = [
    { id: 'w1', logged_at: '2026-07-01T08:00:00', weight_kg: 80 },
    { id: 'w2', logged_at: '2026-07-05T08:00:00', weight_kg: 81.2 },
    { id: 'w3', logged_at: '2026-07-08T09:00:00', weight_kg: 82 },
  ]

  const logs: DailyLogEntry[] = [
    { log_date: '2026-07-03', energie: null, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: 17.5 },
    { log_date: '2026-07-06', energie: 7, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: null },
    { log_date: '2026-07-08', energie: null, schlaf: null, wohlbefinden: null, libido: null, body_fat_pct: null },
  ]

  it('finds weight for exact date', () => {
    expect(weightForDate(weightLogs, '2026-07-08')).toEqual({ kg: 82, id: 'w3' })
  })

  it('returns last weight before date when no same-day entry', () => {
    expect(lastWeightBefore(weightLogs, '2026-07-07')).toBe(81.2)
    expect(lastWeightBefore(weightLogs, '2026-07-01')).toBeNull()
  })

  it('finds body fat for exact date', () => {
    expect(bodyFatForDate(logs, '2026-07-03')).toBe(17.5)
    expect(bodyFatForDate(logs, '2026-07-08')).toBeNull()
  })

  it('returns last body fat before date', () => {
    expect(lastBodyFatBefore(logs, '2026-07-08')).toBe(17.5)
    expect(lastBodyFatBefore(logs, '2026-07-03')).toBeNull()
  })

  it('detects whether a date has any logged entry', () => {
    expect(hasLogForDate(logs, weightLogs, '2026-07-08')).toBe(true)
    expect(hasLogForDate(logs, weightLogs, '2026-07-03')).toBe(true)
    expect(hasLogForDate(logs, weightLogs, '2026-07-06')).toBe(true)
    expect(hasLogForDate(logs, weightLogs, '2026-07-07')).toBe(false)
    expect(hasLogForDate([], [], '2026-07-08')).toBe(false)
  })

  it('loads saved day values when editing, otherwise last known defaults', () => {
    expect(loadLogFormValues(logs, weightLogs, '2026-07-08')).toEqual({
      energie: null,
      schlaf: null,
      wohlbefinden: null,
      libido: null,
      bodyFat: null,
      weight: 82,
      weightRowId: 'w3',
    })

    expect(loadLogFormValues(logs, weightLogs, '2026-07-06')).toEqual({
      energie: 7,
      schlaf: null,
      wohlbefinden: null,
      libido: null,
      bodyFat: null,
      weight: null,
      weightRowId: null,
    })

    expect(loadLogFormValues(logs, weightLogs, '2026-07-07')).toEqual({
      energie: null,
      schlaf: null,
      wohlbefinden: null,
      libido: null,
      bodyFat: 17.5,
      weight: 81.2,
      weightRowId: null,
    })
  })
})
