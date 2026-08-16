import { describe, expect, it } from 'vitest'
import type { RoutineIntake } from './intakeGroups'
import { buildConfirmationEntry, groupRoutineIntakes, routineGroupFromMinutes } from './intakeGroups'

function intake(overrides: Partial<RoutineIntake> = {}): RoutineIntake {
  return {
    key: 'item-1',
    cycleId: 'cycle-1',
    pendingLogId: null,
    stackItemId: 'stack-1',
    stackItemName: 'Vitamin D3',
    trackingLevel: 'complete',
    group: 'morning',
    scheduledAt: '2026-07-29T08:00:00.000Z',
    dose: 100,
    unit: 'mcg',
    method: 'Oral',
    injectable: false,
    ...overrides,
  }
}

describe('groupRoutineIntakes', () => {
  it('groups mixed tracking levels in fixed period order and sorts each period by time', () => {
    const groups = groupRoutineIntakes([
      intake({ key: 'evening', group: 'evening', scheduledAt: '2026-07-29T20:00:00.000Z' }),
      intake({ key: 'zinc', stackItemName: 'Zink', group: 'morning', trackingLevel: 'with_amount', dose: 25, unit: 'mg', scheduledAt: '2026-07-29T09:00:00.000Z' }),
      intake({ key: 'd3', trackingLevel: 'intake_only', dose: null, unit: null, scheduledAt: '2026-07-29T08:00:00.000Z' }),
      intake({ key: 'midday', group: 'midday', scheduledAt: '2026-07-29T12:00:00.000Z' }),
    ])

    expect(groups.map(group => group.key)).toEqual(['morning', 'midday', 'evening'])
    expect(groups[0].items.map(item => item.key)).toEqual(['d3', 'zinc'])
  })

  it('keeps intake-only confirmation quantities null instead of inventing a dose', () => {
    expect(buildConfirmationEntry(intake({
      trackingLevel: 'intake_only',
      dose: null,
      unit: null,
    }))).toMatchObject({
      selected: true,
      actualDose: null,
      actualUnit: null,
    })
  })

  it.each([
    [0, 'morning'],
    [719, 'morning'],
    [720, 'midday'],
    [1079, 'midday'],
    [1080, 'evening'],
    [1439, 'evening'],
  ] as const)('assigns minute %s to the fixed %s routine', (minutes, expected) => {
    expect(routineGroupFromMinutes(minutes)).toBe(expected)
  })
})
