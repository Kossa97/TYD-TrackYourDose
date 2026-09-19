import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadAllCycleChartData } from './liveBlutspiegelChart'
import { FEATURES } from '../config/features'
vi.mock('../config/features', () => ({ FEATURES: { planTimelineV2: false } }))

const fixtures = vi.hoisted(() => ({
  cycles: [] as Array<Record<string, unknown>>,
  escalations: [] as Array<Record<string, unknown>>,
  tables: [] as string[],
}))

const cycle = {
  id: 'cycle-1',
  stack_item_id: 'stack-1',
  start_date: '2026-08-01',
  end_date: null,
  dose: 1,
  unit: 'mg',
  method: 'Subkutan',
  frequency: 'Täglich',
  x_days_interval: null,
  schedule_days: [],
  intake_time: 'custom',
  intake_time_custom: '08:00',
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
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: [],
    intake_time: 'custom',
    intake_time_custom: '09:30',
    dose: 2,
    unit: 'mg',
  }],
  stack_items: {
    id: 'stack-1',
    display_name: 'BPC-157',
    tracking_level: 'complete',
    pk_profile_method: 'Subkutan',
    ingredients: [{
      position: 0,
      substance_catalog: {
        pk_profile_id: 'pk-1',
        pk_profiles: {
          half_life_hours: 4,
          tmax_hours: 1,
          bioavailability_sc: 1,
          category: 'peptide',
        },
      },
    }],
  },
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      fixtures.tables.push(table)
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = () => builder
      builder.order = () => builder
      builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({
        data: table === 'cycles' ? fixtures.cycles : fixtures.escalations,
        error: null,
      }).then(resolve)
      return builder
    },
  },
}))

vi.mock('./blutspiegelHistory', async importOriginal => {
  const original = await importOriginal<typeof import('./blutspiegelHistory')>()
  return {
    ...original,
    loadDoseHistory: vi.fn(async () => ({
      events: [{
        timestamp: new Date('2026-08-20T08:00:00.000Z'),
        dose: 1,
        unit: 'mg',
        status: 'taken' as const,
      }],
      interruptedAt: null,
    })),
  }
})

describe('loadAllCycleChartData date-effective readiness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-20T12:00:00.000Z'))
    fixtures.cycles = [{ ...cycle, dose: null, unit: null, intake_time_custom: null }]
    fixtures.escalations = []
    fixtures.tables = []
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false
  })

  it('uses the schedule segment effective today for chart readiness and units', async () => {
    const result = await loadAllCycleChartData('user-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ cycleId: 'cycle-1', unit: 'mg' })
  })

  it('loads a normalized current version without querying legacy escalations', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    fixtures.cycles = [{ ...cycle, dose: null, unit: null, schedule_history: null,
      started_at: '2026-08-01T00:00:00Z', ended_at: null, pauses: [], versions: [{
        id: 'v1', cycle_id: 'cycle-1', effective_kind: 'local_date', effective_at: null, effective_local_date: '2026-08-01',
        change_kind: 'initial', frequency: 'Täglich', x_days_interval: null, interval_unit: null,
        cycle_on_days: null, cycle_off_days: null, schedule_days: [], intake_time: 'custom', intake_time_custom: '08:00',
        slot_doses: null, slot_days: null, dose: 2, unit: 'mg', method: 'Subkutan',
      }] }]
    fixtures.cycles.push({ ...fixtures.cycles[0], id: 'future', started_at: '2099-01-01T00:00:00Z',
      versions: [{ ...(fixtures.cycles[0].versions as any[])[0], id: 'future-v', cycle_id: 'future', effective_local_date: '2099-01-01' }] })
    expect(await loadAllCycleChartData('user-1')).toEqual([expect.objectContaining({ cycleId: 'cycle-1', unit: 'mg' })])
    expect(fixtures.tables).not.toContain('dose_escalations')
  })

  it('omits a cycle when an active escalation has a mismatched unit', async () => {
    fixtures.cycles = [cycle]
    fixtures.escalations = [{
      cycle_id: 'cycle-1',
      increase_amount: 500,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-08-20',
      start_after_days: null,
    }]

    expect(await loadAllCycleChartData('user-1')).toEqual([])
  })
})
