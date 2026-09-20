// Merkt sich die letzte PDF-Auswahl (Muster + Häkchen + Sprache) pro User.

import type { PdfLang, SectionId } from './types'
import type { ActivePreset, PresetId } from './presets'
import { PRESETS } from './presets'
import { SECTION_ORDER } from './sections'

const STORAGE_PREFIX = 'tyd_pdf_export_prefs_'

export interface PdfExportPrefs {
  preset: ActivePreset
  sections: SectionId[]
  lang: PdfLang
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`
}

function isPresetId(v: unknown): v is PresetId {
  return typeof v === 'string' && PRESETS.some(p => p.id === v)
}

function isActivePreset(v: unknown): v is ActivePreset {
  return v === 'custom' || isPresetId(v)
}

function isPdfLang(v: unknown): v is PdfLang {
  return v === 'de' || v === 'en'
}

function isSectionId(v: unknown): v is SectionId {
  return typeof v === 'string' && (SECTION_ORDER as string[]).includes(v)
}

export function loadPdfExportPrefs(userId: string): PdfExportPrefs | null {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PdfExportPrefs>
    if (!isActivePreset(parsed.preset) || !isPdfLang(parsed.lang) || !Array.isArray(parsed.sections)) {
      return null
    }
    const sections = parsed.sections.filter(isSectionId)
    return { preset: parsed.preset, lang: parsed.lang, sections }
  } catch {
    return null
  }
}

export function savePdfExportPrefs(userId: string, prefs: PdfExportPrefs): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs))
  } catch {
    // Quota / private mode — still usable without persistence
  }
}
