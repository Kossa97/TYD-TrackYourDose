import { describe, it, expect } from 'vitest'
import { findOldestOverdueIntake, type ScheduleCycle, type IntakeLog } from './intakeSchedule'

// 2x daily cycle (morning + evening) starting today, so only today is in scope.
const today = '2026-06-03'
const cycle: ScheduleCycle = {
  id: 'c1',
  peptide_id: 'p1',
  start_date: today,
  end_date: null,
  frequency: '2x täglich',
  x_days_interval: null,
  schedule_days: null,
  intake_time: 'morgens,abends',
  intake_time_custom: null,
}
const names = new Map([['p1', 'Ipamorelin']])
const log = (taken: boolean | null, time: string): IntakeLog => ({ peptide_id: 'p1', logged_at: `${today}T${time}`, taken })

describe('findOldestOverdueIntake — multiple intakes per day', () => {
  it('flags the evening dose as overdue after the morning dose was taken', () => {
    const now = new Date(2026, 5, 3, 21, 0) // 21:00, after the 20:00 slot
    const overdue = findOldestOverdueIntake([cycle], [log(true, '08:30:00')], names, now)
    expect(overdue?.time).toBe('20:00')
    expect(overdue?.cycleId).toBe('c1')
  })

  it('does NOT flag the evening dose while it is still upcoming', () => {
    const now = new Date(2026, 5, 3, 15, 0) // 15:00, before the 20:00 slot
    expect(findOldestOverdueIntake([cycle], [log(true, '08:30:00')], names, now)).toBeNull()
  })

  it('returns null once both daily doses are decided', () => {
    const now = new Date(2026, 5, 3, 21, 0)
    expect(findOldestOverdueIntake([cycle], [log(true, '08:30:00'), log(true, '20:30:00')], names, now)).toBeNull()
  })

  it('a skipped dose also covers its slot', () => {
    const now = new Date(2026, 5, 3, 21, 0)
    expect(findOldestOverdueIntake([cycle], [log(false, '08:30:00'), log(true, '20:30:00')], names, now)).toBeNull()
  })
})
