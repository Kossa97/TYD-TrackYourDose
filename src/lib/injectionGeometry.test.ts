// src/lib/injectionGeometry.test.ts
import { describe, expect, it } from 'vitest'
import {
  filterRecentInjectionLogs,
  inferBodyRegion,
  proximityWarning,
} from './injectionGeometry'
import type { InjectionLog3D, InjectionPinDraft } from './injectionLogTypes'

const baseLog = (overrides: Partial<InjectionLog3D>): InjectionLog3D => ({
  id: overrides.id ?? 'log-1',
  user_id: 'user-1',
  dose_log_id: null,
  peptide_id: null,
  cycle_id: null,
  peptide_name: overrides.peptide_name ?? null,
  cycle_name: overrides.cycle_name ?? null,
  dose: overrides.dose ?? 250,
  unit: overrides.unit ?? 'mcg',
  method: overrides.method ?? 'Subkutan',
  notes: overrides.notes ?? null,
  logged_at: overrides.logged_at ?? '2026-06-17T08:00:00.000Z',
  created_at: overrides.created_at ?? '2026-06-17T08:00:00.000Z',
  model_version: 'placeholder-v1',
  body_region: overrides.body_region ?? 'abdomen',
  body_side: overrides.body_side ?? 'right',
  position: overrides.position ?? { x: 0.22, y: 0.4, z: 0.42 },
  normal: overrides.normal ?? { x: 0, y: 0, z: 1 },
  uv: null,
  camera_state: null,
  warning_state: overrides.warning_state ?? null,
})

const draft = (position: InjectionPinDraft['position']): InjectionPinDraft => ({
  model_version: 'placeholder-v1',
  position,
  normal: { x: 0, y: 0, z: 1 },
  body_region: 'abdomen',
  body_side: 'right',
})

describe('inferBodyRegion', () => {
  it('infers right abdomen from positive x and mid torso y', () => {
    expect(inferBodyRegion({ x: 0.28, y: 0.35, z: 0.4 })).toEqual({
      body_region: 'abdomen',
      body_side: 'right',
    })
  })

  it('infers left thigh from negative x and low y', () => {
    expect(inferBodyRegion({ x: -0.22, y: -0.62, z: 0.25 })).toEqual({
      body_region: 'thigh',
      body_side: 'left',
    })
  })
})

describe('filterRecentInjectionLogs', () => {
  it('keeps logs inside the requested day window', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [
      baseLog({ id: 'recent', logged_at: '2026-06-15T12:00:00.000Z' }),
      baseLog({ id: 'old', logged_at: '2026-06-01T12:00:00.000Z' }),
    ]
    expect(filterRecentInjectionLogs(logs, now, 7).map(log => log.id)).toEqual(['recent'])
  })
})

describe('proximityWarning', () => {
  it('returns none when no recent pin is nearby', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [baseLog({ position: { x: 0.8, y: 0.8, z: 0.8 } })]
    expect(proximityWarning(draft({ x: 0.1, y: 0.1, z: 0.1 }), logs, now).level).toBe('none')
  })

  it('returns caution for a nearby pin from the last seven days', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    // 6 days ago: within the 7-day recent window but older than the 3-day strong window.
    const logs = [baseLog({ logged_at: '2026-06-11T12:00:00.000Z', position: { x: 0.11, y: 0.1, z: 0.1 } })]
    const result = proximityWarning(draft({ x: 0.1, y: 0.1, z: 0.1 }), logs, now)
    expect(result.level).toBe('caution')
    expect(result.nearestLogId).toBe('log-1')
  })

  it('returns strong for a very nearby pin from the last three days', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [baseLog({ logged_at: '2026-06-16T12:00:00.000Z', position: { x: 0.105, y: 0.1, z: 0.1 } })]
    expect(proximityWarning(draft({ x: 0.1, y: 0.1, z: 0.1 }), logs, now).level).toBe('strong')
  })
})
