// src/lib/injectionPersistence.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  assertInjectionProSchema,
  buildInjectionInsertPayload,
  isInjectionProSchemaError,
  loadInjectionLogs,
} from './injectionPersistence'

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

  it('stores a trimmed manual substance label without a dose_log link', () => {
    const payload = buildInjectionInsertPayload({
      userId: 'user-1',
      doseLogId: null,
      peptideId: null,
      cycleId: null,
      dose: 10,
      unit: 'mg',
      method: 'Intramuskulär',
      notes: null,
      loggedAt: '2026-06-17T08:00:00.000Z',
      warningState: null,
      substanceLabel: '  Testosteron  ',
      pin: {
        model_version: 'placeholder-v1',
        body_region: 'glute',
        body_side: 'left',
        position: { x: 0, y: -0.8, z: 0.1 },
        normal: { x: 0, y: 0, z: 1 },
        uv: null,
        camera_state: null,
      },
    })

    expect(payload.substance_label).toBe('Testosteron')
    expect(payload.dose_log_id).toBeNull()
    expect(payload.unit).toBe('mg')
  })
})
describe('loadInjectionLogs', () => {
  it('retries without relation joins when PostgREST has no injection log relationships', async () => {
    const selects: string[] = []
    const results = [
      { data: null, error: { code: 'PGRST200', message: 'relationship not found' } },
      {
        data: [{
          id: 'log-1',
          user_id: 'user-1',
          logged_at: '2026-06-17T08:00:00.000Z',
          peptide_id: 'pep-1',
          cycle_id: 'cycle-1',
          substance_label: 'Testosteron',
        }],
        error: null,
      },
    ]
    let queryIndex = 0
    const supabase = {
      from: () => {
        const result = results[queryIndex++]
        const query = {
          select: (value: string) => {
            selects.push(value)
            return query
          },
          eq: () => query,
          order: () => query,
          limit: async () => result,
        }
        return query
      },
    } as unknown as SupabaseClient

    const logs = await loadInjectionLogs(supabase, 'user-1')

    expect(selects).toEqual(['*, peptides(name), cycles(name)', '*'])
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({
      id: 'log-1',
      peptide_id: 'pep-1',
      cycle_id: 'cycle-1',
      peptide_name: null,
      cycle_name: null,
      substance_label: 'Testosteron',
    })
  })
})

describe('assertInjectionProSchema', () => {
  it('identifies a missing Pro column before saving an injection', async () => {
    const schemaError = {
      code: 'PGRST204',
      message: "Could not find the 'body_region' column of 'injection_logs' in the schema cache",
    }
    const query = {
      select: () => query,
      limit: async () => ({ data: null, error: schemaError }),
    }
    const supabase = {
      from: () => query,
    } as unknown as SupabaseClient

    await expect(assertInjectionProSchema(supabase)).rejects.toEqual(schemaError)
    expect(isInjectionProSchemaError(schemaError)).toBe(true)
  })
})
