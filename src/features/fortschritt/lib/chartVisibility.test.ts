import { describe, expect, it } from 'vitest'
import type { CycleSubstance, OngoingSubstance } from '../types'
import {
  defaultVisibleChartIds,
  groupMemberIds,
  groupSubstancesByPeptide,
  groupVisibilityState,
  reconcileVisibleChartIds,
  setGroupVisibility,
  toggleMemberVisibility,
} from './chartVisibility'

function cycle(
  id: string,
  peptideId: string,
  name: string,
  start: string,
  opts: { active?: boolean; endDate?: string | null } = {},
): CycleSubstance {
  return {
    id,
    name,
    mode: 'cycle',
    startDate: start,
    endDate: opts.endDate ?? null,
    active: opts.active ?? true,
    color: '#f00',
    peptideId,
  }
}

function ongoing(id: string, name: string): OngoingSubstance {
  return { id, name, mode: 'ongoing', startDate: '2026-01-01', color: '#0f0' }
}

describe('groupSubstancesByPeptide', () => {
  it('groups multiple cycles under one substance', () => {
    const groups = groupSubstancesByPeptide(
      [
        cycle('c1', 'pep-a', 'BPC', '2026-01-01'),
        cycle('c2', 'pep-a', 'BPC', '2026-03-01'),
        cycle('c3', 'pep-b', 'TB-500', '2026-02-01'),
      ],
      [],
    )
    expect(groups).toHaveLength(2)
    expect(groups[0].cycles).toHaveLength(2)
    expect(groups[1].cycles).toHaveLength(1)
  })

  it('adds ongoing substances as separate groups', () => {
    const groups = groupSubstancesByPeptide([], [ongoing('o1', 'Kreatin')])
    expect(groups).toHaveLength(1)
    expect(groups[0].ongoing?.id).toBe('o1')
    expect(groups[0].cycles).toHaveLength(0)
  })
})

describe('defaultVisibleChartIds', () => {
  it('shows all active cycles and ongoing by default', () => {
    const visible = defaultVisibleChartIds(
      [
        cycle('c1', 'pep-a', 'A', '2026-01-01', { active: true }),
        cycle('c2', 'pep-a', 'A', '2026-03-01', { active: false, endDate: '2026-04-01' }),
      ],
      [ongoing('o1', 'Kreatin')],
    )
    expect(visible.has('c1')).toBe(true)
    expect(visible.has('c2')).toBe(false)
    expect(visible.has('o1')).toBe(true)
  })

  it('falls back to last ended cycle per substance when nothing active', () => {
    const visible = defaultVisibleChartIds(
      [
        cycle('c1', 'pep-a', 'A', '2026-01-01', { active: false, endDate: '2026-02-01' }),
        cycle('c2', 'pep-a', 'A', '2026-03-01', { active: false, endDate: '2026-05-01' }),
        cycle('c3', 'pep-b', 'B', '2026-01-01', { active: false, endDate: '2026-06-01' }),
      ],
      [],
    )
    expect(visible.has('c1')).toBe(false)
    expect(visible.has('c2')).toBe(true)
    expect(visible.has('c3')).toBe(true)
  })
})

describe('reconcileVisibleChartIds', () => {
  it('adds new active cycles to stored selection', () => {
    const visible = reconcileVisibleChartIds(
      ['c1'],
      [
        cycle('c1', 'pep-a', 'A', '2026-01-01', { active: false, endDate: '2026-02-01' }),
        cycle('c2', 'pep-a', 'A', '2026-03-01', { active: true }),
      ],
      [],
    )
    expect(visible.has('c1')).toBe(true)
    expect(visible.has('c2')).toBe(true)
  })

  it('drops ids that no longer exist', () => {
    const visible = reconcileVisibleChartIds(
      ['c1', 'gone'],
      [cycle('c1', 'pep-a', 'A', '2026-01-01')],
      [],
    )
    expect(visible.has('gone')).toBe(false)
    expect(visible.has('c1')).toBe(true)
  })
})

describe('group visibility helpers', () => {
  const groups = groupSubstancesByPeptide(
    [
      cycle('c1', 'pep-a', 'BPC', '2026-01-01'),
      cycle('c2', 'pep-a', 'BPC', '2026-03-01'),
    ],
    [],
  )
  const group = groups[0]

  it('reports partial when only some cycles are visible', () => {
    expect(groupVisibilityState(group, new Set(['c1']))).toBe('partial')
    expect(groupVisibilityState(group, new Set(['c1', 'c2']))).toBe('all')
    expect(groupVisibilityState(group, new Set())).toBe('none')
  })

  it('toggles whole group on and off', () => {
    const all = setGroupVisibility(group, true, new Set())
    expect(groupMemberIds(group).every(id => all.has(id))).toBe(true)
    const none = setGroupVisibility(group, false, all)
    expect(none.size).toBe(0)
  })

  it('toggles individual members', () => {
    const next = toggleMemberVisibility('c2', new Set(['c1']))
    expect(next.has('c1')).toBe(true)
    expect(next.has('c2')).toBe(true)
    const off = toggleMemberVisibility('c1', next)
    expect(off.has('c1')).toBe(false)
  })
})
