import { describe, expect, it } from 'vitest'
import { auditPeptipedia, formatAuditFinding } from './audit-peptipedia'
import type { PeptipediaEntry } from '../src/features/peptipedia/content/types'

const TODAY = new Date('2026-09-14T12:00:00.000Z')

function entry(overrides: Partial<PeptipediaEntry> = {}): PeptipediaEntry {
  return {
    slug: 'test-profile',
    name: 'Test profile',
    fullName: null,
    category: 'grundlagen',
    researchStatus: 'human_research',
    identity: {
      status: 'confirmed',
      description: { de: 'Definiertes Testpeptid.', en: 'Defined test peptide.' },
    },
    evidence: { human: 'limited', animal: 'none', clinical: 'sparse' },
    evidenceMatrix: {
      human: 'limited',
      replication: 'single_group',
      endpoints: 'surrogate',
      safety: 'limited',
    },
    editorialReview: { medical: 'pending', legal: 'pending' },
    reviewedAt: '2026-09-14',
    contentVersion: 1,
    sources: [{
      id: 'test-source',
      kind: 'human_study',
      title: 'Test source',
      publisherOrAuthors: 'Test authors',
      year: 2026,
      url: 'https://example.test/source',
      accessedAt: '2026-09-14',
    }],
    mechanismSourceIds: ['test-source'],
    safetySourceIds: ['test-source'],
    copy: {
      de: {
        tldr: 'Einordnung.', mechanism: 'Mechanismus.', researchAreas: ['Forschung'],
        overviewFacts: [], researchGaps: ['Datenlücke'], sideEffects: ['Begrenzte Sicherheitsdaten.'],
        contraindications: [], interactions: [], protocols: [],
      },
      en: {
        tldr: 'Context.', mechanism: 'Mechanism.', researchAreas: ['Research'],
        overviewFacts: [], researchGaps: ['Evidence gap'], sideEffects: ['Limited safety data.'],
        contraindications: [], interactions: [], protocols: [],
      },
    },
    ...overrides,
  }
}

function approvedEntry(overrides: Partial<PeptipediaEntry> = {}): PeptipediaEntry {
  return entry({
    researchStatus: 'approved',
    approvals: [{
      region: 'EU',
      status: 'approved',
      product: 'Test product',
      indication: 'Test indication',
      sourceIds: ['test-source'],
    }],
    sources: [{
      ...entry().sources[0],
      kind: 'approved_label',
    }],
    ...overrides,
  })
}

