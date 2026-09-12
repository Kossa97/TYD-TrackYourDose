import type { PeptipediaEntry } from '../types'

export const selank: PeptipediaEntry = {
  slug: 'selank', name: 'Selank', fullName: 'Tuftsin analogue', category: 'nootropikum', researchStatus: 'phase_2',
  evidence: { human: 'limited', animal: 'limited', clinical: 'sparse', score: 3 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [
    { id: 'selank-2014', kind: 'human_study', title: 'Selank in anxiety and somatoform disorders: comparative clinical study', year: 2014, url: 'https://pubmed.ncbi.nlm.nih.gov/25176261/' },
    { id: 'fda-selank', kind: 'regulator', title: 'FDA: Selank safety information in compounding', year: 2024, url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
  ],
  copy: {
    de: {
      tldr: 'Selank ist ein synthetisches Peptid mit begrenzten klinischen Untersuchungen zu Angstbeschwerden. Die bisherige Evidenz erlaubt keine verlässliche Aussage zu breitem Nutzen oder Langzeitsicherheit.',
      mechanism: 'Ein anxiolytischer Effekt wurde untersucht. Der klinisch relevante Mechanismus ist anhand der hier geprüften Humanquellen nicht abschließend geklärt.',
      researchAreas: ['Angstbeschwerden'], overviewFacts: [], researchGaps: ['Begrenzte und schwer unabhängig bestätigbare Humanstudien', 'Dosierung und Ablauf im zugänglichen Abstract nicht vollständig belegt', 'Unzureichende Sicherheitsinformationen laut FDA'], sideEffects: [], contraindications: [], interactions: [], protocols: [],
    },
    en: {
      tldr: 'Selank is a synthetic peptide with limited clinical research into anxiety symptoms. Current evidence does not reliably establish broad benefit or long-term safety.',
      mechanism: 'An anxiolytic effect has been investigated. The clinically relevant mechanism is not settled by the human sources reviewed here.',
      researchAreas: ['Anxiety symptoms'], overviewFacts: [], researchGaps: ['Limited human studies with little independent confirmation', 'Dose and procedure are not fully documented in the accessible abstract', 'Insufficient safety information according to FDA'], sideEffects: [], contraindications: [], interactions: [], protocols: [],
    },
  },
}
