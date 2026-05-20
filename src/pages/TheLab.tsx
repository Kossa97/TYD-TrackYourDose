import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, ExternalLink, FlaskConical, Loader2, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface PubMedArticle {
  id: string
  title: string
  authors: string[]
  journal: string
  pubdate: string
  abstract: string
  link: string
}

const QUICK_FILTERS = [
  { value: 'BPC-157', labelKey: 'lab_filter_bpc_157' },
  { value: 'TB-500', labelKey: 'lab_filter_tb_500' },
  { value: 'Ipamorelin', labelKey: 'lab_filter_ipamorelin' },
  { value: 'CJC-1295', labelKey: 'lab_filter_cjc_1295' },
  { value: 'Selank', labelKey: 'lab_filter_selank' },
  { value: 'Epithalon', labelKey: 'lab_filter_epithalon' },
]

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const context = 'context' in error ? (error as { context?: unknown }).context : null
    if (context instanceof Response) {
      return `${error.message} (${context.status} ${context.statusText})`
    }
    return error.message
  }

  if (typeof error === 'string') return error

  return 'Unexpected error while loading PubMed data.'
}

function pickString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

function normalizeAuthors(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(author => {
        if (typeof author === 'string') return author.trim()
        if (author && typeof author === 'object') {
          const record = author as Record<string, unknown>
          return pickString(record, ['name', 'fullName', 'full_name', 'lastname', 'lastName'])
        }
        return ''
      })
      .filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(/,\s*|;\s*/).map(author => author.trim()).filter(Boolean)
  }
  return []
}

function normalizeArticle(item: unknown, index: number): PubMedArticle | null {
  if (!item || typeof item !== 'object') return null

  const record = item as Record<string, unknown>
  const pmid = pickString(record, ['pmid', 'id', 'uid', 'pubmedId', 'pubmed_id'])
  const title = pickString(record, ['title', 'articleTitle', 'article_title', 'name'])
  const link = pickString(record, ['link', 'url', 'pubmedUrl', 'pubmed_url'])
  const abstract = pickString(record, ['abstract', 'abstractText', 'abstract_text', 'summary'])

  return {
    id: pmid || `${title}-${index}`,
    title,
    authors: normalizeAuthors(record.authors ?? record.authorList ?? record.author_list),
    journal: pickString(record, ['journal', 'source', 'journalTitle', 'journal_title', 'fulljournalname']),
    pubdate: pickString(record, ['pubdate', 'pubDate', 'publicationDate', 'publication_date', 'date']),
    abstract,
    link: link || (pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : ''),
  }
}

function normalizeResults(data: unknown) {
  const rawResults = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? (
        (data as Record<string, unknown>).results ??
        (data as Record<string, unknown>).articles ??
        (data as Record<string, unknown>).items ??
        []
      )
      : []

  if (!Array.isArray(rawResults)) return []
  return rawResults
    .map((item, index) => normalizeArticle(item, index))
    .filter((article): article is PubMedArticle => Boolean(article?.title))
}

export function TheLab() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [lastQuery, setLastQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [results, setResults] = useState<PubMedArticle[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const emptyStateText = useMemo(() => {
    if (!hasSearched) return t('lab_empty_initial')
    return t('lab_no_results', { query: lastQuery })
  }, [hasSearched, lastQuery, t])

  const runSearch = async (nextQuery = query) => {
    const searchQuery = nextQuery.trim()
    if (!searchQuery) {
      toast.error(t('lab_query_required'))
      return
    }

    setLoading(true)
    setErrorMessage(null)
    setHasSearched(true)
    setLastQuery(searchQuery)
    setExpanded(new Set())

    try {
      const { data, error } = await supabase.functions.invoke('pubmed', {
        body: { query: searchQuery, maxResults: 8 },
      })

      if (error) {
        throw error
      }

      if (data && typeof data === 'object') {
        const responseError = (data as Record<string, unknown>).error
        if (typeof responseError === 'string' && responseError.trim()) {
          throw new Error(responseError)
        }
      }

      setResults(normalizeResults(data))
    } catch (error) {
      console.error('PubMed search failed', error)
      setErrorMessage(getErrorMessage(error))
      toast.error(t('lab_search_failed'))
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActiveFilter('')
    void runSearch()
  }

  const handleQuickFilter = (value: string) => {
    setQuery(value)
    setActiveFilter(value)
    void runSearch(value)
  }

  const toggleExpanded = (id: string) => {
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
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

      <form onSubmit={handleSubmit} className="card mb-4">
        <label className="label" htmlFor="lab-search">{t('lab_search_label')}</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              id="lab-search"
              className="input pl-9 text-sm"
              placeholder={t('lab_search_placeholder')}
              value={query}
              disabled={loading}
              onChange={event => {
                setQuery(event.target.value)
                setActiveFilter('')
              }}
            />
          </div>
          <button className="btn-primary shrink-0" type="submit" disabled={loading}>
            {loading ? t('loading') : t('lab_search_button')}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2 mb-5">
        {QUICK_FILTERS.map(filter => (
          <button
            key={filter.value}
            type="button"
            onClick={() => handleQuickFilter(filter.value)}
            disabled={loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeFilter === filter.value ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {t(filter.labelKey)}
          </button>
        ))}
      </div>

      {loading && (
        <div className="card text-center py-10 text-slate-500">
          <Loader2 size={32} className="mx-auto mb-3 text-sky-400/60 animate-spin" />
          <p className="text-sm">{t('lab_loading_results')}</p>
        </div>
      )}

      {!loading && errorMessage && (
        <div
          className="card border border-red-500/30 bg-red-950/30"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={22} className="mt-0.5 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-100">{t('lab_search_failed')}</p>
              <p className="mt-1 break-words text-sm text-red-100/75">{errorMessage}</p>
              <button
                type="button"
                className="btn-secondary mt-4 text-sm"
                onClick={() => void runSearch(lastQuery)}
              >
                {t('lab_search_button')}
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !errorMessage && results.length === 0 && (
        <div className="card text-center py-10 text-slate-500">
          <BookOpen size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">{emptyStateText}</p>
        </div>
      )}

      {!loading && !errorMessage && results.length > 0 && (
        <div className="space-y-4">
          {results.map(article => {
            const isExpanded = expanded.has(article.id)
            const abstractText = article.abstract || t('lab_no_abstract')
            const shouldCollapse = abstractText.length > 260
            const visibleAbstract = isExpanded || !shouldCollapse
              ? abstractText
              : `${abstractText.slice(0, 260).trim()}...`

            return (
              <article key={article.id} className="card border border-sky-500/10">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-white font-semibold leading-snug">{article.title}</h2>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                      <span>{article.authors.length ? article.authors.join(', ') : t('lab_unknown_authors')}</span>
                      {article.journal && <span className="text-sky-400">{article.journal}</span>}
                      {article.pubdate && <span>{article.pubdate}</span>}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-black/20 p-3">
                  <p className="label mb-2">{t('lab_abstract_label')}</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{visibleAbstract}</p>
                  {shouldCollapse && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(article.id)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? t('lab_show_less') : t('lab_show_more')}
                    </button>
                  )}
                </div>

                {article.link && (
                  <a
                    className="btn-secondary mt-3 w-full text-sm"
                    href={article.link}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('lab_pubmed_link')} <ExternalLink size={14} />
                  </a>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
