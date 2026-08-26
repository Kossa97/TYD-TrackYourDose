import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve('supabase-my-stack-foundation.sql'), 'utf8')
  .replace(/\r\n/g, '\n')
  .toLowerCase()

describe('my stack migration contract', () => {
  it('läuft in einer Transaktion und benennt die zentrale Tabelle um', () => {
    expect(sql).toContain('begin;')
    expect(sql).toContain('alter table public.peptides rename to stack_items')
    expect(sql).toContain('alter table public.stack_items rename column name to display_name')
    expect(sql.trimEnd().endsWith('commit;')).toBe(true)
  })

  it.each(['vials', 'dose_logs', 'cycles', 'effects', 'reviews', 'injection_logs'])(
    'benennt %s.peptide_id um', table => {
      expect(sql).toContain(`alter table public.${table} rename column peptide_id to stack_item_id`)
    },
  )

  it('legt Katalog, Inhaltsstoffe, RLS und atomare Save-Funktion an', () => {
    expect(sql).toContain('create table public.substance_catalog')
    expect(sql).toContain('create table public.stack_item_ingredients')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('create or replace function public.save_stack_item')
  })

  it('migriert fehlende Stärken als needs_review statt Werte zu erfinden', () => {
    expect(sql).toContain("configuration_status = 'needs_review'")
    expect(sql).toContain('vial_amount_mg is null')
  })

  it('führt Peptipedia nicht in den Rename ein', () => {
    expect(sql).not.toContain('alter table public.peptide_library')
  })

  it('hält den Verifier-Schreibpfad rollback-gebunden und Rollback vollständig', () => {
    const verifySql = readFileSync(resolve('supabase-my-stack-verify.sql'), 'utf8').toLowerCase()
    const rollbackSql = readFileSync(resolve('supabase-my-stack-rollback.sql'), 'utf8').toLowerCase()

    expect(verifySql).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate)\b/)
    expect(rollbackSql).toContain('begin;')
    expect(rollbackSql).toContain('rename column stack_item_id to peptide_id')
    expect(rollbackSql).toContain('rename column display_name to name')
    expect(rollbackSql).toContain('alter table public.stack_items rename to peptides')
    expect(rollbackSql.trimEnd().endsWith('commit;')).toBe(true)
  })

  it('enforces complete entries as a deferred database invariant', () => {
    expect(sql).toContain('create or replace function public.enforce_stack_item_completeness')
    expect(sql).toContain('create constraint trigger stack_items_completeness_check')
    expect(sql).toContain('create constraint trigger stack_item_ingredients_completeness_check')
    expect(sql.match(/deferrable initially deferred/g)).toHaveLength(2)
    expect(sql).toContain('complete stack item requires at least one ingredient')
    expect(sql).toContain('complete stack item requires complete ingredients')
  })

  it('clears both legacy strength fields when the unit is missing', () => {
    expect(sql).toContain("item.vial_amount_mg > 0\n      and item.vial_amount_mg < 'infinity'::numeric\n      and nullif(btrim(item.vial_amount_unit), '') is not null\n      then item.vial_amount_mg")
    expect(sql).toContain("item.vial_amount_mg > 0\n      and item.vial_amount_mg < 'infinity'::numeric\n      and nullif(btrim(item.vial_amount_unit), '') is not null\n      then btrim(item.vial_amount_unit)")
  })

  it('keeps rollback re-runnable after a successful run', () => {
    const rollbackSql = readFileSync(resolve('supabase-my-stack-rollback.sql'), 'utf8').toLowerCase()

    expect(rollbackSql).toContain('drop function if exists public.save_stack_item')
    expect(rollbackSql).toContain("if to_regclass('public.stack_items') is not null then")
    expect(rollbackSql).toContain("if to_regclass('public.peptides') is null then")
  })

  it('reports policy predicates and table grants in the verifier', () => {
    const verifySql = readFileSync(resolve('supabase-my-stack-verify.sql'), 'utf8').toLowerCase()

    expect(verifySql).toContain('policy.qual')
    expect(verifySql).toContain('policy.with_check')
    expect(verifySql).toContain('information_schema.role_table_grants')
  })

  it('grants authenticated users the ingredient access required by the invoker RPC', () => {
    expect(sql).toContain('revoke all on table public.stack_item_ingredients from public, anon')
    expect(sql).toContain(
      'grant select, insert, update, delete on table public.stack_item_ingredients to authenticated',
    )
    expect(sql).not.toContain(
      'grant select, insert, update, delete on table public.stack_item_ingredients to anon',
    )
  })

  it('runs a real authenticated save path in a rolled-back verifier transaction', () => {
    const verifySql = readFileSync(resolve('supabase-my-stack-verify.sql'), 'utf8').toLowerCase()

    expect(verifySql).toContain('begin;')
    expect(verifySql).toContain("'request.jwt.claim.sub'")
    expect(verifySql).toContain('set local role authenticated')
    expect(verifySql).toContain('public.save_stack_item(')
    expect(verifySql).toContain('set constraints all immediate')
    expect(verifySql).toContain('__my_stack_verifier_rollback__')
    expect(verifySql).toContain('rollback;')
    expect(verifySql).toContain('qa_records_after_rollback')
    expect(verifySql).not.toContain('commit;')

    const beginPosition = verifySql.indexOf('begin;')
    const claimPosition = verifySql.indexOf("'request.jwt.claim.sub'")
    const rolePosition = verifySql.indexOf('set local role authenticated')
    const rpcPosition = verifySql.indexOf('select (public.save_stack_item(', rolePosition)
    const constraintsPosition = verifySql.indexOf('set constraints all immediate')
    const resetRolePosition = verifySql.indexOf('reset role;')
    const rollbackPosition = verifySql.indexOf('rollback;')
    const cleanupPosition = verifySql.indexOf('qa_records_after_rollback')

    expect(beginPosition).toBeLessThan(claimPosition)
    expect(claimPosition).toBeLessThan(rolePosition)
    expect(rolePosition).toBeLessThan(rpcPosition)
    expect(rpcPosition).toBeLessThan(constraintsPosition)
    expect(constraintsPosition).toBeLessThan(resetRolePosition)
    expect(resetRolePosition).toBeLessThan(rollbackPosition)
    expect(rollbackPosition).toBeLessThan(cleanupPosition)
  })

  it('documents the compatible backup and completed linked cutover evidence', () => {
    const manifest = readFileSync(
      resolve('docs/superpowers/checklists/my-stack-backup-manifest.md'),
      'utf8',
    ).toLowerCase()

    expect(manifest).toContain('pre-my-stack-foundation-2026-07-24-compatible-v2')
    expect(manifest).toContain(
      '2e8f3b0bb12f7da5b3fcbedb55857ba915a39f80d0ac2c0211f7ae81e09e833e',
    )
    expect(manifest).toContain(
      '98167808b5cd236e94fc18d6c692bd4d6faa1ba517d8e8c326ced86a80837c4c',
    )
    expect(manifest).toContain('linked cutover: passed with explicit user approval')
    expect(manifest).toContain(
      'pre/post linked row counts: matched (`stack_items`: 14; `stack_item_ingredients`: 14)',
    )
    expect(manifest).toContain('linked foreign-key orphan check: zero')
    expect(manifest).toContain(
      'linked qa records removed: yes (`qa_items`: 0; `qa_ingredients`: 0)',
    )
  })

  it('reserves needs_review for migrated legacy rows', () => {
    expect(sql).toContain('create or replace function public.enforce_stack_item_review_status')
    expect(sql).toContain('new stack items cannot start as needs_review')
    expect(sql).toContain('complete stack items cannot return to needs_review')
  })

  it('makes stack ownership checks explicit for writes', () => {
    expect(sql).toContain('alter policy "own stack items" on public.stack_items\n  using (auth.uid() = user_id)\n  with check (auth.uid() = user_id)')
  })

  it('rejects non-finite amount and basis numerics at every migration boundary', () => {
    const verifySql = readFileSync(resolve('supabase-my-stack-verify.sql'), 'utf8').toLowerCase()

    expect(sql).toContain("basis_value > 0\n      and basis_value < 'infinity'::numeric")
    expect(sql).toContain("amount_value > 0\n        and amount_value < 'infinity'::numeric")
    expect(sql.match(/vial_amount_mg < 'infinity'::numeric/g)).toHaveLength(4)
    expect(sql).toContain("ingredient.amount_value < 'infinity'::numeric")
    expect(sql).toContain("ingredient.basis_value < 'infinity'::numeric")
    expect(sql).toContain("(row_value ->> 'basis_value')::numeric <= '1000000000'::numeric")
    expect(sql).toContain("(row_value ->> 'amount_value')::numeric <= '1000000000'::numeric")
    expect(verifySql).toContain("ingredient.amount_value >= 'infinity'::numeric")
    expect(verifySql).toContain("ingredient.basis_value >= 'infinity'::numeric")
  })

  it('serializes completeness checks on every affected parent in deterministic order', () => {
    expect(sql).toContain('select array_agg(distinct affected_item_id order by affected_item_id)')
    expect(sql).toContain('from unnest(item_ids_to_check) affected_item_id')
    expect(sql).toContain('order by item.id\n  for update')
    expect(sql).toContain('foreach item_id_to_check in array item_ids_to_check')
    expect(sql).toContain('array[old.stack_item_id, new.stack_item_id]')

    const lockPosition = sql.indexOf('order by item.id\n  for update')
    const validationPosition = sql.indexOf('foreach item_id_to_check in array item_ids_to_check')
    expect(lockPosition).toBeGreaterThan(-1)
    expect(lockPosition).toBeLessThan(validationPosition)
  })
})
