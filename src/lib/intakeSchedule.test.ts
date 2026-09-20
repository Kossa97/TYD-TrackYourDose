import { describe, it, expect } from 'vitest'
import {
  findOldestOverdueIntake, findOldestOverdueTimelineIntake,
  collectMissedIntakes, collectMissedTimelineIntakes,
  collectOpenIntakes, collectOpenTimelineIntakes,
  cycleAppliesToDay, scheduleForDay, effectiveDose,
  effectiveQuantity, effectiveSlotQuantity, findNextTimelineIntake,
  resolveScheduleSlots,
  resolveTimelineIntakesForDay,
  type ScheduleCycle, type IntakeLog, type ScheduleSegment, type EscalationRow,
} from './intakeSchedule'
import type { CycleTimeline, PlanScheduleSnapshot } from './planTimeline'

// ── Fixtures ────────────────────────────────────────────────────────────────
const seg = (effective_from: string, intake_time: string, dose: number): ScheduleSegment => ({
  effective_from, frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time, intake_time_custom: null, dose, unit: 'mcg',
})
const seg2 = (effective_from: string, intake_time: string): ScheduleSegment =>
  seg(effective_from, intake_time, 200)

// Versioned: 1x (morgens, 200) until 2026-03-01, then 2x (morgens,abends, 300).
const versioned: ScheduleCycle = {
  id: 'c1', stack_item_id: 'p1', start_date: '2026-01-01', end_date: null,
  frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time: 'morgens,abends', intake_time_custom: null, dose: 300, unit: 'mcg',
  schedule_history: [seg('2026-01-01', 'morgens', 200), seg('2026-03-01', 'morgens,abends', 300)],
}

// 2x daily cycle starting today, no history — for the per-slot overdue tests.
const cycle: ScheduleCycle = {
  id: 'c1', stack_item_id: 'p1', start_date: '2026-06-03', end_date: null,
  frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time: 'morgens,abends', intake_time_custom: null,
  dose: 200, unit: 'mcg', schedule_history: null,
}
const stackItemNameById = new Map([['p1', 'Ipamorelin']])
const log = (taken: boolean | null, time: string): IntakeLog => ({ stack_item_id: 'p1', logged_at: `2026-06-03T${time}`, taken })

// ── scheduleForDay ───────────────────────────────────────────────────────────
describe('scheduleForDay', () => {
  it('leere Historie => flache Felder', () => {
    const flat = { ...versioned, schedule_history: null }
    expect(scheduleForDay(flat, new Date(2026, 0, 15)).dose).toBe(300)
    expect(scheduleForDay(flat, new Date(2026, 0, 15)).intake_time).toBe('morgens,abends')
  })
  it('vor zweitem Segment => erstes Segment', () => {
    expect(scheduleForDay(versioned, new Date(2026, 1, 1)).intake_time).toBe('morgens')
    expect(scheduleForDay(versioned, new Date(2026, 1, 1)).dose).toBe(200)
  })
  it('genau am effective_from des zweiten Segments => zweites Segment', () => {
    expect(scheduleForDay(versioned, new Date(2026, 2, 1)).intake_time).toBe('morgens,abends')
  })
  it('nach zweitem Segment => zweites Segment', () => {
    expect(scheduleForDay(versioned, new Date(2026, 5, 1)).dose).toBe(300)
  })
})

describe('resolveScheduleSlots', () => {
  it.each(['09:30', '14:00'])(
    'keeps a persisted morning routine in the morning group while using exact time %s',
    time => {
      expect(resolveScheduleSlots({ intake_time: 'morgens', intake_time_custom: time })).toEqual([{
        key: 'morgens',
        routineGroup: 'morning',
        time,
        minutes: Number(time.slice(0, 2)) * 60 + Number(time.slice(3)),
        // Ohne eigene Menge gilt die des Zyklus — so war es bei jedem Plan,
        // bevor die Menge je Zeitpunkt stehen konnte.
        dose: null,
      }])
    },
  )
})

