export type PeptipediaLocale = 'de' | 'en'

export type PeptideCategory =
  | 'heilung'
  | 'wachstumshormon'
  | 'nootropikum'
  | 'stoffwechsel'
  | 'anti_aging'
  | 'sexualgesundheit'
  | 'grundlagen'

export type ResearchStatus = 'preclinical' | 'phase_1' | 'phase_2' | 'human_research' | 'historical_approval' | 'approved' | 'unverified'
export type EvidenceLevel = 'none' | 'limited' | 'moderate' | 'strong'
export type ClinicalLevel = 'none' | 'sparse' | 'moderate' | 'extensive'
export type ProtocolEvidenceType = 'approved_label' | 'human' | 'animal' | 'laboratory'
export type SourceKind = 'approved_label' | 'human_study' | 'systematic_review' | 'animal_study' | 'laboratory_study' | 'regulator' | 'registry' | 'manufacturer' | 'catalog' | 'government_news'
export type ApprovalRegion = 'DE' | 'EU' | 'US' | 'CN' | 'JP'
export type ApprovalStatus = 'approved' | 'application_withdrawn'
export type IdentityStatus = 'confirmed' | 'ambiguous' | 'brand_or_blend' | 'complex_mixture'

export interface PeptideIdentity {
  status: IdentityStatus
  description: Record<PeptipediaLocale, string>
}

export interface EvidenceMatrix {
  human: 'none' | 'very_limited' | 'limited' | 'moderate' | 'strong'
  replication: 'none' | 'single_group' | 'multiple_groups' | 'systematic'
  endpoints: 'none' | 'surrogate' | 'symptom_or_function' | 'hard_outcome'
  safety: 'insufficient' | 'limited' | 'characterized'
}

export interface EditorialReview {
  medical: 'pending' | 'approved'
  legal: 'pending' | 'approved'
  medicalReviewerName?: string
  medicalReviewedAt?: string
  legalReviewerName?: string
  legalReviewedAt?: string
}

export interface PublicRecommendations {
  dosage?: string
  cycle?: string
}

export interface PeptipediaSource {
  id: string
  kind: SourceKind
  title: string
  publisherOrAuthors: string
  year: number
  url: string
  accessedAt: string
  doi?: string
}

export interface PeptipediaApproval {
  region: ApprovalRegion
  status: ApprovalStatus
  product: string
  indication: string
  sourceIds: string[]
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
  aliases?: string[]
  calculatorUnsupportedReason?: 'mixture' | 'activity_units'
  approvals?: PeptipediaApproval[]
  blend?: {
    components: Array<{ name: string; slug?: string }>
    sourceIds: string[]
  }
  category: PeptideCategory
  researchStatus: ResearchStatus
  identity: PeptideIdentity
  evidence: {
    human: EvidenceLevel
    animal: EvidenceLevel
    clinical: ClinicalLevel
  }
  evidenceMatrix: EvidenceMatrix
  editorialReview: EditorialReview
  publicRecommendations?: PublicRecommendations
  reviewedAt: string
  contentVersion: number
  sources: PeptipediaSource[]
  mechanismSourceIds: string[]
  safetySourceIds: string[]
  copy: Record<PeptipediaLocale, PeptipediaCopy>
}

export type PeptipediaView = Omit<PeptipediaEntry, 'copy'> & PeptipediaCopy & {
  locale: PeptipediaLocale
}
