import { describe, expect, it } from 'vitest'
import type { PlanScheduleSnapshot } from '../../../lib/planTimeline'
import { adoptSchedule, sameSchedule, stepsToAdopt, type LaterPlanStep } from './planAdoption'

function snapshot(changes: Partial<PlanScheduleSnapshot> = {}): PlanScheduleSnapshot {
  return {
    frequency: 'Wochentage wählen',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: ['Mo', 'Mi', 'Fr'],
    intake_time: 'morgens',
    intake_time_custom: '08:00',
    slot_doses: null,
    slot_days: null,
    dose: 250,
    unit: 'mcg',
    method: 'Subkutan',
    ...changes,
  }
}

function step(id: string, date: string, changes: Partial<PlanScheduleSnapshot> = {}): LaterPlanStep {
  return { versionId: id, effectiveLocalDate: date, effectiveAt: null, changeKind: 'titration', snapshot: snapshot(changes) }
}

const now = new Date('2026-09-26T08:00:00.000Z')
const base = snapshot()
const daily = snapshot({ frequency: 'Täglich', schedule_days: [] })

describe('stepsToAdopt', () => {
  it('offers nothing when only amounts changed', () => {
    expect(stepsToAdopt({ base, changed: snapshot({ dose: 500 }), laterSteps: [step('a', '2026-10-06', { dose: 500 })], boundary: null, now })).toEqual([])
  })

  it('offers the later dose steps that still carry the old plan', () => {
    const laterSteps = [step('b', '2026-10-20', { dose: 750 }), step('a', '2026-10-06', { dose: 500 })]
    expect(stepsToAdopt({ base, changed: daily, laterSteps, boundary: null, now }).map(s => s.versionId)).toEqual(['a', 'b'])
  })

  it('stops at the first step with a plan of its own', () => {
    const laterSteps = [
      step('a', '2026-10-06', { dose: 500 }),
      step('b', '2026-10-20', { intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00' }),
      step('c', '2026-11-03', { dose: 750 }),
    ]
    expect(stepsToAdopt({ base, changed: daily, laterSteps, boundary: null, now }).map(s => s.versionId)).toEqual(['a'])
  })

  it('only looks behind the chosen day and never at the step being edited', () => {
    const laterSteps = [step('a', '2026-10-06'), step('b', '2026-10-20')]
    expect(stepsToAdopt({ base, changed: daily, laterSteps, boundary: '2026-10-06', now }).map(s => s.versionId)).toEqual(['b'])
    expect(stepsToAdopt({ base, changed: daily, laterSteps, boundary: '2026-10-01', exceptVersionId: 'a', now }).map(s => s.versionId)).toEqual(['b'])
  })
})

describe('adoptSchedule', () => {
  it('takes days and method from the new plan and keeps the step amounts', () => {
    const merged = adoptSchedule({ ...daily, method: 'Intramuskulär' }, snapshot({ dose: 500 }))
    expect(merged).toMatchObject({ frequency: 'Täglich', schedule_days: [], method: 'Intramuskulär', dose: 500, unit: 'mcg' })
    expect(sameSchedule(merged, { ...daily, method: 'Intramuskulär' })).toBe(true)
  })

  it('keeps each existing intake amount and gives a new intake the amount from the new plan', () => {
    const plan = snapshot({ intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00', slot_doses: '250,100' })
    const later = snapshot({ slot_doses: '500', dose: 500 })
    expect(adoptSchedule(plan, later)).toMatchObject({ intake_time: 'morgens,abends', slot_doses: '500,100', dose: 500 })
  })

  it('drops an intake the new plan no longer has', () => {
    const plan = snapshot({ intake_time: 'abends', intake_time_custom: '20:00' })
    const later = snapshot({ intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00', slot_doses: '500,300' })
    expect(adoptSchedule(plan, later)).toMatchObject({ intake_time: 'abends', slot_doses: '300' })
  })

  it('falls back to the step amount for a new intake in another unit', () => {
    const plan = snapshot({ intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00', unit: 'mg', dose: 1 })
    expect(adoptSchedule(plan, snapshot({ dose: 500 })).slot_doses).toBeNull()
  })
})
