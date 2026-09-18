# My Stack Plan Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ambiguous cycles, JSON schedule history, and additive dose escalations with one continuous cycle, normalized time-effective plan versions, explicit pauses, and one resolver shared by My Stack, Home, Calendar, confirmations, and reminders.

**Architecture:** `cycles` owns lifecycle only; `cycle_plan_versions` owns complete immutable schedule snapshots; `cycle_pause_periods` owns neutral pause intervals. A pure TypeScript resolver and an API parity adapter select the valid lifecycle state and version for a local date/time, while all writes go through transactional Supabase RPCs. Rollout is additive and staged: schema/backfill, dual-read parity, consumer cutover, database enforcement, then legacy writers are disabled without dropping legacy data.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 3, date-fns 4, Supabase/Postgres/RLS/RPC, Node 20 Vercel functions, i18next.

**Spec:** `docs/superpowers/specs/2026-09-18-my-stack-planintegritaet-design.md`

## Global Constraints

- Work only on `codex/my-stack-foundation`.
- Follow TDD: each behavior change starts with a failing test.
- No Earn, inventory, Vial-tracking, PK-claim, visual-stage, or offline work in this plan.
- No dosage recommendations or generated treatment plans.
- Polish user-facing copy only in German and English; add every new key to all locale files so the i18n contract remains complete.
- No direct client writes to lifecycle or plan-version fields after their RPC exists.
- Existing dose logs are never deleted or recalculated.
- Past/current plan versions are immutable; only future versions may be replaced or removed.
- Paused slots are neutral: no due item, skip, miss, or Consistency penalty.
- Scheduled wall-clock times follow the user's current IANA timezone; confirmed events remain absolute UTC instants.
- Every database migration is a versioned `supabase-*.sql` file, is dry-run twice against PostgreSQL 16, and is not applied to production without explicit approval in the same conversation.
- Do not drop legacy columns/tables in this plan. Keep them for rollback until a separate destructive migration is approved.
- Run `graphify update .` after production-code changes, never for documentation-only commits.

---

## File Structure

### Create

- `src/lib/planTimeline.ts` — domain types, lifecycle/version/pause resolver, timezone-local boundary ordering.
- `src/lib/planTimeline.test.ts` — resolver and timezone behavior.
- `src/lib/legacyPlanTimeline.ts` — maps current `cycles.schedule_history` and `dose_escalations` into the new read model during migration.
- `src/lib/legacyPlanTimeline.test.ts` — exact legacy conversion tests.
- `src/features/my-stack/services/planLifecycle.ts` — typed query and RPC wrappers.
- `src/features/my-stack/services/planLifecycle.test.ts` — request/response contract tests.
- `src/features/my-stack/components/PlanManagementSection.tsx` — current plan, future changes, history, pause/end/restart actions.
- `src/features/my-stack/components/PlanManagementSection.test.tsx` — user behavior tests.
- `api/_lib/planTimeline.js` — Node-compatible resolver adapter for reminders.
- `api/_lib/planTimeline.parity.test.js` — parity fixtures against the TypeScript resolver.
- `supabase-my-stack-plan-integrity.sql` — additive tables, columns, RLS, backfill, read functions, and mutation RPCs.
- `supabase-my-stack-plan-integrity-enforce.sql` — final open-cycle unique index and legacy-write guard after conflicts reach zero.
- `src/features/my-stack/lib/planIntegritySchema.test.ts` — static migration contract tests.

### Modify

- `src/lib/intakeSchedule.ts` and tests — resolve slots from plan timelines and suppress pauses.
- `src/features/my-stack/types.ts` — plan-version/lifecycle drafts exposed to the UI.
- `src/features/my-stack/services/stackItems.ts` and tests — initial plan write and exact version edits.
- `src/features/my-stack/components/StackItemWizard.tsx` and interaction tests — explicit plan-change target and effective boundary.
- `src/features/my-stack/MyStackPage.tsx` and visibility tests — remove latest-active lookup, load timelines, render management component.
- `src/features/routines/intakeGroups.ts` and tests — carry `planVersionId`.
- `src/features/routines/services/intakeConfirmation.ts` and tests — persist/verify plan-version provenance.
- `src/pages/Home.tsx`, `src/pages/Home.test.ts` — timeline-based next/due/missed calculation.
- `src/pages/Dashboard.tsx`, `src/pages/Dashboard.test.ts` — timeline-based calendar calculation.
- `api/send-reminders.js`, reminder tests — fetch versions/pauses and use timezone-local resolver.
- `src/lib/injectionPersistence.ts` and tests — consume plan-version provenance rather than dose escalations.
- `src/services/liveBlutspiegelChart.ts`, `src/pages/BlutspiegelSimulation.tsx`, `src/components/BlutspiegelCarousel.tsx` and tests — read versioned schedules for projections.
- `src/lib/doseAdjustmentBackfill.ts` and tests — stop generating new additive escalation semantics after cutover.
- `src/features/my-stack/lib/dosePlan.ts`, `planSegments.ts` and tests — operate on normalized plan versions.
- `src/i18n/locales/*.json` and `src/features/my-stack/lib/i18n.test.ts` — lifecycle and plan-management copy.
- `src/config/features.ts` — internal `planTimelineV2` rollout switch.

---

### Task 1: Add the pure plan-timeline domain resolver

**Files:**
- Create: `src/lib/planTimeline.ts`
- Create: `src/lib/planTimeline.test.ts`

**Interfaces:**
- Produces: `PlanScheduleSnapshot`, `CyclePlanVersion`, `CyclePausePeriod`, `TimelineCycle`, `CycleTimeline`, `CycleLifecycleStatus`, `ResolvedCycleAt`, `localDateTimeKey()`, `resolveCycleAt()`, `resolveCycleAtLocalSlot()`.

- [ ] **Step 1: Write failing lifecycle and boundary tests**

Create `src/lib/planTimeline.test.ts` with fixtures covering a future cycle, active cycle, open pause, scheduled pause end, ended cycle, local-date version, instant version at noon, and Berlin/New York wall-clock comparison:

