import { describe, expect, it } from 'vitest'
import { normalizeCycles } from './substances'
import type { CycleRow } from '../types'

function row(id: string, peptideId: string, name: string, start: string): CycleRow {
  return {
    id,
    peptide_id: peptideId,
    name,
    start_date: start,
    end_date: null,
    active: true,
    peptides: { name },
  }
}

describe('normalizeCycles color grouping', () => {
  it('gives all cycles of the same substance the same color', () => {
    const cycles = normalizeCycles([
      row('c1', 'pep-sema', 'Semaglutide', '2026-01-01'),
      row('c2', 'pep-sema', 'Semaglutide', '2026-03-01'),
      row('c3', 'pep-sema', 'Semaglutide', '2026-05-01'),
    ])
    expect(cycles[0].color).toBe(cycles[1].color)
    expect(cycles[1].color).toBe(cycles[2].color)
  })

  it('gives different substances different colors', () => {
    const cycles = normalizeCycles([
      row('c1', 'pep-sema', 'Semaglutide', '2026-01-01'),
      row('c2', 'pep-ipa', 'Ipamorelin', '2026-01-02'),
    ])
    expect(cycles[0].color).not.toBe(cycles[1].color)
  })

  it('keeps a substance color stable when cycles interleave', () => {
    const cycles = normalizeCycles([
      row('c1', 'pep-sema', 'Semaglutide', '2026-01-01'),
      row('c2', 'pep-ipa', 'Ipamorelin', '2026-02-01'),
      row('c3', 'pep-sema', 'Semaglutide', '2026-03-01'),
    ])
    const sema = cycles.filter(c => c.peptideId === 'pep-sema')
    expect(sema[0].color).toBe(sema[1].color)
    expect(cycles[0].color).not.toBe(cycles[1].color)
  })
})
