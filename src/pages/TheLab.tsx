// src/pages/TheLab.tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
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
import { LabHero } from './lab/LabHero'
import { ResearchSnapshot } from './lab/ResearchSnapshot'
import { StudyFeed } from './lab/StudyFeed'
import { FilterSheet } from './lab/FilterSheet'
import { LabLoader } from '../components/LabLoader'
import { ResearchDisclaimer } from '../components/ui/DesignSystem'

export function TheLab() {
  const { t } = useTranslation()

  const [articles, setArticles]               = useState<PubMedArticle[]>([])
  const [chartData, setChartData]             = useState<ChartEntry[]>([])
  const [loading, setLoading]                 = useState(true)
  const [errorMessage, setErrorMessage]       = useState<string | null>(null)
  const [isTrending, setIsTrending]           = useState(true)
  const [lastQuery, setLastQuery]             = useState('')
  const [filters, setFilters]                 = useState<FilterState>(DEFAULT_FILTER_STATE)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Initial loader state — full-screen on first visit only
  const [initialLoad, setInitialLoad]         = useState(true)
  const [loaderFading, setLoaderFading]       = useState(false)

  // Auto-load on mount — articles first, chart after (NCBI rate limit: 3 req/sec)
  useEffect(() => {
    searchPubMedArticles(TRENDING_QUERY, 10)
      .then(setArticles)
      .catch(err => setErrorMessage(getErrorMessage(err)))
      .finally(() => {
        setLoading(false)
        // Fade out the full-screen loader, then unmount it
        setLoaderFading(true)
        setTimeout(() => setInitialLoad(false), 500)
        fetchChartCounts()
          .then(setChartData)
          .catch(() => { /* chart errors are non-fatal */ })
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

  function handleHeroSearch(query: string) {
    void runSearch(query, filters)
  }

  function handleSidebarFilter(newFilters: FilterState) {
    setFilters(newFilters)
    void runSearch(lastQuery, newFilters)
  }

  function handleSheetApply() {
    void runSearch(lastQuery, filters)
  }

  const activeFilterCount = countActiveFilters(filters)

  return (
    <>
      {/* Full-screen loader — only on initial page load */}
      {initialLoad && <LabLoader fadingOut={loaderFading} />}

      <div className="space-y-4">
        <ResearchDisclaimer
          title={t('lab_disclaimer_title')}
          body={t('lab_disclaimer_body')}
        />

        {/* Cinematic Hero */}
        <LabHero onSearch={handleHeroSearch} loading={loading} />

        {/* Research Snapshot */}
        <ResearchSnapshot
          chartData={chartData}
          articles={articles}
          onSearch={query => void runSearch(query, filters)}
        />

        {/* Mobile filter button */}
        <div className="flex items-center justify-between mb-4 md:hidden">
          <span className="text-xs text-slate-500">
            {isTrending ? t('lab_trending_mobile') : `„${lastQuery}"`}
          </span>
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className={`relative btn-secondary text-xs px-3 py-2 ${
              activeFilterCount > 0 ? 'border-sky-500/50 text-sky-400' : ''
            }`}
          >
            {t('lab_filter_button')}
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-sky-500 text-[0.55rem] font-black text-white flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Study Feed */}
        <StudyFeed
          articles={articles}
          filters={filters}
          onSidebarFilter={handleSidebarFilter}
          loading={loading}
          errorMessage={errorMessage}
          isTrending={isTrending}
          lastQuery={lastQuery}
          onRetry={() => void runSearch(lastQuery, filters)}
        />

        {/* Mobile Bottom Sheet Filter */}
        <FilterSheet
          open={filterSheetOpen}
          filters={filters}
          resultCount={articles.length}
          onClose={() => setFilterSheetOpen(false)}
          onChange={setFilters}
          onApply={handleSheetApply}
        />
      </div>
    </>
  )
}
