# Public Peptipedia Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Peptipedia publicly accessible with repository-owned bilingual content, pre-rendered searchable pages, and a sticky horizontal tab layout that preserves the current visual design.

**Architecture:** Public pages read synchronously from validated TypeScript content entries instead of Supabase. React renders the same pure presentation components both in the browser and during a post-Vite pre-render step; client hydration adds search, tabs, URL fragments, and calculator interaction. Personal app routes remain inside `ProtectedRoute`, while public Peptipedia routes and legacy redirects sit outside it.

**Tech Stack:** React 19, TypeScript 6, React Router 7, Vite 8, Vitest 3, React Testing Library, Tailwind CSS 3, React DOM server rendering

**Spec:** `docs/superpowers/specs/2026-09-08-public-peptipedia-tabs-design.md`

## Global Constraints

- This is not a redesign: preserve the current Peptipedia fonts, font sizes, colors, surfaces, cards, radii, shadows, spacing, and motion.
- Public content supports exactly German (`de`) and English (`en`) in the first release.
- Publish exactly these eleven slugs: `bpc-157`, `tb-500`, `ipamorelin`, `cjc-1295`, `ghrp-2`, `sermorelin`, `semaglutid`, `tirzepatid`, `selank`, `epithalon`, `ghk-cu`.
- Supabase must not be queried to render the public overview or public peptide details.
- Quantitative study details require a direct primary source; animal and laboratory quantities are never converted to human quantities.
- The calculator accepts only user-entered targets and must not contain peptide-specific doses, presets, recommendations, or cycles.
- Personal data and all non-Peptipedia app pages remain protected exactly as they are now.
- Every code task follows test-driven development and ends with a focused commit.

---

## File Structure

### Content and domain

- Create `src/features/peptipedia/content/types.ts` — public Peptipedia domain types.
- Create `src/features/peptipedia/content/validate.ts` — deterministic runtime validation used by tests and the build.
- Create `src/features/peptipedia/content/uiCopy.ts` — German and English labels used by public components and pre-rendering.
- Create `src/features/peptipedia/content/entries/*.ts` — one bilingual, independently reviewable file for each of the eleven peptides.
- Create `src/features/peptipedia/content/index.ts` — validated published index and synchronous selectors.
- Create `src/features/peptipedia/content/validate.test.ts` and `index.test.ts` — schema, completeness, and selector tests.

### Public UI

- Create `src/features/peptipedia/components/PeptipediaTabs.tsx` — accessible horizontal tab strip only.
- Create `src/features/peptipedia/components/PeptideSummary.tsx` — card-derived summary header.
- Create `src/features/peptipedia/components/PeptidePanels.tsx` — overview, mechanism, protocols, safety, and sources panels.
- Create `src/features/peptipedia/components/PeptideCalculatorPanel.tsx` — user-input-only calculator UI.
- Create `src/features/peptipedia/components/PeptipediaTabs.test.tsx` and `PeptideCalculatorPanel.test.tsx` — interaction tests.
- Create `src/features/peptipedia/lib/reconstitution.ts` and `reconstitution.test.ts` — pure unit validation and calculations.
- Create `src/features/peptipedia/PeptipediaPublicLayout.tsx` — public shell without personal navigation or onboarding.
- Modify `src/pages/PeptideLibrary.tsx` — synchronous repository content, public navigation, no admin affordance.
- Modify `src/pages/PeptideDetailPage.tsx` — thin route page composed from summary, tabs, and panels.
- Modify `src/pages/lab/PeptideCard.tsx` — consume the repository summary type while preserving markup and classes.

### Routing and static output

- Create `src/features/peptipedia/routing.ts` and `routing.test.ts` — locale, slug, legacy redirect, and tab-fragment helpers.
- Create `src/features/peptipedia/LegacyPeptipediaRedirect.tsx` — redirects old protected library links.
- Modify `src/App.tsx` — add public German and English routes outside `ProtectedRoute`.
- Create `src/App.peptipedia-routes.test.tsx` — verifies public and protected route boundaries.
- Modify `src/components/Layout.tsx` — point the existing Peptipedia shortcut to `/peptipedia`.
- Create `src/features/peptipedia/seo.ts` and `seo.test.ts` — deterministic metadata and route manifest.
- Create `src/features/peptipedia/usePeptipediaHead.ts` — updates metadata after client-side navigation.
- Create `scripts/prerender-peptipedia.ts` and `scripts/prerender-peptipedia.test.ts` — generate route HTML, sitemap, and robots output.
- Modify `src/main.tsx` — hydrate pre-rendered markup and use normal mounting elsewhere.
- Modify `package.json` — testing dependencies and post-build pre-render command.
- Modify `vitest.config.ts` — include script tests without changing the default Node environment.
- Modify `vercel.json` — keep filesystem-first behavior and document the public static route expectation.

---

### Task 1: Define and validate the repository content contract

**Files:**
- Create: `src/features/peptipedia/content/types.ts`
- Create: `src/features/peptipedia/content/validate.ts`
- Test: `src/features/peptipedia/content/validate.test.ts`

**Interfaces:**
- Produces: `PeptipediaEntry`, `PeptipediaLocale`, `PeptipediaCopy`, `StudyProtocol`, `PeptipediaSource`, `assertValidPeptipedia(entries)`.
- Consumes: no new feature interfaces.

- [ ] **Step 1: Write failing validation tests**

