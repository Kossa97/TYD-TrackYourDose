# My Stack Tracking Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three explicit per-substance tracking levels, integrated routine setup, nullable quantity tracking, grouped confirmations, dose adjustments/titration, honest PK readiness, and opt-in generic inventory while preserving the current peptide/Vial experience.

**Architecture:** Extend the existing `stack_items`/`cycles`/`dose_logs` model instead of creating a parallel “simple tracking” system. Keep pure decisions in focused `src/features/my-stack/lib/` and `src/features/routines/` modules, use transactional Supabase RPCs for multi-row writes, and let UI pages consume typed readiness/results rather than reimplementing rules.

**Tech Stack:** React 19, TypeScript, Vite 8, Vitest, Testing Library, Supabase/PostgreSQL, i18next, date-fns.

## Global Constraints

- Tracking levels use the stable values `intake_only`, `with_amount`, and `complete`.
- The user explicitly chooses a tracking level per stack item; no level is described as medically better or safer.
- Missing quantities are stored as `NULL`, never as `0`, `1`, or another estimate.
- `with_amount` and `complete` both support one-off dose overrides, permanent changes, and multi-step titration.
- Only `complete` exposes PK/live-blood-level features, and only after a central readiness check succeeds.
- Unknown taken quantities interrupt PK curves; they are never replaced with the cycle dose.
- Package and inventory fields remain hidden until the user explicitly enables inventory tracking.
- Existing peptide entries keep their current behavior and are backfilled to `complete`; migrated `needs_review` data is not forced through the wizard.
- Confirmed historical logs are immutable under plan and titration changes.
- Injection-site tracking remains optional and never blocks intake confirmation.
- Product dosage-form visuals remain unchanged in this project; concrete brand packaging is not rendered.
- No medical dose or titration recommendations are added.
- German and English copy are authored manually. Other locale files receive complete translated keys through the existing My Stack translation script.

---

## File and Responsibility Map

**Database contract**

- Create `supabase-my-stack-tracking-depth.sql`: incremental, idempotent schema/RPC migration.
- Create `supabase-my-stack-tracking-depth-verify.sql`: read-only assertions for the linked project.
- Create `supabase-my-stack-tracking-depth-rollback.sql`: rollback only the new RPCs/tables/columns where safe; never reconstruct historical quantities.
- Modify `supabase-my-stack-foundation.sql`: make fresh installs end at the same schema as the incremental migration.

**Domain model**

- Modify `src/features/my-stack/types.ts`: tracking level, plan draft, inventory draft, nullable-dose types.
- Create `src/features/my-stack/lib/trackingDepth.ts`: level metadata and feature gates.
- Create `src/features/my-stack/lib/pkReadiness.ts`: one source of truth for PK availability/missing/unsupported states.
- Modify `src/features/my-stack/lib/validation.ts`: level-aware validation.
- Modify `src/features/my-stack/lib/wizardState.ts`: dynamic wizard path and setup draft.
- Modify `src/lib/intakeSchedule.ts`: nullable planned quantities and null-safe effective dose.
- Modify `src/lib/doseAdjustmentBackfill.ts`: update only quantified open logs.

**Wizard**

- Create `src/features/my-stack/components/TrackingLevelPicker.tsx`: the three explained choices.
- Create `src/features/my-stack/components/IntakePlanEditor.tsx`: routine group, optional time, frequency, and level-aware quantity.

- Modify `src/features/my-stack/components/StackItemWizard.tsx`: render the dynamic flow and one review/save boundary.

**Persistence and page integration**

- Modify `src/features/my-stack/services/stackItems.ts`: transactional item-plus-plan RPC.
- Create `src/features/routines/intakeGroups.ts`: pure grouping, labels, and confirmation payloads.
- Create `src/features/routines/services/intakeConfirmation.ts`: single and group RPC adapters.
- Create `src/features/routines/components/RoutineConfirmationSheet.tsx`: selection and per-item actual-quantity overrides.
- Modify `src/features/my-stack/MyStackPage.tsx`: use integrated setup, tracking-level gates, and existing titration UI.
- Modify `src/pages/Dashboard.tsx`: grouped daily confirmation and nullable-dose presentation.
- Modify `src/pages/Home.tsx`: use the same group model and confirmation service.

**PK and inventory consumers**

- Modify `src/services/blutspiegelHistory.ts`: stop fallback estimation and return interruption metadata.
- Modify `src/services/liveBlutspiegelChart.ts`: filter through readiness and preserve actual/planned distinction.
- Modify `src/pages/BlutspiegelSimulation.tsx`: readiness states and targeted upgrade link.
- Modify `src/components/BlutspiegelCarousel.tsx`: hide unsupported cards and explain incomplete ones.
- Modify `src/components/liveCycleChart/LiveCycleChartCanvas.tsx`: visually distinguish actual and planned curve segments.
- Modify `src/components/liveCycleChart/chartMath.ts`: split chart data at actual/planned and interrupted boundaries.
- Create `src/features/my-stack/lib/inventoryMath.ts`: generic basis-unit stock conversion.
- Create `src/features/my-stack/components/ProductInventorySection.tsx`: collapsed opt-in product/inventory editor.
- Modify `src/features/my-stack/extensions/peptide/vialStock.ts`: remain the vial-specific adapter.

**Copy and verification**

- Modify `scripts/my-stack-i18n-source.mjs`.
- Modify `src/i18n/locales/de.json`, `src/i18n/locales/en.json`, and the remaining locale JSON files.
- Modify focused existing tests and add the tests named in the tasks below.

---

### Task 1: Establish the tracking-depth database contract

**Files:**
- Create: `supabase-my-stack-tracking-depth.sql`
- Create: `supabase-my-stack-tracking-depth-verify.sql`
- Create: `supabase-my-stack-tracking-depth-rollback.sql`
- Modify: `supabase-my-stack-foundation.sql:82-95`
- Test: `src/features/my-stack/lib/trackingDepthSchema.test.ts`

**Interfaces:**
- Produces: `stack_items.tracking_level`, `stack_items.pk_profile_method`, nullable `cycles.dose/unit`, nullable `dose_logs.dose/unit`.
- Consumes: existing `stack_items`, `cycles`, `dose_logs`, and `save_stack_item(jsonb,jsonb)`.

- [ ] **Step 1: Write the failing SQL contract test**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync('supabase-my-stack-tracking-depth.sql', 'utf8')
const verify = readFileSync('supabase-my-stack-tracking-depth-verify.sql', 'utf8')
const foundation = readFileSync('supabase-my-stack-foundation.sql', 'utf8')

describe('My Stack tracking depth schema', () => {
  it('adds a checked tracking level and preserves existing items as complete', () => {
    expect(migration).toContain('add column if not exists tracking_level')
    expect(migration).toContain("'intake_only', 'with_amount', 'complete'")
    expect(migration).toContain("update public.stack_items")
    expect(migration).toContain("tracking_level = 'complete'")
  })

  it('allows unknown planned and logged quantities without inventing zero', () => {
    expect(migration).toContain('alter column dose drop not null')
    expect(migration).toContain('alter column unit drop not null')
    expect(migration).not.toMatch(/coalesce\\([^)]*dose[^)]*,\\s*0\\)/i)
  })

  it('keeps fresh installs and incremental installs aligned', () => {
    expect(foundation).toContain('tracking_level')
    expect(foundation).toContain('pk_profile_method')
    expect(verify).toContain('tracking_depth_contract')
  })
})
```

- [ ] **Step 2: Run the contract test and verify it fails**

Run:

```bash
npm test -- src/features/my-stack/lib/trackingDepthSchema.test.ts
```

Expected: FAIL because the three SQL files and tracking columns do not exist.

- [ ] **Step 3: Add the idempotent core migration**

Add this contract to `supabase-my-stack-tracking-depth.sql`:

```sql
begin;

