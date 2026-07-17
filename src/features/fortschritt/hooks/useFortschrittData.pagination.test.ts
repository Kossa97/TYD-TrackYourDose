import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = () => readFileSync(new URL('./useFortschrittData.ts', import.meta.url), 'utf8')

describe('useFortschrittData daily log pagination', () => {
  it('lädt daily_logs seitenweise statt nur die ersten 1000 Zeilen', () => {
    const hook = source()

    expect(hook).toContain("import { collectPagedRows } from '../lib/pagination'")
    expect(hook).toContain('collectPagedRows((from, to) =>')
    expect(hook).toContain('.range(from, to)')
  })
})