```ts
import { describe, expect, it } from 'vitest'
import { assertValidPeptipedia } from './validate'
import type { PeptipediaEntry } from './types'

const validEntry: PeptipediaEntry = {
  slug: 'bpc-157',
  name: 'BPC-157',
  fullName: 'Body Protection Compound 157',
  category: 'heilung',
  researchStatus: 'preclinical',
  evidence: { human: 'limited', animal: 'strong', clinical: 'sparse', score: 2 },
  reviewedAt: '2026-09-08',
  contentVersion: 1,
  sources: [{ id: 'fda-bpc-risk', kind: 'regulator', title: 'FDA safety risks', year: 2024, url: 'https://www.fda.gov/example' }],
  copy: {
    de: { tldr: 'Kurze Einordnung.', mechanism: 'Mechanismus.', researchAreas: ['Regeneration'], overviewFacts: [], researchGaps: ['Humandaten'], sideEffects: [], contraindications: [], interactions: [], protocols: [] },
    en: { tldr: 'Short classification.', mechanism: 'Mechanism.', researchAreas: ['Recovery'], overviewFacts: [], researchGaps: ['Human data'], sideEffects: [], contraindications: [], interactions: [], protocols: [] },
  },
}

describe('assertValidPeptipedia', () => {
  it('accepts a complete bilingual entry', () => {
    expect(() => assertValidPeptipedia([validEntry])).not.toThrow()
  })

  it('rejects duplicate slugs', () => {
    expect(() => assertValidPeptipedia([validEntry, validEntry])).toThrow('Duplicate slug: bpc-157')
  })

  it('rejects protocols whose source id is absent', () => {
    const broken = structuredClone(validEntry)
    broken.copy.de.protocols.push({
      id: 'study-1', evidenceType: 'animal', populationOrModel: 'Rat model', route: 'Oral',
      amount: '10 µg/kg as reported', frequency: 'Once daily', duration: '7 days',
      objective: 'Tissue response', outcome: 'Observed endpoint', sourceIds: ['missing-source'],
    })
    expect(() => assertValidPeptipedia([broken])).toThrow('Unknown source missing-source')
  })
})
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `npm test -- src/features/peptipedia/content/validate.test.ts`  
Expected: FAIL because `types.ts` and `validate.ts` do not exist.

- [ ] **Step 3: Add the exact domain types**

```ts
export type PeptipediaLocale = 'de' | 'en'
export type PeptideCategory = 'heilung' | 'wachstumshormon' | 'nootropikum' | 'stoffwechsel' | 'anti_aging' | 'sexualgesundheit'
export type ResearchStatus = 'preclinical' | 'phase_1' | 'phase_2' | 'approved'
export type EvidenceLevel = 'none' | 'limited' | 'moderate' | 'strong'
export type ClinicalLevel = 'none' | 'sparse' | 'moderate' | 'extensive'
export type ProtocolEvidenceType = 'approved_label' | 'human' | 'animal' | 'laboratory'
export type SourceKind = 'approved_label' | 'human_study' | 'animal_study' | 'laboratory_study' | 'regulator'

export interface PeptipediaSource {
  id: string
  kind: SourceKind
  title: string
  year: number
  url: string
  doi?: string
}

export interface SourcedOverviewFact {
  id: string
  label: string
  value: string
  sourceIds: string[]
}

export interface StudyProtocol {
  id: string
  evidenceType: ProtocolEvidenceType
  populationOrModel: string
  route: string
  amount: string
  frequency: string
  duration: string
  objective: string
  outcome: string
  sourceIds: string[]
}

export interface PeptipediaCopy {
  tldr: string
  mechanism: string
  researchAreas: string[]
  overviewFacts: SourcedOverviewFact[]
  researchGaps: string[]
  sideEffects: string[]
  contraindications: string[]
  interactions: string[]
  protocols: StudyProtocol[]
}

export interface PeptipediaEntry {
  slug: string
  name: string
  fullName: string | null
  category: PeptideCategory
  researchStatus: ResearchStatus
  evidence: { human: EvidenceLevel; animal: EvidenceLevel; clinical: ClinicalLevel; score: number }
  reviewedAt: string
  contentVersion: number
  sources: PeptipediaSource[]
  copy: Record<PeptipediaLocale, PeptipediaCopy>
}
```

- [ ] **Step 4: Implement strict validation**

`assertValidPeptipedia` must reject duplicate or malformed slugs, missing German or English copy, blank required strings, evidence scores outside `1..10`, invalid review dates, non-positive content versions, duplicate source IDs, non-HTTPS source URLs, empty protocol source lists, and protocol references to missing sources. Error messages must include the offending slug and field.

```ts
export function assertValidPeptipedia(entries: PeptipediaEntry[]): void {
  const slugs = new Set<string>()
  for (const entry of entries) {
    if (slugs.has(entry.slug)) throw new Error(`Duplicate slug: ${entry.slug}`)
    slugs.add(entry.slug)
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)) throw new Error(`${entry.slug}: invalid slug`)
    if (entry.evidence.score < 1 || entry.evidence.score > 10) throw new Error(`${entry.slug}: evidence.score`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedAt)) throw new Error(`${entry.slug}: reviewedAt`)
    if (!Number.isInteger(entry.contentVersion) || entry.contentVersion < 1) throw new Error(`${entry.slug}: contentVersion`)
    const sourceIds = new Set(entry.sources.map(source => source.id))
    if (sourceIds.size !== entry.sources.length) throw new Error(`${entry.slug}: duplicate source id`)
    for (const source of entry.sources) {
      if (!source.url.startsWith('https://')) throw new Error(`${entry.slug}: non-HTTPS source ${source.id}`)
    }
    for (const locale of ['de', 'en'] as const) {
      const copy = entry.copy[locale]
      if (!copy?.tldr.trim() || !copy.mechanism.trim()) throw new Error(`${entry.slug}: incomplete ${locale} copy`)
      for (const fact of copy.overviewFacts) {
        if (fact.sourceIds.length === 0) throw new Error(`${entry.slug}: overview fact ${fact.id} has no source`)
        for (const sourceId of fact.sourceIds) {
          if (!sourceIds.has(sourceId)) throw new Error(`Unknown source ${sourceId} in ${entry.slug}`)
        }
      }
      for (const protocol of copy.protocols) {
        if (protocol.sourceIds.length === 0) throw new Error(`${entry.slug}: protocol ${protocol.id} has no source`)
        for (const sourceId of protocol.sourceIds) {
          if (!sourceIds.has(sourceId)) throw new Error(`Unknown source ${sourceId} in ${entry.slug}`)
        }
      }
    }
  }
}
```

- [ ] **Step 5: Run the validation tests**

Run: `npm test -- src/features/peptipedia/content/validate.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit the contract**

