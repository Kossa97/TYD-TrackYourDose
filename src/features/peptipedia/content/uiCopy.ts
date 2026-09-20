import type { EvidenceMatrix, IdentityStatus, PeptipediaLocale, ProtocolEvidenceType, SourceKind } from './types'

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
  evidence: {
    heading: string
    note: string
    dimensions: Record<'identity' | 'human' | 'replication' | 'endpoints' | 'safety' | 'approval', string>
    identity: Record<IdentityStatus, string>
    human: Record<EvidenceMatrix['human'], string>
    replication: Record<EvidenceMatrix['replication'], string>
    endpoints: Record<EvidenceMatrix['endpoints'], string>
    safety: Record<EvidenceMatrix['safety'], string>
    noApproval: string
  }
  identityWarning: Record<Exclude<IdentityStatus, 'confirmed'>, { title: string; explanation: string }>
  sources: {
    kind: Record<SourceKind, string>
    accessed: string
    catalogueNote: string
  }
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
      list: 'Zu diesem Punkt sind hier noch keine geprüften Angaben hinterlegt. Das bedeutet nicht, dass keine Risiken oder Gegenanzeigen bestehen.',
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
    evidence: {
      heading: 'Evidenzmatrix',
      note: 'Die Dimensionen werden getrennt dargestellt und nicht zu einem Gesamtscore verdichtet.',
      dimensions: {
        identity: 'Molekülidentität',
        human: 'Humanforschung',
        replication: 'Replikation',
        endpoints: 'Klinische Endpunkte',
        safety: 'Sicherheit',
        approval: 'Zulassung',
      },
      identity: { confirmed: 'Bestätigt', ambiguous: 'Teilweise geklärt', brand_or_blend: 'Produkt- oder blendabhängig', complex_mixture: 'Komplexe Mischung' },
      human: { none: 'Keine', very_limited: 'Sehr begrenzt', limited: 'Begrenzt', moderate: 'Moderat', strong: 'Stark' },
      replication: { none: 'Keine unabhängige Replikation', single_group: 'Einzelne Arbeitsgruppe', multiple_groups: 'Mehrere unabhängige Gruppen', systematic: 'Systematische Evidenz' },
      endpoints: { none: 'Keine klinischen Endpunkte', surrogate: 'Surrogatwerte', symptom_or_function: 'Symptom- oder funktionsbezogen', hard_outcome: 'Harte patientenrelevante Endpunkte' },
      safety: { insufficient: 'Nicht ausreichend untersucht', limited: 'Begrenzt beschrieben', characterized: 'Durch Fachinformation oder umfangreiche Studien beschrieben' },
      noApproval: 'Keine belegte Zulassung',
    },
    identityWarning: {
      ambiguous: { title: 'Identität nicht bestätigt', explanation: 'Der Name kann unterschiedliche Stoff- oder Produktformen bezeichnen.' },
      brand_or_blend: { title: 'Handels- oder Blendidentität', explanation: 'Der Name beschreibt ein quellenabhängiges Produkt oder eine Mischung, keinen standardisierten Einzelstoff.' },
      complex_mixture: { title: 'Komplexe Mischung', explanation: 'Dies ist eine Mischung aus mehreren Bestandteilen, kein einzelnes chemisch definiertes Peptid.' },
    },
    sources: {
      kind: {
        approved_label: 'Fachinformation', human_study: 'Humanstudie', systematic_review: 'Systematische Übersichtsarbeit',
        animal_study: 'Tierstudie', laboratory_study: 'Laborstudie', regulator: 'Behördenquelle', registry: 'Studienregister',
        manufacturer: 'Herstellerinformation', catalog: 'Katalog / Zusammensetzung', government_news: 'Regierungsmitteilung',
      },
      accessed: 'Abgerufen',
      catalogueNote: 'Katalog- oder Zusammensetzungsquelle — keine Studie',
    },
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
      list: 'No reviewed information on this point has been recorded here yet. This does not mean there are no risks or contraindications.',
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
    evidence: {
      heading: 'Evidence matrix',
      note: 'The dimensions are presented separately and are not combined into an overall score.',
      dimensions: {
        identity: 'Molecular identity',
        human: 'Human research',
        replication: 'Replication',
        endpoints: 'Clinical endpoints',
        safety: 'Safety',
        approval: 'Approval',
      },
      identity: { confirmed: 'Confirmed', ambiguous: 'Partially clarified', brand_or_blend: 'Product- or blend-specific', complex_mixture: 'Complex mixture' },
      human: { none: 'None', very_limited: 'Very limited', limited: 'Limited', moderate: 'Moderate', strong: 'Strong' },
      replication: { none: 'No independent replication', single_group: 'Single research group', multiple_groups: 'Multiple independent groups', systematic: 'Systematic evidence' },
      endpoints: { none: 'No clinical endpoints', surrogate: 'Surrogate measures', symptom_or_function: 'Symptom- or function-related', hard_outcome: 'Hard patient-relevant outcomes' },
      safety: { insufficient: 'Not adequately studied', limited: 'Limited characterization', characterized: 'Characterized by prescribing information or extensive studies' },
      noApproval: 'No documented approval',
    },
    identityWarning: {
      ambiguous: { title: 'Identity not confirmed', explanation: 'The name may refer to different substance or product forms.' },
      brand_or_blend: { title: 'Brand or blend identity', explanation: 'The name describes a source-specific product or mixture, not a standardized single substance.' },
      complex_mixture: { title: 'Complex mixture', explanation: 'This is a multi-component mixture, not one chemically defined peptide.' },
    },
    sources: {
      kind: {
        approved_label: 'Prescribing information', human_study: 'Human study', systematic_review: 'Systematic review',
        animal_study: 'Animal study', laboratory_study: 'Laboratory study', regulator: 'Regulatory source', registry: 'Study registry',
        manufacturer: 'Manufacturer information', catalog: 'Catalogue / composition', government_news: 'Government news',
      },
      accessed: 'Accessed',
      catalogueNote: 'Catalogue or composition source — not a study',
    },
  },
}
