# The Lab — Redesign Spec
_Datum: 2026-05-21_

## Ziel

Professionelles Research-Dashboard für PubMed-Studiensuche im TYD App-Stil. Ersetzt die aktuelle einfache Listenansicht durch ein Layout mit automatisch geladenen Trending-Studien, Balkendiagramm pro Peptid, Bottom-Sheet-Filter und dreistufigem Artikel-Layout (Hero → 2er-Grid → Kompaktliste).

---

## Entschiedene Design-Richtung

Aus der Brainstorming-Session:
- **Layout:** C — Research Dashboard (Hero + Grid + Mini-Liste + Stats)
- **Grafik:** B — Balkendiagramm Studien pro Peptid (Recharts, bereits installiert)
- **Filter:** C — Bottom Sheet (öffnet von unten, Mehrfachauswahl)

---

## Architektur

`TheLab.tsx` wird aufgeteilt in:

```
src/pages/TheLab.tsx          — Haupt-Page: State, Fetching, Layout-Koordination
src/pages/lab/
  PeptideChart.tsx             — Recharts-Balkendiagramm + Statistik-Kacheln
  FilterSheet.tsx              — Bottom-Sheet mit Filter- und Sort-Optionen
  ArticleCards.tsx             — ArticleHero, ArticleGridCard, ArticleMiniItem
  pubmed.ts                    — Alle API-Funktionen (bereits vorhanden, extrahiert)
```

---

## Komponenten

### `TheLab.tsx` — State & Layout

**State:**
```ts
articles: PubMedArticle[]       // aktuell angezeigte Artikel
chartData: ChartEntry[]         // { name, count, color } pro Peptid
loading: boolean                // Trending-/Suche-Ladevorgang
chartLoading: boolean           // Chart-Daten laden separat
errorMessage: string | null
isTrending: boolean             // true = auto-load, false = Suchergebnis
lastQuery: string
filterState: FilterState        // { peptides: string[], sort: SortMode, year: YearFilter }
filterSheetOpen: boolean
```

**Layout-Struktur (top → bottom):**
1. Page-Header (FlaskConical, Titel, Subtitle) — unverändert
2. Search-Row: `.input` + Filter-Button mit Badge-Zähler
3. Active-Filter-Chips (wenn Filter aktiv): scrollbar horizontal
4. Stats + Chart-Section (`.card`): 3 Kacheln + `PeptideChart`
5. Section-Label (Trending 🔥 oder Suchergebnis-Info)
6. Artikel: Hero → 2er-Grid → Mini-Liste
7. `FilterSheet` (fixed, conditional rendered)

### `PeptideChart.tsx`

- Recharts `ResponsiveContainer` + `BarChart` (horizontal, `layout="vertical"`)
- Daten: je Peptid ein PubMed-`esearch`-Count-Request (nur `rettype=count`)
- Ladevorgang parallel zum Trending-Fetch, eigener Loading-State (Skeleton-Bars)
- Peptide: BPC-157, TB-500, Ipamorelin, CJC-1295, Semaglutide, Tirzepatide, Selank, Epithalon
- Farben: passend zu den bestehenden Peptid-Farben im Code

### `FilterSheet.tsx`

- Fixed bottom overlay mit `backdrop-filter: blur` (KEIN backdrop-filter auf dem scrollbaren Innen-Container — bekanntes App-Problem)
- Drag-Handle oben
- Sections: Peptid (Mehrfachauswahl), Sortieren (Neueste / Relevanz), Jahr (Alle / 2024+ / 2025)
- "Zurücksetzen" (btn-secondary) + "Ergebnisse anzeigen (N)" (btn-primary)
- Schließen per Escape, Overlay-Klick, oder Apply-Button
- Filter-Badge am Filter-Button zeigt Anzahl aktiver Filter (≠ Default)

### `ArticleCards.tsx`

**`ArticleHero`** (Index 0):
- `.card border-l-[5px] {peptideAccent}`
- Peptid-Tag + „✦ NEU"-Badge + Datum
- Titel: `text-base font-black text-white`
- Author + Journal
- Abstract-Box (bg black/25, ersten 320 Zeichen, kein Expand — volle Lesbarkeit)
- `.btn-primary` Link zu PubMed

