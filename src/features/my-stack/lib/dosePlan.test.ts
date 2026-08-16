import { describe, expect, it } from 'vitest'
import type { RoutineConfirmationEntry } from '../../routines/intakeGroups'
import type { ScheduleCycle } from '../../../lib/intakeSchedule'
import {
  buildOneOffActualDose,
  buildPermanentScheduleChange,
  buildTitrationStep,
  dosePlanCapabilities,
} from './dosePlan'

const entry: RoutineConfirmationEntry = {
  key: 'stack-1:2026-08-20T08:00:00.000Z',
  cycleId: 'cycle-1',
  pendingLogId: null,
  stackItemId: 'stack-1',
  stackItemName: 'Test',
  trackingLevel: 'with_amount',
  group: 'morning',
  scheduledAt: '2026-08-20T08:00:00.000Z',
  dose: 10,
  unit: 'mg',
  method: 'Oral',
  injectable: false,
  selected: true,
  actualDose: 10,
  actualUnit: 'mg',
}

const cycle: ScheduleCycle = {
  id: 'cycle-1',
  stack_item_id: 'stack-1',
  start_date: '2026-08-01',
  end_date: null,
  frequency: 'Täglich',
  x_days_interval: null,
  schedule_days: null,
  intake_time: 'morgens',
  intake_time_custom: null,
  dose: 10,
  unit: 'mg',
  schedule_history: [{
    effective_from: '2026-08-01',
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    intake_time: 'morgens',
    intake_time_custom: null,
    dose: 10,
    unit: 'mg',
  }],
}

describe('dosePlanCapabilities', () => {
  it('offers all dose planning modes for with_amount and complete', () => {
    expect(dosePlanCapabilities('with_amount')).toEqual({
      oneOff: true,
      permanent: true,
      titration: true,
    })
    expect(dosePlanCapabilities('complete').titration).toBe(true)
    expect(dosePlanCapabilities('intake_only').titration).toBe(false)
  })
})

describe('dose-plan builders', () => {
  it('changes only the selected confirmation for a one-off amount', () => {
    const result = buildOneOffActualDose(entry, { dose: 12.5, unit: 'mg' })

    expect(result.actualDose).toBe(12.5)
    expect(result.actualUnit).toBe('mg')
    expect(result.cycleUpdate).toBeUndefined()
    expect(entry.actualDose).toBe(10)
  })

  it('appends or replaces a permanent future segment while preserving earlier history', () => {
    const appended = buildPermanentScheduleChange(cycle, {
      trackingLevel: 'complete',
      effectiveFrom: '2026-08-20',
      dose: 12.5,
      unit: 'mg',
    })
    const replaced = buildPermanentScheduleChange(appended, {
      trackingLevel: 'complete',
      effectiveFrom: '2026-08-20',
      dose: 15,
      unit: 'mg',
    })

    expect(appended.schedule_history).toEqual([
      cycle.schedule_history?.[0],
      expect.objectContaining({ effective_from: '2026-08-20', dose: 12.5, unit: 'mg' }),
    ])
    expect(replaced.schedule_history).toHaveLength(2)
    expect(replaced.schedule_history?.[1]).toEqual(expect.objectContaining({
      effective_from: '2026-08-20',
      dose: 15,
      unit: 'mg',
    }))
    expect(cycle.schedule_history).toHaveLength(1)
  })

  it('derives the stored additive titration amount from the absolute target', () => {
    expect(buildTitrationStep({
      trackingLevel: 'with_amount',
      cycleId: 'cycle-1',
      targetDose: 12.5,
      effectiveDose: 11,
      unit: 'mg',
      startType: 'date',
      startDate: '2026-08-20',
      startAfterDays: null,
    })).toEqual({
      cycle_id: 'cycle-1',
      increase_amount: 1.5,
      unit: 'mg',
      start_type: 'date',
      start_date: '2026-08-20',
      start_after_days: null,
    })
  })

  it.each(['one-off', 'permanent', 'titration'] as const)(
    'rejects %s planning for intake-only tracking',
    operation => {
      if (operation === 'one-off') {
        expect(() => buildOneOffActualDose({ ...entry, trackingLevel: 'intake_only' }, { dose: 12.5, unit: 'mg' })).toThrow()
      } else if (operation === 'permanent') {
        expect(() => buildPermanentScheduleChange(cycle, {
          trackingLevel: 'intake_only', effectiveFrom: '2026-08-20', dose: 12.5, unit: 'mg',
        })).toThrow()
      } else {
        expect(() => buildTitrationStep({
          trackingLevel: 'intake_only', cycleId: 'cycle-1', targetDose: 12.5,
          effectiveDose: 10, unit: 'mg', startType: 'date', startDate: '2026-08-20', startAfterDays: null,
        })).toThrow()
      }
    },
  )

  it('rejects every dose-plan operation when its effective base dose is unknown', () => {
    expect(() => buildOneOffActualDose({ ...entry, dose: null }, { dose: 12.5, unit: 'mg' })).toThrow()
    expect(() => buildPermanentScheduleChange({ ...cycle, dose: null, schedule_history: null }, {
      trackingLevel: 'complete', effectiveFrom: '2026-08-20', dose: 12.5, unit: 'mg',
    })).toThrow()
    expect(() => buildTitrationStep({
      trackingLevel: 'complete', cycleId: 'cycle-1', targetDose: 12.5,
      effectiveDose: null, unit: 'mg', startType: 'date', startDate: '2026-08-20', startAfterDays: null,
    })).toThrow()
  })
})