const timelineSchedule = (
  dose: number,
  overrides: Partial<PlanScheduleSnapshot> = {},
): PlanScheduleSnapshot => ({
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
  ...overrides,
})

const planTimeline: CycleTimeline = {
  cycle: {
    id: 'timeline-cycle',
    stack_item_id: 'timeline-stack-item',
    started_at: '2026-09-17T00:00:00Z',
    ended_at: null,
  },
  versions: [
    {
      id: 'timeline-v1',
      cycle_id: 'timeline-cycle',
      effective_kind: 'local_date',
      effective_at: null,
      effective_local_date: '2026-09-18',
      change_kind: 'initial',
      ...timelineSchedule(0.25),
    },
    {
      id: 'timeline-v2',
      cycle_id: 'timeline-cycle',
      effective_kind: 'instant',
      effective_at: '2026-09-18T10:00:00Z',
      effective_local_date: null,
      change_kind: 'dose',
      ...timelineSchedule(0.5),
    },
  ],
  pauses: [],
}

describe('versioned timeline occurrences', () => {
  const dstTimeline: CycleTimeline = {
    ...planTimeline,
    cycle: { ...planTimeline.cycle, started_at: '2026-01-01T00:00:00Z' },
    versions: [{ ...planTimeline.versions[0], effective_local_date: '2026-01-01',
      intake_time: 'custom', intake_time_custom: '02:30' }],
  }

  it.each([
    ['2026-03-29', '2026-03-29T01:00:00.000Z', '03:00'],
    ['2026-10-25', '2026-10-25T00:30:00.000Z', '02:30'],
    ['2026-03-28', '2026-03-28T01:30:00.000Z', '02:30'],
  ])('resolves Berlin %s once with deterministic DST policy', (day, instant, time) => {
    expect(resolveTimelineIntakesForDay(dstTimeline, day, 'Europe/Berlin'))
      .toMatchObject([{ scheduledAt: instant, time, routineSlotKey: `timeline-cycle@${instant}` }])
    expect(resolveTimelineIntakesForDay(dstTimeline, day, 'Europe/Berlin')).toHaveLength(1)
  })

  it('collects missed slots across the Berlin spring gap without aborting', () => {
    expect(collectMissedTimelineIntakes([dstTimeline], [], new Date('2026-03-30T12:00:00Z'), 'Europe/Berlin', 1))
      .toMatchObject([{ scheduledAt: '2026-03-29T01:00:00.000Z' }])
  })

  it('does not offer the first fold occurrence again during the repeated hour', () => {
    expect(findNextTimelineIntake(dstTimeline, new Date('2026-10-25T01:15:00Z'), 'Europe/Berlin', 1)).toBeNull()
  })

  it('uses the old morning plan and the new evening plan after a noon change', () => {
    expect(
      resolveTimelineIntakesForDay(planTimeline, '2026-09-18', 'Europe/Berlin')
        .map(intake => [intake.time, intake.planVersionId, intake.dose]),
    ).toEqual([
      ['08:00', 'timeline-v1', 0.25],
      ['20:00', 'timeline-v2', 0.5],
    ])
  })

  it('suppresses only slots inside a pause that begins at noon', () => {
    const pausedAtNoon: CycleTimeline = {
      ...planTimeline,
      pauses: [{
        id: 'timeline-pause',
        cycle_id: 'timeline-cycle',
        paused_at: '2026-09-18T10:00:00Z',
        ends_at: null,
      }],
    }

    expect(
      resolveTimelineIntakesForDay(pausedAtNoon, '2026-09-18', 'Europe/Berlin')
        .map(intake => intake.time),
    ).toEqual(['08:00'])
  })

  it('does not create automatic occurrences for PRN plans', () => {
    const prnTimeline: CycleTimeline = {
      ...planTimeline,
      versions: [{
        ...planTimeline.versions[0],
        ...timelineSchedule(0.25, {
          frequency: 'Bei Bedarf',
          intake_time: '',
          intake_time_custom: null,
        }),
      }],
    }

    expect(resolveTimelineIntakesForDay(prnTimeline, '2026-09-18', 'Europe/Berlin')).toEqual([])
  })

  it('finds the first occurrence strictly after the supplied instant', () => {
    const next = findNextTimelineIntake(
      planTimeline,
      new Date('2026-09-18T06:00:00Z'),
      'Europe/Berlin',
    )

    expect(next?.time).toBe('20:00')
    expect(next?.planVersionId).toBe('timeline-v2')
  })
})

