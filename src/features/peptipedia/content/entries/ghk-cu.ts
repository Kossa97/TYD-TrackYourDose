import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const ghkCu: PeptipediaEntry = {
  slug: 'ghk-cu', name: 'GHK-Cu', fullName: 'Glycyl-L-histidyl-L-lysine copper complex', category: 'anti_aging', researchStatus: 'human_research',
  identity: { status: 'confirmed', description: { de: 'GHK-Cu ist der Kupfer(II)-Komplex des Tripeptids Gly-His-Lys. Die topische Studienform ist nicht mit injizierbaren Produkten gleichzusetzen.', en: 'GHK-Cu is the copper(II) complex of the Gly-His-Lys tripeptide. The topical study formulation is not equivalent to injectable products.' } },
  evidenceMatrix: { human: 'very_limited', replication: 'single_group', endpoints: 'symptom_or_function', safety: 'insufficient' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'limited', animal: 'limited', clinical: 'sparse' }, reviewedAt: '2026-09-14', contentVersion: 3,
  sources: [
    { id: 'maquart-1988', kind: 'laboratory_study', title: 'GHK-Cu stimulates collagen synthesis in fibroblast cultures', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 1988, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/3169264/', doi: '10.1016/0014-5793(88)80509-x' },
    { id: 'fda-ghkcu', kind: 'regulator', title: 'FDA: Injectable GHK-Cu safety information', publisherOrAuthors: 'U.S. Food and Drug Administration', year: 2024, accessedAt: '2026-09-14', url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
    { id: 'miller-2006', kind: 'human_study', title: 'Topical copper tripeptide after CO2 laser resurfacing: small randomized study', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 2006, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/16847171/' },
  ],
  mechanismSourceIds: ['maquart-1988'],
  safetySourceIds: ['fda-ghkcu'],
  copy: {
    de: {
      tldr: 'GHK-Cu ist ein Kupfer-Tripeptid-Komplex, der unter anderem in Zellmodellen zur Kollagenbildung untersucht wurde. Kosmetische Anwendung und systemische Injektion haben unterschiedliche Evidenz- und Risikoprofile.',
      mechanism: 'GHK bindet Kupfer. In Fibroblastenkulturen wurde eine gesteigerte Kollagensynthese beobachtet; daraus lässt sich kein gesicherter systemischer Nutzen ableiten.',
      researchAreas: ['Kollagensynthese', 'Haut- und Gewebebiologie'],
      overviewFacts: [{ id: 'route-context', label: 'Anwendungskontext', value: 'Eine kleine topische Humanstudie nach Laserbehandlung untersuchte den Kupfer-Tripeptid-Komplex. Sie belegt weder Nutzen noch Sicherheit von Injektionen.', sourceIds: ['miller-2006', 'fda-ghkcu'] }],
      researchGaps: ['Nur kleine und anwendungsspezifische klinische Daten', 'FDA nennt begrenzte Humandaten für injizierbares GHK-Cu', 'Keine verifizierte systemische Dosierung aus den ausgewerteten Quellen'], sideEffects: ['Das Sicherheitsprofil einer systemischen Injektion ist nicht ausreichend untersucht.'], contraindications: ['Gegenanzeigen sind für diese Anwendung mangels ausreichender Daten nicht zuverlässig bestimmt.'], interactions: ['Wechselwirkungen sind für die hier beschriebenen Forschungs- oder Produktformen nicht ausreichend untersucht.'], protocols: [],
    },
    en: {
      tldr: 'GHK-Cu is a copper-tripeptide complex studied in cell models of collagen production. Cosmetic use and systemic injection have different evidence and risk profiles.',
      mechanism: 'GHK binds copper. Increased collagen synthesis was observed in fibroblast cultures; this does not establish systemic benefit.',
      researchAreas: ['Collagen synthesis', 'Skin and tissue biology'],
      overviewFacts: [{ id: 'route-context', label: 'Route context', value: 'A small topical human study after laser resurfacing investigated the copper-tripeptide complex. It establishes neither benefit nor safety of injections.', sourceIds: ['miller-2006', 'fda-ghkcu'] }],
      researchGaps: ['Only small, route-specific clinical data', 'FDA notes limited human data for injectable GHK-Cu', 'No verified systemic dose from the reviewed sources'], sideEffects: ['The safety profile of systemic injection is not adequately studied.'], contraindications: ['Contraindications for this use cannot be reliably determined from the available data.'], interactions: ['Interactions for the research or product forms described here have not been adequately studied.'], protocols: [],
    },
  },
}
