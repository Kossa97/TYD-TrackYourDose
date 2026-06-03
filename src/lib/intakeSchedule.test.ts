import { describe, it, expect } from 'vitest'
import {
  findOldestOverdueIntake, scheduleForDay, effectiveDose,
  type ScheduleCycle, type IntakeLog, type ScheduleSegment, type EscalationRow,
} from './intakeSchedule'

// ── Fixtures ────────────────────────────────────────────────────────────────
const seg = (effective_from: string, intake_time: string, dose: number): ScheduleSegment => ({
  effective_from, frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time, intake_time_custom: null, dose, unit: 'mcg',
})
const seg2 = (effective_from: string, intake_time: string): ScheduleSegment =>
  seg(effective_from, intake_time, 200)

// Versioned: 1x (morgens, 200) until 2026-03-01, then 2x (morgens,abends, 300).
const versioned: ScheduleCycle = {
  id: 'c1', peptide_id: 'p1', start_date: '2026-01-01', end_date: null,
  frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time: 'morgens,abends', intake_time_custom: null, dose: 300, unit: 'mcg',
  schedule_history: [seg('2026-01-01', 'morgens', 200), seg('2026-03-01', 'morgens,abends', 300)],
}

// 2x daily cycle starting today, no history — for the per-slot overdue tests.
const cycle: ScheduleCycle = {
  id: 'c1', peptide_id: 'p1', start_date: '2026-06-03', end_date: null,
  frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time: 'morgens,abends', intake_time_custom: null,
  dose: 200, unit: 'mcg', schedule_history: null,
}
const names = new Map([['p1', 'Ipamorelin']])
const log = (taken: boolean | null, time: string): IntakeLog => ({ peptide_id: 'p1', logged_at: `2026-06-03T${time}`, taken })

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

// ── effectiveDose ──────────────────────────────────────────────────────────────
describe('effectiveDose mit versionierter Basis-Dosis + Eskalation', () => {
  const esc: EscalationRow = { cycle_id: 'c1', increase_amount: 50, start_type: 'after_days', start_date: null, start_after_days: 14 }
  it('Basis aus Segment + aktive Eskalation', () => {
    expect(effectiveDose(versioned, new Date(2026, 0, 5), [esc])).toBe(200)   // Tag 4, keine Eskalation
    expect(effectiveDose(versioned, new Date(2026, 0, 20), [esc])).toBe(250)  // Tag 19, +50
    expect(effectiveDose(versioned, new Date(2026, 5, 1), [esc])).toBe(350)   // Segment 300 + 50
  })
})

// ── findOldestOverdueIntake: mehrere Einnahmen pro Tag ──────────────────────────
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

// ── findOldestOverdueIntake: Frequenzwechsel gilt ab Aenderung ──────────────────
describe('findOldestOverdueIntake — Frequenzwechsel gilt ab Aenderung', () => {
  // 1x täglich (morgens) ab 2026-05-01, ab 2026-06-03 auf 2x (morgens,abends).
  const changed: ScheduleCycle = {
    id: 'c2', peptide_id: 'p2', start_date: '2026-05-01', end_date: null,
    frequency: '2x täglich', x_days_interval: null, schedule_days: null,
    intake_time: 'morgens,abends', intake_time_custom: null, dose: 200, unit: 'mcg',
    schedule_history: [seg2('2026-05-01', 'morgens'), seg2('2026-06-03', 'morgens,abends')],
  }
  const names2 = new Map([['p2', 'CJC-1295']])
  const lg = (pid: string, day: string, time: string, taken: boolean | null): IntakeLog =>
    ({ peptide_id: pid, logged_at: `${day}T${time}`, taken })

  // lookbackDays=0 isolates the target day (the function otherwise returns the
  // OLDEST overdue across history, which here would be unlogged May mornings).
  it('vor dem Wechsel keine zweite (Abend-)Faelligkeit', () => {
    const now = new Date(2026, 4, 20, 23, 0)
    expect(findOldestOverdueIntake([changed], [lg('p2', '2026-05-20', '08:30:00', true)], names2, now, 0)).toBeNull()
  })
  it('ab dem Wechsel wird die Abenddosis faellig', () => {
    const now = new Date(2026, 5, 3, 21, 0)
    const overdue = findOldestOverdueIntake([changed], [lg('p2', '2026-06-03', '08:30:00', true)], names2, now, 0)
    expect(overdue?.time).toBe('20:00')
  })
})
