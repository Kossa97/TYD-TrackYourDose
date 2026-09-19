import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateHistoryBlutspiegelCurve,
  findNextPkDose,
  splitQuantifiedDoseHistory,
  loadDoseHistory,
  getCurrentBlutspiegelLevel,
} from './blutspiegelHistory'
import { FEATURES } from '../config/features'
import type { CycleTimeline } from '../lib/planTimeline'
vi.mock('../config/features', () => ({ FEATURES: { planTimelineV2: false } }))
const historyDb = vi.hoisted(() => ({ logs: [] as any[], filters: [] as unknown[][], error: null as null | { message: string } }))
vi.mock('../lib/supabase', () => ({ supabase: { from: (table: string) => {
  let rows = historyDb.logs
  const query: any = {
    select: () => query, eq: (key: string, value: unknown) => {
      historyDb.filters.push([table, key, value]); if (table === 'dose_logs') rows = rows.filter(row => row[key] === value); return query
    }, is: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query },
    gte: (key: string, value: string) => { rows = rows.filter(row => row[key] >= value); return query },
    lt: (key: string, value: string) => { rows = rows.filter(row => row[key] < value); return query },
    lte: (key: string, value: string) => { rows = rows.filter(row => row[key] <= value); return query },
    not: () => query, order: () => query,
    maybeSingle: async () => ({ data: { id: 'c1', stack_item_id: 's1', start_date: '2026-09-01', end_date: null,
      started_at: '2026-09-01T00:00:00.000Z', ended_at: null }, error: historyDb.error }),
    then: (resolve: any) => Promise.resolve({ data: rows, error: historyDb.error }).then(resolve),
  }; return query
} } }))

describe('normalized PK history and projection', () => {
  afterEach(() => { (FEATURES as { planTimelineV2: boolean }).planTimelineV2 = false; vi.useRealTimers(); historyDb.error = null })
  const timeline: CycleTimeline = { cycle: { id: 'c1', stack_item_id: 's1', started_at: '2026-09-01T00:00:00Z', ended_at: null },
    versions: [{ id: 'v1', cycle_id: 'c1', effective_kind: 'local_date', effective_at: null, effective_local_date: '2026-09-01',
      change_kind: 'initial', frequency: 'Täglich', x_days_interval: null, interval_unit: null, cycle_on_days: null,
      cycle_off_days: null, schedule_days: [], intake_time: 'custom,custom', intake_time_custom: '08:00,20:00',
      slot_doses: null, slot_days: null, dose: 1, unit: 'mg', method: 'Subkutan' }], pauses: [] }
  const cycle = { ...timeline.versions[0], id: 'c1', stack_item_id: 's1', start_date: '2026-09-01', end_date: null, schedule_history: null, timeline }
  it('isolates exact-cycle snapshots and bounded null-provenance legacy rows', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-19T12:00:00Z'))
    const row = { stack_item_id: 's1', cycle_id: 'c1', plan_version_id: 'old-version', logged_at: '2026-09-18T08:00:00.000Z', dose: 250, unit: 'mcg', taken: true }
    historyDb.logs = [row, { ...row, cycle_id: 'c2', dose: 999 },
      { ...row, cycle_id: null, plan_version_id: null, logged_at: '2026-09-18T09:00:00.000Z', dose: 2, unit: 'mg' },
      { ...row, cycle_id: null, plan_version_id: null, logged_at: '2026-08-31T09:00:00.000Z' }]
    historyDb.filters = []
    const history = await loadDoseHistory('c1')
    expect(history.events).toEqual([
      { timestamp: new Date('2026-09-18T08:00:00.000Z'), dose: 250, unit: 'mcg', status: 'taken', cycleId: 'c1', planVersionId: 'old-version' },
      { timestamp: new Date('2026-09-18T09:00:00.000Z'), dose: 2, unit: 'mg', status: 'taken', cycleId: null, planVersionId: null },
    ])
    expect(historyDb.filters).toContainEqual(['dose_logs', 'cycle_id', 'c1'])
  })
  it('surfaces normalized history query failure', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    historyDb.error = { message: 'history unavailable' }
    await expect(loadDoseHistory('c1')).rejects.toMatchObject({ message: 'history unavailable' })
  })
  it('uses an instant boundary only for the later same-day slot in the current timezone', () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const value = { ...timeline, versions: [...timeline.versions, { ...timeline.versions[0], id: 'v2',
      effective_kind: 'instant' as const, effective_local_date: null, effective_at: '2026-09-19T10:00:00Z', dose: 3 }] }
    const input = { ...cycle, timeline: value }
    expect(findNextPkDose(input, [], new Date('2026-09-19T05:00:00Z'), 'Europe/Berlin')).toMatchObject({
      timestamp: new Date('2026-09-19T06:00:00Z'), dose: 1, unit: 'mg', planVersionId: 'v1' })
    expect(findNextPkDose(input, [], new Date('2026-09-19T09:00:00Z'), 'Europe/Berlin')).toMatchObject({
      timestamp: new Date('2026-09-19T18:00:00Z'), dose: 3, unit: 'mg', planVersionId: 'v2' })
  })
  it.each(['pause', 'prn', 'ended'])('returns no future automatic dose for %s', state => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    const value = structuredClone(timeline)
    if (state === 'pause') value.pauses = [{ id: 'p', cycle_id: 'c1', paused_at: '2026-09-18T00:00:00Z', ends_at: null }]
    if (state === 'prn') value.versions[0].frequency = 'Bei Bedarf'
    if (state === 'ended') value.cycle.ended_at = '2026-09-18T00:00:00Z'
    expect(findNextPkDose({ ...cycle, timeline: value }, [], new Date('2026-09-19T12:00:00Z'), 'Europe/Berlin')).toBeNull()
  })
  it('does not invent a next-dose metric for an indefinite pause', async () => {
    ;(FEATURES as { planTimelineV2: boolean }).planTimelineV2 = true
    historyDb.logs = []
    const value = { ...timeline, pauses: [{ id: 'p', cycle_id: 'c1', paused_at: '2026-09-18T00:00:00Z', ends_at: null }] }
    const result = await getCurrentBlutspiegelLevel({ ...cycle, timeline: value }, [], 4, 1)
    expect(result.nextDoseIn).toBe('—')
    expect(result.levelAfterNextDose).toBeNull()
  })
})
import type { EscalationRow, ScheduleCycle } from '../lib/intakeSchedule'

