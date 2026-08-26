import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase-my-stack-tracking-depth.sql', 'utf8')
const verify = readFileSync('supabase-my-stack-tracking-depth-verify.sql', 'utf8')
const foundation = readFileSync('supabase-my-stack-foundation.sql', 'utf8')
const rollback = readFileSync('supabase-my-stack-tracking-depth-rollback.sql', 'utf8')

function compactSql(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim().toLowerCase()
}

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
    expect(rpc).toContain("plan_frequency = 'Alle X Tage'")
    expect(rpc).toContain('plan_interval_value between 2 and 30')
    expect(rpc).toContain("plan_frequency = 'Wochentage wählen'")
    expect(rpc).toContain("array['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']")
    expect(rpc).toContain('count(distinct weekday)')
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

  it.each([
    ['incremental', migration],
    ['foundation', foundation],
  ])('makes routine-group retries idempotent by stable slot identity in %s SQL', (_name, sql) => {
    const rpcStart = sql.indexOf('create or replace function public.confirm_intake_group')
    const rpcEnd = sql.indexOf('revoke execute on function public.confirm_intake_group', rpcStart)
    const rpc = sql.slice(rpcStart, rpcEnd)

    expect(sql).toContain('add column if not exists routine_slot_key text')
    expect(sql).toContain('create unique index if not exists dose_logs_routine_slot_unique')
    expect(sql).toContain('(user_id, routine_slot_key)')
    expect(rpc).toContain("entry ->> 'slot_key'")
    expect(rpc).toContain('Duplicate routine slot key in intake group')
    expect(rpc).toContain('where routine_slot_key = entry_slot_key')
    expect(rpc).toContain('on conflict (user_id, routine_slot_key)')
    expect(rpc).toContain('return next saved_log')
    expect(rpc).toContain('dose = entry_dose')
    expect(rpc).toContain('unit = entry_unit')
  })

  it('adds owner-only optional inventory and an idempotent movement ledger', () => {
    expect(migration).toContain('create table if not exists public.stack_item_inventory')
    expect(migration).toContain('not enabled')
    expect(migration).toContain('package_quantity > 0')
    expect(migration).toContain("nullif(btrim(package_unit), '') is not null")
    expect(migration).toContain('remaining_quantity >= 0')
    expect(migration).toContain('set enabled = false')
    expect(migration).toContain('alter table public.stack_item_inventory enable row level security')
    expect(migration).toContain('auth.uid() = user_id')
    const inventoryInsertPolicy = migration.slice(
      migration.indexOf('create policy "own stack item inventory insert"'),
      migration.indexOf('drop policy if exists "own stack item inventory update"'),
    )
    expect(inventoryInsertPolicy).toContain('owned_item.id = stack_item_id')
    expect(inventoryInsertPolicy).toContain('owned_item.user_id = auth.uid()')
    expect(migration).toMatch(/dose_log_id uuid not null unique references public\.dose_logs/)
    expect(verify).toContain('stack_item_inventory')
    expect(verify).toContain('apply_inventory_confirmation')
  })

  it('applies generic inventory once and refuses ambiguous conversion', () => {
    const rpcStart = migration.indexOf('create or replace function public.apply_inventory_confirmation')
    const rpcEnd = migration.indexOf('revoke execute on function public.apply_inventory_confirmation', rpcStart)
    const rpc = migration.slice(rpcStart, rpcEnd)

    expect(rpcStart).toBeGreaterThan(-1)
    expect(rpc).toContain("item.tracking_level <> 'complete'")
    expect(rpc).toContain("item.dosage_form = 'vial'")
    expect(rpc).toContain('source_dose_log_id = p_dose_log_id')
    expect(rpc.indexOf('source_dose_log_id = p_dose_log_id'))
      .toBeLessThan(rpc.indexOf('update public.stack_item_inventory'))
    expect(rpc).toContain('log.unit = ingredient.basis_unit')
    expect(rpc).toMatch(/log\.unit = ingredient\.basis_unit\s+then log\.dose\s*\n/)
    expect(rpc).toContain('ingredient.basis_unit = inventory_row.package_unit')
    expect(rpc).toContain("log.unit = 'mg' and ingredient.amount_unit = 'mcg'")
    expect(rpc).toContain("log.unit = 'mcg' and ingredient.amount_unit = 'mg'")
    expect(rpc).toContain('Inventory conversion is ambiguous or unsupported')
    expect(rpc).not.toMatch(/iu[^\n]*(mg|mcg)|(mg|mcg)[^\n]*iu/i)
  })

  it.each([
    ['incremental', migration],
    ['foundation', foundation],
  ])('atomically and idempotently reverses the exact generic debit in %s SQL', (_name, sql) => {
    const applyStart = sql.indexOf('create or replace function public.apply_inventory_confirmation')
    const applyEnd = sql.indexOf('revoke execute on function public.apply_inventory_confirmation', applyStart)
    const applyRpc = sql.slice(applyStart, applyEnd)
    const reverseStart = sql.indexOf('create or replace function public.reverse_inventory_confirmation')
    const reverseEnd = sql.indexOf('revoke execute on function public.reverse_inventory_confirmation', reverseStart)
    const reverseRpc = sql.slice(reverseStart, reverseEnd)

    expect(sql).toContain('source_dose_log_id')
    expect(sql).toContain('applied boolean')
    expect(sql).toContain('reversal_count integer')
    expect(sql).toContain('last_reversed_at timestamptz')
    expect(sql).toContain('on delete set null')
    expect(sql).toContain('(user_id, source_dose_log_id)')
    expect(applyRpc).toContain('source_dose_log_id = p_dose_log_id')
    expect(applyRpc).toContain('least(inventory_row.remaining_quantity, minimum_delta)')
    expect(reverseStart).toBeGreaterThan(-1)
    expect(reverseRpc).toContain('for update')
    expect(reverseRpc).toContain("p_action not in ('undo', 'skip', 'delete')")
    expect(reverseRpc).toContain('if movement.applied then')
    expect(reverseRpc).toContain('remaining_quantity = remaining_quantity + movement.delta_quantity')
    expect(reverseRpc).toContain('applied = false')
    expect(reverseRpc).toContain('reversal_count = reversal_count + 1')
    expect(reverseRpc).toContain('last_reversed_at = now()')
    expect(reverseRpc).toContain('last_reversal_action = p_action')
    expect(reverseRpc).toContain('delete from public.dose_logs')
    expect(reverseRpc).toContain("if p_action = 'delete' then")
    expect(reverseRpc).toContain("set taken = case p_action when 'skip' then false else null end")
    expect(sql).toContain('grant execute on function public.reverse_inventory_confirmation(uuid, text) to authenticated')
  })

  it.each([
    ['incremental', migration],
    ['foundation', foundation],
  ])('debits legacy vial stock once per dose log in %s SQL', (_name, sql) => {
    const rpcStart = sql.indexOf('create or replace function public.apply_inventory_confirmation')
    const rpcEnd = sql.indexOf('revoke execute on function public.apply_inventory_confirmation', rpcStart)
    const rpc = sql.slice(rpcStart, rpcEnd)
    const vialBranch = rpc.slice(rpc.indexOf("item.dosage_form = 'vial'"), rpc.indexOf("item.tracking_level <> 'complete'"))

    expect(sql).toContain('create table if not exists public.vial_stock_movements')
    expect(sql).toContain('(user_id, source_dose_log_id)')
    expect(sql).toContain('applied boolean')
    expect(sql).toContain('reversal_count integer')
    expect(sql).toContain('last_reversed_at timestamptz')
    expect(sql).toContain('last_reversal_action text')
    expect(rpc).toContain('source_dose_log_id = p_dose_log_id')
    expect(vialBranch).toContain('for update')
    expect(vialBranch).toContain('vials_in_stock')
    expect(vialBranch).toContain('if vial_movement.applied then')
    expect(vialBranch).toContain('actual_vial_delta := least(coalesce(item.vials_in_stock, 0), vial_movement.delta_vials)')
    expect(vialBranch).toContain('applied = true')
    expect(vialBranch).toContain('insert into public.vial_stock_movements')
    expect(vialBranch).not.toContain('cycle_id')
    expect(sql).toContain('alter table public.vial_stock_movements enable row level security')
    expect(sql).toContain('grant select, insert, update on table public.vial_stock_movements to authenticated')
  })

  it.each([
    ['incremental', migration],
    ['foundation', foundation],
  ])('reverses only the actual vial debit and retains per-log audit evidence in %s SQL', (_name, sql) => {
    const applyStart = sql.indexOf('create or replace function public.apply_inventory_confirmation')
    const applyEnd = sql.indexOf('revoke execute on function public.apply_inventory_confirmation', applyStart)
    const applyRpc = sql.slice(applyStart, applyEnd)
    const reverseStart = sql.indexOf('create or replace function public.reverse_inventory_confirmation')
    const reverseEnd = sql.indexOf('revoke execute on function public.reverse_inventory_confirmation', reverseStart)
    const reverseRpc = sql.slice(reverseStart, reverseEnd)

    expect(applyRpc).toContain('actual_vial_delta := least(coalesce(item.vials_in_stock, 0), vial_delta)')
    expect(applyRpc).toContain('delta_vials')
    expect(reverseRpc).toContain('vial_movement public.vial_stock_movements')
    expect(reverseRpc).toContain('if movement.id is not null and vial_movement.id is not null then')
    expect(reverseRpc).toContain('vials_in_stock = round(coalesce(vials_in_stock, 0) + vial_movement.delta_vials, 4)')
    expect(reverseRpc).toContain('if vial_movement.applied then')
    expect(reverseRpc).toContain('applied = false')
    expect(reverseRpc).toContain('reversal_count = reversal_count + 1')
    expect(reverseRpc).toContain('last_reversal_action = p_action')
    expect(sql).toContain('dose_log_id uuid unique references public.dose_logs(id) on delete set null')
    expect(sql).toContain('source_dose_log_id uuid not null')
  })

  it.each([
    ['incremental', migration],
    ['foundation', foundation],
  ])('keeps group confirmation and inventory contracts at semantic parity in %s SQL', (_name, sql) => {
    const saveStart = sql.indexOf('create or replace function public.save_stack_item(p_item jsonb, p_ingredients jsonb)')
    const saveEnd = sql.indexOf('revoke execute on function public.save_stack_item(jsonb, jsonb)', saveStart)
    const saveRpc = sql.slice(saveStart, saveEnd)

    expect(sql).toContain('create constraint trigger stack_items_completeness_check')
    expect(sql).toContain('create constraint trigger stack_item_ingredients_completeness_check')
    expect(sql).toContain('create or replace function public.confirm_intake_group')
    expect(sql).toContain('create table if not exists public.stack_item_inventory')
    expect(sql).toContain('create table if not exists public.stack_item_inventory_movements')
    expect(sql).toContain('create table if not exists public.vial_stock_movements')
    expect(sql).toContain('alter table public.stack_item_inventory enable row level security')
    expect(sql).toContain('create policy "own stack item inventory insert"')
    expect(sql).toContain('grant select, insert, update, delete on table public.stack_item_inventory to authenticated')
    expect(saveRpc).toContain("p_item -> 'inventory'")
    expect(saveRpc).toContain('insert into public.stack_item_inventory')
    expect(saveRpc).toContain('set enabled = false')
  })

  it.each([
    ['incremental', migration],
    ['foundation', foundation],
  ])('keeps every save-plan quantity within the confirmation bound in %s SQL', (_name, sql) => {
    const groupStart = sql.indexOf('create or replace function public.confirm_intake_group')
    const groupEnd = sql.indexOf('revoke execute on function public.confirm_intake_group', groupStart)
    const groupRpc = sql.slice(groupStart, groupEnd)
    const saveItemStart = sql.indexOf('create or replace function public.save_stack_item(p_item jsonb, p_ingredients jsonb)')
    const saveItemEnd = sql.indexOf('revoke execute on function public.save_stack_item(jsonb, jsonb)', saveItemStart)
    const saveItemRpc = sql.slice(saveItemStart, saveItemEnd)
    const savePlanStart = sql.indexOf('create or replace function public.save_stack_item_with_plan')
    const savePlanEnd = sql.indexOf('revoke execute on function public.save_stack_item_with_plan', savePlanStart)
    const savePlanRpc = sql.slice(savePlanStart, savePlanEnd)

    expect(groupRpc).toContain("item_tracking_level = 'intake_only'")
    expect(groupRpc).toContain('Intake-only entries cannot store a quantity')
    expect(groupRpc).toContain('Tracked entries require dose and unit')
    expect(groupRpc).toContain("entry_dose <= '1000000000'::numeric")
    expect(savePlanRpc).toContain("plan_dose <= '1000000000'::numeric")
    expect(saveItemRpc).toContain("(row_value ->> 'amount_value')::numeric <= '1000000000'::numeric")
    expect(saveItemRpc).toContain("(row_value ->> 'basis_value')::numeric <= '1000000000'::numeric")
    expect(saveItemRpc).toContain("package_quantity', '')::numeric > '1000000000'::numeric")
    expect(saveItemRpc).toContain("remaining_quantity', '')::numeric > '1000000000'::numeric")
  })

  it.each([
    ['incremental', migration],
    ['foundation', foundation],
  ])('installs only authenticated inventory policies and the exact vial update grant in %s SQL', (_name, sql) => {
    const compact = compactSql(sql)
    const policies = [
      ['stack_item_inventory', 'own stack item inventory select', 'select'],
      ['stack_item_inventory', 'own stack item inventory insert', 'insert'],
      ['stack_item_inventory', 'own stack item inventory update', 'update'],
      ['stack_item_inventory', 'own stack item inventory delete', 'delete'],
      ['stack_item_inventory_movements', 'own stack item inventory movements select', 'select'],
      ['stack_item_inventory_movements', 'own stack item inventory movements insert', 'insert'],
      ['stack_item_inventory_movements', 'own stack item inventory movements update', 'update'],
      ['vial_stock_movements', 'own vial stock movements select', 'select'],
      ['vial_stock_movements', 'own vial stock movements insert', 'insert'],
      ['vial_stock_movements', 'own vial stock movements update', 'update'],
    ] as const

    for (const [table, name, command] of policies) {
      expect(compact).toContain(`create policy "${name}" on public.${table} for ${command} to authenticated`)
    }
    expect(compact).toContain('revoke all on table public.stack_item_inventory from public, anon')
    expect(compact).toContain('revoke all on table public.stack_item_inventory_movements from public, anon')
    expect(compact).toContain('revoke all on table public.vial_stock_movements from public, anon')
    expect(compact).toContain('grant select, insert, update on table public.vial_stock_movements to authenticated')
  })

  it('verifies exact movement indexes, RLS policy definitions, and ACLs without writes', () => {
    const compact = compactSql(verify)

    expect(compact).toContain('required_movement_indexes')
    expect(compact).toContain('index_meta.indisunique')
    expect(compact).toContain('index_meta.indisvalid')
    expect(compact).toContain('index_meta.indisready')
    expect(compact).toContain('index_meta.indnkeyatts = cardinality(required.column_names)')
    expect(compact).toContain('index_meta.indnatts = index_meta.indnkeyatts')
    expect(compact).toContain('array_agg(attribute.attname::text order by key.ordinality)')
    expect(compact).toContain('index_meta.indpred is null')
    expect(compact).toContain('index_meta.indexprs is null')

    expect(compact).toContain('required_inventory_policies')
    expect(compact).toContain('policy.polcmd::text = required.command')
    expect(compact).toContain('policy.polpermissive = required.permissive')
    expect(compact).toContain("policy.polroles = array[(select oid from pg_roles where rolname = 'authenticated')]::oid[]")
    expect(compact).toContain('pg_get_expr(policy.polqual, policy.polrelid, false)')
    expect(compact).toContain('pg_get_expr(policy.polwithcheck, policy.polrelid, false)')
    expect(compact).toContain('unexpected_inventory_policy')

    expect(compact).toContain('required_inventory_grants')
    expect(compact).toContain('aclexplode')
    expect(compact).toContain("acl.grantee = (select oid from pg_roles where rolname = 'authenticated')")
    expect(compact).toContain("acl.grantee = (select oid from pg_roles where rolname = 'anon')")
    expect(compact).toContain('acl.grantee = 0')
    expect(compact).toContain('attribute.attacl')
    expect(compact).toContain('required_rpc_grants')
    expect(compact).toContain("to_regprocedure('public.confirm_intake_group(jsonb)')")
    expect(compact).toContain("to_regprocedure('public.reverse_inventory_confirmation(uuid,text)')")
    expect(verify).not.toMatch(/^\s*(insert\s+into|update\s+public|delete\s+from|drop\s+|alter\s+|create\s+|truncate\s+)/im)
  })

  it('verifies the exact partial routine-slot identity index instead of accepting its name alone', () => {
    const compact = compactSql(verify)
    const checkStart = compact.indexOf("'routine_slot_identity'")
    const checkEnd = compact.indexOf("'stack_item_inventory'", checkStart)
    const routineSlotCheck = compact.slice(checkStart, checkEnd)

    expect(checkStart).toBeGreaterThan(-1)
    expect(checkEnd).toBeGreaterThan(checkStart)
    expect(routineSlotCheck).not.toContain('to_regclass')
    expect(routineSlotCheck).toContain("index_row.relname = 'dose_logs_routine_slot_unique'")
    expect(routineSlotCheck).toContain("index_schema.nspname = 'public'")
    expect(routineSlotCheck).toContain("table_schema.nspname = 'public'")
    expect(routineSlotCheck).toContain("table_row.relname = 'dose_logs'")
    expect(routineSlotCheck).toContain('index_meta.indisunique')
    expect(routineSlotCheck).toContain('index_meta.indisvalid')
    expect(routineSlotCheck).toContain('index_meta.indisready')
    expect(routineSlotCheck).toContain('index_meta.indnkeyatts = 2')
    expect(routineSlotCheck).toContain('index_meta.indnatts = index_meta.indnkeyatts')
    expect(routineSlotCheck).toContain('index_meta.indexprs is null')
    expect(routineSlotCheck).toContain('array_agg(attribute.attname::text order by key.ordinality)')
    expect(routineSlotCheck).toContain("= array['user_id', 'routine_slot_key']::text[]")
    expect(routineSlotCheck).toContain('index_meta.indpred is not null')
    expect(routineSlotCheck).toContain('pg_get_expr(index_meta.indpred, index_meta.indrelid, false)')
    expect(routineSlotCheck).toContain("= 'routine_slot_keyisnotnull'")
  })

  it('rolls back tracking depth in dependency order and restores the prior contracts conservatively', () => {
    const dropIngredientTrigger = rollback.indexOf('drop trigger if exists stack_item_ingredients_completeness_check')
    const dropCompletenessFunction = rollback.indexOf('drop function if exists public.enforce_stack_item_completeness()')
    const dropTrackingColumn = rollback.indexOf('drop column if exists tracking_level')
    const dropVialLedger = rollback.indexOf('drop table if exists public.vial_stock_movements;')
    const dropMovementLedger = rollback.indexOf('drop table if exists public.stack_item_inventory_movements;')
    const dropInventory = rollback.indexOf('drop table if exists public.stack_item_inventory;')

    expect(rollback).toContain('drop function if exists public.confirm_intake_group(jsonb)')
    expect(rollback).toContain('drop function if exists public.apply_inventory_confirmation(uuid)')
    expect(rollback).toContain('drop function if exists public.reverse_inventory_confirmation(uuid, text)')
    expect(rollback).toContain('drop function if exists public.save_stack_item_with_plan(jsonb, jsonb, jsonb)')
    expect(rollback).toContain('create or replace function public.save_stack_item(p_item jsonb, p_ingredients jsonb)')
    expect(rollback).toContain('create or replace function public.enforce_stack_item_completeness()')
    expect(dropIngredientTrigger).toBeGreaterThan(-1)
    expect(dropIngredientTrigger).toBeLessThan(dropCompletenessFunction)
    expect(dropCompletenessFunction).toBeLessThan(dropTrackingColumn)
    expect(dropVialLedger).toBeLessThan(dropMovementLedger)
    expect(dropMovementLedger).toBeLessThan(dropInventory)
    expect(rollback).toContain('drop column if exists routine_slot_key')
    expect(rollback).toContain('alter column basis_value set not null')
    expect(rollback).toContain('alter column basis_unit set not null')
    expect(rollback).toMatch(
      /\(catalog_substance_id is not null\)\s*<>\s*\(nullif\(btrim\(custom_name\), ''\) is not null\)/,
    )
    expect(rollback).toContain('cannot drop inventory tables while inventory data exists')
    expect(rollback).toContain('cannot restore ingredient contracts while incompatible values exist')
    expect(rollback).toContain('routine slot idempotency metadata')
    expect(rollback.trimEnd().endsWith('commit;')).toBe(true)
  })
})