```bash
git add src/features/peptipedia/content/types.ts src/features/peptipedia/content/validate.ts src/features/peptipedia/content/validate.test.ts
git commit -m "feat: define validated Peptipedia content model"
```

---

### Task 2: Migrate and source-audit the eleven peptide profiles

**Files:**
- Create: `src/features/peptipedia/content/uiCopy.ts`
- Create: `src/features/peptipedia/content/entries/bpc-157.ts`
- Create: `src/features/peptipedia/content/entries/tb-500.ts`
- Create: `src/features/peptipedia/content/entries/ipamorelin.ts`
- Create: `src/features/peptipedia/content/entries/cjc-1295.ts`
- Create: `src/features/peptipedia/content/entries/ghrp-2.ts`
- Create: `src/features/peptipedia/content/entries/sermorelin.ts`
- Create: `src/features/peptipedia/content/entries/semaglutid.ts`
- Create: `src/features/peptipedia/content/entries/tirzepatid.ts`
- Create: `src/features/peptipedia/content/entries/selank.ts`
- Create: `src/features/peptipedia/content/entries/epithalon.ts`
- Create: `src/features/peptipedia/content/entries/ghk-cu.ts`
- Create: `src/features/peptipedia/content/index.ts`
- Test: `src/features/peptipedia/content/index.test.ts`
- Read-only sources: `supabase-peptide-library.sql`, `supabase-peptide-library-v2.sql`, `supabase-peptide-library-v3.sql`, `src/i18n/locales/de.json`, `src/i18n/locales/en.json`

**Interfaces:**
- Consumes: `PeptipediaEntry`, `PeptipediaLocale`, `assertValidPeptipedia` from Task 1.
- Produces: `PUBLISHED_PEPTIDES`, `getPublishedPeptides(locale)`, `getPublishedPeptide(slug, locale)`, `PeptipediaView`.

- [ ] **Step 1: Write the failing completeness test**

```ts
import { describe, expect, it } from 'vitest'
import { PUBLISHED_PEPTIDES, getPublishedPeptide, getPublishedPeptides } from './index'

const EXPECTED_SLUGS = [
  'bpc-157', 'tb-500', 'ipamorelin', 'cjc-1295', 'ghrp-2', 'sermorelin',
  'semaglutid', 'tirzepatid', 'selank', 'epithalon', 'ghk-cu',
]

describe('published Peptipedia index', () => {
  it('publishes exactly the approved eleven slugs', () => {
    expect(PUBLISHED_PEPTIDES.map(entry => entry.slug)).toEqual(EXPECTED_SLUGS)
  })

  it.each(['de', 'en'] as const)('returns complete %s views', locale => {
    const views = getPublishedPeptides(locale)
    expect(views).toHaveLength(11)
    expect(views.every(view => view.tldr && view.mechanism && view.reviewedAt)).toBe(true)
  })

  it('returns null for an unpublished slug', () => {
    expect(getPublishedPeptide('unknown', 'de')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the completeness test and verify failure**

Run: `npm test -- src/features/peptipedia/content/index.test.ts`  
Expected: FAIL because the published index does not exist.

- [ ] **Step 3: Create bilingual interface copy**

Define the six tab labels, headings, empty states, protocol evidence labels, calculator labels, disclaimers, 404 copy, public navigation copy, and source labels in one typed `Record<PeptipediaLocale, PeptipediaUiCopy>`. Do not add entries to the other app locale files because public v1 supports only `de` and `en`.

- [ ] **Step 4: Audit each profile before encoding it**

For each of the eleven slugs, start with the current SQL and locale text, then verify every medical or quantitative claim against current primary material. Use approved labels and regulator pages for semaglutide, tirzepatide, and any other approved medicine. Use original human, animal, or laboratory papers for research-only peptides. Preserve existing administration and half-life information only as `overviewFacts` with direct source IDs; omit unsupported values rather than carrying over unsourced text. Remove community doses, supplier claims, secondary dosage charts, and claims without a direct source. Encode no protocol when an exact primary-source protocol cannot be verified.

Each entry must satisfy the complete `PeptipediaEntry` interface from Task 1 with real source IDs and no empty required values. German and English copy must express the same claims and cite the same underlying sources. When a qualifying exact protocol cannot be verified, store `protocols: []`; the interface then renders the explicit no-data state rather than inferred dosing. When the evidence does not support a specific adverse effect, contraindication, interaction, or mechanism, state the limitation in `researchGaps` and leave the unsupported list empty instead of inventing content.

- [ ] **Step 5: Build and validate the published index**

```ts
export type PeptipediaView = Omit<PeptipediaEntry, 'copy'> & PeptipediaCopy & { locale: PeptipediaLocale }

const entries = [bpc157, tb500, ipamorelin, cjc1295, ghrp2, sermorelin, semaglutid, tirzepatid, selank, epithalon, ghkCu]
assertValidPeptipedia(entries)
export const PUBLISHED_PEPTIDES = Object.freeze(entries)

function toView(entry: PeptipediaEntry, locale: PeptipediaLocale): PeptipediaView {
  const { copy, ...shared } = entry
  return Object.freeze({ ...shared, locale, ...copy[locale] })
}

export function getPublishedPeptides(locale: PeptipediaLocale): PeptipediaView[] {
  return PUBLISHED_PEPTIDES.map(entry => toView(entry, locale))
}

