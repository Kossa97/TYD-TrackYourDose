import { describe, expect, it } from 'vitest'
import { INJECTION_TRACKER_TABS } from './injectionTrackerTabs'

describe('injection tracker tabs', () => {
  it('keeps only the approved open and history tabs', () => {
    expect(INJECTION_TRACKER_TABS).toEqual(['open', 'history'])
  })
})
