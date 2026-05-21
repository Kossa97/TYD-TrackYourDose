// src/services/peptideLibrary.ts
// Liest die wissenschaftliche Peptid-Referenzdatenbank aus Supabase.
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

export interface PeptideEntry {
  id: string
  slug: string
  name: string
  full_name: string | null
  category: PeptideCategory
  tldr: string
  mechanism: string
  benefits: string[]
  research_dosage: string | null
  half_life: string | null
  administration: string[]
  research_status: ResearchStatus
  side_effects: string[]
  contraindications: string[]
  pubmed_query: string | null
  sort_order: number
  created_at: string
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

export const CATEGORY_STYLES: Record<PeptideCategory, { icon: string; color: string; border: string }> = {
  heilung:          { icon: '🩹', color: 'text-sky-300',     border: 'border-t-sky-500' },
  wachstumshormon:  { icon: '📈', color: 'text-violet-300',  border: 'border-t-violet-500' },
  nootropikum:      { icon: '🧠', color: 'text-indigo-300',  border: 'border-t-indigo-500' },
  stoffwechsel:     { icon: '⚡',  color: 'text-emerald-300', border: 'border-t-emerald-500' },
  anti_aging:       { icon: '⏳', color: 'text-amber-300',   border: 'border-t-amber-500' },
  sexualgesundheit: { icon: '💊', color: 'text-rose-300',    border: 'border-t-rose-500' },
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
