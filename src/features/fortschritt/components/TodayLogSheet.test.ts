import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('TodayLogSheet save flow', () => {
  it('waits for refreshed progress data before closing after save', () => {
    const source = readFileSync(new URL('./TodayLogSheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain('onSaved: () => void | Promise<void>')
    expect(source).toContain('await onSaved()')
    expect(source.indexOf('await onSaved()')).toBeLessThan(source.indexOf('onClose()'))
  })

  it('persists the last saved values across progress page remounts', () => {
    const source = readFileSync(new URL('./TodayLogSheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain('SAVED_VALUES_STORAGE_PREFIX')
    expect(source).toContain('localStorage.getItem')
    expect(source).toContain('localStorage.setItem')
    expect(source.indexOf('readStoredSavedValues')).toBeLessThan(source.indexOf('loadLogFormValues(logs, weightLogs, date, savedValues)'))
  })
})