alter table public.stack_items
  add column if not exists tracking_level text not null default 'complete',
  add column if not exists pk_profile_method text;

alter table public.stack_items
  drop constraint if exists stack_items_tracking_level_check;

alter table public.stack_items
  add constraint stack_items_tracking_level_check
  check (tracking_level in ('intake_only', 'with_amount', 'complete'));

update public.stack_items
set tracking_level = 'complete'
where tracking_level is null;

update public.stack_items
set pk_profile_method = nullif(btrim(default_method), '')
where pk_profile_id is not null
  and pk_profile_method is null;

alter table public.cycles
  alter column dose drop not null,
  alter column unit drop not null;

alter table public.dose_logs
  alter column dose drop not null,
  alter column unit drop not null;

commit;
```

Mirror the new `stack_items` columns and nullable cycle/log definitions in `supabase-my-stack-foundation.sql`. Do not remove legacy vial columns.

- [ ] **Step 4: Add read-only verification and conservative rollback SQL**

`supabase-my-stack-tracking-depth-verify.sql` must return one JSON object:

```sql
select jsonb_build_object(
  'tracking_depth_contract', jsonb_build_object(
    'stack_items_tracking_level',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'stack_items'
          and column_name = 'tracking_level'
          and is_nullable = 'NO'
      ),
    'cycles_dose_nullable',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'cycles'
          and column_name = 'dose'
          and is_nullable = 'YES'
      ),
    'dose_logs_dose_nullable',
      exists (
        select 1 from information_schema.columns
        where table_schema = 'public'
          and table_name = 'dose_logs'
          and column_name = 'dose'
          and is_nullable = 'YES'
      )
  )
);
```

The rollback must restore `cycles`/`dose_logs` non-null constraints only after a
guard proves no null rows exist. It may drop `tracking_level` only when every
row is still `complete`, and may drop `pk_profile_method` only when every
non-null value still equals the item's `default_method`. Otherwise it must raise
an exception. It never fills missing doses or discards a user's tracking choice.

- [ ] **Step 5: Run the SQL contract tests**

Run:

```bash
npm test -- src/features/my-stack/lib/trackingDepthSchema.test.ts src/features/my-stack/lib/schemaMigration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase-my-stack-tracking-depth.sql supabase-my-stack-tracking-depth-verify.sql supabase-my-stack-tracking-depth-rollback.sql supabase-my-stack-foundation.sql src/features/my-stack/lib/trackingDepthSchema.test.ts
git commit -m "feat: add tracking depth database contract"
```

---

### Task 2: Add tracking-level types and conditional validation

**Files:**
- Modify: `src/features/my-stack/types.ts`
- Create: `src/features/my-stack/lib/trackingDepth.ts`
- Create: `src/features/my-stack/lib/trackingDepth.test.ts`
- Modify: `src/features/my-stack/lib/validation.ts`
- Modify: `src/features/my-stack/lib/validation.test.ts`

**Interfaces:**
- Produces:
  - `TrackingLevel = 'intake_only' | 'with_amount' | 'complete'`
  - `IntakePlanDraft`
  - `StackItemSetupDraft`
  - `trackingCapabilities(level)`
  - `validateStackItemDraft(draft)`
- Consumes: existing `StackItemDraft`, `StackItemIngredient`, dosage-form capabilities.

- [ ] **Step 1: Write failing capability and validation tests**

```ts
import { describe, expect, it } from 'vitest'
import { trackingCapabilities } from './trackingDepth'

describe('trackingCapabilities', () => {
  it('keeps titration in with_amount and complete', () => {
    expect(trackingCapabilities('intake_only').titration).toBe(false)
    expect(trackingCapabilities('with_amount').titration).toBe(true)
    expect(trackingCapabilities('complete').titration).toBe(true)
  })

  it('reserves PK and inventory opt-in for complete', () => {
    expect(trackingCapabilities('with_amount').pk).toBe(false)
    expect(trackingCapabilities('complete').pk).toBe(true)
    expect(trackingCapabilities('complete').inventory).toBe(true)
  })
})
```

Extend `validation.test.ts` with:

```ts
it('allows missing strength for intake_only and with_amount', () => {
  for (const trackingLevel of ['intake_only', 'with_amount'] as const) {
    const errors = validateStackItemDraft({
      ...validVitaminD,
      trackingLevel,
      ingredients: [{ ...ingredient, amount_value: null, amount_unit: null }],
    })
    expect(errors.ingredients?.[0]?.amountValue).toBeUndefined()
  }
})

it('requires product strength for complete', () => {
  const errors = validateStackItemDraft({
    ...validVitaminD,
    trackingLevel: 'complete',
    ingredients: [{ ...ingredient, amount_value: null, amount_unit: null }],
  })
  expect(errors.ingredients?.[0]?.amountValue).toBe('required_for_complete')
})
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npm test -- src/features/my-stack/lib/trackingDepth.test.ts src/features/my-stack/lib/validation.test.ts
```

Expected: FAIL because the type, helper, and level-aware validation do not exist.

- [ ] **Step 3: Add the domain types**

Add to `types.ts`:

```ts
export type TrackingLevel = 'intake_only' | 'with_amount' | 'complete'
export type RoutineGroup = 'morning' | 'midday' | 'evening'

export interface IntakePlanDraft {
  id?: string
  name: string
  dose: number | null
  unit: string | null
  method: string
  frequency: string
  xDaysInterval: number | null
  scheduleDays: string[]
  startDate: string
  endDate: string | null
  routineGroup: RoutineGroup
  time: string | null
  reminders: string[]
}

export interface InventoryDraft {
  enabled: boolean
  packageQuantity: number | null
  packageUnit: string | null
  remainingQuantity: number | null
  brand: string
  batchNumber: string
  expiresAt: string | null
}

export interface StackItemSetupDraft extends StackItemDraft {
  plan: IntakePlanDraft
  inventory: InventoryDraft
  pkProfileMethod: string | null
}
```

Add `tracking_level` and `pk_profile_method` to `StackItem`, and add `trackingLevel` to `StackItemDraft`.

- [ ] **Step 4: Implement the capability matrix**

`trackingDepth.ts`:

```ts
import type { TrackingLevel } from '../types'

export interface TrackingCapabilities {
  quantity: boolean
  titration: boolean
  productStrength: boolean
  pk: boolean
  inventory: boolean
}

const CAPABILITIES: Record<TrackingLevel, TrackingCapabilities> = {
  intake_only: {
    quantity: false,
    titration: false,
    productStrength: false,
    pk: false,
    inventory: false,
  },
  with_amount: {
    quantity: true,
    titration: true,
    productStrength: false,
    pk: false,
    inventory: false,
  },
  complete: {
    quantity: true,
    titration: true,
    productStrength: true,
    pk: true,
    inventory: true,
  },
}

