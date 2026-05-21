# The Lab Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign "The Lab" page into a professional Research Dashboard with auto-loaded trending studies, a Recharts bar chart per peptide, a bottom-sheet filter panel, and a three-tier article layout (Hero → 2-column Grid → compact Mini List).

**Architecture:** TheLab.tsx is split into 5 focused files — a shared API module (`pubmed.ts`), three UI component files (`ArticleCards.tsx`, `PeptideChart.tsx`, `FilterSheet.tsx`), and the rewritten page coordinator (`TheLab.tsx`). All data fetching stays in `pubmed.ts`; components are purely presentational.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS v3 (existing tokens: `.card`, `.btn-primary`, `.btn-secondary`, `.input`, `.label`) + Recharts (already installed) + CORS proxy `corsproxy.io`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/pages/lab/pubmed.ts` | Create | All PubMed API calls, types, filter logic |
| `src/pages/lab/ArticleCards.tsx` | Create | ArticleHero, ArticleGridCard, ArticleMiniItem |
| `src/pages/lab/PeptideChart.tsx` | Create | LabStats: 3 stat tiles + Recharts bar chart |
| `src/pages/lab/FilterSheet.tsx` | Create | Bottom-sheet filter panel |
| `src/pages/TheLab.tsx` | Rewrite | Page coordinator: state, layout, orchestration |

---

## Task 1: Create `src/pages/lab/pubmed.ts`

**Files:**
- Create: `src/pages/lab/pubmed.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p "src/pages/lab"
```

- [ ] **Step 2: Write `src/pages/lab/pubmed.ts`**

```typescript
// src/pages/lab/pubmed.ts

const CORS_PROXY = 'https://corsproxy.io/?'
const EUTILS_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
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

export interface FilterState {
  peptides: string[]
  sort: SortMode
  year: YearFilter
}

export const DEFAULT_FILTER_STATE: FilterState = {
  peptides: [],
  sort: 'date',
  year: 'all',
}

// ── Filter helpers ─────────────────────────────────────────────────────────────

export function countActiveFilters(f: FilterState): number {
  let n = 0
  if (f.peptides.length > 0) n++
  if (f.sort !== 'date') n++
  if (f.year !== 'all') n++
  return n
}

const YEAR_CLAUSE: Record<YearFilter, string> = {
  all: '',
  '2024plus': ' AND ("2024"[PDat] : "3000"[PDat])',
  '2025': ' AND "2025"[PDat]',
}

