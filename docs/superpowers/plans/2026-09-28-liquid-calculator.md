# Liquid calculator implementation plan

> **For agentic workers:** Execute the approved design in the current session. Steps use checkbox syntax for tracking.

**Goal:** Implement the approved liquid calculator with a fixed right-hand vertical syringe and automatic plunger animation on main.

**Architecture:** Keep the existing calculator route, converter, stack adapter and copy fallback. Isolate numeric liquid calculations from the form and render the syringe as an animated SVG. The route owns viewport space; only the left form scrolls.

**Tech Stack:** React, TypeScript, i18next, CSS, SVG, Vitest and Testing Library.

**Spec:** User-approved interactive liquid form prototype and reference images in the current task: three cards (solution, withdrawal, result), needle up, plunger down, live updates after a short typing pause. Approval to implement and push main was explicitly provided.

## Global constraints

- Support amount + final solution volume and known concentration + optional container volume.
- Mass units g/mg/µg, separate active-ingredient IU, and direct target mL. Never infer mass from IU.
- Preserve physical quantities on compatible unit changes; clear incompatible quantities with an explanation.
- Preserve unit converter, stack imports, custom calibration, U-40, reset and clipboard fallback.
- Use explicit real graduation intervals, including minor ticks; never round a calculated dose to a tick.
- Keep the syringe anchored right on desktop and mobile; honor reduced motion.
- Edit German and English copy; new keys in other locales receive English placeholders only.
- No database changes or new dependencies. Work directly on main as requested.

## Review focus

1. Optional invalid volume/frequency must not destroy a valid primary draw result.
2. A source change between mass and IU must not reinterpret a previously entered dose.
3. Overflow, underflow and floating-point capacity boundaries must remain finite and accurate.
4. Rapid edits and invalid values must cancel stale animation; fluid and rubber edge share a position.
5. Narrow/short viewports must keep controls usable and the complete syringe inside its rail.

## Tasks

- [x] Numeric library (`lib/liquidCalculation.ts`): first add hand-calculated tests for 5 mg / 2 mL / 250 µg = 0.1 mL, IU, direct mL, optional invalid inputs, capacity boundaries and finite secondary results; run red, implement, run green. Export string-valued `LiquidValues`, `calculateLiquid`, and `convertLiquidValue` for the form.
- [x] Syringe (`components/SyringeScale.tsx` and CSS): test shared fluid/plunger geometry, invalid clearing, reduced motion and interrupted animation; replace horizontal display with responsive SVG. Accept nullable draw, capacity and explicit minor/major intervals.
- [x] Syringe controls (`components/SyringeFields.tsx`, `lib/syringeGraduation.ts`): preserve converter API; add optional graduation editing and common capacity cards. Verify custom calibration never silently acquires inferred physical ticks.
- [x] Form (`components/DoseCalculator.tsx`, `pages/Rechner.tsx`, CSS, locales): add integration tests for source modes, unit transitions, full withdrawals/reach, stack imports, copy and reset; implement three sections with scrollable left form and fixed right rail. Lock calculator viewport via the existing route layout mechanism.
- [ ] Verify focused tests, TypeScript/build, full serial suite, desktop/mobile light/dark screenshots and scrolling. Review diff, run graphify update without forcing a destructive cache rebuild, commit and push main. Confirm the new commit's Vercel production deployment.

## Verification record

- Full serial suite: 209 files, 2553 tests passed.
- Production build including 134 prerendered pages passed; existing bundle-size warnings remain.
- Scoped ESLint and diff checks passed. Browser component harness verified 320px, 390px, desktop, light/dark and short viewports; left form scrolls while right rail stays fixed.
- Independent review found a floating-point capacity boundary mismatch; integrated regression reproduced it, and tolerance-only excess is now clamped to physical capacity.
- The existing My Stack test double for toast was an object, but the current UI calls it as a function. The isolated pre-existing error was reproduced and the mock made callable; no My Stack runtime change.
- Graphify 0.9.6 refused to replace the newer 6100-node graph with 5554 nodes. Its generated cache changes were reverted; graph update remains blocked by the installed version.
