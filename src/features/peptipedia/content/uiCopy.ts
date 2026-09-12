import type { PeptipediaLocale, ProtocolEvidenceType } from './types'

export interface PeptipediaUiCopy {
  navigation: { home: string; library: string; backToLibrary: string }
  tabs: Record<'overview' | 'mechanism' | 'protocols' | 'calculator' | 'safety' | 'sources', string>
  headings: {
    researchAreas: string
    researchGaps: string
    sideEffects: string
    contraindications: string
    interactions: string
    studyDetails: string
  }
  protocolEvidence: Record<ProtocolEvidenceType, string>
  empty: { protocols: string; list: string }
  calculator: {
    vialAmount: string
    diluent: string
    targetDose: string
    targetUnit: string
    syringeCapacity: string
    syringeUnits: string
    calculate: string
    result: string
    disclaimer: string
  }
  disclaimer: string
  notFound: { title: string; text: string }
  reviewed: string
  source: string
}

export const PEPTIPEDIA_UI_COPY: Record<PeptipediaLocale, PeptipediaUiCopy> = {
  de: {
    navigation: { home: 'Startseite', library: 'Peptipedia', backToLibrary: 'Zurück zur Peptipedia' },
    tabs: {
      overview: 'Überblick',
      mechanism: 'Wirkung',
      protocols: 'Studienprotokolle',
      calculator: 'Rechner',
      safety: 'Sicherheit',
      sources: 'Quellen',
    },
    headings: {
      researchAreas: 'Untersuchte Bereiche',
      researchGaps: 'Offene Forschungsfragen',
      sideEffects: 'Berichtete Nebenwirkungen',
      contraindications: 'Gegenanzeigen und Warnhinweise',
      interactions: 'Wechselwirkungen',
      studyDetails: 'So wurde untersucht',
    },
    protocolEvidence: {
      approved_label: 'Zugelassene Fachinformation',
      human: 'Humanstudie',
      animal: 'Tierstudie – nicht auf Menschen übertragbar',
      laboratory: 'Laborstudie – keine Anwendung am Menschen',
    },
    empty: {
      protocols: 'Keine ausreichend belegten, exakt zitierbaren Studienprotokolle hinterlegt.',
      list: 'Dazu liegen in den ausgewerteten Quellen keine belastbaren Angaben vor.',
    },
    calculator: {
      vialAmount: 'Wirkstoff im Vial',
      diluent: 'Flüssigkeitsmenge',
      targetDose: 'Eigene Zielmenge',
      targetUnit: 'Einheit der Zielmenge',
      syringeCapacity: 'Spritzenvolumen',
      syringeUnits: 'Skaleneinheiten der Spritze',
      calculate: 'Berechnen',
      result: 'Rechenergebnis',
      disclaimer: 'Reine Umrechnung deiner Eingaben. Keine Dosierungs- oder Anwendungsempfehlung.',
    },
    disclaimer: 'Peptipedia ordnet Forschung und Fachinformationen ein. Die Inhalte ersetzen keine medizinische Beratung und sind keine Aufforderung zur Anwendung.',
    notFound: { title: 'Peptid nicht gefunden', text: 'Dieses Profil ist nicht veröffentlicht oder die Adresse ist falsch.' },
    reviewed: 'Quellenstand',
    source: 'Quelle',
  },
  en: {
    navigation: { home: 'Home', library: 'Peptipedia', backToLibrary: 'Back to Peptipedia' },
    tabs: {
      overview: 'Overview',
      mechanism: 'Mechanism',
      protocols: 'Study protocols',
      calculator: 'Calculator',
      safety: 'Safety',
      sources: 'Sources',
    },
    headings: {
      researchAreas: 'Research areas',
      researchGaps: 'Research gaps',
      sideEffects: 'Reported adverse effects',
      contraindications: 'Contraindications and warnings',
      interactions: 'Interactions',
      studyDetails: 'How it was studied',
    },
    protocolEvidence: {
      approved_label: 'Approved prescribing information',
      human: 'Human study',
      animal: 'Animal study — not transferable to humans',
      laboratory: 'Laboratory study — not a human-use protocol',
    },
    empty: {
      protocols: 'No sufficiently supported, exactly citable study protocols are available.',
      list: 'The reviewed sources do not provide reliable information on this point.',
    },
    calculator: {
      vialAmount: 'Amount in vial',
      diluent: 'Diluent volume',
      targetDose: 'Your target amount',
      targetUnit: 'Target unit',
      syringeCapacity: 'Syringe capacity',
      syringeUnits: 'Syringe scale units',
      calculate: 'Calculate',
      result: 'Calculation result',
      disclaimer: 'Arithmetic based only on your entries. Not a dose or use recommendation.',
    },
    disclaimer: 'Peptipedia explains research and prescribing information. It does not replace medical advice and is not an invitation to use a substance.',
    notFound: { title: 'Peptide not found', text: 'This profile is not published or the address is incorrect.' },
    reviewed: 'Sources checked',
    source: 'Source',
  },
}
