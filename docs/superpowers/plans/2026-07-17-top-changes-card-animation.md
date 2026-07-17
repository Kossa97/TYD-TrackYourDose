# Top Changes Card Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animate up to four „Größte Veränderungen“ cards with a polished staggered entrance and a shorter refresh when the selected progress range changes.

**Architecture:** Keep `computeTopChanges` unchanged. `FortschrittDashboard` passes the selected range as a stable animation key, while `TopChangesSection` owns presentation-only CSS classes, stagger delays, and the distinction between the first entrance and later range refreshes.

**Tech Stack:** React 19, TypeScript, inline CSS/keyframes, Vitest source-level regression tests.

## Global Constraints

- Preserve the existing 2×2 layout, card dimensions, click handling, and chart navigation.
- Animate only `transform`, `opacity`, color, border color, and shadow; never animate layout geometry.
- Initial card duration is approximately 400 ms with 90 ms stagger in reading order.
- Range refresh is shorter and does not move the card surfaces.
- Empty states are not animated.
- `prefers-reduced-motion: reduce` disables all movement and glow.
- Do not modify `computeTopChanges` or unrelated progress components.
- Do not create a production commit from the dirty shared workspace.

---

### Task 1: Add staggered entrance and compact range refresh

**Files:**
- Create: `src/features/fortschritt/components/overview/TopChangesSection.test.ts`
- Modify: `src/features/fortschritt/components/overview/TopChangesSection.tsx`
- Modify: `src/features/fortschritt/components/FortschrittDashboard.tsx`

**Interfaces:**
- Consumes: `rangeChip: RangeChipKey` from `FortschrittDashboard`.
- Produces: `animationKey: string` prop on `TopChangesSection`; CSS hooks `fortschritt-change-grid`, `fortschritt-change-card`, `fortschritt-change-copy`, and `fortschritt-change-delta`.

- [ ] **Step 1: Write the failing regression test**

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('TopChangesSection animation', () => {
  test('wires the selected range into the animated card grid', () => {
    const dashboard = readSource('../FortschrittDashboard.tsx')
    const section = readSource('./TopChangesSection.tsx')

    expect(dashboard).toContain('animationKey={rangeChip}')
    expect(section).toContain('animationKey: string')
    expect(section).toContain('key={animationKey}')
  })

  test('staggert cards and reveals the delta after the card content', () => {
    const source = readSource('./TopChangesSection.tsx')

    expect(source).toContain('index={index}')
    expect(source).toContain("'--change-card-delay': `${index * 90}ms`")
    expect(source).toContain('fortschritt-change-card')
    expect(source).toContain('fortschritt-change-copy')
    expect(source).toContain('fortschritt-change-delta')
  })

  test('uses a compact refresh and disables motion when requested', () => {
    const source = readSource('./TopChangesSection.tsx')

    expect(source).toContain('fortschritt-change-grid--refresh')
    expect(source).toContain('@media (prefers-reduced-motion: reduce)')
    expect(source).toContain('animation: none !important')
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/features/fortschritt/components/overview/TopChangesSection.test.ts`

Expected: FAIL because `animationKey`, stagger variables, CSS hooks, and reduced-motion styles do not exist yet.

- [ ] **Step 3: Wire the range key through the dashboard**

Add this prop to the existing `TopChangesSection` call in `FortschrittDashboard.tsx`:

```tsx
animationKey={rangeChip}
```

Add this property to `TopChangesSection` props:

```ts
animationKey: string
```

- [ ] **Step 4: Implement the two motion variants**

In `TopChangesSection`, remember whether a range change has happened, key the visible grid with `animationKey`, and keep the current motion mode stable between unrelated renders:

```tsx
const initialAnimationKey = useRef(animationKey)
const hasRefreshed = useRef(false)
if (animationKey !== initialAnimationKey.current) hasRefreshed.current = true
const motionMode = hasRefreshed.current ? 'refresh' : 'entry'
```

Map cards with their visible index:

```tsx
{changes.map((change, index) => (
  <ChangeCard key={change.key} change={change} index={index} onSelect={onSelect} />
))}
```

Set the stagger custom property on each card:

```tsx
style={{
  '--change-card-delay': `${index * 90}ms`,
} as CSSProperties}
```

Add component-scoped CSS with these behaviors:

```css
.fortschritt-change-grid--entry .fortschritt-change-card {
  animation: fortschritt-change-card-enter 400ms cubic-bezier(.22,1,.36,1) both;
  animation-delay: var(--change-card-delay);
}

.fortschritt-change-grid--entry .fortschritt-change-delta {
  animation: fortschritt-change-delta-enter 300ms cubic-bezier(.22,1,.36,1) both;
  animation-delay: calc(var(--change-card-delay) + 170ms);
}

.fortschritt-change-grid--refresh .fortschritt-change-copy {
  animation: fortschritt-change-copy-refresh 260ms ease-out both;
  animation-delay: var(--change-card-delay);
}

@media (prefers-reduced-motion: reduce) {
  .fortschritt-change-grid *,
  .fortschritt-change-grid *::before,
  .fortschritt-change-grid *::after {
    animation: none !important;
  }
}
```

Use keyframes that move entry cards from `translateY(10px)` and `opacity: 0`, reveal refresh content with opacity only, and finish the delta glow at the existing static text color without changing geometry.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/features/fortschritt/components/overview/TopChangesSection.test.ts`

Expected: 3 tests pass.

- [ ] **Step 6: Run complete automated verification**

Run: `npm test`

Expected: all test files pass with zero failed tests.

Run: `npm run build`

Expected: TypeScript and Vite production build complete with exit code 0.

Run: `git diff --check`

Expected: exit code 0; existing line-ending warnings are acceptable.

- [ ] **Step 7: Perform mobile visual verification**

At a viewport near 390×844, verify one through four cards when test data permits. Confirm entry order is top-left → top-right → bottom-left → bottom-right, the range refresh moves no card surface, card taps still select their chart metric, and reduced-motion disables the effects.
