import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

describe('PeptideFormModal mobile layout', () => {
  test('uses the full mobile viewport for the main sheet', () => {
    const source = readFileSync(new URL('./PeptideFormModal.tsx', import.meta.url), 'utf8')

    expect(source).toContain('h-[100dvh]')
    expect(source).toContain('sm:h-auto')
    expect(source).toContain('rounded-none')
    expect(source).toContain('pt-[env(safe-area-inset-top)]')
  })
})
