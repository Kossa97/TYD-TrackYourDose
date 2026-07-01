// src/pages/PeptideLibrary.tsx
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FlaskConical, Search, Settings, SlidersHorizontal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getAllPeptides } from '../services/peptideLibrary'
import type { PeptideEntry, PeptideCategory, ResearchStatus } from '../services/peptideLibrary'
import { PeptideCard, PeptideCardSkeleton } from './lab/PeptideCard'

// ─── Filter/Sort types ────────────────────────────────────────────────────────

type SortKey = 'sort_order' | 'name_asc' | 'name_desc' | 'score_desc' | 'score_asc'

interface Filters {
  category:      PeptideCategory | 'all'
  status:        ResearchStatus  | 'all'
  humanEvidence: 'all' | 'yes' | 'strong'
  tag:           string
}

const DEFAULT_FILTERS: Filters = {
  category:      'all',
  status:        'all',
  humanEvidence: 'all',
  tag:           '',
}

const SORT_OPTIONS: Array<{ value: SortKey; labelKey: string }> = [
  { value: 'sort_order',  labelKey: 'plib_sort_default' },
  { value: 'score_desc',  labelKey: 'plib_sort_evidence_desc' },
  { value: 'score_asc',   labelKey: 'plib_sort_evidence_asc' },
  { value: 'name_asc',    labelKey: 'plib_sort_name_asc' },
  { value: 'name_desc',   labelKey: 'plib_sort_name_desc' },
]

const CATEGORIES: Array<{ value: PeptideCategory | 'all'; labelKey: string }> = [
  { value: 'all',              labelKey: 'plib_all' },
  { value: 'heilung',          labelKey: 'plib_cat_s_heilung' },
  { value: 'wachstumshormon',  labelKey: 'plib_cat_wachstumshormon' },
  { value: 'stoffwechsel',     labelKey: 'plib_cat_stoffwechsel' },
  { value: 'nootropikum',      labelKey: 'plib_cat_nootropikum' },
  { value: 'anti_aging',       labelKey: 'plib_cat_anti_aging' },
]

// ─── Pill Button ─────────────────────────────────────────────────────────────

