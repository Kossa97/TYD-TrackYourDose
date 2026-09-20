import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const semaglutid: PeptipediaEntry = {
  slug: 'semaglutid', name: 'Semaglutid', fullName: 'Semaglutide · GLP-1 receptor agonist', category: 'stoffwechsel', researchStatus: 'approved',
  identity: { status: 'confirmed', description: { de: 'Semaglutid ist ein definiertes GLP-1-Analogon. Dieses Profil trennt zugelassene Wegovy-Formulierungen nach Region; Salze und Forschungsprodukte sind nicht gleichwertig.', en: 'Semaglutide is a defined GLP-1 analogue. This profile distinguishes approved Wegovy formulations by region; salts and research products are not equivalent.' } },
  evidenceMatrix: { human: 'strong', replication: 'multiple_groups', endpoints: 'hard_outcome', safety: 'characterized' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'strong', animal: 'strong', clinical: 'extensive' }, reviewedAt: '2026-09-14', contentVersion: 3,
  approvals: [
    { region: 'EU', status: 'approved', product: 'Wegovy', indication: 'Gewichtsmanagement; produktbezogene EU-Indikationen und Dosierung laut Fachinformation', sourceIds: ['wegovy-eu'] },
    { region: 'US', status: 'approved', product: 'Wegovy', indication: 'Gewichtsmanagement, kardiovaskuläre Risikoreduktion und nichtzirrhotische MASH bei ausgewählten Patientengruppen', sourceIds: ['wegovy-us'] },
  ],
  sources: [
    { id: 'wegovy-us', kind: 'approved_label', title: 'Wegovy: US prescribing information (DailyMed)', publisherOrAuthors: 'U.S. National Library of Medicine (DailyMed)', year: 2026, accessedAt: '2026-09-14', url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=ee06186f-2aa3-4990-a760-757579d8f77b' },
    { id: 'wegovy-eu', kind: 'approved_label', title: 'Wegovy: EU product information (EMA)', publisherOrAuthors: 'European Medicines Agency', year: 2026, accessedAt: '2026-09-14', url: 'https://www.ema.europa.eu/en/documents/product-information/wegovy-epar-product-information_en.pdf' },
    { id: 'ema-naion-2025', kind: 'regulator', title: 'EMA PRAC: NAION is a very rare adverse effect of semaglutide medicines', publisherOrAuthors: 'European Medicines Agency', year: 2025, accessedAt: '2026-09-14', url: 'https://www.ema.europa.eu/en/news/meeting-highlights-pharmacovigilance-risk-assessment-committee-prac-2-5-june-2025' },
  ],
  mechanismSourceIds: ['wegovy-us', 'wegovy-eu'],
  safetySourceIds: ['wegovy-us', 'wegovy-eu', 'ema-naion-2025'],
  copy: {
    de: {
      tldr: 'Semaglutid ist ein GLP‑1-Rezeptoragonist mit zugelassenen Arzneimitteln. Indikation, Form und Dosierung hängen vom konkreten Produkt ab.',
      mechanism: 'Aktiviert GLP‑1-Rezeptoren und beeinflusst Appetit, Insulinsekretion und Magenentleerung.',
      researchAreas: ['Gewichtsmanagement', 'Stoffwechsel', 'MASH'], overviewFacts: [{ id: 'regional-update', label: 'Aktueller Zulassungskontext', value: 'EU- und US-Fachinformationen unterscheiden sich; die US-Fachinformation umfasst eine MASH-Indikation.', sourceIds: ['wegovy-eu', 'wegovy-us'] }], researchGaps: ['Ergebnisse sind an die untersuchte Population, Region und das konkrete Produkt gebunden.'],
      sideEffects: ['Häufig Magen-Darm-Beschwerden; Warnungen unter anderem zu Pankreatitis und Gallenblasenerkrankungen.', 'Die EMA stuft NAION als sehr seltene Nebenwirkung von Semaglutid-Arzneimitteln ein; bei plötzlichem Sehverlust ist eine sofortige medizinische Abklärung erforderlich.'],
      contraindications: ['US-Fachinformation: MTC-Vorgeschichte, MEN2 oder schwere Überempfindlichkeit; Schwangerschaft und schwere Gastroparese beachten.'],
      interactions: ['Insulin/Sulfonylharnstoffe erhöhen das Hypoglykämierisiko; orale Arzneimittel können beeinflusst werden.'],
      protocols: [],
    },
    en: {
      tldr: 'Semaglutide is a GLP-1 receptor agonist used in approved medicines. Indication, formulation and dosing depend on the specific product.',
      mechanism: 'Activates GLP-1 receptors, affecting appetite, insulin secretion and gastric emptying.',
      researchAreas: ['Weight management', 'Metabolism', 'MASH'], overviewFacts: [{ id: 'regional-update', label: 'Current approval context', value: 'EU and US product information differ; the US label includes a MASH indication.', sourceIds: ['wegovy-eu', 'wegovy-us'] }], researchGaps: ['Results depend on the studied population, region and specific product.'],
      sideEffects: ['Common gastrointestinal symptoms; warnings include pancreatitis and gallbladder disease.', 'EMA classifies NAION as a very rare adverse effect of semaglutide medicines; sudden vision loss requires urgent medical assessment.'],
      contraindications: ['US label: MTC history, MEN2 or serious hypersensitivity; consider pregnancy and severe gastroparesis warnings.'],
      interactions: ['Insulin/sulfonylureas increase hypoglycemia risk; oral medicines may be affected.'],
      protocols: [],
    },
  },
}
