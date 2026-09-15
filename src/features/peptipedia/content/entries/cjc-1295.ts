import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const cjc1295: PeptipediaEntry = {
  slug: 'cjc-1295', name: 'CJC-1295 DAC', fullName: 'Long-acting growth hormone-releasing hormone analog with DAC', category: 'wachstumshormon', researchStatus: 'human_research',
  identity: { status: 'confirmed', description: { de: 'Dieses Profil betrifft das albuminbindende CJC-1295 mit DAC aus den Humanstudien, nicht die uneinheitliche Handelsbezeichnung NO DAC.', en: 'This profile concerns albumin-binding CJC-1295 with DAC from the human studies, not the inconsistent NO DAC market term.' } },
  evidenceMatrix: { human: 'limited', replication: 'single_group', endpoints: 'surrogate', safety: 'limited' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'limited', animal: 'moderate', clinical: 'sparse' }, reviewedAt: '2026-09-14', contentVersion: 2,
  sources: [
    { id: 'teichman-2006', kind: 'human_study', title: 'Prolonged stimulation of growth hormone and insulin-like growth factor I secretion by CJC-1295', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 2006, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/16352683/', doi: '10.1210/jc.2005-1536' },
    { id: 'ionescu-2006', kind: 'human_study', title: 'CJC-1295 preserves growth hormone pulsatility in healthy adults', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 2006, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/17018654/', doi: '10.1210/jc.2006-1702' },
    { id: 'fda-cjc-risk', kind: 'regulator', title: 'FDA: Safety risks associated with CJC-1295 in compounding', publisherOrAuthors: 'U.S. Food and Drug Administration', year: 2024, accessedAt: '2026-09-14', url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
  ],
  mechanismSourceIds: ['teichman-2006', 'ionescu-2006'],
  safetySourceIds: ['fda-cjc-risk'],
  copy: {
    de: {
      tldr: 'CJC-1295 DAC ist ein langwirksames experimentelles GHRH-Analogon. Frühe Studien zeigen länger erhöhte GH- und IGF‑1-Werte, aber keine zugelassene Therapie oder belastbaren Langzeitnutzen.',
      mechanism: 'CJC-1295 aktiviert GHRH-Rezeptoren der Hypophyse. Die DAC-Modifikation bindet an Albumin und verlängert dadurch die Exposition.',
      researchAreas: ['GH- und IGF‑1-Sekretion', 'Verlängerte Pharmakokinetik'],
      overviewFacts: [{ id: 'half-life', label: 'Gemessene Halbwertszeit', value: '5,8 bis 8,1 Tage in frühen Humanstudien', sourceIds: ['teichman-2006'] }],
      researchGaps: ['Keine Arzneimittelzulassung', 'Kleine frühe Studien ohne patientenrelevante Langzeitendpunkte', 'Begrenzte Sicherheitsdaten'],
      sideEffects: ['Die FDA nennt erhöhte Herzfrequenz und eine systemische vasodilatatorische Reaktion als berichtete schwerwiegende Ereignisse.'],
      contraindications: ['Gegenanzeigen sind für eine zugelassene Anwendung nicht festgelegt.'], interactions: ['Wechselwirkungen sind für die hier beschriebenen Forschungs- oder Produktformen nicht ausreichend untersucht.'],
      protocols: [],
    },
    en: {
      tldr: 'CJC-1295 DAC is a long-acting experimental GHRH analogue. Early studies show sustained increases in GH and IGF-1, but it is not an approved therapy and long-term benefit is unproven.',
      mechanism: 'CJC-1295 activates pituitary GHRH receptors. Its DAC modification binds albumin and prolongs exposure.',
      researchAreas: ['GH and IGF-1 secretion', 'Extended pharmacokinetics'],
      overviewFacts: [{ id: 'half-life', label: 'Measured half-life', value: '5.8 to 8.1 days in early human studies', sourceIds: ['teichman-2006'] }],
      researchGaps: ['No marketing authorization', 'Small early studies without long-term patient-relevant outcomes', 'Limited safety data'],
      sideEffects: ['FDA cites increased heart rate and a systemic vasodilatory reaction among reported serious events.'],
      contraindications: ['Contraindications have not been established for an approved use.'], interactions: ['Interactions for the research or product forms described here have not been adequately studied.'],
      protocols: [],
    },
  },
}
