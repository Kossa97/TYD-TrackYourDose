import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve('supabase-my-stack-foundation.sql'), 'utf8').toLowerCase()

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

  it('hält Verifier lesend und Rollback vollständig', () => {
    const verifySql = readFileSync(resolve('supabase-my-stack-verify.sql'), 'utf8').toLowerCase()
    const rollbackSql = readFileSync(resolve('supabase-my-stack-rollback.sql'), 'utf8').toLowerCase()

    expect(verifySql).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate)\b/)
    expect(rollbackSql).toContain('begin;')
    expect(rollbackSql).toContain('rename column stack_item_id to peptide_id')
    expect(rollbackSql).toContain('rename column display_name to name')
    expect(rollbackSql).toContain('alter table public.stack_items rename to peptides')
    expect(rollbackSql.trimEnd().endsWith('commit;')).toBe(true)
  })
})