```ts
import { describe, expect, it } from 'vitest'
import { resolveCycleAt, type CycleTimeline, type PlanScheduleSnapshot } from './planTimeline'

const schedule = (dose: number): PlanScheduleSnapshot => ({
  frequency: 'Täglich', x_days_interval: null, interval_unit: null,
  cycle_on_days: null, cycle_off_days: null, schedule_days: [],
  intake_time: 'morgens,abends', intake_time_custom: '08:00,20:00',
  slot_doses: null, slot_days: null, dose, unit: 'mg', method: 'Oral',
})

const timeline: CycleTimeline = {
  cycle: { id: 'c1', stack_item_id: 's1', started_at: '2026-09-17T00:00:00Z', ended_at: null },
  versions: [
    { id: 'v1', cycle_id: 'c1', effective_kind: 'local_date', effective_at: null,
      effective_local_date: '2026-09-18', change_kind: 'initial', ...schedule(0.25) },
    { id: 'v2', cycle_id: 'c1', effective_kind: 'instant', effective_at: '2026-09-18T10:00:00Z',
      effective_local_date: null, change_kind: 'dose', ...schedule(0.5) },
  ],
  pauses: [],
}

it('uses the old version before and the new version at the exact instant', () => {
  expect(resolveCycleAt(timeline, new Date('2026-09-18T09:59:59Z'), 'Europe/Berlin').planVersion?.id).toBe('v1')
  expect(resolveCycleAt(timeline, new Date('2026-09-18T10:00:00Z'), 'Europe/Berlin').planVersion?.id).toBe('v2')
})

it('marks a target inside [paused_at, ends_at) as paused and the endpoint active', () => {
  const paused = { ...timeline, pauses: [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-09-19T08:00:00Z', ends_at: '2026-09-20T08:00:00Z' }] }
  expect(resolveCycleAt(paused, new Date('2026-09-19T12:00:00Z'), 'Europe/Berlin').status).toBe('paused')
  expect(resolveCycleAt(paused, new Date('2026-09-20T08:00:00Z'), 'Europe/Berlin').status).toBe('active')
})

it('keeps a local-date boundary on the local calendar date after travel', () => {
  const target = new Date('2026-09-17T23:30:00Z')
  expect(resolveCycleAt(timeline, target, 'Europe/Berlin').planVersion?.id).toBe('v1')
  expect(resolveCycleAt(timeline, target, 'America/New_York').planVersion).toBeNull()
})
```

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `npm test -- src/lib/planTimeline.test.ts`
Expected: FAIL because `./planTimeline` does not exist.

- [ ] **Step 3: Implement domain types and deterministic resolution**

Create `src/lib/planTimeline.ts`. Use `Intl.DateTimeFormat(...).formatToParts()` to derive a `yyyy-MM-dd|HH:mm:ss` key in an IANA zone. Local-date boundaries sort at `00:00:00`; instant boundaries use their local representation. Implement these exported contracts exactly:

```ts
export type PlanEffectiveKind = 'instant' | 'local_date'
export type PlanChangeKind = 'initial' | 'dose' | 'schedule' | 'titration'
export type CycleLifecycleStatus = 'planned' | 'active' | 'paused' | 'ended'

export interface PlanScheduleSnapshot {
  frequency: string
  x_days_interval: number | null
  interval_unit: string | null
  cycle_on_days: number | null
  cycle_off_days: number | null
  schedule_days: string[]
  intake_time: string
  intake_time_custom: string | null
  slot_doses: string | null
  slot_days: string | null
  dose: number | null
  unit: string | null
  method: string
}

export interface CyclePlanVersion extends PlanScheduleSnapshot {
  id: string
  cycle_id: string
  effective_kind: PlanEffectiveKind
  effective_at: string | null
  effective_local_date: string | null
  change_kind: PlanChangeKind
}

export interface TimelineCycle {
  id: string
  stack_item_id: string
  started_at: string
  ended_at: string | null
}

export interface CyclePausePeriod {
  id: string
  cycle_id: string
  paused_at: string
  ends_at: string | null
}

export interface CycleTimeline {
  cycle: TimelineCycle
  versions: CyclePlanVersion[]
  pauses: CyclePausePeriod[]
}

export interface ResolvedCycleAt {
  status: CycleLifecycleStatus
  planVersion: CyclePlanVersion | null
  pause: CyclePausePeriod | null
}

export function localDateTimeKey(instant: Date, timeZone: string): string
export function resolveCycleAt(
  timeline: CycleTimeline,
  target: Date,
  timeZone: string,
): ResolvedCycleAt

export function resolveCycleAtLocalSlot(
  timeline: CycleTimeline,
  localDate: string,
  minutes: number,
  timeZone: string,
): ResolvedCycleAt
```

Reject invalid dates and invalid IANA zones with a descriptive `Error`; do not silently fall back to UTC in the app-domain resolver.
`resolveCycleAtLocalSlot()` compares the local date/minute directly with local-date boundaries and with the local representation of instant boundaries. It exists so occurrence generation does not guess a UTC offset or duplicate timezone ordering.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/lib/planTimeline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/planTimeline.ts src/lib/planTimeline.test.ts
git commit -m "feat: add versioned plan timeline resolver"
```

---

### Task 2: Resolve daily occurrences across mid-day changes and pauses

**Files:**
- Modify: `src/lib/intakeSchedule.ts`
- Modify: `src/lib/intakeSchedule.test.ts`
- Test: `src/lib/planTimeline.test.ts`

**Interfaces:**
- Consumes: `CycleTimeline`, `CyclePlanVersion`, `resolveCycleAt()` from Task 1.
- Produces: `ResolvedTimelineIntake`, `resolveTimelineIntakesForDay()`, `findNextTimelineIntake()`.

- [ ] **Step 1: Add failing occurrence tests**

Add tests proving that an 08:00 slot uses the old version, a 20:00 slot uses a noon version, a pause beginning at 12:00 suppresses only the evening slot, and PRN creates no occurrence:

```ts
expect(resolveTimelineIntakesForDay(timeline, '2026-09-18', 'Europe/Berlin').map(x => [x.time, x.planVersionId, x.dose]))
  .toEqual([['08:00', 'v1', 0.25], ['20:00', 'v2', 0.5]])

expect(resolveTimelineIntakesForDay(pausedAtNoon, '2026-09-18', 'Europe/Berlin').map(x => x.time))
  .toEqual(['08:00'])
```

- [ ] **Step 2: Run the focused tests**

Run: `npm test -- src/lib/intakeSchedule.test.ts src/lib/planTimeline.test.ts`
Expected: FAIL because `resolveTimelineIntakesForDay` is missing.

- [ ] **Step 3: Implement slot-level resolution without duplicating schedule rules**

In `src/lib/intakeSchedule.ts`, retain `resolveScheduleSlots()` as the only parser for slot strings and add:

```ts
export interface ResolvedTimelineIntake extends ResolvedScheduleSlot {
  cycleId: string
  stackItemId: string
  planVersionId: string
  dose: number | null
  unit: string | null
  method: string
  localDate: string
}

