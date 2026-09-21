import { describe, expect, it } from 'vitest'
import { resolveTimelineIntakesForDay as resolveTypeScript } from '../../src/lib/intakeSchedule.ts'
import { dueReminders } from './reminderSchedule.js'

function version(id, overrides = {}) {
  return {
    id, cycle_id: 'c1', effective_kind: 'local_date', effective_at: null,
    effective_local_date: '2026-01-01', change_kind: 'initial', frequency: 'Täglich',
    x_days_interval: null, interval_unit: null, cycle_on_days: null, cycle_off_days: null,
    schedule_days: [], intake_time: 'morgens,abends', intake_time_custom: null,
    slot_doses: '5,6', slot_days: null, dose: 10, unit: 'mg', method: 'oral',
    ...overrides,
  }
}

const timeline = {
  cycle: {
    id: 'c1', stack_item_id: 's1', started_at: '2026-01-01T00:00:00.000Z', ended_at: null,
  },
  versions: [
    version('old'),
    version('new', {
      effective_kind: 'instant', effective_at: '2026-06-29T10:00:00.000Z',
      effective_local_date: null, change_kind: 'dose', slot_doses: '15,16',
      unit: 'ml', method: 'injection',
    }),
  ],
  pauses: [],
}

describe('normalized app/reminder parity', () => {
  it('carries the TypeScript morning occurrence unchanged into a due reminder', () => {
    const appOccurrence = resolveTypeScript(timeline, '2026-06-29', 'Europe/Berlin')[0]
    const reminders = dueReminders(
      timeline,
      'on_time',
      new Date('2026-06-29T06:30:00.000Z'),
      'Europe/Berlin',
      60,
    )

    expect(appOccurrence).toEqual(expect.objectContaining({
      planVersionId: 'old', scheduledAt: '2026-06-29T06:00:00.000Z', dose: 5, unit: 'mg',
    }))
    expect(reminders).toEqual([{ ...appOccurrence, offset: 'on_time' }])
  })

  it('uses the TypeScript DST-fold occurrence once, including its stable identity', () => {
    const foldTimeline = {
      ...timeline,
      versions: [version('fold', { intake_time: 'custom', intake_time_custom: '02:30', slot_doses: null })],
    }
    const appOccurrence = resolveTypeScript(foldTimeline, '2026-10-25', 'Europe/Berlin')[0]
    const reminders = dueReminders(
      foldTimeline,
      'on_time',
      new Date('2026-10-25T00:45:00.000Z'),
      'Europe/Berlin',
      60,
    )

    expect(appOccurrence.routineSlotKey).toBe('c1@2026-10-25T02:30')
    expect(reminders).toEqual([{ ...appOccurrence, offset: 'on_time' }])
  })
})
