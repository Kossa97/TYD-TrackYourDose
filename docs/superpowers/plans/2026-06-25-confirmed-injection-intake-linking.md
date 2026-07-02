# Confirmed Injection Intake Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show open and already-confirmed injectable intakes in one selectable list and attach a pin to confirmed intakes without confirming or debiting stock again.

**Architecture:** Extend the existing intake selection model with `status` and optional `doseLogId`. Build confirmed candidates by assigning each day’s decided dose logs chronologically to that peptide’s scheduled slots, then exclude IDs already referenced by injection logs. The save path branches on status, while a partial unique database index prevents duplicate pin links.

**Tech Stack:** React 19, TypeScript, date-fns, Supabase/PostgREST, Vitest.

## Global Constraints

- Manual injections remain unchanged.
- Default filters are all cycles, all statuses, 7 days, newest first.
- Confirmed intakes never call `confirmIntakeDoseLog` and never debit stock.
- A non-null `dose_log_id` can be linked to at most one injection log.
- For selected intakes, date, dose, unit, and method remain locked; only time is editable.

---

### Task 1: Shared selectable intake model and filtering

**Files:**
- Modify: `src/lib/injectionPersistence.ts`
- Modify: `src/lib/openInjectionIntakeFilters.ts`
- Test: `src/lib/openInjectionIntakeFilters.test.ts`

**Interfaces:**
- Produces: `InjectionIntakeStatus = 'open' | 'confirmed'`
- Produces: `SelectableInjectionIntake` with `status` and `doseLogId`
- Produces: status-aware `filterOpenInjectionIntakes`

- [ ] Add failing filter tests for `all`, `open`, and `confirmed` status values.
- [ ] Run `npm test -- src/lib/openInjectionIntakeFilters.test.ts` and verify failure.
- [ ] Extend the selection type and filter options minimally.
- [ ] Re-run the focused test and verify pass.

### Task 2: Load confirmed intakes without pins

**Files:**
- Modify: `src/lib/intakeSchedule.ts`
- Modify: `src/lib/injectionPersistence.ts`
- Test: `src/lib/injectionPersistence.test.ts`

**Interfaces:**
- Produces: a pure slot-assignment helper mapping confirmed `dose_logs` to cycle slots.
- Produces: `loadSelectableInjectionIntakes(supabase, userId, now)` returning open and confirmed candidates.

- [ ] Add failing tests proving confirmed logs receive their existing ID, already-linked IDs are excluded, and open items remain present.
- [ ] Run `npm test -- src/lib/injectionPersistence.test.ts` and verify failure.
- [ ] Implement chronological same-day slot assignment and combined loading.
- [ ] Re-run the focused persistence tests and verify pass.

### Task 3: Status-aware save behavior

**Files:**
- Modify: `src/pages/InjektionsTracker.tsx`
- Modify: `src/lib/injectionPersistence.ts`
- Test: `src/lib/injectionPersistence.test.ts`

**Interfaces:**
- Produces: `resolveInjectionDoseLogId` or equivalent pure decision helper.
- Confirmed input returns existing `doseLogId`; open input calls confirmation once.

- [ ] Add a failing test proving confirmed status does not invoke the confirmation callback.
- [ ] Run the focused test and verify failure.
- [ ] Implement the minimal decision helper and use it in `saveDraftPin`.
- [ ] Handle unique-link conflicts by showing a specific message and reloading data.
- [ ] Re-run focused tests and verify pass.

### Task 4: Status-aware sheet UI

**Files:**
- Modify: `src/components/injection3d/InjectionLogSheet.tsx`
- Modify: `src/lib/openInjectionIntakeFilters.ts`
- Test: `src/lib/openInjectionIntakeFilters.test.ts`

**Interfaces:**
- Consumes: `SelectableInjectionIntake.status` and `.doseLogId`.
- Produces: filter `Alle | Offen | Bestätigt ohne Pin`, card status labels, and status-specific save button copy.

- [ ] Add/extend pure tests for default status filtering.
- [ ] Add status filter state defaulting to `all`.
- [ ] Render clock/check status text and status-specific primary action text.
- [ ] Keep the approved locked-date/editable-time UI for both selected statuses.
- [ ] Run focused tests.

### Task 5: Database uniqueness and full verification

**Files:**
- Modify: `supabase-injection-pro.sql`
- Modify: `src/pages/InjektionsTracker.tsx`

**Interfaces:**
- Produces: partial unique index `injection_logs_dose_log_id_unique_idx` on non-null `dose_log_id`.

- [ ] Add the partial unique index to migration and setup SQL.
- [ ] Run `npm test` and expect all tests to pass.
- [ ] Run `npm run build` and expect exit code 0.
- [ ] Run `git diff --check` and inspect the final diff for unrelated changes.