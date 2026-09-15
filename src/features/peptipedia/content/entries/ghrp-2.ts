import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const ghrp2: PeptipediaEntry = {
  slug: 'ghrp-2', name: 'GHRP-2', fullName: 'Growth Hormone Releasing Peptide-2', category: 'wachstumshormon', researchStatus: 'human_research',
  identity: { status: 'confirmed', description: { de: 'GHRP-2 ist Pralmorelin, ein synthetisches Hexapeptid. Die frühen Humanstudien belegen keine Gleichwertigkeit beliebiger Forschungsprodukte.', en: 'GHRP-2 is pralmorelin, a synthetic hexapeptide. The early human studies do not establish equivalence of arbitrary research products.' } },
  evidenceMatrix: { human: 'limited', replication: 'multiple_groups', endpoints: 'surrogate', safety: 'limited' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'limited', animal: 'moderate', clinical: 'sparse' }, reviewedAt: '2026-09-14', contentVersion: 2,
  sources: [
    { id: 'nijland-1998', kind: 'human_study', title: 'Five-day GHRP-2 treatment: response attenuation and IGF-I secretion', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 1998, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/9820615/', doi: '10.1530/eje.0.1390395' },
    { id: 'appetite-2006', kind: 'human_study', title: 'GHRP-2 stimulates food intake in lean and obese subjects', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 2006, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/16861611/' },
  ],
  mechanismSourceIds: ['nijland-1998', 'appetite-2006'],
  safetySourceIds: ['nijland-1998', 'appetite-2006'],
  copy: {
    de: {
      tldr: 'GHRP-2 regt die Wachstumshormonfreisetzung an. Humanexperimente untersuchten Hormonantwort und Appetit; daraus folgt kein belegter Nutzen für Muskelaufbau oder Anti-Aging.',
      mechanism: 'Als Wachstumshormon-Sekretagogum aktiviert GHRP-2 den Ghrelin-Signalweg. Ein GH-Anstieg ist ein Laborendpunkt und kein eigenständiger Gesundheitsnachweis.',
      researchAreas: ['GH-Antwort', 'Appetitregulation'], overviewFacts: [],
      researchGaps: ['Kleine Studien mit kurzen Beobachtungszeiträumen', 'Langzeitnutzen und Risiken bei gesunden Anwendern unzureichend untersucht'],
      sideEffects: ['Vermehrte Nahrungsaufnahme wurde experimentell beobachtet.'], contraindications: ['Gegenanzeigen sind für diese Anwendung mangels ausreichender Daten nicht zuverlässig bestimmt.'], interactions: ['Wechselwirkungen sind für die hier beschriebenen Forschungs- oder Produktformen nicht ausreichend untersucht.'],
      protocols: [],
    },
    en: {
      tldr: 'GHRP-2 stimulates growth-hormone release. Human experiments studied hormone responses and appetite; they do not establish benefits for muscle gain or anti-aging.',
      mechanism: 'This growth-hormone secretagogue activates ghrelin signaling. A GH increase is a laboratory endpoint, not evidence of a health benefit by itself.',
      researchAreas: ['GH response', 'Appetite regulation'], overviewFacts: [],
      researchGaps: ['Small studies with short observation periods', 'Long-term benefits and risks in healthy users are insufficiently studied'],
      sideEffects: ['Increased food intake was observed experimentally.'], contraindications: ['Contraindications for this use cannot be reliably determined from the available data.'], interactions: ['Interactions for the research or product forms described here have not been adequately studied.'],
      protocols: [],
    },
  },
}
