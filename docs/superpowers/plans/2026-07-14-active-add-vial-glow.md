# Active Add-Vial Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the "Neue Substanz" carousel tile illuminated while it is the centered active item.

**Architecture:** Reuse the existing `addTileActive` carousel state and pass it into `AddVialTile`. The tile maps that state to the same cyan visual treatment already used for hover and focus, without changing carousel interaction logic.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest

## Global Constraints

- Do not change carousel snapping, selection, click handling, vial lighting, or liquid animation.
- Keep hover and keyboard focus styling intact.
- Do not modify unrelated files.

---

### Task 1: Persist the Add-Vial Glow While Centered

**Files:**
- Modify: `src/pages/Peptide.tsx:443-460,1684-1688`
- Test: `src/pages/Peptide.test.ts`

**Interfaces:**
- Consumes: existing `addTileActive: boolean` state
- Produces: `AddVialTile` prop `active?: boolean`

- [ ] **Step 1: Write the failing regression test**

Add a source-level regression test following the existing Peptide test style:

```ts
test('keeps Neue Substanz illuminated while its carousel tile is active', () => {
  const text = source()

  expect(text).toContain('active={addTileActive}')
  expect(text).toContain("active ? 'border-cyan-400/45 bg-slate-900/40 text-cyan-200'")
  expect(text).toContain("active ? 'border-cyan-300/35 bg-cyan-300/10 shadow-[0_0_30px_rgba(34,211,238,0.18)]'")
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- src/pages/Peptide.test.ts
```

Expected: FAIL because `AddVialTile` does not consume `addTileActive` and has no persistent active classes.

- [ ] **Step 3: Implement the minimal active styling**

Extend `AddVialTile` with an optional `active` prop defaulting to `false`. Use `active` to select the cyan border/text/background and plus-button glow classes while retaining the current hover and focus classes. Pass the existing state at the carousel call site:

```tsx
<AddVialTile
  active={addTileActive}
  onClick={() => { if (!vialSuppressClickRef.current) handleNewPeptide() }}
  label={t('neues_peptid_title')}
/>
```

- [ ] **Step 4: Verify GREEN and regression safety**

Run:

```bash
npm test -- src/pages/Peptide.test.ts
npm test
npm run build
```

Expected: focused tests pass, full suite has zero failures, and the production build exits successfully.

- [ ] **Step 5: Commit the isolated implementation**

```bash
git add src/pages/Peptide.tsx src/pages/Peptide.test.ts docs/superpowers/plans/2026-07-14-active-add-vial-glow.md
git commit -m "fix: highlight active add vial tile"
```
