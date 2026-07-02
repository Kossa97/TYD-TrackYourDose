# Unified Vial Glass + Stage Light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split vial glass look with one continuous glass shell and add a scroll-aware spotlight/focus effect to the vial carousel.

**Architecture:** Keep the feature inside the existing React/SVG implementation. `PeptideVialVisual` owns the unified glass rendering and accepts optional visual focus props; `Peptide.tsx` computes carousel focus from item distance to the viewport center.

**Tech Stack:** React 19, TypeScript, SVG, Tailwind CSS, Vitest, Vite.

## Global Constraints

- Deckel-Design nicht veraendern.
- Label-Design, Textlayout und Marquee-Verhalten nicht veraendern.
- Keine echte 3D- oder Raytracing-Lichtsimulation.
- Keine neue Asset-Datei fuer das Vial.
- Keine Aenderungen an Peptid-Daten, Lagerlogik oder Formularen.
- `prefers-reduced-motion: reduce` respektieren.
- Bestehende Dirty Files nicht revertieren.

---

## File Map

- Modify `src/components/PeptideVialVisual.tsx`: introduce unified glass shell SVG, focus/light props, and decorative glass/shadow rendering.
- Modify `src/components/PeptideVialVisual.test.ts`: update tests from split top/body assumptions to unified shell expectations.
- Modify `src/pages/Peptide.tsx`: calculate per-item carousel focus and pass it to `PeptideVialVisual`; add a central spotlight layer.
- Optionally modify `src/pages/__VialPreview.tsx`: pass static focus values only if visual preview needs clearer side-by-side states.

---

### Task 1: Lock the Unified Glass Shell Contract

**Files:**
- Modify: `src/components/PeptideVialVisual.test.ts`
- Modify: `src/components/PeptideVialVisual.tsx`

**Interfaces:**
- Produces: `PeptideVialVisualProps.focus?: number`, `PeptideVialVisualProps.lightOffset?: number`
- Produces: markup with `data-vial-detail="unified-glass-shell"`, `data-vial-detail="unified-glass-outline"`, and `data-vial-detail="glass-stage-shadow"`

- [ ] **Step 1: Write failing tests**

Add tests to `src/components/PeptideVialVisual.test.ts`:

```ts
test('renders one unified glass shell for neck shoulder and body', () => {
  const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
    name: 'BPC-157',
    amount: '5',
    unit: 'mg',
    fillPct: 72,
    color: '#06b6d4',
  }))

  expect(html).toContain('data-vial-detail="unified-glass-shell"')
  expect(html).toContain('data-vial-detail="unified-glass-outline"')
  expect(html).toContain('data-vial-detail="glass-stage-shadow"')
  expect(html).not.toContain('data-vial-detail="glass-shoulder"')
  expect(html).not.toContain('data-vial-detail="glass-body"')
})

test('accepts focus and lightOffset as visual control props', () => {
  const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
    name: 'TB-500',
    amount: '10',
    unit: 'mg',
    fillPct: 40,
    color: '#a855f7',
    focus: 0.42,
    lightOffset: -0.35,
  }))

  expect(html).toContain('data-vial-focus="0.42"')
  expect(html).toContain('data-vial-light-offset="-0.35"')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/PeptideVialVisual.test.ts`

Expected: FAIL because `unified-glass-shell`, `glass-stage-shadow`, `focus`, and `lightOffset` are not implemented yet.

- [ ] **Step 3: Implement minimal visual contract**

In `PeptideVialVisual.tsx`:

```ts
interface PeptideVialVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  fillPct: number
  color: string
  animateOnMount?: boolean
  size?: 'large' | 'compact'
  className?: string
  isActive?: boolean
  slosh?: number
  focus?: number
  lightOffset?: number
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
```

Render attributes on the root wrapper:

