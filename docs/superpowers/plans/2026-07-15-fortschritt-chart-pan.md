# Fortschritt-Chart: 30T/3M-Fenster mit Pan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Verlaufs-Chart zeigt nur noch ein 30T- oder 3M-Fenster; ältere Daten erreicht man durch Wischen nach rechts, mit dem Gestenverhalten des Blutspiegel-Charts.

**Architecture:** Recharts bleibt. Ein `viewEnd`-State treibt `XAxis domain={[viewStart, viewEnd]}` mit `allowDataOverflow`; die Serie wird über den vollen Datenbereich gebaut und nur durch die Domain zugeschnitten. Die Pan-Mathematik kommt unverändert aus `src/components/liveCycleChart/chartMath.ts`; die Geste kapselt ein neuer Hook `useChartPan`.

**Tech Stack:** React 19, Recharts 3.8, date-fns 4, Vitest 3, Capacitor Haptics.

**Spec:** `docs/superpowers/specs/2026-07-15-fortschritt-chart-pan-design.md`

---

## File Structure

**Neu:**

| Datei | Verantwortung |
|---|---|
| `src/features/fortschritt/lib/chartWindow.ts` | Fenstergrößen (30T/3M), Default, Umrechnung `DateRange` → Timestamps. Pur, testbar. |
| `src/features/fortschritt/lib/chartWindow.test.ts` | Tests dazu. |
| `src/features/fortschritt/hooks/useChartPan.ts` | Die Geste: Pan, 300-ms-Hold-zum-Ablesen, Haptik, rAF-Drosselung. |
| `src/features/fortschritt/components/verlauf/ChartWindowToggle.tsx` | 30T/3M-Segmented-Control. |
| `src/features/fortschritt/components/verlauf/JumpToNowButton.tsx` | „Jetzt"-Button, sichtbar wenn in der Vergangenheit. |

**Geändert:**

| Datei | Änderung |
|---|---|
| `src/features/fortschritt/components/verlauf/MetricChart.tsx` | Domain-Pan, Tick-Raster, Wrapper-Handler, Fenster-Umschalter, Ref-Handle |
| `src/features/fortschritt/components/verlauf/VerlaufSection.tsx` | Fenster-State, Fokus-Sprung, entkoppelt von `pageRange` |
| `src/features/fortschritt/components/FortschrittDashboard.tsx` | `onRangeLockedChange` entfernen |
| `src/features/fortschritt/FortschrittPage.tsx` | `rangeLocked` entfernen |
| `src/features/fortschritt/components/StickyRangeBar.tsx` | `disabled`-Prop entfernen |
| `src/features/fortschritt/lib/verlaufRange.ts` | `focusRangeForSubstance` entfernen |

**Wichtig:** `MetricChart.tsx` ist schon heute ~420 Zeilen. Die zwei neuen UI-Elemente kommen deshalb als eigene Dateien daneben — analog zum bestehenden `ChartSettingsButton.tsx` / `MetricChipBar.tsx`.

**Testbarkeit:** Das Projekt hat kein `@testing-library/react`. Getestet werden nur pure Funktionen (Vitest). Hook und Komponenten werden am Dev-Server verifiziert (Task 6).

---

### Task 1: Fenster-Definitionen (`chartWindow.ts`)

**Files:**
- Create: `src/features/fortschritt/lib/chartWindow.ts`
- Test: `src/features/fortschritt/lib/chartWindow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/fortschritt/lib/chartWindow.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  CHART_WINDOWS,
  DEFAULT_CHART_WINDOW,
  windowMsFor,
  rangeBounds,
} from './chartWindow'

const DAY = 24 * 3_600_000

describe('CHART_WINDOWS', () => {
  it('bietet genau 30T und 3M', () => {
    expect(CHART_WINDOWS.map(w => w.key)).toEqual(['30t', '3m'])
    expect(CHART_WINDOWS.map(w => w.label)).toEqual(['30T', '3M'])
  })

  it('Default ist 3M', () => {
    expect(DEFAULT_CHART_WINDOW).toBe('3m')
  })
})

describe('windowMsFor', () => {
  it('30T sind 30 Tage', () => {
    expect(windowMsFor('30t')).toBe(30 * DAY)
  })

  it('3M sind 90 Tage', () => {
    expect(windowMsFor('3m')).toBe(90 * DAY)
  })
})

describe('rangeBounds', () => {
  it('wandelt from/to in Timestamps um', () => {
    const { start, now } = rangeBounds({ from: '2026-01-01', to: '2026-01-31' })
    expect(now - start).toBe(30 * DAY)
  })

  it('klemmt now nicht unter start', () => {
    const { start, now } = rangeBounds({ from: '2026-02-01', to: '2026-01-01' })
    expect(now).toBe(start)
  })

  it('faellt bei kaputtem Datum auf einen gueltigen Bereich zurueck', () => {
    const { start, now } = rangeBounds({ from: 'quatsch', to: 'quatsch' })
    expect(Number.isFinite(start)).toBe(true)
    expect(now).toBeGreaterThanOrEqual(start)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/fortschritt/lib/chartWindow.test.ts`