export function resolveTimelineIntakesForDay(
  timeline: CycleTimeline,
  localDate: string,
  timeZone: string,
): ResolvedTimelineIntake[]
```

Build the candidate slot set from every version that can be effective on the selected local date. For each candidate minute, call `resolveCycleAtLocalSlot()`, then retain the candidate only when that resolved version contains the same slot key/time. A paused target returns no slot. Sort by `minutes` and de-duplicate by `cycleId + localDate + time`; do not add a second boundary-order implementation.

Also export:

```ts
export function findNextTimelineIntake(
  timeline: CycleTimeline,
  after: Date,
  timeZone: string,
  lookaheadDays?: number,
): ResolvedTimelineIntake | null
```

Default `lookaheadDays` to 366, skip paused/PRN days, and return the first occurrence strictly after `after`.

Keep the existing legacy functions temporarily; new consumers use the timeline function while parity is measured.

- [ ] **Step 4: Verify existing and new schedule tests**

Run: `npm test -- src/lib/intakeSchedule.test.ts src/lib/planTimeline.test.ts src/lib/intakeRhythm.schedule.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/intakeSchedule.ts src/lib/intakeSchedule.test.ts src/lib/planTimeline.test.ts
git commit -m "feat: resolve schedule slots across plan changes and pauses"
```

---

### Task 3: Add the additive database schema and RLS

**Files:**
- Create: `supabase-my-stack-plan-integrity.sql`
- Create: `src/features/my-stack/lib/planIntegritySchema.test.ts`

**Interfaces:**
- Produces tables `cycle_plan_versions`, `cycle_pause_periods`, `plan_mutation_receipts`, `cycle_migration_conflicts`; nullable `cycles.started_at`, `cycles.ended_at`, `dose_logs.cycle_id`, `dose_logs.plan_version_id`.

- [ ] **Step 1: Write static schema contract tests**

The test reads the SQL file and asserts the exact tables, boundary check, RLS enablement, owner policies, pause-range validation trigger, nullable log foreign keys, and absence of destructive statements:

```ts
expect(sql).toContain('create table if not exists public.cycle_plan_versions')
expect(sql).toContain("effective_kind in ('instant', 'local_date')")
expect(sql).toContain('create table if not exists public.cycle_pause_periods')
expect(sql).toContain('alter table public.cycle_plan_versions enable row level security')
expect(sql).toContain('add column if not exists plan_version_id uuid')
expect(sql).not.toMatch(/drop\s+(table|column)/i)
expect(sql).not.toMatch(/truncate\s+/i)
```

- [ ] **Step 2: Run the schema test**

Run: `npm test -- src/features/my-stack/lib/planIntegritySchema.test.ts`
Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Add idempotent tables and constraints**

Start `supabase-my-stack-plan-integrity.sql` with additive DDL using these exact column contracts:

```sql
alter table public.cycles
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz,
  add column if not exists closed_by_migration_resolution boolean not null default false;

create table if not exists public.cycle_plan_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  effective_kind text not null check (effective_kind in ('instant', 'local_date')),
  effective_at timestamptz,
  effective_local_date date,
  change_kind text not null check (change_kind in ('initial', 'dose', 'schedule', 'titration')),
  frequency text not null,
  x_days_interval integer,
  interval_unit text,
  cycle_on_days integer,
  cycle_off_days integer,
  schedule_days text[] not null default '{}',
  intake_time text not null,
  intake_time_custom text,
  slot_doses text,
  slot_days text,
  dose numeric(10,3),
  unit text,
  method text not null,
  created_at timestamptz not null default now(),
  check (
    (effective_kind = 'instant' and effective_at is not null and effective_local_date is null)
    or
    (effective_kind = 'local_date' and effective_at is null and effective_local_date is not null)
  )
);

create table if not exists public.cycle_pause_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  paused_at timestamptz not null,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > paused_at)
);

create table if not exists public.plan_mutation_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  operation text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key, operation)
);

create table if not exists public.cycle_migration_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_item_id uuid not null references public.stack_items(id) on delete cascade,
  cycle_ids uuid[] not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, stack_item_id)
);

alter table public.dose_logs
  add column if not exists cycle_id uuid references public.cycles(id) on delete set null,
  add column if not exists plan_version_id uuid references public.cycle_plan_versions(id) on delete set null;
```

Add the two version indexes:

```sql
create unique index if not exists cycle_plan_versions_instant_key
  on public.cycle_plan_versions(cycle_id, effective_at)
  where effective_kind = 'instant';

create unique index if not exists cycle_plan_versions_local_date_key
  on public.cycle_plan_versions(cycle_id, effective_local_date)
  where effective_kind = 'local_date';
```

The plan-version boundary check must remain structurally equivalent to:

```sql
check (
  (effective_kind = 'instant' and effective_at is not null and effective_local_date is null)
  or
  (effective_kind = 'local_date' and effective_at is null and effective_local_date is not null)
)
```

Add unique indexes for `(cycle_id, effective_at)` where kind is `instant` and `(cycle_id, effective_local_date)` where kind is `local_date`. Add a trigger that rejects overlapping `tstzrange(paused_at, ends_at, '[)')` intervals for the same cycle. The trigger locks the owning cycle row before checking overlap to prevent concurrent inserts.

RLS policies require `auth.uid() = user_id` for selects. Revoke direct authenticated insert/update/delete on plan versions, pause periods, and receipts; mutation RPCs in Task 4 are the only writers.

- [ ] **Step 4: Verify the source contract**

Run: `npm test -- src/features/my-stack/lib/planIntegritySchema.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase-my-stack-plan-integrity.sql src/features/my-stack/lib/planIntegritySchema.test.ts
git commit -m "db: add plan version and pause schema"
```

---

### Task 4: Add transactional lifecycle and version RPCs

**Files:**
- Modify: `supabase-my-stack-plan-integrity.sql`
- Modify: `src/features/my-stack/lib/planIntegritySchema.test.ts`

**Interfaces:**
- Produces RPCs `create_plan_version`, `replace_future_plan_version`, `remove_future_plan_version`, `pause_cycle`, `set_pause_end`, `resume_cycle`, `end_cycle`, `restart_cycle`, `resolve_plan_version_id`.

- [ ] **Step 1: Extend failing SQL contract tests**

For every RPC assert `auth.uid()`, `for update`, receipt lookup/insert, ownership checks, and execute grants only to `authenticated`. Assert historical mutation guards compare the resolved boundary with the transaction timestamp.

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm test -- src/features/my-stack/lib/planIntegritySchema.test.ts`
Expected: FAIL on missing RPC names.

- [ ] **Step 3: Implement one idempotency pattern and reuse it consistently**

Each mutation is `security definer set search_path = public`, explicitly checks `auth.uid()` and ownership, and is revoked from `public`/`anon` while granted to `authenticated`. Each mutation accepts `p_idempotency_key text`. At transaction start:

