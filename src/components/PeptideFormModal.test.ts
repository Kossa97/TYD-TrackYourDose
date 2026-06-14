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

  test('uses the full mobile viewport for field editor sheets', () => {
    const source = readFileSync(new URL('./PeptideFormModal.tsx', import.meta.url), 'utf8')

    expect(source).toContain('fixed inset-0 sm:bottom-0 sm:left-0 sm:right-0 sm:top-auto z-[70]')
    expect(source).toContain('rounded-none sm:rounded-t-2xl')
    expect(source).toContain('h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[85vh]')
    expect(source).toContain('pt-[env(safe-area-inset-top)] sm:pt-0')
  })
})
