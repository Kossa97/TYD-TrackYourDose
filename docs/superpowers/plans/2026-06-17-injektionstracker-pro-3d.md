# Injektionstracker Pro 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first 3D Injektionskarte that supports free torso navigation, long-press pinning, precise persisted injection locations, history reference pins, and optional linkage to existing dose confirmations.

**Architecture:** Start with a self-contained 3D spike using a procedural torso/hit mesh, then connect it to Supabase and the existing `dose_logs` flow. Keep 3D scene, domain geometry, persistence, and UI sheets in separate focused modules so the later `.glb` model can replace the placeholder without rewriting app state.

**Tech Stack:** React 19, TypeScript, Vite, Three.js, `@react-three/fiber`, `@react-three/drei`, Supabase, Vitest, date-fns, lucide-react.

## Global Constraints

- Mobile-first; tablet and desktop must remain fully responsive.
- v1 uses only the `hybrid` visual mode; prepare types for future `clean` and `anatomy` modes.
- Do not make 3D tracking mandatory for normal intake confirmation.
- Do not add medical injection technique guidance.
- Use soft warnings only; never block saving by body area.
- Persist model-relative coordinates, not screen coordinates.
- Keep existing `dose_logs` behavior intact and avoid double logs.
- Start with a procedural placeholder torso/hit mesh before integrating a final `.glb`.
- Leave unrelated files and formatting untouched.

---

## File Structure

Create:

- `src/lib/injectionGeometry.ts`  
  Pure domain helpers for body-region inference, vector serialization, proximity warnings, and reference-pin filtering.

- `src/lib/injectionGeometry.test.ts`  
  Unit tests for region inference, proximity states, and last-7-days filtering.

- `src/lib/injectionLogTypes.ts`  
  Shared TypeScript interfaces for 3D injection logs, pin positions, selectable cycles, and user preferences.

- `src/lib/injectionPersistence.ts`  
  Supabase read/write helpers for enriched `injection_logs`, linked `dose_logs`, and preference storage.

- `src/lib/injectionPersistence.test.ts`  
  Mocked Supabase tests for payload construction and duplicate-safe dose linkage.

- `src/components/injection3d/InjectionMapCanvas.tsx`  
  React Three Fiber canvas, placeholder hybrid torso, hit mesh, camera controls, long-press detection, and pin rendering.

- `src/components/injection3d/InjectionPin.tsx`  
  3D pin marker, old-reference-pin marker, and active pin visuals.

- `src/components/injection3d/InjectionHistorySheet.tsx`  
  Mobile-first bottom sheet with chronological history, `Letzte 7 Tage` toggle, and per-log reference checkmarks.

- `src/components/injection3d/InjectionLogSheet.tsx`  
  Save sheet for active cycle/substance, dose, date/time, notes, and soft warning text.

- `src/components/injection3d/InjectionIntroSheet.tsx`  
  Versioned intro for long-press instructions.

- `src/components/injection3d/InjectionTrackerHero.tsx`  
  Home hero card for **Injektionstracker Pro**.

- `supabase-injection-pro.sql`  
  Migration for enriched `injection_logs` columns and indexes.

Modify:

- `src/pages/InjektionsTracker.tsx`  
  Replace the current 2D body map implementation with the new 3D map page while preserving route `/injektionen`.

- `src/pages/Home.tsx`  
  Add the high-priority hero card and load summary data for recent injection logs.

- `src/pages/Dashboard.tsx`  
  Add the optional post-confirm prompt for injizierbare active cycles, using a global preference.

- `src/i18n/locales/de.json` and `src/i18n/locales/en.json`  
  Add copy for the new page, hero, intro, history sheet, and prompt.

- `src/App.tsx`  
  Keep route unchanged; no route rename needed unless lazy export name changes.

---

## Task 1: Domain Types and Geometry Helpers

**Files:**
- Create: `src/lib/injectionLogTypes.ts`
- Create: `src/lib/injectionGeometry.ts`
- Create: `src/lib/injectionGeometry.test.ts`

**Interfaces:**
- Produces:
  - `Vector3Json`
  - `BodyRegion`
  - `BodySide`
  - `InjectionPinDraft`
  - `InjectionLog3D`
  - `InjectionProximityWarning`
  - `inferBodyRegion(point: Vector3Json): { body_region: BodyRegion; body_side: BodySide }`
  - `proximityWarning(draft: InjectionPinDraft, logs: InjectionLog3D[], now: Date): InjectionProximityWarning`
  - `filterRecentInjectionLogs(logs: InjectionLog3D[], now: Date, days: number): InjectionLog3D[]`
- Consumes: no app state or Supabase.

- [ ] **Step 1: Write the failing geometry tests**

Add this file:

```ts
// src/lib/injectionGeometry.test.ts
import { describe, expect, it } from 'vitest'
import {
  filterRecentInjectionLogs,
  inferBodyRegion,
  proximityWarning,
} from './injectionGeometry'
import type { InjectionLog3D, InjectionPinDraft } from './injectionLogTypes'

const baseLog = (overrides: Partial<InjectionLog3D>): InjectionLog3D => ({
  id: overrides.id ?? 'log-1',
  user_id: 'user-1',
  dose_log_id: null,
  peptide_id: null,
  cycle_id: null,
  peptide_name: overrides.peptide_name ?? null,
  cycle_name: overrides.cycle_name ?? null,
  dose: overrides.dose ?? 250,
  unit: overrides.unit ?? 'mcg',
  method: overrides.method ?? 'Subkutan',
  notes: overrides.notes ?? null,
  logged_at: overrides.logged_at ?? '2026-06-17T08:00:00.000Z',
  created_at: overrides.created_at ?? '2026-06-17T08:00:00.000Z',
  model_version: 'placeholder-v1',
  body_region: overrides.body_region ?? 'abdomen',
  body_side: overrides.body_side ?? 'right',
  position: overrides.position ?? { x: 0.22, y: 0.4, z: 0.42 },
  normal: overrides.normal ?? { x: 0, y: 0, z: 1 },
  uv: null,
  camera_state: null,
  warning_state: overrides.warning_state ?? null,
})

const draft = (position: InjectionPinDraft['position']): InjectionPinDraft => ({
  model_version: 'placeholder-v1',
  position,
  normal: { x: 0, y: 0, z: 1 },
  body_region: 'abdomen',
  body_side: 'right',
})

describe('inferBodyRegion', () => {
  it('infers right abdomen from positive x and mid torso y', () => {
    expect(inferBodyRegion({ x: 0.28, y: 0.35, z: 0.4 })).toEqual({
      body_region: 'abdomen',
      body_side: 'right',
    })
  })

  it('infers left thigh from negative x and low y', () => {
    expect(inferBodyRegion({ x: -0.22, y: -0.62, z: 0.25 })).toEqual({
      body_region: 'thigh',
      body_side: 'left',
    })
  })
})

describe('filterRecentInjectionLogs', () => {
  it('keeps logs inside the requested day window', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [
      baseLog({ id: 'recent', logged_at: '2026-06-15T12:00:00.000Z' }),
      baseLog({ id: 'old', logged_at: '2026-06-01T12:00:00.000Z' }),
    ]
    expect(filterRecentInjectionLogs(logs, now, 7).map(log => log.id)).toEqual(['recent'])
  })
})

describe('proximityWarning', () => {
  it('returns none when no recent pin is nearby', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [baseLog({ position: { x: 0.8, y: 0.8, z: 0.8 } })]
    expect(proximityWarning(draft({ x: 0.1, y: 0.1, z: 0.1 }), logs, now).level).toBe('none')
  })

  it('returns caution for a nearby pin from the last seven days', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [baseLog({ logged_at: '2026-06-15T12:00:00.000Z', position: { x: 0.11, y: 0.1, z: 0.1 } })]
    const result = proximityWarning(draft({ x: 0.1, y: 0.1, z: 0.1 }), logs, now)
    expect(result.level).toBe('caution')
    expect(result.nearestLogId).toBe('log-1')
  })

  it('returns strong for a very nearby pin from the last three days', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [baseLog({ logged_at: '2026-06-16T12:00:00.000Z', position: { x: 0.105, y: 0.1, z: 0.1 } })]
    expect(proximityWarning(draft({ x: 0.1, y: 0.1, z: 0.1 }), logs, now).level).toBe('strong')
  })
})
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```powershell
npm test -- src/lib/injectionGeometry.test.ts
```

Expected: FAIL because `src/lib/injectionGeometry.ts` does not exist.

- [ ] **Step 3: Add shared types**

Create:

```ts
// src/lib/injectionLogTypes.ts
export type BodyRegion = 'abdomen' | 'thigh' | 'deltoid' | 'glute' | 'torso' | 'outside_typical'
export type BodySide = 'left' | 'right' | 'center'
export type InjectionVisualMode = 'clean' | 'hybrid' | 'anatomy'

