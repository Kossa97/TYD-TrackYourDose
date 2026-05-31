# Live-Blutspiegel-Graph Neubau — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Chart in der `LiveCycleCard` von Recharts auf eine fokussierte Canvas-Komponente umstellen — flüssiges, einrastfreies Wischen bis zum Zyklusstart, Halten-zum-Ablesen, Live-Wachstum alle 10 s, dezente Marker, saubere Achsen.

**Architecture:** Reine Mathe-Hilfsfunktionen (Interpolation, Pan-/Anker-Berechnung, adaptive X-Ticks) in `chartMath.ts` (vitest-getestet). Eine Canvas-Komponente `LiveCycleChartCanvas` rendert via `requestAnimationFrame` und hält allen Pan-/Lese-Zustand in Refs (kein React-Re-Render pro Frame). `LiveCycleCard` lädt weiter die Daten und reicht Punkte + Marker an die Komponente; das Live-Intervall geht von 60 s auf 10 s.

**Tech Stack:** React 19, TypeScript, HTML Canvas 2D, date-fns, vitest (neu).

**Spec:** `docs/superpowers/specs/2026-05-31-live-blutspiegel-graph-redesign-design.md`

---

## File Structure

- **Create** `src/components/liveCycleChart/chartMath.ts` — reine Funktionen: `lerpLevel`, `panViewEnd`, `clampViewEnd`, `pickDayTicks` + Typen `ChartPoint`, `MarkerPoint`. Keine React-/DOM-Abhängigkeit.
- **Create** `src/components/liveCycleChart/chartMath.test.ts` — vitest-Tests für obige Funktionen.
- **Create** `src/components/liveCycleChart/LiveCycleChartCanvas.tsx` — Canvas-Rendering + Pointer-Interaktion (Wischen, Halten/Hover-Ablesen, „Jetzt ↩").
- **Create** `vitest.config.ts` — Test-Runner-Konfiguration (Node-Umgebung).
- **Modify** `package.json` — vitest als devDependency + `test`-Scripts.
- **Modify** `src/pages/BlutspiegelSimulation.tsx` — `LiveCycleCard`: Recharts-Chart-Block durch `LiveCycleChartCanvas` ersetzen, nicht mehr genutzte Recharts-spezifische State/Refs/Memos entfernen, Live-Intervall 60 s → 10 s.

---

## Task 1: Test-Runner (vitest) einrichten

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: vitest als devDependency und Scripts ergänzen**

In `package.json` im Block `"scripts"` ergänzen (nach `"preview": "vite preview",`):

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

In `"devDependencies"` ergänzen (alphabetisch sinnvoll einsortieren):

```json
    "vitest": "^3.2.4",
```

- [ ] **Step 2: vitest-Konfiguration anlegen**

Create `vitest.config.ts` (eigene Config, damit nicht die PWA-/React-Plugins aus `vite.config.ts` geladen werden):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Installieren**

Run: `npm install`
Expected: Installation ohne Fehler; `vitest` taucht in `node_modules/.bin` auf.

- [ ] **Step 4: Runner verifizieren (noch keine Tests)**

Run: `npm test`
Expected: vitest startet und meldet „No test files found" (Exit-Code ggf. ≠ 0 ist ok, solange vitest läuft).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest test runner

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `lerpLevel` (lineare Interpolation)

**Files:**
- Create: `src/components/liveCycleChart/chartMath.ts`
- Test: `src/components/liveCycleChart/chartMath.test.ts`

- [ ] **Step 1: Failing test schreiben**

Create `src/components/liveCycleChart/chartMath.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { lerpLevel, type ChartPoint } from './chartMath'

const pts: ChartPoint[] = [
  { ts: 0, level: 0 },
  { ts: 10, level: 100 },
  { ts: 20, level: 50 },
]

describe('lerpLevel', () => {
  it('interpoliert zwischen zwei Punkten', () => {
    expect(lerpLevel(pts, 5)).toBeCloseTo(50)
    expect(lerpLevel(pts, 15)).toBeCloseTo(75)
  })
  it('liefert exakte Werte an Stützstellen', () => {
    expect(lerpLevel(pts, 10)).toBeCloseTo(100)
  })
  it('klemmt außerhalb des Bereichs', () => {
    expect(lerpLevel(pts, -5)).toBeCloseTo(0)
    expect(lerpLevel(pts, 99)).toBeCloseTo(50)
  })
  it('gibt 0 bei leerer Liste', () => {
    expect(lerpLevel([], 5)).toBe(0)
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/components/liveCycleChart/chartMath.test.ts`
Expected: FAIL — `chartMath.ts` existiert nicht / Export fehlt.

- [ ] **Step 3: Minimale Implementierung**

Create `src/components/liveCycleChart/chartMath.ts`:

```ts
export interface ChartPoint { ts: number; level: number }
export interface MarkerPoint { ts: number; level: number }

/** Lineare Interpolation des Levels am Zeitpunkt ts über aufsteigend sortierte Punkte. */
export function lerpLevel(points: ChartPoint[], ts: number): number {
  if (!points.length) return 0
  if (ts <= points[0].ts) return points[0].level
  const last = points[points.length - 1]
  if (ts >= last.ts) return last.level
  let lo = 0, hi = points.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (points[mid].ts <= ts) lo = mid
    else hi = mid
  }
  const span = points[hi].ts - points[lo].ts
  if (span <= 0) return points[lo].level
  const t = (ts - points[lo].ts) / span
  return points[lo].level + t * (points[hi].level - points[lo].level)
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/components/liveCycleChart/chartMath.test.ts`
Expected: PASS (4 Tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/liveCycleChart/chartMath.ts src/components/liveCycleChart/chartMath.test.ts
git commit -m "feat: add lerpLevel interpolation helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `panViewEnd` + `clampViewEnd` (Wischen & Grenzen)

**Files:**
- Modify: `src/components/liveCycleChart/chartMath.ts`
- Test: `src/components/liveCycleChart/chartMath.test.ts`

- [ ] **Step 1: Failing tests ergänzen**

Am Ende von `src/components/liveCycleChart/chartMath.test.ts` anfügen:

```ts
import { panViewEnd, clampViewEnd } from './chartMath'

const DAY = 24 * 3_600_000

describe('panViewEnd', () => {
  it('Finger nach rechts (dx>0) verschiebt in die Vergangenheit (kleineres viewEnd)', () => {
    expect(panViewEnd(1000, 100, 200, 200)).toBeCloseTo(900)
  })
  it('Finger nach links (dx<0) verschiebt Richtung jetzt (größeres viewEnd)', () => {
    expect(panViewEnd(1000, -100, 200, 200)).toBeCloseTo(1100)
  })
  it('ohne Breite unverändert', () => {
    expect(panViewEnd(1000, 100, 0, 200)).toBe(1000)
  })
})

describe('clampViewEnd', () => {
  const dataStart = 0
  const now = 10 * DAY
  const win = 7 * DAY
  it('klemmt nicht über jetzt hinaus', () => {
    expect(clampViewEnd(now + DAY, dataStart, now, win)).toBe(now)
  })
  it('klemmt nicht vor das erste Datum + Fenster', () => {
    expect(clampViewEnd(0, dataStart, now, win)).toBe(dataStart + win)
  })
  it('lässt Werte im Bereich unverändert', () => {
    expect(clampViewEnd(8 * DAY, dataStart, now, win)).toBe(8 * DAY)
  })
  it('bei zu wenig Daten ist jetzt die einzige Position', () => {
    expect(clampViewEnd(5 * DAY, dataStart, 3 * DAY, win)).toBe(3 * DAY)
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/components/liveCycleChart/chartMath.test.ts`
Expected: FAIL — `panViewEnd` / `clampViewEnd` nicht exportiert.

- [ ] **Step 3: Implementierung ergänzen**

In `src/components/liveCycleChart/chartMath.ts` anfügen:

```ts
/** Neues Fenster-Ende beim Wischen. Finger nach rechts (dx>0) → Vergangenheit (kleiner). */
export function panViewEnd(startViewEnd: number, dxPx: number, widthPx: number, windowMs: number): number {
  if (widthPx <= 0) return startViewEnd
  return startViewEnd - (dxPx / widthPx) * windowMs
}

/** Begrenzt das Fenster-Ende: rechts nicht über jetzt, links nicht über (erster Punkt + Fenster). */
export function clampViewEnd(viewEnd: number, dataStart: number, now: number, windowMs: number): number {
  const lower = Math.min(dataStart + windowMs, now)
  if (viewEnd < lower) return lower
  if (viewEnd > now) return now
  return viewEnd
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/components/liveCycleChart/chartMath.test.ts`
Expected: PASS (alle Tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/liveCycleChart/chartMath.ts src/components/liveCycleChart/chartMath.test.ts
git commit -m "feat: add panViewEnd and clampViewEnd helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `pickDayTicks` (adaptive X-Achsen-Ticks)

**Files:**
- Modify: `src/components/liveCycleChart/chartMath.ts`
- Test: `src/components/liveCycleChart/chartMath.test.ts`

- [ ] **Step 1: Failing tests ergänzen**

Am Ende von `src/components/liveCycleChart/chartMath.test.ts` anfügen:

```ts
import { pickDayTicks } from './chartMath'

describe('pickDayTicks', () => {
  it('tägliche Ticks wenn genug Platz', () => {
    const ticks = pickDayTicks(0, 7 * DAY, 700, 56)
    expect(ticks).toEqual([0, DAY, 2 * DAY, 3 * DAY, 4 * DAY, 5 * DAY, 6 * DAY, 7 * DAY])
  })
  it('gröbere Ticks wenn wenig Platz (kein Überlappen)', () => {
    const ticks = pickDayTicks(0, 7 * DAY, 140, 56)
    expect(ticks).toEqual([0, 4 * DAY])
  })
  it('leeres Array bei ungültigem Bereich', () => {
    expect(pickDayTicks(10, 10, 700, 56)).toEqual([])
    expect(pickDayTicks(0, 7 * DAY, 0, 56)).toEqual([])
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/components/liveCycleChart/chartMath.test.ts`
Expected: FAIL — `pickDayTicks` nicht exportiert.

- [ ] **Step 3: Implementierung ergänzen**

In `src/components/liveCycleChart/chartMath.ts` anfügen:

```ts
const DAY_MS = 24 * 3_600_000

/**
 * Tages-ausgerichtete X-Ticks für [startTs, endTs]. Wählt ein Tages-Vielfaches als
 * Schrittweite, sodass bei gegebener Pixelbreite der Mindestabstand minPxPerTick
 * eingehalten wird (keine überlappenden Labels).
 */
export function pickDayTicks(startTs: number, endTs: number, widthPx: number, minPxPerTick: number): number[] {
  if (endTs <= startTs || widthPx <= 0) return []
  const span = endTs - startTs
  const maxTicks = Math.max(1, Math.floor(widthPx / minPxPerTick))
  let stepDays = 1
  while (span / DAY_MS / stepDays > maxTicks) stepDays *= 2
  const stepMs = stepDays * DAY_MS
  const first = Math.ceil(startTs / DAY_MS) * DAY_MS
  const ticks: number[] = []
  for (let t = first; t <= endTs; t += stepMs) ticks.push(t)
  return ticks
}
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/components/liveCycleChart/chartMath.test.ts`
Expected: PASS (alle Tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/liveCycleChart/chartMath.ts src/components/liveCycleChart/chartMath.test.ts
git commit -m "feat: add pickDayTicks adaptive axis helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Canvas-Komponente `LiveCycleChartCanvas`

**Files:**
- Create: `src/components/liveCycleChart/LiveCycleChartCanvas.tsx`

Keine Unit-Tests (Canvas/DOM) — Verifikation via TypeScript-Build (Task 6) und Preview.

- [ ] **Step 1: Komponente anlegen (vollständiger Code)**

Create `src/components/liveCycleChart/LiveCycleChartCanvas.tsx`:

```tsx
/**
 * LiveCycleChartCanvas — Canvas-Verlaufsgraph für einen einzelnen Zyklus.
 * Pan-/Lese-Zustand lebt in Refs (60fps, kein Re-Render pro Frame).
 * Wischen: Finger rechts = Vergangenheit, kein Momentum/Snap.
 * Ablesen: Touch ~300ms halten (dann scrubben) / Maus-Hover.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { de as deLocale } from 'date-fns/locale'
import {
  lerpLevel, panViewEnd, clampViewEnd, pickDayTicks,
  type ChartPoint, type MarkerPoint,
} from './chartMath'

const PAD = { top: 16, right: 10, bottom: 24, left: 40 } as const
const HOLD_MS = 300
const HOLD_MOVE_PX = 6
const MIN_PX_PER_TICK = 56

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function LiveCycleChartCanvas({
  points,
  doseMarkers,
  peakMarkers,
  accent,
  windowMs,
  height = 180,
}: {
  points: ChartPoint[]
  doseMarkers: MarkerPoint[]
  peakMarkers: MarkerPoint[]
  accent: string
  windowMs: number
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Daten in Refs (draw liest nur Refs → keine stale closures)
  const pointsRef = useRef(points)
  const doseRef = useRef(doseMarkers)
  const peakRef = useRef(peakMarkers)
  const accentRef = useRef(accent)
  const windowMsRef = useRef(windowMs)

  // Pan-/Lese-Zustand
  const viewEndRef = useRef(0)
  const followLiveRef = useRef(true)
  const isPanning = useRef(false)
  const panStartX = useRef(0)
  const panStartViewEnd = useRef(0)
  const holdTimer = useRef<number | null>(null)
  const isReadingRef = useRef(false)
  const readTsRef = useRef(0)
  const pointerTypeRef = useRef<string>('mouse')
  const drawRaf = useRef<number | null>(null)

  const [showJetzt, setShowJetzt] = useState(false)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const pts = pointsRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const cssW = wrap.offsetWidth
    const cssH = wrap.offsetHeight
    if (cssW < 10 || cssH < 10) return
    if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
      canvas.width = cssW * dpr
      canvas.height = cssH * dpr
    }
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)

    const dX = PAD.left, dY = PAD.top
    const dW = cssW - PAD.left - PAD.right
    const dH = cssH - PAD.top - PAD.bottom
    if (pts.length < 2) return

    const win = windowMsRef.current
    const now = pts[pts.length - 1].ts
    const viewEnd = viewEndRef.current
    const viewStart = viewEnd - win
    const tsToX = (ts: number) => dX + ((ts - viewStart) / win) * dW
    const lvToY = (lv: number) => dY + (1 - Math.max(0, Math.min(100, lv)) / 100) * dH

    const style = getComputedStyle(document.documentElement)
    const border = style.getPropertyValue('--border').trim() || 'rgba(255,255,255,0.06)'
    const muted = style.getPropertyValue('--text-muted').trim() || 'rgba(154,170,191,0.55)'
    const surface = style.getPropertyValue('--surface').trim() || 'rgba(6,10,24,0.92)'

    // Gridlines
    ctx.strokeStyle = border
    ctx.lineWidth = 1
    for (const lv of [0, 25, 50, 75, 100]) {
      const y = lvToY(lv)
      ctx.beginPath(); ctx.moveTo(dX, y); ctx.lineTo(dX + dW, y); ctx.stroke()
    }

    // X-Ticks
    const ticks = pickDayTicks(viewStart, viewEnd, dW, MIN_PX_PER_TICK)
    ctx.font = '9px ui-monospace,monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    for (const ts of ticks) {
      const x = tsToX(ts)
      if (x < dX - 2 || x > dX + dW + 2) continue
      ctx.strokeStyle = border
      ctx.beginPath(); ctx.moveTo(x, dY); ctx.lineTo(x, dY + dH); ctx.stroke()
      ctx.fillStyle = muted
      ctx.fillText(format(new Date(ts), 'EEE dd.', { locale: deLocale }), x, dY + dH + 4)
    }

    // Kurve + Marker (auf Plot geclippt)
    ctx.save()
    ctx.beginPath(); ctx.rect(dX, dY, dW, dH); ctx.clip()
    const buf = win * 0.05
    const vis = pts.filter(p => p.ts >= viewStart - buf && p.ts <= viewEnd + buf)
    if (vis.length >= 2) {
      const grad = ctx.createLinearGradient(0, dY, 0, dY + dH)
      grad.addColorStop(0, accentRef.current + '38')
      grad.addColorStop(1, accentRef.current + '00')
      ctx.beginPath()
      ctx.moveTo(tsToX(vis[0].ts), lvToY(vis[0].level))
      for (let i = 1; i < vis.length; i++) ctx.lineTo(tsToX(vis[i].ts), lvToY(vis[i].level))
      ctx.lineTo(tsToX(vis[vis.length - 1].ts), dY + dH)
      ctx.lineTo(tsToX(vis[0].ts), dY + dH)
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
      ctx.beginPath()
      ctx.moveTo(tsToX(vis[0].ts), lvToY(vis[0].level))
      for (let i = 1; i < vis.length; i++) ctx.lineTo(tsToX(vis[i].ts), lvToY(vis[i].level))
      ctx.strokeStyle = accentRef.current; ctx.lineWidth = 1.8; ctx.stroke()
    }
    for (const m of doseRef.current) {
      const x = tsToX(m.ts)
      if (x < dX - 6 || x > dX + dW + 6) continue
      ctx.beginPath(); ctx.arc(x, lvToY(m.level), 3, 0, Math.PI * 2)
      ctx.fillStyle = '#10b981'; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1
    }
    for (const m of peakRef.current) {
      const x = tsToX(m.ts)
      if (x < dX - 6 || x > dX + dW + 6) continue
      ctx.beginPath(); ctx.arc(x, lvToY(m.level), 3, 0, Math.PI * 2)
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.3; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1
    }
    ctx.restore()

    // Y-Maske (deckt Überlauf links) + Labels
    ctx.fillStyle = surface
    ctx.fillRect(0, 0, dX - 1, cssH)
    ctx.font = '9px ui-monospace,monospace'
    ctx.fillStyle = muted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (const lv of [0, 25, 50, 75, 100]) ctx.fillText(String(lv), dX - 5, lvToY(lv))
    ctx.save()
    ctx.translate(8, dY + dH / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = muted
    ctx.fillText('Spiegel %', 0, 0)
    ctx.restore()

    // "jetzt"-Label
    const nowX = tsToX(now)
    if (nowX >= dX && nowX <= dX + dW) {
      ctx.fillStyle = '#00ccf5'
      ctx.font = '8px ui-monospace,monospace'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText('jetzt', Math.min(nowX, dX + dW), dY - 2)
    }

    // Ables-Linie
    if (isReadingRef.current) {
      const ts = Math.max(viewStart, Math.min(viewEnd, readTsRef.current))
      const x = tsToX(ts)
      const lv = lerpLevel(pts, ts)
      const y = lvToY(lv)
      ctx.strokeStyle = 'rgba(226,232,240,0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([3, 2])
      ctx.beginPath(); ctx.moveTo(x, dY); ctx.lineTo(x, dY + dH); ctx.stroke()
      ctx.setLineDash([])
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2)
      ctx.fillStyle = surface; ctx.fill()
      ctx.strokeStyle = accentRef.current; ctx.lineWidth = 2; ctx.stroke()

      const label = format(new Date(ts), 'EEE dd.MM · HH:mm', { locale: deLocale })
      const valStr = lv.toFixed(1) + '%'
      ctx.font = '9px ui-monospace,monospace'
      const chipW = Math.max(ctx.measureText(label).width, 40) + 16
      const chipH = 34
      let cx = x + 8
      if (cx + chipW > dX + dW) cx = x - 8 - chipW
      const cy = dY + 2
      ctx.fillStyle = 'rgba(7,9,26,0.95)'
      ctx.strokeStyle = accentRef.current + '66'
      ctx.lineWidth = 1
      roundRect(ctx, cx, cy, chipW, chipH, 8)
      ctx.fill(); ctx.stroke()
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillStyle = muted; ctx.fillText(label, cx + 8, cy + 6)
      ctx.fillStyle = accentRef.current
      ctx.font = '12px ui-monospace,monospace'
      ctx.fillText(valStr, cx + 8, cy + 18)
    }
  }, [])

  const scheduleRedraw = useCallback(() => {
    if (drawRaf.current) cancelAnimationFrame(drawRaf.current)
    drawRaf.current = requestAnimationFrame(draw)
  }, [draw])

  // Props → Refs synchronisieren, Anker pflegen, neu zeichnen
  useEffect(() => {
    pointsRef.current = points
    doseRef.current = doseMarkers
    peakRef.current = peakMarkers
    accentRef.current = accent
    windowMsRef.current = windowMs
    if (points.length) {
      const now = points[points.length - 1].ts
      const start = points[0].ts
      if (followLiveRef.current) viewEndRef.current = now
      viewEndRef.current = clampViewEnd(viewEndRef.current, start, now, windowMs)
      setShowJetzt(!followLiveRef.current)
    }
    scheduleRedraw()
  }, [points, doseMarkers, peakMarkers, accent, windowMs, scheduleRedraw])

  // ResizeObserver
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(scheduleRedraw)
    ro.observe(el)
    return () => ro.disconnect()
  }, [scheduleRedraw])

  const clientXToTs = (clientX: number) => {
    const wrap = wrapRef.current
    if (!wrap) return viewEndRef.current
    const rect = wrap.getBoundingClientRect()
    const dW = rect.width - PAD.left - PAD.right
    const frac = Math.max(0, Math.min(1, (clientX - rect.left - PAD.left) / dW))
    return (viewEndRef.current - windowMsRef.current) + frac * windowMsRef.current
  }

  const onPointerDown = (e: React.PointerEvent) => {
    pointerTypeRef.current = e.pointerType
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    isPanning.current = true
    panStartX.current = e.clientX
    panStartViewEnd.current = viewEndRef.current
    if (e.pointerType !== 'mouse') {
      if (holdTimer.current) clearTimeout(holdTimer.current)
      const cx = e.clientX
      holdTimer.current = window.setTimeout(() => {
        isReadingRef.current = true
        readTsRef.current = clientXToTs(cx)
        scheduleRedraw()
      }, HOLD_MS)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    // Maus-Hover (kein Knopf gedrückt) → ablesen
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      isReadingRef.current = true
      readTsRef.current = clientXToTs(e.clientX)
      scheduleRedraw()
      return
    }
    if (!isPanning.current) return
    if (isReadingRef.current) {
      readTsRef.current = clientXToTs(e.clientX)
      scheduleRedraw()
      return
    }
    const dx = e.clientX - panStartX.current
    if (Math.abs(dx) > HOLD_MOVE_PX && holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    const pts = pointsRef.current
    if (!pts.length) return
    const now = pts[pts.length - 1].ts
    const start = pts[0].ts
    const wrap = wrapRef.current
    const dW = (wrap?.offsetWidth ?? 320) - PAD.left - PAD.right
    const ve = clampViewEnd(
      panViewEnd(panStartViewEnd.current, dx, dW, windowMsRef.current),
      start, now, windowMsRef.current,
    )
    viewEndRef.current = ve
    followLiveRef.current = ve >= now - 1000
    setShowJetzt(!followLiveRef.current)
    scheduleRedraw()
  }

  const endInteraction = () => {
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null }
    isPanning.current = false
    if (isReadingRef.current && pointerTypeRef.current !== 'mouse') {
      isReadingRef.current = false
      scheduleRedraw()
    }
  }

  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') {
      isReadingRef.current = false
      scheduleRedraw()
    }
  }

  const jumpToNow = () => {
    const pts = pointsRef.current
    if (!pts.length) return
    followLiveRef.current = true
    viewEndRef.current = pts[pts.length - 1].ts
    setShowJetzt(false)
    scheduleRedraw()
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={wrapRef}
        style={{ height, touchAction: 'pan-y', userSelect: 'none', cursor: 'crosshair' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onPointerLeave={onPointerLeave}
      >
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
      {showJetzt && (
        <button
          type="button"
          onClick={jumpToNow}
          style={{
            position: 'absolute', top: 0, right: 2,
            fontSize: '0.52rem', fontWeight: 800, color: accent,
            background: `${accent}15`, border: `1px solid ${accent}25`,
            borderRadius: 6, padding: '2px 6px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Jetzt ↩
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript prüfen**

Run: `npx tsc --noEmit`
Expected: Keine Fehler in `LiveCycleChartCanvas.tsx` / `chartMath.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/components/liveCycleChart/LiveCycleChartCanvas.tsx
git commit -m "feat: add LiveCycleChartCanvas component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `LiveCycleCard` auf die Canvas-Komponente umstellen

**Files:**
- Modify: `src/pages/BlutspiegelSimulation.tsx` (Komponente `LiveCycleCard`, ca. Zeilen 366–747)

Kontext: `LiveCycleCard` nutzt aktuell Recharts (`ComposedChart` …) plus Recharts-spezifische State/Refs/Memos und eigene Pan-Handler. Diese werden überflüssig und durch `LiveCycleChartCanvas` ersetzt. `curve`, `events`, `curveLoading` und das Fallback (Sparkline ohne Einnahmen) bleiben.

- [ ] **Step 1: Import ergänzen**

Im Import-Block oben in `src/pages/BlutspiegelSimulation.tsx` ergänzen:

```ts
import { LiveCycleChartCanvas } from '../components/liveCycleChart/LiveCycleChartCanvas'
import { lerpLevel } from '../components/liveCycleChart/chartMath'
```

- [ ] **Step 2: Live-Intervall 60 s → 10 s**

In `LiveCycleCard`, im Effekt „Live-Wachstum" (`window.setInterval(... , 60_000)`), den Wert auf `10_000` ändern:

```ts
    const id = window.setInterval(() => {
      setCurve(calculateHistoryBlutspiegelCurve(
        events, pk.half_life_hours, pk.tmax_hours, pk.bioavailability_sc,
      ))
    }, 10_000)
```

- [ ] **Step 3: Überflüssige Recharts-State/Refs/Memos entfernen und Marker (ungefiltert) neu definieren**

In `LiveCycleCard` **entfernen**:
- `const [windowOffsetHours, setWindowOffsetHours] = useState(0)`
- `const chartRef = useRef<HTMLDivElement>(null)`
- `const panStartX = useRef<number | null>(null)`
- `const panStartOff = useRef(0)`
- `const isPanning = useRef(false)`
- `const rafId = useRef<number | null>(null)`
- die Memos `windowDomain`, `tickList`, `maxOffset`
- die Callbacks `handlePanStart`, `handlePanMove`, `handlePanEnd`
- `const formatTick = useCallback(...)`

Die bestehenden `chartData`, `visibleIntakeMarkers`, `visiblePeakMarkers` durch ungefilterte Marker-Memos **ersetzen** (das Fenster-Clipping macht jetzt die Canvas-Komponente):

```ts
  // Volle Kurve als Chart-Daten
  const chartData = useMemo(
    () => curve.map(p => ({ ts: p.time.getTime(), level: p.level })),
    [curve],
  )

  // Einnahme-Marker (alle, ungefiltert)
  const doseMarkers = useMemo(
    () => events
      .filter(ev => ev.status === 'taken')
      .map(ev => ({ ts: ev.timestamp.getTime(), level: lerpLevel(chartData, ev.timestamp.getTime()) })),
    [events, chartData],
  )

  // Peak-Marker je Dosis (Injektion + Tmax), alle, ungefiltert
  const peakMarkers = useMemo(
    () => events
      .filter(ev => ev.status === 'taken')
      .map(ev => {
        const peakTs = ev.timestamp.getTime() + pk.tmax_hours * 3_600_000
        return { ts: peakTs, level: lerpLevel(chartData, peakTs) }
      }),
    [events, chartData, pk.tmax_hours],
  )
```

Hinweis: `levelAtTime` (Datei-lokale Funktion) wird hier nicht mehr von `LiveCycleCard` benutzt; sie bleibt aber bestehen, falls andere Stellen sie nutzen — vor dem Entfernen prüfen (siehe Step 6).

- [ ] **Step 4: Chart-JSX ersetzen**

Den gesamten `hasCurve ? ( … ) : ( … )`-Block im „Chart-Bereich" so ersetzen, dass der `true`-Zweig (Nav-Zeile, Fortschrittsbalken, Legende, Wisch-Container mit `ResponsiveContainer`/`ComposedChart`) durch Folgendes ersetzt wird (Legende bleibt, Recharts-Teil raus):

```tsx
        ) : hasCurve ? (
          <>
            {/* Hinweis */}
            <p style={{ fontSize: '0.52rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 4 }}>
              7-Tage-Fenster · wischen für Verlauf · halten zum Ablesen
            </p>

            {/* Legende */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>Einnahme</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', border: '1.5px solid #f59e0b', display: 'inline-block', boxSizing: 'border-box' }} />
                <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>Peak</span>
              </div>
            </div>

            <LiveCycleChartCanvas
              points={chartData}
              doseMarkers={doseMarkers}
              peakMarkers={peakMarkers}
              accent={accent}
              windowMs={WINDOW_HOURS * 3_600_000}
              height={180}
            />
          </>
        ) : (
```

Der Fallback-Zweig (Sparkline „Einnahmen im Kalender bestätigen …") bleibt unverändert.

- [ ] **Step 5: Nicht mehr genutzte Recharts-Imports prüfen/entfernen**

Prüfen, ob `ComposedChart`, `Area`, `Scatter`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `HistoryChartTooltip` noch an anderer Stelle der Datei verwendet werden.

Run: `npx grep -n "ComposedChart\|<Scatter\|<XAxis\|HistoryChartTooltip" src/pages/BlutspiegelSimulation.tsx` (oder Editor-Suche)

- `AreaChart` / `Area` werden im Fallback-Sparkline weiter genutzt → **behalten**.
- Nur Imports entfernen, die **nirgends** mehr vorkommen. Im Zweifel behalten — Aufräumen ist nicht das Ziel dieser Aufgabe.

- [ ] **Step 6: Verwaiste Datei-Helfer prüfen**

`levelAtTime` und `HistoryChartTooltip` waren ggf. nur für die alte Recharts-Karte da.

Run: Editor-Suche nach `levelAtTime(` und `HistoryChartTooltip` in `src/pages/BlutspiegelSimulation.tsx`.
- Wenn **keine** Verwendung mehr übrig ist, die jeweilige Funktion entfernen (Orphan durch diese Änderung).
- Wenn noch verwendet, **stehen lassen**.

- [ ] **Step 7: Tests, Typecheck und Build**

Run: `npm test`
Expected: Alle chartMath-Tests PASS.

Run: `npm run build`
Expected: `tsc -b` ohne Fehler, Vite-Build erfolgreich (keine ungenutzten Imports, die ESLint/TS als Fehler werten).

- [ ] **Step 8: Visuelle Verifikation im Preview**

Run: `npm run dev` und die Blutspiegel-Simulation-Seite öffnen (Zyklus mit bestätigten Einnahmen + PK-Profil nötig).
Prüfen:
- Wischen ist flüssig, ohne Ruckeln, ohne Nachschwingen/Einrasten.
- Finger nach rechts → Vergangenheit; bis zur ersten Einnahme scrollbar; nicht über „jetzt" hinaus.
- „Jetzt ↩" erscheint beim Zurückscrollen und springt korrekt zurück.
- Halten (~0,3 s) zeigt die Ables-Linie mit Datum · Uhrzeit · %-Wert, läuft beim Bewegen mit; Maus-Hover zeigt sie am Desktop direkt.
- Marker dezent (kleiner grüner Punkt, feiner oranger Ring); Achsen lesbar, X-Ticks ohne Überlappung.
- Nach ~10 s wächst die Kurve am rechten Rand; beim Zurückscrollen bleibt der Ausschnitt stabil.

- [ ] **Step 9: Commit**

```bash
git add src/pages/BlutspiegelSimulation.tsx
git commit -m "feat: render LiveCycleCard chart on canvas with smooth pan, hold-to-read, 10s live growth

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (durchgeführt)

**Spec-Abdeckung:**
- Flüssiges Wischen / kein Snap → Task 5 (Refs + rAF, kein Momentum) ✓
- Wischrichtung Finger rechts = Vergangenheit → Task 3 `panViewEnd` + Tests ✓
- Bis Zyklusstart zurück → Task 3 `clampViewEnd` (untere Grenze = erster Punkt + Fenster) ✓
- Live alle 10 s → Task 6 Step 2 ✓
- Halten zum Ablesen + exakter Wert → Task 5 (Hold-Timer + `lerpLevel`) ✓
- Dezente Marker → Task 5 (r≈3 Punkt, dünner Ring) ✓
- Achsen beschriftet, X-Ticks ohne Überlappung → Task 4 `pickDayTicks` + Task 5 (Y-Labels/Titel) ✓
- Anker beim Live-Tick → Task 5 (`followLiveRef` + `clampViewEnd`) ✓

**Platzhalter-Scan:** Keine TBD/TODO; alle Code-Schritte mit vollständigem Code. ✓

**Typ-Konsistenz:** `ChartPoint`/`MarkerPoint`, `lerpLevel`, `panViewEnd`, `clampViewEnd`, `pickDayTicks` einheitlich zwischen `chartMath.ts`, Tests und `LiveCycleChartCanvas` benannt; Props der Komponente (`points`, `doseMarkers`, `peakMarkers`, `accent`, `windowMs`, `height`) stimmen mit der Verwendung in Task 6 überein. ✓
