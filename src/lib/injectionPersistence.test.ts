// src/lib/injectionPersistence.test.ts
import { describe, expect, it } from 'vitest'
import { buildInjectionInsertPayload } from './injectionPersistence'

describe('buildInjectionInsertPayload', () => {
  it('keeps dose_log_id when linking to an existing confirmation', () => {
    const payload = buildInjectionInsertPayload({
      userId: 'user-1',
      doseLogId: 'dose-1',
      peptideId: 'pep-1',
      cycleId: 'cycle-1',
      dose: 250,
      unit: 'mcg',
      method: 'Subkutan',
      notes: 'ok',
      loggedAt: '2026-06-17T08:00:00.000Z',
      warningState: 'caution',
      pin: {
        model_version: 'placeholder-v1',
        body_region: 'abdomen',
        body_side: 'right',
        position: { x: 0.1, y: 0.2, z: 0.3 },
        normal: { x: 0, y: 0, z: 1 },
        uv: null,
        camera_state: null,
      },
    })

    expect(payload).toMatchObject({
      user_id: 'user-1',
      dose_log_id: 'dose-1',
      peptide_id: 'pep-1',
      cycle_id: 'cycle-1',
      dose: 250,
      unit: 'mcg',
      method: 'Subkutan',
      body_region: 'abdomen',
      body_side: 'right',
      model_version: 'placeholder-v1',
      warning_state: 'caution',
    })
    expect(payload.position).toEqual({ x: 0.1, y: 0.2, z: 0.3 })
  })
})
