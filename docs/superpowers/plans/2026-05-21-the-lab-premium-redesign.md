# The Lab Premium Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely redesign "The Lab" into a premium biotech research terminal with cinematic hero, intelligence snapshot cards, premium study cards, desktop sticky sidebar, and a new study detail page at `/lab/study/:id`.

**Architecture:** 9 new files + 3 modified files. The API layer (`pubmed.ts`) is extended minimally (add `studyType` to `FilterState`). All new UI components are purely presentational. `TheLab.tsx` remains the state coordinator. `StudyDetail.tsx` is a new route that receives `PubMedArticle` data via React Router `state`.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS v3 + React Router v6 + lucide-react + Google Fonts CDN (Space Grotesk 700/900, IBM Plex Mono 700)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `index.html` | Modify | Add Google Fonts link tags |
| `src/App.tsx` | Modify | Add `/lab/study/:id` nested route |
| `src/pages/lab/pubmed.ts` | Modify | Add `studyType` to FilterState + buildQuery |
| `src/pages/lab/labUtils.ts` | Create | getEvidenceScore, getStudyType, getStudyTypeLabel, getEvidenceLabel, getEvidenceContext, getKeyFindings |
| `src/pages/lab/LabHero.tsx` | Create | Cinematic hero: dot-grid, search bar, quick tags |
| `src/pages/lab/ResearchSnapshot.tsx` | Create | 3 intelligence cards using existing chartData + articles |
| `src/pages/lab/StudyCard.tsx` | Create | Featured + compact card variants, navigate to detail |
| `src/pages/lab/StudySidebar.tsx` | Create | Desktop sticky filter sidebar (studyType, sort, year) |
| `src/pages/lab/StudyFeed.tsx` | Create | Desktop layout: sidebar + feed, section label |
| `src/pages/StudyDetail.tsx` | Create | Detail page route, reads article from router state |
| `src/pages/TheLab.tsx` | Rewrite | Coordinator: new layout, new handlers, same API calls |

---

## Task 1: Foundation — Fonts + New Route

**Files:**
- Modify: `index.html`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add Google Fonts to `index.html`**