```sql
select result into receipt_result
from public.plan_mutation_receipts
where user_id = auth.uid()
  and idempotency_key = p_idempotency_key
  and operation = 'pause_cycle';

if found then
  return receipt_result;
end if;
```

After a successful mutation, insert the returned JSON into the receipt table. A unique constraint on `(user_id, idempotency_key, operation)` makes retries deterministic.

Use these function signatures so client and SQL contracts cannot drift:

```sql
create or replace function public.create_plan_version(
  p_cycle_id uuid, p_effective_kind text, p_effective_at timestamptz,
  p_effective_local_date date, p_change_kind text, p_schedule jsonb,
  p_idempotency_key text
) returns public.cycle_plan_versions;

create or replace function public.replace_future_plan_version(
  p_version_id uuid, p_effective_kind text, p_effective_at timestamptz,
  p_effective_local_date date, p_change_kind text, p_schedule jsonb,
  p_timezone text, p_idempotency_key text
) returns public.cycle_plan_versions;

create or replace function public.remove_future_plan_version(
  p_version_id uuid, p_timezone text, p_idempotency_key text
) returns jsonb;

create or replace function public.pause_cycle(
  p_cycle_id uuid, p_ends_at timestamptz, p_idempotency_key text
) returns jsonb;

create or replace function public.set_pause_end(
  p_pause_id uuid, p_ends_at timestamptz, p_idempotency_key text
) returns jsonb;

create or replace function public.resume_cycle(
  p_cycle_id uuid, p_idempotency_key text
) returns jsonb;

create or replace function public.end_cycle(
  p_cycle_id uuid, p_idempotency_key text
) returns jsonb;

create or replace function public.restart_cycle(
  p_source_cycle_id uuid, p_started_at timestamptz, p_initial_schedule jsonb,
  p_idempotency_key text
) returns jsonb;

create or replace function public.resolve_plan_version_id(
  p_cycle_id uuid, p_target timestamptz, p_timezone text
) returns uuid;
```

Parse `p_schedule` into every non-boundary column of `cycle_plan_versions` and run the same rhythm, slot, dose, and unit validation already enforced by `save_stack_item_with_plan`; do not store an unvalidated JSON blob.

Implement these invariants in SQL, not only in TypeScript:

- only future versions may be replaced/removed,
- pause starts no earlier than transaction time,
- `set_pause_end` changes only the future end of the currently active pause,
- resume sets the active pause `ends_at` to transaction time,
- end closes an open pause and sets `ended_at`, `active = false`, and legacy `end_date` for compatibility,
- restart requires an ended source cycle and no other open cycle,
- every created version is a complete schedule snapshot,
- `resolve_plan_version_id(cycle, target, timezone)` orders local-date boundaries at local midnight and instant boundaries at their exact instant.

- [ ] **Step 4: Add SQL tests for authorization and invariants**

Static assertions must cover exception messages `Plan version is already effective`, `Cycle is already ended`, `Cycle is not paused`, and `Another open cycle exists`. These stable messages are mapped by the client service in Task 6.

- [ ] **Step 5: Run schema tests**

Run: `npm test -- src/features/my-stack/lib/planIntegritySchema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase-my-stack-plan-integrity.sql src/features/my-stack/lib/planIntegritySchema.test.ts
git commit -m "db: add transactional plan lifecycle RPCs"
```

---

### Task 5: Backfill legacy schedules and detect cycle conflicts

**Files:**
- Modify: `supabase-my-stack-plan-integrity.sql`
- Create: `src/lib/legacyPlanTimeline.ts`
- Create: `src/lib/legacyPlanTimeline.test.ts`
- Modify: `src/features/my-stack/lib/planIntegritySchema.test.ts`

**Interfaces:**
- Produces `legacyCycleToTimeline(cycle, escalations): CycleTimeline` for dual-read comparison.
- Produces rows in `cycle_migration_conflicts` instead of guessing which active cycle is correct.

- [ ] **Step 1: Write failing conversion tests**

Cover a flat cycle, two `schedule_history` dates, a date escalation, an after-days escalation, a dose reduction, mixed units that must be flagged instead of summed, and two active cycles for one item.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/lib/legacyPlanTimeline.test.ts`
Expected: FAIL because the adapter is missing.

- [ ] **Step 3: Implement the pure legacy adapter**

The adapter converts the base cycle and every legacy segment into full `local_date` versions. It folds each applicable escalation into a new complete version using the same legacy activation calculation from `effectiveSlotQuantity`; it never mutates its input. If an escalation unit differs from the active version unit, return a conversion issue alongside the timeline rather than inventing a quantity.

Export:

```ts
export interface LegacyTimelineConversion {
  timeline: CycleTimeline
  issues: Array<{ code: 'unit_mismatch' | 'invalid_boundary'; sourceId: string }>
}

export function legacyCycleToTimeline(
  cycle: LegacyScheduleCycle,
  escalations: LegacyEscalationRow[],
): LegacyTimelineConversion
```

- [ ] **Step 4: Add equivalent idempotent SQL backfill**

In the migration:

- populate `started_at`/`ended_at` without changing legacy `start_date`/`end_date`,
- insert initial and history versions with `on conflict do nothing`,
- convert valid escalations into full versions,
- retain every legacy row,
- add a conflict row for each `stack_item_id` with more than one currently open cycle,
- set the owning stack item to `configuration_status = 'needs_review'`,
- do not create the final open-cycle unique index yet.

- [ ] **Step 5: Add parity tests**

For 60 representative dates, assert that legacy `scheduleForDay` plus `effectiveSlotQuantity` equals the converted timeline resolver when no conversion issue exists.

- [ ] **Step 6: Run tests**

Run: `npm test -- src/lib/legacyPlanTimeline.test.ts src/lib/intakeSchedule.test.ts src/features/my-stack/lib/planIntegritySchema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase-my-stack-plan-integrity.sql src/lib/legacyPlanTimeline.ts src/lib/legacyPlanTimeline.test.ts src/features/my-stack/lib/planIntegritySchema.test.ts
git commit -m "feat: backfill legacy plans into version timelines"
```

---

### Task 6: Add typed client loading and mutation services

**Files:**
- Create: `src/features/my-stack/services/planLifecycle.ts`
- Create: `src/features/my-stack/services/planLifecycle.test.ts`
- Modify: `src/features/my-stack/types.ts`
- Modify: `src/config/features.ts`

**Interfaces:**
- Consumes: timeline types from Task 1 and RPCs from Task 4.
- Produces: `loadCycleTimelines()`, `createPlanVersion()`, `replaceFuturePlanVersion()`, `removeFuturePlanVersion()`, `pauseCycle()`, `setPauseEnd()`, `resumeCycle()`, `endCycle()`, `restartCycle()`.

- [ ] **Step 1: Write failing service contract tests**

Mock the Supabase query and RPC clients. Assert relational loading of versions/pauses, exact RPC names/params, generated idempotency keys passed unchanged on retries, and mapping of stable database errors to typed `PlanLifecycleError` codes.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/features/my-stack/services/planLifecycle.test.ts`
Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the service API**

