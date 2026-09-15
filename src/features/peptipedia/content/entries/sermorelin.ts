import type { PeptipediaEntry } from '../types'
import { PEPTIPEDIA_EDITORIAL_POLICY } from '../editorialPolicy'

export const sermorelin: PeptipediaEntry = {
  slug: 'sermorelin', name: 'Sermorelin', fullName: 'GHRH(1–29)-NH₂', category: 'wachstumshormon', researchStatus: 'historical_approval',
  identity: { status: 'confirmed', description: { de: 'Sermorelin ist GHRH(1–29)-NH₂; historische Geref-Arzneimittel enthielten Sermorelinacetat. Heutige Rezepturen sind nicht automatisch diese Produkte.', en: 'Sermorelin is GHRH(1–29)-NH₂; historical Geref medicines contained sermorelin acetate. Current compounded preparations are not automatically those products.' } },
  evidenceMatrix: { human: 'moderate', replication: 'multiple_groups', endpoints: 'surrogate', safety: 'limited' },
  editorialReview: PEPTIPEDIA_EDITORIAL_POLICY,
  evidence: { human: 'moderate', animal: 'moderate', clinical: 'moderate' }, reviewedAt: '2026-09-14', contentVersion: 2,
  sources: [
    { id: 'geref-history', kind: 'regulator', title: 'FDA historical Geref (sermorelin acetate) approval documents', publisherOrAuthors: 'U.S. Food and Drug Administration', year: 1991, accessedAt: '2026-09-14', url: 'https://www.accessdata.fda.gov/drugsatfda_docs/nda/pre96/019863_S001_GEREF.pdf' },
    { id: 'spoudeas-1994', kind: 'human_study', title: 'Low-dose growth hormone-releasing hormone tests: a dose-response study', publisherOrAuthors: 'U.S. National Library of Medicine (PubMed)', year: 1994, accessedAt: '2026-09-14', url: 'https://pubmed.ncbi.nlm.nih.gov/7921207/', doi: '10.1530/eje.0.1310238' },
  ],
  mechanismSourceIds: ['spoudeas-1994'],
  safetySourceIds: ['geref-history'],
  copy: {
    de: {
      tldr: 'Sermorelin ist ein kurzes GHRH-Analogon zur Stimulation von Wachstumshormon. Es hat eine historische US-Zulassung als Geref; diese bestätigt keine Anti-Aging-Anwendung heutiger Rezepturprodukte.',
      mechanism: 'Sermorelin entspricht dem aktiven GHRH-Fragment und stimuliert die GH-Freisetzung aus einer funktionsfähigen Hypophyse.',
      researchAreas: ['Diagnostik der GH-Sekretion', 'Wachstumshormonmangel'],
      overviewFacts: [{ id: 'historical', label: 'Zulassungsstatus einordnen', value: 'Historische Geref-Zulassung; keine pauschale Zulassung heutiger Sermorelin-Produkte.', sourceIds: ['geref-history'] }],
      researchGaps: ['Kein etablierter Anti-Aging-Nutzen bei gesunden Erwachsenen', 'Historische Zulassungsdaten sind produkt- und indikationsbezogen'], sideEffects: ['Historische Geref-Daten ersetzen keine Sicherheitsbewertung heutiger Rezepturen oder langfristiger Anti-Aging-Anwendung.'], contraindications: ['Gegenanzeigen sind für diese Anwendung mangels ausreichender Daten nicht zuverlässig bestimmt.'], interactions: ['Wechselwirkungen sind für die hier beschriebenen Forschungs- oder Produktformen nicht ausreichend untersucht.'],
      protocols: [],
    },
    en: {
      tldr: 'Sermorelin is a short GHRH analogue that stimulates growth hormone. It has a historical US approval as Geref; this does not validate anti-aging use of current compounded products.',
      mechanism: 'Sermorelin corresponds to the active GHRH fragment and stimulates GH release from a functioning pituitary.',
      researchAreas: ['GH secretion testing', 'Growth-hormone deficiency'],
      overviewFacts: [{ id: 'historical', label: 'Approval context', value: 'Historical Geref approval; not a blanket approval of current sermorelin products.', sourceIds: ['geref-history'] }],
      researchGaps: ['No established anti-aging benefit in healthy adults', 'Historical approval data are product- and indication-specific'], sideEffects: ['Historical Geref data do not establish safety for current compounded products or long-term anti-aging use.'], contraindications: ['Contraindications for this use cannot be reliably determined from the available data.'], interactions: ['Interactions for the research or product forms described here have not been adequately studied.'],
      protocols: [],
    },
  },
}
