import { describe, expect, it } from 'vitest'
import { assertValidPeptipedia } from './validate'
import type { PeptipediaEntry } from './types'

function entry(overrides: Partial<PeptipediaEntry> = {}): PeptipediaEntry {
  return {
    slug: 'bpc-157',
    name: 'BPC-157',
    fullName: 'Body Protection Compound 157',
    category: 'heilung',
    researchStatus: 'preclinical',
    evidence: { human: 'limited', animal: 'strong', clinical: 'sparse', score: 2 },
    reviewedAt: '2026-09-08',
    contentVersion: 1,
    sources: [{
      id: 'fda-bpc-risk',
      kind: 'regulator',
      title: 'FDA safety risks',
      year: 2024,
      url: 'https://www.fda.gov/example',
    }],
    copy: {
      de: {
        tldr: 'Kurze Einordnung.',
        mechanism: 'Mechanismus.',
        researchAreas: ['Regeneration'],
        overviewFacts: [],
        researchGaps: ['Humandaten'],
        sideEffects: [],
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
        sideEffects: [],
        contraindications: [],
        interactions: [],
        protocols: [],
      },
    },
    ...overrides,
  }
}

describe('assertValidPeptipedia', () => {
  it('accepts a complete bilingual entry', () => {
    expect(() => assertValidPeptipedia([entry()])).not.toThrow()
  })

  it('rejects duplicate slugs', () => {
    expect(() => assertValidPeptipedia([entry(), entry()])).toThrow('Duplicate slug: bpc-157')
  })

  it('rejects malformed slugs', () => {
    expect(() => assertValidPeptipedia([entry({ slug: 'BPC 157' })])).toThrow('BPC 157: invalid slug')
  })

  it('rejects out-of-range evidence scores', () => {
    expect(() => assertValidPeptipedia([
      entry({ evidence: { human: 'limited', animal: 'strong', clinical: 'sparse', score: 11 } }),
    ])).toThrow('bpc-157: evidence.score')
  })

  it('rejects impossible review dates', () => {
    expect(() => assertValidPeptipedia([entry({ reviewedAt: '2026-02-31' })])).toThrow('bpc-157: reviewedAt')
  })

  it('rejects non-HTTPS sources', () => {
    expect(() => assertValidPeptipedia([
      entry({ sources: [{ id: 'source', kind: 'regulator', title: 'Source', year: 2024, url: 'http://example.test' }] }),
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
})