Expected: FAIL — `Failed to resolve import "./chartWindow"`

- [ ] **Step 3: Write minimal implementation**

Create `src/features/fortschritt/lib/chartWindow.ts`:

```ts
import type { DateRange } from '../types'
import { dayToTsSafe } from './dates'

const DAY_MS = 24 * 3_600_000

export type ChartWindowKey = '30t' | '3m'

export const DEFAULT_CHART_WINDOW: ChartWindowKey = '3m'

export const CHART_WINDOWS: { key: ChartWindowKey; label: string; days: number }[] = [
  { key: '30t', label: '30T', days: 30 },
  { key: '3m', label: '3M', days: 90 },
]

/** Fensterbreite in ms. Unbekannter Key → Default-Fenster. */
export function windowMsFor(key: ChartWindowKey): number {
  const def = CHART_WINDOWS.find(w => w.key === key)
    ?? CHART_WINDOWS.find(w => w.key === DEFAULT_CHART_WINDOW)!
  return def.days * DAY_MS
}

/**
 * Datengrenzen des Charts als Timestamps (12:00, wie die Punkte im Chart).
 * `now` ist nie kleiner als `start`, damit clampViewEnd nicht kippt.
 */
export function rangeBounds(range: DateRange): { start: number; now: number } {
  const fallback = Date.now()
  const start = dayToTsSafe(range.from, 12) ?? fallback
  const to = dayToTsSafe(range.to, 12) ?? fallback
  return { start, now: Math.max(start, to) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/fortschritt/lib/chartWindow.test.ts`
Expected: PASS — 6 Tests grün

- [ ] **Step 5: Commit**

```bash
git add src/features/fortschritt/lib/chartWindow.ts src/features/fortschritt/lib/chartWindow.test.ts
git commit -m "feat(fortschritt): 30T/3M-Fensterdefinitionen für den Verlaufs-Chart"
```

---

### Task 2: UI-Bausteine (Umschalter + Jetzt-Button)

Zwei kleine, zustandslose Komponenten. Keine Unit-Tests (reines Markup, kein Renderer im Projekt) — Sichtprüfung in Task 6.

**Files:**
- Create: `src/features/fortschritt/components/verlauf/ChartWindowToggle.tsx`
- Create: `src/features/fortschritt/components/verlauf/JumpToNowButton.tsx`

- [ ] **Step 1: Fenster-Umschalter anlegen**

Create `src/features/fortschritt/components/verlauf/ChartWindowToggle.tsx`. Die Chip-Optik ist bewusst von `StickyRangeBar.tsx:50-60` übernommen, damit beide Regler gleich aussehen:

```tsx
import { CHART_WINDOWS, type ChartWindowKey } from '../../lib/chartWindow'

interface Props {
  value: ChartWindowKey
  onChange: (key: ChartWindowKey) => void
}

/** 30T/3M-Umschalter für das Sichtfenster des Verlaufs-Charts. */
export function ChartWindowToggle({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {CHART_WINDOWS.map(win => {
        const on = value === win.key
        return (
          <button
            key={win.key}
            type="button"
            onClick={() => onChange(win.key)}
            aria-pressed={on}
            style={{
              padding: '3px 9px',
              borderRadius: 8,
              fontSize: '0.6rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: on ? 'var(--accent-weak)' : 'transparent',
              color: on ? 'var(--accent)' : 'var(--text-muted)',
              border: on ? '1px solid var(--accent-border)' : '1px solid var(--border)',
            }}
          >
            {win.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Jetzt-Button anlegen**

Create `src/features/fortschritt/components/verlauf/JumpToNowButton.tsx`:

```tsx
interface Props {
  onClick: () => void
}

/** Springt aus der Vergangenheit zurück ans rechte Ende des Verlaufs. */
export function JumpToNowButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        position: 'absolute',
        right: 12,
        bottom: 10,
        zIndex: 3,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: '0.6rem',
        fontWeight: 800,
        cursor: 'pointer',
        background: 'var(--accent-weak)',
        color: 'var(--accent)',
        border: '1px solid var(--accent-border)',
      }}
    >
      Jetzt
    </button>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add src/features/fortschritt/components/verlauf/ChartWindowToggle.tsx src/features/fortschritt/components/verlauf/JumpToNowButton.tsx
