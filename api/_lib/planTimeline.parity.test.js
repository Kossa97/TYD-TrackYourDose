import { describe, expect, it } from 'vitest'
import {
  resolveCycleAt as resolveCycleAtNode,
  resolveTimelineIntakesForDay as resolveIntakesNode,
} from './planTimeline.js'
import { resolveCycleAt as resolveCycleAtTypeScript } from '../../src/lib/planTimeline.ts'
import { resolveTimelineIntakesForDay as resolveIntakesTypeScript } from '../../src/lib/intakeSchedule.ts'

function version(id, overrides = {}) {
  return {
    id,
    cycle_id: 'c1',
    effective_kind: 'local_date',
    effective_at: null,
    effective_local_date: '2026-01-01',
    change_kind: 'initial',
    frequency: 'Täglich',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
    intake_time: 'morgens',
    intake_time_custom: null,
    slot_doses: null,
    slot_days: null,
    dose: 10,
    unit: 'mg',
    method: 'oral',
    ...overrides,
  }
}

function timeline({ versions = [version('v1')], pauses = [], cycle = {} } = {}) {
  return {
    cycle: {
      id: 'c1',
      stack_item_id: 's1',
      started_at: '2026-01-01T00:00:00.000Z',
      ended_at: null,
      ...cycle,
    },
    versions,
    pauses,
  }
}

function summary(intakes) {
  return intakes.map(intake => ({
    cycleId: intake.cycleId,
    stackItemId: intake.stackItemId,
    planVersionId: intake.planVersionId,
    scheduledAt: intake.scheduledAt,
    routineSlotKey: intake.routineSlotKey,
    slotKey: intake.slotKey,
    localDate: intake.localDate,
    time: intake.time,
    minutes: intake.minutes,
    dose: intake.dose,
    unit: intake.unit,
    method: intake.method,
  }))
}

