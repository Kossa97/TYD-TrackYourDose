import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

describe('Peptide page vial view', () => {
  const source = () => readFileSync(new URL('./Peptide.tsx', import.meta.url), 'utf8')

  test('defaults My Stack to the vial carousel view with a persisted toggle', () => {
    const text = source()

    expect(text).toContain("tyd_peptide_view")
    expect(text).toContain("'vials'")
    expect(text).toContain("'list'")
    expect(text).toContain('setViewMode')
  })

  test('uses the reusable vial visual for the My Stack carousel', () => {
    const text = source()

    expect(text).toContain('PeptideVialVisual')
    expect(text).toContain('activePeptideId')
    expect(text).toContain('animateOnMount')
  })

  test('updates the active vial from carousel scroll position instead of direct vial taps', () => {
    const text = source()

    expect(text).toContain('vialCarouselRef')
    expect(text).toContain('handleVialCarouselScroll')
    expect(text).toContain('data-vial-index')
    expect(text).toContain('scrollIntoView')
    expect(text).not.toContain('onClick={() => setActivePeptideId(p.id)}')
  })

  test('keeps neighboring vials partially visible around the centered active vial', () => {
    const text = source()

    expect(text).toContain('min(9rem, 38vw)')
    expect(text).toContain('snap-center')
    expect(text).toContain("isActive ? 'scale-100' : 'scale-90'")
  })

  test('shows the fill percentage directly under the active vial in My Stack', () => {
    const text = source()

    expect(text).toContain("{isActive && (")
    expect(text).toContain('mt-2 text-center')
    expect(text).toContain('{Math.round(vialPct)}%')
  })

  test('assigns a random palette color when creating a peptide', () => {
    const text = source()

    expect(text).toContain('getRandomPeptideColor')
    expect(text).toContain('color_hex: getRandomPeptideColor()')
  })
})