export function trackingCapabilities(level: TrackingLevel): TrackingCapabilities {
  return CAPABILITIES[level]
}
```

- [ ] **Step 5: Make validation level-aware**

Change `validateIngredient` to receive the tracking level and only require
`amount_value`, `amount_unit`, `basis_value`, and `basis_unit` when
`trackingCapabilities(level).productStrength` is true. Ingredient identity and
dosage form remain required for every level. Add plan validation:

```ts
export function validateIntakePlan(
  plan: IntakePlanDraft,
  level: TrackingLevel,
): IntakePlanValidationErrors {
  const errors: IntakePlanValidationErrors = {}
  if (!plan.name.trim()) errors.name = 'required'
  if (!plan.frequency.trim()) errors.frequency = 'required'
  if (!plan.routineGroup) errors.routineGroup = 'required'
  if (trackingCapabilities(level).quantity) {
    if (plan.dose == null || plan.dose <= 0) errors.dose = 'required'
    if (!plan.unit?.trim()) errors.unit = 'required'
  }
  return errors
}
```

- [ ] **Step 6: Run the focused tests**

Run:

```bash
npm test -- src/features/my-stack/lib/trackingDepth.test.ts src/features/my-stack/lib/validation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/my-stack/types.ts src/features/my-stack/lib/trackingDepth.ts src/features/my-stack/lib/trackingDepth.test.ts src/features/my-stack/lib/validation.ts src/features/my-stack/lib/validation.test.ts
git commit -m "feat: model my stack tracking levels"
```

---

### Task 3: Make schedule math safe for unknown quantities

**Files:**
- Modify: `src/lib/intakeSchedule.ts`
- Modify: `src/lib/intakeSchedule.test.ts`
- Modify: `src/lib/doseAdjustmentBackfill.ts`
- Modify: `src/lib/doseAdjustmentBackfill.test.ts`
- Create: `src/features/routines/quantityPresentation.ts`
- Create: `src/features/routines/quantityPresentation.test.ts`

**Interfaces:**
- Produces:
  - `ScheduleSegment.dose: number | null`
  - `ScheduleSegment.unit: string | null`
  - `effectiveDose(...): number | null`
  - `formatTrackedQuantity(dose, unit, fallback): string`
- Consumes: existing schedule history and dose escalations.

- [ ] **Step 1: Write failing nullable-dose schedule tests**

```ts
it('returns null when the active segment does not track quantity', () => {
  expect(effectiveDose({
    ...cycle,
    dose: null,
    unit: null,
    schedule_history: null,
  }, new Date('2026-07-25'), [])).toBeNull()
})

it('does not apply escalations to an unknown base dose', () => {
  expect(effectiveDose({
    ...cycle,
    dose: null,
    unit: null,
  }, new Date('2026-07-25'), [{
    cycle_id: cycle.id,
    increase_amount: 5,
    start_type: 'date',
    start_date: '2026-07-20',
    start_after_days: null,
  }])).toBeNull()
})
```

Add a presentation test:

```ts
expect(formatTrackedQuantity(null, null, 'Menge nicht getrackt'))
  .toBe('Menge nicht getrackt')
expect(formatTrackedQuantity(0.5, 'tablet', 'Menge nicht getrackt'))
  .toBe('½ Tablette')
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/lib/intakeSchedule.test.ts src/lib/doseAdjustmentBackfill.test.ts src/features/routines/quantityPresentation.test.ts
```

Expected: FAIL because schedule quantities are non-null and the formatter is absent.

- [ ] **Step 3: Update schedule types and dose resolution**

Change both `ScheduleSegment` and `ScheduleCycle`:

```ts
dose: number | null
unit: string | null
```

Change `effectiveDose`:

```ts
export function effectiveDose(
  cycle: ScheduleCycle,
  day: Date,
  escalations: EscalationRow[],
): number | null {
  const baseDose = scheduleForDay(cycle, day).dose
  if (baseDose == null) return null

  const daysFromStart = differenceInDays(day, parseISO(cycle.start_date))
  let total = baseDose
  for (const escalation of escalations.filter(row => row.cycle_id === cycle.id)) {
    const activeByDate = escalation.start_type === 'date'
      && escalation.start_date != null
      && day >= parseISO(escalation.start_date)
    const activeByOffset = escalation.start_type !== 'date'
      && escalation.start_after_days != null
      && daysFromStart >= escalation.start_after_days
    if (activeByDate || activeByOffset) total += escalation.increase_amount
  }
  return total
}
```

- [ ] **Step 4: Keep backfill away from intake-only logs**

Change `DoseAdjustmentBackfillUpdate.unit` to `string | null`. Return no updates
when `effectiveDose(...)` or the active segment unit is null. Never write `0`.

- [ ] **Step 5: Implement quantity presentation**

`quantityPresentation.ts` must:

- return the supplied fallback for a null dose or blank unit;
- display `0.5`, `0.333333`, and `0.25` countable units as `½`, `⅓`, and `¼`;
- otherwise format up to three decimals without trailing zeroes;
- map `tablet`/`capsule` to translated labels in the component layer, not in the pure helper.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/lib/intakeSchedule.test.ts src/lib/doseAdjustmentBackfill.test.ts src/features/routines/quantityPresentation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/intakeSchedule.ts src/lib/intakeSchedule.test.ts src/lib/doseAdjustmentBackfill.ts src/lib/doseAdjustmentBackfill.test.ts src/features/routines/quantityPresentation.ts src/features/routines/quantityPresentation.test.ts
git commit -m "refactor: support unquantified intake schedules"
```

---

### Task 4: Build the explained, dynamic setup wizard

**Files:**
- Create: `src/features/my-stack/components/TrackingLevelPicker.tsx`
- Create: `src/features/my-stack/components/TrackingLevelPicker.test.tsx`
- Create: `src/features/my-stack/components/IntakePlanEditor.tsx`
- Create: `src/features/my-stack/components/IntakePlanEditor.test.tsx`

- Modify: `src/features/my-stack/lib/wizardState.ts`
- Modify: `src/features/my-stack/lib/wizardState.test.ts`
- Modify: `src/features/my-stack/components/StackItemWizard.tsx`
- Modify: `src/features/my-stack/components/StackItemWizard.interaction.test.tsx`

**Interfaces:**
- Consumes: `StackItemSetupDraft`, `trackingCapabilities`, level-aware validators.
- Produces:
  - `wizardSteps(state): WizardStep[]`
  - `StackItemWizardProps.onSave(draft: StackItemSetupDraft, mode)`
  - accessible tracking cards and initial plan editor.

- [ ] **Step 1: Write failing dynamic-path tests**

```ts
it.each([
  ['intake_only', ['substance', 'dosage_form', 'tracking_level', 'plan', 'review']],
  ['with_amount', ['substance', 'dosage_form', 'tracking_level', 'plan', 'review']],
  ['complete', ['substance', 'ingredients', 'dosage_form', 'tracking_level', 'strength', 'details', 'plan', 'review']],
] as const)('builds the %s path', (trackingLevel, expected) => {
  const state = {
    ...initialWizardState(),
    draft: { ...initialWizardState().draft, trackingLevel },
  }
  expect(wizardSteps(state)).toEqual(expected)
})
```

`TrackingLevelPicker.test.tsx` must assert all three cards contain:

- what will be recorded;
- what will not be required;
- a concrete example;
- the “change later” explanation;
- dynamic PK availability text on `complete`.

`IntakePlanEditor.test.tsx` must assert:

- quantity inputs are absent for `intake_only`;
- quantity and unit are present for `with_amount` and `complete`;
- routine group is required;
- time is optional;
- the fractional tablet shortcuts set `0.5`, `0.333333`, and `0.25`;
- Vitamin D3 plus tablet/capsule exposes its catalog units instead of peptide-only units;
- changing to a liquid or injectable dosage form changes the relevant quantity fields and labels.

- [ ] **Step 2: Run the wizard tests and verify they fail**

Run:

```bash
npm test -- src/features/my-stack/lib/wizardState.test.ts src/features/my-stack/components/TrackingLevelPicker.test.tsx src/features/my-stack/components/IntakePlanEditor.test.tsx src/features/my-stack/components/StackItemWizard.interaction.test.tsx
```

Expected: FAIL because the dynamic path and components are absent.

- [ ] **Step 3: Replace the static rendered-step array**

Extend `WizardStep` with `tracking_level` and `plan`. Add:

```ts
export function wizardSteps(state: WizardState): WizardStep[] {
  const level = state.draft.trackingLevel
  if (level === 'complete') {
    return [
      'substance',
      'ingredients',
      'dosage_form',
      'tracking_level',
      'strength',
      'details',
      'plan',
      'review',
    ]
  }
  return ['substance', 'dosage_form', 'tracking_level', 'plan', 'review']
}
```

When a user changes from `complete` to a lower level, retain ingredient strength,
brand, inventory draft, and PK method in state; only the rendered path and
validation change.

- [ ] **Step 4: Implement the tracking-level cards**

`TrackingLevelPicker` accepts:

```ts
interface TrackingLevelPickerProps {
  value: TrackingLevel
  substanceName: string
  pkProfileAvailable: boolean
  onChange: (value: TrackingLevel) => void
}
```

Use three semantic radio controls inside full-card labels. Each card renders
title, explanation, example, and “what comes next”. `complete` renders either
the available or unsupported PK message; it never promises a curve solely from
the selected level.

- [ ] **Step 5: Implement the plan editor**

`IntakePlanEditor` accepts the current level and `IntakePlanDraft`. It renders:

- frequency;
- weekday/interval controls already used by the current cycle form;
- one of the fixed routine groups morning/midday/evening;
- an optional exact time;
- dose and unit only when `trackingCapabilities(level).quantity` is true;
- unit suggestions from the selected catalog entry, filtered/presented through the
  existing dosage-form definition instead of a peptide-only list;
- dosage-form-specific strength/concentration fields for `complete`;
- fraction buttons for tablets when the dosage form is divisible. Capsules and
  other forms may still accept a manually entered fractional quantity but do not
  suggest splitting.

Keep reminders optional and do not request browser notification permission while
the wizard is open; permission remains a post-save action.

- [ ] **Step 6: Integrate steps and review into `StackItemWizard`**

The review must explicitly summarize:

- selected tracking level and its daily behavior;
- dosage form;
- routine group/frequency/time;
- quantity or “Menge wird nicht getrackt”;
- PK status for `complete`;
- existing optional product details such as brand, when entered.

Keep the existing focus trap, duplicate detection, save-mode choice, and error
retention.

- [ ] **Step 7: Run wizard tests**

Run:

```bash
npm test -- src/features/my-stack/lib/wizardState.test.ts src/features/my-stack/components/TrackingLevelPicker.test.tsx src/features/my-stack/components/IntakePlanEditor.test.tsx src/features/my-stack/components/StackItemWizard.interaction.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/my-stack/components/TrackingLevelPicker.tsx src/features/my-stack/components/TrackingLevelPicker.test.tsx src/features/my-stack/components/IntakePlanEditor.tsx src/features/my-stack/components/IntakePlanEditor.test.tsx src/features/my-stack/lib/wizardState.ts src/features/my-stack/lib/wizardState.test.ts src/features/my-stack/components/StackItemWizard.tsx src/features/my-stack/components/StackItemWizard.interaction.test.tsx
git commit -m "feat: add tracking depth setup flow"
```

---

### Task 5: Save stack item and initial plan atomically

**Files:**
- Modify: `supabase-my-stack-tracking-depth.sql`
- Modify: `supabase-my-stack-foundation.sql`
- Modify: `src/features/my-stack/services/stackItems.ts`
- Modify: `src/features/my-stack/services/stackItems.test.ts`
- Modify: `src/features/my-stack/MyStackPage.tsx`
- Modify: `src/features/my-stack/MyStackPage.test.ts`

**Interfaces:**
- Consumes: `StackItemSetupDraft`, existing `save_stack_item`.
- Produces:
  - RPC `save_stack_item_with_plan(jsonb,jsonb,jsonb)`
  - `saveStackItemSetup(client, draft): Promise<SavedStackItemRow>`

- [ ] **Step 1: Write failing service and SQL assertions**

```ts
it('sends item, ingredients, and the initial plan to one RPC', async () => {
  const client = rpcClient()
  await saveStackItemSetup(client, completeSetupDraft)
  expect(client.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', {
    p_item: expect.objectContaining({
      tracking_level: 'complete',
      pk_profile_method: 'Oral',
    }),
    p_ingredients: expect.any(Array),
    p_plan: expect.objectContaining({
      dose: 5000,
      unit: 'IU',
      intake_time: 'morgens',
    }),
  })
})

it('sends null dose and unit for intake_only', async () => {
  const client = rpcClient()
  await saveStackItemSetup(client, intakeOnlySetupDraft)
  expect(client.rpc).toHaveBeenCalledWith(
    'save_stack_item_with_plan',
    expect.objectContaining({
      p_plan: expect.objectContaining({ dose: null, unit: null }),
    }),
  )
})
```

Add a SQL test assertion that the RPC calls `save_stack_item`, validates the plan
against `tracking_level`, and inserts or updates `cycles` before returning.

- [ ] **Step 2: Run focused tests and verify they fail**

Run:

```bash
npm test -- src/features/my-stack/services/stackItems.test.ts src/features/my-stack/MyStackPage.test.ts src/features/my-stack/lib/trackingDepthSchema.test.ts
```

Expected: FAIL because `saveStackItemSetup` and the RPC are absent.

- [ ] **Step 3: Add the transactional RPC**

First extend the existing `save_stack_item(p_item,p_ingredients)` function so
it reads, validates, and persists `tracking_level` plus
`pk_profile_method`. Its ingredient strength/basis checks run only for
`complete`; ingredient identity and dosage form remain required for every
level. This server-side rule must match `validateStackItemDraft` so the RPC
cannot reject a draft the wizard considers valid.

Add `save_stack_item_with_plan(p_item jsonb, p_ingredients jsonb, p_plan jsonb)`.
Inside one PostgreSQL transaction/function call:

1. Call `save_stack_item(p_item,p_ingredients)` and capture the row.
2. Read `tracking_level`.
3. Require a non-empty plan name, frequency, method, start date, and routine
   group/intake time key.
4. Require positive dose plus unit for `with_amount` and `complete`.
5. Force `dose` and `unit` to null for `intake_only`.
6. Insert a new cycle when `p_plan.id` is null; otherwise update only the owned
   cycle whose `stack_item_id` matches the saved item.
7. Return the saved stack item.

The function is `security invoker`, sets `search_path = public`, rejects
`auth.uid() is null`, revokes execution from `public, anon`, and grants it only
to `authenticated`.

