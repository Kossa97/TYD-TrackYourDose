import type { PeptipediaEntry } from '../types'

export const ghkCu: PeptipediaEntry = {
  slug: 'ghk-cu', name: 'GHK-Cu', fullName: 'Glycyl-L-histidyl-L-lysine copper complex', category: 'anti_aging', researchStatus: 'preclinical',
  evidence: { human: 'none', animal: 'limited', clinical: 'none', score: 3 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [
    { id: 'maquart-1988', kind: 'laboratory_study', title: 'GHK-Cu stimulates collagen synthesis in fibroblast cultures', year: 1988, url: 'https://pubmed.ncbi.nlm.nih.gov/3169264/', doi: '10.1016/0014-5793(88)80509-x' },
    { id: 'fda-ghkcu', kind: 'regulator', title: 'FDA: Injectable GHK-Cu safety information', year: 2024, url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
  ],
  copy: {
    de: {
      tldr: 'GHK-Cu ist ein Kupfer-Tripeptid-Komplex, der unter anderem in Zellmodellen zur Kollagenbildung untersucht wurde. Kosmetische Anwendung und systemische Injektion haben unterschiedliche Evidenz- und Risikoprofile.',
      mechanism: 'GHK bindet Kupfer. In Fibroblastenkulturen wurde eine gesteigerte Kollagensynthese beobachtet; daraus lässt sich kein gesicherter systemischer Nutzen ableiten.',
      researchAreas: ['Kollagensynthese', 'Haut- und Gewebebiologie'],
      overviewFacts: [{ id: 'route-context', label: 'Anwendungskontext', value: 'Topische Kosmetikdaten belegen weder Nutzen noch Sicherheit von Injektionen.', sourceIds: ['maquart-1988', 'fda-ghkcu'] }],
      researchGaps: ['Begrenzte belastbare klinische Daten', 'FDA nennt begrenzte Humandaten für injizierbares GHK-Cu', 'Keine verifizierte systemische Dosierung aus den ausgewerteten Quellen'], sideEffects: [], contraindications: [], interactions: [], protocols: [],
    },
    en: {
      tldr: 'GHK-Cu is a copper-tripeptide complex studied in cell models of collagen production. Cosmetic use and systemic injection have different evidence and risk profiles.',
      mechanism: 'GHK binds copper. Increased collagen synthesis was observed in fibroblast cultures; this does not establish systemic benefit.',
      researchAreas: ['Collagen synthesis', 'Skin and tissue biology'],
      overviewFacts: [{ id: 'route-context', label: 'Route context', value: 'Topical cosmetic data establish neither benefit nor safety of injections.', sourceIds: ['maquart-1988', 'fda-ghkcu'] }],
      researchGaps: ['Limited robust clinical data', 'FDA notes limited human data for injectable GHK-Cu', 'No verified systemic dose from the reviewed sources'], sideEffects: [], contraindications: [], interactions: [], protocols: [],
    },
  },
}
