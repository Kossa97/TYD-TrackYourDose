import type { EvidenceMatrix, PeptipediaCopy, PeptipediaEntry, PeptipediaSource, PeptideCategory, ResearchStatus } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

interface ShortCopy {
  summary: string
  mechanism: string
  finding: string
  gap: string
  safety?: string
  contraindications?: string
  interactions?: string
}

type CatalogueSource = PeptipediaSource

// New catalogue profiles are concise source reviews, not completed evidence ratings.
export function catalogueProfile(input: {
  slug: string
  name: string
  fullName?: string
  aliases?: string[]
  calculatorUnsupportedReason?: PeptipediaEntry['calculatorUnsupportedReason']
  humanEvidence?: PeptipediaEntry['evidence']['human']
  clinicalEvidence?: PeptipediaEntry['evidence']['clinical']
  identity?: PeptipediaEntry['identity']
  evidenceMatrix?: EvidenceMatrix
  approvals?: PeptipediaEntry['approvals']
  additionalSources?: CatalogueSource[]
  findingSourceIds?: string[]
  mechanismSourceIds?: string[]
  safetySourceIds?: string[]
  reviewedAt?: string
  contentVersion?: number
  category: PeptideCategory
  status: ResearchStatus
  source: CatalogueSource
  de: ShortCopy
  en: ShortCopy
}): PeptipediaEntry {
  const reviewedAt = input.reviewedAt ?? '2026-09-14'
  const sources = [input.source, ...(input.additionalSources ?? [])]
  const human = input.humanEvidence ?? (input.source.kind === 'human_study' || input.source.kind === 'approved_label' ? 'limited' : 'none')
  const clinical = input.clinicalEvidence ?? 'none'
  const evidenceMatrix: EvidenceMatrix = input.evidenceMatrix ?? {
    human: 'none',
    replication: 'none',
    endpoints: 'none',
    safety: 'insufficient',
  }
  const copy = (locale: 'de' | 'en'): PeptipediaCopy => ({
    tldr: input[locale].summary,
    mechanism: input[locale].mechanism,
    researchAreas: [locale === 'de' ? 'Quellen-Kurzprofil' : 'Source-based short profile'],
    overviewFacts: [{ id: 'source-context', label: locale === 'de' ? 'Was die Quelle zeigt' : 'What the source shows', value: input[locale].finding, sourceIds: input.findingSourceIds ?? [input.source.id] }],
    researchGaps: [input[locale].gap, locale === 'de' ? 'Kurzprofil: keine vollständige Nutzen-Risiko-Bewertung. Nicht aufgeführte Gegenanzeigen und Wechselwirkungen sind in diesem Profil nicht ausreichend geklärt; fehlende Angaben bedeuten keine Sicherheit.' : 'Short profile: not a complete benefit–risk assessment. Unlisted contraindications and interactions are not adequately established in this profile; missing information does not establish safety.'],
    sideEffects: [input[locale].safety ?? (locale === 'de' ? 'Die Sicherheit ist nicht ausreichend untersucht.' : 'Safety has not been adequately studied.')],
    contraindications: input[locale].contraindications ? [input[locale].contraindications!] : [],
    interactions: input[locale].interactions ? [input[locale].interactions!] : [], protocols: [],
  })
  return {
    slug: input.slug, name: input.name, fullName: input.fullName ?? null, aliases: input.aliases,
    calculatorUnsupportedReason: input.calculatorUnsupportedReason,
    approvals: input.approvals,
    category: input.category, researchStatus: input.status,
    identity: input.identity ?? {
      status: input.status === 'unverified' ? 'ambiguous' : 'confirmed',
      description: input.status === 'unverified'
        ? { de: 'Die genaue Produkt- oder Molekülidentität ist nicht bestätigt.', en: 'The exact product or molecular identity has not been confirmed.' }
        : { de: 'Die Molekülidentität ist in der angegebenen Quelle definiert.', en: 'The molecular identity is defined in the cited source.' },
    },
    evidence: { human, animal: input.source.kind === 'animal_study' ? 'limited' : 'none', clinical },
    evidenceMatrix,
    editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
    reviewedAt, contentVersion: input.contentVersion ?? 2,
    sources,
    mechanismSourceIds: input.mechanismSourceIds ?? [input.source.id],
    safetySourceIds: input.safetySourceIds ?? (() => {
      const ids = sources
        .filter(source => source.kind === 'regulator' || source.kind === 'approved_label')
        .map(source => source.id)
      return ids.length ? ids : [input.source.id]
    })(),
    copy: { de: copy('de'), en: copy('en') },
  }
}

export function pubmed(id: string, year: number, title: string, kind: PeptipediaSource['kind']): CatalogueSource {
  return { id: `pmid-${id}`, year, title, kind, publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, accessedAt: '2026-09-14' }
}

export const fdaSafety: PeptipediaSource = {
  id: 'fda-compounding-review', kind: 'regulator', year: 2026,
  title: 'FDA compounding safety overview (accessed September 2026)',
  publisherOrAuthors: 'U.S. Food and Drug Administration',
  url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks',
  accessedAt: '2026-09-14',
}
