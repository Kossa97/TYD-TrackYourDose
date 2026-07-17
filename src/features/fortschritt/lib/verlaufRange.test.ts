import { describe, expect, it } from 'vitest'
import { DEFAULT_RANGE_CHIP } from './verlaufRange'

describe('DEFAULT_RANGE_CHIP', () => {
  it('startet Fortschritt mit dem gesamten Zeitraum', () => {
    expect(DEFAULT_RANGE_CHIP).toBe('alles')
  })
})