export function getPublishedPeptide(slug: string, locale: PeptipediaLocale): PeptipediaView | null {
  const entry = PUBLISHED_PEPTIDES.find(candidate => candidate.slug === slug)
  return entry ? toView(entry, locale) : null
}
```

`toView` merges the language-neutral identity, evidence, source metadata, and requested `copy[locale]` into an immutable view without falling back to Supabase or another locale.

- [ ] **Step 6: Run content tests and TypeScript validation**

Run: `npm test -- src/features/peptipedia/content/validate.test.ts src/features/peptipedia/content/index.test.ts`  
Expected: PASS with exactly eleven entries in both locales.

Run: `npx tsc -b --pretty false`  
Expected: PASS.

- [ ] **Step 7: Commit the reviewed repository content**

```bash
git add src/features/peptipedia/content
git commit -m "feat: version reviewed Peptipedia content"
```

---

### Task 3: Switch the library and cards to synchronous public content

**Files:**
- Modify: `src/pages/PeptideLibrary.tsx`
- Modify: `src/pages/lab/PeptideCard.tsx`
- Test: `src/pages/PeptideLibrary.public.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `getPublishedPeptides(locale)`, `PeptipediaView`, `PEPTIPEDIA_UI_COPY` from Task 2.
- Produces: public overview that renders without Supabase and cards that navigate to locale-correct routes.

- [ ] **Step 1: Install the already-authorized test-only dependencies**

Run: `npm install --save-dev jsdom @testing-library/react @testing-library/dom`  
Expected: only `devDependencies` and the lockfile change.

- [ ] **Step 2: Write the failing public-library test**

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { PeptideLibrary } from './PeptideLibrary'

vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(() => { throw new Error('Supabase must not run') }) } }))