export interface Vector3Json {
  x: number
  y: number
  z: number
}

export interface Vector2Json {
  x: number
  y: number
}

export interface InjectionCameraState {
  target: Vector3Json
  position: Vector3Json
  zoom?: number
}

export interface InjectionPinDraft {
  model_version: string
  position: Vector3Json
  normal: Vector3Json
  body_region: BodyRegion
  body_side: BodySide
  uv?: Vector2Json | null
  camera_state?: InjectionCameraState | null
}

export interface InjectionLog3D extends InjectionPinDraft {
  id: string
  user_id: string
  dose_log_id: string | null
  peptide_id: string | null
  cycle_id: string | null
  peptide_name: string | null
  cycle_name: string | null
  dose: number | null
  unit: string | null
  method: string | null
  notes: string | null
  logged_at: string
  created_at: string | null
  warning_state: string | null
}

export interface SelectableInjectionCycle {
  id: string
  peptide_id: string
  peptide_name: string
  cycle_name: string
  dose: number
  unit: string
  method: string
}

export interface InjectionProximityWarning {
  level: 'none' | 'caution' | 'strong'
  nearestLogId: string | null
  distance: number | null
}
```

- [ ] **Step 4: Add geometry helpers**

Create:

```ts
// src/lib/injectionGeometry.ts
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type {
  BodyRegion,
  BodySide,
  InjectionLog3D,
  InjectionPinDraft,
  InjectionProximityWarning,
  Vector3Json,
} from './injectionLogTypes'

const CAUTION_DISTANCE = 0.09
const STRONG_DISTANCE = 0.04

function distance(a: Vector3Json, b: Vector3Json): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function sideFromX(x: number): BodySide {
  if (x > 0.06) return 'right'
  if (x < -0.06) return 'left'
  return 'center'
}

function regionFromY(y: number): BodyRegion {
  if (y > 0.58) return 'deltoid'
  if (y > -0.2) return 'abdomen'
  if (y > -0.78) return 'thigh'
  return 'outside_typical'
}

export function inferBodyRegion(point: Vector3Json): { body_region: BodyRegion; body_side: BodySide } {
  return {
    body_region: regionFromY(point.y),
    body_side: sideFromX(point.x),
  }
}

export function filterRecentInjectionLogs(
  logs: InjectionLog3D[],
  now: Date,
  days: number,
): InjectionLog3D[] {
  return logs.filter(log => {
    const age = differenceInCalendarDays(now, parseISO(log.logged_at))
    return age >= 0 && age <= days
  })
}

export function proximityWarning(
  draft: InjectionPinDraft,
  logs: InjectionLog3D[],
  now: Date,
): InjectionProximityWarning {
  const recent = filterRecentInjectionLogs(logs, now, 7)
  let nearest: { log: InjectionLog3D; distance: number } | null = null

  for (const log of recent) {
    if (log.model_version !== draft.model_version) continue
    const d = distance(draft.position, log.position)
    if (!nearest || d < nearest.distance) nearest = { log, distance: d }
  }

  if (!nearest || nearest.distance > CAUTION_DISTANCE) {
    return { level: 'none', nearestLogId: null, distance: null }
  }

  const age = differenceInCalendarDays(now, parseISO(nearest.log.logged_at))
  return {
    level: nearest.distance <= STRONG_DISTANCE && age <= 3 ? 'strong' : 'caution',
    nearestLogId: nearest.log.id,
    distance: nearest.distance,
  }
}
```

- [ ] **Step 5: Run tests and verify they pass**

Run:

```powershell
npm test -- src/lib/injectionGeometry.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- src/lib/injectionLogTypes.ts src/lib/injectionGeometry.ts src/lib/injectionGeometry.test.ts
git commit -m "Add injection geometry helpers"
```

---

## Task 2: Supabase Migration and Persistence Helpers

**Files:**
- Create: `supabase-injection-pro.sql`
- Create: `src/lib/injectionPersistence.ts`
- Create: `src/lib/injectionPersistence.test.ts`

**Interfaces:**
- Consumes:
  - `InjectionPinDraft`
  - `InjectionLog3D`
  - `SelectableInjectionCycle`
- Produces:
  - `buildInjectionInsertPayload(input)`
  - `loadInjectionLogs(supabase, userId)`
  - `saveInjectionLog(supabase, input)`
  - `loadSelectableInjectionCycles(supabase, userId)`

- [ ] **Step 1: Add migration**

Create:

```sql
-- Injektionstracker Pro: enriched 3D injection logs

alter table injection_logs
  add column if not exists peptide_id uuid references peptides on delete set null,
  add column if not exists cycle_id uuid references cycles on delete set null,
  add column if not exists dose numeric(10,3),
  add column if not exists unit text,
  add column if not exists method text,
  add column if not exists body_region text,
  add column if not exists body_side text,
  add column if not exists model_version text,
  add column if not exists position jsonb,
  add column if not exists normal jsonb,
  add column if not exists uv jsonb,
  add column if not exists camera_state jsonb,
  add column if not exists warning_state text;

create index if not exists injection_logs_user_logged_at_idx
  on injection_logs (user_id, logged_at desc);

create index if not exists injection_logs_user_cycle_idx
  on injection_logs (user_id, cycle_id, logged_at desc);

create index if not exists injection_logs_user_region_idx
  on injection_logs (user_id, body_region, body_side, logged_at desc);
```

- [ ] **Step 2: Write payload tests**

Add:

```ts
// src/lib/injectionPersistence.test.ts
import { describe, expect, it } from 'vitest'
import { buildInjectionInsertPayload } from './injectionPersistence'

