import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const selank: PeptipediaEntry = {
  slug: 'selank', name: 'Selank', fullName: 'Tuftsin analogue', category: 'nootropikum', researchStatus: 'human_research',
  identity: { status: 'ambiguous', description: { de: 'Selank ist ein Tuftsin-verwandtes Heptapeptid. Freie Base, Acetat und N-acetylierte Handelsvarianten sind ohne genaue Spezifikation nicht gleichzusetzen.', en: 'Selank is a tuftsin-related heptapeptide. Free base, acetate and N-acetylated market variants cannot be equated without exact specifications.' } },
  evidenceMatrix: { human: 'very_limited', replication: 'single_group', endpoints: 'symptom_or_function', safety: 'insufficient' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'limited', animal: 'limited', clinical: 'sparse' }, reviewedAt: '2026-09-14', contentVersion: 2,
  sources: [
    { id: 'selank-2014', kind: 'human_study', title: 'Selank in anxiety and somatoform disorders: comparative clinical study', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 2014, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/25176261/' },
    { id: 'fda-selank', kind: 'regulator', title: 'FDA: Selank safety information in compounding', publisherOrAuthors: 'U.S. Food and Drug Administration', year: 2024, accessedAt: '2026-09-14', url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
  ],
  mechanismSourceIds: ['selank-2014'],
  safetySourceIds: ['fda-selank'],
  copy: {
    de: {
      tldr: 'Selank ist ein synthetisches Peptid mit begrenzten klinischen Untersuchungen zu Angstbeschwerden. Die bisherige Evidenz erlaubt keine verlässliche Aussage zu breitem Nutzen oder Langzeitsicherheit.',
      mechanism: 'Ein anxiolytischer Effekt wurde untersucht. Der klinisch relevante Mechanismus ist anhand der hier geprüften Humanquellen nicht abschließend geklärt.',
      researchAreas: ['Angstbeschwerden'], overviewFacts: [], researchGaps: ['Begrenzte und schwer unabhängig bestätigbare Humanstudien', 'Dosierung und Ablauf im zugänglichen Abstract nicht vollständig belegt', 'Unzureichende Sicherheitsinformationen laut FDA'], sideEffects: ['Die Sicherheit der jeweiligen Selank-Form ist unzureichend geklärt, einschließlich möglicher Immunreaktionen.'], contraindications: ['Gegenanzeigen sind für diese Anwendung mangels ausreichender Daten nicht zuverlässig bestimmt.'], interactions: ['Wechselwirkungen sind für die hier beschriebenen Forschungs- oder Produktformen nicht ausreichend untersucht.'], protocols: [],
    },
    en: {
      tldr: 'Selank is a synthetic peptide with limited clinical research into anxiety symptoms. Current evidence does not reliably establish broad benefit or long-term safety.',
      mechanism: 'An anxiolytic effect has been investigated. The clinically relevant mechanism is not settled by the human sources reviewed here.',
      researchAreas: ['Anxiety symptoms'], overviewFacts: [], researchGaps: ['Limited human studies with little independent confirmation', 'Dose and procedure are not fully documented in the accessible abstract', 'Insufficient safety information according to FDA'], sideEffects: ['Safety of the specific Selank form is inadequately established, including potential immune reactions.'], contraindications: ['Contraindications for this use cannot be reliably determined from the available data.'], interactions: ['Interactions for the research or product forms described here have not been adequately studied.'], protocols: [],
    },
  },
}