```tsx
const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
const visualLightOffset = clampSlosh(lightOffset ?? 0)

<div
  className={`relative mx-auto select-none ${widthClass} ${className}`}
  data-fill-pct={clampedFill}
  data-vial-focus={Number(visualFocus.toFixed(2))}
  data-vial-light-offset={Number(visualLightOffset.toFixed(2))}
  aria-label={`${labelName}, ${vialAmountLabel(amount, unit)}, ${clampedFill}%`}
>
```

- [ ] **Step 4: Run test to verify it passes or reaches next expected failure**

Run: `npm test -- src/components/PeptideVialVisual.test.ts`

Expected: either PASS for prop contract or FAIL only for missing final markup that Task 2 completes.

---

### Task 2: Replace Split Glass Layers With One Continuous Shell

**Files:**
- Modify: `src/components/PeptideVialVisual.tsx`
- Modify: `src/components/PeptideVialVisual.test.ts`

**Interfaces:**
- Consumes: `visualFocus: number`, `visualLightOffset: number`
- Produces: one SVG shell using viewBox `0 0 120 294`

- [ ] **Step 1: Write failing test for removed seam workaround**

Update the existing cap/glass test in `src/components/PeptideVialVisual.test.ts`:

```ts
test('keeps the cap and label while removing split glass body seams', () => {
  const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
    name: 'TB-500',
    amount: '5',
    unit: 'mg',
    fillPct: 80,
    color: '#06b6d4',
  }))

  expect(html).toContain('data-vial-detail="single-cap"')
  expect(html).toContain('data-vial-detail="full-width-label"')
  expect(html).toContain('data-vial-detail="unified-glass-shell"')
  expect(html).not.toContain('data-vial-detail="glass-shoulder"')
  expect(html).not.toContain('data-vial-detail="glass-body"')
  expect(html).not.toContain('data-vial-detail="glass-base"')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/PeptideVialVisual.test.ts`

Expected: FAIL because split `glass-body` markup still exists.

- [ ] **Step 3: Implement unified shell**

Replace the body wrapper structure with a single relative shell:

```tsx
<div className={`relative w-full ${heightClass}`}>
  <svg
    data-vial-detail="unified-glass-shell"
    className="absolute inset-0 h-full w-full overflow-visible"
    viewBox="0 0 120 294"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      <path
        id={`${uid}-vialShellPath`}
        d="M28 0 L92 0 L92 24 C92 35 116 41 116 56 L116 250 C116 277 101 292 74 292 L46 292 C19 292 4 277 4 250 L4 56 C4 41 28 35 28 24 Z"
      />
      <clipPath id={`${uid}-vialShellClip`}>
        <use href={`#${uid}-vialShellPath`} />
      </clipPath>
      <clipPath id={`${uid}-liquidBodyClip`}>
        <path d="M4 56 H116 V250 C116 277 101 292 74 292 H46 C19 292 4 277 4 250 Z" />
      </clipPath>
    </defs>
    <ellipse
      data-vial-detail="glass-stage-shadow"
      cx="60"
      cy="291"
      rx={38 + visualFocus * 10}
      ry={7 + visualFocus * 3}
      fill="rgba(0,0,0,0.42)"
    />
    <use
      data-vial-detail="unified-glass-outline"
      href={`#${uid}-vialShellPath`}
      fill="rgba(2,6,23,0.48)"
      stroke="rgba(203,213,225,0.48)"
      strokeWidth="1.2"
    />
  </svg>
  ...
</div>
```

Move the liquid SVG inside the same wrapper, position it over the lower body, and keep `data-vial-detail="liquid-graphic"`.

- [ ] **Step 4: Remove old split body classes**

Delete the old `data-vial-detail="glass-body"` body container and the old `data-vial-detail="glass-base"` overlay. Keep `full-width-label` unchanged.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/components/PeptideVialVisual.test.ts`

Expected: PASS.

---

### Task 3: Add Scroll-Aware Carousel Focus

**Files:**
- Modify: `src/pages/Peptide.tsx`

**Interfaces:**
- Consumes: `PeptideVialVisual focus?: number`, `lightOffset?: number`
- Produces: `vialFocusByIndex: Record<number, { focus: number; lightOffset: number }>`

