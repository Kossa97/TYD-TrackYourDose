# Peptipedia Publication Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 66 Peptipedia profiles publication-ready under one transparent evidence, identity, source-freshness, and editorial-safety contract.

**Architecture:** Extend the existing repository-backed `PeptipediaEntry` model instead of introducing a second content system. Validation remains the single gate used by tests, build, and the new scheduled audit; the UI renders the same structured fields without calculating a composite score.

**Tech Stack:** TypeScript 6, React 19, Vitest, Testing Library, ESLint 10, Vite 8, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-14-peptipedia-publication-readiness-design.md`

## Global Constraints

- Keep the existing dark design, typography, colors, routes, and horizontally scrollable mobile tabs.
- Do not add dosage recommendations, cycles, or individualized treatment advice. Keep the existing arithmetic-only reconstitution calculator on the public website and out of the personal app; it must not infer a dose or cycle.
- Use primary studies, systematic reviews, official labels, and regulator sources; keep approval claims regional and product-specific.
- Medical and legal review statuses remain `pending` until real external reviewers are documented.
- Separate Git worktrees, build outputs, and generated files are outside main-workspace lint scope.

---

### Task 1: Evidence, identity, and editorial contract

**Files:**
- Modify: `src/features/peptipedia/content/types.ts`
- Modify: `src/features/peptipedia/content/validate.ts`
- Modify: `src/features/peptipedia/content/validate.test.ts`
- Modify: `src/features/peptipedia/content/entries/catalogue-profile.ts`

**Interfaces:**
- Produces: `PeptideIdentity`, `EvidenceMatrix`, `EditorialReview`, required `PeptipediaSource.accessedAt`, and validators consumed by every later task.

- [ ] **Step 1: Write failing behavioral tests**

Add literal fixtures proving that validation rejects: a source without `accessedAt`; an entry without all six matrix dimensions; an ambiguous identity without bilingual warnings; a blank safety area; and a dosage-like public recommendation while editorial review is pending.

```ts
expect(() => assertValidPeptipedia([entryWithoutSourceAccessDate])).toThrow('accessedAt')
expect(() => assertValidPeptipedia([entryWithoutMatrix])).toThrow('evidence matrix')
expect(() => assertValidPeptipedia([ambiguousEntryWithoutWarning])).toThrow('identity warning')
expect(() => assertValidPeptipedia([entryWithEmptySafety])).toThrow('safety context')
expect(() => assertValidPeptipedia([pendingEntryWithDoseAdvice])).toThrow('dosage recommendation')
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/peptipedia/content/validate.test.ts`

Expected: FAIL because the new fields and validation rules do not exist.

- [ ] **Step 3: Add the minimal model**

```ts
export type IdentityStatus = 'confirmed' | 'ambiguous' | 'brand_or_blend' | 'complex_mixture'
export interface PeptideIdentity {
  status: IdentityStatus
  description: Record<PeptipediaLocale, string>
}
export interface EvidenceMatrix {
  human: 'none' | 'very_limited' | 'limited' | 'moderate' | 'strong'
  replication: 'none' | 'single_group' | 'multiple_groups' | 'systematic'
  endpoints: 'none' | 'surrogate' | 'symptom_or_function' | 'hard_outcome'
  safety: 'insufficient' | 'limited' | 'characterized'
}
export interface EditorialReview {
  medical: 'pending' | 'approved'
  legal: 'pending' | 'approved'
}
```

Keep regional approvals as the sixth matrix dimension and identity as the first. Remove `evidence.score`; retain the existing human/animal/clinical values only if needed as a temporary compatibility layer, never as a visible score or sort key.

- [ ] **Step 4: Implement validation and catalogue defaults**

Require valid calendar dates, bilingual identity descriptions, nonempty safety explanations, real source references, and pending editorial review defaults. Detect recommendation language only in public recommendation fields, not in verbatim study amounts.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/features/peptipedia/content/validate.test.ts src/features/peptipedia/content/index.test.ts`

Expected: PASS.

---

### Task 2: Complete the 66-profile catalogue

**Files:**
- Modify: `src/features/peptipedia/content/entries/bpc-157.ts`
- Modify: `src/features/peptipedia/content/entries/tb-500.ts`
- Modify: `src/features/peptipedia/content/entries/ipamorelin.ts`
- Modify: `src/features/peptipedia/content/entries/cjc-1295.ts`
- Modify: `src/features/peptipedia/content/entries/ghrp-2.ts`
- Modify: `src/features/peptipedia/content/entries/sermorelin.ts`
- Modify: `src/features/peptipedia/content/entries/semaglutid.ts`
- Modify: `src/features/peptipedia/content/entries/tirzepatid.ts`
- Modify: `src/features/peptipedia/content/entries/selank.ts`
- Modify: `src/features/peptipedia/content/entries/epithalon.ts`
- Modify: `src/features/peptipedia/content/entries/ghk-cu.ts`
- Modify: `src/features/peptipedia/content/entries/catalogue-metabolic.ts`
- Modify: `src/features/peptipedia/content/entries/catalogue-hormones.ts`
- Modify: `src/features/peptipedia/content/entries/catalogue-neuro.ts`
- Modify: `src/features/peptipedia/content/entries/catalogue-experimental.ts`
- Modify: `src/features/peptipedia/content/entries/catalogue-bioregulators.ts`
- Modify: `src/features/peptipedia/content/entries/catalogue-blends.ts`
- Modify: `src/features/peptipedia/content/index.test.ts`