describe('auditPeptipedia', () => {
  it('accepts fresh, complete metadata', () => {
    expect(auditPeptipedia([entry()], TODAY)).toEqual([])
  })

  it('accepts the 180-day boundary and rejects older ordinary review metadata', () => {
    expect(auditPeptipedia([entry({ reviewedAt: '2026-03-18' })], TODAY)).toEqual([])
    expect(auditPeptipedia([entry({ reviewedAt: '2026-03-17' })], TODAY)).toContainEqual({
      slug: 'test-profile', code: 'stale-review', severity: 'error',
    })
  })

  it('accepts the 180-day boundary and rejects older ordinary source metadata', () => {
    const boundary = entry()
    boundary.sources[0].accessedAt = '2026-03-18'
    const stale = entry()
    stale.sources[0].accessedAt = '2026-03-17'

    expect(auditPeptipedia([boundary], TODAY)).toEqual([])
    expect(auditPeptipedia([stale], TODAY)).toContainEqual({
      slug: 'test-profile', sourceId: 'test-source', code: 'stale-source', severity: 'error',
    })
  })

  it('uses the 90-day boundary for research-status-approved profiles', () => {
    const boundary = approvedEntry({ reviewedAt: '2026-06-16' })
    boundary.sources[0].accessedAt = '2026-06-16'
    const stale = approvedEntry({ reviewedAt: '2026-06-15' })
    stale.sources[0].accessedAt = '2026-06-15'

    expect(auditPeptipedia([boundary], TODAY)).toEqual([])
    expect(auditPeptipedia([stale], TODAY)).toEqual([
      { slug: 'test-profile', code: 'stale-approved-review', severity: 'error' },
      { slug: 'test-profile', sourceId: 'test-source', code: 'stale-approved-source', severity: 'error' },
    ])
  })

  it('uses the 90-day boundary when a regional approval is approved', () => {
    const regional = approvedEntry({ researchStatus: 'human_research', reviewedAt: '2026-06-15' })

    expect(auditPeptipedia([regional], TODAY)).toContainEqual({
      slug: 'test-profile', code: 'stale-approved-review', severity: 'error',
    })
  })

  it('does not shorten the freshness window for editorial approval alone', () => {
    expect(auditPeptipedia([entry({
      editorialReview: {
        medical: 'approved', medicalReviewerName: 'Dr Example', medicalReviewedAt: '2026-09-14',
        legal: 'approved', legalReviewerName: 'Legal Example', legalReviewedAt: '2026-09-14',
      },
      reviewedAt: '2026-03-18',
      sources: [{ ...entry().sources[0], accessedAt: '2026-03-18' }],
    })], TODAY)).toEqual([])
  })

  it('reports invalid dates and missing source metadata with profile and source IDs', () => {
    const broken = entry({ reviewedAt: '2026-02-31' })
    broken.sources[0] = {
      ...broken.sources[0],
      title: ' ',
      accessedAt: 'not-a-date',
    }

    const findings = auditPeptipedia([broken], TODAY)

    expect(findings).toContainEqual({
      slug: 'test-profile', code: 'invalid-entry', severity: 'error',
      detail: 'test-profile: source test-source title', sourceId: 'test-source',
    })
    expect(findings).toContainEqual({
      slug: 'test-profile', code: 'invalid-review-date', severity: 'error',
    })
    expect(findings).toContainEqual({
      slug: 'test-profile', sourceId: 'test-source', code: 'invalid-source-date', severity: 'error',
    })
    expect(formatAuditFinding(findings[0])).toContain('test-profile')
    expect(findings.map(formatAuditFinding).join('\n')).toContain('test-source')
  })

  it('reports missing validator-enforced profile metadata', () => {
    const broken = entry({ evidenceMatrix: undefined as unknown as PeptipediaEntry['evidenceMatrix'] })

    expect(auditPeptipedia([broken], TODAY)).toContainEqual({
      slug: 'test-profile', code: 'invalid-entry', severity: 'error',
      detail: 'test-profile: incomplete evidence matrix',
    })
  })

  it('rejects a profile with no source metadata', () => {
    expect(auditPeptipedia([entry({ sources: [] })], TODAY)).toContainEqual({
      slug: 'test-profile', code: 'invalid-entry', severity: 'error',
      detail: 'test-profile: source',
    })
  })

  it('accepts a present source type already used by the catalogue', () => {
    const source = {
      ...entry().sources[0],
      kind: 'government_news',
    } as PeptipediaEntry['sources'][number]

    expect(auditPeptipedia([entry({ sources: [source] })], TODAY)).toEqual([])
  })

  it('is deterministic and does not mutate catalogue entries', () => {
    const catalogue = [entry({ reviewedAt: '2026-03-17' })]
    const before = structuredClone(catalogue)

    const first = auditPeptipedia(catalogue, TODAY)
    const second = auditPeptipedia(catalogue, TODAY)

    expect(second).toEqual(first)
    expect(catalogue).toEqual(before)
  })

  it('flags recommendation-like prose outside historical protocol fields', () => {
    const broken = entry()
    broken.copy.en.tldr = 'You should inject 2 mg weekly for an eight-week cycle.'

    expect(auditPeptipedia([broken], TODAY)).toContainEqual({
      slug: 'test-profile', code: 'recommendation-language', severity: 'error', detail: 'en.tldr',
    })
  })
})
