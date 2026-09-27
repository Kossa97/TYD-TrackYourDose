import { describe, expect, it } from 'vitest'
import type { PlanScheduleSnapshot } from '../../../lib/planTimeline'
import type { IntakePlanDraft } from '../types'
import { adoptSchedule, buildReview, reviewedSnapshot, reviewStepChanged, sameSchedule, stepsAround, stepsToAdopt, type LaterPlanStep } from './planAdoption'

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
  return { versionId: id, effectiveLocalDate: date, changeKind: 'titration', snapshot: snapshot(changes), draft: { id } as IntakePlanDraft }
}

const base = snapshot()
const daily = snapshot({ frequency: 'Täglich', schedule_days: [] })

describe('stepsAround', () => {
  const laterSteps = [step('b', '2026-10-20'), step('a', '2026-10-06')]

  it('puts every planned step behind a change from now', () => {
    expect(stepsAround({ laterSteps, boundary: null })).toMatchObject({ before: null, after: [{ versionId: 'a' }, { versionId: 'b' }] })
  })

  it('finds the planned step a chosen day falls into', () => {
    const around = stepsAround({ laterSteps, boundary: '2026-10-10' })
    expect(around.before?.versionId).toBe('a')
    expect(around.after.map(s => s.versionId)).toEqual(['b'])
  })

  it('leaves out the step being edited', () => {
    expect(stepsAround({ laterSteps, boundary: '2026-10-06', exceptVersionId: 'a' })).toMatchObject({ before: null, after: [{ versionId: 'b' }] })
  })
})

describe('stepsToAdopt', () => {
  it('adopts nothing when only amounts changed', () => {
    expect(stepsToAdopt({ base, changed: snapshot({ dose: 500 }), after: [step('a', '2026-10-06', { dose: 500 })] })).toEqual([])
  })

  it('adopts the steps that still carry the old plan and stops at one with a plan of its own', () => {
    const after = [
      step('a', '2026-10-06', { dose: 500 }),
      step('b', '2026-10-20', { intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00' }),
      step('c', '2026-11-03', { dose: 750 }),
    ]
    expect(stepsToAdopt({ base, changed: daily, after }).map(s => s.versionId)).toEqual(['a'])
  })
})

describe('buildReview', () => {
  it('shows each later step with the new plan, its own amounts and the new intake marked', () => {
    const changed = snapshot({ intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00' })
    const [review] = buildReview({ base, changed, after: [step('a', '2026-10-12', { dose: 500 })] })
    expect(review).toMatchObject({ adopts: true, ownPlan: false, date: '2026-10-12', newSlotIds: ['abends#0'], amounts: { 'morgens#0': '500', 'abends#0': '250' } })
    expect(reviewStepChanged(review, reviewedSnapshot(review)!)).toBe(true)
  })

  it('keeps a step with a plan of its own as it is, and unchanged unless edited', () => {
    const own = step('b', '2026-10-20', { intake_time: 'abends', intake_time_custom: '20:00', dose: 400 })
    const [review] = buildReview({ base, changed: daily, after: [own] })
    expect(review).toMatchObject({ adopts: false, ownPlan: true, newSlotIds: [], amounts: { 'abends#0': '400' } })
    expect(reviewStepChanged(review, reviewedSnapshot(review)!)).toBe(false)
    expect(reviewStepChanged({ ...review, date: '2026-10-21' }, reviewedSnapshot(review)!)).toBe(true)
  })

  it('takes edited amounts, with comma or point, and refuses an empty one', () => {
    const changed = snapshot({ intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00' })
    const [review] = buildReview({ base, changed, after: [step('a', '2026-10-12', { dose: 500 })] })
    expect(reviewedSnapshot({ ...review, amounts: { 'morgens#0': '500', 'abends#0': '2,5' } })).toMatchObject({ dose: 500, slot_doses: '500,2.5' })
    expect(reviewedSnapshot({ ...review, amounts: { 'morgens#0': '500', 'abends#0': '' } })).toBeNull()
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
    // Die fuehrende Menge ist die der verbliebenen Einnahme, keine Liste fuer eine einzige.
    expect(adoptSchedule(plan, later)).toMatchObject({ intake_time: 'abends', slot_doses: null, dose: 300 })
  })

  it('keeps a step with one amount for all intakes on that amount', () => {
    const plan = snapshot({ intake_time: 'morgens,abends,mittags', intake_time_custom: '08:00,20:00,12:00', slot_doses: '250,250,100' })
    const later = snapshot({ intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00', dose: 500 })
    expect(adoptSchedule(plan, later)).toMatchObject({ slot_doses: '500,500,100', dose: 500 })
  })

  it('falls back to the step amount for a new intake in another unit', () => {
    const plan = snapshot({ intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00', unit: 'mg', dose: 1 })
    expect(adoptSchedule(plan, snapshot({ dose: 500 })).slot_doses).toBeNull()
  })
})
