import type { PeptipediaEntry } from '../types'

export const tb500: PeptipediaEntry = {
  slug: 'tb-500', name: 'TB-500', fullName: 'Thymosin-β4 fragment (17–23)', category: 'heilung', researchStatus: 'preclinical',
  evidence: { human: 'none', animal: 'limited', clinical: 'none', score: 1 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [
    { id: 'fda-tb500-risk', kind: 'regulator', title: 'FDA: Safety risks associated with thymosin beta-4 fragment in compounding', year: 2024, url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
    { id: 'tb4-ulcer-2010', kind: 'human_study', title: 'Thymosin beta 4 treatment of patients with venous stasis ulcers', year: 2010, url: 'https://pubmed.ncbi.nlm.nih.gov/20536470/', doi: '10.1111/j.1749-6632.2010.05490.x' },
  ],
  copy: {
    de: {
      tldr: 'TB-500 ist ein synthetisch vermarktetes Fragment von Thymosin‑β4. Studien mit dem vollständigen Thymosin‑β4 sind kein Wirksamkeits- oder Dosierungsnachweis für TB‑500.',
      mechanism: 'Dem Fragment werden Aktin-bindende und zellmigrationsbezogene Eigenschaften zugeschrieben. Die klinische Bedeutung für das als TB‑500 angebotene Fragment ist nicht geklärt.',
      researchAreas: ['Zellmigration und Gewebereparatur', 'Abgrenzung zum vollständigen Thymosin‑β4'],
      overviewFacts: [{ id: 'not-tb4', label: 'Wichtige Abgrenzung', value: 'TB‑500-Fragment und vollständiges Thymosin‑β4 sind nicht dasselbe Prüfpräparat.', sourceIds: ['fda-tb500-risk', 'tb4-ulcer-2010'] }],
      researchGaps: ['FDA fand keine Humanexpositionsdaten für das bewertete Fragment', 'Keine belastbare klinische Wirksamkeit oder Dosierung', 'Studien zu vollständigem Thymosin‑β4 sind nicht übertragbar'],
      sideEffects: [], contraindications: ['Gegenanzeigen sind mangels Humanstudien nicht zuverlässig bestimmt.'], interactions: [], protocols: [],
    },
    en: {
      tldr: 'TB-500 is a commercially marketed synthetic fragment of thymosin beta-4. Studies of full-length thymosin beta-4 do not prove efficacy or dosing for TB-500.',
      mechanism: 'The fragment is associated with actin binding and cell migration. The clinical significance for the product marketed as TB-500 remains undetermined.',
      researchAreas: ['Cell migration and tissue repair', 'Distinction from full-length thymosin beta-4'],
      overviewFacts: [{ id: 'not-tb4', label: 'Important distinction', value: 'The TB-500 fragment and full-length thymosin beta-4 are not the same investigational substance.', sourceIds: ['fda-tb500-risk', 'tb4-ulcer-2010'] }],
      researchGaps: ['FDA found no human exposure data for the evaluated fragment', 'No reliable clinical efficacy or dose', 'Full-length thymosin beta-4 studies are not transferable'],
      sideEffects: [], contraindications: ['Contraindications cannot be determined reliably because human studies are unavailable.'], interactions: [], protocols: [],
    },
  },
}