export function buildQuery(textQuery: string, filters: FilterState): string {
  const yearClause = YEAR_CLAUSE[filters.year]

  if (textQuery.trim()) {
    return textQuery.trim() + yearClause
  }

  const peptideClause =
    filters.peptides.length > 0
      ? filters.peptides.map(p => `"${p}"`).join(' OR ')
      : TRENDING_QUERY

  return peptideClause + yearClause
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
  return `${CORS_PROXY}${encodeURIComponent(url.toString())}`
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
  sort = 'date',
): Promise<PubMedArticle[]> {
  const ids = await fetchIds(query, retmax, sort)
  if (ids.length === 0) return []
  const [summaries, abstracts] = await Promise.all([fetchSummaries(ids), fetchAbstracts(ids)])
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

export async function fetchChartCounts(): Promise<ChartEntry[]> {
  const results = await Promise.allSettled(
    CHART_PEPTIDES.map(async ({ name, query, color }) => {
      const url = buildEutilsUrl('esearch.fcgi', {
        db: 'pubmed', term: query, retmax: '0', retmode: 'json',
      })
      const data = await fetchJson<ESearchResponse>(url)
      const count = parseInt(data.esearchresult?.count ?? '0', 10)
      return { name, count, color } satisfies ChartEntry
    }),
  )
  return results
    .filter((r): r is PromiseFulfilledResult<ChartEntry> => r.status === 'fulfilled')
    .map(r => r.value)
    .sort((a, b) => b.count - a.count)
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Unbekannter Fehler beim Laden der PubMed-Daten.'
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors for the new file (TheLab.tsx will fail until Task 5, that's OK — focus on pubmed.ts having no type errors).

- [ ] **Step 4: Commit**

```bash
git add src/pages/lab/pubmed.ts
git commit -m "feat(lab): extract PubMed API module with filter types and chart counts"
```

---

## Task 2: Create `src/pages/lab/ArticleCards.tsx`

**Files:**
- Create: `src/pages/lab/ArticleCards.tsx`

- [ ] **Step 1: Write `src/pages/lab/ArticleCards.tsx`**

```tsx
// src/pages/lab/ArticleCards.tsx
import { useState } from 'react'
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import type { PubMedArticle } from './pubmed'

// ── Peptide style map ──────────────────────────────────────────────────────────

const KNOWN_PEPTIDES = [
  'BPC-157', 'TB-500', 'Ipamorelin', 'CJC-1295', 'Selank', 'Epithalon',
  'Semaglutide', 'Tirzepatide', 'GLP-1',
]

const PEPTIDE_STYLES: Record<string, { tag: string; accent: string; bar: string }> = {
  'BPC-157':     { tag: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',         accent: 'border-l-sky-500',     bar: 'bg-sky-500' },
  'TB-500':      { tag: 'bg-violet-500/20 text-violet-400 border border-violet-500/30', accent: 'border-l-violet-500',  bar: 'bg-violet-500' },
  'Ipamorelin':  { tag: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', accent: 'border-l-emerald-500', bar: 'bg-emerald-500' },
  'CJC-1295':    { tag: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', accent: 'border-l-orange-500',  bar: 'bg-orange-500' },
  'Selank':      { tag: 'bg-pink-500/20 text-pink-400 border border-pink-500/30',       accent: 'border-l-pink-500',    bar: 'bg-pink-500' },
  'Epithalon':   { tag: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',    accent: 'border-l-amber-500',   bar: 'bg-amber-500' },
  'Semaglutide': { tag: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',       accent: 'border-l-teal-500',    bar: 'bg-teal-500' },
  'Tirzepatide': { tag: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30', accent: 'border-l-indigo-500',  bar: 'bg-indigo-500' },
  'GLP-1':       { tag: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',       accent: 'border-l-cyan-500',    bar: 'bg-cyan-500' },
}
const DEFAULT_STYLE = {
  tag: 'bg-slate-700/40 text-slate-400 border border-slate-700',
  accent: 'border-l-slate-600',
  bar: 'bg-slate-600',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function detectPeptide(title: string): string | null {
  const upper = title.toUpperCase()
  return KNOWN_PEPTIDES.find(p => upper.includes(p.toUpperCase())) ?? null
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return authors[0]
  return `${authors[0]} et al.`
}

function isRecent(pubdate: string): boolean {
  return /202[4-9]/.test(pubdate)
}

function getPeptideStyle(title: string) {
  const peptide = detectPeptide(title)
  return { peptide, style: peptide ? (PEPTIDE_STYLES[peptide] ?? DEFAULT_STYLE) : DEFAULT_STYLE }
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function PeptideTag({ peptide, style }: { peptide: string | null; style: typeof DEFAULT_STYLE }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[0.58rem] font-black uppercase tracking-wider ${style.tag}`}>
      {peptide ?? 'PEPTIDE'}
    </span>
  )
}

function NewBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[0.58rem] font-black uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/25">
      ✦ NEU
    </span>
  )
}

// ── ArticleHero ────────────────────────────────────────────────────────────────
// Full-width feature card. Shows first 320 chars of abstract with expand toggle.

