import type { PeptipediaEntry } from '../types'

export const epithalon: PeptipediaEntry = {
  slug: 'epithalon', name: 'Epithalon', fullName: 'Epitalon · Ala-Glu-Asp-Gly', category: 'anti_aging', researchStatus: 'preclinical',
  evidence: { human: 'none', animal: 'limited', clinical: 'none', score: 2 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [
    { id: 'epitalon-cells-2022', kind: 'laboratory_study', title: 'Epitalon effects in cultured human THP-1 cells', year: 2022, url: 'https://pubmed.ncbi.nlm.nih.gov/35408963/' },
    { id: 'fda-epitalon', kind: 'regulator', title: 'FDA: Epitalon safety information in compounding', year: 2024, url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
  ],
  copy: {
    de: {
      tldr: 'Epithalon ist ein experimentelles Tetrapeptid aus der Alterungsforschung. Zellbefunde belegen keine Lebensverlängerung oder Verjüngung beim Menschen.',
      mechanism: 'Laborarbeiten untersuchen Veränderungen zellulärer Genregulation und Entzündungsprozesse. Ein therapeutisch gesicherter Mechanismus beim Menschen ist nicht belegt.',
      researchAreas: ['Zelluläre Alterungsprozesse', 'Genregulation in Zellmodellen'], overviewFacts: [], researchGaps: ['Keine belastbare klinische Anti-Aging-Wirksamkeit', 'Epitalamin-Extrakte sind nicht mit reinem Epithalon gleichzusetzen', 'Sicherheits- und Interaktionsdaten unzureichend'], sideEffects: [], contraindications: [], interactions: [], protocols: [],
    },
    en: {
      tldr: 'Epithalon is an experimental tetrapeptide studied in aging research. Cell findings do not demonstrate lifespan extension or rejuvenation in humans.',
      mechanism: 'Laboratory work examines changes in cellular gene regulation and inflammatory processes. An established therapeutic mechanism in humans has not been demonstrated.',
      researchAreas: ['Cellular aging', 'Gene regulation in cell models'], overviewFacts: [], researchGaps: ['No robust clinical anti-aging efficacy', 'Epithalamin extracts are not equivalent to pure epithalon', 'Insufficient safety and interaction data'], sideEffects: [], contraindications: [], interactions: [], protocols: [],
    },
  },
}
