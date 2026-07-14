import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('TodayLogSheet save flow', () => {
  it('waits for refreshed progress data before closing after save', () => {
    const source = readFileSync(new URL('./TodayLogSheet.tsx', import.meta.url), 'utf8')

    expect(source).toContain('onSaved: () => void | Promise<void>')
    expect(source).toContain('await onSaved()')
    expect(source.indexOf('await onSaved()')).toBeLessThan(source.indexOf('onClose()'))
  })
})
