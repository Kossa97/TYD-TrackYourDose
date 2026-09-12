import type { PeptipediaEntry } from '../types'

export const sermorelin: PeptipediaEntry = {
  slug: 'sermorelin', name: 'Sermorelin', fullName: 'GHRH(1–29)-NH₂', category: 'wachstumshormon', researchStatus: 'historical_approval',
  evidence: { human: 'moderate', animal: 'moderate', clinical: 'moderate', score: 6 }, reviewedAt: '2026-09-12', contentVersion: 1,
  sources: [
    { id: 'geref-history', kind: 'regulator', title: 'FDA historical Geref (sermorelin acetate) approval documents', year: 1991, url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/pre96/019863_S001_GEREF.pdf' },
    { id: 'spoudeas-1994', kind: 'human_study', title: 'Low-dose growth hormone-releasing hormone tests: a dose-response study', year: 1994, url: 'https://pubmed.ncbi.nlm.nih.gov/7921207/', doi: '10.1530/eje.0.1310238' },
  ],
  copy: {
    de: {
      tldr: 'Sermorelin ist ein kurzes GHRH-Analogon zur Stimulation von Wachstumshormon. Es hat eine historische US-Zulassung als Geref; diese bestätigt keine Anti-Aging-Anwendung heutiger Rezepturprodukte.',
      mechanism: 'Sermorelin entspricht dem aktiven GHRH-Fragment und stimuliert die GH-Freisetzung aus einer funktionsfähigen Hypophyse.',
      researchAreas: ['Diagnostik der GH-Sekretion', 'Wachstumshormonmangel'],
      overviewFacts: [{ id: 'historical', label: 'Zulassungsstatus einordnen', value: 'Historische Geref-Zulassung; keine pauschale Zulassung heutiger Sermorelin-Produkte.', sourceIds: ['geref-history'] }],
      researchGaps: ['Kein etablierter Anti-Aging-Nutzen bei gesunden Erwachsenen', 'Historische Zulassungsdaten sind produkt- und indikationsbezogen'], sideEffects: [], contraindications: [], interactions: [],
      protocols: [{ id: 'dose-response', evidenceType: 'human', populationOrModel: 'Zehn erwachsene männliche Probanden', route: 'Intravenöser Bolus', amount: '1, 10 oder 100 µg; zusätzlich Kochsalz-Vergleich', frequency: 'Einzeltests in zufälliger Reihenfolge', duration: 'Hormonmessungen bis 2 Stunden nach Gabe', objective: 'Dosisabhängige GH-Antwort', outcome: '10 und 100 µg führten gegenüber Kochsalz zu signifikanten GH-Spitzen.', sourceIds: ['spoudeas-1994'] }],
    },
    en: {
      tldr: 'Sermorelin is a short GHRH analogue that stimulates growth hormone. It has a historical US approval as Geref; this does not validate anti-aging use of current compounded products.',
      mechanism: 'Sermorelin corresponds to the active GHRH fragment and stimulates GH release from a functioning pituitary.',
      researchAreas: ['GH secretion testing', 'Growth-hormone deficiency'],
      overviewFacts: [{ id: 'historical', label: 'Approval context', value: 'Historical Geref approval; not a blanket approval of current sermorelin products.', sourceIds: ['geref-history'] }],
      researchGaps: ['No established anti-aging benefit in healthy adults', 'Historical approval data are product- and indication-specific'], sideEffects: [], contraindications: [], interactions: [],
      protocols: [{ id: 'dose-response', evidenceType: 'human', populationOrModel: 'Ten adult male volunteers', route: 'Intravenous bolus', amount: '1, 10 or 100 µg; saline comparator', frequency: 'Single tests in random order', duration: 'Hormone measurements up to 2 hours after dosing', objective: 'Dose-dependent GH response', outcome: '10 and 100 µg produced significant GH peaks compared with saline.', sourceIds: ['spoudeas-1994'] }],
    },
  },
}
