// src/lib/injectionPersistence.test.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import {
  assertInjectionProSchema,
  buildSelectableInjectionIntakes,
  buildInjectionInsertPayload,
  confirmIntakeDoseLog,
  isDoseLogAlreadyLinkedError,
  isInjectionProSchemaError,
  injectionIntakeLookbackStart,
  loadInjectionLogs,
  resolveInjectionDoseLogId,
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
  it('loads the linked dose confirmation status for injection history markers', async () => {
    const selects: string[] = []
    const doseIn: unknown[][] = []
    const queries = {
      injection_logs: {
        select: (value: string) => { selects.push(value); return queries.injection_logs },
        eq: () => queries.injection_logs,
        order: () => queries.injection_logs,
        limit: async () => ({
          data: [{
            id: 'log-1',
            user_id: 'user-1',
            dose_log_id: 'dose-1',
            logged_at: '2026-06-17T08:00:00.000Z',
            peptide_id: 'pep-1',
            cycle_id: 'cycle-1',
            peptides: { name: 'BPC-157' },
            cycles: { name: 'Cycle' },
          }],
          error: null,
        }),
      },
      dose_logs: {
        select: (value: string) => { selects.push(value); return queries.dose_logs },
        eq: () => queries.dose_logs,
        in: (_field: string, values: unknown[]) => {
          doseIn.push(values)
          return queries.dose_logs
        },
        then: (resolve: (value: { data: Array<{ id: string; taken: boolean | null }>; error: null }) => void) => resolve({
          data: [{ id: 'dose-1', taken: null }],
          error: null,
        }),
      },
    }
    const supabase = {
      from: (table: 'injection_logs' | 'dose_logs') => queries[table],
    } as unknown as SupabaseClient

    const logs = await loadInjectionLogs(supabase, 'user-1')

    expect(selects).toEqual(['*, peptides(name), cycles(name)', 'id, taken'])
    expect(doseIn).toEqual([['dose-1']])
    expect(logs[0]).toMatchObject({
      id: 'log-1',
      dose_log_id: 'dose-1',
      dose_taken: null,
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
describe('injectionIntakeLookbackStart', () => {
  it('starts at the beginning of the configured lookback day', () => {
    expect(injectionIntakeLookbackStart(new Date('2026-06-26T15:30:00.000Z'), 7).toISOString()).toBe(
      '2026-06-18T22:00:00.000Z',
    )
  })
})
describe('buildSelectableInjectionIntakes', () => {
  const cycle = {
    id: 'cycle-1',
    peptide_id: 'peptide-1',
    name: 'Abendzyklus',
    method: 'Subkutan',
    start_date: '2026-06-20',
    end_date: null,
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    intake_time: 'abends',
    intake_time_custom: null,
    dose: 100,
    unit: 'mcg',
    schedule_history: null,
    peptides: { name: 'Ipamorelin' },
  }

  it('includes confirmed dose logs without a pin and keeps open slots', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'dose-1',
        peptide_id: 'peptide-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T20:15:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'confirmed',
        doseLogId: 'dose-1',
        cycleId: 'cycle-1',
        scheduledAt: '2026-06-23T20:15:00.000Z',
      }),
      expect.objectContaining({
        status: 'open',
        doseLogId: null,
        cycleId: 'cycle-1',
      }),
    ]))
  })

  it('uses the injectable cycle when an older confirmed dose log has no method', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'dose-legacy',
        peptide_id: 'peptide-1',
        dose: 100,
        unit: 'mcg',
        method: 'Andere',
        logged_at: '2026-06-23T20:15:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'confirmed',
        doseLogId: 'dose-legacy',
        method: 'Subkutan',
      }),
    ]))
  })
  it('keeps a confirmed injectable dose log even without a matching active schedule', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [],
      logs: [{
        id: 'dose-orphan',
        peptide_id: 'peptide-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T20:15:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual([
      expect.objectContaining({
        status: 'confirmed',
        doseLogId: 'dose-orphan',
        cycleId: null,
        scheduledAt: '2026-06-23T20:15:00.000Z',
      }),
    ])
  })
  it('excludes confirmed dose logs that already have an injection pin', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'dose-1',
        peptide_id: 'peptide-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T20:15:00.000Z',
        taken: true,
      }],
      linkedDoseLogIds: new Set(['dose-1']),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result.some(item => item.doseLogId === 'dose-1')).toBe(false)
  })
  it('shows auto-missed injectable dose logs as open intakes', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'missed-1',
        peptide_id: 'peptide-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T18:00:00.000Z',
        taken: false,
        notes: 'auto-missed',
      } as any],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'open',
        doseLogId: 'missed-1',
        cycleId: 'cycle-1',
        scheduledAt: '2026-06-23T18:00:00.000Z',
      }),
    ]))
  })
  it('shows reset dose logs without pins as open intakes with their existing id', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'reset-1',
        peptide_id: 'peptide-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T18:00:00.000Z',
        taken: null,
      }],
      linkedDoseLogIds: new Set(),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'open',
        doseLogId: 'reset-1',
        cycleId: 'cycle-1',
        scheduledAt: '2026-06-23T18:00:00.000Z',
      }),
    ]))
  })

  it('does not show reset dose logs with an existing injection pin as selectable again', () => {
    const result = buildSelectableInjectionIntakes({
      cycles: [cycle],
      logs: [{
        id: 'reset-linked',
        peptide_id: 'peptide-1',
        dose: 100,
        unit: 'mcg',
        method: 'Subkutan',
        logged_at: '2026-06-23T18:00:00.000Z',
        taken: null,
      }],
      linkedDoseLogIds: new Set(['reset-linked']),
      escalations: [],
      now: new Date('2026-06-24T21:00:00.000Z'),
      lookbackDays: 2,
    })

    expect(result.some(item => item.scheduledAt === '2026-06-23T18:00:00.000Z')).toBe(false)
  })
})
describe('resolveInjectionDoseLogId', () => {
  it('reuses a confirmed dose log without confirming or debiting again', async () => {
    let confirmationCalls = 0
    const doseLogId = await resolveInjectionDoseLogId({
      cycleId: 'cycle-1',
      peptideId: 'peptide-1',
      peptideName: 'Ipamorelin',
      cycleName: 'Cycle',
      dose: 100,
      unit: 'mcg',
      method: 'Subkutan',
      scheduledAt: '2026-06-23T20:15:00.000Z',
      daysOverdue: 1,
      status: 'confirmed',
      doseLogId: 'dose-1',
    }, async () => {
      confirmationCalls += 1
      return 'new-dose'
    })

    expect(doseLogId).toBe('dose-1')
    expect(confirmationCalls).toBe(0)
  })

  it('confirms an open intake exactly once', async () => {
    let confirmationCalls = 0
    const doseLogId = await resolveInjectionDoseLogId({
      cycleId: 'cycle-1',
      peptideId: 'peptide-1',
      peptideName: 'Ipamorelin',
      cycleName: 'Cycle',
      dose: 100,
      unit: 'mcg',
      method: 'Subkutan',
      scheduledAt: '2026-06-24T20:00:00.000Z',
      daysOverdue: 0,
      status: 'open',
      doseLogId: null,
    }, async () => {
      confirmationCalls += 1
      return 'new-dose'
    })

    expect(doseLogId).toBe('new-dose')
    expect(confirmationCalls).toBe(1)
  })
})

