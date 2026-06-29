import { describe, expect, it } from 'vitest'
import { buildInjectionTrackerSummary, formatInjectionTrackerTabCount, INJECTION_TRACKER_TABS } from './injectionTrackerTabs'
import type { OpenInjectionIntake } from './injectionPersistence'
import type { InjectionLog3D } from './injectionLogTypes'

const baseLog = (overrides: Partial<InjectionLog3D>): InjectionLog3D => ({
  id: 'log-1',
  user_id: 'user-1',
  dose_log_id: null,
  dose_taken: undefined,
  peptide_id: null,
  cycle_id: null,
  peptide_name: null,
  cycle_name: null,
  dose: null,
  unit: null,
  method: null,
  notes: null,
  logged_at: '2026-06-29T08:00:00.000Z',
  created_at: null,
  model_version: 'placeholder-v1',
  body_region: 'abdomen',
  body_side: 'right',
  position: { x: 0.24, y: 0.1, z: 0.42 },
  normal: { x: 0, y: 0, z: 1 },
  uv: null,
  camera_state: null,
  warning_state: null,
  substance_label: null,
  ...overrides,
})

const intake = (overrides: Partial<OpenInjectionIntake>): OpenInjectionIntake => ({
  cycleId: 'cycle-1',
  peptideId: 'peptide-1',
  peptideName: 'Ipamorelin',
  cycleName: 'Evening',
  dose: 100,
  unit: 'mcg',
  method: 'Subkutan',
  scheduledAt: '2026-06-29T20:00:00.000Z',
  daysOverdue: 0,
  status: 'open',
  doseLogId: null,
  ...overrides,
})

describe('injection tracker tabs', () => {
  it('keeps the lower tracker navigation in the approved order', () => {
    expect(INJECTION_TRACKER_TABS).toEqual(['overview', 'open', 'history'])
  })

  it('caps large tab badges for mobile width', () => {
    expect(formatInjectionTrackerTabCount(0)).toBe('0')
    expect(formatInjectionTrackerTabCount(7)).toBe('7')
    expect(formatInjectionTrackerTabCount(100)).toBe('99+')
  })

  it('summarizes open intakes, recent logs, and latest injection', () => {
    const logs = [
      baseLog({ id: 'old', logged_at: '2026-06-10T08:00:00.000Z' }),
      baseLog({ id: 'latest', peptide_name: 'CJC-1295 DAC', logged_at: '2026-06-28T18:30:00.000Z' }),
      baseLog({ id: 'recent', logged_at: '2026-06-25T18:30:00.000Z' }),
    ]
    const openIntakes = [
      intake({ status: 'open' }),
      intake({ status: 'confirmed', doseLogId: 'dose-1' }),
    ]

    const summary = buildInjectionTrackerSummary({
      logs,
      openIntakes,
      now: new Date('2026-06-29T12:00:00.000Z'),
    })

    expect(summary.openIntakeCount).toBe(1)
    expect(summary.confirmedIntakeCount).toBe(1)
    expect(summary.pendingSiteCount).toBe(2)
    expect(summary.recentLogCount).toBe(2)
    expect(summary.latestLog?.id).toBe('latest')
    expect(summary.lastUsedDaysAgo).toBe(1)
  })
})
