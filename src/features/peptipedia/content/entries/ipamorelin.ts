import type { PeptipediaEntry } from '../types'

export const ipamorelin: PeptipediaEntry = {
  slug: 'ipamorelin', name: 'Ipamorelin', fullName: 'Growth hormone secretagogue', category: 'wachstumshormon', researchStatus: 'phase_1',
  evidence: { human: 'limited', animal: 'moderate', clinical: 'sparse', score: 3 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [
    { id: 'gobburu-1999', kind: 'human_study', title: 'Pharmacokinetic-pharmacodynamic modeling of ipamorelin, a growth hormone releasing peptide, in human volunteers', year: 1999, url: 'https://pubmed.ncbi.nlm.nih.gov/10496658/', doi: '10.1023/a:1018955126402' },
    { id: 'fda-ipamorelin-risk', kind: 'regulator', title: 'FDA: Safety risks associated with ipamorelin in compounding', year: 2024, url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
  ],
  copy: {
    de: {
      tldr: 'Ipamorelin ist ein experimentelles Wachstumshormon-Sekretagogum. Kleine frühe Humanstudien zeigen eine GH-Antwort, belegen aber keinen langfristigen gesundheitlichen Nutzen.',
      mechanism: 'Ipamorelin aktiviert den Ghrelin-/GHSR‑1a-Rezeptor und kann dadurch die Freisetzung von Wachstumshormon aus der Hypophyse anregen.',
      researchAreas: ['Pharmakokinetik und GH-Antwort', 'Ghrelin-Rezeptor-Signalweg'],
      overviewFacts: [{ id: 'half-life', label: 'Gemessene terminale Halbwertszeit', value: 'Etwa 2 Stunden nach intravenöser Gabe in einer kleinen Studie', sourceIds: ['gobburu-1999'] }],
      researchGaps: ['Keine Zulassung als Arzneimittel', 'Unzureichende Langzeit- und Anwendungssicherheit', 'Klinischer Nutzen außerhalb experimenteller Endpunkte unklar'],
      sideEffects: ['Die FDA beschreibt schwerwiegende unerwünschte Ereignisse in einer intravenösen Studie zur Magenmotilität; eine sichere Zuordnung ist aus der Übersicht allein nicht möglich.'],
      contraindications: ['Mangels ausreichender Daten sind Gegenanzeigen nicht verlässlich bestimmt.'], interactions: [],
      protocols: [{ id: 'pkpd-1999', evidenceType: 'human', populationOrModel: 'Gesunde männliche Probanden, acht Personen je Dosisgruppe', route: 'Intravenöse Infusion über 15 Minuten', amount: '4,21; 14,02; 42,13; 84,27 oder 140,45 nmol/kg, wie publiziert', frequency: 'Einmalige Gabe', duration: 'Serielle PK/PD-Messungen nach der Infusion', objective: 'Pharmakokinetik und Wachstumshormon-Antwort', outcome: 'Dosisabhängige GH-Antwort; terminale Halbwertszeit ungefähr 2 Stunden.', sourceIds: ['gobburu-1999'] }],
    },
    en: {
      tldr: 'Ipamorelin is an experimental growth-hormone secretagogue. Small early human studies show a GH response but do not establish long-term health benefit.',
      mechanism: 'Ipamorelin activates the ghrelin/GHSR-1a receptor and can thereby stimulate growth-hormone release from the pituitary.',
      researchAreas: ['Pharmacokinetics and GH response', 'Ghrelin-receptor signaling'],
      overviewFacts: [{ id: 'half-life', label: 'Measured terminal half-life', value: 'Approximately 2 hours after intravenous administration in a small study', sourceIds: ['gobburu-1999'] }],
      researchGaps: ['Not approved as a medicine', 'Insufficient long-term and route-specific safety data', 'Clinical benefit beyond experimental endpoints is unclear'],
      sideEffects: ['FDA describes serious adverse events in an intravenous gastric-motility study; causality cannot be established from the summary alone.'],
      contraindications: ['Contraindications cannot be determined reliably from the available data.'], interactions: [],
      protocols: [{ id: 'pkpd-1999', evidenceType: 'human', populationOrModel: 'Healthy male volunteers, eight participants per dose group', route: '15-minute intravenous infusion', amount: '4.21, 14.02, 42.13, 84.27 or 140.45 nmol/kg, as published', frequency: 'Single administration', duration: 'Serial PK/PD measurements after infusion', objective: 'Pharmacokinetics and growth-hormone response', outcome: 'Dose-dependent GH response; terminal half-life approximately 2 hours.', sourceIds: ['gobburu-1999'] }],
    },
  },
}
