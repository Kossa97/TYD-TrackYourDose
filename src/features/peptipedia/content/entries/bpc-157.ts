import type { PeptipediaEntry } from '../types'

export const bpc157: PeptipediaEntry = {
  slug: 'bpc-157',
  name: 'BPC-157',
  fullName: 'Body Protection Compound 157',
  category: 'heilung',
  researchStatus: 'human_research',
  evidence: { human: 'limited', animal: 'moderate', clinical: 'sparse', score: 2 },
  reviewedAt: '2026-09-12',
  contentVersion: 1,
  sources: [
    { id: 'lee-2025-pilot', kind: 'human_study', title: 'Safety of Intravenous Infusion of BPC157 in Humans: A Pilot Study', year: 2025, url: 'https://pubmed.ncbi.nlm.nih.gov/40131143/' },
    {
      id: 'fda-bpc-risk',
      kind: 'regulator',
      title: 'FDA: Safety risks associated with BPC-157 in compounding',
      year: 2024,
      url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks',
    },
    {
      id: 'staresinic-2003',
      kind: 'animal_study',
      title: 'BPC 157 accelerates healing of transected rat Achilles tendon and stimulates tendocyte growth',
      year: 2003,
      url: 'https://pubmed.ncbi.nlm.nih.gov/14554208/',
      doi: '10.1016/S0736-0266(03)00110-4',
    },
  ],
  copy: {
    de: {
      tldr: 'BPC-157 ist ein synthetisches Peptid, dessen beworbene Regenerationseffekte fast ausschließlich aus Tier- und Laborforschung stammen. Belastbare Wirksamkeits- und Sicherheitsdaten am Menschen fehlen.',
      mechanism: 'In Tier- und Zellmodellen wurden Effekte auf Tendonzyten, Kollagenorganisation und Gefäßbildung beobachtet. Daraus lässt sich weder ein gesicherter Wirkmechanismus noch ein Nutzen beim Menschen ableiten.',
      researchAreas: ['Sehnen- und Bandheilung in Tiermodellen', 'Zelluläre Reparaturprozesse'],
      overviewFacts: [{ id: 'evidence-base', label: 'Evidenzbasis', value: 'Überwiegend präklinische Forschung; kleine Humanpilotstudien reichen für einen Sicherheitsnachweis nicht aus.', sourceIds: ['fda-bpc-risk', 'staresinic-2003', 'lee-2025-pilot'] }],
      researchGaps: ['Die unkontrollierte Pilotstudie von 2025 umfasst nur zwei bereits zuvor exponierte Personen.', 'Keine belastbaren kontrollierten Wirksamkeitsstudien am Menschen', 'Keine ausreichend charakterisierte klinische Pharmakokinetik', 'Unklare Langzeitsicherheit und Produktqualität'],
      sideEffects: [],
      contraindications: ['Mangels ausreichender Humandaten sind Gegenanzeigen nicht zuverlässig bestimmt.'],
      interactions: [],
      protocols: [{
        id: 'rat-achilles-2003', evidenceType: 'animal', populationOrModel: 'Ratten mit durchtrennter Achillessehne', route: 'Intraperitoneal', amount: '10 µg, 10 ng oder 10 pg pro kg Körpergewicht, wie publiziert', frequency: 'Einmal täglich', duration: 'Bis zur Untersuchung an Tag 1, 4, 7, 10 oder 14', objective: 'Funktionelle, biomechanische und histologische Sehnenheilung', outcome: 'Die behandelten Gruppen zeigten bessere Heilungsparameter als die Kontrollen.', sourceIds: ['staresinic-2003'],
      }],
    },
    en: {
      tldr: 'BPC-157 is a synthetic peptide whose promoted regenerative effects come almost entirely from animal and laboratory research. Reliable human efficacy and safety data are lacking.',
      mechanism: 'Animal and cell models have reported effects on tendon cells, collagen organization and blood-vessel formation. These findings do not establish a mechanism or benefit in humans.',
      researchAreas: ['Tendon and ligament healing in animal models', 'Cellular repair processes'],
      overviewFacts: [{ id: 'evidence-base', label: 'Evidence base', value: 'Mainly preclinical research; small human pilots cannot establish safety.', sourceIds: ['fda-bpc-risk', 'staresinic-2003', 'lee-2025-pilot'] }],
      researchGaps: ['The uncontrolled 2025 pilot includes only two previously exposed participants.', 'No robust controlled human efficacy trials', 'No adequately characterized clinical pharmacokinetics', 'Uncertain long-term safety and product quality'],
      sideEffects: [],
      contraindications: ['Contraindications cannot be determined reliably because adequate human data are unavailable.'],
      interactions: [],
      protocols: [{
        id: 'rat-achilles-2003', evidenceType: 'animal', populationOrModel: 'Rats with transected Achilles tendons', route: 'Intraperitoneal', amount: '10 µg, 10 ng or 10 pg per kg body weight, as published', frequency: 'Once daily', duration: 'Until assessment on day 1, 4, 7, 10 or 14', objective: 'Functional, biomechanical and histological tendon healing', outcome: 'Treated groups showed improved healing measures compared with controls.', sourceIds: ['staresinic-2003'],
      }],
    },
  },
}
