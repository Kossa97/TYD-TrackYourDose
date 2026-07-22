import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const seedSources = [
  'scripts/seed-test-data.ts',
  'scripts/seed-test-data.mjs',
].map(path => ({
  path,
  source: readFileSync(resolve(path), 'utf8').replace(/\r\n/g, '\n'),
}))

describe('stack item seed contract', () => {
  it.each(seedSources)('$path creates complete stack items atomically', ({ source }) => {
    expect(source).toContain(".rpc('save_stack_item'")
    expect(source).toContain('p_ingredients:')
    expect(source).toContain('basis_value:')
    expect(source).toContain('basis_unit:')
    expect(source).not.toMatch(/\.from\('stack_items'\)\s*\.insert\(/)
  })

  it.each(seedSources)('$path applies legacy tracking fields after the RPC', ({ source }) => {
    const rpcIndex = source.indexOf(".rpc('save_stack_item'")
    const legacyUpdateIndex = source.indexOf(".from('stack_items')\n", rpcIndex)

    expect(rpcIndex).toBeGreaterThan(-1)
    expect(legacyUpdateIndex).toBeGreaterThan(rpcIndex)
    expect(source.slice(legacyUpdateIndex)).toContain('.update(')
  })

  it('configures Selank as a nasal spray', () => {
    expect(seedSources[1].source).toContain("display_name: 'Selank', category: 'peptide', dosage_form: 'nasal_spray'")
  })
})