git commit -m "feat(fortschritt): Fenster-Umschalter und Jetzt-Button für den Verlaufs-Chart"
```

---

### Task 3: Die Geste (`useChartPan`)

**Files:**
- Create: `src/features/fortschritt/hooks/useChartPan.ts`

Der Hook spiegelt `LiveCycleChartCanvas.tsx:400-503`, zeichnet aber nichts: `viewEnd` lebt in einer Ref (60 fps ohne Re-Render), und nur ein rAF pro Frame schiebt den Wert in den State, der die Recharts-Domain treibt.

- [ ] **Step 1: Hook anlegen**

Create `src/features/fortschritt/hooks/useChartPan.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  clampViewEnd,
  panHapticStepMs,
  panViewEnd,
} from '../../../components/liveCycleChart/chartMath'
import { hapticTick } from '../../../lib/haptics'

const HOLD_MS = 300
const HOLD_MOVE_PX = 6
const MIN_PX_PER_TICK = 52

interface Args {
  /** Ältester Datenpunkt als Timestamp. */
  dataStart: number
  /** Rechter Anschlag (heute) als Timestamp. */
  now: number
  /** Breite des Sichtfensters in ms. */
  windowMs: number
  /** Ables-Position an den ChartPointerContext melden (null = aus). */
  onPointerX: (x: number | null) => void
}

export interface ChartPanHandle {
  jumpToNow: () => void
  jumpToTs: (ts: number) => void
}

/**
 * Pan-/Lese-Geste für den Verlaufs-Chart — gleiche Mathematik und gleiches
 * Verhalten wie der Blutspiegel-Chart: Finger rechts = Vergangenheit, kein
 * Momentum, Touch ~300ms halten = ablesen, Maus-Hover = ablesen.
 */
export function useChartPan({ dataStart, now, windowMs, onPointerX }: Args) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const viewEndRef = useRef(now)
  const followNowRef = useRef(true)
  const [viewEnd, setViewEnd] = useState(now)

  const rafRef = useRef<number | null>(null)
  const isPanning = useRef(false)
  const isReading = useRef(false)
  const panStartX = useRef(0)
  const panStartViewEnd = useRef(0)
  const holdTimer = useRef<number | null>(null)
  const lastHapticTick = useRef<number | null>(null)

  // Nur ein State-Update pro Frame — Recharts rendert das SVG sonst pro Move-Event neu.
  const commit = useCallback(() => {
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      setViewEnd(viewEndRef.current)
    })
  }, [])

  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    if (holdTimer.current != null) clearTimeout(holdTimer.current)
  }, [])

  // Datengrenzen oder Fenstergröße geändert → Anker nachziehen.
  useEffect(() => {
    if (followNowRef.current) viewEndRef.current = now
    viewEndRef.current = clampViewEnd(viewEndRef.current, dataStart, now, windowMs)
    setViewEnd(viewEndRef.current)
  }, [dataStart, now, windowMs])

  const localX = useCallback((clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return rect ? clientX - rect.left : 0
  }, [])

  const stopReading = useCallback(() => {
    if (holdTimer.current != null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (isReading.current) {
      isReading.current = false
      onPointerX(null)
    }
  }, [onPointerX])

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    isPanning.current = true
    panStartX.current = e.clientX
    panStartViewEnd.current = viewEndRef.current
    lastHapticTick.current = null

    if (e.pointerType === 'mouse') {
      // Maus: Drücken startet Pan → Hover-Ablesen beenden
      isReading.current = false
      onPointerX(null)
      return
    }
    // Touch/Pen: ~300ms halten → Ablesen
    if (holdTimer.current != null) clearTimeout(holdTimer.current)
    const cx = e.clientX
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      isReading.current = true
      onPointerX(localX(cx))
    }, HOLD_MS)
  }, [localX, onPointerX])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    // Maus-Hover ohne gedrückte Taste → ablesen
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      isReading.current = true
      onPointerX(localX(e.clientX))
      return
    }
    if (!isPanning.current) return
    if (isReading.current) {
      onPointerX(localX(e.clientX))
      return
    }

    const dx = e.clientX - panStartX.current
    if (Math.abs(dx) > HOLD_MOVE_PX && holdTimer.current != null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }

    const width = wrapRef.current?.offsetWidth ?? 320
    const ve = clampViewEnd(
      panViewEnd(panStartViewEnd.current, dx, width, windowMs),
      dataStart, now, windowMs,
    )
    viewEndRef.current = ve
    followNowRef.current = ve >= now - 1000
    commit()

    const stepMs = panHapticStepMs(ve - windowMs, ve, width, MIN_PX_PER_TICK)
    const tickIdx = Math.floor(ve / stepMs)
    if (lastHapticTick.current !== null && lastHapticTick.current !== tickIdx) {
      void hapticTick()
    }
    lastHapticTick.current = tickIdx
  }, [commit, dataStart, localX, now, onPointerX, windowMs])

  const endInteraction = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    isPanning.current = false
    if (e.pointerType !== 'mouse') stopReading()
    else if (holdTimer.current != null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [stopReading])

  const onPointerLeave = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      isReading.current = false
      onPointerX(null)
    }
  }, [onPointerX])

  const jumpToNow = useCallback(() => {
    followNowRef.current = true
    viewEndRef.current = now
    setViewEnd(now)
  }, [now])

  const jumpToTs = useCallback((ts: number) => {
    // Ziel-Zeitpunkt links im Fenster zeigen (wie jumpToStart beim Blutspiegel).
    const ve = clampViewEnd(ts + windowMs, dataStart, now, windowMs)
    followNowRef.current = ve >= now - 1000
    viewEndRef.current = ve
    setViewEnd(ve)
  }, [dataStart, now, windowMs])

  return {
    wrapRef,
    viewStart: viewEnd - windowMs,
    viewEnd,
    showJetzt: viewEnd < now - 1000,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endInteraction,
      onPointerCancel: endInteraction,
      onPointerLeave,
    },
    jumpToNow,
    jumpToTs,
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: keine Fehler

