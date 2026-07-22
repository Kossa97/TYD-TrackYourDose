import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

describe('Peptide compatibility re-export', () => {
  test('re-exports MyStackPage as Peptide', () => {
    const source = readFileSync(new URL('./Peptide.tsx', import.meta.url), 'utf8')
    expect(source).toContain("export { MyStackPage as Peptide } from '../features/my-stack/MyStackPage'")
  })
})