import { describe, expect, it } from 'vitest'
import { assertValidPeptipedia } from './validate'
import type { PeptipediaEntry } from './types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from './editorialPolicy'

function entry(overrides: Partial<PeptipediaEntry> = {}): PeptipediaEntry {
  return {
    slug: 'bpc-157',
    name: 'BPC-157',
    fullName: 'Body Protection Compound 157',
    category: 'heilung',
    researchStatus: 'preclinical',
    identity: {
      status: 'confirmed',
      description: { de: 'Eindeutig definiertes Peptid.', en: 'Clearly defined peptide.' },
    },
    evidence: { human: 'limited', animal: 'strong', clinical: 'sparse' },
    evidenceMatrix: {
      human: 'limited',
      replication: 'single_group',
      endpoints: 'surrogate',
      safety: 'insufficient',
    },
    editorialReview: { medical: 'pending', legal: 'pending' },
    reviewedAt: '2026-09-08',
    contentVersion: 1,
    sources: [{
      id: 'fda-bpc-risk',
      kind: 'regulator',
      title: 'FDA safety risks',
      publisherOrAuthors: 'U.S. Food and Drug Administration',
      year: 2024,
      url: 'https://www.fda.gov/example',
      accessedAt: '2026-09-08',
    }],
    mechanismSourceIds: ['fda-bpc-risk'],
    safetySourceIds: ['fda-bpc-risk'],
    copy: {
      de: {
        tldr: 'Kurze Einordnung.',
        mechanism: 'Mechanismus.',
        researchAreas: ['Regeneration'],
        overviewFacts: [],
        researchGaps: ['Humandaten'],
        sideEffects: ['Nicht ausreichend untersucht.'],
        contraindications: [],
        interactions: [],
        protocols: [],
      },
      en: {
        tldr: 'Short classification.',
        mechanism: 'Mechanism.',
        researchAreas: ['Recovery'],
        overviewFacts: [],
        researchGaps: ['Human data'],
        sideEffects: ['Not adequately studied.'],
        contraindications: [],
        interactions: [],
        protocols: [],
      },
    },
    ...overrides,
  }
}

