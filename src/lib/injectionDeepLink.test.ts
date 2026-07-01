import { describe, expect, it } from 'vitest'
import {
  buildInjectionTrackerUrl,
  findTargetInjectionIntake,
  getOpenInjectionIntakeKey,
  isInjectableMethod,
} from './injectionDeepLink'
import type { OpenInjectionIntake } from './injectionPersistence'

const intake = (overrides: Partial<OpenInjectionIntake> = {}): OpenInjectionIntake => ({
  cycleId: 'cycle-1',
  peptideId: 'pep-1',
  peptideName: 'Ipamorelin',
  cycleName: 'Ipamorelin Cycle',
  dose: 100,
  unit: 'mcg',
  method: 'Subkutan',
  scheduledAt: '2026-07-01T18:00:00.000Z',
  daysOverdue: 0,
  status: 'open',
  doseLogId: null,
  ...overrides,
})

describe('injection deep links', () => {
  it('builds a tracker URL for a scheduled cycle intake', () => {
    expect(buildInjectionTrackerUrl({
      cycleId: 'cycle-1',
      scheduledAt: '2026-07-01T18:00:00.000Z',
      returnTo: '/kalender?date=2026-07-01#due-intakes',
    })).toBe('/injektionen?cycleId=cycle-1&scheduledAt=2026-07-01T18%3A00%3A00.000Z&returnTo=%2Fkalender%3Fdate%3D2026-07-01%23due-intakes')
  })

  it('prefers dose log id when finding a target intake', () => {
    const target = intake({ cycleId: 'cycle-b', doseLogId: 'dose-7' })
    const params = new URLSearchParams('doseLogId=dose-7&cycleId=cycle-a&scheduledAt=2026-07-01T18%3A00%3A00.000Z')
    expect(findTargetInjectionIntake([intake({ cycleId: 'cycle-a' }), target], params)).toBe(target)
  })

  it('matches open cycle intakes by cycle and scheduled timestamp', () => {
    const target = intake({ cycleId: 'cycle-2', scheduledAt: '2026-07-01T20:00:00.000Z' })
    const params = new URLSearchParams('cycleId=cycle-2&scheduledAt=2026-07-01T20%3A00%3A00.000Z')
    expect(getOpenInjectionIntakeKey(findTargetInjectionIntake([intake(), target], params)!)).toBe('cycle-2|2026-07-01T20:00:00.000Z')
  })

  it('detects injectable methods used by the calendar', () => {
    expect(isInjectableMethod('Subkutan')).toBe(true)
    expect(isInjectableMethod('Intramuskulär')).toBe(true)
    expect(isInjectableMethod('Intramuskulaer')).toBe(true)
    expect(isInjectableMethod('Oral')).toBe(false)
  })
})
