import { describe, expect, it } from 'vitest'
import { buildDoseAdjustmentBackfillUpdates, type DoseAdjustmentBackfillLog } from './doseAdjustmentBackfill'
import type { EscalationRow, ScheduleCycle } from './intakeSchedule'

const cycle: ScheduleCycle = {
  id: 'c1',
  stack_item_id: 'p1',
  start_date: '2026-06-01',
  end_date: '2026-06-30',
  frequency: 'Taeglich',
  x_days_interval: null,
  schedule_days: null,
  intake_time: 'morgens',
  intake_time_custom: null,
  dose: 200,
  unit: 'mcg',
  schedule_history: null,
}

const adjustment: EscalationRow = {
  cycle_id: 'c1',
  increase_amount: 100,
  unit: 'mcg',
  start_type: 'date',
  start_date: '2026-06-10',
  start_after_days: null,
}

const log = (
  id: string,
  logged_at: string,
  taken: boolean | null,
  stack_item_id = 'p1',
  dose: number | null = 200,
  unit: string | null = 'mcg',
): DoseAdjustmentBackfillLog => ({
  id,
  stack_item_id,
  logged_at,
  taken,
  dose,
  unit,
})

describe('buildDoseAdjustmentBackfillUpdates', () => {
  it('updates non-confirmed affected logs and leaves confirmed intakes untouched', () => {
    const updates = buildDoseAdjustmentBackfillUpdates(cycle, [adjustment], [
      log('before-adjustment', '2026-06-09T08:00:00.000Z', false),
      log('missed', '2026-06-10T08:00:00.000Z', false),
      log('open', '2026-06-11T08:00:00.000Z', null),
      log('confirmed', '2026-06-12T08:00:00.000Z', true),
      log('unquantified', '2026-06-12T09:00:00.000Z', false, 'p1', null, null),
      log('other-peptide', '2026-06-13T08:00:00.000Z', false, 'p2'),
      log('after-cycle', '2026-07-01T08:00:00.000Z', false),
    ])

    expect(updates).toEqual([
      { id: 'missed', dose: 300, unit: 'mcg' },
      { id: 'open', dose: 300, unit: 'mcg' },
    ])
  })

  it('backfills open and skipped quantified logs after a permanent schedule change only', () => {
    const changedCycle: ScheduleCycle = {
      ...cycle,
      schedule_history: [
        {
          effective_from: '2026-06-01',
          frequency: cycle.frequency,
          x_days_interval: cycle.x_days_interval,
          schedule_days: cycle.schedule_days,
          intake_time: cycle.intake_time,
          intake_time_custom: cycle.intake_time_custom,
          dose: 200,
          unit: 'mcg',
        },
        {
          effective_from: '2026-06-10',
          frequency: cycle.frequency,
          x_days_interval: cycle.x_days_interval,
          schedule_days: cycle.schedule_days,
          intake_time: cycle.intake_time,
          intake_time_custom: cycle.intake_time_custom,
          dose: 250,
          unit: 'mcg',
        },
      ],
    }

    const updates = buildDoseAdjustmentBackfillUpdates(changedCycle, [], [
      log('before-change', '2026-06-09T08:00:00.000Z', false),
      log('skipped', '2026-06-10T08:00:00.000Z', false),
      log('open', '2026-06-11T08:00:00.000Z', null),
      log('taken', '2026-06-12T08:00:00.000Z', true),
      log('unquantified', '2026-06-13T08:00:00.000Z', null, 'p1', null, null),
    ], [], '2026-06-10')

    expect(updates).toEqual([
      { id: 'skipped', dose: 250, unit: 'mcg' },
      { id: 'open', dose: 250, unit: 'mcg' },
    ])
  })

  it('uses all adjustments for the new dose but only the changed adjustment for the affected range', () => {
    const earlierAdjustment: EscalationRow = {
      cycle_id: 'c1',
      increase_amount: 50,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-06-05',
      start_after_days: null,
    }
    const changedAdjustment: EscalationRow = {
      cycle_id: 'c1',
      increase_amount: 100,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-06-10',
      start_after_days: null,
    }

    const updates = buildDoseAdjustmentBackfillUpdates(cycle, [earlierAdjustment, changedAdjustment], [
      log('only-earlier-adjustment', '2026-06-06T08:00:00.000Z', false),
      log('changed-adjustment', '2026-06-10T08:00:00.000Z', false),
    ], [changedAdjustment])

    expect(updates).toEqual([
      { id: 'changed-adjustment', dose: 350, unit: 'mcg' },
    ])
  })

  it('can include the old adjustment start when an existing adjustment is moved later', () => {
    const oldAdjustment: EscalationRow = {
      cycle_id: 'c1',
      increase_amount: 100,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-06-05',
      start_after_days: null,
    }
    const movedAdjustment: EscalationRow = {
      cycle_id: 'c1',
      increase_amount: 100,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-06-10',
      start_after_days: null,
    }

    const updates = buildDoseAdjustmentBackfillUpdates(cycle, [movedAdjustment], [
      log('old-window', '2026-06-06T08:00:00.000Z', false),
      log('new-window', '2026-06-10T08:00:00.000Z', false),
    ], [oldAdjustment, movedAdjustment])

    expect(updates).toEqual([
      { id: 'old-window', dose: 200, unit: 'mcg' },
      { id: 'new-window', dose: 300, unit: 'mcg' },
    ])
  })
})

describe('buildDoseAdjustmentBackfillUpdates with unknown quantity', () => {
  it('does not write an update when the effective quantity is unknown', () => {
    const updates = buildDoseAdjustmentBackfillUpdates({
      ...cycle,
      dose: null,
      unit: null,
    }, [adjustment], [log('unknown-quantity', '2026-06-10T08:00:00.000Z', false)])

    expect(updates).toEqual([])
  })

  it('does not write an update when the active segment unit is unknown', () => {
    const updates = buildDoseAdjustmentBackfillUpdates({
      ...cycle,
      schedule_history: [{
        effective_from: '2026-06-01',
        frequency: 'Taeglich',
        x_days_interval: null,
        schedule_days: null,
        intake_time: 'morgens',
        intake_time_custom: null,
        dose: 200,
        unit: null,
      }],
    }, [adjustment], [log('unknown-unit', '2026-06-10T08:00:00.000Z', false)])

    expect(updates).toEqual([])
  })

  it('does not write an update when the active segment unit is blank', () => {
    const updates = buildDoseAdjustmentBackfillUpdates({
      ...cycle,
      schedule_history: [{
        effective_from: '2026-06-01',
        frequency: 'Taeglich',
        x_days_interval: null,
        schedule_days: null,
        intake_time: 'morgens',
        intake_time_custom: null,
        dose: 200,
        unit: ' ',
      }],
    }, [adjustment], [log('blank-unit', '2026-06-10T08:00:00.000Z', false)])

    expect(updates).toEqual([])
  })
})
