import type { PeptideCategory, ResearchStatus, EvidenceLevel, ClinicalLevel } from './content/types'

// ─── Display helpers ──────────────────────────────────────────────────────────

// i18n-Keys statt fester Strings — Komponenten übersetzen via t(CATEGORY_LABEL_KEYS[cat])
export const CATEGORY_LABEL_KEYS: Record<PeptideCategory, string> = {
  heilung:          'plib_cat_heilung',
  wachstumshormon:  'plib_cat_wachstumshormon',
  nootropikum:      'plib_cat_nootropikum',
  stoffwechsel:     'plib_cat_stoffwechsel',
  anti_aging:       'plib_cat_anti_aging',
  sexualgesundheit: 'plib_cat_sexualgesundheit',
}

export const CATEGORY_COLORS: Record<PeptideCategory, { text: string; topBorder: string; scoreDot: string }> = {
  heilung:          { text: 'text-sky-300',     topBorder: 'border-t-sky-500',     scoreDot: 'bg-sky-400' },
  wachstumshormon:  { text: 'text-violet-300',  topBorder: 'border-t-violet-500',  scoreDot: 'bg-violet-400' },
  nootropikum:      { text: 'text-indigo-300',  topBorder: 'border-t-indigo-500',  scoreDot: 'bg-indigo-400' },
  stoffwechsel:     { text: 'text-emerald-300', topBorder: 'border-t-emerald-500', scoreDot: 'bg-emerald-400' },
  anti_aging:       { text: 'text-amber-300',   topBorder: 'border-t-amber-500',   scoreDot: 'bg-amber-400' },
  sexualgesundheit: { text: 'text-rose-300',    topBorder: 'border-t-rose-500',    scoreDot: 'bg-rose-400' },
}

export const STATUS_LABEL_KEYS: Record<ResearchStatus, string> = {
  preclinical: 'plib_status_preclinical',
  phase_1:     'plib_status_phase_1',
  phase_2:     'plib_status_phase_2',
  human_research: 'plib_status_human_research',
  historical_approval: 'plib_status_historical_approval',
  approved:    'plib_status_approved',
}

export const STATUS_STYLES: Record<ResearchStatus, string> = {
  preclinical: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',
  phase_1:     'bg-blue-500/15 text-blue-300 border border-blue-500/25',
  phase_2:     'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  human_research: 'bg-blue-500/15 text-blue-300 border border-blue-500/25',
  historical_approval: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
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

// Human-readable evidence labels (i18n keys)
export const EVIDENCE_LABEL_KEYS: Record<EvidenceLevel | ClinicalLevel, string> = {
  none:      'plib_ev_none',
  limited:   'plib_ev_limited',
  sparse:    'plib_ev_sparse',
  moderate:  'plib_ev_moderate',
  strong:    'plib_ev_strong',
  extensive: 'plib_ev_extensive',
}

// Confidence label key derived from evidence_score
export function getConfidenceLabelKey(score: number): string {
  if (score >= 8) return 'plib_conf_high'
  if (score >= 5) return 'plib_conf_moderate'
  if (score >= 3) return 'plib_conf_low'
  return 'plib_conf_very_limited'
}

export function getConfidenceStyle(score: number): string {
  if (score >= 8) return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
  if (score >= 5) return 'text-amber-300 bg-amber-500/10 border-amber-500/25'
  if (score >= 3) return 'text-orange-300 bg-orange-500/10 border-orange-500/25'
  return 'text-rose-300 bg-rose-500/10 border-rose-500/25'
}