**`ArticleGridCard`** (Index 1–4):
- `.card border-l-4 {peptideAccent}` in `grid grid-cols-2 gap-2.5`
- Peptid-Tag + ggf. NEU-Badge
- Titel: `text-xs font-bold`, max 3 Zeilen (`line-clamp-3`)
- Abstract-Snippet: 110 Zeichen
- Datum + ↗-Link-Icon

**`ArticleMiniItem`** (Index 5+):
- Kein `.card`, nur `py-3 border-b border-slate-800/60`
- 3px farbiger Balken links
- Peptid-Tag + Datum
- Titel: `text-xs font-semibold`, 2 Zeilen
- Autor + ↗-Icon rechts

---

## Datenfluss

### Trending (beim Seitenöffnen)
```
mount
  → parallel:
      searchPubMedArticles(TRENDING_QUERY, retmax=10) → setArticles
      fetchChartCounts(PEPTIDES)                      → setChartData
  → loading = false
```

### Suche
```
runSearch(query, filterState)
  → TRENDING_QUERY wenn peptide-Filter aktiv: angepasste Query
  → sort-Parameter: 'date' | 'relevance'
  → year-Filter: PDat-Range anhängen wenn aktiv
  → setArticles, setIsTrending(false)
```

### Chart-Count-Fetch
Für jedes Peptid: `esearch.fcgi?db=pubmed&term={peptide}&rettype=count&retmode=json`
→ `count` aus `esearchresult.count`
→ Parallel mit `Promise.all`, Timeout 10s

---

## Filter-State

```ts
type SortMode = 'date' | 'relevance'
type YearFilter = 'all' | '2024plus' | '2025'

interface FilterState {
  peptides: string[]   // leer = alle; ansonsten gezielter OR-Query
  sort: SortMode       // default: 'date'
  year: YearFilter     // default: 'all'
}
```

**Active-Filter-Zähler:** 
- +1 wenn `peptides.length > 0`
- +1 wenn `sort !== 'date'`
- +1 wenn `year !== 'all'`

**PubMed-Query-Konstruktion:**
```ts
const peptideClause = filters.peptides.length
  ? filters.peptides.map(p => `"${p}"`).join(' OR ')
  : TRENDING_QUERY

const yearClause = {
  'all': '',
  '2024plus': ' AND ("2024"[PDat] : "3000"[PDat])',
  '2025': ' AND "2025"[PDat]',
}[filters.year]

const finalQuery = peptideClause + yearClause
const sortParam = filters.sort === 'relevance' ? 'relevance' : 'date'
```

---

## Design-Tokens (App-konform)

- Cards: `.card` (backdrop-blur, var(--c-surface), border var(--c-border))
- Buttons: `.btn-primary`, `.btn-secondary`
- Inputs: `.input`
- Labels: `.label`
- Kicker-Text: `text-[0.6rem] font-bold uppercase tracking-[0.12em] text-sky-400/65`
- Primärfarbe: `sky-400 = #00ccf5`
- Background: `slate-950 = #020308`
- Card-BG: `var(--c-surface) = rgba(6,7,20,0.92)`

---

## Bekannte Constraints

- **KEIN `backdrop-filter` auf scrollbaren Bottom-Sheet-Containern** (bricht `overflow-y` in iOS Safari) — nur auf dem fixen Overlay-Hintergrund
- CORS-Proxy: `https://corsproxy.io/?` + `encodeURIComponent(url)` — bereits implementiert
- Recharts bereits installiert (`node_modules/recharts`)
- Keine neuen npm-Pakete nötig

---

## Dateien die geändert werden

| Datei | Aktion |
|---|---|
| `src/pages/TheLab.tsx` | Überarbeitung (State, Layout, delegiert an neue Komponenten) |
| `src/pages/lab/pubmed.ts` | Neu — API-Funktionen aus TheLab extrahiert + `fetchChartCounts` |
| `src/pages/lab/PeptideChart.tsx` | Neu — Recharts-Chart + Statistik-Kacheln |
| `src/pages/lab/FilterSheet.tsx` | Neu — Bottom-Sheet-Filter |
| `src/pages/lab/ArticleCards.tsx` | Neu — Hero, Grid, Mini-Karten |

---

## Nicht in Scope

- Kein Caching der API-Ergebnisse (localStorage o.ä.)
- Keine Pagination (bleibt bei retmax=10)
- Kein "Artikel merken"-Feature
- Keine i18n-Keys für neue UI-Elemente (hardcoded Deutsch — persönliche App)
