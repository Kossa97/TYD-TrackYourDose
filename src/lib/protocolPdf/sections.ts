// Section-Registry: Single Source of Truth für die Checkboxen im Auswahl-Modal
// UND die Render-Reihenfolge im PDF. hasData() bestimmt, ob eine Sektion
// überhaupt Inhalt hat (leere werden im Modal ausgegraut).

import type { ProtocolData, SectionId, PdfLang } from './types'

export interface SectionDef {
  id: SectionId
  label: Record<PdfLang, string>
  /** true, wenn im geladenen Zeitraum Inhalt vorhanden ist. */
  hasData: (data: ProtocolData) => boolean
  /** 'notes' ist immer wählbar (freier Text), auch ohne Daten. */
  alwaysAvailable?: boolean
}

function hasWellness(data: ProtocolData): boolean {
  return data.dailyLogs.some(l => l.energie != null || l.schlaf != null || l.libido != null)
}

// Reihenfolge hier = Reihenfolge im PDF.
export const SECTIONS: SectionDef[] = [
  {
    id: 'personal',
    label: { de: 'Persönliche Angaben', en: 'Personal details' },
    hasData: d => d.profile != null,
  },
  {
    id: 'summary',
    label: { de: 'Zusammenfassung', en: 'Summary' },
    hasData: d => d.cycles.length > 0 || d.doseLogs.some(l => l.taken != null) || d.weightLogs.length > 0,
  },
  {
    id: 'cycles',
    label: { de: 'Protokoll / Zyklen', en: 'Protocol / cycles' },
    hasData: d => d.cycles.length > 0,
  },
  {
    id: 'adherence',
    label: { de: 'Einnahmetreue', en: 'Adherence' },
    hasData: d => d.doseLogs.some(l => l.taken != null),
  },
  {
    id: 'bloodwork',
    label: { de: 'Blutwerte', en: 'Bloodwork' },
    hasData: d => d.bloodwork.length > 0,
  },
  {
    id: 'weight',
    label: { de: 'Gewichtsverlauf', en: 'Weight trend' },
    hasData: d => d.weightLogs.length > 0,
  },
  {
    id: 'wellness',
    label: { de: 'Wohlbefinden', en: 'Well-being' },
    hasData: hasWellness,
  },
  {
    id: 'effects',
    label: { de: 'Wirkungen & Nebenwirkungen', en: 'Effects & side effects' },
    hasData: d => d.effects.length > 0,
  },
  {
    id: 'reviews',
    label: { de: 'Bewertungen', en: 'Ratings' },
    hasData: d => d.reviews.length > 0,
  },
  {
    id: 'notes',
    label: { de: 'Notizen / Fragen', en: 'Notes / questions' },
    hasData: () => true,
    alwaysAvailable: true,
  },
]

export const SECTION_ORDER: SectionId[] = SECTIONS.map(s => s.id)

/** Vom Nutzer gewählte Sektionen, gefiltert auf die mit Inhalt, in PDF-Reihenfolge. */
export function visibleSections(selected: SectionId[], data: ProtocolData): SectionId[] {
  const chosen = new Set(selected)
  return SECTIONS
    .filter(s => chosen.has(s.id) && (s.alwaysAvailable || s.hasData(data)))
    .map(s => s.id)
}

/** Standard-Vorauswahl: alle Sektionen mit Daten (Notizen bleiben aus, da Freitext). */
export function defaultSelection(data: ProtocolData): SectionId[] {
  return SECTIONS.filter(s => !s.alwaysAvailable && s.hasData(data)).map(s => s.id)
}

/**
 * Betreff fürs Deckblatt. Ist "Persönliche Angaben" abgewählt, wird anonymisiert
 * ("Anonym"/"Anonymous") — so deckt das Weglassen der Sektion den Forum-Fall ab.
 */
export function resolveSubject(data: ProtocolData, includePersonal: boolean, lang: PdfLang): string {
  if (!includePersonal) return lang === 'de' ? 'Anonym' : 'Anonymous'
  const p = data.profile
  return (
    p?.display_name?.trim() ||
    p?.username?.trim() ||
    (lang === 'de' ? 'Anonym' : 'Anonymous')
  )
}