describe('versioned timeline collectors', () => {
  const berlinDay = new Date('2026-09-18T10:00:00.000Z')
  const nextBerlinDay = new Date('2026-09-19T10:00:00.000Z')

  it('keeps exact version provenance and stable confirmation keys around a midday change', () => {
    expect(collectOpenTimelineIntakes([planTimeline], [], berlinDay, 'Europe/Berlin'))
      .toMatchObject([
        {
          key: 'timeline-cycle@2026-09-18T06:00:00.000Z',
          scheduledAt: '2026-09-18T06:00:00.000Z',
          planVersionId: 'timeline-v1',
          time: '08:00',
        },
        {
          key: 'timeline-cycle@2026-09-18T18:00:00.000Z',
          scheduledAt: '2026-09-18T18:00:00.000Z',
          planVersionId: 'timeline-v2',
          time: '20:00',
        },
      ])
  })

  it('does not let an unkeyed mismatched plan-version log consume another slot', () => {
    const logs: IntakeLog[] = [{
      id: 'wrong-version',
      stack_item_id: 'timeline-stack-item',
      logged_at: '2026-09-18T06:00:00.000Z',
      taken: true,
      cycle_id: 'timeline-cycle',
      plan_version_id: 'timeline-v2',
      routine_slot_key: null,
    }]

    expect(collectOpenTimelineIntakes([planTimeline], logs, berlinDay, 'Europe/Berlin'))
      .toMatchObject([{ planVersionId: 'timeline-v1', time: '08:00' }])
  })

  it('uses exact stable coverage even when the actual-time version differs', () => {
    const logs: IntakeLog[] = [{
      id: 'edited', stack_item_id: 'timeline-stack-item', taken: true,
      logged_at: '2026-09-18T14:00:00.000Z', cycle_id: 'timeline-cycle',
      plan_version_id: 'timeline-v2',
      routine_slot_key: 'timeline-cycle@2026-09-18T06:00:00.000Z',
    }]
    expect(collectOpenTimelineIntakes([planTimeline], logs, berlinDay, 'Europe/Berlin'))
      .toMatchObject([{ time: '20:00' }])
  })

  it('matches exact stable provenance first and carries a compatible pending log id', () => {
    const logs: IntakeLog[] = [{
      id: 'pending-evening',
      stack_item_id: 'timeline-stack-item',
      logged_at: '2026-09-18T18:00:00.000Z',
      taken: null,
      cycle_id: 'timeline-cycle',
      plan_version_id: 'timeline-v2',
      routine_slot_key: 'timeline-cycle@2026-09-18T18:00:00.000Z',
    }, {
      id: 'taken-morning',
      stack_item_id: 'timeline-stack-item',
      logged_at: '2026-09-18T06:00:00.000Z',
      taken: true,
      cycle_id: 'timeline-cycle',
      plan_version_id: 'timeline-v1',
      routine_slot_key: 'timeline-cycle@2026-09-18T06:00:00.000Z',
    }]

    expect(collectOpenTimelineIntakes([planTimeline], logs, berlinDay, 'Europe/Berlin'))
      .toMatchObject([{
        planVersionId: 'timeline-v2',
        pendingLogId: 'pending-evening',
      }])
  })

  it('matches a stable slot key before the editable logged-at calendar day', () => {
    const logs: IntakeLog[] = [{
      id: 'taken-morning-late',
      stack_item_id: 'timeline-stack-item',
      logged_at: '2026-09-19T00:15:00.000Z',
      taken: true,
      cycle_id: 'timeline-cycle',
      plan_version_id: 'timeline-v1',
      routine_slot_key: 'timeline-cycle@2026-09-18T06:00:00.000Z',
    }]

    expect(collectOpenTimelineIntakes([planTimeline], logs, berlinDay, 'Europe/Berlin'))
      .toMatchObject([{ planVersionId: 'timeline-v2', time: '20:00' }])
  })

  it('keeps duplicate-named items separate by stack item id during legacy fallback', () => {
    const separateTimeline: CycleTimeline = {
      ...planTimeline,
      cycle: {
        ...planTimeline.cycle,
        id: 'separate-cycle',
        stack_item_id: 'separate-stack-item',
      },
      versions: planTimeline.versions.map(version => ({
        ...version,
        id: `separate-${version.id}`,
        cycle_id: 'separate-cycle',
      })),
    }
    const logs: IntakeLog[] = [{
      id: 'legacy-log',
      stack_item_id: 'timeline-stack-item',
      logged_at: '2026-09-18T07:00:00.000Z',
      taken: true,
    }]

    const open = collectOpenTimelineIntakes(
      [planTimeline, separateTimeline], logs, berlinDay, 'Europe/Berlin',
    )
    const duplicateNames = new Map([
      ['timeline-stack-item', 'Vitamin D3'],
      ['separate-stack-item', 'Vitamin D3'],
    ])
    expect(open.map(intake => duplicateNames.get(intake.stackItemId)))
      .toEqual(['Vitamin D3', 'Vitamin D3', 'Vitamin D3'])
    expect(open.filter(intake => intake.stackItemId === 'timeline-stack-item'))
      .toHaveLength(1)
    expect(open.filter(intake => intake.stackItemId === 'separate-stack-item'))
      .toHaveLength(2)
  })

  it('creates no automatic miss for a fully paused or PRN day', () => {
    const paused: CycleTimeline = {
      ...planTimeline,
      pauses: [{
        id: 'full-day-pause',
        cycle_id: 'timeline-cycle',
        paused_at: '2026-09-17T22:00:00.000Z',
        ends_at: '2026-09-18T22:00:00.000Z',
      }],
    }
    const prn: CycleTimeline = {
      ...planTimeline,
      cycle: { ...planTimeline.cycle, id: 'prn-cycle' },
      versions: [{
        ...planTimeline.versions[0],
        id: 'prn-version',
        cycle_id: 'prn-cycle',
        ...timelineSchedule(0.25, {
          frequency: 'Bei Bedarf',
          intake_time: '',
          intake_time_custom: null,
        }),
      }],
    }

    expect(collectMissedTimelineIntakes(
      [paused, prn], [], nextBerlinDay, 'Europe/Berlin', 1,
    )).toEqual([])
  })

  it('keeps a pre-pause morning slot eligible to become missed after day close', () => {
    const pausedAtNoon: CycleTimeline = {
      ...planTimeline,
      pauses: [{
        id: 'noon-pause',
        cycle_id: 'timeline-cycle',
        paused_at: '2026-09-18T10:00:00.000Z',
        ends_at: null,
      }],
    }

    expect(collectMissedTimelineIntakes(
      [pausedAtNoon], [], nextBerlinDay, 'Europe/Berlin', 1,
    )).toMatchObject([{
      cycleId: 'timeline-cycle',
      planVersionId: 'timeline-v1',
      routineSlotKey: 'timeline-cycle@2026-09-18T06:00:00.000Z',
      scheduledAt: '2026-09-18T06:00:00.000Z',
      minutes: 480,
    }])
  })

  it('resolves a 90-day auto-miss lookback without a 50ms long task', () => {
    const longTimeline = (id: string): CycleTimeline => ({
      cycle: {
        id,
        stack_item_id: `stack-${id}`,
        started_at: '2026-01-01T00:00:00Z',
        ended_at: null,
      },
      versions: [{
        id: `${id}-v1`,
        cycle_id: id,
        effective_kind: 'local_date',
        effective_at: null,
        effective_local_date: '2026-01-01',
        change_kind: 'initial',
        ...timelineSchedule(0.25),
      }],
      pauses: [],
    })
    const timelines = Array.from({ length: 15 }, (_, index) => longTimeline(`perf-${index}`))
    const now = new Date('2026-09-19T10:00:00.000Z')
    const firstStarted = performance.now()
    const missed = collectMissedTimelineIntakes(timelines, [], now, 'Europe/Berlin', 90)
    const firstMs = performance.now() - firstStarted
    const repeatStarted = performance.now()
    collectMissedTimelineIntakes(timelines, [], now, 'Europe/Berlin', 90)
    const repeatMs = performance.now() - repeatStarted
    expect(missed.length).toBeGreaterThan(0)
    // Uncached formatter construction cost 2370ms for this same 15×90 case.
    expect(firstMs).toBeLessThan(150)
    expect(repeatMs).toBeLessThan(16)
  })

  it('can slice a lookback window without walking older days', () => {
    const daily: CycleTimeline = {
      ...planTimeline,
      cycle: { ...planTimeline.cycle, started_at: '2026-09-01T00:00:00Z' },
      versions: [{
        ...planTimeline.versions[0],
        effective_local_date: '2026-09-01',
      }],
    }
    const now = new Date('2026-09-19T10:00:00.000Z')
    const sliced = collectMissedTimelineIntakes([daily], [], now, 'Europe/Berlin', 3, 2)
    expect([...new Set(sliced.map(item => item.dateKey))].sort()).toEqual(['2026-09-16', '2026-09-17'])
    expect(sliced.some(item => item.dateKey === '2026-09-18')).toBe(false)
    expect(sliced.some(item => item.dateKey === '2026-09-15')).toBe(false)
  })

  it('finds the oldest overdue normalized slot with its exact cycle', () => {
    expect(findOldestOverdueTimelineIntake(
      [planTimeline], [], new Map([['timeline-stack-item', 'Vitamin D3']]),
      new Date('2026-09-18T19:00:00.000Z'), 'Europe/Berlin', 0,
    )).toMatchObject({
      cycleId: 'timeline-cycle',
      substance: 'Vitamin D3',
      time: '08:00',
      dateKey: '2026-09-18',
    })
  })
})

