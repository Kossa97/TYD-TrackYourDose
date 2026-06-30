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

  it('uses two separate floating action buttons instead of a persistent bottom bar', () => {
    const source = readFileSync(new URL('../components/injection3d/InjectionTrackerTabs.tsx', import.meta.url), 'utf8')

    expect(source).toContain('injection-floating-actions')
    expect(source).toContain('left-4')
    expect(source).toContain('right-4')
    expect(source).toContain("openSheet('open')")
    expect(source).toContain("openSheet('history')")
    expect(source).not.toContain('role="tablist"')
    expect(source).not.toContain('aria-expanded={expanded}')
  })

  it('opens selected tracker content in a compact overlay sheet', () => {
    const source = readFileSync(new URL('../components/injection3d/InjectionTrackerTabs.tsx', import.meta.url), 'utf8')

    expect(source).toContain('activeSheet')
    expect(source).toContain('setActiveSheet(null)')
    expect(source).toContain('max-h-[48dvh]')
    expect(source).toContain('InjectionHistorySheet')
  })

  it('uses one scroll container for the embedded history sheet', () => {
    const source = readFileSync(new URL('../components/injection3d/InjectionHistorySheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain("embedded ? 'space-y-3' : 'max-h-[48vh] space-y-3 overflow-y-auto pr-1'")
  })

  it('passes tracker sheet state into focus requests for visible-area camera framing', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('trackerSheetOpen')
    expect(source).toContain('sheetOpen: trackerSheetOpen')
    expect(source).toContain('onSheetOpenChange={setTrackerSheetOpen}')
  })

  it('shows a compact active pin chip with only substance and age', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('activeLog')
    expect(source).toContain('getInjectionPinSubstance(activeLog)')
    expect(source).toContain('formatInjectionPinAge(activeLog.logged_at)')
    expect(source).toContain('injection-active-pin-chip')
  })

  it('hides floating tracker actions while confirming a new injection position', () => {
    const source = readFileSync(new URL('./InjektionsTracker.tsx', import.meta.url), 'utf8')

    expect(source).toContain('const showPositionActions = draftPin && !showLogSheet')
    expect(source).toContain('{showPositionActions && (')
    expect(source).toContain('{!showPositionActions && (')
    expect(source).toContain('setTrackerSheetOpen(false)')
  })
})
