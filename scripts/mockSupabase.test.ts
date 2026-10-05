import { describe, expect, it } from 'vitest'
import type { Page, Route } from '@playwright/test'
import { MockSupabase, RpcError, SUPABASE_ORIGIN, TEST_USER } from '../e2e/support/mockSupabase'

function seededMock() {
  const db = new MockSupabase({ now: new Date('2026-10-05T10:00:00Z') })
  db.insert('stack_items', { id: 'item', user_id: TEST_USER.id, display_name: 'Vitamin D', tracking_level: 'complete', dosage_form: 'capsule' })
  db.insert('stack_item_ingredients', { stack_item_id: 'item', amount_value: 1000, amount_unit: 'IU', basis_value: 1, basis_unit: 'capsule' })
  db.insert('stack_item_inventory', { id: 'inventory', user_id: TEST_USER.id, stack_item_id: 'item', enabled: true, package_unit: 'capsule', remaining_quantity: 10 })
  db.insert('cycles', { id: 'cycle', user_id: TEST_USER.id, stack_item_id: 'item', started_at: '2026-10-01T00:00:00Z', ended_at: null })
  db.insert('cycle_plan_versions', { id: 'version', cycle_id: 'cycle', effective_kind: 'local_date', effective_local_date: '2026-10-01' })
  return db
}

const entry = {
  cycle_id: 'cycle', plan_version_id: 'version', timezone: 'Europe/Berlin', dose_log_id: null,
  slot_key: 'cycle@2026-10-05T08:00', stack_item_id: 'item', dose: 1000, unit: 'IU',
  method: 'oral', logged_at: '2026-10-05T06:00:00Z', taken: true,
}

function confirm(db: MockSupabase, changes = {}) {
  return db.callRpc('confirm_intake_group', { p_entries: [{ ...entry, ...changes }] }) as Array<Record<string, unknown>>
}

async function request(db: MockSupabase, path: string, body?: Record<string, unknown>) {
  let handler: (route: Route) => Promise<void> = async () => { throw new Error('No Supabase route installed') }
  await db.install({
    addInitScript: async () => {},
    route: async (matcher: unknown, callback: typeof handler) => { if (typeof matcher === 'string') handler = callback },
  } as unknown as Page)
  let response: { status?: number; json?: unknown } = {}
  await handler({
    request: () => ({ url: () => `${SUPABASE_ORIGIN}/rest/v1/${path}`, method: () => body ? 'POST' : 'GET', headers: () => ({}), postDataJSON: () => body ?? null }),
    fulfill: async (result: typeof response) => { response = result },
  } as unknown as Route)
  return response
}

