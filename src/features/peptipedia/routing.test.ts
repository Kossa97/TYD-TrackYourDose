import { expect, it } from 'vitest'
import { peptipediaDetailPath, peptipediaListPath, tabFromHash, legacySlug } from './routing'

it('uses locale-correct paths and maps old database slugs', () => {
  expect(peptipediaListPath('de')).toBe('/peptipedia')
  expect(peptipediaDetailPath('en', 'bpc-157')).toBe('/en/peptipedia/bpc-157')
  expect(legacySlug('semaglutide')).toBe('semaglutid')
  expect(legacySlug('tirzepatide')).toBe('tirzepatid')
})
it('resolves localized fragments and safely falls back', () => {
  expect(tabFromHash('de', '#sicherheit')).toBe('safety')
  expect(tabFromHash('en', '#study-protocols')).toBe('protocols')
  expect(tabFromHash('de', '#unknown')).toBe('overview')
})
