import { describe, expect, it, vi } from 'vitest'
import {
  LOCAL_DATE_TIME_KEY_CACHE_MAX,
  localDateTimeKey,
  resolveCycleAt,
  resolveCycleAtLocalSlot,
  type CycleTimeline,
  type PlanScheduleSnapshot,
} from './planTimeline'

const schedule = (dose: number): PlanScheduleSnapshot => ({
  frequency: 'Täglich',
  x_days_interval: null,
  interval_unit: null,
  cycle_on_days: null,
  cycle_off_days: null,
  schedule_days: [],
  intake_time: 'morgens,abends',
  intake_time_custom: '08:00,20:00',
  slot_doses: null,
  slot_days: null,
  dose,
  unit: 'mg',
  method: 'Oral',
})

const timeline: CycleTimeline = {
  cycle: {
    id: 'c1',
    stack_item_id: 's1',
    started_at: '2026-09-17T00:00:00Z',
    ended_at: null,
  },
  versions: [
    {
      id: 'v1',
      cycle_id: 'c1',
      effective_kind: 'local_date',
      effective_at: null,
      effective_local_date: '2026-09-18',
      change_kind: 'initial',
      ...schedule(0.25),
    },
    {
      id: 'v2',
      cycle_id: 'c1',
      effective_kind: 'instant',
      effective_at: '2026-09-18T10:00:00Z',
      effective_local_date: null,
      change_kind: 'dose',
      ...schedule(0.5),
    },
  ],
  pauses: [],
}

describe('resolveCycleAt', () => {
  it('distinguishes planned, active, and ended lifecycle boundaries', () => {
    const bounded: CycleTimeline = {
      ...timeline,
      cycle: {
        ...timeline.cycle,
        started_at: '2026-09-18T08:00:00Z',
        ended_at: '2026-09-20T08:00:00Z',
      },
    }

    expect(resolveCycleAt(bounded, new Date('2026-09-18T07:59:59Z'), 'Europe/Berlin').status).toBe('planned')
    expect(resolveCycleAt(bounded, new Date('2026-09-18T08:00:00Z'), 'Europe/Berlin').status).toBe('active')
    expect(resolveCycleAt(bounded, new Date('2026-09-20T08:00:00Z'), 'Europe/Berlin').status).toBe('ended')
  })

  it('uses the old version before and the new version at the exact instant', () => {
    expect(resolveCycleAt(timeline, new Date('2026-09-18T09:59:59Z'), 'Europe/Berlin').planVersion?.id).toBe('v1')
    expect(resolveCycleAt(timeline, new Date('2026-09-18T10:00:00Z'), 'Europe/Berlin').planVersion?.id).toBe('v2')
  })

  it('marks an open pause as paused', () => {
    const paused: CycleTimeline = {
      ...timeline,
      pauses: [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-09-19T08:00:00Z', ends_at: null }],
    }

    const resolved = resolveCycleAt(paused, new Date('2026-09-25T12:00:00Z'), 'Europe/Berlin')
    expect(resolved.status).toBe('paused')
    expect(resolved.pause?.id).toBe('p1')
  })

  it('treats pause periods as half-open intervals', () => {
    const paused: CycleTimeline = {
      ...timeline,
      pauses: [{
        id: 'p1',
        cycle_id: 'c1',
        paused_at: '2026-09-19T08:00:00Z',
        ends_at: '2026-09-20T08:00:00Z',
      }],
    }

    expect(resolveCycleAt(paused, new Date('2026-09-19T08:00:00Z'), 'Europe/Berlin').status).toBe('paused')
    expect(resolveCycleAt(paused, new Date('2026-09-20T08:00:00Z'), 'Europe/Berlin').status).toBe('active')
  })

  it('keeps a local-date boundary on the local calendar date after travel', () => {
    const target = new Date('2026-09-17T23:30:00Z')

    expect(resolveCycleAt(timeline, target, 'Europe/Berlin').planVersion?.id).toBe('v1')
    expect(resolveCycleAt(timeline, target, 'America/New_York').planVersion).toBeNull()
  })

  it('resolves a wall-clock slot without guessing its UTC offset', () => {
    expect(resolveCycleAtLocalSlot(timeline, '2026-09-18', 8 * 60, 'Europe/Berlin').planVersion?.id).toBe('v1')
    expect(resolveCycleAtLocalSlot(timeline, '2026-09-18', 12 * 60, 'Europe/Berlin').planVersion?.id).toBe('v2')
  })
})

describe('localDateTimeKey', () => {
  it('formats an instant in the supplied IANA time zone', () => {
    const instant = new Date('2026-09-18T10:05:06Z')

    expect(localDateTimeKey(instant, 'Europe/Berlin')).toBe('2026-09-18|12:05:06')
    expect(localDateTimeKey(instant, 'America/New_York')).toBe('2026-09-18|06:05:06')
  })

  it('rejects invalid dates and IANA time zones instead of falling back', () => {
    expect(() => localDateTimeKey(new Date('invalid'), 'Europe/Berlin')).toThrow(/invalid date/i)
    expect(() => localDateTimeKey(new Date(), 'Not/A_Zone')).toThrow(/time zone/i)
  })

  // The cache is keyed by an exact instant, so a long session would otherwise
  // grow it without end. The bound is what keeps that from happening, and this
  // is the only way to see it from outside: count the formatting calls.
  it('forgets its oldest entry instead of growing without end', () => {
    const instant = new Date('2031-07-04T09:08:07Z')
    const expected = '2031-07-04|11:08:07'
    const formatToParts = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts')

    try {
      expect(localDateTimeKey(instant, 'Europe/Berlin')).toBe(expected)
      const afterFirst = formatToParts.mock.calls.length

      // A second look at the same instant is a lookup, not a computation.
      expect(localDateTimeKey(instant, 'Europe/Berlin')).toBe(expected)
      expect(formatToParts.mock.calls.length).toBe(afterFirst)

      // Enough distinct instants to push that entry out of the cache.
      for (let step = 1; step <= LOCAL_DATE_TIME_KEY_CACHE_MAX; step += 1) {
        localDateTimeKey(new Date(instant.getTime() + step), 'Europe/Berlin')
      }

      const beforeReturn = formatToParts.mock.calls.length
      expect(localDateTimeKey(instant, 'Europe/Berlin')).toBe(expected)
      expect(formatToParts.mock.calls.length).toBe(beforeReturn + 1)
    } finally {
      formatToParts.mockRestore()
    }
  })
})