- [ ] **Step 3: Commit**

```bash
git add src/features/fortschritt/hooks/useChartPan.ts
git commit -m "feat(fortschritt): useChartPan — Wisch- und Lesegeste für den Verlaufs-Chart"
```

---

### Task 4: `MetricChart` auf Pan umbauen

**Files:**
- Modify: `src/features/fortschritt/components/verlauf/MetricChart.tsx`

Fünf Änderungen: Props, Provider-Hoisting, Domain + Ticks, Bänder aufs Fenster klemmen, Gesten-Wrapper.

- [ ] **Step 1: Importe und Props anpassen**

In `MetricChart.tsx` die Import-Blöcke (Zeilen 1-29) ersetzen durch:

```tsx
import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { format } from 'date-fns'
import { dayToTsSafe, formatDaySafe } from '../../lib/dates'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  usePlotArea,
  XAxis,
  YAxis,
} from 'recharts'
import type { CycleSubstance, DateRange, MetricKey, OngoingSubstance } from '../../types'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import { buildMetricSeries, computeDelta } from '../../lib/metrics'
import type { BloodworkEntry, DailyLogEntry, WeightLogEntry } from '../../types'
import { substanceBarEnd } from '../../lib/focusSummary'
import { assignLanes, laneCount } from '../../lib/cycleLanes'
import { CycleBandLayer, type CycleBandDraw } from './CycleBandLayer'
import {
  ChartPointerProvider,
  useChartPointerSetter,
  useChartPointerX,
} from './ChartPointerContext'
import { FluidCursorLayer } from './FluidCursorLayer'
import { MetricTooltip } from './MetricTooltip'
import { buildTooltipSnapDates } from '../../lib/chartTooltip'
import { panel } from '../../styles'
import { ChartSettingsButton } from './ChartSettingsButton'
import { ChartWindowToggle } from './ChartWindowToggle'
import { JumpToNowButton } from './JumpToNowButton'
import { MetricChipBar } from './MetricChipBar'
import { rangeBounds, windowMsFor, type ChartWindowKey } from '../../lib/chartWindow'
import { useChartPan, type ChartPanHandle } from '../../hooks/useChartPan'
import { pickChartTimeTicks } from '../../../../components/liveCycleChart/chartMath'
```

`getRelativeCoordinate` und die Typen `MouseEvent`/`TouchEvent` fallen weg — die Pointer-Behandlung liegt ab jetzt im Wrapper.

Die `Props`-Schnittstelle (Zeilen 31-45) ersetzen durch:

```tsx
interface Props {
  /** Voller Datenbereich — das Fenster schneidet daraus zu. */
  dataRange: DateRange
  windowKey: ChartWindowKey
  onWindowChange: (key: ChartWindowKey) => void
  metric: MetricDefinition
  availableMetrics: MetricDefinition[]
  metricKey: MetricKey
  pointCounts: Map<string, number>
  onSelectMetric: (key: MetricKey) => void
  weights: WeightLogEntry[]
  dailyLogs: DailyLogEntry[]
  bloodwork: BloodworkEntry[]
  cycles: CycleSubstance[]
  ongoing: OngoingSubstance[]
  focusId: string | null
  onOpenSettings?: () => void
}

export type { ChartPanHandle }
```

- [ ] **Step 2: `buildTimeTicks` und die Pointer-Leser löschen**

Die Funktionen `buildTimeTicks` (Zeilen 55-61), `readMousePointerX` (75-78) und `readTouchPointerX` (80-94) ersatzlos entfernen. `pickChartTimeTicks` und der Wrapper ersetzen sie.

`fmtDate`, `dateToTs`, `formatAxisValue` und `formatTooltipValue` bleiben unverändert.

- [ ] **Step 3: `MetricChartBody` auf die Fenster-Domain umstellen**

`ChartBodyProps` und `MetricChartBody` (Zeilen 96-193) ersetzen durch:

