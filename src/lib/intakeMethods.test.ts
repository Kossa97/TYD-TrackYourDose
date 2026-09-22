import { describe, expect, it, vi } from 'vitest'
import { methodLabel } from './intakeMethods'

describe('methodLabel', () => {
  const t = vi.fn((key: string, options?: Record<string, unknown>) => (
    ({ method_subkutan: 'Subcutaneous' } as Record<string, string>)[key] ?? options?.defaultValue
  ))

  it('translates a known route and trims stray whitespace first', () => {
    expect(methodLabel(t, 'Subkutan')).toBe('Subcutaneous')
    expect(methodLabel(t, 'Subkutan ')).toBe('Subcutaneous')
  })

  it('returns anything else unchanged and never hands it to i18next as a key', () => {
    t.mockClear()
    expect(methodLabel(t, 'i.m.: Gluteus')).toBe('i.m.: Gluteus')
    expect(methodLabel(t, 'constructor')).toBe('constructor')
    expect(methodLabel(t, null)).toBe('')
    expect(t).not.toHaveBeenCalled()
  })
})
