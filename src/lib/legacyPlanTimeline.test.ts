import { addDays, format, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'
import {
  effectiveSlotQuantity,
  resolveScheduleSlots,
  scheduleForDay,
} from './intakeSchedule'
import { legacyCycleToTimeline, type LegacyEscalationRow, type LegacyScheduleCycle } from './legacyPlanTimeline'
import { resolveCycleAtLocalSlot } from './planTimeline'

const flatCycle = (overrides: Partial<LegacyScheduleCycle> = {}): LegacyScheduleCycle => ({
  id: 'cycle-1',
  stack_item_id: 'item-1',
  start_date: '2026-01-01',
  end_date: null,
  active: true,
  frequency: 'Täglich',
  x_days_interval: null,
  interval_unit: null,
  cycle_on_days: null,
  cycle_off_days: null,
  schedule_days: [],
  intake_time: 'morgens',
  intake_time_custom: '08:00',
  slot_doses: null,
  slot_days: null,
  dose: 100,
  unit: 'mg',
  method: 'Oral',
  schedule_history: null,
  ...overrides,
})

const escalation = (
  id: string,
  overrides: Partial<LegacyEscalationRow> = {},
): LegacyEscalationRow => ({
  id,
  cycle_id: 'cycle-1',
  increase_amount: 25,
  unit: 'mg',
  start_type: 'date',
  start_date: '2026-01-10',
  start_after_days: null,
  ...overrides,
})

describe('legacyCycleToTimeline', () => {
  it('converts a flat legacy cycle into one complete local-date version', () => {
    const converted = legacyCycleToTimeline(flatCycle({ end_date: '2026-01-31' }), [])

    expect(converted.issues).toEqual([])
    expect(converted.timeline.cycle).toEqual({
      id: 'cycle-1',
      stack_item_id: 'item-1',
      started_at: '2026-01-01T00:00:00.000Z',
      ended_at: '2026-02-01T00:00:00.000Z',
    })
    expect(converted.timeline.versions).toEqual([
      expect.objectContaining({
        cycle_id: 'cycle-1',
        effective_kind: 'local_date',
        effective_at: null,
        effective_local_date: '2026-01-01',
        change_kind: 'initial',
        frequency: 'Täglich',
        intake_time: 'morgens',
        dose: 100,
        unit: 'mg',
        method: 'Oral',
      }),
    ])
  })

  it('uses both historical schedule dates and never mutates the legacy input', () => {
    const cycle = flatCycle({
      frequency: '2x täglich',
      intake_time: 'morgens,abends',
      dose: 300,
      schedule_history: [
        {
          effective_from: '2026-01-01',
          frequency: 'Täglich',
          x_days_interval: null,
          schedule_days: [],
          intake_time: 'morgens',
          intake_time_custom: '08:00',
          dose: 100,
          unit: 'mg',
        },
        {
          effective_from: '2026-02-01',
          frequency: '2x täglich',
          x_days_interval: null,
          schedule_days: [],
          intake_time: 'morgens,abends',
          intake_time_custom: '08:00,20:00',
          dose: 300,
          unit: 'mg',
        },
      ],
    })
    const before = structuredClone(cycle)

    const converted = legacyCycleToTimeline(cycle, [])

    expect(cycle).toEqual(before)
    expect(converted.timeline.versions.map(version => [
      version.effective_local_date,
      version.frequency,
      version.dose,
    ])).toEqual([
      ['2026-01-01', 'Täglich', 100],
      ['2026-02-01', '2x täglich', 300],
    ])
  })

  it('folds date and after-days adjustments into complete versions', () => {
    const converted = legacyCycleToTimeline(flatCycle(), [
      escalation('date-step'),
      escalation('offset-step', {
        increase_amount: 50,
        start_type: 'after_days',
        start_date: null,
        start_after_days: 20,
      }),
    ])

    expect(converted.issues).toEqual([])
    expect(converted.timeline.versions.map(version => [
      version.effective_local_date,
      version.change_kind,
      version.dose,
    ])).toEqual([
      ['2026-01-01', 'initial', 100],
      ['2026-01-10', 'titration', 125],
      ['2026-01-21', 'titration', 175],
    ])
  })

  it('preserves a valid dose reduction', () => {
    const converted = legacyCycleToTimeline(flatCycle(), [
      escalation('reduction', { increase_amount: -40 }),
    ])

    expect(converted.issues).toEqual([])
    expect(converted.timeline.versions.at(-1)?.dose).toBe(60)
  })

  it('flags mixed units instead of adding incompatible quantities', () => {
    const converted = legacyCycleToTimeline(flatCycle(), [
      escalation('wrong-unit', { increase_amount: 500, unit: 'mcg' }),
    ])

    expect(converted.issues).toEqual([{ code: 'unit_mismatch', sourceId: 'wrong-unit' }])
    expect(converted.timeline.versions).toHaveLength(1)
    expect(converted.timeline.versions[0].dose).toBe(100)
  })

  it('flags invalid history and escalation boundaries without inventing dates', () => {
    const cycle = flatCycle({
      schedule_history: [{
        effective_from: 'not-a-date',
        frequency: 'Täglich',
        x_days_interval: null,
        schedule_days: [],
        intake_time: 'morgens',
        intake_time_custom: null,
        dose: 100,
        unit: 'mg',
      }],
    })
    const converted = legacyCycleToTimeline(cycle, [
      escalation('bad-offset', {
        start_type: 'after_days',
        start_date: null,
        start_after_days: -1,
      }),
    ])

    expect(converted.issues).toEqual(expect.arrayContaining([
      { code: 'invalid_boundary', sourceId: 'cycle-1:history:0' },
      { code: 'invalid_boundary', sourceId: 'bad-offset' },
    ]))
    expect(converted.timeline.versions).toEqual([])
  })

  it('matches the legacy schedule and slot quantities across 60 representative days', () => {
    const cycle = flatCycle({
      intake_time: 'morgens,abends',
      intake_time_custom: '08:00,20:00',
      slot_doses: '100,150',
      dose: 100,
      schedule_history: [
        {
          effective_from: '2026-01-01',
          frequency: 'Täglich',
          x_days_interval: null,
          schedule_days: [],
          intake_time: 'morgens,abends',
          intake_time_custom: '08:00,20:00',
          slot_doses: '100,150',
          dose: 100,
          unit: 'mg',
        },
        {
          effective_from: '2026-02-01',
          frequency: 'Wochentage wählen',
          x_days_interval: null,
          schedule_days: ['Mo', 'Mi', 'Fr'],
          intake_time: 'morgens,abends',
          intake_time_custom: '07:30,21:00',
          slot_doses: '125,175',
          dose: 125,
          unit: 'mg',
        },
      ],
    })
    const adjustments = [
      escalation('first-step', { start_date: '2026-01-15', increase_amount: 25 }),
      escalation('reduction', {
        start_type: 'after_days',
        start_date: null,
        start_after_days: 40,
        increase_amount: -10,
      }),
    ]
    const converted = legacyCycleToTimeline(cycle, adjustments)
    expect(converted.issues).toEqual([])

    for (let offset = 0; offset < 60; offset += 1) {
      const day = addDays(parseISO(cycle.start_date), offset)
      const dayKey = format(day, 'yyyy-MM-dd')
      const legacySchedule = scheduleForDay(cycle, day)
      const convertedVersion = resolveCycleAtLocalSlot(
        converted.timeline,
        dayKey,
        12 * 60,
        'Europe/Berlin',
      ).planVersion

      expect(convertedVersion, dayKey).not.toBeNull()
      expect(convertedVersion?.frequency, dayKey).toBe(legacySchedule.frequency)
      expect(convertedVersion?.intake_time, dayKey).toBe(legacySchedule.intake_time)
      expect(convertedVersion?.schedule_days, dayKey).toEqual(legacySchedule.schedule_days ?? [])

      const legacySlots = resolveScheduleSlots(legacySchedule, day)
      const convertedSlots = resolveScheduleSlots(convertedVersion!, day)
      expect(convertedSlots.map(slot => slot.time), dayKey)
        .toEqual(legacySlots.map(slot => slot.time))

      const legacyQuantities = legacySlots.map(slot => (
        effectiveSlotQuantity(cycle, day, adjustments, slot.dose)?.dose ?? null
      ))
      const convertedQuantities = convertedSlots.map(slot => slot.dose ?? convertedVersion?.dose ?? null)
      expect(convertedQuantities, dayKey).toEqual(legacyQuantities)
    }
  })
})
