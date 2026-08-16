import { describe, expect, it } from 'vitest'
import { evaluatePkReadiness, toPkMilligrams } from './pkReadiness'

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
  it('normalizes only mg and mcg', () => {
    expect(toPkMilligrams(1, 'mg')).toBe(1)
    expect(toPkMilligrams(1000, 'mcg')).toBe(1)
    expect(toPkMilligrams(5000, 'IU')).toBeNull()
  })
})
