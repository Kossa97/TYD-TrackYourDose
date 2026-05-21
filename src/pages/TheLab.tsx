// src/pages/TheLab.tsx
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import {
  AlertTriangle, BookOpen, Flame, FlaskConical,
  Loader2, Search, SlidersHorizontal,
} from 'lucide-react'
import {
  searchPubMedArticles,
  fetchChartCounts,
  buildQuery,
  countActiveFilters,
  getErrorMessage,
  TRENDING_QUERY,
  DEFAULT_FILTER_STATE,
} from './lab/pubmed'
import type { PubMedArticle, ChartEntry, FilterState } from './lab/pubmed'
import { LabStats } from './lab/PeptideChart'
import { FilterSheet } from './lab/FilterSheet'
import { ArticleHero, ArticleGridCard, ArticleMiniItem } from './lab/ArticleCards'

const QUICK_FILTERS = [
  { value: 'BPC-157',    labelKey: 'lab_filter_bpc_157' },
  { value: 'TB-500',     labelKey: 'lab_filter_tb_500' },
  { value: 'Ipamorelin', labelKey: 'lab_filter_ipamorelin' },
  { value: 'CJC-1295',   labelKey: 'lab_filter_cjc_1295' },
  { value: 'Selank',     labelKey: 'lab_filter_selank' },
  { value: 'Epithalon',  labelKey: 'lab_filter_epithalon' },
]

