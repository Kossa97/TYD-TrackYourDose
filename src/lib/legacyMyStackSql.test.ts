import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('../../supabase-legacy-my-stack-compat.sql', import.meta.url),
  'utf8',
)

describe('legacy My Stack database compatibility', () => {
  it('keeps the old form atomic without weakening the new stack RPC', () => {
    expect(sql).toContain('function public.save_legacy_peptide(')
    expect(sql).toContain('returns public.stack_items')
    expect(sql).toContain('insert into public.stack_item_ingredients')
    expect(sql).toContain('from public.substance_catalog candidate')
    expect(sql).toContain("when amount_value is null or amount_unit is null then 'needs_review'")
    expect(sql).not.toContain('create or replace function public.save_stack_item')
  })

  it('restricts the compatibility RPC to authenticated users', () => {
    expect(sql).toContain(
      'revoke execute on function public.save_legacy_peptide(jsonb, jsonb, jsonb)',
    )
    expect(sql).toContain(
      'grant execute on function public.save_legacy_peptide(jsonb, jsonb, jsonb)',
    )
    expect(sql).toContain('to authenticated;')
  })
})