Use this public surface:

```ts
export type PlanLifecycleErrorCode =
  | 'already_effective'
  | 'already_ended'
  | 'not_paused'
  | 'open_cycle_conflict'
  | 'unknown'

export class PlanLifecycleError extends Error {
  constructor(public code: PlanLifecycleErrorCode, message: string) { super(message) }
}

export async function loadCycleTimelines(client: PlanQueryClient, userId: string): Promise<CycleTimeline[]>
export async function createPlanVersion(client: PlanRpcClient, input: CreatePlanVersionInput): Promise<CyclePlanVersion>
export async function replaceFuturePlanVersion(client: PlanRpcClient, input: ReplacePlanVersionInput): Promise<CyclePlanVersion>
export async function removeFuturePlanVersion(client: PlanRpcClient, input: RemovePlanVersionInput): Promise<void>
export async function pauseCycle(client: PlanRpcClient, input: PauseCycleInput): Promise<CycleTimeline>
export async function setPauseEnd(client: PlanRpcClient, input: SetPauseEndInput): Promise<CycleTimeline>
export async function resumeCycle(client: PlanRpcClient, input: ResumeCycleInput): Promise<CycleTimeline>
export async function endCycle(client: PlanRpcClient, input: EndCycleInput): Promise<CycleTimeline>
export async function restartCycle(client: PlanRpcClient, input: RestartCycleInput): Promise<CycleTimeline>
```

Add `planTimelineV2: false` to `src/config/features.ts`. No UI should read V2 data until the rollout task explicitly enables the flag.

- [ ] **Step 4: Run service tests and typecheck**

Run: `npm test -- src/features/my-stack/services/planLifecycle.test.ts`
Run: `npm run build`
Expected: PASS and build exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/services/planLifecycle.ts src/features/my-stack/services/planLifecycle.test.ts src/features/my-stack/types.ts src/config/features.ts
git commit -m "feat: add typed plan lifecycle service"
```

---

### Task 7: Route initial creation and plan changes through exact version targets

**Files:**
- Modify: `src/features/my-stack/services/stackItems.ts`
- Modify: `src/features/my-stack/services/stackItems.test.ts`
- Modify: `src/features/my-stack/components/StackItemWizard.tsx`
- Modify: `src/features/my-stack/components/StackItemWizard.interaction.test.tsx`
- Modify: `src/features/my-stack/lib/wizardState.ts`
- Modify: `supabase-my-stack-plan-integrity.sql`

**Interfaces:**
- Consumes: `createPlanVersion()`/`replaceFuturePlanVersion()` from Task 6.
- Produces: `PlanEditTarget = { cycleId: string; versionId: string | null; mode: 'new_change' | 'replace_future' }`.

- [ ] **Step 1: Write failing exact-target interaction tests**

Render the wizard with one current and one future version. Assert:

- editing the future row calls `replace_future_plan_version` with that version ID,
- adjusting the current plan calls `create_plan_version` and does not update the current row,
- saving a dose-only change does not insert a new cycle,
- `effective_kind` is `instant` for “ab sofort” and `local_date` for “ab Datum”.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- src/features/my-stack/components/StackItemWizard.interaction.test.tsx src/features/my-stack/services/stackItems.test.ts`
Expected: FAIL because the wizard has no exact plan target.

- [ ] **Step 3: Add the edit target and boundary draft**

Add to the wizard contract:

```ts
export interface PlanEditTarget {
  cycleId: string
  versionId: string | null
  mode: 'new_change' | 'replace_future'
}

export interface PlanEffectiveDraft {
  kind: 'now' | 'date'
  localDate: string | null
}
```

The wizard receives the selected snapshot directly. It must not call a helper that searches for “latest active”.

- [ ] **Step 4: Make initial setup dual-write atomically**

Extend `save_stack_item_with_plan` in the migration so a newly created setup inserts the legacy cycle fields and the canonical initial `cycle_plan_versions` row in the same transaction. Existing-item plan changes must use the new version RPC instead of reusing setup creation.

- [ ] **Step 5: Implement service routing**

In `stackItems.ts`, keep `saveStackItemSetup()` for initial creation. Add `savePlanChange()` that accepts `PlanEditTarget`, the full snapshot, and boundary; dispatch to create or replace RPC. Delete no legacy function yet.

- [ ] **Step 6: Run tests and build**

