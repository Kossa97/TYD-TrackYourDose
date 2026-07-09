import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dismissProgressEntryHighlight,
  isProgressEntryHighlightDismissed,
} from './progressEntryHighlight'

describe('progressEntryHighlight', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value) },
      removeItem: (key: string) => { store.delete(key) },
      clear: () => { store.clear() },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts undismissed', () => {
    expect(isProgressEntryHighlightDismissed()).toBe(false)
  })

  it('stays dismissed after marking complete', () => {
    dismissProgressEntryHighlight()
    expect(isProgressEntryHighlightDismissed()).toBe(true)
  })
})