describe('recurrence validation at schedule evaluation', () => {
  it('does not silently default an invalid every-x-days interval to two', () => {
    expect(cycleAppliesToDay({
      ...cycle,
      frequency: 'Alle X Tage',
      x_days_interval: null,
    }, new Date(2026, 5, 5))).toBe(false)
  })
})

// ── effectiveDose ──────────────────────────────────────────────────────────────
describe('effectiveDose mit versionierter Basis-Dosis + Dosisanpassung', () => {
  const esc: EscalationRow = { cycle_id: 'c1', increase_amount: 50, unit: 'mcg', start_type: 'after_days', start_date: null, start_after_days: 14 }
  it('Basis aus Segment + aktive Eskalation', () => {
    expect(effectiveDose(versioned, new Date(2026, 0, 5), [esc])).toBe(200)   // Tag 4, keine Eskalation
    expect(effectiveDose(versioned, new Date(2026, 0, 20), [esc])).toBe(250)  // Tag 19, +50
    expect(effectiveDose(versioned, new Date(2026, 5, 1), [esc])).toBe(350)   // Segment 300 + 50
  })
  it('unterstuetzt Reduktionen als negative Anpassung', () => {
    const reduction: EscalationRow = { cycle_id: 'c1', increase_amount: -75, unit: 'mcg', start_type: 'after_days', start_date: null, start_after_days: 21 }
    expect(effectiveDose(versioned, new Date(2026, 0, 25), [esc, reduction])).toBe(175)
  })

  it('rejects arithmetic when an active adjustment unit differs from the effective base unit', () => {
    expect(effectiveDose(versioned, new Date(2026, 0, 20), [{ ...esc, unit: 'mg' }])).toBeNull()
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects arithmetic with an invalid active adjustment (%s)',
    increase_amount => {
      expect(effectiveDose(versioned, new Date(2026, 0, 20), [{ ...esc, increase_amount }])).toBeNull()
    },
  )
})

// ── findOldestOverdueIntake: mehrere Einnahmen pro Tag ──────────────────────────
describe('findOldestOverdueIntake — multiple intakes per day', () => {
  it('flags the evening dose as overdue after the morning dose was taken', () => {
    const now = new Date(2026, 5, 3, 21, 0) // 21:00, after the 20:00 slot
    const overdue = findOldestOverdueIntake([cycle], [log(true, '08:30:00')], stackItemNameById, now)
    expect(overdue?.time).toBe('20:00')
    expect(overdue?.cycleId).toBe('c1')
  })
  it('does NOT flag the evening dose while it is still upcoming', () => {
    const now = new Date(2026, 5, 3, 15, 0) // 15:00, before the 20:00 slot
    expect(findOldestOverdueIntake([cycle], [log(true, '08:30:00')], stackItemNameById, now)).toBeNull()
  })
  it('returns null once both daily doses are decided', () => {
    const now = new Date(2026, 5, 3, 21, 0)
    expect(findOldestOverdueIntake([cycle], [log(true, '08:30:00'), log(true, '20:30:00')], stackItemNameById, now)).toBeNull()
  })
  it('a skipped dose also covers its slot', () => {
    const now = new Date(2026, 5, 3, 21, 0)
    expect(findOldestOverdueIntake([cycle], [log(false, '08:30:00'), log(true, '20:30:00')], stackItemNameById, now)).toBeNull()
  })
})

// ── findOldestOverdueIntake: Frequenzwechsel gilt ab Aenderung ──────────────────
describe('findOldestOverdueIntake — Frequenzwechsel gilt ab Aenderung', () => {
  // 1x täglich (morgens) ab 2026-05-01, ab 2026-06-03 auf 2x (morgens,abends).
  const changed: ScheduleCycle = {
    id: 'c2', stack_item_id: 'p2', start_date: '2026-05-01', end_date: null,
    frequency: '2x täglich', x_days_interval: null, schedule_days: null,
    intake_time: 'morgens,abends', intake_time_custom: null, dose: 200, unit: 'mcg',
    schedule_history: [seg2('2026-05-01', 'morgens'), seg2('2026-06-03', 'morgens,abends')],
  }
  const stackItemNames2 = new Map([['p2', 'CJC-1295']])
  const lg = (stackItemId: string, day: string, time: string, taken: boolean | null): IntakeLog =>
    ({ stack_item_id: stackItemId, logged_at: `${day}T${time}`, taken })

  // lookbackDays=0 isolates the target day (the function otherwise returns the
  // OLDEST overdue across history, which here would be unlogged May mornings).
  it('vor dem Wechsel keine zweite (Abend-)Faelligkeit', () => {
    const now = new Date(2026, 4, 20, 23, 0)
    expect(findOldestOverdueIntake([changed], [lg('p2', '2026-05-20', '08:30:00', true)], stackItemNames2, now, 0)).toBeNull()
  })
  it('ab dem Wechsel wird die Abenddosis faellig', () => {
    const now = new Date(2026, 5, 3, 21, 0)
    const overdue = findOldestOverdueIntake([changed], [lg('p2', '2026-06-03', '08:30:00', true)], stackItemNames2, now, 0)
    expect(overdue?.time).toBe('20:00')
  })
})

// ── collectMissedIntakes: Frist bis Tagesende ───────────────────────────────────
describe('collectMissedIntakes — Frist bis Tagesende', () => {
  // 1x täglich, Start vor 3 Tagen, keine Logs.
  const daily: ScheduleCycle = {
    id: 'c3', stack_item_id: 'p3', start_date: '2026-06-09', end_date: null,
    frequency: 'Täglich', x_days_interval: null, schedule_days: null,
    intake_time: 'morgens', intake_time_custom: null, dose: 100, unit: 'mcg',
    schedule_history: null,
  }
  const now = new Date(2026, 5, 12, 10, 0) // 12.06., 10:00

  it('liefert vergangene unbestätigte Slots, aber NICHT heute', () => {
    const missed = collectMissedIntakes([daily], [], now)
    const days = missed.map(m => m.dateKey)
    expect(days).toContain('2026-06-09')
    expect(days).toContain('2026-06-10')
    expect(days).toContain('2026-06-11')
    expect(days).not.toContain('2026-06-12') // heute bleibt offen (Frist läuft erst Mitternacht ab)
    expect(missed.every(m => m.minutes === 8 * 60)).toBe(true) // morgens = 08:00
  })

  it('bereits entschiedene Tage werden ausgelassen', () => {
    const logs: IntakeLog[] = [{ stack_item_id: 'p3', logged_at: '2026-06-10T08:30:00', taken: true }]
    const days = collectMissedIntakes([daily], logs, now).map(m => m.dateKey)
    expect(days).not.toContain('2026-06-10')
    expect(days).toContain('2026-06-09')
    expect(days).toContain('2026-06-11')
  })

  it('zurueckgesetzte Logs werden nicht erneut automatisch als verpasst eingetragen', () => {
    const logs: IntakeLog[] = [{ stack_item_id: 'p3', logged_at: '2026-06-10T08:30:00', taken: null }]
    const days = collectMissedIntakes([daily], logs, now).map(m => m.dateKey)
    expect(days).not.toContain('2026-06-10')
    expect(days).toContain('2026-06-09')
    expect(days).toContain('2026-06-11')
  })
  it('je nicht gedecktem Slot ein Eintrag (2x täglich)', () => {
    const twice: ScheduleCycle = { ...daily, frequency: '2x täglich', intake_time: 'morgens,abends' }
    // Am 11. nur eine Einnahme bestätigt → ein Slot bleibt offen.
    const logs: IntakeLog[] = [{ stack_item_id: 'p3', logged_at: '2026-06-11T08:30:00', taken: true }]
    const missed = collectMissedIntakes([twice], logs, now)
    const on11 = missed.filter(m => m.dateKey === '2026-06-11')
    expect(on11).toHaveLength(1)
    expect(on11[0].minutes).toBe(20 * 60) // der spätere (Abend-)Slot bleibt offen
  })

  it('erfasst die gesamte Zyklus-Länge, auch älter als 90 Tage', () => {
    // Start 100 Tage vor "now" → ein Tag ~95 Tage zurück muss enthalten sein.
    const old: ScheduleCycle = { ...daily, id: 'c4', start_date: '2026-03-04' } // 100 Tage vor 2026-06-12
    const missed = collectMissedIntakes([old], [], now)
    expect(missed.length).toBe(100) // 04.03.–11.06. (Start inklusive, heute exklusive)
    expect(missed.map(m => m.dateKey)).toContain('2026-03-09') // ~95 Tage zurück, jenseits 90
  })

  it('since begrenzt den Rückblick (kein Backfill vor Aktivierung)', () => {
    const old: ScheduleCycle = { ...daily, id: 'c4', start_date: '2026-03-04' }
    const since = new Date(2026, 5, 10) // Aktivierung am 10.06.
    const days = collectMissedIntakes([old], [], now, since).map(m => m.dateKey)
    expect(days).toEqual(['2026-06-10', '2026-06-11']) // nur ab Aktivierung bis gestern
  })

  it('since == heute → gar kein Backfill', () => {
    const old: ScheduleCycle = { ...daily, id: 'c4', start_date: '2026-03-04' }
    expect(collectMissedIntakes([old], [], now, new Date(2026, 5, 12))).toHaveLength(0)
  })
})

// ── collectOpenIntakes: fällige + überfällige Slots ─────────────────────────────
describe('collectOpenIntakes', () => {
  // 2x täglich (morgens 08:00, abends 20:00), Start 01.06., keine Historie.
  const twice: ScheduleCycle = {
    id: 'c5', stack_item_id: 'p5', start_date: '2026-06-01', end_date: null,
    frequency: '2x täglich', x_days_interval: null, schedule_days: null,
    intake_time: 'morgens,abends', intake_time_custom: null, dose: 200, unit: 'mcg',
    schedule_history: null,
  }

  it('liefert überfällige Slots; heutiger Slot bleibt aus, solange noch nicht fällig', () => {
    const now = new Date(2026, 5, 2, 12, 0) // 02.06., 12:00 (vor dem 20:00-Slot)
    const logs: IntakeLog[] = [{ stack_item_id: 'p5', logged_at: '2026-06-02T08:30:00', taken: true }]
    expect(collectOpenIntakes([twice], logs, now, 3)).toEqual([
      { cycleId: 'c5', stackItemId: 'p5', dateKey: '2026-06-01', minutes: 480, slotDose: null },
      { cycleId: 'c5', stackItemId: 'p5', dateKey: '2026-06-01', minutes: 1200, slotDose: null },
    ])
  })

  it('heutiger Slot wird aufgenommen, sobald seine Zeit vorbei ist', () => {
    const later = new Date(2026, 5, 2, 21, 0) // 21:00 → 20:00-Slot ist jetzt fällig
    const logs: IntakeLog[] = [{ stack_item_id: 'p5', logged_at: '2026-06-02T08:30:00', taken: true }]
    expect(collectOpenIntakes([twice], logs, later, 1)).toEqual([
      { cycleId: 'c5', stackItemId: 'p5', dateKey: '2026-06-01', minutes: 480, slotDose: null },
      { cycleId: 'c5', stackItemId: 'p5', dateKey: '2026-06-01', minutes: 1200, slotDose: null },
      { cycleId: 'c5', stackItemId: 'p5', dateKey: '2026-06-02', minutes: 1200, slotDose: null },
    ])
  })
})

describe('effectiveSlotQuantity — die Menge JE Zeitpunkt', () => {
  const zweiMengen = {
    id: 'c9', stack_item_id: 'p9', start_date: '2026-06-01', end_date: null,
    frequency: 'Täglich', x_days_interval: null, schedule_days: null,
    intake_time: 'morgens,abends', intake_time_custom: null,
    dose: 1000, unit: 'mg',
    slot_doses: '1000,500',
    schedule_history: null,
  }

  it('nimmt die eigene Menge des Zeitpunkts statt der des Zyklus', () => {
    // Vorher stand bei „morgens 1000, abends 500" an BEIDEN 1000 — die
    // Zyklusmenge ist die führende, nicht die jedes Zeitpunkts.
    const tag = new Date(2026, 5, 2)
    const slots = resolveScheduleSlots(zweiMengen, tag)

    expect(slots.map(slot => slot.dose)).toEqual([1000, 500])
    expect(slots.map(slot => effectiveSlotQuantity(zweiMengen, tag, [], slot.dose)))
      .toEqual([{ dose: 1000, unit: 'mg' }, { dose: 500, unit: 'mg' }])
  })

  it('legt eine Anpassung auf jeden Zeitpunkt, denn sie gilt dem ganzen Plan', () => {
    const tag = new Date(2026, 5, 2)
    const erhoehung = [{
      cycle_id: 'c9', increase_amount: 250, unit: 'mg',
      start_type: 'date' as const, start_date: '2026-06-01', start_after_days: null,
    }]

    expect(resolveScheduleSlots(zweiMengen, tag)
      .map(slot => effectiveSlotQuantity(zweiMengen, tag, erhoehung, slot.dose)?.dose))
      .toEqual([1250, 750])
  })

  it('ist ohne eigene Menge genau die Zyklusmenge', () => {
    const tag = new Date(2026, 5, 2)

    expect(effectiveSlotQuantity(zweiMengen, tag, [], null))
      .toEqual(effectiveQuantity(zweiMengen, tag, []))
  })
})

describe('effectiveDose with unknown quantity', () => {
  it('returns null when the active segment does not track quantity', () => {
    expect(effectiveDose({
      ...cycle,
      dose: null,
      unit: null,
      schedule_history: null,
    }, new Date('2026-07-25'), [])).toBeNull()
  })

  it('does not apply escalations to an unknown base dose', () => {
    expect(effectiveDose({
      ...cycle,
      dose: null,
      unit: null,
    }, new Date('2026-07-25'), [{
      cycle_id: cycle.id,
      increase_amount: 5,
      unit: 'mg',
      start_type: 'date',
      start_date: '2026-07-20',
      start_after_days: null,
    }])).toBeNull()
  })
})