Run: `npm test -- src/features/my-stack/components/StackItemWizard.interaction.test.tsx src/features/my-stack/services/stackItems.test.ts src/features/my-stack/lib/wizardState.test.ts`
Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/my-stack/services/stackItems.ts src/features/my-stack/services/stackItems.test.ts src/features/my-stack/components/StackItemWizard.tsx src/features/my-stack/components/StackItemWizard.interaction.test.tsx src/features/my-stack/lib/wizardState.ts supabase-my-stack-plan-integrity.sql
git commit -m "fix: target exact plan version in My Stack wizard"
```

---

### Task 8: Build the plan-management UI and lifecycle actions

**Files:**
- Create: `src/features/my-stack/components/PlanManagementSection.tsx`
- Create: `src/features/my-stack/components/PlanManagementSection.test.tsx`
- Modify: `src/features/my-stack/MyStackPage.tsx`
- Modify: `src/features/my-stack/MyStackPage.visibility.test.tsx`
- Modify: `src/features/my-stack/lib/planSegments.ts`
- Modify: `src/features/my-stack/lib/planSegments.test.ts`
- Modify: `src/i18n/locales/*.json`
- Modify: `src/features/my-stack/lib/i18n.test.ts`

**Interfaces:**
- Consumes: `CycleTimeline`, `resolveCycleAt()`, plan lifecycle service callbacks.
- Produces: exact UI actions for current, future, paused, and ended states.

- [ ] **Step 1: Write failing component behavior tests**

Test these visible behaviors:

- current card shows status, dose, rhythm, next intake, and next future change,
- current version has “Dosis anpassen” and “Plan anpassen”, not “Bearbeiten”,
- only future versions have edit/remove buttons,
- pause can optionally receive an end date,
- paused state explains that no intake is due or missed,
- ended state exposes only history and “Neu starten”,
- duplicate stack items render independently.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- src/features/my-stack/components/PlanManagementSection.test.tsx`
Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the focused component**

Keep state orchestration in the parent, but render plan UI in the new component. Use callback props:

```ts
interface PlanManagementSectionProps {
  timeline: CycleTimeline
  now: Date
  timeZone: string
  onAdjustDose(version: CyclePlanVersion): void
  onAdjustSchedule(version: CyclePlanVersion): void
  onEditFuture(version: CyclePlanVersion): void
  onRemoveFuture(version: CyclePlanVersion): Promise<void>
  onPause(endsAt: string | null): Promise<void>
  onSetPauseEnd(endsAt: string | null): Promise<void>
  onResume(): Promise<void>
  onEnd(): Promise<void>
  onRestart(sourceCycleId: string): void
}
```

Disable action buttons while their mutation is pending and keep the dialog open with an inline retry message on failure.

- [ ] **Step 4: Replace ambiguous MyStack handlers**

Change `openEditCycle(p)` to accept an explicit `cycleId` and optional `versionId`. Remove `activePlanFor()` and every call site that chooses a plan by newest active cycle. Historical rows become read-only; future rows pass their exact version ID.

- [ ] **Step 5: Add DE/EN copy and locale-key completeness**

Add keys for planned/active/paused/ended, neutral pause explanation, adjust dose/schedule, future change, end confirmation, restart, and lifecycle errors. Put sensible fallback translations in the other locale files without claiming they are launch-reviewed.

- [ ] **Step 6: Run UI, i18n, and build checks**

Run: `npm test -- src/features/my-stack/components/PlanManagementSection.test.tsx src/features/my-stack/MyStackPage.visibility.test.tsx src/features/my-stack/lib/planSegments.test.ts src/features/my-stack/lib/i18n.test.ts`
Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/my-stack/components/PlanManagementSection.tsx src/features/my-stack/components/PlanManagementSection.test.tsx src/features/my-stack/MyStackPage.tsx src/features/my-stack/MyStackPage.visibility.test.tsx src/features/my-stack/lib/planSegments.ts src/features/my-stack/lib/planSegments.test.ts src/i18n/locales src/features/my-stack/lib/i18n.test.ts
git commit -m "feat: add versioned plan management UI"
```

---

### Task 9: Persist plan-version provenance on confirmations

**Files:**
- Modify: `src/features/routines/intakeGroups.ts`
- Modify: `src/features/routines/intakeGroups.test.ts`
- Modify: `src/features/routines/services/intakeConfirmation.ts`
- Modify: `src/features/routines/services/intakeConfirmation.test.ts`
- Modify: `supabase-my-stack-plan-integrity.sql`
- Modify: `src/features/my-stack/lib/planIntegritySchema.test.ts`

**Interfaces:**
- Consumes: `ResolvedTimelineIntake.planVersionId` from Task 2.
- Produces dose logs with verified `cycle_id` and `plan_version_id`.

- [ ] **Step 1: Write failing payload and SQL validation tests**

Add `planVersionId` to `RoutineIntake`. Assert the client sends `plan_version_id` and `timezone`. Assert SQL calls `resolve_plan_version_id()` and rejects a mismatched version with `Plan version does not match scheduled intake`.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- src/features/routines/intakeGroups.test.ts src/features/routines/services/intakeConfirmation.test.ts src/features/my-stack/lib/planIntegritySchema.test.ts`
Expected: FAIL on missing fields/SQL validation.

- [ ] **Step 3: Update the confirmation contract**

Extend the payload entry:

```ts
interface ConfirmIntakeGroupRpcEntry {
  cycle_id: string
  plan_version_id: string
  timezone: string
  dose_log_id: string | null
  slot_key: string
  stack_item_id: string
  dose: number | null
  unit: string | null
  method: string
  logged_at: string
}
```

Use `Intl.DateTimeFormat().resolvedOptions().timeZone` in the client. The RPC independently resolves the expected version for `logged_at` and supplied timezone before insert/upsert.

- [ ] **Step 4: Preserve neutral pause semantics**

The occurrence builder must never offer paused slots to this service. The RPC additionally rejects `logged_at` inside a pause interval. Manual PRN entries remain allowed and resolve the version valid at the manual timestamp.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/features/routines/intakeGroups.test.ts src/features/routines/services/intakeConfirmation.test.ts src/features/my-stack/lib/planIntegritySchema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/routines/intakeGroups.ts src/features/routines/intakeGroups.test.ts src/features/routines/services/intakeConfirmation.ts src/features/routines/services/intakeConfirmation.test.ts supabase-my-stack-plan-integrity.sql src/features/my-stack/lib/planIntegritySchema.test.ts
git commit -m "feat: link confirmed doses to exact plan versions"
```

---

### Task 10: Cut Home and Calendar over to the timeline resolver

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.ts`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Dashboard.test.ts`
- Modify: `src/lib/intakeSchedule.ts`
- Modify: `src/lib/intakeSchedule.test.ts`

**Interfaces:**
- Consumes: `loadCycleTimelines()`, `resolveTimelineIntakesForDay()`.
- Produces consistent due/next/missed behavior and neutral pause history.

- [ ] **Step 1: Write failing page behavior tests**

For both pages, test:

- same selected day returns the same slots and version IDs,
- morning old/evening new around a noon change,
- paused day has no due card and no auto-missed insert,
- a slot before a noon pause can still become missed,
- PRN has no automatic due/miss,
- separate duplicate stack items each produce their own slots.

- [ ] **Step 2: Run page tests and confirm legacy failures**

Run: `npm test -- src/pages/Home.test.ts src/pages/Dashboard.test.ts`
Expected: FAIL because pages still load `schedule_history` and `dose_escalations`.

- [ ] **Step 3: Add timeline-aware missed/open collectors**

In `intakeSchedule.ts`, export these exact timeline equivalents:

```ts
export function collectOpenTimelineIntakes(
  timelines: CycleTimeline[], logs: IntakeLog[], day: Date, timeZone: string,
): ResolvedTimelineIntake[]

export function collectMissedTimelineIntakes(
  timelines: CycleTimeline[], logs: IntakeLog[], now: Date, timeZone: string,
  lookbackDays?: number,
): MissedIntake[]

export function findOldestOverdueTimelineIntake(
  timelines: CycleTimeline[], logs: IntakeLog[], stackItemNameById: Map<string, string>,
  now: Date, timeZone: string, lookbackDays?: number,
): OverdueIntake | null
```

Count decided logs by `routine_slot_key`/cycle/version, not only `stack_item_id` and daily ordinal position. Keep legacy collectors available behind the false side of `planTimelineV2` until Task 14.

- [ ] **Step 4: Switch Home data and calculation**

Load cycles with `cycle_plan_versions` and `cycle_pause_periods`; stop fetching `dose_escalations` when `planTimelineV2` is enabled. Build routine entries from `ResolvedTimelineIntake`, including `planVersionId`.

- [ ] **Step 5: Switch Calendar data and calculation**

Use the identical occurrence/collector functions. Replace local or page-specific schedule resolution. Render one compact pause-range message instead of synthetic skipped rows.

- [ ] **Step 6: Run tests and build**

Run: `npm test -- src/pages/Home.test.ts src/pages/Dashboard.test.ts src/lib/intakeSchedule.test.ts`
Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Home.tsx src/pages/Home.test.ts src/pages/Dashboard.tsx src/pages/Dashboard.test.ts src/lib/intakeSchedule.ts src/lib/intakeSchedule.test.ts
git commit -m "feat: use versioned plan timelines on Home and Calendar"
```

---

### Task 11: Make reminders use the same timeline contract

**Files:**
- Create: `api/_lib/planTimeline.js`
- Create: `api/_lib/planTimeline.parity.test.js`
- Modify: `api/_lib/reminderSchedule.js`
- Modify: `api/_lib/reminderSchedule.test.js`
- Modify: `api/send-reminders.js`
- Modify: `api/_lib/reminderSchedule.parity.test.js`

**Interfaces:**
- Consumes the same serialized cycle/version/pause rows as the TypeScript resolver.
- Produces `resolveCycleAt()` and `resolveTimelineIntakesForDay()` behaviorally identical to Tasks 1–2.

- [ ] **Step 1: Write failing cross-runtime parity fixtures**

Use the same fixtures for local-date boundary, noon instant change, open pause, scheduled pause end, PRN, Berlin, New York, and DST transition. Compare normalized outputs from the TypeScript and Node adapters.

- [ ] **Step 2: Run parity tests**

Run: `npm test -- api/_lib/planTimeline.parity.test.js api/_lib/reminderSchedule.parity.test.js`
Expected: FAIL because the API adapter is absent.

- [ ] **Step 3: Implement the Node adapter and reminder query**

Keep `localParts()` as the API timezone primitive. Replace reminder reads of `schedule_history` and `dose_escalations` with relational fetches of plan versions and pauses. For each subscription, pass its stored IANA timezone into the timeline resolver.

An invalid stored timezone remains an operational error for that subscription and is logged without sending a potentially wrong reminder; do not silently send using UTC.

- [ ] **Step 4: Verify exact-minute behavior**

Run: `npm test -- api/_lib/planTimeline.parity.test.js api/_lib/reminderSchedule.test.js api/_lib/reminderSchedule.parity.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_lib/planTimeline.js api/_lib/planTimeline.parity.test.js api/_lib/reminderSchedule.js api/_lib/reminderSchedule.test.js api/send-reminders.js api/_lib/reminderSchedule.parity.test.js
git commit -m "feat: resolve reminders from versioned plan timelines"
```

---

### Task 12: Cut secondary schedule consumers over

**Files:**
- Modify: `src/lib/injectionPersistence.ts`
- Modify: `src/lib/injectionPersistence.test.ts`
- Modify: `src/services/liveBlutspiegelChart.ts`
- Modify: `src/services/liveBlutspiegelChart.test.ts`
- Modify: `src/pages/BlutspiegelSimulation.tsx`
- Modify: `src/components/BlutspiegelCarousel.tsx`
- Modify: `src/components/BlutspiegelCarousel.test.tsx`
- Modify: `src/features/my-stack/lib/pkReadiness.ts`
- Modify: `src/features/my-stack/lib/pkReadiness.test.ts`
- Modify: `src/features/my-stack/lib/dosePlan.ts`
- Modify: `src/features/my-stack/lib/dosePlan.test.ts`
- Modify: `src/lib/doseAdjustmentBackfill.ts`
- Modify: `src/lib/doseAdjustmentBackfill.test.ts`

**Interfaces:**
- Consumes exact `cycle_id`/`plan_version_id` provenance and timeline resolver.
- Removes active reads/writes of additive `dose_escalations` after the feature flag switches.

- [ ] **Step 1: Add failing provenance tests**

Assert injection pending-dose lookup uses the log's plan-version snapshot, PK projections use normalized future versions, readiness inspects the current resolved version, and a new dose adjustment never writes `dose_escalations`.

- [ ] **Step 2: Run focused suites**

Run: `npm test -- src/lib/injectionPersistence.test.ts src/services/liveBlutspiegelChart.test.ts src/components/BlutspiegelCarousel.test.tsx src/features/my-stack/lib/pkReadiness.test.ts src/features/my-stack/lib/dosePlan.test.ts src/lib/doseAdjustmentBackfill.test.ts`
Expected: FAIL on legacy escalation assumptions.

- [ ] **Step 3: Replace legacy calculations**

- Injection uses the linked log snapshot; an unconfirmed due intake carries `planVersionId` from the occurrence resolver.
- PK uses confirmed log snapshots for history and plan versions only for explicit future projection.
- `dosePlan.ts` creates a full plan-version input instead of an additive increase.
- `doseAdjustmentBackfill.ts` remains only as a migration verifier for legacy rows; remove it from live mutations.

- [ ] **Step 4: Run suites and build**

Run the command from Step 2 again.
Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/injectionPersistence.ts src/lib/injectionPersistence.test.ts src/services/liveBlutspiegelChart.ts src/services/liveBlutspiegelChart.test.ts src/pages/BlutspiegelSimulation.tsx src/components/BlutspiegelCarousel.tsx src/components/BlutspiegelCarousel.test.tsx src/features/my-stack/lib/pkReadiness.ts src/features/my-stack/lib/pkReadiness.test.ts src/features/my-stack/lib/dosePlan.ts src/features/my-stack/lib/dosePlan.test.ts src/lib/doseAdjustmentBackfill.ts src/lib/doseAdjustmentBackfill.test.ts
git commit -m "refactor: use plan-version provenance in secondary consumers"
```

---

### Task 13: Resolve migration conflicts and enforce one open cycle

**Files:**
- Modify: `src/features/my-stack/MyStackPage.tsx`
- Modify: `src/features/my-stack/MyStackPage.visibility.test.tsx`
- Modify: `src/features/my-stack/components/PlanManagementSection.tsx`
- Modify: `src/features/my-stack/components/PlanManagementSection.test.tsx`
- Modify: `src/features/my-stack/services/planLifecycle.ts`
- Modify: `src/features/my-stack/services/planLifecycle.test.ts`
- Create: `supabase-my-stack-plan-integrity-enforce.sql`
- Modify: `src/features/my-stack/lib/planIntegritySchema.test.ts`

**Interfaces:**
- Produces `resolve_cycle_migration_conflict(stack_item_id, keep_cycle_id, idempotency_key)`.
- Produces final partial unique index for one `ended_at is null` cycle per stack item.

- [ ] **Step 1: Write failing conflict-resolution tests**

Render a `needs_review` item with two open cycles. Assert no due schedule is shown until the user chooses the real running cycle. Confirming keeps that cycle, marks the other migration-conflicted cycles closed from the resolution instant without deleting their history, and clears `needs_review` only when no unresolved conflict remains.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/features/my-stack/components/PlanManagementSection.test.tsx src/features/my-stack/MyStackPage.visibility.test.tsx src/features/my-stack/services/planLifecycle.test.ts`
Expected: FAIL because conflict resolution is not exposed.

- [ ] **Step 3: Implement conflict RPC and UI**

The RPC locks all cycles for the stack item, validates the selected cycle belongs to the user/item, closes the others with `ended_at = transaction_timestamp()`, records `closed_by_migration_resolution = true`, deletes the resolved conflict row, and returns the kept timeline. The UI explains that no existing intake history is deleted.

- [ ] **Step 4: Add the enforcement migration**

`supabase-my-stack-plan-integrity-enforce.sql` must abort if unresolved conflicts exist. Only then create:

```sql
create unique index if not exists cycles_one_open_per_stack_item
  on public.cycles(stack_item_id)
  where ended_at is null;
```

It also revokes authenticated direct writes to legacy plan columns/functions after every consumer has switched. It does not drop `schedule_history` or `dose_escalations`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/features/my-stack/components/PlanManagementSection.test.tsx src/features/my-stack/MyStackPage.visibility.test.tsx src/features/my-stack/services/planLifecycle.test.ts src/features/my-stack/lib/planIntegritySchema.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/my-stack/MyStackPage.tsx src/features/my-stack/MyStackPage.visibility.test.tsx src/features/my-stack/components/PlanManagementSection.tsx src/features/my-stack/components/PlanManagementSection.test.tsx src/features/my-stack/services/planLifecycle.ts src/features/my-stack/services/planLifecycle.test.ts supabase-my-stack-plan-integrity-enforce.sql src/features/my-stack/lib/planIntegritySchema.test.ts
git commit -m "feat: resolve cycle conflicts and enforce one open plan"
```

---

### Task 14: Dry-run migrations, enable V2, and perform final verification

**Files:**
- Modify: `src/config/features.ts`
- Modify: `docs/superpowers/specs/2026-09-18-my-stack-planintegritaet-design.md` only to append measured verification results.
- Generated by command: `graphify-out/*`

**Interfaces:**
- Consumes every prior task.
- Produces a verified, reviewable branch; it does not apply SQL to production or push without separate approval.

- [ ] **Step 1: Rebuild a production-shaped PostgreSQL 16 fixture**

Include the current columns, constraints, indexes, policies, 2+ cycles for one item, `schedule_history`, all three escalation start modes, confirmed/skipped logs, PRN, and a pause-spanning scenario. Do not copy real user values into the fixture.

- [ ] **Step 2: Run the additive migration twice**

Run with `psql -v ON_ERROR_STOP=1 -f supabase-my-stack-plan-integrity.sql` twice against the fixture.
Expected: both runs exit 0; second run changes no row counts and creates no duplicate versions/receipts/conflicts.

- [ ] **Step 3: Record before/after counts and invariants**

Record counts for `stack_items`, `cycles`, `cycle_plan_versions`, `cycle_pause_periods`, `dose_escalations`, and `dose_logs`. Assert dose-log count and snapshots are byte-for-byte unchanged, every conflict is surfaced, and non-conflicted cycles have a version at their start.

- [ ] **Step 4: Resolve fixture conflicts and run enforcement twice**

Use the conflict RPC, then run `supabase-my-stack-plan-integrity-enforce.sql` twice.
Expected: both runs exit 0; inserting a second open cycle for one item fails with the unique index.

- [ ] **Step 5: Enable the internal V2 reader**

Set `planTimelineV2: true` only after dual-read parity tests report no unexplained differences. Keep legacy tables and columns in place.

- [ ] **Step 6: Run the complete verification suite**

Run:

```bash
npm test
npm run build
npm run lint
```

Expected: all tests pass, build exits 0, and lint introduces no new errors. If repository-wide lint has a documented baseline, compare the exact count and require no increase.

- [ ] **Step 7: Run Graphify update and inspect the focused dependency graph**

Run:

```bash
graphify update .
graphify query "plan timeline cycle versions pauses Home Dashboard reminders"
```

Expected: new resolver and service nodes connect to My Stack, Home, Dashboard, routines, reminders, injection, and PK consumers; no live consumer remains connected only to `dose_escalations` or `schedule_history`.

- [ ] **Step 8: Append measured verification results to the spec**

Append the actual dry-run row counts, parity result, test count, build result, lint result, and Graphify audit result. Do not claim production migration.

- [ ] **Step 9: Commit the verified cutover**

```bash
git add src/config/features.ts docs/superpowers/specs/2026-09-18-my-stack-planintegritaet-design.md graphify-out
git commit -m "chore: verify and enable My Stack plan timeline"
```

---

## Production Rollout Gate

The implementation branch may be code-complete before production rollout. Applying either SQL file to Supabase requires a separate explicit user approval after the local PostgreSQL dry-run report is shown.

Production order:

1. Apply `supabase-my-stack-plan-integrity.sql`.
2. Recount all affected tables and compare with the dry run.
3. Inspect and resolve every migration conflict through the app.
4. Confirm dual-read parity in deployed code.
5. Apply `supabase-my-stack-plan-integrity-enforce.sql`.
6. Recount and verify the unique invariant.
7. Only then remove the internal rollout switch in a later cleanup.

No legacy column or table is dropped by this plan.

## Plan Self-Review

- **Spec coverage:** Domain model (Tasks 1–2), schema/RLS (Task 3), transactional writes and idempotency (Task 4), migration/conflicts (Tasks 5 and 13), services and wizard targeting (Tasks 6–7), approved UX (Task 8), dose-log provenance (Task 9), Home/Calendar (Task 10), reminders/timezones (Task 11), injection/PK consumers (Task 12), enforcement and rollout (Tasks 13–14).
- **Scope:** Inventory, Earn, medical recommendations, visual redesign, offline sync, and stage performance are explicitly excluded.
- **Type consistency:** `CycleTimeline`, `CyclePlanVersion`, `CyclePausePeriod`, `PlanScheduleSnapshot`, `PlanEditTarget`, and `ResolvedTimelineIntake.planVersionId` are introduced once and consumed by name in later tasks.
- **Safety:** Migrations are additive, idempotent, dry-run twice, never delete logs, surface ambiguous cycles, and require a separate production approval.
- **Testability:** Every behavioral task begins with a focused failing test and ends with a targeted suite plus a commit.