function log(timestamp: string, taken: boolean, dose: number | null, unit: string | null) {
  return { timestamp, taken, dose, unit }
}

describe('splitQuantifiedDoseHistory', () => {
  it('cuts the quantified series at a taken log with unknown quantity', () => {
    const result = splitQuantifiedDoseHistory([
      log('2026-07-20', true, 5, 'mg'),
      log('2026-07-21', true, null, null),
      log('2026-07-22', true, 5, 'mg'),
    ])

    expect(result.events.map(event => event.timestamp)).toEqual(['2026-07-20'])
    expect(result.events.map(event => ({ dose: event.dose, unit: event.unit }))).toEqual([
      { dose: 5, unit: 'mg' },
    ])
    expect(result.interruptedAt).toBe('2026-07-21')
  })

  it('does not interrupt for a skipped log', () => {
    const result = splitQuantifiedDoseHistory([
      log('2026-07-20', false, null, null),
      log('2026-07-21', true, 5, 'mg'),
    ])

    expect(result.events.map(event => event.timestamp)).toEqual(['2026-07-21'])
    expect(result.interruptedAt).toBeNull()
  })

  it('keeps the quantified dose paired with its recorded unit', () => {
    const result = splitQuantifiedDoseHistory([
      log('2026-07-20', true, 500, 'mcg'),
      log('2026-07-21', true, 1, 'mg'),
    ])

    expect(result.events.map(event => [event.dose, event.unit])).toEqual([
      [500, 'mcg'],
      [1, 'mg'],
    ])
  })
})

describe('calculateHistoryBlutspiegelCurve interruption', () => {
  afterEach(() => vi.useRealTimers())

  it('marks projections after the latest quantified event as planned', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-20T04:00:00.000Z'))

    const curve = calculateHistoryBlutspiegelCurve([{
      timestamp: new Date('2026-07-20T00:00:00.000Z'),
      dose: 1,
      unit: 'mg',
      status: 'taken',
    }], 4, 1, 1, 60)

    expect(curve[0].status).toBe('actual')
    expect(curve.slice(1).every(point => point.status === 'planned')).toBe(true)
  })

  it('does not emit a point at or beyond the interruption timestamp', () => {
    const interruptedAt = new Date('2026-07-20T03:00:00.000Z')
    const curve = calculateHistoryBlutspiegelCurve([{
      timestamp: new Date('2026-07-20T00:00:00.000Z'),
      dose: 1,
      unit: 'mg',
      status: 'taken',
    }], 4, 1, 1, 60, interruptedAt)

    expect(curve.map(point => point.time.toISOString())).toEqual([
      '2026-07-20T00:00:00.000Z',
      '2026-07-20T01:00:00.000Z',
      '2026-07-20T02:00:00.000Z',
    ])
  })
})

describe('findNextPkDose', () => {
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
      effective_from: '2026-08-02',
      frequency: 'Täglich',
      x_days_interval: null,
      schedule_days: [],
      intake_time: 'custom',
      intake_time_custom: '09:30',
      dose: 2,
      unit: 'mg',
    }],
  }

  it('projects the next dose with the segment effective on that dose date', () => {
    expect(findNextPkDose(cycle, [], new Date(2026, 7, 1, 10))).toEqual({
      timestamp: new Date(2026, 7, 2, 9, 30),
      dose: 2,
      unit: 'mg',
    })
  })

  it('keeps the projected quantity unusable for a mismatched active escalation unit', () => {
    const escalations: EscalationRow[] = [{
      cycle_id: cycle.id,
      increase_amount: 500,
      unit: 'mcg',
      start_type: 'date',
      start_date: '2026-08-02',
      start_after_days: null,
    }]

    expect(findNextPkDose(cycle, escalations, new Date(2026, 7, 1, 10))).toEqual({
      timestamp: new Date(2026, 7, 2, 9, 30),
      dose: null,
      unit: null,
    })
  })
})