- [ ] **Step 4: Implement the service adapter**

Add `SaveStackItemSetupRpcParams` and:

```ts
export async function saveStackItemSetup(
  client: StackItemSetupRpcClient,
  draft: StackItemSetupDraft,
): Promise<SavedStackItemRow> {
  const itemErrors = validateStackItemDraft(draft)
  const planErrors = validateIntakePlan(draft.plan, draft.trackingLevel)
  if (Object.keys(itemErrors).length > 0 || Object.keys(planErrors).length > 0) {
    throw new Error('Invalid stack item setup draft')
  }

  const { data, error } = await client.rpc('save_stack_item_with_plan', {
    p_item: itemParams(draft),
    p_ingredients: draft.ingredients.map(ingredientForSave),
    p_plan: planParams(draft.plan, draft.trackingLevel),
  })
  throwIfError(error)
  if (!data) throw new Error('save_stack_item_with_plan returned no data')
  return data
}
```

Expose the existing private parameter builders rather than duplicating
normalization.

- [ ] **Step 5: Integrate the atomic save and remove the post-save cycle prompt**

In `MyStackPage.tsx`, replace `handleSaveStackItem` with
`saveStackItemSetup`. After success, reload stack items and cycles together.
Delete the new-item `setCyclePromptPeptide(...)` branch; existing standalone
cycle editing remains available.

When editing an existing item, pass its current active plan into the wizard.
Changing tracking level to `intake_only` changes future plan dose/unit to null
through a new schedule-history segment effective on the selected date. It does
not rewrite earlier schedule segments or any confirmed `dose_logs`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/features/my-stack/services/stackItems.test.ts src/features/my-stack/MyStackPage.test.ts src/features/my-stack/components/StackItemWizard.interaction.test.tsx src/features/my-stack/lib/trackingDepthSchema.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase-my-stack-tracking-depth.sql supabase-my-stack-foundation.sql src/features/my-stack/services/stackItems.ts src/features/my-stack/services/stackItems.test.ts src/features/my-stack/MyStackPage.tsx src/features/my-stack/MyStackPage.test.ts
git commit -m "feat: save stack setup atomically"
```

---

### Task 6: Add mixed routine groups and one-tap group confirmation

**Files:**
- Create: `src/features/routines/intakeGroups.ts`
- Create: `src/features/routines/intakeGroups.test.ts`
- Create: `src/features/routines/services/intakeConfirmation.ts`
- Create: `src/features/routines/services/intakeConfirmation.test.ts`
- Create: `src/features/routines/components/RoutineConfirmationSheet.tsx`
- Create: `src/features/routines/components/RoutineConfirmationSheet.test.tsx`
- Modify: `supabase-my-stack-tracking-depth.sql`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/Dashboard.test.ts`
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Home.test.ts`

**Interfaces:**
- Produces:
  - `RoutineIntake`
  - `groupRoutineIntakes(intakes): RoutineGroupModel[]`
  - RPC `confirm_intake_group(jsonb)`
  - `confirmIntakeGroup(client, entries)`
- Consumes: nullable schedules, tracking level, optional pending log IDs.

- [ ] **Step 1: Write failing pure grouping tests**

```ts
it('groups mixed tracking levels by fixed period', () => {
  const groups = groupRoutineIntakes([
    intake({ id: 'd3', group: 'morning', trackingLevel: 'intake_only', dose: null, unit: null }),
    intake({ id: 'zinc', group: 'morning', trackingLevel: 'with_amount', dose: 25, unit: 'mg' }),
    intake({ id: 'test', group: 'morning', trackingLevel: 'complete', dose: 100, unit: 'mg' }),
  ])
  expect(groups[0].key).toBe('morning')
  expect(groups[0].items).toHaveLength(3)
})

it('builds no fake quantity for intake_only', () => {
  expect(buildConfirmationEntry(intake({
    trackingLevel: 'intake_only',
    dose: null,
    unit: null,
  }))).toMatchObject({ dose: null, unit: null, taken: true })
})
```

- [ ] **Step 2: Write failing RPC adapter and component tests**

The service test must assert one `confirm_intake_group` call for all selected
entries. The sheet test must assert:

- all entries start selected;
- an entry can be deselected;
- quantified entries expose “Menge ändern”;
- intake-only entries do not render a quantity input;
- optional “Injektionsstelle ergänzen” is a post-confirm action and does not
  disable the group-confirm button.

- [ ] **Step 3: Run focused tests and verify they fail**

Run:

```bash
npm test -- src/features/routines/intakeGroups.test.ts src/features/routines/services/intakeConfirmation.test.ts src/features/routines/components/RoutineConfirmationSheet.test.tsx src/pages/Dashboard.test.ts src/pages/Home.test.ts
```

Expected: FAIL because the routine feature modules and grouped action are absent.

- [ ] **Step 4: Implement the pure group model**

Use:

```ts
export interface RoutineIntake {
  key: string
  cycleId: string
  pendingLogId: string | null
  stackItemId: string
  stackItemName: string
  trackingLevel: TrackingLevel
  group: RoutineGroup
  scheduledAt: string
  dose: number | null
  unit: string | null
  method: string
  injectable: boolean
}

export interface RoutineConfirmationEntry extends RoutineIntake {
  selected: boolean
  actualDose: number | null
  actualUnit: string | null
}
```

`groupRoutineIntakes` sorts groups morning, midday, evening and items by
`scheduledAt`. `buildConfirmationEntry` forces actual dose/unit null for
`intake_only`.

- [ ] **Step 5: Add the group-confirmation RPC**

`confirm_intake_group(p_entries jsonb)` validates ownership and loops over the
array. For each selected entry:

- update an owned pending log when `dose_log_id` is present;
- otherwise insert a new log;
- store `dose`/`unit` exactly as supplied, including null;
- require both or neither;
- require a positive dose for non-null values;
- set `taken = true`;
- return the affected rows.

The RPC must be one transaction and reject duplicate `cycle_id + logged_at`
entries in the same payload. It must not write inventory.

- [ ] **Step 6: Implement the service and confirmation sheet**

The service maps selected entries to the RPC and returns saved log IDs. The
sheet keeps edits locally until confirmation. A failed save preserves all
selections/edits and displays one retry action.

- [ ] **Step 7: Integrate Dashboard and Home**

Replace duplicated period grouping with `groupRoutineIntakes`. Add one
“Alles eingenommen” action per non-empty group. Keep single-item confirmation
and skip/undo actions.

Update page-local `Cycle`, `DoseLog`, and `TodayIntake` types to nullable
`dose/unit` and include `stack_items.tracking_level`. Use
`formatTrackedQuantity` instead of rendering `null null`.

After a successful group confirmation:

- reload logs once;
- run existing vial stock debit only for quantified vial entries;
- expose optional injection-site links for confirmed injectable entries.

- [ ] **Step 8: Run focused tests**

Run:

```bash
npm test -- src/features/routines/intakeGroups.test.ts src/features/routines/services/intakeConfirmation.test.ts src/features/routines/components/RoutineConfirmationSheet.test.tsx src/pages/Dashboard.test.ts src/pages/Home.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase-my-stack-tracking-depth.sql src/features/routines src/pages/Dashboard.tsx src/pages/Dashboard.test.ts src/pages/Home.tsx src/pages/Home.test.ts
git commit -m "feat: confirm mixed daily routines together"
```

---

### Task 7: Complete quantity overrides and titration gates

**Files:**
- Create: `src/features/my-stack/lib/dosePlan.ts`
- Create: `src/features/my-stack/lib/dosePlan.test.ts`
- Modify: `src/features/my-stack/MyStackPage.tsx`
- Modify: `src/features/my-stack/MyStackPage.test.ts`
- Modify: `src/features/routines/components/RoutineConfirmationSheet.tsx`
- Modify: `src/features/routines/components/RoutineConfirmationSheet.test.tsx`
- Modify: `src/lib/doseAdjustmentBackfill.ts`
- Modify: `src/lib/doseAdjustmentBackfill.test.ts`

**Interfaces:**
- Produces:
  - `dosePlanCapabilities(level)`
  - `buildOneOffActualDose`
  - `buildPermanentScheduleChange`
  - `buildTitrationStep`
- Consumes: existing `schedule_history`, `dose_escalations`, and nullable effective dose.

- [ ] **Step 1: Write failing level and history tests**

```ts
it('offers all dose planning modes for with_amount and complete', () => {
  expect(dosePlanCapabilities('with_amount')).toEqual({
    oneOff: true,
    permanent: true,
    titration: true,
  })
  expect(dosePlanCapabilities('complete').titration).toBe(true)
  expect(dosePlanCapabilities('intake_only').titration).toBe(false)
})