const CASES = [
  {
    name: 'local-date boundary selects the new snapshot',
    localDate: '2026-06-15',
    timeZone: 'Europe/Berlin',
    timeline: timeline({ versions: [
      version('old'),
      version('new', { effective_local_date: '2026-06-15', dose: 20 }),
    ] }),
    expected: [{
      cycleId: 'c1', stackItemId: 's1', planVersionId: 'new',
      scheduledAt: '2026-06-15T06:00:00.000Z',
      routineSlotKey: 'c1@2026-06-15T06:00:00.000Z', slotKey: 'morgens',
      localDate: '2026-06-15', time: '08:00', minutes: 480,
      dose: 20, unit: 'mg', method: 'oral',
    }],
  },
  {
    name: 'noon instant change keeps morning old and evening new',
    localDate: '2026-06-15',
    timeZone: 'Europe/Berlin',
    timeline: timeline({ versions: [
      version('old', { intake_time: 'morgens,abends', slot_doses: '5,6' }),
      version('new', {
        effective_kind: 'instant', effective_at: '2026-06-15T10:00:00.000Z',
        effective_local_date: null, change_kind: 'dose', intake_time: 'morgens,abends',
        slot_doses: '15,16', dose: 20, unit: 'ml', method: 'injection',
      }),
    ] }),
    expected: [
      {
        cycleId: 'c1', stackItemId: 's1', planVersionId: 'old',
        scheduledAt: '2026-06-15T06:00:00.000Z',
        routineSlotKey: 'c1@2026-06-15T06:00:00.000Z', slotKey: 'morgens',
        localDate: '2026-06-15', time: '08:00', minutes: 480,
        dose: 5, unit: 'mg', method: 'oral',
      },
      {
        cycleId: 'c1', stackItemId: 's1', planVersionId: 'new',
        scheduledAt: '2026-06-15T18:00:00.000Z',
        routineSlotKey: 'c1@2026-06-15T18:00:00.000Z', slotKey: 'abends',
        localDate: '2026-06-15', time: '20:00', minutes: 1200,
        dose: 16, unit: 'ml', method: 'injection',
      },
    ],
  },
  {
    name: 'open pause suppresses every later occurrence',
    localDate: '2026-06-15',
    timeZone: 'Europe/Berlin',
    timeline: timeline({
      versions: [version('v1', { intake_time: 'morgens,abends' })],
      pauses: [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-06-15T05:00:00.000Z', ends_at: null }],
    }),
    expected: [],
  },
  {
    name: 'scheduled pause end is half-open',
    localDate: '2026-06-15',
    timeZone: 'Europe/Berlin',
    timeline: timeline({
      versions: [version('v1', { intake_time: 'morgens,abends' })],
      pauses: [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-06-15T05:00:00.000Z', ends_at: '2026-06-15T10:00:00.000Z' }],
    }),
    expected: [{
      cycleId: 'c1', stackItemId: 's1', planVersionId: 'v1',
      scheduledAt: '2026-06-15T18:00:00.000Z',
      routineSlotKey: 'c1@2026-06-15T18:00:00.000Z', slotKey: 'abends',
      localDate: '2026-06-15', time: '20:00', minutes: 1200,
      dose: 10, unit: 'mg', method: 'oral',
    }],
  },
  {
    name: 'PRN produces no normalized automatic occurrence',
    localDate: '2026-06-15',
    timeZone: 'Europe/Berlin',
    timeline: timeline({ versions: [version('prn', { frequency: 'Bei Bedarf' })] }),
    expected: [],
  },
  {
    name: 'Berlin preserves a custom wall-clock time',
    localDate: '2026-06-15',
    timeZone: 'Europe/Berlin',
    timeline: timeline({ versions: [version('berlin', { intake_time: 'custom', intake_time_custom: '08:15' })] }),
    expected: [{
      cycleId: 'c1', stackItemId: 's1', planVersionId: 'berlin',
      scheduledAt: '2026-06-15T06:15:00.000Z',
      routineSlotKey: 'c1@2026-06-15T06:15:00.000Z', slotKey: 'custom',
      localDate: '2026-06-15', time: '08:15', minutes: 495,
      dose: 10, unit: 'mg', method: 'oral',
    }],
  },
  {
    name: 'New York preserves the same custom wall-clock time',
    localDate: '2026-06-15',
    timeZone: 'America/New_York',
    timeline: timeline({ versions: [version('new-york', { intake_time: 'custom', intake_time_custom: '08:15' })] }),
    expected: [{
      cycleId: 'c1', stackItemId: 's1', planVersionId: 'new-york',
      scheduledAt: '2026-06-15T12:15:00.000Z',
      routineSlotKey: 'c1@2026-06-15T12:15:00.000Z', slotKey: 'custom',
      localDate: '2026-06-15', time: '08:15', minutes: 495,
      dose: 10, unit: 'mg', method: 'oral',
    }],
  },
  {
    name: 'spring gap moves once to the first valid local instant',
    localDate: '2026-03-29',
    timeZone: 'Europe/Berlin',
    timeline: timeline({ versions: [version('spring', { intake_time: 'custom', intake_time_custom: '02:30' })] }),
    expected: [{
      cycleId: 'c1', stackItemId: 's1', planVersionId: 'spring',
      scheduledAt: '2026-03-29T01:00:00.000Z',
      routineSlotKey: 'c1@2026-03-29T01:00:00.000Z', slotKey: 'custom',
      localDate: '2026-03-29', time: '03:00', minutes: 180,
      dose: 10, unit: 'mg', method: 'oral',
    }],
  },
  {
    name: 'autumn fold chooses the earlier absolute instant once',
    localDate: '2026-10-25',
    timeZone: 'Europe/Berlin',
    timeline: timeline({ versions: [version('fold', { intake_time: 'custom', intake_time_custom: '02:30' })] }),
    expected: [{
      cycleId: 'c1', stackItemId: 's1', planVersionId: 'fold',
      scheduledAt: '2026-10-25T00:30:00.000Z',
      routineSlotKey: 'c1@2026-10-25T00:30:00.000Z', slotKey: 'custom',
      localDate: '2026-10-25', time: '02:30', minutes: 150,
      dose: 10, unit: 'mg', method: 'oral',
    }],
  },
]

const FREQUENCY_CASES = [
  {
    name: 'three-day cadence includes its third-day boundary',
    localDate: '2026-01-04',
    timeline: timeline({ versions: [version('three-days', {
      frequency: 'Alle X Tage', x_days_interval: 3, interval_unit: 'day',
    })] }),
    expected: [{ scheduledAt: '2026-01-04T07:00:00.000Z', slotKey: 'morgens' }],
  },
  {
    name: 'on/off cadence excludes an off day',
    localDate: '2026-01-03',
    timeline: timeline({ versions: [version('on-off', {
      frequency: 'Im Wechsel', cycle_on_days: 2, cycle_off_days: 1,
    })] }),
    expected: [],
  },
  {
    name: 'calendar-month cadence clamps to month end',
    localDate: '2026-04-30',
    timeline: timeline({
      cycle: { started_at: '2026-01-30T23:00:00.000Z' },
      versions: [version('quarterly', {
        effective_local_date: '2026-01-31', frequency: 'Alle X Tage',
        x_days_interval: 3, interval_unit: 'month',
      })],
    }),
    expected: [{ scheduledAt: '2026-04-30T06:00:00.000Z', slotKey: 'morgens' }],
  },
  {
    name: 'weekday cadence includes its selected weekday',
    localDate: '2026-06-15',
    timeline: timeline({ versions: [version('weekday', {
      frequency: 'Wochentage wählen', schedule_days: ['Mo'],
    })] }),
    expected: [{ scheduledAt: '2026-06-15T06:00:00.000Z', slotKey: 'morgens' }],
  },
  {
    name: 'per-slot weekdays suppress only the mismatched slot',
    localDate: '2026-06-15',
    timeline: timeline({ versions: [version('slot-days', {
      intake_time: 'morgens,abends', slot_days: 'Mo,Di', slot_doses: '5,6',
    })] }),
    expected: [{ scheduledAt: '2026-06-15T06:00:00.000Z', slotKey: 'morgens' }],
  },
]

describe('Node timeline adapter parity', () => {
  it.each(CASES)('$name', ({ timeline: value, localDate, timeZone, expected }) => {
    const fromTypeScript = resolveIntakesTypeScript(value, localDate, timeZone)
    const fromNode = resolveIntakesNode(value, localDate, timeZone)

    expect(fromNode).toEqual(fromTypeScript)
    expect(summary(fromNode)).toEqual(expected)
  })

  it.each(FREQUENCY_CASES)('$name', ({ timeline: value, localDate, expected }) => {
    const fromTypeScript = resolveIntakesTypeScript(value, localDate, 'Europe/Berlin')
    const fromNode = resolveIntakesNode(value, localDate, 'Europe/Berlin')
    expect(fromNode).toEqual(fromTypeScript)
    expect(fromNode.map(({ scheduledAt, slotKey }) => ({ scheduledAt, slotKey }))).toEqual(expected)
  })

  it('matches lifecycle boundaries and the half-open pause interval', () => {
    const value = timeline({
      cycle: {
        started_at: '2026-06-15T06:00:00.000Z',
        ended_at: '2026-06-15T18:00:00.000Z',
      },
      versions: [version('v1', { effective_local_date: '2026-06-15' })],
      pauses: [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-06-15T10:00:00.000Z', ends_at: '2026-06-15T12:00:00.000Z' }],
    })
    const targets = [
      ['2026-06-15T05:59:00.000Z', 'planned', null],
      ['2026-06-15T10:00:00.000Z', 'paused', 'p1'],
      ['2026-06-15T12:00:00.000Z', 'active', null],
      ['2026-06-15T18:00:00.000Z', 'ended', null],
    ]

    for (const [instant, status, pauseId] of targets) {
      const expected = resolveCycleAtTypeScript(value, new Date(instant), 'Europe/Berlin')
      const actual = resolveCycleAtNode(value, new Date(instant), 'Europe/Berlin')
      expect(actual).toEqual(expected)
      expect({ status: actual.status, pauseId: actual.pause?.id ?? null }).toEqual({ status, pauseId })
    }
  })
})
