// src/services/peptideLibrary.ts
// Wissenschaftliche Peptid-Referenzdatenbank.
// Kein medizinischer Rat — nur Forschungsdaten.

import { supabase } from '../lib/supabase'

// ─── Types ───────────────────────────────────────────────────────────────────

export type PeptideCategory =
  | 'heilung'
  | 'wachstumshormon'
  | 'nootropikum'
  | 'stoffwechsel'
  | 'anti_aging'
  | 'sexualgesundheit'

export type ResearchStatus =
  | 'preclinical'
  | 'phase_1'
  | 'phase_2'
  | 'approved'

export type EvidenceLevel   = 'none' | 'limited' | 'moderate' | 'strong'
export type ClinicalLevel   = 'none' | 'sparse'  | 'moderate' | 'extensive'

export interface PeptideEntry {
  id:                string
  slug:              string
  name:              string
  full_name:         string | null
  category:          PeptideCategory
  tldr:              string
  mechanism:         string
  benefits:          string[]
  research_dosage:   string | null
  half_life:         string | null
  administration:    string[]
  research_status:   ResearchStatus
  side_effects:      string[]
  contraindications: string[]
  pubmed_query:      string | null
  tags:              string[]
  // Evidence breakdown (v2)
  evidence_human:    EvidenceLevel
  evidence_animal:   EvidenceLevel
  evidence_clinical: ClinicalLevel
  evidence_score:    number          // 1–10
  research_gaps:     string[]
  sort_order:        number
  created_at:        string
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<PeptideCategory, string> = {
  heilung:          'Heilung & Regeneration',
  wachstumshormon:  'Wachstumshormon',
  nootropikum:      'Nootropikum',
  stoffwechsel:     'Stoffwechsel',
  anti_aging:       'Anti-Aging',
  sexualgesundheit: 'Sexualgesundheit',
}

export const CATEGORY_COLORS: Record<PeptideCategory, { text: string; topBorder: string; scoreDot: string }> = {
  heilung:          { text: 'text-sky-300',     topBorder: 'border-t-sky-500',     scoreDot: 'bg-sky-400' },
  wachstumshormon:  { text: 'text-violet-300',  topBorder: 'border-t-violet-500',  scoreDot: 'bg-violet-400' },
  nootropikum:      { text: 'text-indigo-300',  topBorder: 'border-t-indigo-500',  scoreDot: 'bg-indigo-400' },
  stoffwechsel:     { text: 'text-emerald-300', topBorder: 'border-t-emerald-500', scoreDot: 'bg-emerald-400' },
  anti_aging:       { text: 'text-amber-300',   topBorder: 'border-t-amber-500',   scoreDot: 'bg-amber-400' },
  sexualgesundheit: { text: 'text-rose-300',    topBorder: 'border-t-rose-500',    scoreDot: 'bg-rose-400' },
}

export const STATUS_LABELS: Record<ResearchStatus, string> = {
  preclinical: 'Präklinisch',
  phase_1:     'Phase 1',
  phase_2:     'Phase 2',
  approved:    'Zugelassen',
}

export const STATUS_STYLES: Record<ResearchStatus, string> = {
  preclinical: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',
  phase_1:     'bg-blue-500/15 text-blue-300 border border-blue-500/25',
  phase_2:     'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  approved:    'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
}

// Evidence bar widths (CSS class)
export const EVIDENCE_BAR_WIDTH: Record<EvidenceLevel | ClinicalLevel, string> = {
  none:      'w-0',
  limited:   'w-1/4',
  sparse:    'w-1/4',
  moderate:  'w-1/2',
  strong:    'w-full',
  extensive: 'w-full',
}

// Human-readable evidence labels
export const EVIDENCE_LABELS: Record<EvidenceLevel | ClinicalLevel, string> = {
  none:      'Keine',
  limited:   'Begrenzt',
  sparse:    'Gering',
  moderate:  'Moderat',
  strong:    'Stark',
  extensive: 'Umfangreich',
}

// Confidence label derived from evidence_score
export function getConfidenceLabel(score: number): string {
  if (score >= 8) return 'Hohe Konfidenz'
  if (score >= 5) return 'Moderate Konfidenz'
  if (score >= 3) return 'Niedrige Konfidenz'
  return 'Sehr begrenzte Evidenz'
}

export function getConfidenceStyle(score: number): string {
  if (score >= 8) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
  if (score >= 5) return 'text-amber-300 bg-amber-500/10 border-amber-500/25'
  if (score >= 3) return 'text-orange-300 bg-orange-500/10 border-orange-500/25'
  return 'text-rose-300 bg-rose-500/10 border-rose-500/25'
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function getAllPeptides(): Promise<PeptideEntry[]> {
  const { data, error } = await supabase
    .from('peptide_library')
    .select('*')
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []) as PeptideEntry[]
}

export async function getPeptideBySlug(slug: string): Promise<PeptideEntry | null> {
  const { data, error } = await supabase
    .from('peptide_library')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) return null
  return data as PeptideEntry
}

export async function getPeptidesByCategory(category: PeptideCategory): Promise<PeptideEntry[]> {
  const { data, error } = await supabase
    .from('peptide_library')
    .select('*')
    .eq('category', category)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []) as PeptideEntry[]
}

export async function searchPeptides(query: string): Promise<PeptideEntry[]> {
  const { data, error } = await supabase
    .from('peptide_library')
    .select('*')
    .or(`name.ilike.%${query}%,tldr.ilike.%${query}%,full_name.ilike.%${query}%`)
    .order('sort_order')
  if (error) throw new Error(error.message)
  return (data ?? []) as PeptideEntry[]
}
