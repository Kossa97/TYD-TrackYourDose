import { describe, expect, it } from 'vitest'
import { PUBLISHED_PEPTIDES, getPublishedPeptide, getPublishedPeptides } from './index'

const EXPECTED_SLUGS = [
  'bpc-157',
  'tb-500',
  'ipamorelin',
  'cjc-1295',
  'ghrp-2',
  'sermorelin',
  'semaglutid',
  'tirzepatid',
  'selank',
  'epithalon',
  'ghk-cu',
]

describe('published Peptipedia index', () => {
  it('publishes exactly the approved eleven slugs', () => {
    expect(PUBLISHED_PEPTIDES.map(entry => entry.slug)).toEqual(EXPECTED_SLUGS)
  })

  it.each(['de', 'en'] as const)('returns complete %s views', locale => {
    const views = getPublishedPeptides(locale)

    expect(views).toHaveLength(11)
    expect(views.every(view => view.tldr && view.mechanism && view.reviewedAt)).toBe(true)
  })

  it('returns the requested locale without leaking the other copy object', () => {
    const view = getPublishedPeptide('bpc-157', 'de')

    expect(view?.locale).toBe('de')
    expect(view).not.toHaveProperty('copy')
  })

  it('returns null for an unpublished slug', () => {
    expect(getPublishedPeptide('unknown', 'de')).toBeNull()
  })
})