export function ArticleHero({ article }: { article: PubMedArticle }) {
  const [expanded, setExpanded] = useState(false)
  const { peptide, style } = getPeptideStyle(article.title)
  const recent = isRecent(article.pubdate)
  const shouldCollapse = article.abstract.length > 320
  const visibleAbstract = article.abstract
    ? (expanded || !shouldCollapse ? article.abstract : `${article.abstract.slice(0, 320).trim()}…`)
    : 'Kein Abstract verfügbar.'

  return (
    <article className={`card border-l-[5px] ${style.accent} border-slate-800/60 mb-3`}>
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <PeptideTag peptide={peptide} style={style} />
        {recent && <NewBadge />}
        {article.pubdate && (
          <span className="ml-auto text-[0.6rem] text-slate-600 font-mono">{article.pubdate}</span>
        )}
      </div>

      <h2 className="text-base font-black text-white leading-snug mb-2">{article.title}</h2>

      {(article.authors.length > 0 || article.journal) && (
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 mb-3 text-xs text-slate-500">
          {article.authors.length > 0 && <span>{formatAuthors(article.authors)}</span>}
          {article.journal && <span className="text-sky-400/60">{article.journal}</span>}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-black/25 p-3 mb-3">
        <p className="text-[0.6rem] font-bold uppercase tracking-widest text-slate-600 mb-1.5">Abstract</p>
        <p className="text-sm text-slate-400 leading-relaxed">{visibleAbstract}</p>
        {shouldCollapse && (
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-sky-400/70 hover:text-sky-400 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Weniger' : 'Mehr lesen'}
          </button>
        )}
      </div>

      {article.link && (
        <a className="btn-primary w-full text-xs" href={article.link} target="_blank" rel="noreferrer">
          Auf PubMed öffnen <ExternalLink size={12} />
        </a>
      )}
    </article>
  )
}

// ── ArticleGridCard ────────────────────────────────────────────────────────────
// Compact card for 2-column grid (articles 1–4). No expand, short snippet.

export function ArticleGridCard({ article }: { article: PubMedArticle }) {
  const { peptide, style } = getPeptideStyle(article.title)
  const recent = isRecent(article.pubdate)
  const snippet = article.abstract ? `${article.abstract.slice(0, 110).trim()}…` : ''

  return (
    <article className={`card border-l-4 ${style.accent} border-slate-800/60 flex flex-col`}>
      <div className="flex flex-wrap gap-1 mb-2">
        <PeptideTag peptide={peptide} style={style} />
        {recent && <NewBadge />}
      </div>

      <h2 className="text-xs font-bold text-white leading-snug line-clamp-3 flex-1 mb-1.5">
        {article.title}
      </h2>

      {snippet && (
        <p className="text-[0.65rem] text-slate-500 leading-relaxed line-clamp-3 mb-2">{snippet}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-[0.6rem] text-slate-600 font-mono">{article.pubdate}</span>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="text-slate-600 hover:text-sky-400 transition-colors"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </article>
  )
}

// ── ArticleMiniItem ────────────────────────────────────────────────────────────
// Row-style item for compact list (articles 5+). No card wrapper, uses dividers.

export function ArticleMiniItem({ article }: { article: PubMedArticle }) {
  const { peptide, style } = getPeptideStyle(article.title)
  const recent = isRecent(article.pubdate)

  return (
    <div className="flex items-start gap-3 py-3 border-b border-slate-800/60 last:border-b-0">
      <div className={`w-[3px] self-stretch rounded-full shrink-0 ${style.bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <PeptideTag peptide={peptide} style={style} />
          {recent && <NewBadge />}
          <span className="ml-auto text-[0.6rem] text-slate-600 font-mono">{article.pubdate}</span>
        </div>
        <p className="text-xs font-semibold text-white leading-snug line-clamp-2">{article.title}</p>
        {article.authors.length > 0 && (
          <p className="text-[0.62rem] text-slate-600 mt-0.5">{formatAuthors(article.authors)}</p>
        )}
      </div>
      {article.link && (
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-slate-600 hover:text-sky-400 transition-colors mt-0.5"
        >
          <ExternalLink size={13} />
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors from `ArticleCards.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/lab/ArticleCards.tsx
git commit -m "feat(lab): add ArticleHero, ArticleGridCard, ArticleMiniItem components"
```

---

## Task 3: Create `src/pages/lab/PeptideChart.tsx`

**Files:**
- Create: `src/pages/lab/PeptideChart.tsx`

- [ ] **Step 1: Write `src/pages/lab/PeptideChart.tsx`**

```tsx
// src/pages/lab/PeptideChart.tsx
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts'
import type { ChartEntry } from './pubmed'

interface LabStatsProps {
  chartData: ChartEntry[]
  chartLoading: boolean
  totalFound: number
}

export function LabStats({ chartData, chartLoading, totalFound }: LabStatsProps) {
  const activePeptides = chartData.filter(e => e.count > 0).length
  const currentYear = new Date().getFullYear().toString()

  return (
    <div className="card mb-4">
      {/* Stat tiles */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 bg-black/25 rounded-xl p-3 text-center">
          <div className="text-lg font-black text-sky-400">
            {totalFound > 0 ? totalFound : '—'}
          </div>
          <div className="text-[0.55rem] uppercase tracking-[0.1em] text-slate-600 mt-0.5">
            Treffer
          </div>
        </div>
        <div className="flex-1 bg-black/25 rounded-xl p-3 text-center">
          <div className="text-lg font-black text-emerald-400">
            {chartLoading ? '…' : activePeptides || '—'}
          </div>
          <div className="text-[0.55rem] uppercase tracking-[0.1em] text-slate-600 mt-0.5">
            Peptide
          </div>
        </div>
        <div className="flex-1 bg-black/25 rounded-xl p-3 text-center">
          <div className="text-lg font-black text-orange-400">{currentYear}</div>
          <div className="text-[0.55rem] uppercase tracking-[0.1em] text-slate-600 mt-0.5">
            Aktuell
          </div>
        </div>
      </div>

      {/* Chart label */}
      <p className="label mb-3">Studien pro Peptid (PubMed)</p>

      {/* Loading skeleton */}
      {chartLoading && (
        <div className="space-y-2">
          {[90, 65, 50, 38, 28, 20, 14, 9].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-[72px] h-2.5 bg-slate-800 rounded animate-pulse" />
              <div
                className="h-2.5 bg-slate-800 rounded animate-pulse"
                style={{ width: `${w}%` }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {!chartLoading && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={chartData.length * 28 + 10}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 0, right: 32, top: 0, bottom: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={72}
              tick={{ fill: '#465265', fontSize: 10, fontFamily: 'inherit' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              contentStyle={{
                background: '#0e1428',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                fontSize: 11,
                padding: '6px 10px',
              }}
              itemStyle={{ color: '#9aaabf' }}
              labelStyle={{ color: '#eaeefc', fontWeight: 700 }}
              formatter={(value: number) => [`${value.toLocaleString('de-DE')} Studien`, '']}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={12}>
              {chartData.map(entry => (
                <Cell key={entry.name} fill={entry.color} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Empty */}
      {!chartLoading && chartData.length === 0 && (
        <p className="text-xs text-slate-600 text-center py-3">Keine Chart-Daten verfügbar</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors from `PeptideChart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/lab/PeptideChart.tsx
git commit -m "feat(lab): add LabStats component with Recharts horizontal bar chart"
```

---

## Task 4: Create `src/pages/lab/FilterSheet.tsx`

**Files:**
- Create: `src/pages/lab/FilterSheet.tsx`

- [ ] **Step 1: Write `src/pages/lab/FilterSheet.tsx`**

```tsx
// src/pages/lab/FilterSheet.tsx
import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { FilterState, SortMode, YearFilter } from './pubmed'

const ALL_PEPTIDES = [
  'BPC-157', 'TB-500', 'Ipamorelin', 'CJC-1295',
  'Semaglutide', 'Tirzepatide', 'Selank', 'Epithalon',
]

interface FilterSheetProps {
  open: boolean
  filters: FilterState
  resultCount: number
  onClose: () => void
  onChange: (filters: FilterState) => void
  onApply: () => void
}

export function FilterSheet({
  open,
  filters,
  resultCount,
  onClose,
  onChange,
  onApply,
}: FilterSheetProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  function togglePeptide(p: string) {
    const next = filters.peptides.includes(p)
      ? filters.peptides.filter(x => x !== p)
      : [...filters.peptides, p]
    onChange({ ...filters, peptides: next })
  }

  function reset() {
    onChange({ peptides: [], sort: 'date', year: 'all' })
  }

  return (
    <>
      {/* Backdrop — backdrop-filter is safe here (not a scrollable container) */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Sheet panel — NO backdrop-filter on this element or its children */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-700/60 border-b-0 rounded-t-2xl pointer-events-auto shadow-card">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-8 h-1 bg-slate-700 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-slate-800">
            <h2 className="text-sm font-black text-white">Filter & Sortierung</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable content — NO backdrop-filter here (breaks overflow-y on iOS Safari) */}
          <div className="overflow-y-auto max-h-[55vh] px-4 py-4 space-y-5">
            {/* Peptid */}
            <div>
              <p className="label">Peptid (Mehrfach)</p>
              <div className="flex flex-wrap gap-2">
                {ALL_PEPTIDES.map(p => {
                  const active = filters.peptides.includes(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePeptide(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        active
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sortieren */}
            <div>
              <p className="label">Sortieren</p>
              <div className="flex gap-2">
                {(['date', 'relevance'] as SortMode[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange({ ...filters, sort: s })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                      filters.sort === s
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {s === 'date' ? 'Neueste' : 'Relevanz'}
                  </button>
                ))}
              </div>
            </div>

            {/* Jahr */}
            <div>
              <p className="label">Erscheinungsjahr</p>
              <div className="flex gap-2">
                {(['all', '2024plus', '2025'] as YearFilter[]).map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onChange({ ...filters, year: y })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                      filters.year === y
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {y === 'all' ? 'Alle' : y === '2024plus' ? '2024+' : '2025'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-4 py-4 border-t border-slate-800">
            <button type="button" className="btn-secondary flex-1 text-sm" onClick={reset}>
              Zurücksetzen
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              style={{ flex: 2 }}
              onClick={() => {
                onApply()
                onClose()
              }}
            >
              Anzeigen ({resultCount})
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors from `FilterSheet.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/lab/FilterSheet.tsx
git commit -m "feat(lab): add FilterSheet bottom-sheet with peptide, sort, year filters"
```

---

## Task 5: Rewrite `src/pages/TheLab.tsx`

**Files:**
- Modify: `src/pages/TheLab.tsx` (full rewrite — replaces current content)

- [ ] **Step 1: Write new `src/pages/TheLab.tsx`**

```tsx
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

  // Auto-load on mount — trending articles + chart counts in parallel
  useEffect(() => {
    searchPubMedArticles(TRENDING_QUERY, 10)
      .then(setArticles)
      .catch(err => setErrorMessage(getErrorMessage(err)))
      .finally(() => setLoading(false))

    fetchChartCounts()
      .then(setChartData)
      .finally(() => setChartLoading(false))
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
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run dev server and verify in browser**

```bash
npm run dev
```

Open `http://localhost:5173` → navigate to "The Lab". Verify:
- Page loads with spinner, then shows articles
- Chart section shows skeleton while loading, then fills in with bars
- Quick filter chips work (click BPC-157 → new search)
- Filter button (⚙) opens bottom sheet from below
- Selecting peptides/sort/year in sheet → hit "Anzeigen" → results update
- Active filter chips appear and can be removed with ×
- Hero article is large, grid cards are 2-column, mini list is compact

- [ ] **Step 4: Commit**

```bash
git add src/pages/TheLab.tsx
git commit -m "feat(lab): rewrite TheLab as professional research dashboard"
```

---

## Self-Review

**Spec coverage:**
- ✅ Research Dashboard layout (Hero + Grid + Mini) — Task 5
- ✅ Balkendiagramm pro Peptid (Recharts) — Task 3
- ✅ Bottom-Sheet-Filter (Peptid, Sort, Jahr) — Task 4
- ✅ Active filter chips with × removal — Task 5
- ✅ Filter badge count on filter button — Task 5
- ✅ Quick filter chips — Task 5
- ✅ Auto-load trending on mount — Task 5
- ✅ CORS proxy via corsproxy.io — Task 1
- ✅ No backdrop-filter on scrollable container — Task 4 (comment in code)
- ✅ App design tokens (.card, .btn-primary, .input, .label) — all tasks

**Placeholder scan:** No TBD, TODO, or incomplete steps found.

**Type consistency:**
- `FilterState`, `SortMode`, `YearFilter` defined in Task 1, used in Tasks 4 and 5 ✅
- `ChartEntry` defined in Task 1, used in Tasks 3 and 5 ✅
- `PubMedArticle` defined in Task 1, used in Tasks 2 and 5 ✅
- `buildQuery(textQuery, filters)` — 2 params — consistent across Tasks 1 and 5 ✅
- `searchPubMedArticles(query, retmax, sort)` — consistent across Tasks 1 and 5 ✅
- `LabStats({ chartData, chartLoading, totalFound })` — consistent across Tasks 3 and 5 ✅
- `FilterSheet({ open, filters, resultCount, onClose, onChange, onApply })` — consistent across Tasks 4 and 5 ✅
- `ArticleHero`, `ArticleGridCard`, `ArticleMiniItem` each take `{ article: PubMedArticle }` — consistent ✅
