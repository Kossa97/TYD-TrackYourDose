import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const ipamorelin: PeptipediaEntry = {
  slug: 'ipamorelin', name: 'Ipamorelin', fullName: 'Growth hormone secretagogue', category: 'wachstumshormon', researchStatus: 'human_research',
  identity: { status: 'confirmed', description: { de: 'Ipamorelin ist ein synthetisches Pentapeptid und GH-Sekretagogum. Die intravenöse Studienform ist kein Identitäts- oder Sicherheitsnachweis für beliebige Acetat-Vials.', en: 'Ipamorelin is a synthetic pentapeptide GH secretagogue. The intravenous trial formulation does not establish the identity or safety of arbitrary acetate vials.' } },
  evidenceMatrix: { human: 'limited', replication: 'single_group', endpoints: 'surrogate', safety: 'insufficient' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'limited', animal: 'moderate', clinical: 'sparse' }, reviewedAt: '2026-09-14', contentVersion: 2,
  sources: [
    { id: 'gobburu-1999', kind: 'human_study', title: 'Pharmacokinetic-pharmacodynamic modeling of ipamorelin, a growth hormone releasing peptide, in human volunteers', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 1999, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/10496658/', doi: '10.1023/a:1018955126402' },
    { id: 'fda-ipamorelin-risk', kind: 'regulator', title: 'FDA: Safety risks associated with ipamorelin in compounding', publisherOrAuthors: 'U.S. Food and Drug Administration', year: 2024, accessedAt: '2026-09-14', url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
  ],
  mechanismSourceIds: ['gobburu-1999'],
  safetySourceIds: ['fda-ipamorelin-risk'],
  copy: {
    de: {
      tldr: 'Ipamorelin ist ein experimentelles Wachstumshormon-Sekretagogum. Kleine frühe Humanstudien zeigen eine GH-Antwort, belegen aber keinen langfristigen gesundheitlichen Nutzen.',
      mechanism: 'Ipamorelin aktiviert den Ghrelin-/GHSR‑1a-Rezeptor und kann dadurch die Freisetzung von Wachstumshormon aus der Hypophyse anregen.',
      researchAreas: ['Pharmakokinetik und GH-Antwort', 'Ghrelin-Rezeptor-Signalweg'],
      overviewFacts: [{ id: 'half-life', label: 'Gemessene terminale Halbwertszeit', value: 'Etwa 2 Stunden nach intravenöser Gabe in einer kleinen Studie', sourceIds: ['gobburu-1999'] }],
      researchGaps: ['Keine Zulassung als Arzneimittel', 'Unzureichende Langzeit- und Anwendungssicherheit', 'Klinischer Nutzen außerhalb experimenteller Endpunkte unklar'],
      sideEffects: ['Die FDA beschreibt schwerwiegende unerwünschte Ereignisse in einer intravenösen Studie zur Magenmotilität; eine sichere Zuordnung ist aus der Übersicht allein nicht möglich.'],
      contraindications: ['Mangels ausreichender Daten sind Gegenanzeigen nicht verlässlich bestimmt.'], interactions: ['Wechselwirkungen sind für die hier beschriebenen Forschungs- oder Produktformen nicht ausreichend untersucht.'],
      protocols: [],
    },
    en: {
      tldr: 'Ipamorelin is an experimental growth-hormone secretagogue. Small early human studies show a GH response but do not establish long-term health benefit.',
      mechanism: 'Ipamorelin activates the ghrelin/GHSR-1a receptor and can thereby stimulate growth-hormone release from the pituitary.',
      researchAreas: ['Pharmacokinetics and GH response', 'Ghrelin-receptor signaling'],
      overviewFacts: [{ id: 'half-life', label: 'Measured terminal half-life', value: 'Approximately 2 hours after intravenous administration in a small study', sourceIds: ['gobburu-1999'] }],
      researchGaps: ['Not approved as a medicine', 'Insufficient long-term and route-specific safety data', 'Clinical benefit beyond experimental endpoints is unclear'],
      sideEffects: ['FDA describes serious adverse events in an intravenous gastric-motility study; causality cannot be established from the summary alone.'],
      contraindications: ['Contraindications cannot be determined reliably from the available data.'], interactions: ['Interactions for the research or product forms described here have not been adequately studied.'],
      protocols: [],
    },
  },
}
