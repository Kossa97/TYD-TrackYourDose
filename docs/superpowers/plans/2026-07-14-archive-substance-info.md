# Archive Substance Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-screen read-only information view for archived substances, including complete substance metadata and compact summaries of all associated cycles.

**Architecture:** Keep the feature inside `Peptide.tsx`, where archived peptides, inventory, and all cycles are already available. Add one selected-archive-info state, render a nested accessible full-screen dialog, and reuse existing formatting helpers and `PeptideVialVisual`; no route, query, schema change, or dependency is needed.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React, Vitest, i18next, date-fns

## Global Constraints

- The archive list remains compact and retains restore and delete actions.
- The detail view is read-only and full-screen.
- Cycle content is limited to name, status, date range, dose, frequency, and method.
- Existing archive persistence, carousel behavior, and liquid animation are unchanged.
- No new network request, database field, route, or dependency is introduced.

---

### Task 1: Define The Archive Detail Contract With A Regression Test

**Files:**
- Modify: `src/pages/Peptide.test.ts`

**Interfaces:**
- Produces: assertions for `archiveInfoPeptide`, `data-archive-info-button`, `data-archive-info-detail`, substance field output, `cyclesOf(p.id)`, and accessible nested-dialog behavior.

- [ ] **Step 1: Add a failing source regression test**

Add a test that reads `Peptide.tsx` and asserts that the archive row contains an information button, the selected peptide opens a full-screen nested dialog, the dialog renders the saved vial/application/reconstitution/stock/batch/document/notes fields, and cycle summaries are obtained from `cyclesOf(p.id)`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/pages/Peptide.test.ts`

Expected: FAIL because `data-archive-info-button` and `data-archive-info-detail` do not exist.

- [ ] **Step 3: Add nested-dialog accessibility assertions**

Assert dialog semantics, a labelled heading, Escape precedence for the detail view, focus scoping to the nested detail dialog, and focus restoration to the originating information button.

---

### Task 2: Implement The Information Button And Full-Screen Detail

**Files:**
- Modify: `src/pages/Peptide.tsx:500-620`
- Modify: `src/pages/Peptide.tsx:2759-2859`

**Interfaces:**
- Consumes: `Peptide`, `Cycle`, `cyclesOf(pid)`, `inventory`, `PeptideVialVisual`, `METHOD_KEYS`, `FREQ_KEYS`, and the existing `t`/`i18n` instances.
- Produces: `archiveInfoPeptide: Peptide | null`, `closeArchiveInfo()`, and the nested `data-archive-info-detail` dialog.

- [ ] **Step 1: Add selected-detail state and focus restoration**

Add `archiveInfoPeptide` state and an information-button ref map. Implement `closeArchiveInfo()` to clear the selection and restore focus to the selected row's information button on the next animation frame.

- [ ] **Step 2: Extend archive keyboard containment**

Treat `[data-archive-info-detail]` as the active nested focus scope. Escape closes archive deletion first when present, otherwise closes archive detail, and only then closes the archive itself.

- [ ] **Step 3: Add the row information action**

Insert an icon-only `Info` button before restore. Give it a 44 by 44 pixel target, accessible label/title, stable data attributes, and set `archiveInfoPeptide` on click.

- [ ] **Step 4: Render the read-only full-screen detail**

Render a fixed `z-[60]` surface with a safe-area header and back button. Show the gray empty compact vial, archive date, definition-list style substance fields, external document link, notes, and every `cyclesOf(p.id)` entry with the approved compact fields. Show `t('keine_zyklen')` when the list is empty.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- src/pages/Peptide.test.ts`

Expected: all Peptide tests pass.

---

### Task 3: Verify And Publish

**Files:**
- Review: `src/pages/Peptide.tsx`
- Review: `src/pages/Peptide.test.ts`

**Interfaces:**
- Consumes: the complete repository test and build scripts.
- Produces: a reviewed commit ready for `main`.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: all test files and tests pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 3: Check the final diff**

Run: `git diff --check` and inspect `git diff --stat`.

Expected: no whitespace errors and only the spec, plan, Peptide page, and Peptide test are changed.

- [ ] **Step 4: Commit and push**

Stage the four scoped files, commit with `feat: add archived substance details`, fetch `origin/main`, verify it is an ancestor, and push `HEAD:main` without force.