describe('buildInjectionInsertPayload', () => {
  it('keeps dose_log_id when linking to an existing confirmation', () => {
    const payload = buildInjectionInsertPayload({
      userId: 'user-1',
      doseLogId: 'dose-1',
      peptideId: 'pep-1',
      cycleId: 'cycle-1',
      dose: 250,
      unit: 'mcg',
      method: 'Subkutan',
      notes: 'ok',
      loggedAt: '2026-06-17T08:00:00.000Z',
      warningState: 'caution',
      pin: {
        model_version: 'placeholder-v1',
        body_region: 'abdomen',
        body_side: 'right',
        position: { x: 0.1, y: 0.2, z: 0.3 },
        normal: { x: 0, y: 0, z: 1 },
        uv: null,
        camera_state: null,
      },
    })

    expect(payload).toMatchObject({
      user_id: 'user-1',
      dose_log_id: 'dose-1',
      peptide_id: 'pep-1',
      cycle_id: 'cycle-1',
      dose: 250,
      unit: 'mcg',
      method: 'Subkutan',
      body_region: 'abdomen',
      body_side: 'right',
      model_version: 'placeholder-v1',
      warning_state: 'caution',
    })
    expect(payload.position).toEqual({ x: 0.1, y: 0.2, z: 0.3 })
  })
})
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```powershell
npm test -- src/lib/injectionPersistence.test.ts
```

Expected: FAIL because `injectionPersistence.ts` does not exist.

- [ ] **Step 4: Add persistence helpers**

Create:

```ts
// src/lib/injectionPersistence.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InjectionLog3D, InjectionPinDraft, SelectableInjectionCycle } from './injectionLogTypes'

interface SaveInjectionInput {
  userId: string
  doseLogId: string | null
  peptideId: string | null
  cycleId: string | null
  dose: number | null
  unit: string | null
  method: string | null
  notes: string | null
  loggedAt: string
  warningState: string | null
  pin: InjectionPinDraft
}

export function buildInjectionInsertPayload(input: SaveInjectionInput) {
  return {
    user_id: input.userId,
    dose_log_id: input.doseLogId,
    peptide_id: input.peptideId,
    cycle_id: input.cycleId,
    dose: input.dose,
    unit: input.unit,
    method: input.method,
    notes: input.notes?.trim() || null,
    logged_at: input.loggedAt,
    site: `${input.pin.body_region}_${input.pin.body_side}`,
    body_region: input.pin.body_region,
    body_side: input.pin.body_side,
    model_version: input.pin.model_version,
    position: input.pin.position,
    normal: input.pin.normal,
    uv: input.pin.uv ?? null,
    camera_state: input.pin.camera_state ?? null,
    warning_state: input.warningState,
  }
}

export async function loadInjectionLogs(
  supabase: SupabaseClient,
  userId: string,
): Promise<InjectionLog3D[]> {
  const { data, error } = await supabase
    .from('injection_logs')
    .select('*, peptides(name), cycles(name)')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(300)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    dose_log_id: row.dose_log_id ?? null,
    peptide_id: row.peptide_id ?? null,
    cycle_id: row.cycle_id ?? null,
    peptide_name: Array.isArray(row.peptides) ? row.peptides[0]?.name ?? null : row.peptides?.name ?? null,
    cycle_name: Array.isArray(row.cycles) ? row.cycles[0]?.name ?? null : row.cycles?.name ?? null,
    dose: row.dose == null ? null : Number(row.dose),
    unit: row.unit ?? null,
    method: row.method ?? null,
    notes: row.notes ?? null,
    logged_at: row.logged_at,
    created_at: row.created_at ?? null,
    model_version: row.model_version ?? 'legacy-2d',
    body_region: row.body_region ?? 'outside_typical',
    body_side: row.body_side ?? 'center',
    position: row.position ?? { x: 0, y: 0, z: 0 },
    normal: row.normal ?? { x: 0, y: 0, z: 1 },
    uv: row.uv ?? null,
    camera_state: row.camera_state ?? null,
    warning_state: row.warning_state ?? null,
  })) as InjectionLog3D[]
}

export async function saveInjectionLog(
  supabase: SupabaseClient,
  input: SaveInjectionInput,
): Promise<string> {
  const { data, error } = await supabase
    .from('injection_logs')
    .insert(buildInjectionInsertPayload(input))
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function loadSelectableInjectionCycles(
  supabase: SupabaseClient,
  userId: string,
): Promise<SelectableInjectionCycle[]> {
  const { data, error } = await supabase
    .from('cycles')
    .select('id, peptide_id, name, dose, unit, method, active, peptides(name)')
    .eq('user_id', userId)
    .eq('active', true)
    .in('method', ['Subkutan', 'Intramuskulär', 'Intramuskulaer'])
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    peptide_id: row.peptide_id,
    peptide_name: Array.isArray(row.peptides) ? row.peptides[0]?.name ?? row.name : row.peptides?.name ?? row.name,
    cycle_name: row.name,
    dose: Number(row.dose),
    unit: row.unit,
    method: row.method,
  }))
}
```

- [ ] **Step 5: Run tests**

Run:

```powershell
npm test -- src/lib/injectionPersistence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- supabase-injection-pro.sql src/lib/injectionPersistence.ts src/lib/injectionPersistence.test.ts
git commit -m "Add injection persistence helpers"
```

---

## Task 3: 3D Canvas Spike With Long-Press Pinning

**Files:**
- Create: `src/components/injection3d/InjectionPin.tsx`
- Create: `src/components/injection3d/InjectionMapCanvas.tsx`
- Modify: `src/pages/InjektionsTracker.tsx`

**Interfaces:**
- Consumes:
  - `InjectionPinDraft`
  - `InjectionLog3D`
  - `inferBodyRegion`
  - `proximityWarning`
- Produces:
  - `InjectionMapCanvas` component with `draftPin`, `logs`, `visibleLogIds`, `onDraftPinChange`, `onLogFocus`.

- [ ] **Step 1: Add the pin marker**

Create:

```tsx
// src/components/injection3d/InjectionPin.tsx
import type { ThreeEvent } from '@react-three/fiber'
import type { Vector3Json } from '../../lib/injectionLogTypes'

function vectorArray(v: Vector3Json): [number, number, number] {
  return [v.x, v.y, v.z]
}

export function InjectionPin({
  position,
  active = false,
  reference = false,
  onClick,
}: {
  position: Vector3Json
  active?: boolean
  reference?: boolean
  onClick?: () => void
}) {
  const color = active ? '#38bdf8' : reference ? '#94a3b8' : '#22d3ee'
  const scale = active ? 1.2 : reference ? 0.72 : 1

  return (
    <group
      position={vectorArray(position)}
      scale={scale}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onClick?.()
      }}
    >
      <mesh>
        <sphereGeometry args={[0.025, 24, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 1.2 : 0.45} />
      </mesh>
      <mesh position={[0, -0.055, 0]}>
        <coneGeometry args={[0.012, 0.08, 18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
      </mesh>
    </group>
  )
}
```

- [ ] **Step 2: Add the procedural placeholder 3D map**

Create:

