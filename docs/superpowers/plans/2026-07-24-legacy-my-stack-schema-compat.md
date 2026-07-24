# Legacy My Stack Schema Compatibility Implementation Plan

> **Goal:** Keep the existing My Stack UI and behavior intact while moving all
> runtime persistence paths from the removed peptide schema names to the current
> stack schema names.

## Task 1: Lock the compatibility contract with failing tests

**Files:**

- Create: `src/lib/legacyMyStackPersistence.test.ts`
- Create: `src/lib/legacyStackSchemaContract.test.ts`

1. Test that a legacy peptide draft is saved through `save_stack_item`.
2. Test that the saved row receives the existing vial/tracking fields afterward.
3. Test that the returned `display_name` is exposed as the old `name` property.
4. Scan the affected runtime files and reject old `peptides` table queries,
   old `peptide_id` database columns and old embedded relations.
5. Run the focused tests and confirm that they fail before implementation.

## Task 2: Add the narrow old-UI persistence adapter

**Files:**

- Create: `src/lib/legacyMyStackPersistence.ts`
- Modify: `src/pages/Peptide.tsx`

1. Add an adapter that translates the old peptide form payload into:
   `save_stack_item` plus the retained vial/tracking fields.
2. Keep the page's existing `Peptide` model and presentation logic.
3. Load `display_name` under the legacy `name` alias.
4. Point archive, restore, delete, color and stock operations at `stack_items`.
5. Translate cycle and log database keys to `stack_item_id`.
6. Run the focused tests.

## Task 3: Rename the connected scheduling and injection contracts

**Files:**

- Modify the affected files under `src/pages`, `src/lib`,
  `src/components/injection3d`, `src/features/fortschritt` and `src/services`.
- Modify their existing focused tests.

1. Use Supabase aliases so existing UI-facing names remain stable:
   `peptide_id:stack_item_id` and
   `peptides:stack_items(name:display_name)`.
2. Use `stack_item_id` for filters, inserts, updates and deletes.
3. Preserve existing labels, layout and interaction behavior.
4. Run scheduling, injection, progress and protocol-focused tests.

## Task 4: Verify the complete old application

1. Run the schema-contract scan.
2. Run the complete Vitest suite.
3. Run TypeScript through the production build.
4. Inspect the diff for visual or unrelated changes.
5. Refresh Graphify only after the code is stable, then use it to confirm the
   affected runtime surface.