```tsx
const MIN_PX_PER_TICK = 52

interface ChartBodyProps {
  lineData: Array<{ ts: number; date: string; label: string; value: number }>
  snapDates: string[]
  bands: CycleBandDraw[]
  lanes: number
  metric: MetricDefinition
  viewStart: number
  viewEnd: number
}

function MetricChartBody({
  lineData,
  snapDates,
  bands,
  lanes,
  metric,
  viewStart,
  viewEnd,
}: ChartBodyProps) {
  const pointerX = useChartPointerX()
  const plotArea = usePlotArea()

  // Kalendertage im Raster — wandern beim Wischen mit der Kurve.
  const xTicks = useMemo(
    () => pickChartTimeTicks(viewStart, viewEnd, plotArea?.width ?? 300, MIN_PX_PER_TICK),
    [viewStart, viewEnd, plotArea?.width],
  )

  return (
    <LineChart data={lineData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
      <XAxis
        dataKey="ts"
        type="number"
        domain={[viewStart, viewEnd]}
        allowDataOverflow
        ticks={xTicks}
        tickFormatter={ts => fmtDate(format(new Date(ts), 'yyyy-MM-dd'))}
        tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
        tickLine={false}
        axisLine={false}
      />
      <YAxis
        yAxisId="metric"
        tickFormatter={v => formatAxisValue(Number(v), metric.unit)}
        tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
        tickLine={false}
        axisLine={false}
        width={40}
      />

      <CycleBandLayer bands={bands} lanes={lanes} snapDates={snapDates} />
      <FluidCursorLayer snapDates={snapDates} />

      <Tooltip
        active={pointerX != null}
        position={pointerX != null && plotArea
          ? { x: pointerX, y: plotArea.y + 8 }
          : undefined}
        shared
        cursor={false}
        isAnimationActive={false}
        content={(props) => (
          <MetricTooltip
            {...props}
            bands={bands}
            metric={metric}
            metricData={lineData}
            snapDates={snapDates}
          />
        )}
      />
      <Line
        yAxisId="metric"
        type="monotone"
        dataKey="value"
        name="value"
        stroke={metric.color}
        strokeWidth={2.5}
        dot={{ r: 3, fill: '#07091a', stroke: metric.color, strokeWidth: 2 }}
        connectNulls={!metric.isLab}
        isAnimationActive={false}
      />
    </LineChart>
  )
}
```

Die Y-Achse bekommt **bewusst kein** `domain`: Recharts leitet sie aus `lineData` ab, und das ist jetzt der volle Datenbereich — dadurch steht die Skala beim Wischen still. (Falls sie sich am Gerät doch bewegt: `domain={['dataMin', 'dataMax']}` explizit setzen.)

`CycleLegend` (Zeilen 195-251) bleibt unverändert.

- [ ] **Step 4: `MetricChart` als Provider-Hülle + Inner-Komponente**

Die gesamte `export function MetricChart` (Zeilen 253-417) ersetzen durch:

```tsx
export const MetricChart = forwardRef<ChartPanHandle, Props>(
function MetricChart(props, ref) {
  // Der Gesten-Wrapper muss den Pointer-Setter erreichen → Provider liegt außen.
  return (
    <ChartPointerProvider>
      <MetricChartInner {...props} ref={ref} />
    </ChartPointerProvider>
  )
})

const MetricChartInner = forwardRef<ChartPanHandle, Props>(
function MetricChartInner({
  dataRange,
  windowKey,
  onWindowChange,
  metric,
  availableMetrics,
  metricKey,
  pointCounts,
  onSelectMetric,
  weights,
  dailyLogs,
  bloodwork,
  cycles,
  ongoing,
  focusId,
  onOpenSettings,
}, ref) {
  const setPointerX = useChartPointerSetter()
  const { start: dataStart, now } = useMemo(() => rangeBounds(dataRange), [dataRange])
  const windowMs = windowMsFor(windowKey)

  const {
    wrapRef, viewStart, viewEnd, showJetzt, handlers, jumpToNow, jumpToTs,
  } = useChartPan({ dataStart, now, windowMs, onPointerX: setPointerX })

  useImperativeHandle(ref, () => ({ jumpToNow, jumpToTs }), [jumpToNow, jumpToTs])

  // Serie über den vollen Bereich — die Domain schneidet die Anzeige zu.
  const series = buildMetricSeries(metric.key, dataRange, weights, dailyLogs, bloodwork)

  const { bands, lanes } = useMemo(() => {
    const substances = [
      ...cycles.map(c => ({ substance: c, filled: true })),
      ...ongoing.map(o => ({ substance: o, filled: false })),
    ]

    const raw = substances.map(({ substance, filled }) => {
      const end = substanceBarEnd(substance)
      const x1 = Math.max(dateToTs(substance.startDate), viewStart)
      const x2 = Math.min(dateToTs(end), viewEnd)
      return {
        id: substance.id,
        name: substance.name,
        color: substance.color,
        filled,
        faded: focusId != null && focusId !== substance.id,
        startDate: substance.startDate,
        x1,
        x2,
      }
    }).filter(b => b.x2 > b.x1)

    const packed = assignLanes(raw)
    const lanes = laneCount(packed)

    const bands: CycleBandDraw[] = packed.map(band => ({
      id: band.id,
      name: band.name,
      color: band.color,
      filled: band.filled,
      faded: band.faded,
      startDate: band.startDate,
      x1: band.x1,
      x2: band.x2,
      lane: band.lane,
    }))

    return { bands, lanes }
  }, [cycles, ongoing, focusId, viewStart, viewEnd])

  const lineData = useMemo(() => (
    series.map(point => ({
      ts: dateToTs(point.date),
      date: point.date,
      label: fmtDate(point.date),
      value: point.value,
    }))
  ), [series])

  const snapDates = useMemo(() => (
    buildTooltipSnapDates(series.map(point => point.date), bands)
  ), [series, bands])

  const delta = computeDelta(series)
  const latest = series[series.length - 1]

  const metricBar = (
    <MetricChipBar
      availableMetrics={availableMetrics}
      metricKey={metricKey}
      pointCounts={pointCounts}
      onSelectMetric={onSelectMetric}
    />
  )

  if (lineData.length === 0) {
    return (
      <section style={{ ...panel, padding: '28px 18px', textAlign: 'center', position: 'relative' }}>
        {onOpenSettings && (
          <div style={{ position: 'absolute', top: 14, right: 12 }}>
            <ChartSettingsButton onClick={onOpenSettings} />
          </div>
        )}
        <div style={{ paddingLeft: 12, paddingRight: 12, width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
          {metricBar}
        </div>
        <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>
          Noch keine {metric.label}-Daten
        </p>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Erfasse Werte mit + Heute
        </p>
      </section>
    )
  }

  return (
    <section style={{ ...panel, padding: '16px 12px 14px 4px', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 14, right: 12, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <ChartWindowToggle value={windowKey} onChange={onWindowChange} />
        {onOpenSettings && <ChartSettingsButton onClick={onOpenSettings} />}
      </div>

      <div style={{ paddingLeft: 12, marginBottom: 4, paddingRight: 150 }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-dim)' }}>{metric.label}</p>
        {(latest || delta) && (
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '2px 6px',
            marginTop: 2,
          }}>
            {latest && (
              <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
                {formatTooltipValue(latest.value, metric.unit)}
              </p>
            )}
            {delta && (
              <p style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                margin: 0,
              }}>
                {delta.delta > 0 ? '+' : ''}{formatTooltipValue(delta.delta, metric.unit)} im Zeitraum
              </p>
            )}
          </div>
        )}
      </div>
      <div style={{ width: '100%', paddingLeft: 12, paddingRight: 12, boxSizing: 'border-box' }}>
        {metricBar}
      </div>

      <div
        ref={wrapRef}
        style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none', cursor: 'crosshair' }}
        {...handlers}
      >
        <ResponsiveContainer width="100%" height={280}>
          <MetricChartBody
            lineData={lineData}
            snapDates={snapDates}
            bands={bands}
            lanes={lanes}
            metric={metric}
            viewStart={viewStart}
            viewEnd={viewEnd}
          />
        </ResponsiveContainer>
        {showJetzt && <JumpToNowButton onClick={jumpToNow} />}
      </div>

      <CycleLegend bands={bands} />
    </section>
  )
})
```

**Hinweis:** Der Fokus-Sprung läuft über das Ref-Handle `jumpToTs`; `VerlaufSection` rechnet das Datum selbst per `dayToTsSafe` in einen Timestamp um. `MetricChart` braucht dafür keine eigene Hilfsfunktion.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: Fehler nur noch in `VerlaufSection.tsx` (nutzt `range` statt `dataRange`) — die räumt Task 5 ab.

---

### Task 5: `VerlaufSection` verdrahten und Waisen entfernen

**Files:**
- Modify: `src/features/fortschritt/components/verlauf/VerlaufSection.tsx`
- Modify: `src/features/fortschritt/components/FortschrittDashboard.tsx:18-32,90-96`
- Modify: `src/features/fortschritt/FortschrittPage.tsx:17-20,42-46,60-66`
- Modify: `src/features/fortschritt/components/StickyRangeBar.tsx:10-16,33-35,46-56`
- Modify: `src/features/fortschritt/lib/verlaufRange.ts:26-32`

- [ ] **Step 1: `VerlaufSection` umbauen**

In `VerlaufSection.tsx`:

