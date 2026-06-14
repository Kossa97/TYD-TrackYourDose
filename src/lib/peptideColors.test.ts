import { describe, expect, test } from 'vitest'
import { PEPTIDE_COLORS, getRandomPeptideColor } from './peptideColors'

describe('peptide color palette', () => {
  test('returns a color from the curated palette', () => {
    expect(PEPTIDE_COLORS).toContain(getRandomPeptideColor(() => 0))
    expect(PEPTIDE_COLORS).toContain(getRandomPeptideColor(() => 0.999))
  })

  test('uses the supplied random source to pick stable palette entries', () => {
    expect(getRandomPeptideColor(() => 0)).toBe(PEPTIDE_COLORS[0])
    expect(getRandomPeptideColor(() => 0.5)).toBe(PEPTIDE_COLORS[Math.floor(PEPTIDE_COLORS.length * 0.5)])
  })
})
