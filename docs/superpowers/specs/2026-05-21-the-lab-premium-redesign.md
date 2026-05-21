# The Lab — Premium Redesign Spec
_Datum: 2026-05-21 · Sub-Projekt 1 von 4_

## Ziel

Komplettes UI/UX-Redesign von "The Lab" zu einem Premium Biotech Research Terminal. Vibe: Linear/Perplexity/Arc Browser. Keine AI-Integration in diesem Sub-Projekt — abstracts werden als formatierte "Zusammenfassung" angezeigt.

## Scope

- Hauptseite `/lab` komplett neu
- Neue Detail-Seite `/lab/study/:id`
- Mobile-first + Desktop responsive (Sidebar ab `md:`)
- Bestehende API-Layer (`pubmed.ts`, `FilterSheet.tsx`) bleiben unverändert
- Keine neuen API-Calls für Snapshot-Cards — nutzen vorhandene Daten

## Out of Scope

- AI-Summaries (Sub-Projekt 3)
- Save/Bookmark (Sub-Projekt 2)
- Evidence-Algorithmus-Backend (Sub-Projekt 4)

---

## Designsystem

### Farben

| Token | Wert | Verwendung |
|---|---|---|
| bg-page | `#070B11` | Page Background |
| bg-card | `#0B1220` | Card Surface |
| bg-elevated | `#111827` | Hover / Elevated |
| accent-cyan | `#00ccf5` | Primary Accent (sky-400) |
| accent-violet | `#8b5cf6` | Secondary |
| accent-blue | `#3b82f6` | Tertiary |

### Typografie

| Rolle | Font | Größe | Gewicht |
|---|---|---|---|
| Hero-Titel | Space Grotesk | 36px | 900 |
| Section-Titel | Inter | 22px | 700 |
| Card-Titel | Inter | 16px | 600 |
| Body | Inter | 15px | 400 |
| Labels/Badges | IBM Plex Mono | 11px | 700 |
| Meta | Inter | 13px | 400 |

**Einbindung:** Space Grotesk + IBM Plex Mono via Google Fonts in `index.html`.

### Evidence Score Heuristik

Keine API — reine Titel-/Abstract-Analyse:

| Signalwörter im Titel/Abstract | Score |
|---|---|
| "randomized", "RCT", "clinical trial", "systematic review", "meta-analysis" | 🟢 Stark |
| "human", "patients", "subjects", "cohort" | 🟡 Moderat |
| "rat", "mouse", "animal", "in vitro", "in vivo" (Tier) | 🔴 Präklinisch |
| Keines der obigen | ⚪ Unbekannt |

**Hilfsfunktion:** `getEvidenceScore(title: string, abstract: string): EvidenceScore`

### Study Type Detection

| Signalwörter | Label | Badge-Farbe |
|---|---|---|
| "randomized", "RCT", "clinical trial" | CLINICAL TRIAL | violet |
| "systematic review", "meta-analysis" | META-ANALYSE | blue |
| "cohort", "observational", "human", "patients" | HUMAN STUDIE | emerald |
| "rat", "mouse", "animal", "in vitro" | TIER/LABOR | orange |
| Fallback | STUDIE | slate |

---

## Dateistruktur

| Datei | Aktion | Verantwortung |
|---|---|---|
| `src/pages/TheLab.tsx` | Rewrite | Page-Coordinator, State, Layout-Orchestration |
| `src/pages/StudyDetail.tsx` | Neu | Detail-Seite `/lab/study/:id` |
| `src/pages/lab/LabHero.tsx` | Neu | Hero-Section mit Search + Dot-Grid |
| `src/pages/lab/ResearchSnapshot.tsx` | Neu | 3 Intelligence-Cards |
| `src/pages/lab/StudyFeed.tsx` | Neu | Desktop-Layout: Sidebar + Feed |
| `src/pages/lab/StudySidebar.tsx` | Neu | Sticky Filter-Sidebar (Desktop only) |
| `src/pages/lab/StudyCard.tsx` | Neu | Premium Study Card (Featured + Kompakt) |
| `src/pages/lab/labUtils.ts` | Neu | getEvidenceScore, getStudyType, getKeyFindings |
| `src/pages/lab/pubmed.ts` | Unverändert | API-Layer |
| `src/pages/lab/FilterSheet.tsx` | Unverändert | Mobile Bottom Sheet |
| `src/App.tsx` | Modify | Neue Route `/lab/study/:id` hinzufügen |
| `index.html` | Modify | Google Fonts: Space Grotesk + IBM Plex Mono |