Add inside `<head>`, before the closing tag:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/icon-192.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>TYD · Track Your Dose</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;900&family=IBM+Plex+Mono:wght@700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Add `/lab/study/:id` route to `src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { OnboardingProvider } from './context/OnboardingContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Layout } from './components/Layout'
import { Auth } from './pages/Auth'
import { Home } from './pages/Home'
import { Dashboard } from './pages/Dashboard'
import { Peptide } from './pages/Peptide'
import { Tagebuch } from './pages/Tagebuch'
import { Bewertungen } from './pages/Bewertungen'
import { Profil } from './pages/Profil'
import { PublicProfile } from './pages/PublicProfile'
import { FAQ } from './pages/FAQ'
import { Rechner } from './pages/Rechner'
import { TheLab } from './pages/TheLab'
import { StudyDetail } from './pages/StudyDetail'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OnboardingProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: { background: '#07091a', color: '#eaeefc', border: '1px solid rgba(0,204,245,0.15)' },
            }}
          />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/u/:username" element={<PublicProfile />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Home />} />
              <Route path="kalender" element={<Dashboard />} />
              <Route path="peptide" element={<Peptide />} />
              <Route path="lab" element={<TheLab />} />
              <Route path="lab/study/:id" element={<StudyDetail />} />
              <Route path="rechner" element={<Rechner />} />
              <Route path="the-lab" element={<TheLab />} />
              <Route path="tagebuch" element={<Tagebuch />} />
              <Route path="bewertungen" element={<Bewertungen />} />
              <Route path="profil" element={<Profil />} />
              <Route path="faq" element={<FAQ />} />
            </Route>
          </Routes>
        </OnboardingProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: 0 errors (StudyDetail doesn't exist yet — TypeScript will error on the import. Create a stub first):

Create `src/pages/StudyDetail.tsx` stub:
```tsx
export function StudyDetail() { return <div>stub</div> }
```

Then run `npx tsc --noEmit` — expect 0 errors.

- [ ] **Step 4: Commit**

```bash
git add index.html src/App.tsx src/pages/StudyDetail.tsx
git commit -m "feat(lab): add Google Fonts + StudyDetail route"
```

---

## Task 2: Update `pubmed.ts` — Add studyType to FilterState

**Files:**
- Modify: `src/pages/lab/pubmed.ts`

- [ ] **Step 1: Add `StudyTypeFilter` type and update `FilterState`**

Find and replace the types section (lines 27–50) with:

```typescript
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
```

- [ ] **Step 2: Update `countActiveFilters`**

```typescript
export function countActiveFilters(f: FilterState): number {
  let n = 0
  if (f.peptides.length > 0) n++
  if (f.sort !== 'date') n++
  if (f.year !== 'all') n++
  if (f.studyType !== '') n++
  return n
}
```

- [ ] **Step 3: Add `STUDY_TYPE_CLAUSE` and update `buildQuery`**

Add after `YEAR_CLAUSE`:

```typescript
const STUDY_TYPE_CLAUSE: Record<StudyTypeFilter, string> = {
  '': '',
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
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/lab/pubmed.ts
git commit -m "feat(lab): add studyType to FilterState + buildQuery"
```

---

## Task 3: Create `src/pages/lab/labUtils.ts`

**Files:**
- Create: `src/pages/lab/labUtils.ts`

- [ ] **Step 1: Write the file**

```typescript
// src/pages/lab/labUtils.ts

export type EvidenceScore = 'strong' | 'moderate' | 'preclinical' | 'unknown'
export type StudyType = 'clinical' | 'meta' | 'human' | 'animal' | 'study'

export function getEvidenceScore(title: string, abstract: string): EvidenceScore {
  const text = `${title} ${abstract}`.toLowerCase()
  if (/randomized|rct|\bclinical trial\b|systematic review|meta.?analysis/.test(text)) return 'strong'
  if (/\bhuman\b|patients|subjects|cohort|participant/.test(text)) return 'moderate'
  if (/\brat\b|\bmouse\b|\bmice\b|\banimal\b|in vitro|in vivo|rodent/.test(text)) return 'preclinical'
  return 'unknown'
}

export function getStudyType(title: string, abstract: string): StudyType {
  const text = `${title} ${abstract}`.toLowerCase()
  if (/randomized|rct|\bclinical trial\b/.test(text)) return 'clinical'
  if (/systematic review|meta.?analysis/.test(text)) return 'meta'
  if (/cohort|observational|\bhuman\b|patients|subjects|participant/.test(text)) return 'human'
  if (/\brat\b|\bmouse\b|\bmice\b|\banimal\b|in vitro|in vivo|rodent/.test(text)) return 'animal'
  return 'study'
}

export function getStudyTypeLabel(type: StudyType): string {
  const labels: Record<StudyType, string> = {
    clinical: 'CLINICAL TRIAL',
    meta:     'META-ANALYSE',
    human:    'HUMAN STUDIE',
    animal:   'TIER / LABOR',
    study:    'STUDIE',
  }
  return labels[type]
}

export function getEvidenceLabel(score: EvidenceScore): string {
  const labels: Record<EvidenceScore, string> = {
    strong:      'Stark',
    moderate:    'Moderat',
    preclinical: 'Präklinisch',
    unknown:     'Unbekannt',
  }
  return labels[score]
}

export function getEvidenceContext(score: EvidenceScore): string {
  const contexts: Record<EvidenceScore, string> = {
    strong:      'Hochqualitative Evidenz, direkt auf Menschen anwendbar.',
    moderate:    'Solide Humandaten, weitere Studien empfohlen.',
    preclinical: 'Tierstudie — zeigt Potenzial, braucht Human-Bestätigung.',
    unknown:     'Studientyp nicht klassifiziert.',
  }
  return contexts[score]
}

// Returns up to 4 key sentences from the abstract (skips the first intro sentence).
export function getKeyFindings(abstract: string): string[] {
  if (!abstract) return []
  return abstract
    .split(/\.\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 25)
    .slice(1, 5)
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/lab/labUtils.ts
git commit -m "feat(lab): add labUtils (evidence score, study type, key findings)"
```

---

## Task 4: Create `src/pages/lab/LabHero.tsx`

**Files:**
- Create: `src/pages/lab/LabHero.tsx`

- [ ] **Step 1: Write the file**

```tsx
// src/pages/lab/LabHero.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Search } from 'lucide-react'

const QUICK_TAGS = ['BPC-157', 'TB-500', 'GLP-1', 'Recovery', 'Healing', 'Longevity']

interface LabHeroProps {
  onSearch: (query: string) => void
  loading: boolean
}

export function LabHero({ onSearch, loading }: LabHeroProps) {
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) {
      setActiveTag('')
      onSearch(q)
    }
  }

  const handleTag = (tag: string) => {
    setQuery(tag)
    setActiveTag(tag)
    onSearch(tag)
  }

  return (
    <div className="relative -mx-4 px-4 pb-8 pt-6 mb-6 overflow-hidden">
      {/* Dot-grid background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'radial-gradient(circle, #1e293b 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      {/* Fade-out gradient at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#070B11] to-transparent pointer-events-none" />

      <div className="relative">
        {/* Kicker */}
        <p
          className="text-[0.58rem] font-black uppercase tracking-[0.2em] text-sky-400/65 mb-3"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          FORSCHUNG
        </p>

        {/* Title */}
        <h1
          className="text-3xl font-black text-white mb-1 leading-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          The Lab
        </h1>
        <p className="text-sm text-slate-400 mb-5">
          Explore peptide research & clinical intelligence.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
            />
            <input
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveTag('') }}
              disabled={loading}
              placeholder="Peptid, Studie oder Thema suchen…"
              className="w-full bg-[#0B1220] border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none transition-all duration-300 focus:border-sky-500/50 focus:shadow-[0_0_30px_rgba(0,204,245,0.12)]"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary shrink-0">
            {loading ? '…' : 'Suchen'}
          </button>
        </form>

        {/* Quick tags */}
        <div className="flex flex-wrap gap-2">
          {QUICK_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              disabled={loading}
              onClick={() => handleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                activeTag === tag
                  ? 'bg-sky-500 border-transparent text-white'
                  : 'border-white/10 text-slate-400 hover:bg-sky-500/10 hover:border-sky-500/30 hover:text-sky-400'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/lab/LabHero.tsx
git commit -m "feat(lab): add LabHero with dot-grid, premium search bar, quick tags"
```

---

## Task 5: Create `src/pages/lab/ResearchSnapshot.tsx`

**Files:**
- Create: `src/pages/lab/ResearchSnapshot.tsx`

- [ ] **Step 1: Write the file**

```tsx
// src/pages/lab/ResearchSnapshot.tsx
import type { ChartEntry, PubMedArticle } from './pubmed'

interface ResearchSnapshotProps {
  chartData: ChartEntry[]
  articles: PubMedArticle[]
  onSearch: (query: string) => void
}

interface SnapshotCardProps {
  kicker: string
  kickerColor: string
  topBorderColor: string
  title: string
  sub: string
  cta?: string
  onCta?: () => void
}

function SnapshotCard({
  kicker, kickerColor, topBorderColor, title, sub, cta, onCta,
}: SnapshotCardProps) {
  return (
    <div
      className={`bg-[#0B1220] border border-white/[0.06] ${topBorderColor} rounded-2xl p-4 hover:bg-[#111827] hover:-translate-y-0.5 transition-all duration-200`}
    >
      <p
        className={`text-[0.58rem] font-black uppercase tracking-wider mb-2 ${kickerColor}`}
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {kicker}
      </p>
      <p
        className="text-xl font-black text-white mb-0.5 leading-tight truncate"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        {title}
      </p>
      <p className="text-xs text-slate-500">{sub}</p>
      {cta && onCta && (
        <button
          type="button"
          onClick={onCta}
          className="mt-3 text-xs text-slate-500 hover:text-sky-400 transition-colors"
        >
          {cta} →
        </button>
      )}
    </div>
  )
}

export function ResearchSnapshot({ chartData, articles, onSearch }: ResearchSnapshotProps) {
  const top = chartData[0]
  const second = chartData[1]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-6">
      <SnapshotCard
        kicker="⚡ Trending"
        kickerColor="text-sky-400/70"
        topBorderColor="border-t-2 border-t-sky-500"
        title={top?.name ?? '—'}
        sub={top ? `${top.count.toLocaleString('de-DE')} Studien · PubMed` : 'Lade Daten…'}
        cta="Entdecken"
        onCta={() => top && onSearch(top.name)}
      />
      <SnapshotCard
        kicker="🧬 Meisterforscht"
        kickerColor="text-violet-400/70"
        topBorderColor="border-t-2 border-t-violet-500"
        title={second?.name ?? '—'}
        sub={second ? `${second.count.toLocaleString('de-DE')} Papers` : 'Lade Daten…'}
        cta="Entdecken"
        onCta={() => second && onSearch(second.name)}
      />
      <SnapshotCard
        kicker="🔬 Neu Geladen"
        kickerColor="text-blue-400/70"
        topBorderColor="border-t-2 border-t-blue-500"
        title={String(articles.length)}
        sub="Studien geladen · sortiert nach Datum"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/lab/ResearchSnapshot.tsx
git commit -m "feat(lab): add ResearchSnapshot intelligence cards"
```

---

## Task 6: Create `src/pages/lab/StudyCard.tsx`

**Files:**
- Create: `src/pages/lab/StudyCard.tsx`

- [ ] **Step 1: Write the file**

```tsx
// src/pages/lab/StudyCard.tsx
import { ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { PubMedArticle } from './pubmed'
import {
  getEvidenceScore,
  getStudyType,
  getStudyTypeLabel,
  getEvidenceLabel,
  getKeyFindings,
} from './labUtils'

interface StudyCardProps {
  article: PubMedArticle
  variant: 'featured' | 'compact'
}

const STUDY_TYPE_STYLES: Record<string, string> = {
  clinical: 'bg-violet-500/15 text-violet-400',
  meta:     'bg-blue-500/15 text-blue-400',
  human:    'bg-emerald-500/15 text-emerald-400',
  animal:   'bg-orange-500/15 text-orange-400',
  study:    'bg-slate-700/40 text-slate-400',
}

const EVIDENCE_STYLES: Record<string, string> = {
  strong:      'bg-emerald-500/15 text-emerald-400',
  moderate:    'bg-yellow-500/15 text-yellow-400',
  preclinical: 'bg-red-500/15 text-red-400',
  unknown:     'bg-slate-700/40 text-slate-400',
}

const PEPTIDE_ACCENTS: Record<string, string> = {
  'BPC-157':    'border-l-sky-500',
  'TB-500':     'border-l-violet-500',
  'Ipamorelin': 'border-l-emerald-500',
  'CJC-1295':   'border-l-orange-500',
  'Semaglutide':'border-l-teal-500',
  'Tirzepatide':'border-l-indigo-500',
  'Selank':     'border-l-pink-500',
  'Epithalon':  'border-l-amber-500',
}

function detectAccent(title: string): string {
  const found = Object.keys(PEPTIDE_ACCENTS).find(p =>
    title.toUpperCase().includes(p.toUpperCase())
  )
  return PEPTIDE_ACCENTS[found ?? ''] ?? 'border-l-slate-600'
}

function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return authors[0]
  return `${authors[0]} et al.`
}

function BadgeRow({ article }: { article: PubMedArticle }) {
  const studyType = getStudyType(article.title, article.abstract)
  const evidenceScore = getEvidenceScore(article.title, article.abstract)
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span
        className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-md ${STUDY_TYPE_STYLES[studyType]}`}
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {getStudyTypeLabel(studyType)}
      </span>
      <span
        className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-full ${EVIDENCE_STYLES[evidenceScore]}`}
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {getEvidenceLabel(evidenceScore)}
      </span>
    </div>
  )
}

export function StudyCard({ article, variant }: StudyCardProps) {
  const navigate = useNavigate()
  const keyFindings = getKeyFindings(article.abstract)
  const accent = detectAccent(article.title)

  const openDetail = () => {
    navigate(`/lab/study/${article.id}`, { state: { article } })
  }

  if (variant === 'featured') {
    const snippet = article.abstract
      ? article.abstract.length > 350
        ? `${article.abstract.slice(0, 350).trim()}…`
        : article.abstract
      : 'Kein Abstract verfügbar.'

    return (
      <article className={`bg-[#0B1220] border border-white/[0.06] border-l-4 ${accent} rounded-2xl p-5 mb-4`}>
        {/* Top row: badges + date */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <BadgeRow article={article} />
          {article.pubdate && (
            <span
              className="text-[0.6rem] text-slate-600 shrink-0"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {article.pubdate}
            </span>
          )}
        </div>

        {/* Title */}
        <h2
          className="text-base font-black text-white leading-snug mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {article.title}
        </h2>

        {/* Meta */}
        {(article.authors.length > 0 || article.journal) && (
          <div className="flex flex-wrap gap-x-2 text-xs text-slate-500 mb-3">
            {article.authors.length > 0 && <span>{formatAuthors(article.authors)}</span>}
            {article.journal && <span className="text-sky-400/60">{article.journal}</span>}
          </div>
        )}

        {/* Summary divider */}
        <div className="flex items-center gap-3 mb-2">
          <span
            className="text-[0.58rem] uppercase tracking-widest text-sky-400/60 shrink-0"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Zusammenfassung
          </span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        <p className="text-sm text-slate-400 leading-relaxed mb-3">{snippet}</p>

        {/* Key findings */}
        {keyFindings.length > 0 && (
          <ul className="space-y-1 mb-4">
            {keyFindings.slice(0, 2).map((f, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-500">
                <span className="text-sky-400/50 shrink-0">•</span>
                <span>{f.endsWith('.') ? f : `${f}.`}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button type="button" onClick={openDetail} className="btn-primary text-xs flex-1">
            Zusammenfassung lesen
          </button>
          {article.link && (
            <a
              href={article.link}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary text-xs px-3"
            >
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      </article>
    )
  }

  // compact variant
  return (
    <article
      className="bg-[#0B1220] border border-white/[0.06] rounded-xl p-4 hover:bg-[#111827] transition-colors duration-150 cursor-pointer"
      onClick={openDetail}
    >
      {/* Top row */}
      <div
        className="flex items-start justify-between gap-2 mb-2"
        onClick={e => e.stopPropagation()}
      >
        <BadgeRow article={article} />
        {article.pubdate && (
          <span
            className="text-[0.6rem] text-slate-600 shrink-0"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {article.pubdate}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="text-sm font-semibold text-white leading-snug line-clamp-2 mb-1.5">
        {article.title}
      </h2>

      {/* Snippet */}
      {article.abstract && (
        <p className="text-xs text-slate-500 line-clamp-2 mb-2">
          {article.abstract.length > 120
            ? `${article.abstract.slice(0, 120).trim()}…`
            : article.abstract}
        </p>
      )}

      {/* Key findings */}
      {keyFindings.length > 0 && (
        <ul className="space-y-0.5 mb-3">
          {keyFindings.slice(0, 2).map((f, i) => (
            <li key={i} className="flex gap-1.5 text-xs text-slate-600">
              <span className="text-sky-400/40 shrink-0">•</span>
              <span className="line-clamp-1">{f}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Bottom row */}
      <div
        className="flex items-center justify-between"
        onClick={e => e.stopPropagation()}
      >
        <span
          className="text-xs text-slate-700 cursor-not-allowed"
          title="Coming soon"
        >
          ♡ Speichern
        </span>
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="text-slate-600 hover:text-sky-400 transition-colors"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/lab/StudyCard.tsx
git commit -m "feat(lab): add StudyCard with featured + compact variants"
```

---

## Task 7: Create `src/pages/lab/StudySidebar.tsx`

**Files:**
- Create: `src/pages/lab/StudySidebar.tsx`

- [ ] **Step 1: Write the file**

```tsx
// src/pages/lab/StudySidebar.tsx
import type { FilterState, SortMode, StudyTypeFilter, YearFilter } from './pubmed'

interface StudySidebarProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="text-[0.55rem] uppercase tracking-widest text-slate-600 mb-2"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {children}
    </p>
  )
}

function FilterOption({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 text-xs w-full text-left py-0.5 transition-colors duration-150 ${
        active ? 'text-sky-400' : 'text-slate-400 hover:text-slate-300'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-150 ${
          active ? 'bg-sky-400 shadow-[0_0_6px_rgba(0,204,245,0.6)]' : 'bg-slate-700'
        }`}
      />
      {label}
    </button>
  )
}

const STUDY_TYPE_OPTIONS: Array<{ label: string; value: StudyTypeFilter }> = [
  { label: 'Alle',             value: '' },
  { label: 'Human Studien',    value: 'human' },
  { label: 'Tier / Labor',     value: 'animal' },
  { label: 'Meta-Analysen',    value: 'meta' },
  { label: 'Klinische Trials', value: 'clinical' },
]

export function StudySidebar({ filters, onFilterChange }: StudySidebarProps) {
  function set(patch: Partial<FilterState>) {
    onFilterChange({ ...filters, ...patch })
  }

  return (
    <aside className="space-y-6">
      <div className="space-y-1.5">
        <SectionLabel>Studientyp</SectionLabel>
        {STUDY_TYPE_OPTIONS.map(opt => (
          <FilterOption
            key={opt.value}
            label={opt.label}
            active={filters.studyType === opt.value}
            onClick={() => set({ studyType: opt.value })}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <SectionLabel>Sortieren</SectionLabel>
        {(['date', 'relevance'] as SortMode[]).map(s => (
          <FilterOption
            key={s}
            label={s === 'date' ? 'Neueste' : 'Relevanz'}
            active={filters.sort === s}
            onClick={() => set({ sort: s })}
          />
        ))}
      </div>

      <div className="space-y-1.5">
        <SectionLabel>Jahr</SectionLabel>
        {(['all', '2024plus', '2025'] as YearFilter[]).map(y => (
          <FilterOption
            key={y}
            label={y === 'all' ? 'Alle' : y === '2024plus' ? '2024+' : '2025'}
            active={filters.year === y}
            onClick={() => set({ year: y })}
          />
        ))}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/lab/StudySidebar.tsx
git commit -m "feat(lab): add StudySidebar desktop sticky filter panel"
```

---

## Task 8: Create `src/pages/lab/StudyFeed.tsx`

**Files:**
- Create: `src/pages/lab/StudyFeed.tsx`

- [ ] **Step 1: Write the file**

```tsx
// src/pages/lab/StudyFeed.tsx
import { Flame, Loader2, BookOpen, Search } from 'lucide-react'
import type { PubMedArticle, FilterState } from './pubmed'
import { StudyCard } from './StudyCard'
import { StudySidebar } from './StudySidebar'

interface StudyFeedProps {
  articles: PubMedArticle[]
  filters: FilterState
  onSidebarFilter: (filters: FilterState) => void
  loading: boolean
  errorMessage: string | null
  isTrending: boolean
  lastQuery: string
  onRetry: () => void
}

export function StudyFeed({
  articles,
  filters,
  onSidebarFilter,
  loading,
  errorMessage,
  isTrending,
  lastQuery,
  onRetry,
}: StudyFeedProps) {
  const featured = articles[0]
  const rest = articles.slice(1)

  return (
    <div className="flex gap-6 items-start">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden md:block w-52 shrink-0 sticky top-4 self-start">
        <StudySidebar filters={filters} onFilterChange={onSidebarFilter} />
      </div>

      {/* Feed */}
      <div className="flex-1 min-w-0">
        {/* Section label */}
        {!loading && !errorMessage && articles.length > 0 && (
          <div className="flex items-end justify-between border-b border-white/[0.05] pb-2 mb-4">
            <div>
              {isTrending ? (
                <div className="flex items-center gap-1.5">
                  <Flame size={13} className="text-orange-400" />
                  <span
                    className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-white"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    Trending
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Search size={12} className="text-slate-500" />
                  <span
                    className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-white"
                    style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                  >
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
            <span
              className="text-[0.6rem] text-slate-700"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              pubmed.ncbi
            </span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="card text-center py-10 text-slate-500">
            <Loader2 size={28} className="mx-auto mb-3 text-sky-400/60 animate-spin" />
            <p className="text-sm">{isTrending ? 'Lade neueste Studien…' : 'Suche läuft…'}</p>
          </div>
        )}

        {/* Error */}
        {!loading && errorMessage && (
          <div className="card border border-red-500/20 bg-red-950/20 text-center py-8">
            <p className="text-sm text-red-300 mb-3">{errorMessage}</p>
            <button type="button" onClick={onRetry} className="btn-secondary text-sm">
              Erneut versuchen
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !errorMessage && articles.length === 0 && (
          <div className="card text-center py-10 text-slate-500">
            <BookOpen size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">
              {isTrending ? 'Keine Studien gefunden.' : `Keine Ergebnisse für „${lastQuery}".`}
            </p>
          </div>
        )}

        {/* Featured card */}
        {!loading && !errorMessage && featured && (
          <StudyCard article={featured} variant="featured" />
        )}

        {/* Compact feed */}
        {!loading && !errorMessage && rest.length > 0 && (
          <div className="space-y-3">
            {rest.map(article => (
              <StudyCard key={article.id} article={article} variant="compact" />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/lab/StudyFeed.tsx
git commit -m "feat(lab): add StudyFeed with desktop sidebar + featured/compact layout"
```

---

## Task 9: Create `src/pages/StudyDetail.tsx`

**Files:**
- Modify: `src/pages/StudyDetail.tsx` (replace stub from Task 1)

- [ ] **Step 1: Write the file**

```tsx
// src/pages/StudyDetail.tsx
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { PubMedArticle } from './lab/pubmed'
import {
  getEvidenceScore,
  getStudyType,
  getStudyTypeLabel,
  getEvidenceLabel,
  getEvidenceContext,
  getKeyFindings,
} from './lab/labUtils'

const STUDY_TYPE_STYLES: Record<string, string> = {
  clinical: 'bg-violet-500/15 text-violet-400',
  meta:     'bg-blue-500/15 text-blue-400',
  human:    'bg-emerald-500/15 text-emerald-400',
  animal:   'bg-orange-500/15 text-orange-400',
  study:    'bg-slate-700/40 text-slate-400',
}

const EVIDENCE_STYLES: Record<string, string> = {
  strong:      'bg-emerald-500/15 text-emerald-400',
  moderate:    'bg-yellow-500/15 text-yellow-400',
  preclinical: 'bg-red-500/15 text-red-400',
  unknown:     'bg-slate-700/40 text-slate-400',
}

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl p-5">
      <p
        className="text-[0.58rem] font-black uppercase tracking-widest text-sky-400/60 mb-3"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      >
        {label}
      </p>
      {children}
    </div>
  )
}

export function StudyDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const article = (location.state as { article?: PubMedArticle } | null)?.article
  const [abstractOpen, setAbstractOpen] = useState(false)

  if (!article) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500 text-sm mb-4">Studie nicht gefunden.</p>
        <button type="button" onClick={() => navigate('/lab')} className="btn-secondary text-sm">
          ← Zurück zur Forschung
        </button>
      </div>
    )
  }

  const studyType      = getStudyType(article.title, article.abstract)
  const evidenceScore  = getEvidenceScore(article.title, article.abstract)
  const keyFindings    = getKeyFindings(article.abstract)

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-10">
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ArrowLeft size={14} />
        Zurück zur Forschung
      </button>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span
            className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-md ${STUDY_TYPE_STYLES[studyType]}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {getStudyTypeLabel(studyType)}
          </span>
          <span
            className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-full ${EVIDENCE_STYLES[evidenceScore]}`}
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {getEvidenceLabel(evidenceScore)}
          </span>
          {article.pubdate && (
            <span
              className="text-[0.6rem] text-slate-600"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {article.pubdate}
            </span>
          )}
        </div>

        <h1
          className="text-2xl font-black text-white leading-snug mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {article.title}
        </h1>

        {(article.authors.length > 0 || article.journal) && (
          <p className="text-sm text-slate-500">
            {article.authors.length > 0 && (
              <span>
                {article.authors.length === 1 ? article.authors[0] : `${article.authors[0]} et al.`}
              </span>
            )}
            {article.journal && (
              <span className="text-sky-400/60"> · {article.journal}</span>
            )}
          </p>
        )}
      </div>

      {/* Summary */}
      <SectionCard label="Zusammenfassung">
        <p className="text-sm text-slate-300 leading-relaxed">
          {article.abstract || 'Kein Abstract verfügbar.'}
        </p>
      </SectionCard>

      {/* Key Findings */}
      {keyFindings.length > 0 && (
        <SectionCard label="Key Findings">
          <ul className="space-y-2">
            {keyFindings.map((finding, i) => (
              <li key={i} className="flex gap-3 text-sm text-slate-300">
                <span className="text-sky-400/60 shrink-0 mt-0.5">•</span>
                <span>{finding.endsWith('.') ? finding : `${finding}.`}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Evidence Analysis */}
      <SectionCard label="Evidence Analyse">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Studientyp</span>
            <span
              className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-md ${STUDY_TYPE_STYLES[studyType]}`}
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {getStudyTypeLabel(studyType)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Evidenzlevel</span>
            <span
              className={`text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-full ${EVIDENCE_STYLES[evidenceScore]}`}
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {getEvidenceLabel(evidenceScore)}
            </span>
          </div>
          <div className="border-t border-white/[0.06] pt-3">
            <p className="text-xs text-slate-400 leading-relaxed">
              {getEvidenceContext(evidenceScore)}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Original Abstract Accordion */}
      <div className="bg-[#0B1220] border border-white/[0.06] rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setAbstractOpen(o => !o)}
          className="flex items-center justify-between w-full px-5 py-4 text-left"
        >
          <span
            className="text-[0.58rem] font-black uppercase tracking-widest text-slate-500"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Originaler Abstract
          </span>
          {abstractOpen
            ? <ChevronUp size={14} className="text-slate-500" />
            : <ChevronDown size={14} className="text-slate-500" />
          }
        </button>
        {abstractOpen && (
          <div className="px-5 pb-5 border-t border-white/[0.06]">
            <p className="text-sm text-slate-400 leading-relaxed pt-4">
              {article.abstract || 'Kein Abstract verfügbar.'}
            </p>
          </div>
        )}
      </div>

      {/* PubMed Button */}
      {article.link && (
        <a
          href={article.link}
          target="_blank"
          rel="noreferrer"
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          Auf PubMed öffnen <ExternalLink size={14} />
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/StudyDetail.tsx
git commit -m "feat(lab): add StudyDetail page with summary, findings, evidence, accordion"
```

---

## Task 10: Rewrite `src/pages/TheLab.tsx`

**Files:**
- Modify: `src/pages/TheLab.tsx` (full rewrite)

- [ ] **Step 1: Write the new `src/pages/TheLab.tsx`**

```tsx
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

export function TheLab() {
  const { t } = useTranslation()

  const [articles, setArticles]         = useState<PubMedArticle[]>([])
  const [chartData, setChartData]       = useState<ChartEntry[]>([])
  const [loading, setLoading]           = useState(true)
  const [chartLoading, setChartLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isTrending, setIsTrending]     = useState(true)
  const [lastQuery, setLastQuery]       = useState('')
  const [filters, setFilters]           = useState<FilterState>(DEFAULT_FILTER_STATE)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Auto-load on mount — articles first, chart after (NCBI rate limit)
  useEffect(() => {
    searchPubMedArticles(TRENDING_QUERY, 10)
      .then(setArticles)
      .catch(err => setErrorMessage(getErrorMessage(err)))
      .finally(() => {
        setLoading(false)
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

  // Called by LabHero when user submits search or clicks quick tag
  function handleHeroSearch(query: string) {
    void runSearch(query, filters)
  }

  // Called by StudySidebar on immediate filter change
  function handleSidebarFilter(newFilters: FilterState) {
    setFilters(newFilters)
    void runSearch(lastQuery, newFilters)
  }

  // Called by FilterSheet Apply button (mobile)
  function handleSheetApply() {
    void runSearch(lastQuery, filters)
  }

  const activeFilterCount = countActiveFilters(filters)

  return (
    <div>
      {/* Hero */}
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
          {isTrending ? 'Trending Studien' : `„${lastQuery}"`}
        </span>
        <button
          type="button"
          onClick={() => setFilterSheetOpen(true)}
          className={`relative btn-secondary text-xs px-3 py-2 ${
            activeFilterCount > 0 ? 'border-sky-500/50 text-sky-400' : ''
          }`}
        >
          Filter
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-sky-500 text-[0.55rem] font-black text-white flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Study Feed (includes desktop sidebar) */}
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

      {/* Mobile Filter Sheet */}
      <FilterSheet
        open={filterSheetOpen}
        filters={filters}
        resultCount={articles.length}
        onClose={() => setFilterSheetOpen(false)}
        onChange={setFilters}
        onApply={handleSheetApply}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript — expect 0 errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Run dev server and verify in browser**

```bash
npm run dev
```

Open `http://localhost:5173` → navigate to The Lab. Verify:
- Hero shows dot-grid background, large search bar, quick tags
- Research Snapshot shows 3 cards (loads after chart data arrives)
- Featured study card shows with study type + evidence badges
- Compact study cards show below with key findings
- Desktop (>768px): sticky sidebar visible on left
- Mobile: Filter button + bottom sheet
- Clicking "Zusammenfassung lesen" → navigates to `/lab/study/:id`
- Detail page: shows summary, key findings, evidence, accordion, PubMed button
- Back button → returns to lab

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: Build succeeds, 0 TypeScript errors.

- [ ] **Step 5: Commit and push**

```bash
git add src/pages/TheLab.tsx
git commit -m "feat(lab): rewrite TheLab as premium research terminal coordinator"
git push origin main
```

---

## Self-Review

**Spec coverage:**
- ✅ Google Fonts (Space Grotesk, IBM Plex Mono) — Task 1
- ✅ `/lab/study/:id` route — Task 1
- ✅ studyType added to FilterState + buildQuery — Task 2
- ✅ getEvidenceScore, getStudyType, getKeyFindings — Task 3
- ✅ Hero: dot-grid, premium search, quick tags — Task 4
- ✅ Research Snapshot: 3 intelligence cards with chartData — Task 5
- ✅ Featured card: study type, evidence badge, summary divider, key findings, detail button — Task 6
- ✅ Compact card: hover, findings, save disabled, PubMed link — Task 6
- ✅ Desktop sidebar: studyType, sort, year, glowing active dots — Task 7
- ✅ StudyFeed: sidebar hidden on mobile, section label, loading/error/empty states — Task 8
- ✅ Detail page: header, summary, findings, evidence, accordion, PubMed button — Task 9
- ✅ TheLab: new handlers, chart sequential load, mobile filter button — Task 10

**Placeholder scan:** No TBD, no "implement later", no vague steps. All code blocks complete.

**Type consistency:**
- `FilterState` (Task 2) includes `studyType: StudyTypeFilter` — used in Tasks 7, 8, 10 ✅
- `StudyCardProps.variant: 'featured' | 'compact'` — defined Task 6, used Task 8 ✅
- `StudyFeedProps.onSidebarFilter: (filters: FilterState) => void` — defined Task 8, called Task 10 ✅
- `LabHeroProps.onSearch: (query: string) => void` — defined Task 4, called Task 10 ✅
- `ResearchSnapshotProps.onSearch: (query: string) => void` — defined Task 5, called Task 10 ✅
- `StudyDetail` reads `location.state as { article?: PubMedArticle }` — consistent with Task 6 `navigate('/lab/study/:id', { state: { article } })` ✅
