// src/pages/lab/pubmed.ts

// In development: route through Vite's proxy (/ncbi → eutils.ncbi.nlm.nih.gov)
// This bypasses browser CORS issues on home networks.
// In production (Vercel): call NCBI directly — no proxy needed.
const EUTILS_BASE_URL = import.meta.env.DEV
  ? '/ncbi'
  : 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const PUBMED_ARTICLE_BASE_URL = 'https://pubmed.ncbi.nlm.nih.gov'

export const TRENDING_QUERY =
  'BPC-157 OR TB-500 OR Ipamorelin OR "CJC-1295" OR Semaglutide OR Tirzepatide OR Selank OR Epithalon OR "growth hormone releasing peptide" OR "peptide therapy" OR "bioactive peptide"'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PubMedArticle {
  id: string
  title: string
  authors: string[]
  journal: string
  pubdate: string
  abstract: string
  link: string
}

export interface ChartEntry {
  name: string
  count: number
  color: string
}

export type SortMode = 'date' | 'relevance'
export type YearFilter = 'all' | '2024plus' | '2025'
export type StudyTypeFilter = '' | 'human' | 'animal' | 'meta' | 'clinical'

export interface FilterState {
  peptides: string[]
  sort: SortMode
  year: YearFilter
  studyType: StudyTypeFilter
}

export const DEFAULT_FILTER_STATE: FilterState = {
  peptides: [],
  sort: 'date',
  year: 'all',
  studyType: '',
}

// ── Filter helpers ─────────────────────────────────────────────────────────────

export function countActiveFilters(f: FilterState): number {
  let n = 0
  if (f.peptides.length > 0) n++
  if (f.sort !== 'date') n++
  if (f.year !== 'all') n++
  if (f.studyType !== '') n++
  return n
}

const YEAR_CLAUSE: Record<YearFilter, string> = {
  all: '',
  '2024plus': ' AND ("2024"[PDat] : "3000"[PDat])',
  '2025': ' AND "2025"[PDat]',
}

const STUDY_TYPE_CLAUSE: Record<StudyTypeFilter, string> = {
  '':       '',
  human:    ' AND human[MeSH]',
  animal:   ' AND (rat[MeSH] OR mouse[MeSH] OR animal[MeSH Terms])',
  meta:     ' AND (systematic review[pt] OR meta-analysis[pt])',
  clinical: ' AND clinical trial[pt]',
}

export function buildQuery(textQuery: string, filters: FilterState): string {
  const yearClause      = YEAR_CLAUSE[filters.year]
  const studyTypeClause = STUDY_TYPE_CLAUSE[filters.studyType]

  if (textQuery.trim()) {
    return textQuery.trim() + yearClause + studyTypeClause
  }

  const peptideClause =
    filters.peptides.length > 0
      ? filters.peptides.map(p => `"${p}"`).join(' OR ')
      : TRENDING_QUERY

  return peptideClause + yearClause + studyTypeClause
}

// ── Chart config ───────────────────────────────────────────────────────────────

export const CHART_PEPTIDES: Array<{ name: string; query: string; color: string }> = [
  { name: 'Semaglutide', query: 'Semaglutide',  color: '#0ea5e9' },
  { name: 'BPC-157',     query: 'BPC-157',       color: '#8b5cf6' },
  { name: 'TB-500',      query: 'TB-500',         color: '#10b981' },
  { name: 'Ipamorelin',  query: 'Ipamorelin',    color: '#f97316' },
  { name: 'CJC-1295',    query: '"CJC-1295"',    color: '#f59e0b' },
  { name: 'Selank',      query: 'Selank',         color: '#ec4899' },
  { name: 'Epithalon',   query: 'Epithalon',      color: '#06b6d4' },
  { name: 'Tirzepatide', query: 'Tirzepatide',   color: '#6366f1' },
]

// ── Internal fetch primitives ──────────────────────────────────────────────────

function buildEutilsUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${EUTILS_BASE_URL}/${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`PubMed request failed: ${response.status}`)
  return response.json() as Promise<T>
}