describe('public Peptipedia library', () => {
  it('renders repository entries without a Supabase query', () => {
    render(<MemoryRouter initialEntries={['/peptipedia']}><PeptideLibrary locale="de" /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Peptipedia' })).toBeTruthy()
    expect(screen.getByText('BPC-157')).toBeTruthy()
    expect(screen.queryByText('Admin')).toBeNull()
  })
})
```

- [ ] **Step 3: Run the test and verify the prop/API failure**

Run: `npm test -- src/pages/PeptideLibrary.public.test.tsx`  
Expected: FAIL because `PeptideLibrary` has no locale prop and still uses the Supabase service.

- [ ] **Step 4: Replace asynchronous state with the repository selector**

Change the page signature to `PeptideLibrary({ locale }: { locale: PeptipediaLocale })`, calculate `const peptides = getPublishedPeptides(locale)`, and keep the existing search/filter/sort markup and styling. Remove loading, network error, skeleton, source-table label, and admin button. Pass `locale` to each card.

Update `PeptideCard` to accept `{ peptide: PeptipediaView; locale: PeptipediaLocale }` and navigate with:

```ts
const detailPath = locale === 'en'
  ? `/en/peptipedia/${peptide.slug}`
  : `/peptipedia/${peptide.slug}`
```

Preserve all current card classes and DOM hierarchy except data/translation wiring.

- [ ] **Step 5: Run the focused test**

Run: `npm test -- src/pages/PeptideLibrary.public.test.tsx`  
Expected: PASS and the Supabase mock remains untouched.

- [ ] **Step 6: Commit the public overview**

```bash
git add package.json package-lock.json src/pages/PeptideLibrary.tsx src/pages/PeptideLibrary.public.test.tsx src/pages/lab/PeptideCard.tsx
git commit -m "feat: render Peptipedia library from repository content"
```

---

### Task 4: Add public routing and preserve protected app boundaries

**Files:**
- Create: `src/features/peptipedia/routing.ts`
- Create: `src/features/peptipedia/routing.test.ts`
- Create: `src/features/peptipedia/LegacyPeptipediaRedirect.tsx`
- Create: `src/features/peptipedia/PeptipediaPublicLayout.tsx`
- Modify: `src/App.tsx`
- Test: `src/App.peptipedia-routes.test.tsx`
- Modify: `src/components/Layout.tsx`

**Interfaces:**
- Consumes: public page components and locale type from Tasks 2–3.
- Produces: `peptipediaListPath(locale)`, `peptipediaDetailPath(locale, slug)`, `LegacyPeptipediaRedirect`, and public routes.

- [ ] **Step 1: Write failing routing-helper tests**

```ts
import { describe, expect, it } from 'vitest'
import { peptipediaDetailPath, peptipediaListPath } from './routing'

describe('Peptipedia paths', () => {
  it('uses unprefixed German URLs', () => expect(peptipediaListPath('de')).toBe('/peptipedia'))
  it('uses stable English URLs', () => expect(peptipediaListPath('en')).toBe('/en/peptipedia'))
  it('encodes detail slugs', () => expect(peptipediaDetailPath('en', 'bpc-157')).toBe('/en/peptipedia/bpc-157'))
})
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- src/features/peptipedia/routing.test.ts`  
Expected: FAIL because `routing.ts` does not exist.

- [ ] **Step 3: Implement pure path helpers and the legacy redirect**

```ts
export const peptipediaListPath = (locale: PeptipediaLocale) => locale === 'en' ? '/en/peptipedia' : '/peptipedia'
export const peptipediaDetailPath = (locale: PeptipediaLocale, slug: string) => `${peptipediaListPath(locale)}/${encodeURIComponent(slug)}`
```

`LegacyPeptipediaRedirect` reads the optional `slug` parameter and returns `<Navigate replace to={slug ? peptipediaDetailPath('de', slug) : peptipediaListPath('de')} />`.

- [ ] **Step 4: Build the public shell by reusing existing visual values**

`PeptipediaPublicLayout` renders the existing dark page atmosphere, a restrained Peptipedia header, a link to `/auth` or the app when already authenticated, and `<Outlet />`. It must not render `LanguageGate`, `Onboarding`, bottom navigation, push prompts, quick actions, or admin navigation.

- [ ] **Step 5: Move library routes outside `ProtectedRoute`**

Add these top-level routes inside the existing providers but before the protected layout route:

```tsx
<Route element={<PeptipediaPublicLayout locale="de" />}>
  <Route path="peptipedia" element={<LazyPage><PeptideLibrary locale="de" /></LazyPage>} />
  <Route path="peptipedia/:slug" element={<LazyPage><PeptideDetailPage locale="de" /></LazyPage>} />
</Route>
<Route element={<PeptipediaPublicLayout locale="en" />}>
  <Route path="en/peptipedia" element={<LazyPage><PeptideLibrary locale="en" /></LazyPage>} />
  <Route path="en/peptipedia/:slug" element={<LazyPage><PeptideDetailPage locale="en" /></LazyPage>} />
</Route>
<Route path="lab/library" element={<LegacyPeptipediaRedirect />} />
<Route path="lab/library/:slug" element={<LegacyPeptipediaRedirect />} />
```

Remove the two old library routes from the protected `<Route path="/" ...>`, leave `/lab/admin` protected, and change the existing `QUICK_TILES` Peptipedia path to `/peptipedia`.

- [ ] **Step 6: Run routing and production compilation checks**

Before running the checks, add a jsdom route-boundary test that mocks the public page modules with visible labels, mocks `ProtectedRoute` with a `PROTECTED_GATE` label, navigates `window.history` to `/peptipedia`, and asserts the public label renders without `PROTECTED_GATE`. In a second test navigate to `/lab/admin` and assert `PROTECTED_GATE` renders. This proves route placement instead of only testing path helpers.

Run: `npm test -- src/features/peptipedia/routing.test.ts src/pages/PeptideLibrary.public.test.tsx src/App.peptipedia-routes.test.tsx`  
Expected: PASS.

Run: `npx tsc -b --pretty false`  
Expected: PASS.

- [ ] **Step 7: Commit public routing**

```bash
git add src/App.tsx src/App.peptipedia-routes.test.tsx src/components/Layout.tsx src/features/peptipedia/routing.ts src/features/peptipedia/routing.test.ts src/features/peptipedia/LegacyPeptipediaRedirect.tsx src/features/peptipedia/PeptipediaPublicLayout.tsx
git commit -m "feat: expose Peptipedia on public routes"
```

---

### Task 5: Implement the card-like summary and sticky horizontal tabs

**Files:**
- Create: `src/features/peptipedia/components/PeptideSummary.tsx`
- Create: `src/features/peptipedia/components/PeptipediaTabs.tsx`
- Create: `src/features/peptipedia/components/PeptipediaTabs.test.tsx`
- Modify: `src/pages/PeptideDetailPage.tsx`
- Test: `src/pages/PeptideDetailPage.public.test.tsx`

**Interfaces:**
- Consumes: `PeptipediaView`, locale UI copy, `getPublishedPeptide`.
- Produces: `PeptipediaTabId`, `PEPTIPEDIA_TAB_IDS`, `TAB_HASHES`, `PeptipediaTabs`, summary header, URL-fragment selection.

- [ ] **Step 1: Write failing interaction tests**

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PeptipediaTabs } from './PeptipediaTabs'

describe('PeptipediaTabs', () => {
  it('marks overview as the default and calls onSelect for safety', () => {
    const onSelect = vi.fn()
    render(<PeptipediaTabs locale="de" active="overview" onSelect={onSelect} />)
    expect(screen.getByRole('tab', { name: 'Überblick' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: 'Sicherheit' }))
    expect(onSelect).toHaveBeenCalledWith('safety')
  })

  it('exposes all six tabs in the approved order', () => {
    render(<PeptipediaTabs locale="de" active="overview" onSelect={() => undefined} />)
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
      'Überblick', 'Wirkung', 'Studienprotokolle', 'Rechner', 'Sicherheit', 'Quellen',
    ])
  })
})
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- src/features/peptipedia/components/PeptipediaTabs.test.tsx`  
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the accessible tab strip**

Use native buttons with `role="tab"`, `aria-selected`, `aria-controls`, and matching panels. The wrapper uses `overflow-x-auto`, hidden scrollbar styling already available or a small locally scoped rule, `min-h-11`, and `sticky` with the actual public header offset. Do not create new color tokens. Use the current sky accent, slate text hierarchy, existing borders, and existing transition durations.

```ts
export const PEPTIPEDIA_TAB_IDS = ['overview', 'mechanism', 'protocols', 'calculator', 'safety', 'sources'] as const
export type PeptipediaTabId = typeof PEPTIPEDIA_TAB_IDS[number]

export const TAB_HASHES: Record<PeptipediaLocale, Record<PeptipediaTabId, string>> = {
  de: { overview: 'ueberblick', mechanism: 'wirkung', protocols: 'studienprotokolle', calculator: 'rechner', safety: 'sicherheit', sources: 'quellen' },
  en: { overview: 'overview', mechanism: 'mechanism', protocols: 'study-protocols', calculator: 'calculator', safety: 'safety', sources: 'sources' },
}

export function tabFromHash(locale: PeptipediaLocale, hash: string): PeptipediaTabId {
  const candidate = hash.replace(/^#/, '')
  return PEPTIPEDIA_TAB_IDS.find(id => TAB_HASHES[locale][id] === candidate) ?? 'overview'
}
```

Derive the active tab from `useLocation().hash`. Selecting a tab calls React Router's `navigate` with the current pathname/search and the locale-specific hash from `TAB_HASHES`. German therefore uses `#ueberblick`, `#wirkung`, `#studienprotokolle`, `#rechner`, `#sicherheit`, and `#quellen`; English uses the corresponding English hashes. React Router restores browser back/forward selection. Invalid fragments fall back to `overview`.

- [ ] **Step 4: Implement the summary from the existing card design**

`PeptideSummary` displays category, status, evidence score/label, name, full name, and `tldr`. Reuse the exact current font families (`Space Grotesk`, `IBM Plex Mono`), Tailwind color classes, badges, spacing scale, and evidence treatment from `PeptideCard` and the current detail header. Do not add the mockup's molecule icon, new gradients, new badges, or new typography.

- [ ] **Step 5: Compose the detail page synchronously**

Change `PeptideDetailPage` to accept `{ locale }`, read `slug`, call `getPublishedPeptide(slug, locale)` synchronously, render the public 404 state when null, then render breadcrumb, `PeptideSummary`, existing research disclaimer, `PeptipediaTabs`, and every panel. Inactive panels remain in the document with `hidden`; they are not omitted from the rendered HTML. Remove loading state, duplicate mechanism accordion, Supabase service import, and generic PubMed-search CTA.

- [ ] **Step 6: Run tab tests and inspect at narrow width**

Add a page test that renders `/peptipedia/bpc-157`, asserts the repository `tldr` appears above the tablist, and asserts all six tab panels exist in the DOM while only Overview lacks `hidden`. Add a second case for `/peptipedia/unknown` that asserts the public 404 copy and back link.

Run: `npm test -- src/features/peptipedia/components/PeptipediaTabs.test.tsx src/pages/PeptideDetailPage.public.test.tsx`  
Expected: PASS.

Run: `npm run dev -- --host 127.0.0.1` and inspect `/peptipedia/bpc-157` at 320px and 390px widths.  
Expected: no page-level horizontal overflow; later tabs become reachable by horizontal tab-strip scrolling; the selected state remains visible.

- [ ] **Step 7: Commit the new information hierarchy**

```bash
git add src/pages/PeptideDetailPage.tsx src/pages/PeptideDetailPage.public.test.tsx src/features/peptipedia/components/PeptideSummary.tsx src/features/peptipedia/components/PeptipediaTabs.tsx src/features/peptipedia/components/PeptipediaTabs.test.tsx
git commit -m "feat: add sticky Peptipedia detail tabs"
```

---

### Task 6: Add evidence-separated panels and the safe calculator

**Files:**
- Create: `src/features/peptipedia/components/PeptidePanels.tsx`
- Create: `src/features/peptipedia/components/PeptidePanels.test.tsx`
- Create: `src/features/peptipedia/components/PeptideCalculatorPanel.tsx`
- Create: `src/features/peptipedia/components/PeptideCalculatorPanel.test.tsx`
- Create: `src/features/peptipedia/lib/reconstitution.ts`
- Create: `src/features/peptipedia/lib/reconstitution.test.ts`
- Modify: `src/pages/PeptideDetailPage.tsx`

**Interfaces:**
- Consumes: `PeptipediaView`, `PeptipediaTabId`, locale copy.
- Produces: `calculateReconstitution(input): ReconstitutionResult`, six tab panels.

- [ ] **Step 1: Write failing calculator-domain tests**

```ts
import { describe, expect, it } from 'vitest'
import { calculateReconstitution } from './reconstitution'

describe('calculateReconstitution', () => {
  it('calculates from an explicitly entered microgram target', () => {
    expect(calculateReconstitution({ vialAmountMg: 5, diluentMl: 2, targetDose: 250, targetUnit: 'mcg', syringeCapacityMl: 1, syringeUnits: 100 })).toEqual({
      concentrationMcgPerMl: 2500,
      drawMl: 0.1,
      drawUnits: 10,
      dosesPerVial: 20,
    })
  })

  it('normalizes a user-entered milligram target', () => {
    expect(calculateReconstitution({ vialAmountMg: 5, diluentMl: 2, targetDose: 0.25, targetUnit: 'mg', syringeCapacityMl: 1, syringeUnits: 100 })?.drawUnits).toBe(10)
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid vial amount %s', vialAmountMg => {
    expect(() => calculateReconstitution({ vialAmountMg, diluentMl: 2, targetDose: 250, targetUnit: 'mcg', syringeCapacityMl: 1, syringeUnits: 100 })).toThrow('vialAmountMg')
  })
})
```

- [ ] **Step 2: Run the domain test and verify failure**

Run: `npm test -- src/features/peptipedia/lib/reconstitution.test.ts`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure mass-based calculation**

```ts
export type DoseMassUnit = 'mcg' | 'mg'

export interface ReconstitutionInput {
  vialAmountMg: number
  diluentMl: number
  targetDose: number
  targetUnit: DoseMassUnit
  syringeCapacityMl: number
  syringeUnits: number
}

export function calculateReconstitution(input: ReconstitutionInput) {
  for (const [field, value] of Object.entries(input)) {
    if (field === 'targetUnit') continue
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new Error(field)
  }
  const targetMcg = input.targetUnit === 'mg' ? input.targetDose * 1000 : input.targetDose
  const concentrationMcgPerMl = input.vialAmountMg * 1000 / input.diluentMl
  const drawMl = targetMcg / concentrationMcgPerMl
  if (drawMl > input.syringeCapacityMl) throw new Error('target_exceeds_syringe_capacity')
  return {
    concentrationMcgPerMl,
    drawMl,
    drawUnits: drawMl * input.syringeUnits / input.syringeCapacityMl,
    dosesPerVial: Math.floor(input.vialAmountMg * 1000 / targetMcg),
  }
}
```

Do not support `IU`; an IU-to-mass conversion is substance-specific and would violate the unit-safety requirement.

- [ ] **Step 4: Write failing panel tests**

Test that only the selected panel is visible, protocols show evidence type plus every structured field and source link, animal protocols are labeled as animal data, empty protocols show the approved no-data message, source links use `target="_blank"` and `rel="noopener noreferrer"`, and calculator inputs start empty.

- [ ] **Step 5: Implement the five content panels**

Create `OverviewPanel`, `MechanismPanel`, `ProtocolsPanel`, `SafetyPanel`, and `SourcesPanel` inside `PeptidePanels.tsx`. Reuse the current `SectionCard` visual markup by moving it into this file. Do not duplicate `tldr` inside Overview; show identity/evidence facts, research areas, and any sourced administration or pharmacokinetic `overviewFacts` there because the short explanation already appears above the tabs.

Protocols must render `evidenceType`, `populationOrModel`, `route`, `amount`, `frequency`, `duration`, `objective`, `outcome`, and each referenced source. Never concatenate a synthetic recommendation sentence.

- [ ] **Step 6: Implement the calculator panel**

Use controlled empty string inputs for vial amount, diluent volume, target amount, target unit (`mcg` or `mg`), syringe capacity, and syringe units. Convert to numbers only when all inputs are present, call the pure function, display field-specific validation errors, and render the existing permanent disclaimer. Do not read My Stack, Supabase, peptide content, or URL parameters to prefill any amount.

- [ ] **Step 7: Run focused tests**

Run: `npm test -- src/features/peptipedia/lib/reconstitution.test.ts src/features/peptipedia/components/PeptidePanels.test.tsx src/features/peptipedia/components/PeptideCalculatorPanel.test.tsx`  
Expected: PASS.

- [ ] **Step 8: Commit panels and calculator**

```bash
git add src/pages/PeptideDetailPage.tsx src/features/peptipedia/components/PeptidePanels.tsx src/features/peptipedia/components/PeptidePanels.test.tsx src/features/peptipedia/components/PeptideCalculatorPanel.tsx src/features/peptipedia/components/PeptideCalculatorPanel.test.tsx src/features/peptipedia/lib/reconstitution.ts src/features/peptipedia/lib/reconstitution.test.ts
git commit -m "feat: add sourced Peptipedia panels and calculator"
```

---

### Task 7: Pre-render public pages and generate SEO output

**Files:**
- Create: `src/features/peptipedia/seo.ts`
- Create: `src/features/peptipedia/seo.test.ts`
- Create: `src/features/peptipedia/usePeptipediaHead.ts`
- Create: `scripts/prerender-peptipedia.ts`
- Create: `scripts/prerender-peptipedia.test.ts`
- Modify: `src/main.tsx`
- Modify: `package.json`
- Modify: `vitest.config.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: `PUBLISHED_PEPTIDES`, path helpers, pure public page components.
- Produces: `peptipediaRouteManifest`, `buildPeptipediaMeta`, generated HTML under `dist/`, `sitemap.xml`, `robots.txt`.

- [ ] **Step 1: Write failing manifest and metadata tests**

```ts
import { describe, expect, it } from 'vitest'
import { buildPeptipediaMeta, peptipediaRouteManifest } from './seo'

describe('Peptipedia SEO manifest', () => {
  it('contains two list pages and twenty-two detail pages', () => {
    expect(peptipediaRouteManifest()).toHaveLength(24)
  })

  it('builds canonical and alternate URLs', () => {
    const meta = buildPeptipediaMeta('https://example.test', 'de', 'bpc-157')
    expect(meta.canonical).toBe('https://example.test/peptipedia/bpc-157')
    expect(meta.alternates.en).toBe('https://example.test/en/peptipedia/bpc-157')
    expect(meta.title).toContain('BPC-157')
  })
})
```

- [ ] **Step 2: Run SEO tests and verify failure**

Run: `npm test -- src/features/peptipedia/seo.test.ts`  
Expected: FAIL because `seo.ts` does not exist.

- [ ] **Step 3: Implement the route manifest and metadata**

The manifest contains one German list route, one English list route, and both locale routes for all eleven slugs. `buildPeptipediaMeta(origin, locale, slug?)` returns language, title, description from the repository content, canonical URL, reciprocal `de`/`en` alternate URLs, and Open Graph title/description/url.

- [ ] **Step 4: Add client-side metadata synchronization**

Create `usePeptipediaHead(meta)` to update `document.title`, description, canonical, `hreflang`, and Open Graph elements from the same `buildPeptipediaMeta` result after client-side navigation. Call it from both public pages so navigation from the overview to a profile does not retain overview metadata.

- [ ] **Step 5: Write the failing pre-render file-output test**

Use a test-owned temporary directory and assert that pre-rendering writes:

```text
peptipedia/index.html
peptipedia/bpc-157/index.html
en/peptipedia/index.html
en/peptipedia/bpc-157/index.html
sitemap.xml
robots.txt
```

Assert that the BPC-157 HTML contains its title, `tldr`, canonical link, both alternate-language links, and text from panels beyond the default Overview tab.

- [ ] **Step 6: Implement deterministic post-build pre-rendering**

`scripts/prerender-peptipedia.ts` must:

1. read `dist/index.html` as the Vite template;
2. resolve origin from `VITE_PUBLIC_SITE_URL`, then `VERCEL_PROJECT_PRODUCTION_URL`, then `VERCEL_URL`, using `http://localhost:4173` only outside Vercel;
3. render each manifest route with `renderToString`, wrapping the existing route page in a `MemoryRouter` and matching `Routes`/`Route` declaration for that path so `useParams` and navigation context receive the same inputs as the browser;
4. replace `<div id="root"></div>` with the rendered root markup;
5. set `<html lang>`, title, description, canonical, alternates, and Open Graph tags;
6. write route-specific `index.html` files;
7. write XML-escaped `sitemap.xml` and origin-correct `robots.txt`;
8. fail with a non-zero exit when validation, template markers, origin parsing, rendering, or file writes fail.

Export a testable `prerenderPeptipedia({ distDir, origin })` function. Execute it only when the script is the process entry point.

- [ ] **Step 7: Hydrate only pre-rendered roots**

Modify `src/main.tsx` to import `hydrateRoot` and select the mount method after `i18nReady`:

```tsx
const root = document.getElementById('root')!
const app = <StrictMode><App /></StrictMode>
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
```

- [ ] **Step 8: Wire the production build**

Change scripts to:

```json
{
  "build": "tsc -b && vite build && tsx scripts/prerender-peptipedia.ts"
}
```

Extend Vitest's include list with `scripts/**/*.test.ts`. Preserve Vercel's existing `{ "handle": "filesystem" }` before the SPA fallback so generated route files win over `/index.html`.

- [ ] **Step 9: Run focused tests and a production build**

Run: `npm test -- src/features/peptipedia/seo.test.ts scripts/prerender-peptipedia.test.ts`  
Expected: PASS.

Run: `npm run build`  
Expected: PASS and all 24 public route files plus sitemap and robots files exist under `dist/`.

- [ ] **Step 10: Commit pre-rendering and SEO**

```bash
git add package.json package-lock.json vitest.config.ts vercel.json src/main.tsx src/pages/PeptideLibrary.tsx src/pages/PeptideDetailPage.tsx src/features/peptipedia/seo.ts src/features/peptipedia/seo.test.ts src/features/peptipedia/usePeptipediaHead.ts scripts/prerender-peptipedia.ts scripts/prerender-peptipedia.test.ts
git commit -m "feat: prerender searchable Peptipedia pages"
```

---

### Task 8: Complete accessibility, design-preservation, and release verification

**Files:**
- Modify only if a failing check requires it: files created or changed in Tasks 1–7
- Test: existing and new test suites

**Interfaces:**
- Consumes: the complete public Peptipedia slice.
- Produces: verified release candidate with no intentional API additions.

- [ ] **Step 1: Run all automated checks**

Run: `npm test`  
Expected: all tests pass.

Run: `npm run lint`  
Expected: zero lint errors.

Run: `npm run build`  
Expected: successful TypeScript, Vite, and pre-render output.

- [ ] **Step 2: Verify public/protected boundaries without a session**

Serve the production output and open `/peptipedia`, `/peptipedia/bpc-157`, `/en/peptipedia`, and `/en/peptipedia/bpc-157` in a logged-out browser. Confirm each renders without redirecting to `/auth`. Open `/`, `/lab/admin`, `/peptide`, and `/simulation`; confirm each still requires authentication.

- [ ] **Step 3: Verify the legacy paths**

Open `/lab/library` and `/lab/library/bpc-157`. Confirm they replace history with `/peptipedia` and `/peptipedia/bpc-157` respectively, without exposing the admin page.

- [ ] **Step 4: Verify tab behavior and accessibility**

At 320px, 390px, 768px, and desktop width:

- confirm the tab strip is horizontally scrollable without page-level horizontal overflow;
- confirm all six tabs are reachable by touch and keyboard;
- confirm each tab has one associated panel and only the active panel is exposed;
- confirm German `#sicherheit` and English `#safety` reload into Safety and browser back/forward restores the previous tab;
- confirm the strip remains below the public header while scrolling;
- confirm focus remains visible and touch targets are at least approximately 44px high;
- confirm reduced-motion mode removes nonessential smooth movement.

- [ ] **Step 5: Verify visual preservation against the current main version**

Capture before/after screenshots of the Peptipedia list, card, detail header, section card, evidence bars, warning, and source link in dark and light mode. Compare typography, colors, card radii, borders, shadows, spacing, and state transitions. Revert any unrequested visual change; keep only the summary placement, horizontal tabs, sticky behavior, and new content grouping.

- [ ] **Step 6: Verify content safety and build independence**

Search the repository content for quantitative strings and manually confirm each appears inside a `StudyProtocol` with at least one resolvable direct primary source. Confirm every animal/laboratory protocol displays its evidence type. Confirm calculator inputs are empty on first render and remain empty after changing peptides. Disable Supabase network access and reload all public routes from production output; content must remain complete.

- [ ] **Step 7: Inspect generated search output**

Open four generated HTML files directly and confirm meaningful text from every tab is present in source, titles and descriptions are locale-correct, canonical URLs are absolute, reciprocal language alternates match, sitemap has 24 unique URLs, and robots points to the generated sitemap.

- [ ] **Step 8: Review the complete branch diff**

Run: `git diff --check main...HEAD`  
Expected: no whitespace errors.

Run: `git status --short`  
Expected: clean working tree.

Review every changed line and remove unrelated refactors, unused Supabase-removal work affecting AdminPanel, and any design changes not required by the specification.

- [ ] **Step 9: Commit only if verification required fixes**

```bash
git add src/features/peptipedia src/pages/PeptideLibrary.tsx src/pages/PeptideLibrary.public.test.tsx src/pages/PeptideDetailPage.tsx src/pages/PeptideDetailPage.public.test.tsx src/pages/lab/PeptideCard.tsx src/App.tsx src/App.peptipedia-routes.test.tsx src/components/Layout.tsx src/main.tsx scripts/prerender-peptipedia.ts scripts/prerender-peptipedia.test.ts package.json package-lock.json vitest.config.ts vercel.json
git commit -m "fix: finish Peptipedia release verification"
```

If verification required no edits, do not create an empty commit.

---

## Final Definition of Done

- All eleven peptide profiles are public in German and English from repository-owned, validated content.
- Peptipedia overview and detail pages perform no Supabase content query.
- The short peptide explanation appears above a sticky, horizontally wischable and tappable six-tab strip.
- The existing Peptipedia visual style is preserved.
- Protocol quantities are source-bound and evidence-separated; missing evidence produces an explicit no-data state.
- The calculator starts empty and performs only user-requested mass/volume arithmetic.
- Public routes are pre-rendered with canonical metadata, language alternates, sitemap, and robots output.
- Personal routes and admin remain protected.
- Tests, lint, build, accessibility checks, mobile checks, content audit, and generated HTML inspection all pass.
