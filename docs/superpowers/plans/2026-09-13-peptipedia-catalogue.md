# Peptipedia Catalogue Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline for this already-approved continuation. Steps use checkbox syntax.

**Goal:** Expand the existing bilingual Peptipedia from 11 to 66 profiles: 56 peptide/peptide-hormone profiles and 10 blends.

**Architecture:** Keep repository-owned synchronous content and the shared public/app components. Add optional blend composition, catalogue-only sources and nullable editorial scores; reuse existing cards and tabs.

**Tech Stack:** TypeScript, React, Vitest, Vite static prerender.

**Spec:** User-approved conversation: use peptidedosages.com as catalogue scope, include blends, exclude non-peptides, preserve styling and website-only calculator. Existing public layout: `docs/superpowers/specs/2026-09-08-public-peptipedia-tabs-design.md`.

## Global Constraints

- Work locally on main as requested; no push, deployment, Supabase or MyStack changes.
- DE/EN copy. Retain existing slugs; deduplicate vial strengths.
- Exclude 5-Amino-1MQ, AICAR, L-carnitine, NAD+ and SLU-PP-332.
- Catalogue sources support names/composition only, never efficacy or dosing.
- Modified or unspecified components must not silently link to a different molecule.
- No imported vendor dosing schedules or invented evidence scores.

## 1. Content model and catalogue

Files: `src/features/peptipedia/content/{types,validate,index}.ts`, new `entries/catalogue-*.ts`.
Interface: existing `PeptipediaEntry`, plus `aliases?: string[]`, `blend?: { components: {name:string;slug?:string}[]; sourceIds:string[] }`, `evidence.score: number | null`, source kind `catalog`, status `unverified`.

- [x] Extend `content/index.test.ts` to require exactly the approved 66 slugs.
- [x] Extend `content/validate.test.ts` to accept null scores and reject unknown component links.
- [x] Run these tests and observe expected failures (2026-09-13: 5 content failures).
- [x] Implement the interface and reject empty compositions, unknown/self/duplicate linked components and missing composition references.
- [x] Add sourced bilingual research summaries. Mark unresolved identities as preliminary; retain empty protocol sections where a full protocol has not been extracted.
- [x] Run `npm test -- src/features/peptipedia/content` and verify green.

## 2. Blend discovery and detail view

Files: `src/pages/PeptideLibrary.tsx`, `src/pages/lab/PeptideCard.tsx`, `src/pages/PeptideDetailPage.tsx`, `src/features/peptipedia/{display.ts,components/PeptideSummary.tsx,components/PeptidePanels.tsx,content/legacyLabels.ts}`.
Consumes optional entry metadata above. Produces All / Individual profiles / Blends filtering, ingredient/alias search, mode-aware ingredient links and explicit catalogue labels.

- [x] Add `src/pages/PeptideLibrary.blends.test.tsx` for filtering, app links, null scores and modified components.
- [x] Observe its three expected failures before implementation.
- [x] Implement existing pill-style filter, blend badge/composition and neutral unassessed display. Sort missing scores last.
- [x] Label catalogue sources in DE/EN; omit them from mechanism references.
- [x] Run `npm test -- src/pages/PeptideLibrary.blends.test.tsx` and verify green.

## 3. Regression and static pages

Files: existing `src/features/peptipedia/seo.test.ts`, `scripts/prerender-peptipedia.test.ts`, this verification record.

- [x] Extend route/sitemap expectation to 134 pages and check GLOW links in English HTML.
- [x] Run all tests, TypeScript/build and focused lint; inspect failures before changing anything unrelated.
- [x] Verify 134 public pages and existing app calculator exclusion.
- [x] Record evidence, content limitations and remaining editorial work. Keep work local; no automatic production publication.

## Verification — 2026-09-14

- Full `npm test`: 78 files, **609 tests passed**.
- `npm run build`: TypeScript, Vite and prerender succeeded; **134 public pages**. Existing large-bundle and service-worker deprecation warnings remain; no unrelated bundling changes made.
- Focused ESLint covering all Peptipedia components/content and changed tests: exit 0.
- `git diff --check`: exit 0 (Windows line-ending notices only).
- Browser at `http://127.0.0.1:4173`: GLOW composition and mobile-width layout observed. Updated Semax profile visibly shows human research and the 2018 source after the final build.
- Independent review identified calculator applicability and human-evidence filtering issues. Corrected with failing-then-passing regression tests: blends, Cerebrolysin, hCG, hMG and Oxytocin do not use inappropriate single-compound mass arithmetic; SS-31 and Semax appear in the human-data filter.

## Editorial boundaries and handoff

- 45 new individual short profiles plus 10 blends; original 11 entries retained.
- No full editorial evidence score assigned to the new entries. `null` is visibly “Not assessed”, not zero or an invented rating.
- Adamax, Cartalax and Ovagen are preliminary identity listings only. Medical identity/evidence still needs primary-source verification.
- New profiles use concise source-based summaries. Complete safety monographs, source-by-source evidence grading and exact study-protocol extraction remain future editorial work; empty sections explicitly mean not yet documented, not absence of risk.
- Blend composition is nominal catalogue composition, not a laboratory verification of any product. CJC variants and N-acetyl derivatives are not silently conflated. No vendor dose schedules imported.
- Local main checkout only. No commit, push, deployment, database mutation or MyStack change performed during this expansion.