describe('confirmIntakeDoseLog', () => {
  it('updates an auto-missed dose log instead of inserting a duplicate', async () => {
    const doseUpdates: Array<Record<string, unknown>> = []
    const doseEq: Array<[string, unknown]> = []
    const peptideUpdates: Array<Record<string, unknown>> = []
    let inserts = 0

    const doseUpdateQuery = {
      error: null,
      eq: (field: string, value: unknown) => {
        doseEq.push([field, value])
        return doseUpdateQuery
      },
    }
    const peptideSelectQuery = {
      eq: () => peptideSelectQuery,
      single: async () => ({
        data: {
          id: 'peptide-1',
          vial_amount_mg: 10,
          reconstitution_ml: null,
          reconstitution_date: null,
          vials_in_stock: 1,
          vials_initial: 1,
        },
        error: null,
      }),
    }
    const peptideUpdateQuery = {
      eq: () => peptideUpdateQuery,
    }
    const supabase = {
      from: (table: string) => {
        if (table === 'dose_logs') {
          return {
            update: (payload: Record<string, unknown>) => {
              doseUpdates.push(payload)
              return doseUpdateQuery
            },
            insert: () => {
              inserts += 1
              return { select: () => ({ single: async () => ({ data: { id: 'new-dose' }, error: null }) }) }
            },
          }
        }
        if (table === 'peptides') {
          return {
            select: () => peptideSelectQuery,
            update: (payload: Record<string, unknown>) => {
              peptideUpdates.push(payload)
              return peptideUpdateQuery
            },
          }
        }
        throw new Error(`Unexpected table ${table}`)
      },
    } as unknown as SupabaseClient

    const id = await confirmIntakeDoseLog(supabase, {
      userId: 'user-1',
      peptideId: 'peptide-1',
      dose: 100,
      unit: 'mcg',
      method: 'Subkutan',
      loggedAt: '2026-06-23T18:05:00.000Z',
      doseLogId: 'missed-1',
    })

    expect(id).toBe('missed-1')
    expect(inserts).toBe(0)
    expect(doseUpdates).toEqual([{ dose: 100, unit: 'mcg', method: 'Subkutan', logged_at: '2026-06-23T18:05:00.000Z', taken: true }])
    expect(doseEq).toEqual([['id', 'missed-1'], ['user_id', 'user-1']])
    expect(peptideUpdates).toEqual([{ vials_in_stock: 0.99 }])
  })
})
describe('isDoseLogAlreadyLinkedError', () => {
  it('recognizes the partial unique-index violation', () => {
    expect(isDoseLogAlreadyLinkedError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "injection_logs_dose_log_id_unique_idx"',
    })).toBe(true)
  })
})
