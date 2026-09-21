import { describe, expect, it } from 'vitest'
import {
  resolveCycleAt as resolveCycleAtNode,
  resolveTimelineIntakesForDay as resolveIntakesNode,
} from './planTimeline.js'
import { resolveCycleAt as resolveCycleAtTypeScript } from '../../src/lib/planTimeline.ts'
import { resolveTimelineIntakesForDay as resolveIntakesTypeScript } from '../../src/lib/intakeSchedule.ts'
import { dueReminders } from './reminderSchedule.js'

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

describe('PostgreSQL local-date boundary policy', () => {
  const midnightSchedule = { intake_time: 'custom', intake_time_custom: '00:30' }
  it.each([
    ['Node', resolveCycleAtNode, resolveIntakesNode],
    ['TypeScript', resolveCycleAtTypeScript, resolveIntakesTypeScript],
  ])('%s uses the second Havana midnight for eligibility, ordering and occurrences', (_name, resolve, intakes) => {
    const value = timeline({ versions: [
      version('old', midnightSchedule),
      version('instant', { ...midnightSchedule, effective_kind: 'instant', effective_at: '2026-11-01T04:45:00Z', effective_local_date: null, dose: 20 }),
      version('date', { ...midnightSchedule, effective_local_date: '2026-11-01', dose: 30 }),
    ] })
    for (const [at, expected] of [
      ['2026-11-01T04:30:00Z', 'old'],
      ['2026-11-01T04:50:00Z', 'instant'],
      ['2026-11-01T04:59:59.999Z', 'instant'],
      ['2026-11-01T05:00:00Z', 'date'],
      ['2026-11-01T05:30:00Z', 'date'],
    ]) expect(resolve(value, new Date(at), 'America/Havana').planVersion.id).toBe(expected)
    expect(intakes(value, '2026-11-01', 'America/Havana')).toMatchObject([
      { scheduledAt: '2026-11-01T05:30:00.000Z', planVersionId: 'date', dose: 30 },
    ])
  })

  it.each([resolveIntakesNode, resolveIntakesTypeScript])('does not emit next-day slots beyond the exclusive Havana course end', intakes => {
    const course = timeline({
      cycle: { ended_at: '2026-11-01T05:00:00Z', end_local_date: '2026-11-01', lifecycle_timezone: 'America/Havana' },
      versions: [version('course', midnightSchedule)],
    })
    expect(intakes(course, '2026-10-31', 'America/Havana')).toHaveLength(1)
    expect(intakes(course, '2026-11-01', 'America/Havana')).toHaveLength(0)
    expect(dueReminders(course, 'on_time', new Date('2026-11-01T04:31:00Z'), 'America/Havana', 5)).toEqual([])
    expect(dueReminders(course, 'on_time', new Date('2026-11-01T05:31:00Z'), 'America/Havana', 5)).toEqual([])
  })

  it.each([
    ['America/Havana', '2026-03-08', '2026-03-08T05:00:00.000Z', '01:00'],
    ['America/Santiago', '2026-09-06', '2026-09-06T04:00:00.000Z', '01:00'],
  ])('agrees at skipped midnight in %s', (zone, date, boundary, wallTime) => {
    const value = timeline({
      cycle: { started_at: boundary },
      versions: [version('gap', { effective_local_date: date, intake_time: 'custom', intake_time_custom: '00:00' })],
    })
    for (const resolve of [resolveCycleAtNode, resolveCycleAtTypeScript]) {
      expect(resolve(value, new Date(new Date(boundary).getTime() - 1), zone).status).toBe('planned')
      expect(resolve(value, new Date(boundary), zone).planVersion.id).toBe('gap')
    }
    for (const intakes of [resolveIntakesNode, resolveIntakesTypeScript]) {
      expect(intakes(value, date, zone)).toMatchObject([{ scheduledAt: boundary, time: wallTime }])
    }
  })
})