**Interfaces:**
- Consumes: `PeptideIdentity`, `EvidenceMatrix`, required `accessedAt`, and the validator from Task 1.
- Produces: 66 bilingual entries satisfying the publication contract.

- [ ] **Step 1: Add a failing catalogue completeness test**

The test iterates through all real entries and asserts the externally observable contract: 66 unique profiles, at least one source, no empty safety text, valid identity metadata, full evidence matrix, reviewed date, and all source access dates.

```ts
expect(PEPTIPEDIA_ENTRIES).toHaveLength(66)
for (const entry of PEPTIPEDIA_ENTRIES) {
  expect(entry.sources.length).toBeGreaterThan(0)
  expect(entry.identity.description.de.trim()).not.toBe('')
  expect(entry.identity.description.en.trim()).not.toBe('')
  expect(entry.copy.de.researchGaps.length).toBeGreaterThan(0)
  expect(entry.copy.en.researchGaps.length).toBeGreaterThan(0)
  expect(entry.sources.every(source => /^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt))).toBe(true)
}
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/peptipedia/content/index.test.ts`

Expected: FAIL listing incomplete entries.

- [ ] **Step 3: Update core, metabolic, and hormone profiles**

Use the audit’s cited primary/regulator sources, verify claims against their exact population, route, product, region, and current date, and fill both locales. Explicitly cover BPC-157, TB-500, Ipamorelin, CJC-1295 DAC, GHRP-2, Sermorelin, Semaglutid, Tirzepatid, Selank, Epithalon, GHK-Cu, Cagrilintide, Survodutide, MOTS-c, Glutathion, PT-141, Somatropin, hCG, hMG, Oxytocin, Kisspeptin, GHRP-6, and CJC-1295 NO DAC.

- [ ] **Step 4: Update neuro, experimental, bioregulator, and blend profiles**

Explicitly cover ARA-290, DSIP, Semax, PE-22-28, Pinealon, FOXO4-DRI, IGF-1 LR3, KPV, LL-37, MGF, PEG-MGF, PNC-27, Chonluten, Cortagen, Prostamax, Livagen, Vilon, Testagen, Vesugen, Adamax, Cartalax, Ovagen, and every blend. Unverifiable brand/blend identities remain visibly unresolved and must never inherit evidence from components.

- [ ] **Step 5: Run and verify GREEN**

Run: `npm test -- src/features/peptipedia/content/index.test.ts src/features/peptipedia/content/validate.test.ts`

Expected: PASS for all 66 profiles.

---

### Task 3: Render the transparent evidence matrix

**Files:**
- Modify: `src/features/peptipedia/components/PeptidePanels.tsx`
- Modify: `src/features/peptipedia/components/PeptideSummary.tsx`
- Modify: `src/pages/lab/PeptideCard.tsx`
- Modify: `src/pages/PeptideLibrary.tsx`
- Modify: `src/features/peptipedia/content/uiCopy.ts`
- Modify: `src/features/peptipedia/display.ts`
- Modify: `src/features/peptipedia/components/PeptidePanels.test.tsx`
- Modify: `src/pages/PeptideDetailPage.public.test.tsx`
- Modify: `src/pages/PeptideLibrary.public.test.tsx`

**Interfaces:**
- Consumes: Task 1 evidence and identity fields.
- Produces: user-visible matrix, identity warnings, explicit safety gaps, and source access dates.

- [ ] **Step 1: Write failing UI tests**

