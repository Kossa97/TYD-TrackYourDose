import { describe, expect, it } from 'vitest'
import {
  areInjectionDetailsLocked,
  injectionSaveActionLabel,
  replaceTimeInLocalDateTime,
} from './injectionLogSheetState'

describe('areInjectionDetailsLocked', () => {
  it('locks intake details only after an open intake was selected', () => {
    expect(areInjectionDetailsLocked('intake', false)).toBe(false)
    expect(areInjectionDetailsLocked('intake', true)).toBe(true)
    expect(areInjectionDetailsLocked('manual', true)).toBe(false)
  })
})
describe('replaceTimeInLocalDateTime', () => {
  it('changes only the time and preserves the selected intake day', () => {
    expect(replaceTimeInLocalDateTime('2026-06-24T20:00', '18:35')).toBe(
      '2026-06-24T18:35',
    )
  })
})
describe('injectionSaveActionLabel', () => {
  it('distinguishes open confirmation from adding a pin to a confirmed intake', () => {
    expect(injectionSaveActionLabel('open')).toBe('Speichern & bestätigen')
    expect(injectionSaveActionLabel('confirmed')).toBe('Injektionsstelle hinzufügen')
  })
})