---

## Section 1: Hero (`LabHero.tsx`)

**Layout:** Volle Breite, kein Card-Container, `pb-8 pt-6`

**Komponenten:**
- Dot-Grid Background: `background-image: radial-gradient(circle, #1e293b 1px, transparent 1px)`, `background-size: 24px 24px`, CSS-Animation `animate-pulse` sehr langsam (4s)
- Kicker: `IBM Plex Mono`, `text-[0.6rem] uppercase tracking-widest text-sky-400/65`
- Titel: `Space Grotesk`, `text-3xl font-black text-white`
- Subtext: `Inter`, `text-sm text-slate-400`
- Search Bar:
  - `rounded-2xl border border-white/10 bg-[#0B1220]`
  - Focus: `border-sky-500/50 shadow-[0_0_30px_rgba(0,204,245,0.12)]`
  - Transition: `transition-all duration-300`
  - Submit: `btn-primary` rechts
- Quick Tags: `rounded-full px-3 py-1.5 text-xs font-medium border border-white/10 text-slate-400`
  - Hover: `bg-sky-500/10 border-sky-500/30 text-sky-400`
  - Aktiv (angeklickt/Suche läuft): `bg-sky-500 text-white border-transparent`

**Props:** `onSearch(query: string)`, `loading: boolean`, `activeTag: string`

---

## Section 2: Research Snapshot (`ResearchSnapshot.tsx`)

**Layout:** `grid grid-cols-1 gap-3 sm:grid-cols-3`, `mb-6`

**3 Cards:**

### Card 1: Trending Research
- Kicker: `⚡ TRENDING` (cyan)
- Haupt-Content: Top-Peptid aus `chartData` (höchster Count)
- Sub: `{count.toLocaleString()} Studien · PubMed`
- CTA: `→ Entdecken` → triggert Suche für dieses Peptid
- Top-Border: `border-t-2 border-sky-500`

### Card 2: Most Studied
- Kicker: `🧬 MEISTERFORSCHT` (violet)
- Haupt-Content: Peptid-Name + Count aus chartData[0]
- Sub: "Meisterforschtestes Peptid aktuell"
- CTA: `→ Entdecken`
- Top-Border: `border-t-2 border-violet-500`

### Card 3: New Clinical Papers
- Kicker: `🔬 NEU KLINISCH` (blue)
- Haupt-Content: `articles.length` als Zahl
- Sub: "Studien geladen · sortiert nach Datum"
- CTA: kein CTA (nur Info)
- Top-Border: `border-t-2 border-blue-500`

**Card-Styling:**
- `bg-[#0B1220] border border-white/[0.06] rounded-2xl p-4`
- Hover: `bg-[#111827] -translate-y-0.5 transition-all duration-200`
- Kicker: `IBM Plex Mono text-[0.58rem] uppercase tracking-wider`
- Hauptzahl/-Name: `Space Grotesk text-xl font-black text-white`
- Sub: `Inter text-xs text-slate-500 mt-0.5`

**Props:** `chartData: ChartEntry[]`, `articles: PubMedArticle[]`, `onSearch(query: string)`

---

## Section 3: Featured Study Card (in `StudyCard.tsx`)

**Variant: `featured`** — erster Artikel im Feed

**Layout:**
- `bg-[#0B1220] border-l-4 {peptideAccent} rounded-2xl p-5 mb-4`
- Top-Row: `[STUDY TYPE BADGE]` links, `[EVIDENCE BADGE]` + Datum rechts