Imports (Zeilen 1-18) — `focusRangeForSubstance` raus, Fenster-Typen und `useRef` rein:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { ChartNavigation, DateRange, FortschrittOverviewState, MetricKey } from '../../types'
import { CHART_METRIC_KEYS, isChartMetricKey, isWellnessMetricKey } from '../../constants'
import { buildMetricSeries } from '../../lib/metrics'
import { buildAvailableMetrics, normalizeMetricKey } from '../../lib/metricDefinitions'
import { allSubstances, defaultFocusSubstanceId } from '../../lib/focusSummary'
import {
  filterCyclesByVisibility,
  filterOngoingByVisibility,
} from '../../lib/chartVisibility'
import { useChartVisibility } from '../../hooks/useChartVisibility'
import { DEFAULT_CHART_WINDOW, type ChartWindowKey } from '../../lib/chartWindow'
import { dayToTsSafe } from '../../lib/dates'
import { panel } from '../../styles'
import { VerlaufSetup } from './VerlaufSetup'
import { VerlaufSetupSheet } from './VerlaufSetupSheet'
import { ChartSettingsButton } from './ChartSettingsButton'
import { MetricChart, type ChartPanHandle } from './MetricChart'
```

Props (Zeilen 20-34) — `pageRange` und `onRangeLockedChange` fallen weg:

```tsx
interface Props {
  state: FortschrittOverviewState
  chartNav: ChartNavigation | null
  onChartNavConsumed: () => void
}

