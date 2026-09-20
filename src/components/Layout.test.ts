import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { routeLayoutMode } from './layoutMode'

describe('Layout injection tracker fullscreen route', () => {
  it('hides global bottom navigation and floating FAQ button on the injection tracker route', () => {
    const source = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8')

    expect(routeLayoutMode('/injektionen')).toEqual({
      lockViewport: true,
      hideBottomNav: true,
      hideFloatingFaq: true,
    })
    expect(source).toContain('{!hideBottomNav && (')
    expect(source).toContain('{!hideFloatingFaq && (')
  })
  it('does not add extra vertical padding on the fullscreen injection route', () => {
    const source = readFileSync(new URL('./Layout.tsx', import.meta.url), 'utf8')

    expect(source).toContain("hideBottomNav ? 'h-dvh px-0 pt-0 overflow-hidden overscroll-none'")
    expect(source).toContain('paddingBottom: hideBottomNav ? 0')
  })
})

describe('Layout viewport ownership', () => {
  it('locks My Stack to the app viewport without hiding its bottom navigation', () => {
    expect(routeLayoutMode('/my-stack')).toEqual({
      lockViewport: true,
      hideBottomNav: false,
      hideFloatingFaq: false,
    })
    expect(routeLayoutMode('/kalender').lockViewport).toBe(false)
  })
})
