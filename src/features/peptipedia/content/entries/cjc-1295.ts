import type { PeptipediaEntry } from '../types'

export const cjc1295: PeptipediaEntry = {
  slug: 'cjc-1295', name: 'CJC-1295', fullName: 'Long-acting growth hormone-releasing hormone analog', category: 'wachstumshormon', researchStatus: 'human_research',
  evidence: { human: 'limited', animal: 'moderate', clinical: 'sparse', score: 4 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [
    { id: 'teichman-2006', kind: 'human_study', title: 'Prolonged stimulation of growth hormone and insulin-like growth factor I secretion by CJC-1295', year: 2006, url: 'https://pubmed.ncbi.nlm.nih.gov/16352683/', doi: '10.1210/jc.2005-1536' },
    { id: 'ionescu-2006', kind: 'human_study', title: 'CJC-1295 preserves growth hormone pulsatility in healthy adults', year: 2006, url: 'https://pubmed.ncbi.nlm.nih.gov/17018654/', doi: '10.1210/jc.2006-1702' },
    { id: 'fda-cjc-risk', kind: 'regulator', title: 'FDA: Safety risks associated with CJC-1295 in compounding', year: 2024, url: 'https://www.fda.gov/drugs/human-drug-compounding/certain-bulk-drug-substances-use-compounding-may-present-significant-safety-risks' },
  ],
  copy: {
    de: {
      tldr: 'CJC-1295 ist ein langwirksames experimentelles GHRH-Analogon. Frühe Studien zeigen länger erhöhte GH- und IGF‑1-Werte, aber keine zugelassene Therapie oder belastbaren Langzeitnutzen.',
      mechanism: 'CJC-1295 aktiviert GHRH-Rezeptoren der Hypophyse. Die DAC-Modifikation bindet an Albumin und verlängert dadurch die Exposition.',
      researchAreas: ['GH- und IGF‑1-Sekretion', 'Verlängerte Pharmakokinetik'],
      overviewFacts: [{ id: 'half-life', label: 'Gemessene Halbwertszeit', value: '5,8 bis 8,1 Tage in frühen Humanstudien', sourceIds: ['teichman-2006'] }],
      researchGaps: ['Keine Arzneimittelzulassung', 'Kleine frühe Studien ohne patientenrelevante Langzeitendpunkte', 'Begrenzte Sicherheitsdaten'],
      sideEffects: ['Die FDA nennt erhöhte Herzfrequenz und eine systemische vasodilatatorische Reaktion als berichtete schwerwiegende Ereignisse.'],
      contraindications: ['Gegenanzeigen sind für eine zugelassene Anwendung nicht festgelegt.'], interactions: [],
      protocols: [{ id: 'healthy-men-2006', evidenceType: 'human', populationOrModel: 'Gesunde Männer im Alter von 20 bis 40 Jahren', route: 'Subkutan', amount: '60 oder 90 µg/kg, wie publiziert', frequency: 'Einmalige Gabe', duration: 'Nächtliche 12-Stunden-Messung eine Woche nach der Injektion', objective: 'GH-Pulsatilität und IGF‑1 nach langwirksamem GHRH-Analogon', outcome: 'Pulsatile GH-Sekretion blieb erhalten; mittlere GH- und IGF‑1-Werte waren erhöht.', sourceIds: ['ionescu-2006'] }],
    },
    en: {
      tldr: 'CJC-1295 is a long-acting experimental GHRH analogue. Early studies show sustained increases in GH and IGF-1, but it is not an approved therapy and long-term benefit is unproven.',
      mechanism: 'CJC-1295 activates pituitary GHRH receptors. Its DAC modification binds albumin and prolongs exposure.',
      researchAreas: ['GH and IGF-1 secretion', 'Extended pharmacokinetics'],
      overviewFacts: [{ id: 'half-life', label: 'Measured half-life', value: '5.8 to 8.1 days in early human studies', sourceIds: ['teichman-2006'] }],
      researchGaps: ['No marketing authorization', 'Small early studies without long-term patient-relevant outcomes', 'Limited safety data'],
      sideEffects: ['FDA cites increased heart rate and a systemic vasodilatory reaction among reported serious events.'],
      contraindications: ['Contraindications have not been established for an approved use.'], interactions: [],
      protocols: [{ id: 'healthy-men-2006', evidenceType: 'human', populationOrModel: 'Healthy men aged 20 to 40 years', route: 'Subcutaneous', amount: '60 or 90 µg/kg, as published', frequency: 'Single administration', duration: 'Overnight 12-hour sampling one week after injection', objective: 'GH pulsatility and IGF-1 after a long-acting GHRH analogue', outcome: 'Pulsatile GH secretion was preserved; mean GH and IGF-1 were increased.', sourceIds: ['ionescu-2006'] }],
    },
  },
}
