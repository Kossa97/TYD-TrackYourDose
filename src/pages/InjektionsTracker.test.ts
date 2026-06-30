import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('InjektionsTracker fullscreen map layout', () => {
  it('lets the tracker window fill the app viewport without outer margins', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('className="min-h-dvh overflow-hidden"')
    expect(source).toContain("height: '100dvh'")
    expect(source).toContain('borderRadius: 0')
    expect(source).toContain('height="100dvh"')
    expect(source).toContain('minHeight="100dvh"')
  })

  it('keeps the open/history tabs in a collapsible bottom sheet overlay', () => {
    const source = readFileSync(new URL('../components/injection3d/InjectionTrackerTabs.tsx', import.meta.url), 'utf8')

    expect(source).toContain('absolute bottom-0 left-0 right-0')
    expect(source).toContain('aria-expanded={expanded}')
    expect(source).toContain("expanded ? 'max-h-[46dvh]' : 'max-h-[18dvh]'")
    expect(source).toContain('onClick={() => setExpanded')
    expect(source).toContain("expanded ? 'max-h-[30dvh]' : 'max-h-[0px]'")
  })
})
