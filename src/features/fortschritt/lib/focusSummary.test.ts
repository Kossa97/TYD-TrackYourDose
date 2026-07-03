import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { defaultFocusSubstanceId } from './focusSummary'
import { isLegacyPhotoUrl } from '../hooks/useFortschrittData'
import type { CycleSubstance } from '../types'

const hookSource = () => readFileSync(new URL('../hooks/useFortschrittData.ts', import.meta.url), 'utf8')

function cycle(overrides: Partial<CycleSubstance>): CycleSubstance {
  return {
    id: 'c1',
    name: 'BPC-157',
    mode: 'cycle',
    startDate: '2026-01-01',
    endDate: null,
    active: true,
    color: '#06b6d4',
    peptideId: 'p1',
    ...overrides,
  }
}

describe('defaultFocusSubstanceId', () => {
  test('prefers the oldest active substance over older ended cycles', () => {
    const ended = cycle({ id: 'ended', startDate: '2025-01-01', endDate: '2025-03-01', active: false })
    const active = cycle({ id: 'active', startDate: '2026-02-01' })

    expect(defaultFocusSubstanceId([ended, active], [])).toBe('active')
  })

  test('falls back to ended cycles when nothing is active', () => {
    const ended = cycle({ id: 'ended', startDate: '2025-01-01', endDate: '2025-03-01', active: false })

    expect(defaultFocusSubstanceId([ended], [])).toBe('ended')
  })

  test('returns null without any substances', () => {
    expect(defaultFocusSubstanceId([], [])).toBeNull()
  })
})

describe('fortschritt data loading', () => {
  test('loads ended cycles too so Verlauf can show the full history', () => {
    const text = hookSource()

    expect(text).not.toContain(".eq('active', true)")
    expect(text).toContain('fullRange')
  })

  test('keeps wohlbefinden strictly separate from libido', () => {
    const text = hookSource()

    // der alte Fallback zeigte Libido-Werte als Wohlbefinden an
    expect(text).not.toContain(': (row.libido')
    expect(text).toContain('wohlbefinden: row.wohlbefinden != null ? Number(row.wohlbefinden) : null')
  })

  test('only shows the blocking loader on first load, not on refresh', () => {
    const text = hookSource()

    expect(text).toContain('initialLoadedRef')
    expect(text).toContain('if (!initialLoadedRef.current) setLoading(true)')
  })
})

describe('isLegacyPhotoUrl', () => {
  test('distinguishes legacy public URLs from private storage paths', () => {
    expect(isLegacyPhotoUrl('https://x.supabase.co/storage/v1/object/public/batch-files/a.jpg')).toBe(true)
    expect(isLegacyPhotoUrl('user-id/1730000000000.jpg')).toBe(false)
  })
})