describe('local-date lifecycle and recurrence anchors', () => {
  it.each(['America/New_York', 'Asia/Tokyo'])('preserves the declared day in %s', timeZone => {
    for (const resolve of [resolveIntakesNode, resolveIntakesTypeScript]) {
      for (const cadence of [
        { frequency: 'Alle X Tage', x_days_interval: 2, interval_unit: 'day' },
        { frequency: 'Im Wechsel', cycle_on_days: 1, cycle_off_days: 1 },
        { frequency: 'Alle X Tage', x_days_interval: 1, interval_unit: 'month' },
      ]) {
        const value = timeline({
          cycle: { started_at: timeZone === 'Asia/Tokyo' ? '2026-09-17T15:00:00Z' : '2026-09-18T04:00:00Z' },
          versions: [version('anchor', { effective_local_date: '2026-09-18', ...cadence })],
        })
        expect(resolve(value, '2026-09-18', timeZone)).toHaveLength(1)
        expect(resolve(value, '2026-09-19', timeZone)).toHaveLength(0)
        expect(resolve(value, cadence.interval_unit === 'month' ? '2026-10-18' : '2026-09-20', timeZone)).toHaveLength(1)
      }
      const course = timeline({
        cycle: { started_at: timeZone === 'Asia/Tokyo' ? '2026-09-17T15:00:00Z' : '2026-09-18T04:00:00Z', ended_at: timeZone === 'Asia/Tokyo' ? '2026-09-19T15:00:00Z' : '2026-09-20T04:00:00Z', end_local_date: '2026-09-20' },
        versions: [version('course', { effective_local_date: '2026-09-18', intake_time: 'custom', intake_time_custom: '23:00' })],
      })
      expect(resolve(course, '2026-09-19', timeZone)).toHaveLength(1)
      expect(resolve(course, '2026-09-20', timeZone)).toHaveLength(0)
    }
  })
})

const CASES = [
  {
    name: 'fall-back instant versions are ordered by elapsed time, not repeated wall clock',
    localDate: '2026-10-25',
    timeZone: 'Europe/Berlin',
    timeline: timeline({ versions: [
      version('older-fold', { effective_kind: 'instant', effective_at: '2026-10-25T00:50:00Z', effective_local_date: null, intake_time: 'custom', intake_time_custom: '03:00', dose: 10 }),
      version('newer-fold', { effective_kind: 'instant', effective_at: '2026-10-25T01:10:00Z', effective_local_date: null, intake_time: 'custom', intake_time_custom: '03:00', dose: 20 }),
    ] }),
    expected: [{
      cycleId: 'c1', stackItemId: 's1', planVersionId: 'newer-fold',
      scheduledAt: '2026-10-25T02:00:00.000Z',
      routineSlotKey: 'c1@2026-10-25T03:00', slotKey: 'custom',
      localDate: '2026-10-25', time: '03:00', minutes: 180,
      dose: 20, unit: 'mg', method: 'oral',
    }],
  },
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
      routineSlotKey: 'c1@2026-06-15T08:00', slotKey: 'morgens',
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
        routineSlotKey: 'c1@2026-06-15T08:00', slotKey: 'morgens',
        localDate: '2026-06-15', time: '08:00', minutes: 480,
        dose: 5, unit: 'mg', method: 'oral',
      },
      {
        cycleId: 'c1', stackItemId: 's1', planVersionId: 'new',
        scheduledAt: '2026-06-15T18:00:00.000Z',
        routineSlotKey: 'c1@2026-06-15T20:00', slotKey: 'abends',
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
      routineSlotKey: 'c1@2026-06-15T20:00', slotKey: 'abends',
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
      routineSlotKey: 'c1@2026-06-15T08:15', slotKey: 'custom',
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
      routineSlotKey: 'c1@2026-06-15T08:15', slotKey: 'custom',
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
      routineSlotKey: 'c1@2026-03-29T02:30', slotKey: 'custom',
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
      routineSlotKey: 'c1@2026-10-25T02:30', slotKey: 'custom',
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
  it('uses persisted creation order to break equal absolute boundaries like SQL', () => {
    const value = timeline({ versions: [
      version('z-old', { effective_local_date: '2026-06-15', created_at: '2026-01-01T00:00Z' }),
      version('a-new', { effective_kind: 'instant', effective_at: '2026-06-14T22:00Z', effective_local_date: null, created_at: '2026-01-02T00:00Z' }),
    ] })
    for (const resolve of [resolveCycleAtNode, resolveCycleAtTypeScript]) {
      expect(resolve(value, new Date('2026-06-15T06:00Z'), 'Europe/Berlin').planVersion.id).toBe('a-new')
    }
  })
  it('keeps lifecycle instants fixed when the viewer travels', () => {
    const value = timeline({ cycle: {
      started_at: '2026-09-18T04:00:00Z', ended_at: '2026-09-20T04:00:00Z',
      start_local_date: '2026-09-18', end_local_date: '2026-09-20',
    } })
    for (const resolve of [resolveCycleAtNode, resolveCycleAtTypeScript]) {
      for (const zone of ['Asia/Tokyo', 'America/New_York']) {
        expect(resolve(value, new Date('2026-09-18T03:59:00Z'), zone).status).toBe('planned')
        expect(resolve(value, new Date('2026-09-20T03:59:00Z'), zone).status).toBe('active')
        expect(resolve(value, new Date('2026-09-20T04:00:00Z'), zone).status).toBe('ended')
      }
    }
  })
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
