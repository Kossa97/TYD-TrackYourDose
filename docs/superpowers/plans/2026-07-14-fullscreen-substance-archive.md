# Fullscreen Substance Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the My Stack archive into a full-screen, vertically stacked substance list with gray empty vial previews and accurate archive dates.

**Architecture:** Extend the existing peptide soft-delete record with `archived_at`, then reuse `PeptideVialVisual` inside a full-screen archive overlay. Existing archive loading, restore, and permanent-delete flows remain in `Peptide.tsx`; no new route or state store is introduced.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Supabase, Vitest, i18next

## Global Constraints

- The archive entry button remains in the My Stack header.
- Archive rows are a compact vertical list, not a carousel or card grid.
- The vial preview is gray, empty, inactive, compact, and does not animate on mount.
- Restore and delete remain directly visible icon actions with 44 by 44 pixel targets.
- Main carousel, cycles, liquid physics, and active substance cards are unchanged.
- The Supabase schema update must be applied before the frontend depends on `archived_at`.

---

### Task 1: Persist and Localize the Archive Timestamp

**Files:**
- Modify: `supabase-archive.sql`
- Modify: `src/pages/Peptide.tsx:44-55,570-572,840-867`
- Modify: `src/pages/Peptide.test.ts`
- Modify: `src/i18n/locales/ar.json`
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/hi.json`
- Modify: `src/i18n/locales/id.json`
- Modify: `src/i18n/locales/it.json`
- Modify: `src/i18n/locales/ja.json`
- Modify: `src/i18n/locales/ko.json`
- Modify: `src/i18n/locales/pt.json`
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/tr.json`
- Modify: `src/i18n/locales/zh.json`

**Interfaces:**
- Produces: `Peptide.archived_at: string | null`
- Produces: locale key `archiviert_am` with `{{date}}`

- [ ] **Step 1: Write failing timestamp and localization tests**

Extend the existing source-style Peptide tests to require:

```ts
expect(text).toContain('archived_at: string | null')
expect(text).toContain("update({ archived: true, archived_at: new Date().toISOString() })")
expect(text).toContain("update({ archived: false, archived_at: null })")
expect(text).toContain("order('archived_at', { ascending: false, nullsFirst: false })")
```

Read `supabase-archive.sql` and every locale JSON. Require `archived_at timestamptz` in SQL and require each `archiviert_am` value to include `{{date}}`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- src/pages/Peptide.test.ts
```

Expected: FAIL because the timestamp column, update values, ordering, and localization key do not exist.

- [ ] **Step 3: Add the timestamp data flow**

Add the idempotent schema extension:

```sql
alter table peptides
  add column if not exists archived_at timestamptz;
```

Add `archived_at` to `Peptide`, order archived records newest first, set it in the archive update, and clear it in the restore update.

- [ ] **Step 4: Add all locale labels**

Add `archiviert_am` to all 14 locale JSON files. Each translation must retain the `{{date}}` interpolation token.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/pages/Peptide.test.ts
```

Expected: PASS.

---

### Task 2: Replace the Archive Sheet With a Full-Screen List

**Files:**
- Modify: `src/pages/Peptide.tsx:2600-2725`
- Modify: `src/pages/Peptide.test.ts`

**Interfaces:**
- Consumes: `Peptide.archived_at`
- Consumes: `archiviert_am` locale key
- Consumes: existing `restorePeptide`, `setDeletePromptPeptide`, and `PeptideVialVisual`

- [ ] **Step 1: Write the failing full-screen list test**

Require stable archive selectors and visual props:

```ts
expect(text).toContain('data-archive-fullscreen')
expect(text).toContain('data-archive-row')
expect(text).toContain('className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-slate-950"')
expect(text).toContain('fillPct={0}')
expect(text).toContain('color="#64748b"')
expect(text).toContain('animateOnMount={false}')
expect(text).toContain('size="compact"')
expect(text).toContain("t('archiviert_am'")
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npm test -- src/pages/Peptide.test.ts
```

Expected: FAIL because the archive is still an 85dvh bottom sheet without vial rows.

- [ ] **Step 3: Implement the full-screen shell and rows**

Replace the backdrop and bottom-sheet container with one `fixed inset-0` full-screen surface. Keep a safe-area-aware fixed header and a scrollable list body. Render each row with a 64-pixel compact vial area, flexible name/date content, and two 44-pixel icon buttons.

Format the date with `Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language)` and interpolate it through `t('archiviert_am', { date })`.

Increase the existing permanent-delete confirmation overlay above the archive layer so confirmation remains visible without closing the archive.

- [ ] **Step 4: Verify focused behavior**

Run:

```bash
npm test -- src/pages/Peptide.test.ts
npx eslint src/pages/Peptide.tsx src/pages/Peptide.test.ts
```

Expected: PASS with no lint errors.

---

### Task 3: Verify, Commit, and Publish

**Files:**
- Verify all files changed in Tasks 1 and 2

**Interfaces:**
- Produces: deployable frontend and idempotent Supabase schema patch

- [ ] **Step 1: Run complete automated verification**

```bash
npm test
npm run build
git diff --check
```

Expected: all tests pass, production build exits zero, and the diff has no whitespace errors.

- [ ] **Step 2: Perform responsive visual verification**

Run the app and inspect the archive at mobile and desktop widths. Verify the full viewport is occupied, the header remains visible, rows do not overflow, vial previews are empty and gray, and both action targets remain usable.

- [ ] **Step 3: Apply the schema patch**

Apply the `archived_at` statement from `supabase-archive.sql` to the linked Supabase project before relying on the new frontend update payload.

- [ ] **Step 4: Commit the isolated change**

Stage only the archive implementation, tests, locale files, SQL patch, design, and plan. Commit with:

```bash
git commit -m "feat: redesign substance archive"
```

- [ ] **Step 5: Push directly to main**

Fetch `origin/main`, verify a fast-forward push, push `HEAD:main`, and confirm the remote hash.