```tsx
// src/components/injection3d/InjectionMapCanvas.tsx
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { inferBodyRegion } from '../../lib/injectionGeometry'
import type { InjectionLog3D, InjectionPinDraft } from '../../lib/injectionLogTypes'
import { InjectionPin } from './InjectionPin'

const MODEL_VERSION = 'placeholder-v1'
const LONG_PRESS_MS = 420

function toJson(v: THREE.Vector3) {
  return { x: Number(v.x.toFixed(5)), y: Number(v.y.toFixed(5)), z: Number(v.z.toFixed(5)) }
}

function PlaceholderTorso({
  onLongPress,
}: {
  onLongPress: (event: ThreeEvent<PointerEvent>) => void
}) {
  const timer = useRef<number | null>(null)

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c9a58f',
    roughness: 0.58,
    metalness: 0.04,
  }), [])

  const armMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#b8927d',
    roughness: 0.62,
    metalness: 0.03,
  }), [])

  const startPress = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onLongPress(event), LONG_PRESS_MS)
  }

  const cancelPress = () => {
    if (timer.current != null) window.clearTimeout(timer.current)
    timer.current = null
  }

  const handlers = {
    onPointerDown: startPress,
    onPointerUp: cancelPress,
    onPointerLeave: cancelPress,
    onPointerMove: cancelPress,
  }

  return (
    <group>
      <mesh {...handlers} material={material} scale={[0.72, 1.05, 0.34]} position={[0, 0.18, 0]}>
        <capsuleGeometry args={[0.52, 1.05, 18, 36]} />
      </mesh>
      <mesh {...handlers} material={armMaterial} scale={[0.22, 0.75, 0.22]} rotation={[0, 0, 0.22]} position={[-0.74, 0.08, 0]}>
        <capsuleGeometry args={[0.23, 0.9, 12, 24]} />
      </mesh>
      <mesh {...handlers} material={armMaterial} scale={[0.22, 0.75, 0.22]} rotation={[0, 0, -0.22]} position={[0.74, 0.08, 0]}>
        <capsuleGeometry args={[0.23, 0.9, 12, 24]} />
      </mesh>
      <mesh {...handlers} material={material} scale={[0.28, 0.85, 0.26]} position={[-0.28, -0.92, 0]}>
        <capsuleGeometry args={[0.22, 0.85, 12, 24]} />
      </mesh>
      <mesh {...handlers} material={material} scale={[0.28, 0.85, 0.26]} position={[0.28, -0.92, 0]}>
        <capsuleGeometry args={[0.22, 0.85, 12, 24]} />
      </mesh>
    </group>
  )
}

function Scene({
  draftPin,
  logs,
  visibleLogIds,
  onDraftPinChange,
  onLogFocus,
}: {
  draftPin: InjectionPinDraft | null
  logs: InjectionLog3D[]
  visibleLogIds: Set<string>
  onDraftPinChange: (pin: InjectionPinDraft) => void
  onLogFocus: (log: InjectionLog3D) => void
}) {
  const handleLongPress = (event: ThreeEvent<PointerEvent>) => {
    const point = event.point
    const normal = event.face?.normal.clone() ?? new THREE.Vector3(0, 0, 1)
    normal.transformDirection(event.object.matrixWorld)
    const inferred = inferBodyRegion(toJson(point))
    onDraftPinChange({
      model_version: MODEL_VERSION,
      position: toJson(point),
      normal: toJson(normal.normalize()),
      body_region: inferred.body_region,
      body_side: inferred.body_side,
      uv: event.uv ? { x: Number(event.uv.x.toFixed(5)), y: Number(event.uv.y.toFixed(5)) } : null,
      camera_state: null,
    })
  }

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[2.5, 3, 3]} intensity={2.2} />
      <PlaceholderTorso onLongPress={handleLongPress} />
      {logs.filter(log => visibleLogIds.has(log.id)).map(log => (
        <InjectionPin key={log.id} position={log.position} reference onClick={() => onLogFocus(log)} />
      ))}
      {draftPin && <InjectionPin position={draftPin.position} active />}
      <ContactShadows opacity={0.22} scale={4} blur={2.5} far={3} position={[0, -1.55, 0]} />
      <OrbitControls enablePan enableZoom enableRotate minDistance={1.4} maxDistance={4.5} target={[0, -0.05, 0]} />
      <Environment preset="city" />
    </>
  )
}

export function InjectionMapCanvas(props: {
  draftPin: InjectionPinDraft | null
  logs: InjectionLog3D[]
  visibleLogIds: Set<string>
  onDraftPinChange: (pin: InjectionPinDraft) => void
  onLogFocus: (log: InjectionLog3D) => void
}) {
  return (
    <div style={{ position: 'relative', minHeight: 'min(76vh, 760px)', borderRadius: 24, overflow: 'hidden', background: 'radial-gradient(circle at 50% 20%, rgba(0,204,245,0.16), transparent 42%), #07111d' }}>
      <Canvas camera={{ position: [0, 0.35, 2.55], fov: 42 }} dpr={[1, 1.7]}>
        <Scene {...props} />
      </Canvas>
    </div>
  )
}
```

- [ ] **Step 3: Wire the canvas into the page behind a local draft state**

Modify `src/pages/InjektionsTracker.tsx` by replacing the old 2D `BodyMap` section only after the new imports are added. Keep existing log loading in place for this task. Use this minimal state near the existing state declarations:

```tsx
const [draftPin, setDraftPin] = useState<InjectionPinDraft | null>(null)
const [visibleLogIds, setVisibleLogIds] = useState<Set<string>>(() => new Set())
```

Add imports:

```tsx
import { InjectionMapCanvas } from '../components/injection3d/InjectionMapCanvas'
import type { InjectionLog3D, InjectionPinDraft } from '../lib/injectionLogTypes'
```

Add a temporary mapper near computed values:

```tsx
const mapped3dLogs: InjectionLog3D[] = logs
  .filter(log => (log as any).position)
  .map(log => ({
    ...(log as any),
    peptide_name: null,
    cycle_name: null,
    model_version: (log as any).model_version ?? 'placeholder-v1',
    body_region: (log as any).body_region ?? 'outside_typical',
    body_side: (log as any).body_side ?? 'center',
    position: (log as any).position,
    normal: (log as any).normal ?? { x: 0, y: 0, z: 1 },
    uv: (log as any).uv ?? null,
    camera_state: (log as any).camera_state ?? null,
    warning_state: (log as any).warning_state ?? null,
  }))
```

Replace the old body-map section with:

```tsx
<section style={{ ...panelStyle, padding: 0 }}>
  <InjectionMapCanvas
    draftPin={draftPin}
    logs={mapped3dLogs}
    visibleLogIds={visibleLogIds}
    onDraftPinChange={setDraftPin}
    onLogFocus={(log) => setVisibleLogIds(prev => new Set(prev).add(log.id))}
  />
</section>
```

- [ ] **Step 4: Run typecheck/build**

Run:

```powershell
npm run build
```

Expected: PASS. If TypeScript reports unused old body-map helpers in `InjektionsTracker.tsx`, remove only helpers made unused by this replacement.

- [ ] **Step 5: Manual verify**

Run:

```powershell
npm run dev
```

Open `/injektionen`. Verify:

