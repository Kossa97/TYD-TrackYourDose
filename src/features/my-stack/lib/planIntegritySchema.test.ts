import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase-my-stack-plan-integrity.sql', 'utf8')
  .replace(/\r\n/g, '\n')

describe('My Stack plan-integrity confirmation contract', () => {
  it('resolves the authoritative plan version before any dose-log write', () => {
    const rpcStart = migration.indexOf('create or replace function public.confirm_intake_group')
    const rpcEnd = migration.indexOf(
      'revoke execute on function public.confirm_intake_group',
      rpcStart,
    )
    const rpc = migration.slice(rpcStart, rpcEnd)
    const resolver = rpc.indexOf('public.resolve_plan_version_id(')
    const firstWrite = rpc.indexOf('update public.dose_logs')

    expect(rpcStart).toBeGreaterThan(-1)
    expect(rpcEnd).toBeGreaterThan(rpcStart)
    expect(resolver).toBeGreaterThan(-1)
    expect(resolver).toBeLessThan(firstWrite)
    expect(rpc).toContain('Plan version does not match scheduled intake')
    expect(rpc).toContain('entry_timezone')
    expect(rpc).toContain('entry_plan_version_id')
  })

  it('writes exact cycle and plan-version provenance on every confirmation path', () => {
    const rpcStart = migration.indexOf('create or replace function public.confirm_intake_group')
    const rpcEnd = migration.indexOf(
      'revoke execute on function public.confirm_intake_group',
      rpcStart,
    )
    const rpc = migration.slice(rpcStart, rpcEnd)

    expect(rpc).toMatch(/update public\.dose_logs\s+set[\s\S]*cycle_id = entry_cycle_id,[\s\S]*plan_version_id = expected_plan_version_id/)
    expect(rpc).toMatch(/insert into public\.dose_logs \([\s\S]*cycle_id,[\s\S]*plan_version_id[\s\S]*\) values \([\s\S]*entry_cycle_id,[\s\S]*expected_plan_version_id/)
    expect(rpc).toContain('saved_log.cycle_id is distinct from entry_cycle_id')
    expect(rpc).toContain('saved_log.plan_version_id is distinct from expected_plan_version_id')
  })

  it('protects referenced plan versions at the table boundary', () => {
    expect(migration).toContain(
      'create or replace function public.reject_referenced_plan_version_mutation()',
    )
    expect(migration).toContain('Plan version has confirmed intake history')
    expect(migration).toMatch(
      /create trigger reject_referenced_plan_version_mutation\s+before update or delete\s+on public\.cycle_plan_versions/,
    )
  })

  it('limits editable timestamps and version provenance to exact pending rows', () => {
    const rpc = migration.slice(
      migration.indexOf('create or replace function public.confirm_intake_group'),
      migration.indexOf('revoke execute on function public.confirm_intake_group'),
    )

    expect(rpc).toMatch(/saved_log\.taken is true and \([\s\S]*saved_log\.logged_at <> entry_logged_at[\s\S]*saved_log\.plan_version_id is distinct from expected_plan_version_id/)
    expect(rpc).toContain('and (routine_slot_key is null or routine_slot_key = entry_slot_key)')
    expect(rpc).not.toContain('and logged_at = entry_logged_at')
    expect(rpc).not.toContain('and (plan_version_id is null or plan_version_id = expected_plan_version_id)')
    expect(rpc).toContain('if saved_log.taken is null then')
  })

  it('rechecks version immutability at transaction end after concurrent confirmations', () => {
    expect(migration).toMatch(
      /create constraint trigger reject_referenced_plan_version_mutation_at_commit\s+after update or delete\s+on public\.cycle_plan_versions\s+deferrable initially deferred\s+for each row\s+execute function public\.reject_referenced_plan_version_mutation\(\)/,
    )
  })
})
