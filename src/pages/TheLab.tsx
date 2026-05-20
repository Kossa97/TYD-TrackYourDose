import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { AlertTriangle, BookOpen, ChevronDown, ChevronUp, ExternalLink, FlaskConical, Loader2, Search } from 'lucide-react'

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

interface ESearchResponse {
  esearchresult?: {
    idlist?: string[]
  }
}

interface ESummaryArticle {
  uid?: string
  title?: string
  authors?: Array<{ name?: string }>
  fulljournalname?: string
  source?: string
  pubdate?: string
}

type ESummaryResult = {
  uids?: string[]
} & Record<string, ESummaryArticle | string[] | undefined>

interface ESummaryResponse {
  result?: ESummaryResult
}

const PROXY = 'https://api.allorigins.win/raw?url='
const EUTILS_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const PUBMED_ARTICLE_BASE_URL = 'https://pubmed.ncbi.nlm.nih.gov'

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

async function searchPubMedArticles(query: string): Promise<PubMedArticle[]> {
  const ids = await searchPubMedIds(query)

  if (ids.length === 0) {
    return []
  }

  const [summaries, abstracts] = await Promise.all([
    fetchPubMedSummaries(ids),
    fetchPubMedAbstracts(ids),
  ])

  return ids
    .map(uid => {
      const summary = summaries.get(uid)
      const journal = summary?.fulljournalname ?? summary?.source ?? ''
      const pubmedUrl = `${PUBMED_ARTICLE_BASE_URL}/${uid}/`

      return {
        id: uid,
        title: summary?.title ?? '',
        authors: extractAuthorNames(summary),
        journal,
        pubdate: summary?.pubdate ?? '',
        abstract: abstracts.get(uid) ?? '',
        link: pubmedUrl,
      }
    })
    .filter(article => Boolean(article.title))
}

async function searchPubMedIds(query: string): Promise<string[]> {
  const searchUrl = buildProxiedEutilsUrl('esearch.fcgi', {
    db: 'pubmed',
    term: query,
    retmax: '6',
    sort: 'date',
    retmode: 'json',
  })

  const data = await fetchJson<ESearchResponse>(searchUrl)

  return data.esearchresult?.idlist ?? []
}

async function fetchPubMedSummaries(ids: string[]): Promise<Map<string, ESummaryArticle>> {
  const url = buildProxiedEutilsUrl('esummary.fcgi', {
    db: 'pubmed',
    id: ids.join(','),
    retmode: 'json',
  })

  const data = await fetchJson<ESummaryResponse>(url)
  const summaries = new Map<string, ESummaryArticle>()

  for (const id of ids) {
    const summary = data.result?.[id]

    if (summary && !Array.isArray(summary)) {
      summaries.set(id, summary)
    }
  }

  return summaries
}

async function fetchPubMedAbstracts(ids: string[]): Promise<Map<string, string>> {
  const url = buildProxiedEutilsUrl('efetch.fcgi', {
    db: 'pubmed',
    id: ids.join(','),
    retmode: 'xml',
  })

  const response = await fetch(url, {
    headers: { Accept: 'application/xml' },
  })

  if (!response.ok) {
    throw new Error(`PubMed efetch request failed with status ${response.status}`)
  }

  const xml = await response.text()
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const abstracts = new Map<string, string>()

  for (const article of document.querySelectorAll('PubmedArticle')) {
    const uid = article.querySelector('PMID')?.textContent?.trim()

    if (!uid) {
      continue
    }

    const abstractParts = Array.from(article.querySelectorAll('AbstractText'))
      .map(node => {
        const text = node.textContent?.replace(/\s+/g, ' ').trim()

        if (!text) {
          return ''
        }

        const label = node.getAttribute('Label')?.trim()

        return label ? `${label}: ${text}` : text
      })
      .filter(Boolean)

    abstracts.set(uid, abstractParts.join('\n\n'))
  }

  return abstracts
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`PubMed request failed with status ${response.status}`)
  }

  return await response.json() as T
}

function buildProxiedEutilsUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${EUTILS_BASE_URL}/${path}`)

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  return `${PROXY}${encodeURIComponent(url.toString())}`
}

function extractAuthorNames(summary?: ESummaryArticle): string[] {
  return summary?.authors
    ?.map(author => author.name?.trim() ?? '')
    .filter(Boolean) ?? []
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
      const articles = await searchPubMedArticles(searchQuery)
      setResults(articles)
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