**Elemente:**
- Study Type Badge: `IBM Plex Mono text-[0.6rem] font-black uppercase px-2 py-0.5 rounded-md`
- Evidence Badge: Farbige Pille (🟢/🟡/🔴/⚪) + Text
- Titel: `Space Grotesk text-base font-black text-white leading-snug`
- Meta: `Inter text-xs text-slate-500` — Autor + Journal
- Divider mit Label: `IBM Plex Mono text-[0.58rem] text-sky-400/60 uppercase tracking-widest`
- Summary-Text: Erster Abschnitt des Abstracts (350 Zeichen), `text-sm text-slate-400 leading-relaxed`
- Tags: `rounded-full bg-slate-800 text-slate-400 text-[0.65rem] px-2 py-0.5`
- Buttons: `btn-primary` (Zusammenfassung lesen → Detail-Seite) + `btn-secondary` (PubMed)

**Key Findings** (2 Bullets):
- Aus `getKeyFindings(abstract)` — splittet Abstract an `. `, nimmt Satz 2 und 3
- Falls kein Abstract: keine Bullets

---

## Section 4: Study Feed (`StudyFeed.tsx` + `StudySidebar.tsx`)

### Desktop Layout
```tsx
<div className="flex gap-6">
  <StudySidebar className="hidden md:block w-52 shrink-0 sticky top-4 self-start" />
  <div className="flex-1 min-w-0">
    {/* Featured Card + kompakte Cards */}
  </div>
</div>
```

### StudySidebar (`StudySidebar.tsx`)

**Kein Card-Container** — direkt auf Page-BG, `space-y-6`

**Filter-Sections:**
1. **Studientyp** — Radio: Alle / Human / Tier / Meta-Analyse / Klinisch
2. **Sortieren** — Radio: Neueste / Relevanz
3. **Jahr** — Radio: Alle / 2024+ / 2025

**Styling:**
- Section-Label: `IBM Plex Mono text-[0.55rem] uppercase tracking-widest text-slate-600 mb-2`
- Option inaktiv: `text-xs text-slate-400 flex items-center gap-2 cursor-pointer`
- Option aktiv: `text-sky-400` + kleiner Cyan-Dot `w-1.5 h-1.5 rounded-full bg-sky-400`
- Aktiver State: CSS `before`-Pseudo-Element oder `<span>` als Dot

**Props:** `filters: FilterState`, `onChange(filters: FilterState)`, `onApply()`

**Sidebar-Filter zu PubMed-Query Mapping:**
| UI-Filter | PubMed Term Anhang |
|---|---|
| Human | `AND human[MeSH]` |
| Tier | `AND (rat OR mouse OR animal)` |
| Meta-Analyse | `AND (systematic review OR meta-analysis)` |
| Klinisch | `AND clinical trial[pt]` |
| 2024+ | `AND ("2024"[PDat] : "3000"[PDat])` |
| 2025 | `AND "2025"[PDat]` |

### Kompakte Study Card (`StudyCard` variant: `compact`)

**Layout:** `bg-[#0B1220] border border-white/[0.06] rounded-xl p-4`

**Elemente:**
- Top-Row: `[STUDY TYPE]` + `[EVIDENCE]` + Peptid + Jahr — alles in einer Zeile
- Titel: `Inter text-sm font-semibold text-white line-clamp-2`
- Snippet: 120 Zeichen, `text-xs text-slate-500`
- Key Findings: 2 Bullets aus `getKeyFindings(abstract)`
- Bottom-Row: `[♡ Speichern]` (disabled, tooltip "Coming soon") + `[↗ PubMed]`
- Hover: `bg-[#111827] transition-colors duration-150`
- Klick auf Karte (nicht auf Buttons): → Detail-Seite

---

## Section 5: Study Detail Page (`StudyDetail.tsx`)

**Route:** `/lab/study/:id` — registriert in `App.tsx`

**Daten:** Via React Router `state: { article: PubMedArticle }`. Falls `state` fehlt: Fehler-UI mit "Studie nicht gefunden" + Back-Button.

**Layout:** `max-w-2xl mx-auto px-4 py-6 space-y-6`

**Sections:**

### 1. Back-Navigation
`← Zurück zur Forschung` — `navigate(-1)`, `text-sm text-slate-500 hover:text-slate-300`

