export type PeptipediaLocale = 'de' | 'en'

export type PeptideCategory =
  | 'heilung'
  | 'wachstumshormon'
  | 'nootropikum'
  | 'stoffwechsel'
  | 'anti_aging'
  | 'sexualgesundheit'

export type ResearchStatus = 'preclinical' | 'phase_1' | 'phase_2' | 'approved'
export type EvidenceLevel = 'none' | 'limited' | 'moderate' | 'strong'
export type ClinicalLevel = 'none' | 'sparse' | 'moderate' | 'extensive'
export type ProtocolEvidenceType = 'approved_label' | 'human' | 'animal' | 'laboratory'
export type SourceKind = 'approved_label' | 'human_study' | 'animal_study' | 'laboratory_study' | 'regulator'

export interface PeptipediaSource {
  id: string
  kind: SourceKind
  title: string
  year: number
  url: string
  doi?: string
}

export interface SourcedOverviewFact {
  id: string
  label: string
  value: string
  sourceIds: string[]
}

export interface StudyProtocol {
  id: string
  evidenceType: ProtocolEvidenceType
  populationOrModel: string
  route: string
  amount: string
  frequency: string
  duration: string
  objective: string
  outcome: string
  sourceIds: string[]
}

export interface PeptipediaCopy {
  tldr: string
  mechanism: string
  researchAreas: string[]
  overviewFacts: SourcedOverviewFact[]
  researchGaps: string[]
  sideEffects: string[]
  contraindications: string[]
  interactions: string[]
  protocols: StudyProtocol[]
}

export interface PeptipediaEntry {
  slug: string
  name: string
  fullName: string | null
  category: PeptideCategory
  researchStatus: ResearchStatus
  evidence: {
    human: EvidenceLevel
    animal: EvidenceLevel
    clinical: ClinicalLevel
    score: number
  }
  reviewedAt: string
  contentVersion: number
  sources: PeptipediaSource[]
  copy: Record<PeptipediaLocale, PeptipediaCopy>
}

export type PeptipediaView = Omit<PeptipediaEntry, 'copy'> & PeptipediaCopy & {
  locale: PeptipediaLocale
}