it('changes only the selected confirmation for a one-off amount', () => {
  const result = buildOneOffActualDose(entry, { dose: 12.5, unit: 'mg' })
  expect(result.actualDose).toBe(12.5)
  expect(result.cycleUpdate).toBeUndefined()
})
```

Extend backfill tests so a permanent change/titration updates open and skipped
quantified logs, skips taken logs, and skips unquantified logs.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/features/my-stack/lib/dosePlan.test.ts src/lib/doseAdjustmentBackfill.test.ts src/features/routines/components/RoutineConfirmationSheet.test.tsx src/features/my-stack/MyStackPage.test.ts
```

Expected: FAIL because the explicit capability module and override UI are absent.

- [ ] **Step 3: Implement dose-plan helpers**

`buildPermanentScheduleChange` must create a schedule segment effective on the
chosen date and preserve earlier segments. `buildTitrationStep` stores an
absolute target dose in the form, then converts it to the existing additive
`increase_amount` relative to `effectiveDose` immediately before that step.

Reject every dose-plan operation when the base dose is null or the tracking
level is `intake_only`.

- [ ] **Step 4: Add actual-quantity editing to confirmations**

For `with_amount` and `complete`, the sheet shows planned dose and an optional
actual-dose editor. The editor changes only the confirmation payload. For
`intake_only`, it renders neither input nor edit affordance.

- [ ] **Step 5: Gate and clarify the existing My Stack adjustment UI**

In `MyStackPage.tsx`:

- hide dose/titration actions for `intake_only`;
- show them for both `with_amount` and `complete`;
- label actions “Einmalige Abweichung”, “Neue Standarddosis ab …”, and
  “Titrationsschritt hinzufügen”;
- keep the existing history/backfill rule that confirmed logs never change;
- label future schedule output “Geplant”.

No medical recommendation text or suggested target dose is added.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/features/my-stack/lib/dosePlan.test.ts src/lib/doseAdjustmentBackfill.test.ts src/features/routines/components/RoutineConfirmationSheet.test.tsx src/features/my-stack/MyStackPage.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/my-stack/lib/dosePlan.ts src/features/my-stack/lib/dosePlan.test.ts src/features/my-stack/MyStackPage.tsx src/features/my-stack/MyStackPage.test.ts src/features/routines/components/RoutineConfirmationSheet.tsx src/features/routines/components/RoutineConfirmationSheet.test.tsx src/lib/doseAdjustmentBackfill.ts src/lib/doseAdjustmentBackfill.test.ts
git commit -m "feat: support dose changes and titration by level"
```

---

### Task 8: Centralize honest PK readiness and curve interruption

**Files:**
- Create: `src/features/my-stack/lib/pkReadiness.ts`
- Create: `src/features/my-stack/lib/pkReadiness.test.ts`
- Modify: `src/services/blutspiegelHistory.ts`
- Create: `src/services/blutspiegelHistory.interruption.test.ts`
- Modify: `src/services/liveBlutspiegelChart.ts`
- Modify: `src/pages/BlutspiegelSimulation.tsx`
- Modify: `src/components/BlutspiegelCarousel.tsx`
- Modify: `src/components/liveCycleChart/LiveCycleChartCanvas.tsx`
- Modify: `src/components/liveCycleChart/chartMath.ts`
- Modify: `src/components/liveCycleChart/chartMath.test.ts`
- Modify: `src/features/my-stack/components/TrackingLevelPicker.tsx`

**Interfaces:**
- Produces:
  - `PkReadiness = {status:'ready'} | {status:'missing'; missing: PkRequirement[]} | {status:'unsupported'; reason: string}`
  - `evaluatePkReadiness(input)`
  - `splitQuantifiedDoseHistory(logs)`
- Consumes: `tracking_level`, `pk_profile_id`, `pk_profile_method`, cycle method/dose/unit/time, catalog linkage.

- [ ] **Step 1: Write failing readiness tests**

```ts
it('requires complete tracking', () => {
  expect(evaluatePkReadiness({
    ...readyInput,
    trackingLevel: 'with_amount',
  })).toEqual({ status: 'missing', missing: ['complete_tracking'] })
})

it('reports unsupported when no profile exists', () => {
  expect(evaluatePkReadiness({
    ...readyInput,
    pkProfileId: null,
  })).toEqual({ status: 'unsupported', reason: 'no_profile' })
})

it('reports the exact missing route, dose, unit, and time', () => {
  expect(evaluatePkReadiness({
    ...readyInput,
    pkProfileMethod: null,
    dose: null,
    unit: null,
    scheduledAt: null,
  })).toEqual({
    status: 'missing',
    missing: ['method', 'dose', 'unit', 'time'],
  })
})
```

Use a conservative dose converter:

```ts
expect(toPkMilligrams(1, 'mg')).toBe(1)
expect(toPkMilligrams(1000, 'mcg')).toBe(1)
expect(toPkMilligrams(5000, 'IU')).toBeNull()
```

IU and other units remain unsupported until an explicit substance-specific
conversion exists.

- [ ] **Step 2: Write failing interruption tests**

```ts
it('cuts the quantified series at a taken log with unknown quantity', () => {
  const result = splitQuantifiedDoseHistory([
    log('2026-07-20', true, 5, 'mg'),
    log('2026-07-21', true, null, null),
    log('2026-07-22', true, 5, 'mg'),
  ])
  expect(result.events.map(event => event.timestamp)).toEqual(['2026-07-20'])
  expect(result.interruptedAt).toBe('2026-07-21')
})

it('does not interrupt for a skipped log', () => {
  const result = splitQuantifiedDoseHistory([
    log('2026-07-20', false, null, null),
    log('2026-07-21', true, 5, 'mg'),
  ])
  expect(result.interruptedAt).toBeNull()
})

