import type { PeptipediaEntry } from '../types'

export const semaglutid: PeptipediaEntry = {
  slug: 'semaglutid', name: 'Semaglutid', fullName: 'Semaglutide · GLP-1 receptor agonist', category: 'stoffwechsel', researchStatus: 'approved',
  evidence: { human: 'strong', animal: 'strong', clinical: 'extensive', score: 10 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [{ id: 'wegovy-us', kind: 'approved_label', title: 'Wegovy: US prescribing information (DailyMed)', year: 2026, url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ee06186f-2aa3-4990-a760-757579d8f77b' }],
  copy: {
    de: {
      tldr: 'Semaglutid ist ein GLP‑1-Rezeptoragonist mit zugelassenen Arzneimitteln. Indikation, Form und Dosierung hängen vom konkreten Produkt ab.',
      mechanism: 'Aktiviert GLP‑1-Rezeptoren und beeinflusst Appetit, Insulinsekretion und Magenentleerung.',
      researchAreas: ['Gewichtsmanagement', 'Stoffwechsel'], overviewFacts: [], researchGaps: ['Ergebnisse sind an die untersuchte Population und das Produkt gebunden.'],
      sideEffects: ['Häufig Magen-Darm-Beschwerden; Warnungen unter anderem zu Pankreatitis und Gallenblasenerkrankungen.'],
      contraindications: ['US-Fachinformation: MTC-Vorgeschichte, MEN2 oder schwere Überempfindlichkeit; Schwangerschaft und schwere Gastroparese beachten.'],
      interactions: ['Insulin/Sulfonylharnstoffe erhöhen das Hypoglykämierisiko; orale Arzneimittel können beeinflusst werden.'],
      protocols: [{ id: 'wegovy-injection', evidenceType: 'approved_label', populationOrModel: 'Wegovy-Injektion: zugelassene US-Population laut Fachinformation', route: 'Subkutan', amount: 'Wochen 1–4: 0,25 mg; 5–8: 0,5 mg; 9–12: 1 mg; 13–16: 1,7 mg. Erhaltung indikationsabhängig laut Fachinformation.', frequency: 'Wöchentlich', duration: 'Langzeittherapie mit ärztlicher Beurteilung', objective: 'Produktbezogene Titration dokumentieren', outcome: 'Zulassungsschema; individuelle Verträglichkeit bestimmt die weitere Behandlung.', sourceIds: ['wegovy-us'] }],
    },
    en: {
      tldr: 'Semaglutide is a GLP-1 receptor agonist used in approved medicines. Indication, formulation and dosing depend on the specific product.',
      mechanism: 'Activates GLP-1 receptors, affecting appetite, insulin secretion and gastric emptying.',
      researchAreas: ['Weight management', 'Metabolism'], overviewFacts: [], researchGaps: ['Results depend on the studied population and product.'],
      sideEffects: ['Common gastrointestinal symptoms; warnings include pancreatitis and gallbladder disease.'],
      contraindications: ['US label: MTC history, MEN2 or serious hypersensitivity; consider pregnancy and severe gastroparesis warnings.'],
      interactions: ['Insulin/sulfonylureas increase hypoglycemia risk; oral medicines may be affected.'],
      protocols: [{ id: 'wegovy-injection', evidenceType: 'approved_label', populationOrModel: 'Wegovy injection: approved US population per prescribing information', route: 'Subcutaneous', amount: 'Weeks 1–4: 0.25 mg; 5–8: 0.5 mg; 9–12: 1 mg; 13–16: 1.7 mg. Indication-specific maintenance per label.', frequency: 'Weekly', duration: 'Long-term treatment with clinical review', objective: 'Document product-specific titration', outcome: 'Approved schedule; tolerability determines subsequent treatment.', sourceIds: ['wegovy-us'] }],
    },
  },
}
