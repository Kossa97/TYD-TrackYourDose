import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('Dashboard intake confirmation actions', () => {
  it('keeps taken and skipped in the first row and injection confirmation in the second row', () => {
    const source = readFileSync(new URL('./Dashboard.tsx', import.meta.url), 'utf8')

    expect(source).toContain('grid grid-cols-2 gap-2')
    expect(source).toContain("<XCircle size={11} /> <span className=\"truncate\">{t('uebersprungen')}</span>")
    expect(source).toContain('Mit Injektion best\u00e4tigen')
    expect(source.indexOf('grid grid-cols-2 gap-2')).toBeLessThan(source.indexOf('Mit Injektion best\u00e4tigen'))
  })

  it('groups open intakes into horizontal period carousels and collapsible completed list', () => {
    const source = readFileSync(new URL('./Dashboard.tsx', import.meta.url), 'utf8')

    expect(source).toContain('duePeriodCarousels')
    expect(source).toContain('snap-x snap-mandatory')
    expect(source).toContain("PERIOD_ORDER: PeriodKey[] = ['morgens', 'mittags', 'abends']")
    expect(source).toContain('completedExpanded')
    expect(source).toContain('renderConfirmedLog')
  })
})