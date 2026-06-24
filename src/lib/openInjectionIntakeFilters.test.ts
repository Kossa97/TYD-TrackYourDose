import { describe, expect, it } from 'vitest'
import { filterOpenInjectionIntakes } from './openInjectionIntakeFilters'
import type { OpenInjectionIntake } from './injectionPersistence'

const intake = (
  cycleId: string,
  scheduledAt: string,
  daysOverdue: number,
): OpenInjectionIntake => ({
  cycleId,
  peptideId: `peptide-${cycleId}`,
  peptideName: cycleId,
  cycleName: cycleId,
  dose: 100,
  unit: 'mcg',
  method: 'Subkutan',
  scheduledAt,
  daysOverdue,
})

describe('filterOpenInjectionIntakes', () => {
  const intakes = [
    intake('cycle-a', '2026-06-23T20:00:00.000Z', 1),
    intake('cycle-b', '2026-06-20T20:00:00.000Z', 4),
    intake('cycle-a', '2026-06-14T20:00:00.000Z', 10),
  ]

  it('defaults to all cycles, the last 7 days, newest first', () => {
    expect(filterOpenInjectionIntakes(intakes).map(item => item.scheduledAt)).toEqual([
      '2026-06-23T20:00:00.000Z',
      '2026-06-20T20:00:00.000Z',
    ])
  })

  it('filters by cycle and can sort oldest first', () => {
    expect(filterOpenInjectionIntakes(intakes, {
      cycleId: 'cycle-a',
      days: 'all',
      order: 'oldest',
    }).map(item => item.scheduledAt)).toEqual([
      '2026-06-14T20:00:00.000Z',
      '2026-06-23T20:00:00.000Z',
    ])
  })
})