Assert that a rendered detail page shows `Molekülidentität`, `Humanforschung`, `Replikation`, `Klinische Endpunkte`, `Sicherheit`, and `Zulassung`, while no `/10`, `Hohe Konfidenz`, `Niedrige Konfidenz`, or `Nicht bewertet` label is present. Assert that ambiguous identities produce a visible warning and sources show an access date.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- src/features/peptipedia/components/PeptidePanels.test.tsx src/pages/PeptideDetailPage.public.test.tsx src/pages/PeptideLibrary.public.test.tsx`

Expected: FAIL because the six-dimensional UI is missing.

- [ ] **Step 3: Implement the matrix and warnings**

Reuse existing cards and spacing. Use text labels rather than a composite visual score. Render identity warnings before tabs, safety gaps as warning copy, regional approval chips unchanged, and `Abgerufen: YYYY-MM-DD` / `Accessed: YYYY-MM-DD` beside each source.

- [ ] **Step 4: Remove confidence sorting and labels**

Library ordering must be deterministic by existing category/name rules or editorial order, not by an evidence score. Delete visible confidence-copy paths and any obsolete score-to-label helpers made unused by this task.

- [ ] **Step 5: Run and verify GREEN**

Run the three focused UI test files. Expected: PASS.

---

### Task 4: Freshness audit and scheduled check

**Files:**
- Create: `scripts/audit-peptipedia.ts`
- Create: `scripts/audit-peptipedia.test.ts`
- Create: `.github/workflows/peptipedia-content-audit.yml`
- Modify: `package.json`

**Interfaces:**
- Produces: `auditPeptipedia(entries, today)` and `npm run peptipedia:audit`.

- [ ] **Step 1: Write a failing audit test**

Use hand-written dates to prove a normal profile becomes stale after 180 days and an approved profile after 90 days. Assert exact structured findings rather than grepping source code.

```ts
expect(auditPeptipedia([approvedEntry], new Date('2026-09-14'))).toContainEqual({
  slug: 'approved-entry', code: 'stale-approved-review', severity: 'error'
})
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- scripts/audit-peptipedia.test.ts`

Expected: FAIL because the audit module does not exist.

- [ ] **Step 3: Implement the pure audit and CLI**

The pure function returns findings for dates, missing source metadata, safety gaps, unresolved identity warnings, unsourced approvals, and recommendation fields. The CLI prints actionable lines and exits nonzero for errors.

- [ ] **Step 4: Add local and weekly execution**

Add `"peptipedia:audit": "tsx --tsconfig tsconfig.app.json scripts/audit-peptipedia.ts"`. Add a weekly GitHub Actions workflow using Node 20, `npm ci`, and the audit script. The workflow never edits content.

- [ ] **Step 5: Run and verify GREEN**

Run: `npm test -- scripts/audit-peptipedia.test.ts` and `npm run peptipedia:audit`.

Expected: tests PASS and the current catalogue has no overdue/error finding as of 2026-09-14.

---

### Task 5: External-review gate and checklist

**Files:**
- Create: `docs/research/peptipedia-external-review-checklist.md`
- Modify: `src/features/peptipedia/content/validate.test.ts`
- Modify: `src/features/peptipedia/content/validate.ts`

**Interfaces:**
- Consumes: `EditorialReview` from Task 1.
- Produces: enforceable pending status and a human review checklist.

- [ ] **Step 1: Add failing gate tests**

Assert that missing review status is rejected; `approved` without reviewer name/date is rejected; and dosage or cycle recommendation fields are rejected while either status is pending.

- [ ] **Step 2: Run and verify RED**

Run the validation test file and confirm the new cases fail for the intended missing rules.

- [ ] **Step 3: Implement the gate**

Store global editorial status in a single exported policy object with both statuses `pending`. Reviewer identity and date are optional only while pending. Do not insert fictional reviewer metadata.

- [ ] **Step 4: Write the external checklist**

Document medical review of indication, route, evidence, interactions, contraindications, protocol framing, and risk language; legal review of German/EU medical-advertising, consumer information, privacy, liability, and jurisdiction. State plainly that the checklist is not itself a professional approval.

- [ ] **Step 5: Verify GREEN**

Run validation and catalogue tests. Expected: PASS with both gates still pending.

---

### Task 6: Main-workspace lint and final verification

**Files:**
- Modify: `eslint.config.js`
- Modify only files reported by `npm run lint` within the main workspace.

**Interfaces:**
- Produces: zero-error global lint for the main workspace without runtime behavior changes.

- [ ] **Step 1: Establish the failing lint baseline**

Run: `npm run lint`

Expected: FAIL. Record errors by rule and file. Confirm `.worktrees/**`, `dist/**`, coverage, and generated outputs are excluded rather than repaired as main code.

- [ ] **Step 2: Fix configuration scope**

Add only explicit non-source ignores such as `.worktrees/**`, `dist/**`, and `coverage/**`. Re-run lint and record the real main-code failures.

- [ ] **Step 3: Resolve real errors surgically**

Remove unused imports/variables, replace explicit `any` with existing domain types or `unknown` plus narrowing, and fix hook dependency issues without changing behavior. Do not reformat or refactor unrelated modules.

- [ ] **Step 4: Run the full verification matrix**

Run:

```text
npm run lint
npm test
npm run peptipedia:audit
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 5: Visual verification**

Open the built preview and inspect library plus confirmed, ambiguous, approved, experimental, and blend detail pages at desktop and mobile widths. Confirm the horizontal tabs remain swipeable and no composite confidence label is visible.
