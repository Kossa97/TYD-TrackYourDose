import type { PeptipediaEntry } from '../types'

export const tirzepatid: PeptipediaEntry = {
  slug: 'tirzepatid', name: 'Tirzepatid', fullName: 'Tirzepatide · GIP/GLP-1 receptor agonist', category: 'stoffwechsel', researchStatus: 'approved',
  evidence: { human: 'strong', animal: 'strong', clinical: 'extensive', score: 10 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [{ id: 'zepbound-us', kind: 'approved_label', title: 'Zepbound: US prescribing information (DailyMed)', year: 2026, url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=487cd7e7-434c-4925-99fa-aa80b1cc776b' }],
  copy: {
    de: {
      tldr: 'Tirzepatid aktiviert GIP- und GLP‑1-Rezeptoren. Zugelassene Produkte haben jeweils eigene Indikationen und Anwendungsvorgaben.',
      mechanism: 'Beeinflusst Appetit und glukoseabhängige Insulinsekretion; verzögert die Magenentleerung.',
      researchAreas: ['Gewichtsmanagement', 'Stoffwechsel'], overviewFacts: [], researchGaps: ['Produktbezogene Ergebnisse sind keine pauschale Empfehlung.'],
      sideEffects: ['Häufig Magen-Darm-Beschwerden; Warnungen zu Pankreatitis, Gallenblase und Flüssigkeitsverlust.'],
      contraindications: ['US-Fachinformation: MTC-Vorgeschichte, MEN2 oder schwere Überempfindlichkeit. Bei Schwangerschaft absetzen; schwere Gastroparese beachten.'],
      interactions: ['Insulin/Sulfonylharnstoffe: Hypoglykämierisiko. Orale Verhütung: zusätzliche Maßnahmen nach Beginn und Steigerungen laut Fachinformation.'],
      protocols: [{ id: 'zepbound-weight', evidenceType: 'approved_label', populationOrModel: 'Erwachsene gemäß US-Zepbound-Indikation zum Gewichtsmanagement', route: 'Subkutan', amount: '2,5 mg für 4 Wochen; Steigerungen um 2,5 mg frühestens nach jeweils 4 Wochen. Erhaltung: 5, 10 oder 15 mg; maximal 15 mg.', frequency: 'Wöchentlich', duration: 'Langzeittherapie mit ärztlicher Beurteilung', objective: 'Zugelassenes Produktschema dokumentieren', outcome: 'Dosiswahl nach Ansprechen und Verträglichkeit.', sourceIds: ['zepbound-us'] }],
    },
    en: {
      tldr: 'Tirzepatide activates GIP and GLP-1 receptors. Approved products have their own indications and administration requirements.',
      mechanism: 'Affects appetite and glucose-dependent insulin secretion; delays gastric emptying.',
      researchAreas: ['Weight management', 'Metabolism'], overviewFacts: [], researchGaps: ['Product-specific findings are not a general recommendation.'],
      sideEffects: ['Common gastrointestinal symptoms; warnings cover pancreatitis, gallbladder disease and dehydration.'],
      contraindications: ['US label: MTC history, MEN2 or serious hypersensitivity. Discontinue in pregnancy; consider severe gastroparesis warnings.'],
      interactions: ['Insulin/sulfonylureas: hypoglycemia risk. Oral contraception: additional measures after initiation and escalation per label.'],
      protocols: [{ id: 'zepbound-weight', evidenceType: 'approved_label', populationOrModel: 'Adults meeting the US Zepbound weight-management indication', route: 'Subcutaneous', amount: '2.5 mg for 4 weeks; 2.5 mg increments at intervals of at least 4 weeks. Maintenance: 5, 10 or 15 mg; maximum 15 mg.', frequency: 'Weekly', duration: 'Long-term treatment with clinical review', objective: 'Document approved product schedule', outcome: 'Dose selection depends on response and tolerability.', sourceIds: ['zepbound-us'] }],
    },
  },
}