describe('intake browser substitute contract (does not verify SQL/RLS)', () => {
  it('seeds an auth session that remains valid after a test advances beyond the host date', async () => {
    const now = new Date('2099-10-25T00:30:00Z')
    const db = new MockSupabase({ now })
    let session: { expires_at: number } | undefined
    await db.install({
      addInitScript: async (_script: unknown, args: { value: string }) => { session = JSON.parse(args.value) },
      route: async () => {},
    } as unknown as Page)
    expect(session!.expires_at).toBe(Math.floor(now.getTime() / 1000) + 86400)
  })

  it('returns the original decided row on retry, retaining its saved quantity', () => {
    const db = seededMock()
    const [saved] = confirm(db)
    const [retried] = confirm(db, { dose: 2000 })
    expect(retried).toMatchObject({ id: saved.id, dose: 1000, routine_slot_key: entry.slot_key, plan_version_id: 'version', taken: true })
    expect(db.table('dose_logs')).toHaveLength(1)
    expect(() => confirm(db, { taken: false })).toThrow('Routine slot key belongs to another intake')
  })

  it('validates the whole group before writing any intake', () => {
    const db = seededMock()
    expect(() => db.callRpc('confirm_intake_group', { p_entries: [entry, { ...entry, slot_key: 'other', cycle_id: 'missing' }] })).toThrow(RpcError)
    expect(db.table('dose_logs')).toHaveLength(0)
  })

  it('resolves versions using the local date and rejects a stale version', () => {
    const db = seededMock()
    db.insert('cycle_plan_versions', { id: 'new-version', cycle_id: 'cycle', effective_kind: 'local_date', effective_local_date: '2026-10-06' })
    const late = { logged_at: '2026-10-05T22:30:00Z', slot_key: 'cycle@2026-10-06T00:30' }
    expect(() => confirm(db, late)).toThrow('Plan version does not match scheduled intake')
    expect(confirm(db, { ...late, plan_version_id: null })[0].plan_version_id).toBe('new-version')
  })

  it('consumes and reverses stock exactly once, then reuses the pending log and ledger', () => {
    const db = seededMock()
    const [saved] = confirm(db)
    const params = { p_dose_log_id: saved.id }
    expect(db.callRpc('apply_inventory_confirmation', params)).toBe(9)
    expect(db.callRpc('apply_inventory_confirmation', params)).toBe(9)
    expect(db.table('stack_item_inventory_movements')).toHaveLength(1)
    expect(db.callRpc('reverse_inventory_confirmation', { ...params, p_action: 'undo' })).toBe(10)
    expect(db.callRpc('reverse_inventory_confirmation', { ...params, p_action: 'undo' })).toBe(10)
    expect(db.table('dose_logs')[0].taken).toBeNull()
    expect(confirm(db, { dose_log_id: saved.id })[0].id).toBe(saved.id)
    expect(db.callRpc('apply_inventory_confirmation', params)).toBe(9)
    expect(db.table('stack_item_inventory_movements')).toMatchObject([{ applied: true, reversal_count: 1, delta_quantity: 1 }])
  })

  it('reverses skip/delete without restoring stock twice, even after deleting the log', () => {
    const db = seededMock()
    const [saved] = confirm(db)
    const params = { p_dose_log_id: saved.id }
    db.callRpc('apply_inventory_confirmation', params)
    expect(db.callRpc('reverse_inventory_confirmation', { ...params, p_action: 'skip' })).toBe(10)
    expect(db.table('dose_logs')[0].taken).toBe(false)
    expect(db.callRpc('reverse_inventory_confirmation', { ...params, p_action: 'delete' })).toBe(10)
    expect(db.callRpc('reverse_inventory_confirmation', { ...params, p_action: 'delete' })).toBe(10)
    expect(db.table('dose_logs')).toHaveLength(0)
  })

  it('keeps intake saved after a one-shot stock failure and allows stock-only retry', () => {
    const db = seededMock()
    const [saved] = confirm(db)
    const params = { p_dose_log_id: saved.id }
    db.failNextRpc('apply_inventory_confirmation', 'Temporary stock failure')
    expect(() => db.callRpc('apply_inventory_confirmation', params)).toThrow('Temporary stock failure')
    expect(db.table('stack_item_inventory')[0].remaining_quantity).toBe(10)
    expect(db.table('dose_logs')).toHaveLength(1)
    expect(db.callRpc('apply_inventory_confirmation', params)).toBe(9)
  })

  it('deduplicates fractional vial consumption and credits only the actual consumed remainder', () => {
    const db = seededMock()
    Object.assign(db.table('stack_items')[0], { dosage_form: 'vial', tracking_level: 'dose', vial_amount_mg: 10, vials_in_stock: 0.05 })
    db.tables.set('stack_item_inventory', [])
    const [saved] = confirm(db, { dose: 1, unit: 'mg' })
    const params = { p_dose_log_id: saved.id }
    expect(db.callRpc('apply_inventory_confirmation', params)).toBe(0)
    expect(db.callRpc('apply_inventory_confirmation', params)).toBe(0)
    expect(db.callRpc('reverse_inventory_confirmation', { ...params, p_action: 'undo' })).toBe(0.05)
    expect(db.callRpc('reverse_inventory_confirmation', { ...params, p_action: 'undo' })).toBe(0.05)
  })

  it('books 250mcg from a 5mg vial as 0.05 vial in the inventory ledger', () => {
    const db = seededMock()
    Object.assign(db.table('stack_items')[0], { dosage_form: 'vial', tracking_level: 'dose' })
    Object.assign(db.table('stack_item_ingredients')[0], { amount_value: 5, amount_unit: 'mg', basis_unit: 'vial' })
    Object.assign(db.table('stack_item_inventory')[0], { remaining_quantity: 2, package_unit: 'vial' })
    const [saved] = confirm(db, { dose: 250, unit: 'mcg' })
    expect(db.callRpc('apply_inventory_confirmation', { p_dose_log_id: saved.id })).toBe(1.95)
    expect(db.table('stack_item_inventory_movements')).toMatchObject([{ delta_quantity: 0.05, inventory_id: 'inventory' }])
    expect(db.table('vial_stock_movements')).toHaveLength(0)
  })

  it('responds to an injected confirmation failure without partial writes or unhandled requests', async () => {
    const db = seededMock()
    db.failNextRpc('confirm_intake_group', 'Temporary confirmation failure')
    expect(await request(db, 'rpc/confirm_intake_group', { p_entries: [entry] })).toMatchObject({ status: 400, json: { code: 'P0001', message: 'Temporary confirmation failure' } })
    expect(db.table('dose_logs')).toHaveLength(0)
    expect((await request(db, 'rpc/confirm_intake_group', { p_entries: [entry] })).json).toMatchObject([{ taken: true }])
    expect(db.rpcCalls).toHaveLength(2)
    expect(db.unhandled).toEqual([])
  })

  it('filters timestamps by instant when offsets or millisecond precision differ', async () => {
    const db = seededMock()
    db.insert('dose_logs', { id: 'before', logged_at: '2026-10-05T07:59:59+02:00' })
    db.insert('dose_logs', { id: 'start', logged_at: '2026-10-05T08:00:00+02:00' })
    db.insert('dose_logs', { id: 'end', logged_at: '2026-10-05T08:01:00+02:00' })
    expect((await request(db, 'dose_logs?select=id&logged_at=gte.2026-10-05T06:00:00.000Z&logged_at=lt.2026-10-05T06:01:00.000Z')).json).toEqual([{ id: 'start' }])
  })

  it('embeds the optional catalog PK profile through the Home ingredients relation', async () => {
    const db = seededMock()
    const catalogId = db.catalogId('BPC-157')
    Object.assign(db.table('stack_item_ingredients')[0], { catalog_substance_id: catalogId })
    const path = 'cycles?select=stack_items(ingredients:stack_item_ingredients(substance_catalog(pk_profiles(name))))'
    expect((await request(db, path)).json).toEqual([{ stack_items: { ingredients: [{ substance_catalog: { pk_profiles: null } }] } }])
    Object.assign(db.table('substance_catalog').find(row => row.id === catalogId)!, { pk_profile_id: 'pk' })
    db.insert('pk_profiles', { id: 'pk', name: 'BPC-157' })
    expect((await request(db, path)).json).toEqual([{ stack_items: { ingredients: [{ substance_catalog: { pk_profiles: { name: 'BPC-157' } } }] } }])
    expect(db.unhandled).toEqual([])
  })

  it('embeds calendar stack names and applies nested slot ranges and instant boundaries', async () => {
    const db = seededMock()
    const [saved] = confirm(db)
    db.insert('dose_logs', { ...saved, id: 'end', logged_at: '2026-10-06T00:00:00Z', routine_slot_key: 'cycle@2026-10-06T08:00' })
    db.insert('dose_logs', { ...saved, id: 'foreign-user', user_id: 'other' })
    const filter = encodeURIComponent('(and(routine_slot_key.gte."cycle@2026-10-05T00:00",routine_slot_key.lt."cycle@2026-10-06T00:00"),and(routine_slot_key.gte."other@2026-10-05T00:00",routine_slot_key.lt."other@2026-10-06T00:00"))')
    expect((await request(db, `dose_logs?select=id,stack_items(display_name)&user_id=eq.${TEST_USER.id}&or=${filter}`)).json).toEqual([{ id: saved.id, stack_items: { display_name: 'Vitamin D' } }])
    expect((await request(db, `dose_logs?select=id&user_id=eq.${TEST_USER.id}&logged_at=gte.2026-10-05T00:00:00Z&logged_at=lt.2026-10-06T00:00:00Z`)).json).toEqual([{ id: saved.id }])
    expect(db.unhandled).toEqual([])
  })

  it('preserves quoted commas and escaped quotes in flat and nested diary search filters', async () => {
    const db = seededMock()
    db.insert('effects', { id: 'match', body: 'say "hello", friend', selected: true })
    db.insert('effects', { id: 'wrong-text', body: 'say hello', selected: true })
    db.insert('effects', { id: 'wrong-flag', body: 'say "hello", friend', selected: false })
    const text = String.raw`body.ilike."%say \"hello\", friend%"`
    const flat = encodeURIComponent(`(${text},id.eq.wrong-text)`)
    expect((await request(db, `effects?select=id&or=${flat}&order=id`)).json).toEqual([{ id: 'match' }, { id: 'wrong-flag' }, { id: 'wrong-text' }])
    const nested = encodeURIComponent(`(and(${text},selected.eq.true),id.eq.missing)`)
    expect((await request(db, `effects?select=id&or=${nested}`)).json).toEqual([{ id: 'match' }])
    expect(db.unhandled).toEqual([])
  })
})