describe('assertValidPeptipedia', () => {
  it('keeps the global medical and legal review gates honestly pending', () => {
    expect(PEPTIPEDIA_EDITORIAL_POLICY).toEqual({ medical: 'pending', legal: 'pending' })
  })

  it('accepts an explicitly unassessed profile without a numeric score', () => {
    expect(() => assertValidPeptipedia([entry({ researchStatus: 'unverified', evidence: { human: 'none', animal: 'none', clinical: 'none' } })])).not.toThrow()
  })

  it.each([undefined, '2026-02-31'])('rejects a source without a valid access date (%s)', accessedAt => {
    const broken = entry()
    broken.sources[0] = { ...broken.sources[0], accessedAt } as PeptipediaEntry['sources'][number]

    expect(() => assertValidPeptipedia([broken])).toThrow('accessedAt')
  })

  it('rejects a source without publisher or author attribution', () => {
    const broken = entry()
    ;(broken.sources[0] as PeptipediaEntry['sources'][number] & { publisherOrAuthors?: string }).publisherOrAuthors = ' '

    expect(() => assertValidPeptipedia([broken])).toThrow('publisherOrAuthors')
  })

  it('rejects an entry without a source', () => {
    expect(() => assertValidPeptipedia([entry({ sources: [] })])).toThrow('source')
  })

  it('accepts government news as a source kind and rejects unknown source kinds', () => {
    const governmentNews = entry()
    governmentNews.sources[0] = {
      ...governmentNews.sources[0],
      kind: 'government_news',
    } as PeptipediaEntry['sources'][number]
    expect(() => assertValidPeptipedia([governmentNews])).not.toThrow()

    const unknown = entry()
    unknown.sources[0] = {
      ...unknown.sources[0],
      kind: 'blog',
    } as unknown as PeptipediaEntry['sources'][number]
    expect(() => assertValidPeptipedia([unknown])).toThrow('source kind')
  })

  it('rejects an entry without a complete evidence matrix', () => {
    const broken = entry({
      evidenceMatrix: { human: 'limited' } as PeptipediaEntry['evidenceMatrix'],
    })

    expect(() => assertValidPeptipedia([broken])).toThrow('evidence matrix')
  })

  it('rejects a malformed entry even when legacy evidence.score is present', () => {
    const broken = entry({
      evidenceMatrix: undefined as unknown as PeptipediaEntry['evidenceMatrix'],
    })
    ;(broken.evidence as PeptipediaEntry['evidence'] & { score: number }).score = 2

    expect(() => assertValidPeptipedia([broken])).toThrow('evidence matrix')
  })

  it.each([undefined, 'unknown'])('rejects an invalid or missing identity status (%s)', status => {
    const broken = entry({
      identity: {
        status,
        description: { de: 'Identität beschrieben.', en: 'Identity described.' },
      } as unknown as PeptipediaEntry['identity'],
    })

    expect(() => assertValidPeptipedia([broken])).toThrow('identity status')
  })

  it('rejects ambiguous identity without bilingual descriptions', () => {
    const broken = entry({
      identity: { status: 'ambiguous', description: { de: 'Identität ungeklärt.', en: ' ' } },
    })

    expect(() => assertValidPeptipedia([broken])).toThrow('identity warning')
  })

  it('rejects blank safety context in both locales', () => {
    const broken = entry()
    broken.copy.de.sideEffects = []
    broken.copy.en.sideEffects = []

    expect(() => assertValidPeptipedia([broken])).toThrow('safety context')
  })

  it.each(['medical', 'legal'] as const)('rejects %s approval without real reviewer metadata', discipline => {
    const broken = entry({
      editorialReview: {
        medical: discipline === 'medical' ? 'approved' : 'pending',
        legal: discipline === 'legal' ? 'approved' : 'pending',
      },
    })

    expect(() => assertValidPeptipedia([broken])).toThrow(`${discipline} reviewer`)
  })

  it('rejects invalid medical and legal review dates', () => {
    const broken = entry({
      editorialReview: {
        medical: 'approved', medicalReviewerName: 'Dr Example', medicalReviewedAt: '2026-02-31',
        legal: 'approved', legalReviewerName: 'Legal Example', legalReviewedAt: '2026-09-14',
      },
    })

    expect(() => assertValidPeptipedia([broken])).toThrow('medical review date')
  })

  it('rejects public dosage or cycle guidance while either review is pending', () => {
    const broken = entry() as PeptipediaEntry & {
      publicRecommendations?: { dosage?: string; cycle?: string }
    }
    broken.publicRecommendations = { dosage: 'Use a fixed amount', cycle: 'Repeat for several weeks' }

    expect(() => assertValidPeptipedia([broken])).toThrow('public dosage or cycle recommendation')
  })

  it('does not confuse a sourced historical study amount with public advice', () => {
    const historical = entry()
    historical.sources.push({
      id: 'historical-human-study', kind: 'human_study', title: 'Historical study',
      publisherOrAuthors: 'Example investigators', year: 2025,
      url: 'https://example.test/historical-study', accessedAt: '2026-09-14',
    })
    historical.copy.de.protocols.push({
      id: 'historical-protocol', evidenceType: 'human', populationOrModel: 'Studienteilnehmende',
      route: 'Laut Studie', amount: '1 mg laut Studie', frequency: 'Einmalig', duration: 'Ein Tag',
      objective: 'Historische Studienbeschreibung', outcome: 'Keine Anwendungsempfehlung',
      sourceIds: ['historical-human-study'],
    })

    expect(() => assertValidPeptipedia([historical])).not.toThrow()
  })

  it.each(['de', 'en'] as const)('rejects empty %s research gaps', locale => {
    const broken = entry()
    broken.copy[locale].researchGaps = []

    expect(() => assertValidPeptipedia([broken])).toThrow('researchGaps')
  })
  it('rejects a blend linking an unknown ingredient profile', () => {
    const blend = entry({ blend: { components: [{ name: 'Missing', slug: 'missing' }, { name: 'Unresolved form' }], sourceIds: ['fda-bpc-risk'] } })
    expect(() => assertValidPeptipedia([blend])).toThrow('Unknown component')
  })
  it('rejects a human protocol supported only by a regulator overview', () => {
    const broken = entry()
    broken.copy.de.protocols.push({ id: 'unsupported', evidenceType: 'human', populationOrModel: 'Adults', route: 'IV', amount: '1 mg', frequency: 'Once', duration: '1 day', objective: 'Safety', outcome: 'Unknown', sourceIds: ['fda-bpc-risk'] })
    expect(() => assertValidPeptipedia([broken])).toThrow('matching primary source')
  })
  it('accepts a complete bilingual entry', () => {
    expect(() => assertValidPeptipedia([entry()])).not.toThrow()
  })

  it('rejects an approved profile without a sourced regional approval', () => {
    expect(() => assertValidPeptipedia([
      entry({ researchStatus: 'approved' }),
    ])).toThrow('bpc-157: approved status requires a regional approval')
  })

  it('rejects duplicate slugs', () => {
    expect(() => assertValidPeptipedia([entry(), entry()])).toThrow('Duplicate slug: bpc-157')
  })

  it('rejects malformed slugs', () => {
    expect(() => assertValidPeptipedia([entry({ slug: 'BPC 157' })])).toThrow('BPC 157: invalid slug')
  })

  it('rejects impossible review dates', () => {
    expect(() => assertValidPeptipedia([entry({ reviewedAt: '2026-02-31' })])).toThrow('bpc-157: reviewedAt')
  })

  it('rejects non-HTTPS sources', () => {
    expect(() => assertValidPeptipedia([
      entry({ sources: [{ id: 'source', kind: 'regulator', title: 'Source', publisherOrAuthors: 'Example regulator', year: 2024, url: 'http://example.test', accessedAt: '2026-09-08' }] }),
    ])).toThrow('bpc-157: non-HTTPS source source')
  })

  it('rejects overview facts whose source id is absent', () => {
    const broken = entry()
    broken.copy.de.overviewFacts.push({
      id: 'half-life',
      label: 'Halbwertszeit',
      value: 'Unbekannt',
      sourceIds: ['missing-source'],
    })

    expect(() => assertValidPeptipedia([broken])).toThrow('Unknown source missing-source in bpc-157')
  })

  it('rejects protocols whose source id is absent', () => {
    const broken = entry()
    broken.copy.de.protocols.push({
      id: 'study-1',
      evidenceType: 'animal',
      populationOrModel: 'Rat model',
      route: 'Oral',
      amount: '10 µg/kg as reported',
      frequency: 'Once daily',
      duration: '7 days',
      objective: 'Tissue response',
      outcome: 'Observed endpoint',
      sourceIds: ['missing-source'],
    })

    expect(() => assertValidPeptipedia([broken])).toThrow('Unknown source missing-source in bpc-157')
  })

  it.each(['mechanismSourceIds', 'safetySourceIds'] as const)('requires claim-specific %s', field => {
    const broken = entry() as PeptipediaEntry & Record<typeof field, string[]>
    broken[field] = []

    expect(() => assertValidPeptipedia([broken])).toThrow(`${field} has no source`)
  })

  it('rejects claim-specific references to absent sources', () => {
    const broken = entry() as PeptipediaEntry & { mechanismSourceIds: string[]; safetySourceIds: string[] }
    broken.mechanismSourceIds = ['missing-source']
    broken.safetySourceIds = ['fda-bpc-risk']

    expect(() => assertValidPeptipedia([broken])).toThrow('Unknown source missing-source in bpc-157')
  })

  it('requires an official source for every regional approval claim', () => {
    const source = { ...entry().sources[0], kind: 'human_study' as const }
    const broken = entry({
      researchStatus: 'approved',
      sources: [source],
      approvals: [{ region: 'EU', status: 'approved', product: 'Test', indication: 'Test', sourceIds: [source.id] }],
    })

    expect(() => assertValidPeptipedia([broken])).toThrow('approval requires an official source')
  })
})
