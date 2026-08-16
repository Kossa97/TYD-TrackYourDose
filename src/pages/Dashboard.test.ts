import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDashboardRoutineIntake } from './Dashboard'

describe('Dashboard intake confirmation actions', () => {
  it('adapts a dashboard slot to the shared group model without a fake intake-only quantity', () => {
    const intake = buildDashboardRoutineIntake({
      key: 'cycle-1-720',
      cycleId: 'cycle-1',
      pendingLogId: 'pending-1',
      stackItemId: 'stack-1',
      stackItemName: 'Vitamin D3',
      trackingLevel: 'intake_only',
      minutes: 720,
      scheduledAt: '2026-07-29T12:00:00.000Z',
      dose: 100,
      unit: 'mcg',
      method: 'Subkutan',
    })

    expect(intake).toMatchObject({
      pendingLogId: 'pending-1',
      group: 'midday',
      dose: null,
      unit: null,
      injectable: true,
    })
  })

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

  it('keeps intake cards and carousel chrome at stable dimensions', () => {
    const source = readFileSync(new URL('./Dashboard.tsx', import.meta.url), 'utf8')

    expect(source).toContain('grid grid-cols-[14px_minmax(0,1fr)_14px] items-stretch gap-0.5')
    expect(source).toContain("hasMultiple ? '' : 'invisible pointer-events-none'")
    expect(source).toContain('className="h-[188px] w-full rounded-xl border px-3 py-2.5 transition-colors"')
    expect(source).toContain('<div className="h-9">')
    expect(source).toContain('className="relative flex h-5 items-center px-0.5"')
  })

  it('defaults to week view with expandable month calendar', () => {
    const source = readFileSync(new URL('./Dashboard.tsx', import.meta.url), 'utf8')

    expect(source).toContain('calendarExpanded')
    expect(source).toContain('const [calendarExpanded, setCalendarExpanded] = useState(false)')
    expect(source).toContain('visibleCalendarDays')
    expect(source).toContain('changeWeek')
    expect(source).toContain('calendar_expand_month')
  })
})
