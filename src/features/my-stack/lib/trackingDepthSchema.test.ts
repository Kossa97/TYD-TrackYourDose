import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase-my-stack-tracking-depth.sql', 'utf8')
const verify = readFileSync('supabase-my-stack-tracking-depth-verify.sql', 'utf8')
const foundation = readFileSync('supabase-my-stack-foundation.sql', 'utf8')

describe('My Stack tracking depth schema', () => {
  it('adds a checked tracking level and preserves existing items as complete', () => {
    expect(migration).toContain('add column if not exists tracking_level')
    expect(migration).toContain("'intake_only', 'with_amount', 'complete'")
    expect(migration).toContain('update public.stack_items')
    expect(migration).toContain("tracking_level = 'complete'")
  })

  it('allows unknown planned and logged quantities without inventing zero', () => {
    expect(migration).toContain('alter column dose drop not null')
    expect(migration).toContain('alter column unit drop not null')
    expect(migration).not.toMatch(/coalesce\([^)]*dose[^)]*,\s*0\)/i)
  })

  it('keeps fresh installs and incremental installs aligned', () => {
    expect(foundation).toContain('tracking_level')
    expect(foundation).toContain('pk_profile_method')
    expect(verify).toContain('tracking_depth_contract')
  })

  it.each([
    ['incremental', migration],
    ['foundation', foundation],
  ])('saves an item and its plan atomically in the %s SQL', (_name, sql) => {
    const rpcStart = sql.indexOf('create or replace function public.save_stack_item_with_plan')
    const rpcEnd = sql.indexOf('revoke execute on function public.save_stack_item_with_plan', rpcStart)
    const rpc = sql.slice(rpcStart, rpcEnd)

    expect(rpcStart).toBeGreaterThan(-1)
    expect(rpcEnd).toBeGreaterThan(rpcStart)
    expect(rpc).toContain('saved_item := public.save_stack_item(p_item, p_ingredients)')
    expect(rpc).toContain("saved_item.tracking_level = 'intake_only'")
    expect(rpc).toContain("saved_item.tracking_level in ('with_amount', 'complete')")
    expect(rpc).toContain('insert into public.cycles')
    expect(rpc).toContain('update public.cycles')
    expect(rpc).toContain('schedule_history')
    expect(rpc).toContain("segment ->> 'effective_from'")
    expect(rpc).toContain("coalesce(cycle_row.schedule_days, '{}'::text[]) is distinct from plan_schedule_days")
    expect(rpc).toContain('cycle_row.start_date')
    expect(rpc).toContain('stack_item_id = saved_item.id')
    expect(rpc).toContain('user_id = owner_id')
    expect(rpc).not.toContain('update public.dose_logs')
    expect(rpc).toContain('return saved_item')
    expect(sql).toContain('revoke execute on function public.save_stack_item_with_plan(jsonb, jsonb, jsonb) from public, anon')
    expect(sql).toContain('grant execute on function public.save_stack_item_with_plan(jsonb, jsonb, jsonb) to authenticated')
    expect(sql).toMatch(/coalesce\(\s*nullif\(btrim\(p_item ->> 'tracking_level'\), ''\),\s*'complete'\s*\)/)
  })

  it.each([
    ['incremental', migration],
  ])('relaxes existing ingredient basis columns in the %s SQL', (_name, sql) => {
    expect(sql).toContain("item_tracking_level = 'complete'")
    expect(sql).toContain('alter column basis_value drop not null')
    expect(sql).toContain('alter column basis_unit drop not null')
    expect(sql).toContain('drop constraint if exists stack_item_ingredients_basis_unit_check')
    expect(sql).toMatch(/add constraint stack_item_ingredients_basis_unit_check\s+check \(basis_unit is null or nullif\(btrim\(basis_unit\), ''\) is not null\)/)
  })

  it('creates nullable ingredient basis columns for fresh installs', () => {
    expect(foundation).toMatch(/basis_value numeric default 1/)
    expect(foundation).toMatch(/basis_unit text\s+check \(basis_unit is null or nullif\(btrim\(basis_unit\), ''\) is not null\)/)
    expect(foundation).toContain("item_tracking_level = 'complete'")
  })

  it('prevalidates a supplied pending log against ownership, state, stack item, and exact slot before writes', () => {
    const rpcStart = migration.indexOf('create or replace function public.confirm_intake_group')
    const rpcEnd = migration.indexOf('revoke execute on function public.confirm_intake_group', rpcStart)
    const rpc = migration.slice(rpcStart, rpcEnd)
    const pendingValidation = rpc.indexOf('perform 1\n      from public.dose_logs')
    const firstWrite = rpc.indexOf('update public.dose_logs')

    expect(rpcStart).toBeGreaterThan(-1)
    expect(pendingValidation).toBeGreaterThan(-1)
    expect(pendingValidation).toBeLessThan(firstWrite)
    expect(rpc.slice(pendingValidation, firstWrite)).toContain('user_id = owner_id')
    expect(rpc.slice(pendingValidation, firstWrite)).toContain('stack_item_id = entry_stack_item_id')
    expect(rpc.slice(pendingValidation, firstWrite)).toContain('taken is null')
    expect(rpc.slice(pendingValidation, firstWrite)).toContain('logged_at = entry_logged_at')
    expect(rpc.slice(firstWrite)).toMatch(/where id = entry_dose_log_id[\s\S]*taken is null[\s\S]*logged_at = entry_logged_at/)
  })
})
