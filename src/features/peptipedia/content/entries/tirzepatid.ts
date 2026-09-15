import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const tirzepatid: PeptipediaEntry = {
  slug: 'tirzepatid', name: 'Tirzepatid', fullName: 'Tirzepatide · GIP/GLP-1 receptor agonist', category: 'stoffwechsel', researchStatus: 'approved',
  identity: { status: 'confirmed', description: { de: 'Tirzepatid ist ein definiertes GIP-/GLP-1-Rezeptoragonisten-Peptid. Mounjaro und Zepbound werden produkt- und regionsbezogen beschrieben.', en: 'Tirzepatide is a defined GIP/GLP-1 receptor agonist peptide. Mounjaro and Zepbound are described in their product and regional contexts.' } },
  evidenceMatrix: { human: 'strong', replication: 'multiple_groups', endpoints: 'symptom_or_function', safety: 'characterized' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'strong', animal: 'strong', clinical: 'extensive' }, reviewedAt: '2026-09-14', contentVersion: 3,
  approvals: [
    { region: 'EU', status: 'approved', product: 'Mounjaro', indication: 'Typ-2-Diabetes und Gewichtsmanagement gemäß EU-Fachinformation', sourceIds: ['mounjaro-eu'] },
    { region: 'US', status: 'approved', product: 'Zepbound', indication: 'Gewichtsmanagement und mittelschwere bis schwere obstruktive Schlafapnoe bei Erwachsenen mit Adipositas', sourceIds: ['zepbound-us'] },
  ],
  sources: [
    { id: 'zepbound-us', kind: 'approved_label', title: 'Zepbound: US prescribing information (DailyMed)', publisherOrAuthors: 'U.S. National Library of Medicine (DailyMed)', year: 2026, accessedAt: '2026-09-14', url: 'https://dailymed.nlm.nih.gov/dailymed/fda/fdaDrugXsl.cfm?setid=487cd7e7-434c-4925-99fa-aa80b1cc776b' },
    { id: 'mounjaro-eu', kind: 'approved_label', title: 'Mounjaro: EU product information (EMA)', publisherOrAuthors: 'European Medicines Agency', year: 2026, accessedAt: '2026-09-14', url: 'https://www.ema.europa.eu/en/documents/product-information/mounjaro-epar-product-information_en.pdf' },
  ],
  mechanismSourceIds: ['zepbound-us', 'mounjaro-eu'],
  safetySourceIds: ['zepbound-us', 'mounjaro-eu'],
  copy: {
    de: {
      tldr: 'Tirzepatid aktiviert GIP- und GLP‑1-Rezeptoren. Zugelassene Produkte haben jeweils eigene Indikationen und Anwendungsvorgaben.',
      mechanism: 'Beeinflusst Appetit und glukoseabhängige Insulinsekretion; verzögert die Magenentleerung.',
      researchAreas: ['Gewichtsmanagement', 'Stoffwechsel'], overviewFacts: [], researchGaps: ['Produktbezogene Ergebnisse sind keine pauschale Empfehlung.'],
      sideEffects: ['Häufig Magen-Darm-Beschwerden; Warnungen zu Pankreatitis, Gallenblase und Flüssigkeitsverlust.'],
      contraindications: ['US-Fachinformation: MTC-Vorgeschichte, MEN2 oder schwere Überempfindlichkeit. Bei Schwangerschaft absetzen; schwere Gastroparese beachten.'],
      interactions: ['Insulin/Sulfonylharnstoffe: Hypoglykämierisiko. Orale Verhütung: zusätzliche Maßnahmen nach Beginn und Steigerungen laut Fachinformation.'],
      protocols: [],
    },
    en: {
      tldr: 'Tirzepatide activates GIP and GLP-1 receptors. Approved products have their own indications and administration requirements.',
      mechanism: 'Affects appetite and glucose-dependent insulin secretion; delays gastric emptying.',
      researchAreas: ['Weight management', 'Metabolism'], overviewFacts: [], researchGaps: ['Product-specific findings are not a general recommendation.'],
      sideEffects: ['Common gastrointestinal symptoms; warnings cover pancreatitis, gallbladder disease and dehydration.'],
      contraindications: ['US label: MTC history, MEN2 or serious hypersensitivity. Discontinue in pregnancy; consider severe gastroparesis warnings.'],
      interactions: ['Insulin/sulfonylureas: hypoglycemia risk. Oral contraception: additional measures after initiation and escalation per label.'],
      protocols: [],
    },
  },
}
