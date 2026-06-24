import { describe, expect, it } from 'vitest'
import { areInjectionDetailsLocked } from './injectionLogSheetState'

describe('areInjectionDetailsLocked', () => {
  it('locks intake details only after an open intake was selected', () => {
    expect(areInjectionDetailsLocked('intake', false)).toBe(false)
    expect(areInjectionDetailsLocked('intake', true)).toBe(true)
    expect(areInjectionDetailsLocked('manual', true)).toBe(false)
  })
})
