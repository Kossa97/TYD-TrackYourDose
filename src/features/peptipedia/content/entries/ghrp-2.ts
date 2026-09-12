import type { PeptipediaEntry } from '../types'

export const ghrp2: PeptipediaEntry = {
  slug: 'ghrp-2', name: 'GHRP-2', fullName: 'Growth Hormone Releasing Peptide-2', category: 'wachstumshormon', researchStatus: 'human_research',
  evidence: { human: 'limited', animal: 'moderate', clinical: 'sparse', score: 4 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [
    { id: 'nijland-1998', kind: 'human_study', title: 'Five-day GHRP-2 treatment: response attenuation and IGF-I secretion', year: 1998, url: 'https://pubmed.ncbi.nlm.nih.gov/9820615/', doi: '10.1530/eje.0.1390395' },
    { id: 'appetite-2006', kind: 'human_study', title: 'GHRP-2 stimulates food intake in lean and obese subjects', year: 2006, url: 'https://pubmed.ncbi.nlm.nih.gov/16861611/' },
  ],
  copy: {
    de: {
      tldr: 'GHRP-2 regt die Wachstumshormonfreisetzung an. Humanexperimente untersuchten Hormonantwort und Appetit; daraus folgt kein belegter Nutzen für Muskelaufbau oder Anti-Aging.',
      mechanism: 'Als Wachstumshormon-Sekretagogum aktiviert GHRP-2 den Ghrelin-Signalweg. Ein GH-Anstieg ist ein Laborendpunkt und kein eigenständiger Gesundheitsnachweis.',
      researchAreas: ['GH-Antwort', 'Appetitregulation'], overviewFacts: [],
      researchGaps: ['Kleine Studien mit kurzen Beobachtungszeiträumen', 'Langzeitnutzen und Risiken bei gesunden Anwendern unzureichend untersucht'],
      sideEffects: ['Vermehrte Nahrungsaufnahme wurde experimentell beobachtet.'], contraindications: [], interactions: [],
      protocols: [{ id: 'five-days', evidenceType: 'human', populationOrModel: 'Neun gesunde junge Männer', route: 'Subkutan', amount: '100 µg', frequency: 'Einmal täglich', duration: '5 Tage', objective: 'GH-Antwort und IGF‑1', outcome: 'GH-Antwort schwächte sich ab; IGF‑1 stieg nicht an.', sourceIds: ['nijland-1998'] }],
    },
    en: {
      tldr: 'GHRP-2 stimulates growth-hormone release. Human experiments studied hormone responses and appetite; they do not establish benefits for muscle gain or anti-aging.',
      mechanism: 'This growth-hormone secretagogue activates ghrelin signaling. A GH increase is a laboratory endpoint, not evidence of a health benefit by itself.',
      researchAreas: ['GH response', 'Appetite regulation'], overviewFacts: [],
      researchGaps: ['Small studies with short observation periods', 'Long-term benefits and risks in healthy users are insufficiently studied'],
      sideEffects: ['Increased food intake was observed experimentally.'], contraindications: [], interactions: [],
      protocols: [{ id: 'five-days', evidenceType: 'human', populationOrModel: 'Nine healthy young men', route: 'Subcutaneous', amount: '100 µg', frequency: 'Once daily', duration: '5 days', objective: 'GH response and IGF-1', outcome: 'GH responses attenuated; IGF-1 did not increase.', sourceIds: ['nijland-1998'] }],
    },
  },
}