### 2. Header
- Study Type Badge + Evidence Badge + Jahr
- Titel: `Space Grotesk text-2xl font-black text-white leading-snug`
- Meta: Autor + Journal, `Inter text-sm text-slate-500`

### 3. Zusammenfassung (Card)
- Label: `IBM Plex Mono uppercase text-sky-400/60 text-[0.58rem]`
- Text: Voller Abstract, `Inter text-sm text-slate-300 leading-relaxed`
- Falls kein Abstract: "Kein Abstract verfügbar."

### 4. Key Findings (Card)
- Label: `IBM Plex Mono` — "KEY FINDINGS"
- 3–4 Bullets aus `getKeyFindings(abstract)` (erste 4 Sätze)
- Bullet-Style: `• text-sm text-slate-300`
- Falls Abstract zu kurz: Section wird nicht gerendert

### 5. Evidence Analyse (Card)
- Label: "EVIDENCE ANALYSE"
- Zeigt: Studientyp + Score + Kontext-Hinweis
- Kontext-Hinweis je Score:
  - Stark: "Hochqualitative Evidenz, direkt auf Menschen anwendbar."
  - Moderat: "Solide Humandaten, weitere Studien empfohlen."
  - Präklinisch: "Tierstudie — zeigt Potenzial, braucht Human-Bestätigung."
  - Unbekannt: "Studientyp nicht klassifiziert."

### 6. Originaler Abstract (Accordion)
- Eingeklappt per Default
- `<details>` / `<summary>` oder State-Toggle
- Zeigt rohen Abstract-Text

### 7. PubMed Button
- `btn-primary w-full` — `href={article.link}` target blank

---

## Utility Functions (`labUtils.ts`)

```typescript
export type EvidenceScore = 'strong' | 'moderate' | 'preclinical' | 'unknown'
export type StudyType = 'clinical' | 'meta' | 'human' | 'animal' | 'study'

export function getEvidenceScore(title: string, abstract: string): EvidenceScore
export function getStudyType(title: string, abstract: string): StudyType
export function getStudyTypeLabel(type: StudyType): string  // DE-Label
export function getKeyFindings(abstract: string): string[]  // 2-4 Sätze
```

**`getKeyFindings` Logik:**
1. Split Abstract an `. `
2. Filter Sätze < 20 Zeichen (zu kurz)
3. Nimm Sätze 1–4 (nicht Satz 0 — der ist oft die Einleitung)
4. Return max 4 Sätze

---

## App.tsx Änderung

```tsx
import { StudyDetail } from './pages/StudyDetail'

// In Routes:
<Route path="lab" element={<TheLab />} />
<Route path="lab/study/:id" element={<StudyDetail />} />
```

---

## index.html Änderung

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700;900&family=IBM+Plex+Mono:wght@700&display=swap" rel="stylesheet">
```

---

## Mobile Strategy

| Element | Mobile | Desktop |
|---|---|---|
| Hero | Zentriert, Search volle Breite | Linksbündig |
| Snapshot Cards | Vertical Stack (1 col) | 3 Spalten |
| Filter | Bottom Sheet (FilterSheet.tsx) | Sticky Sidebar |
| Featured Card | Volle Breite | Volle Breite |
| Study Feed | Keine Sidebar | Sidebar + Feed |
| Detail Page | Single Column | Zentriert, max-w-2xl |

---

## Spec Self-Review

- ✅ Kein TBD/TODO
- ✅ AI-Features explizit aus Scope ausgeschlossen
- ✅ Save-Button disabled mit "Coming soon" — kein falsches Versprechen
- ✅ `getKeyFindings` Logik konkret definiert
- ✅ Evidence-Heuristik vollständig (alle 4 Score-Typen + Kontext-Hinweise)
- ✅ Datenfluss für Detail-Seite klar (Router state, Fallback definiert)
- ✅ Alle neuen Sidebar-Filter zu PubMed-Query gemappt
- ✅ Schriften konkret (Google Fonts CDN, 2 Weights je Font)
- ✅ Scope: fokussiert genug für einen Implementation-Plan