- 3D scene renders.
- Drag rotates.
- Pinch/wheel zooms.
- Long-press on torso places a blue pin.
- Existing 2D tracker sections not yet migrated may still appear below; this task only proves the 3D interaction.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- src/components/injection3d/InjectionPin.tsx src/components/injection3d/InjectionMapCanvas.tsx src/pages/InjektionsTracker.tsx
git commit -m "Add 3D injection map spike"
```

---

## Task 4: 3D Tracker Page State, Intro, Log Sheet, and History Sheet

**Files:**
- Create: `src/components/injection3d/InjectionIntroSheet.tsx`
- Create: `src/components/injection3d/InjectionLogSheet.tsx`
- Create: `src/components/injection3d/InjectionHistorySheet.tsx`
- Modify: `src/pages/InjektionsTracker.tsx`

**Interfaces:**
- Consumes:
  - `InjectionMapCanvas`
  - `loadInjectionLogs`
  - `loadSelectableInjectionCycles`
  - `saveInjectionLog`
  - `proximityWarning`
- Produces:
  - Full v1 tracker UI with intro, draft confirm step, log sheet, history, `Letzte 7 Tage`, and per-log visible checkmarks.

- [ ] **Step 1: Add intro sheet**

Create:

```tsx
// src/components/injection3d/InjectionIntroSheet.tsx
import { Hand, X } from 'lucide-react'

export const INJECTION_INTRO_VERSION = 1