function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
        active
          ? 'bg-sky-500 border-transparent text-white'
          : 'border-white/10 text-slate-400 hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-400'
      }`}
    >
      {children}
    </button>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function PeptideLibrary() {
  const { t }                         = useTranslation()
  const navigate                      = useNavigate()
  const [peptides, setPeptides]       = useState<PeptideEntry[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [query, setQuery]             = useState('')
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS)
  const [sort, setSort]               = useState<SortKey>('sort_order')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    getAllPeptides()
      .then(setPeptides)
      .catch(err => setError(err instanceof Error && err.message ? err.message : ''))
      .finally(() => setLoading(false))
  }, [])

  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    peptides.forEach(p => (p.tags ?? []).forEach(t => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [peptides])

  // Count active filters
  const activeFilterCount = [
    filters.category !== 'all',
    filters.status   !== 'all',
    filters.humanEvidence !== 'all',
    filters.tag      !== '',
    sort             !== 'sort_order',
  ].filter(Boolean).length

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = [...peptides]

    // Text search
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.tldr.toLowerCase().includes(q) ||
        (p.full_name ?? '').toLowerCase().includes(q) ||
        (p.tags ?? []).some(t => t.toLowerCase().includes(q))
      )
    }

    // Category
    if (filters.category !== 'all') list = list.filter(p => p.category === filters.category)

    // Status
    if (filters.status !== 'all') list = list.filter(p => p.research_status === filters.status)

    // Human evidence
    if (filters.humanEvidence === 'yes') {
      list = list.filter(p => p.evidence_human !== 'none')
    } else if (filters.humanEvidence === 'strong') {
      list = list.filter(p => p.evidence_human === 'strong' || p.evidence_human === 'moderate')
    }

    // Tag
    if (filters.tag) {
      list = list.filter(p => (p.tags ?? []).includes(filters.tag))
    }

    // Sort
    list.sort((a, b) => {
      if (sort === 'score_desc') return b.evidence_score - a.evidence_score
      if (sort === 'score_asc')  return a.evidence_score - b.evidence_score
      if (sort === 'name_asc')   return a.name.localeCompare(b.name)
      if (sort === 'name_desc')  return b.name.localeCompare(a.name)
      return a.sort_order - b.sort_order
    })

    return list
  }, [peptides, query, filters, sort])

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
    setSort('sort_order')
    setQuery('')
  }

  return (
    <div>
      {/* Hero */}
      <div className="relative -mx-4 px-4 pb-8 pt-6 mb-5 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#070B11] to-transparent pointer-events-none" />
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={() => navigate('/lab')}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              <ArrowLeft size={12} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>The Lab</span>
            </button>
            <button type="button" onClick={() => navigate('/lab/admin')}
              className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-violet-400 transition-colors" title="Admin">
              <Settings size={13} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>Admin</span>
            </button>
          </div>

          <p className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-sky-400/65 mb-2"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t('plib_hero_kicker')}</p>
          <h1 className="text-3xl font-black text-white mb-1 leading-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Peptipedia</h1>
          <p className="text-sm text-slate-400 mb-5">{t('plib_hero_sub')}</p>

          {/* Search + Filter toggle */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder={t('plib_search_placeholder')}
                className="w-full bg-[#0B1220] border border-white/10 rounded-xl pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-300 focus:border-sky-500/50 focus:shadow-[0_0_20px_rgba(0,204,245,0.08)]" />
            </div>
            <button type="button" onClick={() => setShowFilters(f => !f)}
              className={`flex items-center gap-1.5 px-4 rounded-xl border text-sm transition-all duration-200 ${
                showFilters || activeFilterCount > 0
                  ? 'bg-sky-500 border-transparent text-white'
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
              }`}>
              <SlidersHorizontal size={14} />
              {activeFilterCount > 0 && <span className="text-xs font-black">{activeFilterCount}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter Panel ──────────────────────────────────────────────────────── */}
      {showFilters && (
        <div className="bg-[#0B1220] border border-white/[0.07] rounded-2xl p-4 mb-4 space-y-4">

          {/* Sort */}
          <div>
            <p className="text-[0.52rem] uppercase tracking-widest text-slate-600 mb-2"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t('plib_sort_label')}</p>
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map(o => (
                <Pill key={o.value} active={sort === o.value} onClick={() => setSort(o.value)}>
                  {t(o.labelKey)}
                </Pill>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-[0.52rem] uppercase tracking-widest text-slate-600 mb-2"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t('plib_category_label')}</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(c => (
                <Pill key={c.value} active={filters.category === c.value}
                  onClick={() => setFilters(f => ({ ...f, category: c.value }))}>
                  {t(c.labelKey)}
                </Pill>
              ))}
            </div>
          </div>

          {/* Research Status */}
          <div>
            <p className="text-[0.52rem] uppercase tracking-widest text-slate-600 mb-2"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t('plib_status_label')}</p>
            <div className="flex flex-wrap gap-2">
              {([['all', 'plib_all'], ['preclinical', 'plib_status_preclinical'], ['phase_1', 'plib_status_phase_1'], ['phase_2', 'plib_status_phase_2'], ['approved', 'plib_status_approved']] as const).map(([val, labelKey]) => (
                <Pill key={val} active={filters.status === val}
                  onClick={() => setFilters(f => ({ ...f, status: val }))}>
                  {t(labelKey)}
                </Pill>
              ))}
            </div>
          </div>

          {/* Human Evidence */}
          <div>
            <p className="text-[0.52rem] uppercase tracking-widest text-slate-600 mb-2"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t('plib_human_evidence_label')}</p>
            <div className="flex flex-wrap gap-2">
              {([['all', 'plib_all'], ['yes', 'plib_human_yes'], ['strong', 'plib_human_strong']] as const).map(([val, labelKey]) => (
                <Pill key={val} active={filters.humanEvidence === val}
                  onClick={() => setFilters(f => ({ ...f, humanEvidence: val }))}>
                  {t(labelKey)}
                </Pill>
              ))}
            </div>
          </div>

          {/* Tags */}
          {allTags.length > 0 && (
            <div>
              <p className="text-[0.52rem] uppercase tracking-widest text-slate-600 mb-2"
                style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{t('plib_tags_label')}</p>
              <div className="flex flex-wrap gap-2">
                <Pill active={filters.tag === ''} onClick={() => setFilters(f => ({ ...f, tag: '' }))}>
                  {t('plib_all')}
                </Pill>
                {allTags.map(tag => (
                  <Pill key={tag} active={filters.tag === tag}
                    onClick={() => setFilters(f => ({ ...f, tag: f.tag === tag ? '' : tag }))}>
                    {tag}
                  </Pill>
                ))}
              </div>
            </div>
          )}

          {/* Reset */}
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetFilters}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-400 transition-colors">
              <X size={12} />
              {t('plib_reset_filters')}
            </button>
          )}
        </div>
      )}

      {/* ── Category quick tabs (if no filter panel) ─────────────────────────── */}
      {!showFilters && (
        <div className="flex gap-2 flex-wrap mb-4">
          {CATEGORIES.map(cat => (
            <Pill key={cat.value} active={filters.category === cat.value}
              onClick={() => setFilters(f => ({ ...f, category: cat.value }))}>
              {t(cat.labelKey)}
            </Pill>
          ))}
        </div>
      )}

      {/* Count */}
      {!loading && (
        <p className="text-[0.6rem] text-slate-700 mb-4"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
          {t('plib_count', { count: filtered.length })}
          {activeFilterCount > 0 && ` · ${t('plib_filtered')}`}
          {' · peptide_library'}
        </p>
      )}

      {/* Error */}
      {error !== null && (
        <div className="card border border-red-500/20 bg-red-950/20 text-center py-8">
          <p className="text-sm text-red-300 mb-3">{error || t('plib_load_error')}</p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <PeptideCardSkeleton key={i} />)
          : filtered.map(peptide => <PeptideCard key={peptide.id} peptide={peptide} />)
        }
      </div>

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-slate-600">
          <FlaskConical size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{t('plib_empty')}</p>
          {activeFilterCount > 0 && (
            <button type="button" onClick={resetFilters}
              className="mt-2 text-xs text-sky-400/60 hover:text-sky-400 transition-colors">
              {t('plib_reset_filters_short')}
            </button>
          )}
        </div>
      )}

      <div className="mt-8 flex items-start gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
        <FlaskConical size={14} className="text-amber-400/70 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300/60 leading-relaxed">
          {t('plib_disclaimer_list')}
        </p>
      </div>
    </div>
  )
}
