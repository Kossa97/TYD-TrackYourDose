import { describe, expect, it } from 'vitest'
import { evaluatePkReadiness, resolvePkScheduleForDay, toPkMilligrams } from './pkReadiness'
import type { EscalationRow, ScheduleCycle } from '../../../lib/intakeSchedule'

const readyInput = {
  trackingLevel: 'complete' as const,
  pkProfileId: 'profile-1',
  pkProfileMethod: 'Subkutan',
  method: 'Subkutan',
  dose: 1,
  unit: 'mg',
  scheduledAt: '08:00',
}

describe('evaluatePkReadiness', () => {
  it('requires complete tracking', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      trackingLevel: 'with_amount',
    })).toEqual({ status: 'missing', missing: ['complete_tracking'] })
  })

  it('reports every missing requirement alongside incomplete tracking', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      trackingLevel: 'with_amount',
      pkProfileMethod: null,
      dose: null,
      unit: null,
      scheduledAt: null,
    })).toEqual({
      status: 'missing',
      missing: ['complete_tracking', 'method', 'dose', 'unit', 'time'],
    })
  })

  it('reports unsupported when no profile exists', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      pkProfileId: null,
    })).toEqual({ status: 'unsupported', reason: 'no_profile' })
  })

  it('reports the exact missing route, dose, unit, and time', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      pkProfileMethod: null,
      dose: null,
      unit: null,
      scheduledAt: null,
    })).toEqual({
      status: 'missing',
      missing: ['method', 'dose', 'unit', 'time'],
    })
  })

  it('requires the confirmed PK method to match the active plan method', () => {
    expect(evaluatePkReadiness({
      ...readyInput,
      pkProfileMethod: 'Oral',
    })).toEqual({ status: 'missing', missing: ['method'] })
  })

  it('rejects units without an explicit conservative conversion', () => {
    expect(evaluatePkReadiness({ ...readyInput, unit: 'IU' })).toEqual({
      status: 'unsupported',
      reason: 'unit_conversion',
    })
  })

  it('reports ready only when every PK requirement is satisfied', () => {
    expect(evaluatePkReadiness(readyInput)).toEqual({ status: 'ready' })
  })
})

describe('toPkMilligrams', () => {
  it('normalizes mg and mcg without help', () => {
    expect(toPkMilligrams(1, 'mg')).toBe(1)
    expect(toPkMilligrams(1000, 'mcg')).toBe(1)
  })

  it('rechnet IU um, sobald die Substanz ihren Faktor mitbringt', () => {
    // Eine Internationale Einheit ist keine Masse, sondern eine biologische
    // Wirkstaerke — der Faktor haengt an der Substanz. HGH: 3 IU je mg.
    expect(toPkMilligrams(6, 'IU', 3)).toBe(2)
    // HCG: rund 10.000 IU je mg.
    expect(toPkMilligrams(5000, 'IU', 10000)).toBe(0.5)
    expect(toPkMilligrams(5000, 'iu', 10000)).toBe(0.5)
  })

  it('bleibt bei null, solange kein brauchbarer Faktor dasteht', () => {
    // Vor dieser Runde fielen HCG und HGH genau hier durch — mit dem
    // Unterschied, dass es gar keinen Faktor geben konnte.
    expect(toPkMilligrams(5000, 'IU')).toBeNull()
    expect(toPkMilligrams(5000, 'IU', null)).toBeNull()
    expect(toPkMilligrams(5000, 'IU', 0)).toBeNull()
    expect(toPkMilligrams(5000, 'IU', -3)).toBeNull()
    expect(toPkMilligrams(5000, 'IU', Number.NaN)).toBeNull()
  })

  it('laesst einen Faktor Einheiten unberuehrt, die keine IU sind', () => {
    // Der Faktor gilt der Umrechnung von IU. Auf ml oder Kapseln angewendet
    // waere er eine erfundene Masse.
    expect(toPkMilligrams(2, 'ml', 10000)).toBeNull()
    expect(toPkMilligrams(1, 'capsule', 3)).toBeNull()
    expect(toPkMilligrams(1, 'mg', 3)).toBe(1)
  })
})

describe('resolvePkScheduleForDay', () => {
  const cycle: ScheduleCycle & { method: string } = {
    id: 'cycle-1',
    stack_item_id: 'stack-1',
    start_date: '2026-08-01',
    end_date: null,
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: [],
    intake_time: 'custom',
    intake_time_custom: '08:00',
    dose: 1,
    unit: 'mg',
    method: 'Subkutan',
    schedule_history: [{
      effective_from: '2026-08-01',
      frequency: 'Täglich',
      x_days_interval: null,
      schedule_days: [],
      intake_time: 'custom',
      intake_time_custom: '08:00',
      dose: 1,
      unit: 'mg',
    }, {
      effective_from: '2026-08-20',
      frequency: 'Wöchentlich',
      x_days_interval: null,
      schedule_days: [],
      intake_time: 'custom',
      intake_time_custom: '09:30',
      dose: 2,
      unit: 'mg',
    }],
  }

  it.each([
    {
      label: 'before a future effective date',
      day: new Date(2026, 7, 19, 12),
      expected: { dose: 1, unit: 'mg', scheduledAt: '08:00', frequency: 'Täglich' },
    },
    {
      label: 'on the future effective date',
      day: new Date(2026, 7, 20, 12),
      expected: { dose: 2, unit: 'mg', scheduledAt: '09:30', frequency: 'Wöchentlich' },
    },
  ])('uses the date-effective segment $label', ({ day, expected }) => {
    expect(resolvePkScheduleForDay(cycle, [], day)).toMatchObject({
      ...expected,
      method: 'Subkutan',
    })
  })

  it('rejects an active escalation whose unit differs from the effective segment', () => {
    const escalations: EscalationRow[] = [{
      cycle_id: cycle.id,
      increase_amount: 500,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-08-20',
      start_after_days: null,
    }]

    expect(resolvePkScheduleForDay(cycle, escalations, new Date(2026, 7, 20, 12)))
      .toMatchObject({ dose: null, unit: null, scheduledAt: '09:30', frequency: 'Wöchentlich' })
  })
})
