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

export function getStudyTypeLabel(type: StudyType): string {
  const labels: Record<StudyType, string> = {
    clinical: 'CLINICAL TRIAL',
    meta:     'META-ANALYSE',
    human:    'HUMAN STUDIE',
    animal:   'TIER / LABOR',
    study:    'STUDIE',
  }
  return labels[type]
}

export function getEvidenceLabel(score: EvidenceScore): string {
  const labels: Record<EvidenceScore, string> = {
    strong:      'Stark',
    moderate:    'Moderat',
    preclinical: 'Präklinisch',
    unknown:     'Unbekannt',
  }
  return labels[score]
}

export function getEvidenceContext(score: EvidenceScore): string {
  const contexts: Record<EvidenceScore, string> = {
    strong:      'Hochqualitative Evidenz, direkt auf Menschen anwendbar.',
    moderate:    'Solide Humandaten, weitere Studien empfohlen.',
    preclinical: 'Tierstudie — zeigt Potenzial, braucht Human-Bestätigung.',
    unknown:     'Studientyp nicht klassifiziert.',
  }
  return contexts[score]
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
