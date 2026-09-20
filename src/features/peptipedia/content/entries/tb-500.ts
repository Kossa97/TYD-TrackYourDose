import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const tb500: PeptipediaEntry = {
  slug: 'tb-500', name: 'TB-500', fullName: 'Thymosin-β4 fragment (17–23)', category: 'heilung', researchStatus: 'preclinical',
  identity: { status: 'ambiguous', description: { de: 'TB-500 wird hier als Thymosin-β4-Fragment LKKTETQ eingeordnet; Sequenz, Acetylierung und Salz eines Handelsprodukts müssen bestätigt werden. Nicht vollständiges Thymosin-β4.', en: 'TB-500 is discussed here as the thymosin-beta-4 fragment LKKTETQ; a marketed product requires confirmation of sequence, acetylation and salt. It is not full-length thymosin-beta-4.' } },
  evidenceMatrix: { human: 'none', replication: 'none', endpoints: 'none', safety: 'insufficient' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'none', animal: 'limited', clinical: 'none' }, reviewedAt: '2026-09-14', contentVersion: 2,
  sources: [
    { id: 'fda-tb500-risk', kind: 'regulator', title: 'FDA: Safety risks associated with thymosin beta-4 fragment in compounding', publisherOrAuthors: 'U.S. Food and Drug Administration', year: 2024, accessedAt: '2026-09-14', url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
    { id: 'tb4-ulcer-2010', kind: 'human_study', title: 'Thymosin beta 4 treatment of patients with venous stasis ulcers', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 2010, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/20536470/', doi: '10.1111/j.1749-6632.2010.05490.x' },
  ],
  mechanismSourceIds: ['fda-tb500-risk'],
  safetySourceIds: ['fda-tb500-risk'],
  copy: {
    de: {
      tldr: 'TB-500 ist ein synthetisch vermarktetes Fragment von Thymosin‑β4. Studien mit dem vollständigen Thymosin‑β4 sind kein Wirksamkeits- oder Dosierungsnachweis für TB‑500.',
      mechanism: 'Ein klinisch bestätigter Wirkmechanismus für das hier beschriebene TB‑500-Fragment ist nicht belegt. Ergebnisse zum vollständigen Thymosin‑β4 dürfen nicht automatisch auf das Fragment übertragen werden.',
      researchAreas: ['Zellmigration und Gewebereparatur', 'Abgrenzung zum vollständigen Thymosin‑β4'],
      overviewFacts: [{ id: 'not-tb4', label: 'Wichtige Abgrenzung', value: 'TB‑500-Fragment und vollständiges Thymosin‑β4 sind nicht dasselbe Prüfpräparat.', sourceIds: ['fda-tb500-risk', 'tb4-ulcer-2010'] }],
      researchGaps: ['FDA fand keine Humanexpositionsdaten für das bewertete Fragment', 'Keine belastbare klinische Wirksamkeit oder Dosierung', 'Studien zu vollständigem Thymosin‑β4 sind nicht übertragbar'],
      sideEffects: ['Für das Fragment fehlen ausreichende Human-Sicherheitsdaten; Immunogenität und Verunreinigungen sind offene Risiken.'], contraindications: ['Gegenanzeigen sind mangels Humanstudien nicht zuverlässig bestimmt.'], interactions: ['Wechselwirkungen sind für die hier beschriebenen Forschungs- oder Produktformen nicht ausreichend untersucht.'], protocols: [],
    },
    en: {
      tldr: 'TB-500 is a commercially marketed synthetic fragment of thymosin beta-4. Studies of full-length thymosin beta-4 do not prove efficacy or dosing for TB-500.',
      mechanism: 'A clinically confirmed mechanism of action has not been established for the TB-500 fragment described here. Findings for full-length thymosin beta-4 must not automatically be transferred to the fragment.',
      researchAreas: ['Cell migration and tissue repair', 'Distinction from full-length thymosin beta-4'],
      overviewFacts: [{ id: 'not-tb4', label: 'Important distinction', value: 'The TB-500 fragment and full-length thymosin beta-4 are not the same investigational substance.', sourceIds: ['fda-tb500-risk', 'tb4-ulcer-2010'] }],
      researchGaps: ['FDA found no human exposure data for the evaluated fragment', 'No reliable clinical efficacy or dose', 'Full-length thymosin beta-4 studies are not transferable'],
      sideEffects: ['The fragment lacks adequate human safety data; immunogenicity and impurities remain concerns.'], contraindications: ['Contraindications cannot be determined reliably because human studies are unavailable.'], interactions: ['Interactions for the research or product forms described here have not been adequately studied.'], protocols: [],
    },
  },
}
