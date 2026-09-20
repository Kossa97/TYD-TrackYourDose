import type { PeptideCategory, ResearchStatus } from './content/types'

// ─── Display helpers ──────────────────────────────────────────────────────────

// i18n-Keys statt fester Strings — Komponenten übersetzen via t(CATEGORY_LABEL_KEYS[cat])
export const CATEGORY_LABEL_KEYS: Record<PeptideCategory, string> = {
  grundlagen: 'plib_cat_grundlagen',
  heilung:          'plib_cat_heilung',
  wachstumshormon:  'plib_cat_wachstumshormon',
  nootropikum:      'plib_cat_nootropikum',
  stoffwechsel:     'plib_cat_stoffwechsel',
  anti_aging:       'plib_cat_anti_aging',
  sexualgesundheit: 'plib_cat_sexualgesundheit',
}

export const CATEGORY_COLORS: Record<PeptideCategory, { text: string; topBorder: string }> = {
  grundlagen: { text: 'text-slate-300', topBorder: 'border-t-slate-500' },
  heilung:          { text: 'text-sky-300',     topBorder: 'border-t-sky-500' },
  wachstumshormon:  { text: 'text-violet-300',  topBorder: 'border-t-violet-500' },
  nootropikum:      { text: 'text-indigo-300',  topBorder: 'border-t-indigo-500' },
  stoffwechsel:     { text: 'text-emerald-300', topBorder: 'border-t-emerald-500' },
  anti_aging:       { text: 'text-amber-300',   topBorder: 'border-t-amber-500' },
  sexualgesundheit: { text: 'text-rose-300',    topBorder: 'border-t-rose-500' },
}

export const STATUS_LABEL_KEYS: Record<ResearchStatus, string> = {
  unverified: 'plib_status_unverified',
  preclinical: 'plib_status_preclinical',
  phase_1:     'plib_status_phase_1',
  phase_2:     'plib_status_phase_2',
  human_research: 'plib_status_human_research',
  historical_approval: 'plib_status_historical_approval',
  approved:    'plib_status_approved',
}

export const STATUS_STYLES: Record<ResearchStatus, string> = {
  unverified: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',
  preclinical: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',
  phase_1:     'bg-blue-500/15 text-blue-300 border border-blue-500/25',
  phase_2:     'bg-violet-500/15 text-violet-300 border border-violet-500/25',
  human_research: 'bg-blue-500/15 text-blue-300 border border-blue-500/25',
  historical_approval: 'bg-amber-500/15 text-amber-300 border border-amber-500/25',
  approved:    'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25',
}