- [ ] **Step 1: Add local state and helper**

Add near carousel refs:

```ts
const [vialFocusByIndex, setVialFocusByIndex] = useState<Record<number, { focus: number; lightOffset: number }>>({})
```

Add helper near carousel functions:

```ts
const updateVialFocus = () => {
  const carousel = vialCarouselRef.current
  if (!carousel) return

  const center = carousel.scrollLeft + carousel.clientWidth / 2
  const maxDistance = Math.max(1, carousel.clientWidth * 0.48)
  const next: Record<number, { focus: number; lightOffset: number }> = {}

  for (const item of carousel.querySelectorAll<HTMLElement>('[data-vial-index]')) {
    const index = Number(item.dataset.vialIndex)
    if (!Number.isFinite(index)) continue

    const itemCenter = item.offsetLeft + item.offsetWidth / 2
    const distance = itemCenter - center
    const normalized = Math.max(-1, Math.min(1, distance / maxDistance))
    const focus = Math.max(0.22, 1 - Math.abs(normalized) * 0.78)

    next[index] = {
      focus: Number(focus.toFixed(2)),
      lightOffset: Number((-normalized).toFixed(2)),
    }
  }

  setVialFocusByIndex(next)
}
```

- [ ] **Step 2: Call helper from existing scroll lifecycle**

Inside `handleVialCarouselScroll`, call `updateVialFocus()` before the requestAnimationFrame block updates active item.

Inside the effect that resets to first vial, call `window.requestAnimationFrame(updateVialFocus)` after scrolling the first item.

- [ ] **Step 3: Pass focus props**

Inside the `displayPeptides.map` render:

```tsx
const focusState = vialFocusByIndex[index] ?? {
  focus: isActive ? 1 : 0.28,
  lightOffset: 0,
}

<PeptideVialVisual
  key={animationEpoch}
  name={p.name}
  amount={p.vial_amount_mg}
  unit={p.vial_amount_unit ?? 'mg'}
  fillPct={vialPct}
  color={peptideColor}
  animateOnMount={true}
  isActive={isActive}
  focus={focusState.focus}
  lightOffset={focusState.lightOffset}
/>
```

- [ ] **Step 4: Run TypeScript check**

Run: `npm run build`

Expected: PASS, no type errors.

---

### Task 4: Add Carousel Spotlight Layer

**Files:**
- Modify: `src/pages/Peptide.tsx`

**Interfaces:**
- Consumes: existing carousel container
- Produces: decorative `data-vial-detail="carousel-spotlight"` layer

- [ ] **Step 1: Add spotlight container**

Wrap the `SloshProvider` block in a relative container:

```tsx
<div className="relative">
  <div
    data-vial-detail="carousel-spotlight"
    aria-hidden="true"
    className="pointer-events-none absolute inset-x-8 top-1 bottom-8 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.20),rgba(34,211,238,0.08)_38%,transparent_72%)] blur-xl"
  />
  <SloshProvider engine={sloshEngine}>
    ...
  </SloshProvider>
</div>
```

- [ ] **Step 2: Preserve interaction**

Ensure the spotlight has `pointer-events-none` and sits behind carousel items by keeping the carousel element `relative z-10`.

- [ ] **Step 3: Run targeted tests**

Run: `npm test -- src/components/PeptideVialVisual.test.ts`

Expected: PASS.

---

### Task 5: Visual Verification and Final Checks

**Files:**
- Modify only if verification shows a visual issue in files already touched.

- [ ] **Step 1: Run full build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 2: Run VialVisual tests**

Run: `npm test -- src/components/PeptideVialVisual.test.ts`

Expected: PASS.

- [ ] **Step 3: Manual preview**

Start app if needed:

```bash
npm run dev
```

Open `/__vialpreview` and the Peptide page. Verify:

- neck and body appear as one glass object,
- no hard shoulder seam,
- cap and label look unchanged,
- active carousel vial is visibly lit,
- side carousel vials are dimmer but readable,
- scrolling moves focus/reflections smoothly.