export function VerlaufSection({
  state,
  chartNav,
  onChartNavConsumed,
}: Props) {
  const [metricKey, setMetricKey] = useState<MetricKey>('weight')
  const [focusId, setFocusId] = useState<string | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [windowKey, setWindowKey] = useState<ChartWindowKey>(DEFAULT_CHART_WINDOW)
  const chartRef = useRef<ChartPanHandle>(null)
```

Der `chartRange`-Block und der `onRangeLockedChange`-Effekt (Zeilen 80-87) werden ersetzt: Fokus setzt keinen Zeitraum mehr, sondern springt nur die Ansicht.

```tsx
  const substances = allSubstances(visibleCycles, visibleOngoing)
  const focused = substances.find(s => s.id === focusId) ?? null

  // Fokus verschiebt nur die Ansicht an den Zyklus-Start; das Fenster bleibt.
  useEffect(() => {
    if (!focused) return
    const ts = dayToTsSafe(focused.startDate, 12)
    if (ts != null) chartRef.current?.jumpToTs(ts)
  }, [focused])
```

`const baseRange = state.fullRange` und alles darunter bleibt.

Das `<MetricChart>`-Element (Zeilen 140-154) ersetzen:

```tsx
        <MetricChart
          ref={chartRef}
          dataRange={state.fullRange}
          windowKey={windowKey}
          onWindowChange={setWindowKey}
          metric={selectedMetric}
          availableMetrics={availableMetrics}
          metricKey={metricKey}
          pointCounts={pointCounts}
          onSelectMetric={selectMetric}
          weights={state.weightLogs}
          dailyLogs={state.dailyLogs}
          bloodwork={state.bloodwork}
          cycles={visibleCycles}
          ongoing={visibleOngoing}
          focusId={focusId}
          onOpenSettings={openSetup}
        />
```

Den Hinweis-Block (Zeilen 176-180) ersatzlos löschen:

```tsx
      {focused && (
        <p style={{ ... }}>
          Zeitraum folgt Fokus-Substanz · Chips oben deaktiviert
        </p>
      )}
```

Die Chips sind nicht mehr gesperrt — der Satz wäre schlicht falsch.

- [ ] **Step 2: `FortschrittDashboard` entrümpeln**

In `FortschrittDashboard.tsx`: `onRangeLockedChange` aus `Props` (Zeile 23) und aus der Signatur (Zeile 26) entfernen, sodass sie lautet:

```tsx
interface Props {
  state: FortschrittOverviewState
  rangeChip: RangeChipKey
  onLogToday: () => void
  onReload: () => void
}

export function FortschrittDashboard({ state, rangeChip, onLogToday, onReload }: Props) {
```

Und den `VerlaufSection`-Aufruf (Zeilen 90-96) auf die neuen Props kürzen:

```tsx
      <VerlaufSection
        state={state}
        chartNav={chartNav}
        onChartNavConsumed={handleChartNavConsumed}
      />
```

`pageRange` bleibt — `computeTopChanges`, `FotosCard` und `BlutwerteCard` brauchen es weiterhin.

- [ ] **Step 3: `FortschrittPage` entrümpeln**

In `FortschrittPage.tsx` entfernen: `rangeLocked`-State (Zeile 18), `handleRangeLockedChange` (Zeile 20), das `disabled`-Prop an `StickyRangeBar` (Zeile 45) und `onRangeLockedChange` am Dashboard (Zeile 65). `useCallback` aus dem Import (Zeile 1) streichen, falls sonst unbenutzt.

Ergebnis:

```tsx
      <StickyRangeBar
        value={rangeChip}
        onChange={setRangeChip}
      />
```

```tsx
        <FortschrittDashboard
          state={state}
          rangeChip={rangeChip}
          onLogToday={() => setLogOpen(true)}
          onReload={() => void reload()}
        />
```

- [ ] **Step 4: `StickyRangeBar` entrümpeln**

In `StickyRangeBar.tsx` das `disabled`-Prop komplett entfernen — es hatte nur einen Aufrufer:

```tsx
interface Props {
  value: RangeChipKey
  onChange: (chip: RangeChipKey) => void
}

export function StickyRangeBar({ value, onChange }: Props) {
```

Den Wrapper-Div mit `opacity`/`pointerEvents` (Zeilen 32-35) durch ein nacktes `<div>` ersetzen, und am Button `disabled={disabled}` (Zeile 47) streichen sowie `cursor` auf `'pointer'` festsetzen:

```tsx
                    cursor: 'pointer',
```

- [ ] **Step 5: `focusRangeForSubstance` entfernen**

In `verlaufRange.ts` die Funktion (Zeilen 26-32) löschen. Falls dadurch `ActiveSubstance` oder `todayIso`/`cycleEndDate` im Import (Zeilen 2-3) unbenutzt werden, mit entfernen — `tsc` sagt es.

Prüfen, dass niemand sonst sie nutzt:

Run: `npx tsc -b`
Expected: keine Fehler

- [ ] **Step 6: Tests, Lint, Build**

Run: `npm test`
Expected: alle grün (inkl. `chartWindow.test.ts`)

Run: `npm run lint`
Expected: keine Fehler

Run: `npm run build`
Expected: erfolgreich

Falls ein Test auf `focusRangeForSubstance` referenziert, löschen — die Funktion existiert nicht mehr.

- [ ] **Step 7: Commit**

```bash
git add -A src/features/fortschritt
git commit -m "feat(fortschritt): Verlaufs-Chart auf 30T/3M-Fenster mit Pan umstellen"
```

---

### Task 6: Am Gerät verifizieren

**Files:** keine

Das ist der eigentliche Beweis — Ansatz A steht und fällt mit der Performance.

- [ ] **Step 1: Dev-Server starten**

`preview_start` mit `{name: "dev"}` (Port 5175, aus `.claude/launch.json`), dann zur Fortschritt-Seite navigieren.

- [ ] **Step 2: Konsole prüfen**

`read_console_messages` mit `onlyErrors: true`
Expected: keine Fehler. Recharts warnt bei falscher Domain lautstark.

- [ ] **Step 3: Checkliste durchgehen**

- [ ] Chart startet im 3M-Fenster
- [ ] 30T/3M-Umschalter wechselt die Fensterbreite, Chips oben bleiben davon unberührt
- [ ] Ziehen nach rechts zeigt die Vergangenheit, kein Momentum
- [ ] Am linken Anschlag (ältester Datenpunkt) ist Schluss, rechts bei heute
- [ ] „Jetzt"-Button erscheint beim Zurückwischen und springt zurück
- [ ] Maus-Hover liest ab; Maus-Ziehen pannt
- [ ] X-Labels wandern mit der Kurve statt zu springen
- [ ] **Y-Skala steht beim Wischen still** (sonst `domain={['dataMin','dataMax']}` setzen)
- [ ] Zyklus-Bänder und Start-Marker wandern korrekt mit
- [ ] Vertikales Seiten-Scrollen über dem Chart geht weiter
- [ ] Fokus auf eine Substanz springt an den Zyklus-Start, Fenster bleibt
- [ ] **Kein spürbares Ruckeln** — sonst Canvas-Rewrite (Rückfallplan der Spec)

- [ ] **Step 4: Touch prüfen**

`resize_window` mit `{preset: "mobile"}`, dann mit `computer` ziehen: Drag = Pan, ~300 ms Halten = Tooltip.

- [ ] **Step 5: Screenshot als Beleg**

`computer` mit `{action: "screenshot"}`

- [ ] **Step 6: Graph aktualisieren und committen**

```bash
graphify update .
git add -A src/features/fortschritt
git commit -m "fix(fortschritt): Feinschliff nach Geräte-Verifikation"
```

(Nur committen, falls Step 3/4 Korrekturen nötig machten.)

---

## Bekannter Fremd-Bug (nicht Teil dieses Plans)

`LiveCycleChartCanvas.tsx:459-464` berechnet den Haptik-Index als
`Math.floor((ve - viewStart) / stepMs)`. Wegen `viewStart = ve - windowMs` ist der Zähler
immer exakt `windowMs`, der Index also konstant — **die Haptik beim Blutspiegel-Wischen
feuert nie.** `useChartPan` benutzt deshalb `Math.floor(ve / stepMs)`, was tatsächlich
mitläuft.

Folge: Der Fortschritt-Chart vibriert beim Wischen, der Blutspiegel-Chart nicht. Das ist
eine gewollte Abweichung vom „gleichen Verhalten" — die Alternative wäre, einen kaputten
Zustand nachzubauen. Der Fix am Blutspiegel-Chart ist ein Einzeiler, gehört aber nicht in
diesen Plan.
