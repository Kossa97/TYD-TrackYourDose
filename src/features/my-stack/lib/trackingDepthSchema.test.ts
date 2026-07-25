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
    expect(migration).not.toMatch(/coalesce\\([^)]*dose[^)]*,\\s*0\\)/i)
  })

  it('keeps fresh installs and incremental installs aligned', () => {
    expect(foundation).toContain('tracking_level')
    expect(foundation).toContain('pk_profile_method')
    expect(verify).toContain('tracking_depth_contract')
  })
})
