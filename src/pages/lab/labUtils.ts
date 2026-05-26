// src/pages/lab/labUtils.ts

export type EvidenceScore = 'strong' | 'moderate' | 'preclinical' | 'unknown'
export type StudyType = 'clinical' | 'meta' | 'human' | 'animal' | 'study'

export function getEvidenceScore(title: string, abstract: string): EvidenceScore {
  const text = `${title} ${abstract}`.toLowerCase()
  if (/randomized|rct|\bclinical trial\b|systematic review|meta.?analysis/.test(text)) return 'strong'
  if (/\bhuman\b|patients|subjects|cohort|participant/.test(text)) return 'moderate'
  if (/\brat\b|\bmouse\b|\bmice\b|\banimal\b|in vitro|in vivo|rodent/.test(text)) return 'preclinical'
  return 'unknown'
}

export function getStudyType(title: string, abstract: string): StudyType {
  const text = `${title} ${abstract}`.toLowerCase()
  if (/randomized|rct|\bclinical trial\b/.test(text)) return 'clinical'
  if (/systematic review|meta.?analysis/.test(text)) return 'meta'
  if (/cohort|observational|\bhuman\b|patients|subjects|participant/.test(text)) return 'human'
  if (/\brat\b|\bmouse\b|\bmice\b|\banimal\b|in vitro|in vivo|rodent/.test(text)) return 'animal'
  return 'study'
}

// Returns an i18n key — callers do t(getStudyTypeLabel(type))
export function getStudyTypeLabel(type: StudyType): string {
  const keys: Record<StudyType, string> = {
    clinical: 'lab_type_clinical',
    meta:     'lab_type_meta',
    human:    'lab_type_human',
    animal:   'lab_type_animal',
    study:    'lab_type_study',
  }
  return keys[type]
}

// Returns an i18n key — callers do t(getEvidenceLabel(score))
export function getEvidenceLabel(score: EvidenceScore): string {
  const keys: Record<EvidenceScore, string> = {
    strong:      'lab_evidence_strong',
    moderate:    'lab_evidence_moderate',
    preclinical: 'lab_evidence_preclinical',
    unknown:     'lab_evidence_unknown',
  }
  return keys[score]
}

// Returns an i18n key — callers do t(getEvidenceContext(score))
export function getEvidenceContext(score: EvidenceScore): string {
  const keys: Record<EvidenceScore, string> = {
    strong:      'lab_context_strong',
    moderate:    'lab_context_moderate',
    preclinical: 'lab_context_preclinical',
    unknown:     'lab_context_unknown',
  }
  return keys[score]
}

// Returns up to 4 key sentences from the abstract (skips the first intro sentence).
export function getKeyFindings(abstract: string): string[] {
  if (!abstract) return []
  return abstract
    .split(/\.\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25)
    .slice(1, 5)
}

const LIMITATION_PATTERN =
  /limitation|however|caution|risk|adverse|unclear|conflict|bias|warrant|preliminary|small sample|further (research|study|investigation)|not (yet )?established|inconclusive/i

// Sentences that mention limits, risks, or open questions in the abstract.
export function getLimitationsAndRisks(abstract: string): string[] {
  if (!abstract) return []
  return abstract
    .split(/\.\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25 && LIMITATION_PATTERN.test(s))
    .slice(0, 4)
}

// Returns an i18n key when the abstract has no explicit limitation sentences.
export function getDefaultLimitationKey(studyType: StudyType, evidence: EvidenceScore): string {
  if (studyType === 'animal' || evidence === 'preclinical') return 'lab_limitation_preclinical'
  if (evidence === 'unknown') return 'lab_limitation_unknown'
  if (evidence === 'moderate') return 'lab_limitation_moderate'
  return 'lab_limitation_general'
}