export function TheLab() {
  const { t } = useTranslation()

  const [query, setQuery]               = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [articles, setArticles]         = useState<PubMedArticle[]>([])
  const [chartData, setChartData]       = useState<ChartEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [chartLoading, setChartLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isTrending, setIsTrending]     = useState(true)
  const [lastQuery, setLastQuery]       = useState('')
  const [filters, setFilters]           = useState<FilterState>(DEFAULT_FILTER_STATE)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Auto-load on mount — articles first, chart after (NCBI rate limit: 3 req/sec)
  useEffect(() => {
    searchPubMedArticles(TRENDING_QUERY, 10)
      .then(setArticles)
      .catch(err => setErrorMessage(getErrorMessage(err)))
      .finally(() => {
        setLoading(false)
        // Start chart only after articles finished to avoid rate limiting
        fetchChartCounts()
          .then(setChartData)
          .finally(() => setChartLoading(false))
      })
  }, [])

  async function runSearch(textQuery: string, nextFilters: FilterState) {
    const finalQuery = buildQuery(textQuery, nextFilters)
    setLoading(true)
    setErrorMessage(null)
    setLastQuery(textQuery.trim() || 'Peptide')
    try {
      const results = await searchPubMedArticles(finalQuery, 10, nextFilters.sort)
      setArticles(results)
      setIsTrending(false)
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
      toast.error(t('lab_search_failed'))
      setArticles([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setActiveFilter('')
    void runSearch(query, filters)
  }

  const handleQuickFilter = (value: string) => {
    setQuery(value)
    setActiveFilter(value)
    void runSearch(value, filters)
  }

  const activeFilterCount = countActiveFilters(filters)

  const hero = articles[0]
  const grid = articles.slice(1, 5)
  const mini = articles.slice(5)

  return (
    <div>
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="mb-5 pt-1">
        <p className="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-sky-400/65 mb-1">
          {t('lab_kicker')}
        </p>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center glow-cyan-sm shrink-0">
            <FlaskConical size={20} className="text-sky-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-white leading-tight">{t('lab_title')}</h1>
            <p className="text-sm text-slate-500 mt-1">{t('lab_subtitle')}</p>
          </div>
        </div>
      </div>

      {/* ── Search Row ────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            className="input pl-9 text-sm"
            placeholder={t('lab_search_placeholder')}
            value={query}
            disabled={loading}
            onChange={e => {
              setQuery(e.target.value)
              setActiveFilter('')
            }}
          />
        </div>

        {/* Filter button with active-count badge */}
        <button
          type="button"
          onClick={() => setFilterSheetOpen(true)}
          className={`relative btn-secondary shrink-0 px-3 ${
            activeFilterCount > 0 ? 'border-sky-500/50 text-sky-400' : ''
          }`}
        >
          <SlidersHorizontal size={15} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-sky-500 text-[0.55rem] font-black text-white flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button className="btn-primary shrink-0" type="submit" disabled={loading}>
          {loading ? t('loading') : t('lab_search_button')}
        </button>
      </form>

      {/* ── Active filter chips ───────────────────────────────────── */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {filters.peptides.map(p => (
            <span
              key={p}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/25 text-sky-400 text-xs font-bold"
            >
              {p}
              <button
                type="button"
                className="hover:text-white transition-colors"
                onClick={() =>
                  setFilters(f => ({ ...f, peptides: f.peptides.filter(x => x !== p) }))
                }
              >
                ×
              </button>
            </span>
          ))}
          {filters.sort !== 'date' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/25 text-sky-400 text-xs font-bold">
              Relevanz
              <button
                type="button"
                className="hover:text-white transition-colors"
                onClick={() => setFilters(f => ({ ...f, sort: 'date' }))}
              >
                ×
              </button>
            </span>
          )}
          {filters.year !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/15 border border-sky-500/25 text-sky-400 text-xs font-bold">
              {filters.year === '2024plus' ? '2024+' : '2025'}
              <button
                type="button"
                className="hover:text-white transition-colors"
                onClick={() => setFilters(f => ({ ...f, year: 'all' }))}
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {/* ── Quick Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {QUICK_FILTERS.map(f => (
          <button
            key={f.value}
            type="button"
            disabled={loading}
            onClick={() => handleQuickFilter(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFilter === f.value
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </div>

      {/* ── Stats + Chart ─────────────────────────────────────────── */}
      <LabStats
        chartData={chartData}
        chartLoading={chartLoading}
        totalFound={articles.length}
      />

      {/* ── Loading ───────────────────────────────────────────────── */}
      {loading && (
        <div className="card text-center py-10 text-slate-500">
          <Loader2 size={32} className="mx-auto mb-3 text-sky-400/60 animate-spin" />
          <p className="text-sm">
            {isTrending ? 'Lade neueste Studien…' : t('lab_loading_results')}
          </p>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────── */}
      {!loading && errorMessage && (
        <div className="card border border-red-500/30 bg-red-950/30" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="mt-0.5 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-100">{t('lab_search_failed')}</p>
              <p className="mt-1 break-words text-sm text-red-100/75">{errorMessage}</p>
              <button
                type="button"
                className="btn-secondary mt-4 text-sm"
                onClick={() => void runSearch(query, filters)}
              >
                {t('lab_search_button')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Empty ────────────────────────────────────────────────── */}
      {!loading && !errorMessage && articles.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">
            {isTrending
              ? 'Keine Studien gefunden.'
              : t('lab_no_results', { query: lastQuery })}
          </p>
        </div>
      )}

      {/* ── Articles ─────────────────────────────────────────────── */}
      {!loading && !errorMessage && articles.length > 0 && (
        <div>
          {/* Section label */}
          <div className="flex items-end justify-between border-b border-white/[0.06] pb-2 mb-4">
            <div>
              {isTrending ? (
                <div className="flex items-center gap-1.5">
                  <Flame size={13} className="text-orange-400" />
                  <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-white">
                    Trending
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Search size={12} className="text-slate-500" />
                  <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-white">
                    „{lastQuery}"
                  </span>
                </div>
              )}
              <p className="text-[0.6rem] text-slate-600 mt-0.5">
                {isTrending
                  ? 'Neueste Peptid-Studien · PubMed'
                  : `${articles.length} Studien gefunden`}
              </p>
            </div>
            <span className="text-[0.6rem] text-slate-700 font-mono">pubmed.ncbi</span>
          </div>

          {/* Hero article — full width */}
          {hero && <ArticleHero article={hero} />}

          {/* Grid articles — 2 columns */}
          {grid.length > 0 && (
            <div className="grid grid-cols-2 gap-2.5 mb-3">
              {grid.map(a => (
                <ArticleGridCard key={a.id} article={a} />
              ))}
            </div>
          )}

          {/* Mini list — remaining articles */}
          {mini.length > 0 && (
            <div className="card">
              {mini.map(a => (
                <ArticleMiniItem key={a.id} article={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Filter Sheet ─────────────────────────────────────────── */}
      <FilterSheet
        open={filterSheetOpen}
        filters={filters}
        resultCount={articles.length}
        onClose={() => setFilterSheetOpen(false)}
        onChange={setFilters}
        onApply={() => void runSearch(query, filters)}
      />
    </div>
  )
}