it('splits actual and planned chart segments without bridging an interruption', () => {
  const segments = splitLiveCurveSegments(curvePoints)
  expect(segments.map(segment => segment.kind)).toEqual(['actual', 'planned'])
  expect(segments.every(segment => (
    segment.points.every(point => point.timestamp < interruptedAt)
  ))).toBe(true)
})
```

- [ ] **Step 3: Run focused tests and verify they fail**

Run:

```bash
npm test -- src/features/my-stack/lib/pkReadiness.test.ts src/services/blutspiegelHistory.interruption.test.ts
```

Expected: FAIL because readiness and interruption helpers are absent.

- [ ] **Step 4: Implement readiness**

`evaluatePkReadiness` applies rules in this order:

1. No linked profile → `unsupported:no_profile`.
2. Tracking level is not `complete` → missing `complete_tracking`.
3. Linked profile method missing or different from the active plan method →
   missing `method`.
4. Dose/unit/time missing → list each missing requirement.
5. Unit cannot be normalized by `toPkMilligrams` → `unsupported:unit_conversion`.
6. Otherwise → `ready`.

The catalog-linked profile is a suggestion only. The user confirms
`pk_profile_method`; no global medical route inference is added.

- [ ] **Step 5: Remove fallback dose estimation**

In `loadDoseHistory`, delete:

```ts
dose: log.dose != null ? Number(log.dose) : Number(cycleDose)
```

Use `splitQuantifiedDoseHistory` instead. Return `interruptedAt` alongside the
curve input. A taken null-dose log terminates the usable sequence. A skipped log
contributes no dose and does not interrupt.

- [ ] **Step 6: Integrate all PK surfaces**

- `BlutspiegelSimulation.tsx` shows ready/missing/unsupported panels from the
  central helper.
- Missing `complete_tracking` links to
  `/my-stack?edit=<stackItemId>&intent=pk`; My Stack opens the wizard with
  existing values and only missing complete/PK steps.
- `BlutspiegelCarousel.tsx` renders no curve for unsupported items and an
  explanatory incomplete card for missing items.
- `liveBlutspiegelChart.ts` receives only ready cycles.
- When `interruptedAt` is set, the curve stops at that timestamp and the UI
  displays “Simulation unterbrochen: Menge nicht getrackt”.
- `chartMath.ts` separates actual and planned segments and never joins points
  across `interruptedAt`.
- `LiveCycleChartCanvas.tsx` draws planned segments with the existing dashed
  canvas treatment while actual segments remain solid.
- Projected points after the latest actual quantified event carry
  `status: 'planned'`.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- src/features/my-stack/lib/pkReadiness.test.ts src/services/blutspiegelHistory.interruption.test.ts src/components/liveCycleChart/chartMath.test.ts src/lib/intakeSchedule.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/my-stack/lib/pkReadiness.ts src/features/my-stack/lib/pkReadiness.test.ts src/services/blutspiegelHistory.ts src/services/blutspiegelHistory.interruption.test.ts src/services/liveBlutspiegelChart.ts src/pages/BlutspiegelSimulation.tsx src/components/BlutspiegelCarousel.tsx src/components/liveCycleChart/LiveCycleChartCanvas.tsx src/components/liveCycleChart/chartMath.ts src/components/liveCycleChart/chartMath.test.ts src/features/my-stack/components/TrackingLevelPicker.tsx
git commit -m "feat: gate pk simulation on complete data"
```

---

### Task 9: Add opt-in generic package and inventory tracking

**Files:**
- Modify: `supabase-my-stack-tracking-depth.sql`
- Modify: `supabase-my-stack-tracking-depth-verify.sql`
- Create: `src/features/my-stack/lib/inventoryMath.ts`
- Create: `src/features/my-stack/lib/inventoryMath.test.ts`
- Create: `src/features/my-stack/services/stackInventory.ts`
- Create: `src/features/my-stack/services/stackInventory.test.ts`
- Create: `src/features/my-stack/components/ProductInventorySection.tsx`
- Create: `src/features/my-stack/components/ProductInventorySection.test.tsx`
- Modify: `src/features/my-stack/components/StackItemWizard.tsx`
- Modify: `src/features/my-stack/components/StackItemWizard.interaction.test.tsx`
- Modify: `src/features/my-stack/services/stackItems.ts`
- Modify: `src/pages/Dashboard.tsx`

**Interfaces:**
- Produces:
  - table `stack_item_inventory`
  - `inventoryDeltaForDose(input): number | null`
  - idempotent `apply_inventory_confirmation(dose_log_id)`
- Consumes: product strength/basis, confirmed dose log, existing vial stock adapter.

- [ ] **Step 1: Write failing inventory math tests**

```ts
it('converts an ingredient dose to product basis units', () => {
  expect(inventoryDeltaForDose({
    dose: 5000,
    doseUnit: 'IU',
    amountValue: 5000,
    amountUnit: 'IU',
    basisValue: 1,
    basisUnit: 'capsule',
  })).toBe(1)
})

it('uses direct countable dose units', () => {
  expect(inventoryDeltaForDose({
    dose: 0.5,
    doseUnit: 'tablet',
    amountValue: 20,
    amountUnit: 'mg',
    basisValue: 1,
    basisUnit: 'tablet',
  })).toBe(0.5)
})

it('returns null instead of guessing incompatible units', () => {
  expect(inventoryDeltaForDose({
    dose: 10,
    doseUnit: 'ml',
    amountValue: 5000,
    amountUnit: 'IU',
    basisValue: 1,
    basisUnit: 'capsule',
  })).toBeNull()
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -- src/features/my-stack/lib/inventoryMath.test.ts src/features/my-stack/services/stackInventory.test.ts
```

Expected: FAIL because generic inventory does not exist.

- [ ] **Step 3: Add the opt-in inventory table**

Add:

```sql
create table if not exists public.stack_item_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  stack_item_id uuid not null unique references public.stack_items(id) on delete cascade,
  enabled boolean not null default false,
  package_quantity numeric,
  package_unit text,
  remaining_quantity numeric,
  batch_number text,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    not enabled
    or (
      package_quantity > 0
      and nullif(btrim(package_unit), '') is not null
      and remaining_quantity >= 0
    )
  )
);
```

Enable RLS with owner-only select/insert/update/delete. Add
`apply_inventory_confirmation(p_dose_log_id uuid)`, which:

- returns unchanged when inventory is disabled;
- is idempotent per dose log using a unique inventory-movement row;
- debits only when `inventoryDeltaForDose`-equivalent SQL can determine a delta;
- raises a descriptive conversion error instead of guessing.

Keep existing vial stock fields and the peptide-specific adapter unchanged.

- [ ] **Step 4: Implement pure inventory conversion and service**

The pure helper supports:

- direct basis-unit quantities;
- ingredient-unit-to-basis conversion when units match exactly;
- mg↔mcg conversion;
- no IU↔mass conversion;
- no multi-ingredient guess when ingredients imply different basis quantities.

The service loads/saves the optional row and calls the idempotent confirmation
RPC after a dose log is committed.

- [ ] **Step 5: Add and connect the opt-in UI**

Create `ProductInventorySection` and mount it only for `complete`. It starts
collapsed. Inventory fields remain unmounted until `inventory.enabled` is
checked. Brand may be entered without enabling inventory; package quantity,
package unit, and remaining quantity may not. Add the enabled inventory summary
to the wizard review.

Persist inventory only for `complete` entries with the toggle enabled.
`Dashboard` and grouped confirmation call the inventory RPC after intake
confirmation. A stock failure:

