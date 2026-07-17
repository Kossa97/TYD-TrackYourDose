import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { isLegacyPhotoUrl } from '../hooks/useFortschrittData'

const hookSource = () => readFileSync(new URL('../hooks/useFortschrittData.ts', import.meta.url), 'utf8')

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
