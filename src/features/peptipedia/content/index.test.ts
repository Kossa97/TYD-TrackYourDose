import { describe, expect, it } from 'vitest'
import { PUBLISHED_PEPTIDES, getPublishedPeptide, getPublishedPeptides } from './index'

const BLEND_SLUGS = [
  'aod-cjc-ipamorelin', 'bpc-157-tb-500', 'cagrilintide-semaglutide', 'cjc-ghrp-2',
  'cjc-no-dac-ipamorelin', 'glow', 'klow', 'neuroxelin', 'tesamorelin-ipamorelin', 'tri-heal',
] as const

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
  'adamax', 'adipotide', 'aod-9604', 'ara-290', 'cagrilintide', 'cartalax', 'cerebrolysin', 'chonluten',
  'cjc-1295-no-dac', 'cortagen', 'dsip', 'foxo4-dri', 'ghrp-6', 'glutathion', 'gonadorelin', 'hcg',
  'hgh-191aa', 'hmg', 'igf-1-lr3', 'kisspeptin', 'kpv', 'livagen', 'll-37', 'mazdutide', 'melanotan-2',
  'mgf', 'mots-c', 'ovagen', 'oxytocin', 'pe-22-28', 'peg-mgf', 'pinealon', 'pnc-27', 'prostamax',
  'pt-141', 'retatrutide', 'semax', 'snap-8', 'ss-31', 'survodutide', 'tesamorelin', 'testagen',
  'thymosin-alpha-1', 'vesugen', 'vilon',
  ...BLEND_SLUGS,
]

