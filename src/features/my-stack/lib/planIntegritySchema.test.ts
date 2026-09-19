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
})
