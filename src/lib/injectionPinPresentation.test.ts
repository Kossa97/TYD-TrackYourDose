import { describe, expect, it } from 'vitest'
import type { InjectionLog3D } from './injectionLogTypes'
import {
  formatInjectionPinAge,
  getInjectionPinAgeColor,
  getInjectionPinSubstance,
} from './injectionPinPresentation'

const now = new Date('2026-06-30T12:00:00.000Z')

function log(overrides: Partial<InjectionLog3D>): InjectionLog3D {
  return {
    id: 'log-1',
    user_id: 'user-1',
    dose_log_id: null,
    peptide_id: null,
    cycle_id: null,
    peptide_name: null,
    cycle_name: null,
    dose: null,
    unit: null,
    method: null,
    notes: null,
    logged_at: '2026-06-24T20:00:00.000Z',
    created_at: null,
    warning_state: null,
    model_version: 'placeholder-v1',
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    body_region: 'abdomen',
    body_side: 'right',
    ...overrides,
  }
}

describe('injection pin presentation', () => {
  it('formats pin age as a compact German label', () => {
    expect(formatInjectionPinAge('2026-06-30T08:00:00.000Z', now)).toBe('heute')
    expect(formatInjectionPinAge('2026-06-29T20:00:00.000Z', now)).toBe('vor 1 Tag')
    expect(formatInjectionPinAge('2026-06-24T20:00:00.000Z', now)).toBe('vor 6 Tagen')
  })

  it('moves pin colors from fresh red through warm colors to old green', () => {
    expect(getInjectionPinAgeColor('2026-06-30T08:00:00.000Z', now)).toBe('#ef4444')
    expect(getInjectionPinAgeColor('2026-06-28T20:00:00.000Z', now)).toBe('#f97316')
    expect(getInjectionPinAgeColor('2026-06-25T20:00:00.000Z', now)).toBe('#facc15')
    expect(getInjectionPinAgeColor('2026-06-20T20:00:00.000Z', now)).toBe('#22c55e')
  })

  it('uses the peptide name for the pin label and falls back to the saved substance label', () => {
    expect(getInjectionPinSubstance(log({ peptide_name: 'Ipamorelin', substance_label: 'Backup' }))).toBe('Ipamorelin')
    expect(getInjectionPinSubstance(log({ substance_label: 'CJC-1295 DAC' }))).toBe('CJC-1295 DAC')
    expect(getInjectionPinSubstance(log({}))).toBe('Injektion')
  })
})