describe('published Peptipedia index', () => {
  it('requires publication metadata and bilingual safety context for all 66 profiles', () => {
    expect(PUBLISHED_PEPTIDES).toHaveLength(66)
    const incomplete = PUBLISHED_PEPTIDES.filter(entry =>
      entry.sources.length === 0
      || !entry.identity?.description.de.trim() || !entry.identity?.description.en.trim()
      || !entry.evidenceMatrix || Object.keys(entry.evidenceMatrix).length !== 4
      || entry.editorialReview?.medical !== 'pending' || entry.editorialReview?.legal !== 'pending'
      || entry.sources.some(source => source.accessedAt !== '2026-09-14')
      || (['de', 'en'] as const).some(locale =>
        !entry.copy[locale].researchGaps.some(text => text.trim())
        || !entry.copy[locale].sideEffects.some(text => text.trim()),
      )
      || 'score' in entry.evidence || 'score' in (entry.evidenceMatrix ?? {}),
    ).map(entry => entry.slug)
    expect(incomplete).toEqual([])
  })

  it('keeps every unresolved identity warning bilingual', () => {
    const unresolved = PUBLISHED_PEPTIDES.filter(entry =>
      ['ambiguous', 'brand_or_blend', 'complex_mixture'].includes(entry.identity.status),
    )

    expect(unresolved.length).toBeGreaterThan(0)
    for (const entry of unresolved) {
      expect(entry.identity.description.de.trim(), entry.slug).not.toBe('')
      expect(entry.identity.description.en.trim(), entry.slug).not.toBe('')
    }
  })

  it('keeps all blend identities, composition citations, and protocols on the catalogue boundary', () => {
    const blends = PUBLISHED_PEPTIDES.filter(entry => entry.blend)

    expect(blends.map(entry => entry.slug).sort()).toEqual([...BLEND_SLUGS].sort())
    for (const entry of blends) {
      expect(entry.identity.status, entry.slug).toBe('brand_or_blend')
      expect(entry.blend?.sourceIds.every(id => entry.sources.find(source => source.id === id)?.kind === 'catalog'), entry.slug).toBe(true)
      expect(entry.identity.description.de, entry.slug).toContain('produkt- und quellenabhängige Zusammensetzung')
      expect(entry.identity.description.en, entry.slug).toContain('product- and source-specific composition')
      for (const locale of ['de', 'en'] as const) {
        const composition = entry.copy[locale].overviewFacts.find(fact => fact.id === 'catalogue-composition')
        expect(composition, `${entry.slug}:${locale}`).toBeDefined()
        expect(composition?.sourceIds.length, `${entry.slug}:${locale}`).toBeGreaterThan(0)
        expect(composition?.sourceIds.every(id => entry.sources.find(source => source.id === id)?.kind === 'catalog'), `${entry.slug}:${locale}`).toBe(true)
        expect(entry.copy[locale].protocols, `${entry.slug}:${locale}`).toEqual([])
      }
    }
  })

  it('does not transfer component or human evidence to the nine catalogue-only blends', () => {
    const catalogueOnly = PUBLISHED_PEPTIDES.filter(entry => entry.blend && entry.slug !== 'cagrilintide-semaglutide')

    expect(catalogueOnly).toHaveLength(9)
    for (const entry of catalogueOnly) {
      expect(entry.sources.every(source => source.kind === 'catalog'), entry.slug).toBe(true)
      expect(entry.evidence, entry.slug).toEqual({ human: 'none', animal: 'none', clinical: 'none' })
      expect(entry.evidenceMatrix, entry.slug).toEqual({ human: 'none', replication: 'none', endpoints: 'none', safety: 'insufficient' })
      for (const locale of ['de', 'en'] as const) {
        expect(entry.copy[locale].overviewFacts.map(fact => fact.id), `${entry.slug}:${locale}`).toEqual(['catalogue-composition'])
      }
    }
  })

  it('keeps CagriSema claims exact in both locales with conservative replication', () => {
    const cagriSema = PUBLISHED_PEPTIDES.find(entry => entry.slug === 'cagrilintide-semaglutide')!
    const expectedFacts = [
      { id: 'catalogue-composition', sourceIds: ['catalog-cagrilintide-semaglutide'] },
      { id: 'published-trials', sourceIds: ['pmid-40544433', 'pmid-42251860', 'pmid-42251859', 'pmid-42251856'] },
      { id: 'redefine-4-headline', sourceIds: ['redefine-4-2026'] },
    ]

    expect(cagriSema.evidenceMatrix.replication).toBe('single_group')
    for (const locale of ['de', 'en'] as const) {
      expect(cagriSema.copy[locale].overviewFacts.map(({ id, sourceIds }) => ({ id, sourceIds }))).toEqual(expectedFacts)
    }
  })

  it('keeps CagriSema primary-study author and phase metadata exact', () => {
    const cagriSema = PUBLISHED_PEPTIDES.find(entry => entry.slug === 'cagrilintide-semaglutide')!

    expect(cagriSema.sources.find(source => source.id === 'pmid-42251859')).toEqual(expect.objectContaining({
      title: 'Cagrilintide-semaglutide (CagriSema) versus semaglutide or cagrilintide in people with type 2 diabetes (REIMAGINE 2): a double-blind, randomised, controlled, phase 3 study',
      publisherOrAuthors: 'Buse JB et al.',
    }))
    expect(cagriSema.sources.find(source => source.id === 'pmid-42251856')).toEqual(expect.objectContaining({
      title: 'Cagrilintide-semaglutide (CagriSema) as an add-on to basal insulin in adults with type 2 diabetes (REIMAGINE 3): a randomised, double-blind, placebo-controlled, multicentre, phase 3 study',
      publisherOrAuthors: 'Rosenstock J et al.',
    }))
  })

  it('covers the peptide catalogue without vial-size duplicates or non-peptides', () => {
    expect(PUBLISHED_PEPTIDES.map(entry => entry.slug).sort()).toEqual([...EXPECTED_SLUGS].sort())
  })

  it.each(['de', 'en'] as const)('returns complete %s views', locale => {
    const views = getPublishedPeptides(locale)

    expect(views).toHaveLength(66)
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

  it('keeps medicine approvals regional and traceable to a profile source', () => {
    const approved = PUBLISHED_PEPTIDES.filter(entry => entry.researchStatus === 'approved')

    expect(approved.length).toBeGreaterThan(0)
    for (const entry of approved) {
      expect(entry.approvals?.length, entry.slug).toBeGreaterThan(0)
      for (const approval of entry.approvals ?? []) {
        expect(approval.region, entry.slug).toMatch(/^(DE|EU|US|CN|JP)$/)
        expect(approval.sourceIds.length, entry.slug).toBeGreaterThan(0)
        expect(approval.sourceIds.every(id => entry.sources.some(source => source.id === id)), entry.slug).toBe(true)
      }
    }
  })

  it('publishes the audited high-priority evidence updates', () => {
    const ghkCu = getPublishedPeptide('ghk-cu', 'de')!
    const cagriSema = getPublishedPeptide('cagrilintide-semaglutide', 'de')!
    const retatrutide = getPublishedPeptide('retatrutide', 'de')!
    const mazdutide = getPublishedPeptide('mazdutide', 'de')!

    expect(ghkCu.evidence.human).toBe('limited')
    expect(cagriSema.evidence.clinical).toBe('extensive')
    expect(cagriSema.sideEffects.length).toBeGreaterThan(0)
    expect(cagriSema.sources.filter(source => source.kind === 'human_study')).toHaveLength(4)
    expect(retatrutide.sources.some(source => source.id === 'pmid-37366315')).toBe(true)
    expect(mazdutide.approvals?.map(approval => approval.region)).toContain('CN')
  })
})
