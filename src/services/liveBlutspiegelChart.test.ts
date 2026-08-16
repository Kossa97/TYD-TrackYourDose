import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadAllCycleChartData } from './liveBlutspiegelChart'

const fixtures = vi.hoisted(() => ({
  cycles: [] as Array<Record<string, unknown>>,
  escalations: [] as Array<Record<string, unknown>>,
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
      const builder: Record<string, unknown> = {}
      builder.select = () => builder
      builder.eq = () => builder
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
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('uses the schedule segment effective today for chart readiness and units', async () => {
    const result = await loadAllCycleChartData('user-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ cycleId: 'cycle-1', unit: 'mg' })
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