interface ESearchResponse {
  esearchresult?: { idlist?: string[]; count?: string }
}
interface ESummaryArticle {
  title?: string
  authors?: Array<{ name?: string }>
  fulljournalname?: string
  source?: string
  pubdate?: string
}
type ESummaryResult = { uids?: string[] } & Record<string, ESummaryArticle | string[] | undefined>
interface ESummaryResponse { result?: ESummaryResult }

async function fetchIds(query: string, retmax: number, sort: string): Promise<string[]> {
  const url = buildEutilsUrl('esearch.fcgi', {
    db: 'pubmed', term: query, retmax: String(retmax), sort, retmode: 'json',
  })
  const data = await fetchJson<ESearchResponse>(url)
  return data.esearchresult?.idlist ?? []
}

async function fetchSummaries(ids: string[]): Promise<Map<string, ESummaryArticle>> {
  const url = buildEutilsUrl('esummary.fcgi', { db: 'pubmed', id: ids.join(','), retmode: 'json' })
  const data = await fetchJson<ESummaryResponse>(url)
  const map = new Map<string, ESummaryArticle>()
  for (const id of ids) {
    const s = data.result?.[id]
    if (s && !Array.isArray(s)) map.set(id, s)
  }
  return map
}

async function fetchAbstracts(ids: string[]): Promise<Map<string, string>> {
  const url = buildEutilsUrl('efetch.fcgi', { db: 'pubmed', id: ids.join(','), retmode: 'xml' })
  const response = await fetch(url, { headers: { Accept: 'application/xml' } })
  if (!response.ok) throw new Error(`PubMed efetch failed: ${response.status}`)
  const xml = await response.text()
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('PubMed efetch returned invalid XML')
  }
  const abstracts = new Map<string, string>()
  for (const article of doc.querySelectorAll('PubmedArticle')) {
    const uid = article.querySelector('PMID')?.textContent?.trim()
    if (!uid) continue
    const parts = Array.from(article.querySelectorAll('AbstractText'))
      .map(node => {
        const text = node.textContent?.replace(/\s+/g, ' ').trim()
        if (!text) return ''
        const label = node.getAttribute('Label')?.trim()
        return label ? `${label}: ${text}` : text
      })
      .filter(Boolean)
    abstracts.set(uid, parts.join('\n\n'))
  }
  return abstracts
}

// ── Public API ─────────────────────────────────────────────────────────────────

export async function searchPubMedArticles(
  query: string,
  retmax = 6,
  sort: SortMode = 'date',
): Promise<PubMedArticle[]> {
  const ids = await fetchIds(query, retmax, sort)
  if (ids.length === 0) return []
  const [summaries, abstracts] = await Promise.all([
    fetchSummaries(ids),
    fetchAbstracts(ids).catch(() => new Map<string, string>()),
  ])
  return ids
    .map(uid => {
      const s = summaries.get(uid)
      return {
        id: uid,
        title: s?.title ?? '',
        authors: s?.authors?.map(a => a.name?.trim() ?? '').filter(Boolean) ?? [],
        journal: s?.fulljournalname ?? s?.source ?? '',
        pubdate: s?.pubdate ?? '',
        abstract: abstracts.get(uid) ?? '',
        link: `${PUBMED_ARTICLE_BASE_URL}/${uid}/`,
      }
    })
    .filter(a => Boolean(a.title))
}

// Sequential with delay to stay within NCBI's 3 req/sec rate limit
export async function fetchChartCounts(): Promise<ChartEntry[]> {
  const results: ChartEntry[] = []
  for (const { name, query, color } of CHART_PEPTIDES) {
    await new Promise(resolve => setTimeout(resolve, 400))
    try {
      const url = buildEutilsUrl('esearch.fcgi', {
        db: 'pubmed', term: query, retmax: '0', retmode: 'json',
      })
      const data = await fetchJson<ESearchResponse>(url)
      const count = parseInt(data.esearchresult?.count ?? '0', 10)
      results.push({ name, count, color })
    } catch {
      // skip failed peptide, show rest of chart
    }
  }
  return results.sort((a, b) => b.count - a.count)
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unbekannter Fehler beim Laden der PubMed-Daten.'
}