export function InjectionIntroSheet({
  onClose,
  onDontShowAgain,
}: {
  onClose: () => void
  onDontShowAgain: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border border-white/10 p-5 pb-8" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hand size={17} color="var(--accent)" />
            <h2 className="text-base font-black text-white">Markierung setzen</h2>
          </div>
          <button type="button" aria-label="Hinweis schließen" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-400">
            <X size={16} />
          </button>
        </div>
        <p className="mb-5 text-sm leading-relaxed text-slate-400">
          Halte eine Stelle auf dem 3D-Torso gedrückt, um einen Pin zu setzen. Danach kannst du die Position feinjustieren.
        </p>
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onDontShowAgain}>
            Nicht mehr anzeigen
          </button>
          <button type="button" className="btn-primary flex-1" onClick={onClose}>
            Verstanden
          </button>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Add log sheet**

Create:

```tsx
// src/components/injection3d/InjectionLogSheet.tsx
import { useState } from 'react'
import { AlertTriangle, Check, X } from 'lucide-react'
import type { InjectionPinDraft, InjectionProximityWarning, SelectableInjectionCycle } from '../../lib/injectionLogTypes'

export function InjectionLogSheet({
  pin,
  cycles,
  warning,
  onCancel,
  onSave,
}: {
  pin: InjectionPinDraft
  cycles: SelectableInjectionCycle[]
  warning: InjectionProximityWarning
  onCancel: () => void
  onSave: (input: { cycle: SelectableInjectionCycle | null; dose: number | null; unit: string | null; method: string | null; notes: string | null }) => Promise<void>
}) {
  const [cycleId, setCycleId] = useState(cycles[0]?.id ?? '')
  const selected = cycles.find(cycle => cycle.id === cycleId) ?? null
  const [dose, setDose] = useState(selected ? String(selected.dose) : '')
  const [unit, setUnit] = useState(selected?.unit ?? 'mcg')
  const [method, setMethod] = useState(selected?.method ?? 'Subkutan')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await onSave({
      cycle: selected,
      dose: dose ? Number(dose) : null,
      unit,
      method,
      notes,
    })
    setSaving(false)
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onCancel} />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl border border-white/10 p-5 pb-8" style={{ background: 'var(--surface)' }}>
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-sky-400">3D Injektionskarte</p>
            <h2 className="text-lg font-black text-white">Injektion speichern</h2>
          </div>
          <button type="button" aria-label="Abbrechen" onClick={onCancel} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 text-slate-400">
            <X size={16} />
          </button>
        </div>

        {warning.level !== 'none' && (
          <div className="mb-4 flex gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>{warning.level === 'strong' ? 'Sehr nahe an einer kürzlichen Injektion.' : 'Nahe an einer Injektion der letzten 7 Tage.'}</p>
          </div>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="label">Aktiver Zyklus</span>
            <select className="input" value={cycleId} onChange={event => {
              const next = cycles.find(cycle => cycle.id === event.target.value) ?? null
              setCycleId(event.target.value)
              if (next) {
                setDose(String(next.dose))
                setUnit(next.unit)
                setMethod(next.method)
              }
            }}>
              <option value="">Substanz manuell erfassen</option>
              {cycles.map(cycle => (
                <option key={cycle.id} value={cycle.id}>{cycle.peptide_name} · {cycle.cycle_name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="label">Dosis</span>
              <input className="input" value={dose} onChange={event => setDose(event.target.value)} inputMode="decimal" />
            </label>
            <label>
              <span className="label">Einheit</span>
              <input className="input" value={unit} onChange={event => setUnit(event.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="label">Methode</span>
            <input className="input" value={method} onChange={event => setMethod(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Notiz optional</span>
            <textarea className="input min-h-20 resize-none" value={notes} onChange={event => setNotes(event.target.value)} />
          </label>
          <p className="text-xs text-slate-500">
            Stelle: {pin.body_side} · {pin.body_region}
          </p>
          <div className="flex gap-3 pt-1">
            <button type="button" className="btn-secondary flex-1" onClick={onCancel}>Abbrechen</button>
            <button type="button" className="btn-primary flex-1" onClick={save} disabled={saving || !dose || !unit || !method}>
              <Check size={14} /> Speichern
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Add history sheet**

Create:

```tsx
// src/components/injection3d/InjectionHistorySheet.tsx
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { Check, History, MapPin } from 'lucide-react'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'

function groupLabel(date: Date) {
  if (isToday(date)) return 'Heute'
  if (isYesterday(date)) return 'Gestern'
  return format(date, 'dd.MM.yyyy')
}

export function InjectionHistorySheet({
  logs,
  showLast7Days,
  visibleLogIds,
  onToggleLast7Days,
  onToggleLog,
  onFocusLog,
}: {
  logs: InjectionLog3D[]
  showLast7Days: boolean
  visibleLogIds: Set<string>
  onToggleLast7Days: () => void
  onToggleLog: (id: string) => void
  onFocusLog: (log: InjectionLog3D) => void
}) {
  const groups = logs.reduce<Array<{ label: string; logs: InjectionLog3D[] }>>((acc, log) => {
    const label = groupLabel(parseISO(log.logged_at))
    const group = acc.find(item => item.label === label)
    if (group) group.logs.push(log)
    else acc.push({ label, logs: [log] })
    return acc
  }, [])

  return (
    <section className="sticky bottom-0 z-20 rounded-t-3xl border border-white/10 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]" style={{ background: 'var(--surface)' }}>
      <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History size={16} color="var(--accent)" />
          <h2 className="text-sm font-black text-white">Historie</h2>
        </div>
        <button type="button" onClick={onToggleLast7Days} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${showLast7Days ? 'border-sky-400/40 bg-sky-400/15 text-sky-300' : 'border-white/10 text-slate-400'}`}>
          Letzte 7 Tage
        </button>
      </div>

      <div className="max-h-[42vh] space-y-3 overflow-y-auto pr-1">
        {groups.length === 0 && <p className="py-5 text-center text-sm text-slate-500">Noch keine Injektionen geloggt.</p>}
        {groups.map(group => (
          <div key={group.label}>
            <p className="mb-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-slate-500">{group.label}</p>
            <div className="space-y-2">
              {group.logs.map(log => {
                const visible = visibleLogIds.has(log.id)
                return (
                  <div key={log.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
                    <button type="button" aria-label="Pin als Referenz anzeigen" onClick={() => onToggleLog(log.id)} className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${visible ? 'border-sky-400/40 bg-sky-400/15 text-sky-300' : 'border-white/10 text-slate-500'}`}>
                      {visible ? <Check size={14} /> : <MapPin size={14} />}
                    </button>
                    <button type="button" onClick={() => onFocusLog(log)} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-bold text-white">{log.peptide_name ?? 'Injektion'} · {log.body_side} {log.body_region}</p>
                      <p className="text-xs text-slate-500">{format(parseISO(log.logged_at), 'dd.MM.yyyy HH:mm')} · {[log.dose, log.unit].filter(Boolean).join(' ')}</p>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Refactor `InjektionsTracker.tsx` around new components**

In `src/pages/InjektionsTracker.tsx`, remove old fixed `SITE_DEFS`, SVG body map, old status grid, and old `LogSheet`. Keep `PageHeader` only if it still fits. Use these core states:

```tsx
const [logs, setLogs] = useState<InjectionLog3D[]>([])
const [cycles, setCycles] = useState<SelectableInjectionCycle[]>([])
const [draftPin, setDraftPin] = useState<InjectionPinDraft | null>(null)
const [showLogSheet, setShowLogSheet] = useState(false)
const [showLast7Days, setShowLast7Days] = useState(false)
const [visibleLogIds, setVisibleLogIds] = useState<Set<string>>(() => new Set())
const [showIntro, setShowIntro] = useState(() => {
  return Number(localStorage.getItem('tyd_injection_intro_version') ?? 0) < INJECTION_INTRO_VERSION
})
```

Use these handlers:

```tsx
const closeIntro = () => setShowIntro(false)
const dontShowIntro = () => {
  localStorage.setItem('tyd_injection_intro_version', String(INJECTION_INTRO_VERSION))
  setShowIntro(false)
}

const toggleLogVisibility = (id: string) => {
  setVisibleLogIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}

const toggleLast7Days = () => {
  setShowLast7Days(prev => {
    const nextEnabled = !prev
    if (nextEnabled) {
      const ids = filterRecentInjectionLogs(logs, new Date(), 7).map(log => log.id)
      setVisibleLogIds(prevIds => new Set([...prevIds, ...ids]))
    }
    return nextEnabled
  })
}
```

Use `loadInjectionLogs` and `loadSelectableInjectionCycles` in `loadData`. Compute warning:

```tsx
const warning = draftPin ? proximityWarning(draftPin, logs, new Date()) : { level: 'none', nearestLogId: null, distance: null }
```

Render:

```tsx
<InjectionMapCanvas
  draftPin={draftPin}
  logs={logs}
  visibleLogIds={visibleLogIds}
  onDraftPinChange={(pin) => {
    setDraftPin(pin)
    setShowLogSheet(false)
  }}
  onLogFocus={(log) => setVisibleLogIds(prev => new Set(prev).add(log.id))}
/>

{draftPin && !showLogSheet && (
  <div className="fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl border border-white/10 p-4 pb-8" style={{ background: 'var(--surface)' }}>
    <div className="flex gap-3">
      <button className="btn-secondary flex-1" onClick={() => setDraftPin(null)}>Abbrechen</button>
      <button className="btn-primary flex-1" onClick={() => setShowLogSheet(true)}>Position übernehmen</button>
    </div>
  </div>
)}

<InjectionHistorySheet
  logs={logs}
  showLast7Days={showLast7Days}
  visibleLogIds={visibleLogIds}
  onToggleLast7Days={toggleLast7Days}
  onToggleLog={toggleLogVisibility}
  onFocusLog={(log) => setVisibleLogIds(prev => new Set(prev).add(log.id))}
/>
```

- [ ] **Step 5: Save from log sheet**

Use this save callback in `InjektionsTracker.tsx`:

```tsx
const saveDraftPin = async (input: {
  cycle: SelectableInjectionCycle | null
  dose: number | null
  unit: string | null
  method: string | null
  notes: string | null
}) => {
  if (!user || !draftPin) return
  try {
    await saveInjectionLog(supabase, {
      userId: user.id,
      doseLogId: null,
      peptideId: input.cycle?.peptide_id ?? null,
      cycleId: input.cycle?.id ?? null,
      dose: input.dose,
      unit: input.unit,
      method: input.method,
      notes: input.notes,
      loggedAt: new Date().toISOString(),
      warningState: warning.level === 'none' ? null : warning.level,
      pin: draftPin,
    })
    toast.success('Injektion gespeichert')
    setDraftPin(null)
    setShowLogSheet(false)
    await loadData()
  } catch (error) {
    console.error('[InjektionsTracker] saveDraftPin error:', error)
    toast.error('Fehler beim Speichern')
  }
}
```

- [ ] **Step 6: Build and manually verify**

Run:

```powershell
npm run build
npm run dev
```

Verify:

- Intro appears once.
- `Nicht mehr anzeigen` persists.
- Long-press creates draft pin.
- `Position übernehmen` opens log sheet.
- Save writes an injection log.
- History lists newest first.
- `Letzte 7 Tage` shows reference pins.
- Per-log checkmark toggles pin visibility.

- [ ] **Step 7: Commit**

Run:

```powershell
git add -- src/components/injection3d src/pages/InjektionsTracker.tsx
git commit -m "Build 3D injection tracker page"
```

---

## Task 5: Optional Dose Confirmation Linkage

**Files:**
- Modify: `src/lib/injectionPersistence.ts`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/pages/InjektionsTracker.tsx`

**Interfaces:**
- Consumes:
  - existing `confirmDose`
  - existing `confirmCycleDose`
  - existing route `/injektionen`
- Produces:
  - Global preference `tyd_prompt_injection_site_after_dose`
  - Optional post-confirm prompt.
  - Route support for `?doseLog=<id>` or `?cycle=<id>` preselection.

- [ ] **Step 1: Add preference helpers**

Append to `src/lib/injectionPersistence.ts`:

```ts
const PROMPT_AFTER_DOSE_KEY = 'tyd_prompt_injection_site_after_dose'

export function shouldPromptInjectionSiteAfterDose(): boolean {
  return localStorage.getItem(PROMPT_AFTER_DOSE_KEY) !== 'false'
}

export function disablePromptInjectionSiteAfterDose() {
  localStorage.setItem(PROMPT_AFTER_DOSE_KEY, 'false')
}
```

- [ ] **Step 2: Update Dashboard confirm flow**

In `src/pages/Dashboard.tsx`, import helpers:

```ts
import { disablePromptInjectionSiteAfterDose, shouldPromptInjectionSiteAfterDose } from '../lib/injectionPersistence'
```

Add state:

```tsx
const [injectionPrompt, setInjectionPrompt] = useState<{ doseLogId: string | null; cycleId: string | null } | null>(null)
```

After a successful `confirmDose` or `confirmCycleDose` with `taken === true`, set the prompt only when method is injectable:

```tsx
const maybePromptInjectionSite = (payload: { doseLogId: string | null; cycleId: string | null; method: string }) => {
  if (!shouldPromptInjectionSiteAfterDose()) return
  if (!['Subkutan', 'Intramuskulär', 'Intramuskulaer'].includes(payload.method)) return
  setInjectionPrompt({ doseLogId: payload.doseLogId, cycleId: payload.cycleId })
}
```

For existing `confirmDose`, call:

```tsx
if (taken) maybePromptInjectionSite({ doseLogId: log.id, cycleId: null, method: log.method })
```

For inserted cycle dose, adjust insert to return id:

```tsx
const { data, error } = await supabase.from('dose_logs').insert({
  user_id: user!.id,
  peptide_id: cycle.peptide_id,
  dose,
  unit: cycle.unit,
  method: cycle.method,
  logged_at: loggedAt ?? cycleLogTimestamp(cycle, selectedDay),
  taken,
}).select('id').single()
```

Then call:

```tsx
if (taken) maybePromptInjectionSite({ doseLogId: data?.id ?? null, cycleId: cycle.id, method: cycle.method })
```

- [ ] **Step 3: Render the prompt**

Render near the existing confirm sheet:

```tsx
{injectionPrompt && (
  <>
    <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setInjectionPrompt(null)} />
    <div className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border border-white/10 p-5 pb-8" style={{ background: 'var(--surface)' }}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
      <h2 className="mb-2 text-base font-black text-white">Injektionsstelle hinzufügen?</h2>
      <p className="mb-5 text-sm text-slate-400">Du kannst die Stelle jetzt auf der 3D Injektionskarte markieren oder später nachtragen.</p>
      <div className="grid gap-2">
        <button className="btn-primary" onClick={() => {
          const params = new URLSearchParams()
          if (injectionPrompt.doseLogId) params.set('doseLog', injectionPrompt.doseLogId)
          if (injectionPrompt.cycleId) params.set('cycle', injectionPrompt.cycleId)
          window.location.href = `/injektionen?${params.toString()}`
        }}>Jetzt markieren</button>
        <button className="btn-secondary" onClick={() => setInjectionPrompt(null)}>Später</button>
        <button className="rounded-xl px-4 py-3 text-sm font-bold text-slate-400" onClick={() => {
          disablePromptInjectionSiteAfterDose()
          setInjectionPrompt(null)
        }}>Nicht mehr fragen</button>
      </div>
    </div>
  </>
)}
```

- [ ] **Step 4: Read query params in `InjektionsTracker.tsx`**

Use `useLocation`:

```tsx
const location = useLocation()
const params = new URLSearchParams(location.search)
const linkedDoseLogId = params.get('doseLog')
const preselectedCycleId = params.get('cycle')
```

Pass `linkedDoseLogId` into `saveInjectionLog` as `doseLogId` when present. Use `preselectedCycleId` to choose the initial cycle in `InjectionLogSheet`.

- [ ] **Step 5: Build and manually verify**

Run:

```powershell
npm run build
```

Manual checks:

- Confirming a subcutaneous/intramuscular dose still confirms normally.
- Prompt appears after confirmation when preference is enabled.
- `Später` closes prompt.
- `Nicht mehr fragen` stores preference and suppresses future prompts.
- `Jetzt markieren` opens `/injektionen` with query params.
- Tracker can save a pin linked to existing `dose_log_id`.

- [ ] **Step 6: Commit**

Run:

```powershell
git add -- src/lib/injectionPersistence.ts src/pages/Dashboard.tsx src/pages/InjektionsTracker.tsx
git commit -m "Link injection tracking to dose confirmations"
```

---

## Task 6: Home Hero Card

**Files:**
- Create: `src/components/injection3d/InjectionTrackerHero.tsx`
- Modify: `src/pages/Home.tsx`

**Interfaces:**
- Consumes:
  - `/injektionen` route
  - recent `injection_logs`
- Produces:
  - Prominent Home hero card with title **Injektionstracker Pro** and subtitle **Praezises 3D-Injektionstracking**.

- [x] **Step 1: Add hero component**

Create:

```tsx
// src/components/injection3d/InjectionTrackerHero.tsx
import { ArrowUpRight, MapPin, Rotate3D, Syringe } from 'lucide-react'

export function InjectionTrackerHero({
  lastLabel,
  sevenDayCount,
  hasDueInjectable,
  onOpen,
  onLogToday,
}: {
  lastLabel: string
  sevenDayCount: number
  hasDueInjectable: boolean
  onOpen: () => void
  onLogToday: () => void
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-cyan-400/20 p-4" style={{ background: 'linear-gradient(145deg, rgba(8,18,32,0.98), rgba(6,12,22,0.96))', boxShadow: 'var(--shadow-card)' }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.18),transparent_36%)]" />
      <div className="relative flex items-center gap-4">
        <div className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl border border-cyan-400/15 bg-cyan-400/10">
          <div className="relative h-16 w-12">
            <div className="absolute inset-x-2 top-0 h-14 rounded-full border border-cyan-200/35 bg-cyan-200/10" />
            <div className="absolute left-1/2 top-9 h-7 w-8 -translate-x-1/2 rounded-b-full border border-cyan-200/20 bg-cyan-200/5" />
            <span className="absolute right-1 top-9 h-3 w-3 rounded-full bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.9)]" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-[0.62rem] font-extrabold uppercase tracking-[0.14em] text-cyan-300">
            <Rotate3D size={13} /> Pro Feature
          </div>
          <h2 className="text-xl font-black tracking-[-0.04em] text-white">Injektionstracker Pro</h2>
          <p className="mt-1 text-sm font-semibold text-cyan-100/80">Praezises 3D-Injektionstracking</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
              <MapPin size={12} /> {lastLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
              <Syringe size={12} /> 7 Tage: {sevenDayCount}
            </span>
          </div>
        </div>
      </div>
      <div className="relative mt-4 flex gap-2">
        <button type="button" onClick={onOpen} className="btn-primary flex-1">
          3D Tracker öffnen <ArrowUpRight size={14} />
        </button>
        {hasDueInjectable && (
          <button type="button" onClick={onLogToday} className="btn-secondary flex-1">
            Mit Stelle loggen
          </button>
        )}
      </div>
    </section>
  )
}
```

- [x] **Step 2: Load hero summary in Home**

In `src/pages/Home.tsx`, import:

```ts
import { InjectionTrackerHero } from '../components/injection3d/InjectionTrackerHero'
```

Add state:

```tsx
const [injectionHero, setInjectionHero] = useState({ lastLabel: 'Noch keine Stelle geloggt', sevenDayCount: 0 })
```

In the existing Home `load()` Promise.all, add:

```ts
supabase.from('injection_logs')
  .select('logged_at, body_region, body_side')
  .eq('user_id', user!.id)
  .order('logged_at', { ascending: false })
  .limit(30)
```

After data loads:

```tsx
const injectionRows = injectionData ?? []
const lastInjection = injectionRows[0]
const sevenDayCount = injectionRows.filter(row => {
  const ageMs = Date.now() - parseISO(row.logged_at as string).getTime()
  return ageMs >= 0 && ageMs <= 7 * 24 * 60 * 60 * 1000
}).length
setInjectionHero({
  lastLabel: lastInjection
    ? `${lastInjection.body_side ?? ''} ${lastInjection.body_region ?? 'Stelle'}`.trim()
    : 'Noch keine Stelle geloggt',
  sevenDayCount,
})
```

Set `hasDueInjectable` from open slots:

```tsx
const hasDueInjectable = openSlots.some(slot => {
  const cycle = (cycleData ?? []).find(c => c.peptide_id === slot.peptideId)
  return cycle && ['Subkutan', 'Intramuskulär', 'Intramuskulaer'].includes(cycle.method)
})
```

- [x] **Step 3: Render hero relatively high on Home**

Place after the top status section and before lower feature sections:

```tsx
<InjectionTrackerHero
  lastLabel={injectionHero.lastLabel}
  sevenDayCount={injectionHero.sevenDayCount}
  hasDueInjectable={todayIntakes.length > 0}
  onOpen={() => navigate('/injektionen')}
  onLogToday={() => navigate('/injektionen')}
/>
```

Use `hasDueInjectable` when it is available in state; if it is scoped inside `load()`, promote it to state.

- [x] **Step 4: Build and manually verify**

Run:

```powershell
npm run build
```

Manual checks:

- Home displays the hero relatively high.
- Text exactly reads `Injektionstracker Pro`.
- Subtitle exactly reads `Praezises 3D-Injektionstracking`.
- CTA opens `/injektionen`.
- Hero remains readable at 375px width.

- [ ] **Step 5: Commit**

Run:

```powershell
git add -- src/components/injection3d/InjectionTrackerHero.tsx src/pages/Home.tsx
git commit -m "Add Injektionstracker Pro home hero"
```

---

## Task 7: Copy, Accessibility, and Responsive Polish

**Files:**
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/components/injection3d/*.tsx`
- Modify: `src/pages/InjektionsTracker.tsx`

**Interfaces:**
- Consumes all prior UI components.
- Produces accessible labels, localized copy, and responsive final polish.

- [ ] **Step 1: Add German copy keys**

Add to `src/i18n/locales/de.json`:

```json
{
  "injection_pro_title": "Injektionstracker Pro",
  "injection_pro_subtitle": "Praezises 3D-Injektionstracking",
  "injection_map_title": "3D Injektionskarte",
  "injection_intro_title": "Markierung setzen",
  "injection_intro_body": "Halte eine Stelle auf dem 3D-Torso gedrueckt, um einen Pin zu setzen. Danach kannst du die Position feinjustieren.",
  "injection_intro_understood": "Verstanden",
  "injection_intro_dont_show": "Nicht mehr anzeigen",
  "injection_position_accept": "Position uebernehmen",
  "injection_position_cancel": "Abbrechen",
  "injection_history": "Historie",
  "injection_last_7_days": "Letzte 7 Tage",
  "injection_add_site_prompt": "Injektionsstelle hinzufuegen?",
  "injection_add_site_prompt_body": "Du kannst die Stelle jetzt auf der 3D Injektionskarte markieren oder spaeter nachtragen."
}
```

Keep existing JSON valid and alphabetic ordering only if the file already uses it.

- [ ] **Step 2: Add English copy keys**

Add to `src/i18n/locales/en.json`:

```json
{
  "injection_pro_title": "Injection Tracker Pro",
  "injection_pro_subtitle": "Precise 3D injection tracking",
  "injection_map_title": "3D Injection Map",
  "injection_intro_title": "Place a marker",
  "injection_intro_body": "Press and hold a spot on the 3D torso to place a pin. You can fine-tune the position afterwards.",
  "injection_intro_understood": "Got it",
  "injection_intro_dont_show": "Do not show again",
  "injection_position_accept": "Use position",
  "injection_position_cancel": "Cancel",
  "injection_history": "History",
  "injection_last_7_days": "Last 7 days",
  "injection_add_site_prompt": "Add injection site?",
  "injection_add_site_prompt_body": "You can mark the site now on the 3D Injection Map or add it later."
}
```

- [ ] **Step 3: Replace hardcoded user-facing copy in new components**

Use `useTranslation()` in:

- `InjectionIntroSheet.tsx`
- `InjectionLogSheet.tsx`
- `InjectionHistorySheet.tsx`
- `InjectionTrackerHero.tsx`

Replace hardcoded German strings with `t(key, { defaultValue })`.

- [ ] **Step 4: Add accessibility labels**

Ensure all icon-only buttons in new components have:

```tsx
aria-label="..."
```

Examples:

```tsx
aria-label={String(t('injection_position_cancel', { defaultValue: 'Abbrechen' }))}
aria-label={String(t('injection_last_7_days', { defaultValue: 'Letzte 7 Tage' }))}
```

- [ ] **Step 5: Respect reduced motion**

In `src/index.css`, add:

```css
@media (prefers-reduced-motion: reduce) {
  .injection-map-glow,
  .injection-map-pulse {
    animation: none !important;
    transition: none !important;
  }
}
```

Use these classes only on new glow/pulse elements.

- [ ] **Step 6: Verify**

Run:

```powershell
npm run build
```

Manual checks:

- 375px mobile width: no horizontal scroll.
- Bottom sheet buttons are at least 44px tall.
- Desktop: history does not overlap main controls.
- Keyboard can focus sheet buttons.

- [ ] **Step 7: Commit**

Run:

```powershell
git add -- src/i18n/locales/de.json src/i18n/locales/en.json src/components/injection3d src/pages/InjektionsTracker.tsx src/index.css
git commit -m "Polish injection tracker accessibility and copy"
```

---

## Task 8: Final Verification and Asset Handoff Notes

**Files:**
- Modify: `docs/superpowers/specs/2026-06-17-injektionstracker-pro-3d-design.md` only if implementation decisions need a short addendum.
- No code changes unless verification finds a bug.

**Interfaces:**
- Consumes all completed tasks.
- Produces final verification evidence and notes for the future `.glb` model integration.

- [ ] **Step 1: Run full automated checks**

Run:

```powershell
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 2: Manual mobile interaction checklist**

Run:

```powershell
npm run dev
```

Verify in browser device mode at 375x812:

- `/injektionen` renders 3D torso.
- One-finger drag rotates.
- Pinch/wheel zoom works.
- Long-press places pin.
- Pin is visually dominant.
- `Position übernehmen` opens save sheet.
- Save writes history item.
- History item can be checked as visible reference.
- `Letzte 7 Tage` toggles recent pins.
- Intro does not reappear after `Nicht mehr anzeigen`.

- [ ] **Step 3: Manual desktop checklist**

Verify at 1440x900:

- 3D scene remains centered.
- History/details are usable without overlapping.
- Mouse drag and wheel work.
- Desktop fallback for placing a pin is discoverable through long-press/hold or a visible mark action if implemented.

- [ ] **Step 4: Dose confirmation checklist**

Verify:

- Normal intake confirmation still works without entering the tracker.
- Optional injection-site prompt appears only for injectable methods.
- `Nicht mehr fragen` suppresses future prompts globally.
- A later pin can link to an existing `dose_log_id`.
- No duplicate `dose_logs` are created when linking an existing confirmation.

- [ ] **Step 5: Future asset handoff note**

If the placeholder torso remains, add a short note to the final PR/summary:

```md
The v1 implementation uses `model_version = placeholder-v1` with a procedural torso/hit mesh. Before replacing it with a production `.glb`, verify license, polygon count, UV stability, separate hit mesh, body-region mapping, texture compression, and a migration path for existing `model_version` values.
```

- [ ] **Step 6: Commit verification fixes only if needed**

If changes were required:

```powershell
git add -- src/lib/injectionGeometry.ts src/lib/injectionPersistence.ts src/components/injection3d src/pages/InjektionsTracker.tsx src/pages/Dashboard.tsx src/pages/Home.tsx docs/superpowers/specs/2026-06-17-injektionstracker-pro-3d-design.md
git commit -m "Verify 3D injection tracker flow"
```

If no changes were required, do not create an empty commit.
