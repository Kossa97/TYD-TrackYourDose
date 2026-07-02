// Datenmodell für den PDF-Protokoll-Generator.
// Bewusst entkoppelt von den UI-Typen in Protokoll.tsx: der Generator lädt
// seine Daten eigenständig (loadProtocolData) und braucht mehr Spalten
// (Dosis/Methode/Frequenz der Zyklen), als die Dashboard-Ansicht selbst nutzt.

export type PdfLang = 'de' | 'en'

export interface PdfDateRange {
  from: string // yyyy-MM-dd
  to: string   // yyyy-MM-dd
}

export interface PdfProfile {
  display_name: string | null
  username: string | null
  age: number | null
  gender: string | null
  height_cm: number | null
  weight_kg: number | null
}

export interface PdfCycle {
  id: string
  name: string
  peptide_name: string | null
  dose: number | null
  unit: string | null
  method: string | null
  frequency: string | null
  start_date: string
  end_date: string | null
  active: boolean
}

export interface PdfDoseLog {
  peptide_id: string | null
  logged_at: string
  taken: boolean | null
}

export interface PdfWeightLog {
  logged_at: string
  weight_kg: number
}

export interface PdfBloodwork {
  tested_at: string
  marker: string
  value: number | string
  unit: string | null
}

export interface PdfEffect {
  type: 'effect' | 'side_effect'
  description: string
  severity: number
  peptide_name: string | null
  occurred_at: string
}

export interface PdfReview {
  peptide_name: string | null
  rating: number
  experience: 'gut' | 'mittel' | 'schlecht' | null
}

export interface PdfDailyLog {
  log_date: string
  energie: number | null
  schlaf: number | null
  libido: number | null
}

/** Alles, was der Renderer für ein vollständiges Protokoll braucht. */
export interface ProtocolData {
  profile: PdfProfile | null
  cycles: PdfCycle[]           // aktive + abgeschlossene, aktive zuerst
  doseLogs: PdfDoseLog[]
  weightLogs: PdfWeightLog[]
  bloodwork: PdfBloodwork[]
  effects: PdfEffect[]
  reviews: PdfReview[]
  dailyLogs: PdfDailyLog[]
  peptideNames: Map<string, string> // peptide_id -> name (für Adherence pro Peptid)
}

export type SectionId =
  | 'personal'
  | 'summary'
  | 'cycles'
  | 'adherence'
  | 'bloodwork'
  | 'weight'
  | 'wellness'
  | 'effects'
  | 'reviews'
  | 'notes'

export interface PdfBuildOptions {
  lang: PdfLang
  range: PdfDateRange
  sections: SectionId[]   // vom Nutzer gewählte Reihenfolge ist fix (siehe SECTION_ORDER)
  note: string            // Freitext für die "Notizen / Fragen"-Sektion
}
