import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildHomeDoseLogPayload, resolveHomeIntakeQuantity } from './Home'

describe('Home upcoming intake confirmation flow', () => {
  it('asks how to confirm an upcoming intake before opening linked flows', () => {
    const source = readFileSync(new URL('./Home.tsx', import.meta.url), 'utf8')

    expect(source).toContain('selectedHomeIntake')
    expect(source).toContain('HomeIntakeConfirmSheet')
    expect(source).toContain('Wie möchtest du bestätigen?')
    expect(source).toContain('HomeIntakeTimeSheet')
    expect(source).toContain('Wann hast du tatsächlich eingenommen?')
    expect(source).toContain('openHomeIntakeTimeForm(selectedHomeIntake)')
    expect(source).toContain('confirmHomeIntake(selectedHomeIntake, true, homeConfirmTime)')
    expect(source).toContain('confirmHomeIntake(selectedHomeIntake, false)')
    expect(source).toContain('openHomeIntakeInjection(selectedHomeIntake)')
    expect(source).not.toContain('onTaken={() => confirmHomeIntake(selectedHomeIntake, true)}')
    expect(source).not.toContain('const openTodayIntake = (intake: TodayIntake) => {\n    if (isInjectableMethod(intake.method))')
  })

  it('uses the active schedule segment quantity and supplied unit label for today', () => {
    const quantity = resolveHomeIntakeQuantity({
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      start_date: '2026-07-01',
      end_date: null,
      frequency: 'Taeglich',
      x_days_interval: null,
      schedule_days: null,
      intake_time: 'morgens',
      intake_time_custom: null,
      dose: 1,
      unit: 'tablet',
      schedule_history: [{
        effective_from: '2026-07-20',
        frequency: 'Taeglich',
        x_days_interval: null,
        schedule_days: null,
        intake_time: 'morgens',
        intake_time_custom: null,
        dose: 0.5,
        unit: 'Tablette',
      }],
    }, new Date('2026-07-29T08:00:00'), [])

    expect(quantity).toEqual({
      doseNumber: 0.5,
      unit: 'Tablette',
      dose: '\u00BD Tablette',
    })
  })

  it('keeps an unknown active schedule quantity nullable for today', () => {
    const quantity = resolveHomeIntakeQuantity({
      id: 'cycle-1',
      stack_item_id: 'stack-1',
      start_date: '2026-07-01',
      end_date: null,
      frequency: 'Taeglich',
      x_days_interval: null,
      schedule_days: null,
      intake_time: 'morgens',
      intake_time_custom: null,
      dose: 100,
      unit: 'mcg',
      schedule_history: [{
        effective_from: '2026-07-20',
        frequency: 'Taeglich',
        x_days_interval: null,
        schedule_days: null,
        intake_time: 'morgens',
        intake_time_custom: null,
        dose: null,
        unit: null,
      }],
    }, new Date('2026-07-29T08:00:00'), [])

    expect(quantity).toEqual({ doseNumber: null, unit: null, dose: null })
  })

  it('builds an unknown taken log with null quantity and the chosen timestamp', () => {
    const payload = buildHomeDoseLogPayload({
      userId: 'user-1',
      stackItemId: 'stack-1',
      doseNumber: null,
      unit: null,
      method: 'Oral',
      scheduledAt: '2026-07-29T06:00:00.000Z',
      taken: true,
      timeValue: '10:45',
    })

    expect(payload).toEqual({
      user_id: 'user-1',
      stack_item_id: 'stack-1',
      dose: null,
      unit: null,
      method: 'Oral',
      logged_at: '2026-07-29T08:45:00.000Z',
      taken: true,
    })
  })

  it('keeps skipped logs false when their quantity is unknown', () => {
    const payload = buildHomeDoseLogPayload({
      userId: 'user-1',
      stackItemId: 'stack-1',
      doseNumber: null,
      unit: null,
      method: null,
      scheduledAt: '2026-07-29T06:00:00.000Z',
      taken: false,
    })

    expect(payload).toEqual(expect.objectContaining({
      dose: null,
      unit: null,
      logged_at: '2026-07-29T06:00:00.000Z',
      taken: false,
    }))
  })
})
