import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const epithalon: PeptipediaEntry = {
  slug: 'epithalon', name: 'Epithalon', fullName: 'Epitalon · Ala-Glu-Asp-Gly', category: 'anti_aging', researchStatus: 'preclinical',
  identity: { status: 'confirmed', description: { de: 'Epithalon/Epitalon bezeichnet Ala-Glu-Asp-Gly, ein synthetisches Tetrapeptid; es ist nicht der komplexe Epitalamin-Extrakt. Salz und Reinheit bleiben produktspezifisch.', en: 'Epithalon/epitalon denotes Ala-Glu-Asp-Gly, a synthetic tetrapeptide; it is not the complex epithalamin extract. Salt and purity remain product-specific.' } },
  evidenceMatrix: { human: 'none', replication: 'single_group', endpoints: 'none', safety: 'insufficient' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'none', animal: 'limited', clinical: 'none' }, reviewedAt: '2026-09-14', contentVersion: 2,
  sources: [
    { id: 'epitalon-cells-2022', kind: 'laboratory_study', title: 'Epitalon effects in cultured human THP-1 cells', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 2022, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/35408963/' },
    { id: 'fda-epitalon', kind: 'regulator', title: 'FDA: Epitalon safety information in compounding', publisherOrAuthors: 'U.S. Food and Drug Administration', year: 2024, accessedAt: '2026-09-14', url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
  ],
  mechanismSourceIds: ['epitalon-cells-2022'],
  safetySourceIds: ['fda-epitalon'],
  copy: {
    de: {
      tldr: 'Epithalon ist ein experimentelles Tetrapeptid aus der Alterungsforschung. Zellbefunde belegen keine Lebensverlängerung oder Verjüngung beim Menschen.',
      mechanism: 'Laborarbeiten untersuchen Veränderungen zellulärer Genregulation und Entzündungsprozesse. Ein therapeutisch gesicherter Mechanismus beim Menschen ist nicht belegt.',
      researchAreas: ['Zelluläre Alterungsprozesse', 'Genregulation in Zellmodellen'], overviewFacts: [], researchGaps: ['Keine belastbare klinische Anti-Aging-Wirksamkeit', 'Epitalamin-Extrakte sind nicht mit reinem Epithalon gleichzusetzen', 'Sicherheits- und Interaktionsdaten unzureichend'], sideEffects: ['Für Epithalon fehlen belastbare klinische Sicherheitsdaten; Zellbefunde sind kein Verträglichkeitsnachweis.'], contraindications: ['Gegenanzeigen sind für diese Anwendung mangels ausreichender Daten nicht zuverlässig bestimmt.'], interactions: ['Wechselwirkungen sind für die hier beschriebenen Forschungs- oder Produktformen nicht ausreichend untersucht.'], protocols: [],
    },
    en: {
      tldr: 'Epithalon is an experimental tetrapeptide studied in aging research. Cell findings do not demonstrate lifespan extension or rejuvenation in humans.',
      mechanism: 'Laboratory work examines changes in cellular gene regulation and inflammatory processes. An established therapeutic mechanism in humans has not been demonstrated.',
      researchAreas: ['Cellular aging', 'Gene regulation in cell models'], overviewFacts: [], researchGaps: ['No robust clinical anti-aging efficacy', 'Epithalamin extracts are not equivalent to pure epithalon', 'Insufficient safety and interaction data'], sideEffects: ['Robust clinical safety data for epithalon are lacking; cell findings do not establish tolerability.'], contraindications: ['Contraindications for this use cannot be reliably determined from the available data.'], interactions: ['Interactions for the research or product forms described here have not been adequately studied.'], protocols: [],
    },
  },
}