- leaves the dose log confirmed;
- shows a retry action;
- cannot duplicate the dose log or debit twice.

For vial entries, continue using `computeNextVialStock`; do not run both generic
and vial debit paths.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/features/my-stack/lib/inventoryMath.test.ts src/features/my-stack/services/stackInventory.test.ts src/features/my-stack/components/ProductInventorySection.test.tsx src/features/my-stack/components/StackItemWizard.interaction.test.tsx src/pages/Dashboard.test.ts src/features/my-stack/lib/trackingDepthSchema.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase-my-stack-tracking-depth.sql supabase-my-stack-tracking-depth-verify.sql src/features/my-stack/lib/inventoryMath.ts src/features/my-stack/lib/inventoryMath.test.ts src/features/my-stack/services/stackInventory.ts src/features/my-stack/services/stackInventory.test.ts src/features/my-stack/components/ProductInventorySection.tsx src/features/my-stack/components/ProductInventorySection.test.tsx src/features/my-stack/components/StackItemWizard.tsx src/features/my-stack/components/StackItemWizard.interaction.test.tsx src/features/my-stack/services/stackItems.ts src/pages/Dashboard.tsx
git commit -m "feat: add optional generic stack inventory"
```

---

### Task 10: Finish copy, migrations, graph verification, and regression QA

**Files:**
- Modify: `scripts/my-stack-i18n-source.mjs`
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ar.json`
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
- Modify: `src/features/my-stack/lib/i18n.test.ts`
- Modify: `docs/superpowers/checklists/my-stack-backup-manifest.md`
- Modify generated Graphify artifacts under `graphify-out/`.

**Interfaces:**
- Consumes: all new UI keys and database migration.
- Produces: complete locale coverage, verified dependency graph, deployment checklist.

- [ ] **Step 1: Extend the failing i18n key contract**

Add keys for:

- all three tracking-level titles, explanations, examples, and next-step copy;
- “change later” copy;
- routine group and “Alles eingenommen” flow;
- actual amount override;
- permanent dose change and titration;
- PK ready/missing/unsupported/interrupted/planned states;
- product/inventory opt-in and retry;
- “Menge nicht getrackt”.

Update the i18n test to require every key in all locale files.

- [ ] **Step 2: Run the i18n test and verify it fails**

Run:

```bash
npm test -- src/features/my-stack/lib/i18n.test.ts
```

Expected: FAIL listing the missing keys.

- [ ] **Step 3: Author German and English source copy**

Add exact German and English strings to `MY_STACK_DE` and `MY_STACK_EN`.
Descriptions must explain:

- what each level records;
- what it does not require;
- that the choice can be changed later;
- that PK depends on profile and complete data;
- that the app documents but does not recommend titration.

Run the existing locale update path. Use
`@vitalets/google-translate-api` only for the remaining locale files, preserving
interpolation tokens and manually checking German/English.

- [ ] **Step 4: Verify all focused and full tests**

Run:

```bash
npm test -- src/features/my-stack src/features/routines src/lib/intakeSchedule.test.ts src/lib/doseAdjustmentBackfill.test.ts src/services/blutspiegelHistory.interruption.test.ts src/pages/Dashboard.test.ts src/pages/Home.test.ts
npm test
```

Expected: all focused tests pass, then the complete suite passes.

- [ ] **Step 5: Run type/build and lint-regression checks**

Run:

```bash
npm run build
npx eslint src/features/my-stack src/features/routines src/lib/intakeSchedule.ts src/lib/doseAdjustmentBackfill.ts src/services/blutspiegelHistory.ts src/services/liveBlutspiegelChart.ts src/pages/Dashboard.tsx src/pages/Home.tsx src/pages/BlutspiegelSimulation.tsx src/components/BlutspiegelCarousel.tsx
```

Expected: production build passes. New/modified files introduce no lint
regression relative to the branch baseline.

- [ ] **Step 6: Pass the database deployment checkpoint**

The repository currently has no local Supabase `config.toml` or migrations
folder, so do not claim that `supabase db reset` validates these root SQL files.
The SQL contract tests from Tasks 1, 5, 6, and 9 are the pre-deployment gate.

After the user explicitly approves the linked-database change, apply and verify:

```bash
supabase db query --linked --file supabase-my-stack-tracking-depth.sql
supabase db query --linked --file supabase-my-stack-tracking-depth-verify.sql --output json
```

Expected: every boolean in `tracking_depth_contract` is `true`; test users can
save one item per tracking level; an intake-only confirmation contains null
dose/unit; existing peptide rows remain `complete`.

The migration is backward compatible for the old main app: it adds columns,
loosens dose nullability, and adds new tables/RPCs without removing the legacy
fields or RPC names used by main. Stop and use the conservative rollback only
if verification fails.

- [ ] **Step 7: Refresh and inspect the dependency graph**

Run:

```bash
graphify update . --force
graphify explain "StackItemWizard.tsx"
graphify affected "stack_items" --depth 3
```

Verify:

- Wizard → tracking level → plan validation → atomic save;
- routines → nullable schedule → group RPC;
- titration → central effective dose;
- PK surfaces → central readiness and interruption;
- inventory → opt-in service and exactly one debit adapter.

Review the generated diff for unrelated paths, then keep the refreshed
`graphify-out/` artifacts because this repository versions them.

- [ ] **Step 8: Perform authenticated browser smoke tests**

Using the local feature worktree:

1. Add Vitamin D3 as `intake_only`; confirm a morning group and verify no amount
   appears.
2. Add Zink as `with_amount`; add a two-step titration and override one actual
   dose.
3. Add a supported peptide/hormone as `complete`; verify PK readiness and the
   optional inventory section.
4. Confirm a mixed morning group in one action.
5. Add an injection site afterward and verify confirmation was not blocked.
6. Downgrade and upgrade an item; verify historic detail remains.
7. Create an unknown-quantity taken log and verify the PK curve stops with the
   explanatory state.

- [ ] **Step 9: Update the backup/cutover checklist**

Record:

- pre/post row counts for `stack_items`, `cycles`, `dose_logs`,
  `stack_item_inventory`, and inventory movements;
- zero orphaned foreign keys;
- existing peptide/Vial rendering unchanged;
- nullable quantity semantics verified;
- rollback guard tested;
- linked-production migration still pending explicit approval.

- [ ] **Step 10: Commit**

```bash
git add scripts/my-stack-i18n-source.mjs src/i18n/locales src/features/my-stack/lib/i18n.test.ts docs/superpowers/checklists/my-stack-backup-manifest.md graphify-out
git commit -m "test: verify my stack tracking depth"
```

---

## Final Acceptance Criteria

- A new user can add a substance in any of the three explained tracking levels
  and create its routine in the same flow.
- Intake-only logs contain no artificial quantity and render as
  “Menge nicht getrackt”.
- `with_amount` and `complete` both support one-off amounts, permanent changes,
  and multi-step titration.
- A mixed routine group can be confirmed once while storing each item at its
  own detail level.
- Injection-site tracking remains optional.
- PK is visible only for `complete` plus ready data; missing and unsupported
  states are explicit.
- A taken intake with unknown quantity interrupts, rather than fabricates, the
  PK curve.
- Product/package/inventory fields remain opt-in; stock writes are idempotent.
- Existing peptide rows, Vial visuals, confirmed logs, and historical plan
  segments remain intact.
- Full test suite and production build pass with no new lint regression.
