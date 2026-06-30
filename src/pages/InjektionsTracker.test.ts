import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('InjektionsTracker fullscreen map layout', () => {
  it('keeps a stable 3D map area above the integrated tracker tabs', () => {
    const pageSource = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')
    const tabsSource = readFileSync(new URL('../components/injection3d/InjectionTrackerTabs.tsx', import.meta.url), 'utf8')

    expect(pageSource).toContain("height: 'calc(100dvh - 1.25rem - env(safe-area-inset-top) - env(safe-area-inset-bottom))'")
    expect(pageSource).toContain("minHeight: 380")
    expect(pageSource).toContain('minHeight={380}')
    expect(tabsSource).toContain('max-h-[34dvh]')
    expect(tabsSource).toContain('max-h-[16dvh]')
  })
})
