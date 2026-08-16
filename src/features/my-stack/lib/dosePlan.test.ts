import { describe, expect, it } from 'vitest'
import type { RoutineConfirmationEntry } from '../../routines/intakeGroups'
import type { ScheduleCycle } from '../../../lib/intakeSchedule'
import { effectiveQuantity, scheduleForDay } from '../../../lib/intakeSchedule'
import {
  buildOneOffActualDose,
  buildPermanentScheduleChange,
  buildTitrationStep,
  dosePlanQuantitiesForDay,
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
    expect(replaced.dose).toBe(10)
    expect(replaced.unit).toBe('mg')
    expect(scheduleForDay(replaced, new Date(2026, 7, 19))).toMatchObject({ dose: 10, unit: 'mg' })
    expect(scheduleForDay(replaced, new Date(2026, 7, 20))).toMatchObject({ dose: 15, unit: 'mg' })
    expect(cycle.schedule_history).toHaveLength(1)
  })

  it('pairs the current schedule quantity and exposes future quantities as Geplant', () => {
    const changed = buildPermanentScheduleChange(cycle, {
      trackingLevel: 'complete', effectiveFrom: '2026-08-20', dose: 12.5, unit: 'mg',
    })

    expect(dosePlanQuantitiesForDay(changed, new Date(2026, 7, 19), [])).toEqual({
      current: { dose: 10, unit: 'mg' },
      planned: [{ effectiveFrom: '2026-08-20', dose: 12.5, unit: 'mg', status: 'Geplant' }],
    })
    expect(dosePlanQuantitiesForDay(changed, new Date(2026, 7, 20), [])).toEqual({
      current: { dose: 12.5, unit: 'mg' },
      planned: [],
    })
  })

  it('derives the stored additive titration amount from the absolute target', () => {
    expect(buildTitrationStep({
      trackingLevel: 'with_amount',
      cycleId: 'cycle-1',
      targetDose: 12.5,
      effectiveDose: 11,
      effectiveUnit: 'mg',
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
          effectiveDose: 10, effectiveUnit: 'mg', unit: 'mg', startType: 'date', startDate: '2026-08-20', startAfterDays: null,
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
      effectiveDose: null, effectiveUnit: 'mg', unit: 'mg', startType: 'date', startDate: '2026-08-20', startAfterDays: null,
    })).toThrow()
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid one-off targets (%s)',
    dose => expect(() => buildOneOffActualDose(entry, { dose, unit: 'mg' })).toThrow(),
  )

  it.each(['', ' ', 'mcg'])(
    'rejects one-off units that are blank or differ from the planned unit (%j)',
    unit => expect(() => buildOneOffActualDose(entry, { dose: 12.5, unit })).toThrow(),
  )

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid permanent targets (%s)',
    dose => expect(() => buildPermanentScheduleChange(cycle, {
      trackingLevel: 'complete', effectiveFrom: '2026-08-20', dose, unit: 'mg',
    })).toThrow(),
  )

  it.each(['', ' ', 'mcg'])(
    'rejects permanent units that are blank or differ from the effective base unit (%j)',
    unit => expect(() => buildPermanentScheduleChange(cycle, {
      trackingLevel: 'complete', effectiveFrom: '2026-08-20', dose: 12.5, unit,
    })).toThrow(),
  )

  it.each(['', 'not-a-date', '2026-02-30', '20.08.2026'])(
    'rejects invalid permanent effective dates (%j)',
    effectiveFrom => expect(() => buildPermanentScheduleChange(cycle, {
      trackingLevel: 'complete', effectiveFrom, dose: 12.5, unit: 'mg',
    })).toThrow(),
  )

  it('rejects titration when target and effective units differ', () => {
    expect(() => buildTitrationStep({
      trackingLevel: 'complete', cycleId: 'cycle-1', targetDose: 12.5,
      effectiveDose: 10, effectiveUnit: 'mcg', unit: 'mg',
      startType: 'date', startDate: '2026-08-20', startAfterDays: null,
    })).toThrow()
  })

  it('produces no savable titration payload when an active adjustment has a different unit', () => {
    const base = effectiveQuantity(cycle, new Date(2026, 7, 20), [{
      cycle_id: 'cycle-1',
      increase_amount: 5,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-08-10',
      start_after_days: null,
    }])
    const saved: unknown[] = []

    try {
      saved.push(buildTitrationStep({
        trackingLevel: 'complete', cycleId: 'cycle-1', targetDose: 12.5,
        effectiveDose: base?.dose ?? null, effectiveUnit: base?.unit ?? null, unit: 'mg',
        startType: 'date', startDate: '2026-08-20', startAfterDays: null,
      }))
    } catch {
      // A rejected builder means the persistence boundary receives no payload.
    }

    expect(base).toBeNull()
    expect(saved).toEqual([])
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid one-off bases (%s)',
    dose => expect(() => buildOneOffActualDose({ ...entry, dose }, { dose: 12.5, unit: 'mg' })).toThrow(),
  )

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid permanent bases (%s)',
    dose => expect(() => buildPermanentScheduleChange({
      ...cycle,
      schedule_history: [{ ...cycle.schedule_history![0], dose }],
    }, {
      trackingLevel: 'complete', effectiveFrom: '2026-08-20', dose: 12.5, unit: 'mg',
    })).toThrow(),
  )

  it.each(['', ' '])('rejects blank effective base units (%j)', effectiveUnit => {
    expect(() => buildTitrationStep({
      trackingLevel: 'complete', cycleId: 'cycle-1', targetDose: 12.5,
      effectiveDose: 10, effectiveUnit, unit: 'mg',
      startType: 'date', startDate: '2026-08-20', startAfterDays: null,
    })).toThrow()
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid titration targets (%s)',
    targetDose => expect(() => buildTitrationStep({
      trackingLevel: 'complete', cycleId: 'cycle-1', targetDose,
      effectiveDose: 10, effectiveUnit: 'mg', unit: 'mg',
      startType: 'date', startDate: '2026-08-20', startAfterDays: null,
    })).toThrow(),
  )

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid titration bases (%s)',
    effectiveDose => expect(() => buildTitrationStep({
      trackingLevel: 'complete', cycleId: 'cycle-1', targetDose: 12.5,
      effectiveDose, effectiveUnit: 'mg', unit: 'mg',
      startType: 'date', startDate: '2026-08-20', startAfterDays: null,
    })).toThrow(),
  )

  it.each([
    { startType: 'date' as const, startDate: '', startAfterDays: null },
    { startType: 'date' as const, startDate: '2026-02-30', startAfterDays: null },
    { startType: 'after_days' as const, startDate: null, startAfterDays: 0 },
    { startType: 'after_days' as const, startDate: null, startAfterDays: 1.5 },
    { startType: 'after_weeks' as const, startDate: null, startAfterDays: Number.NaN },
  ])('rejects an invalid titration gate ($startType)', gate => {
    expect(() => buildTitrationStep({
      trackingLevel: 'complete', cycleId: 'cycle-1', targetDose: 12.5,
      effectiveDose: 10, effectiveUnit: 'mg', unit: 'mg', ...gate,
    })).toThrow()
  })
})
