# Fortschritt: Ruhige 3M-Messreihen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gewicht und KFA zeigen in der 3M-Ansicht nur die animierte Linie und beim Ablesen genau einen temporären, echten Messpunkt, ohne dass der Cursor an Metrikpunkten einrastet.

**Architecture:** Die reine Modus- und Auswahlentscheidung lebt in `chartTooltip.ts`, damit Zeitfenstergrenzen, Gleichstände und fehlende Daten unabhängig von React testbar bleiben. `MetricChart` entfernt im reduzierten Modus ausschließlich permanente Punkte und Metrik-Snap-Ziele; eine kleine Recharts-Ebene zeichnet den temporären echten Messpunkt, während Tooltip und Marker dieselbe Auswahlfunktion verwenden.

**Tech Stack:** React 19, TypeScript 6, Recharts 3.8, date-fns 4, Vitest 3

## Global Constraints

- Der reduzierte Modus gilt ausschließlich für `weight` und `body_fat` im lokalen Chart-Fenster `3m`.
- In `30t` bleiben Linie, permanente Punkte, Punktanimation und Metrik-Snapping unverändert.
- Blutwerte bleiben in `30t` und `3m` vollständig unverändert.
- Im reduzierten Modus wird ausschließlich der zeitlich nächste echte Messwert aus dem sichtbaren Fenster verwendet; es gibt keine Interpolation.
- Bei gleichem zeitlichem Abstand gewinnt der ältere Messwert.
- Der vertikale Cursor rastet im reduzierten Modus nicht an Gewichts- oder KFA-Messungen ein; das bestehende Einrasten an sichtbaren Zyklusstarts bleibt erhalten.
- Der temporäre Messpunkt erscheint nur bei aktiver Maus-/Touch-Interaktion und verwendet die Farbe der Metriklinie.
- Der Tooltip zeigt das tatsächliche Messdatum mit der Formulierung `Messwert vom dd.MM.`.
- Liegt kein echter Messwert im sichtbaren Fenster, erscheinen weder temporärer Metrikpunkt noch Metrikwert; vorhandene Zyklusinformationen bleiben nutzbar.
- Beim Einstieg und Metrikwechsel wird in `3m` für Gewicht/KFA nur die Linie animiert; Zyklusanimationen und `prefers-reduced-motion` bleiben unverändert.
- Keine neue Runtime-Abhängigkeit und keine Änderung an gespeicherten Daten, Liniengeometrie, Pan-Geste oder Zyklusbalken.
- Unabhängige, bereits vorhandene Änderungen im Arbeitsbaum bleiben unberührt; jeder Commit staged nur die im jeweiligen Task genannten Dateien.

---

## File Map

- Modify: `src/features/fortschritt/lib/chartTooltip.ts` — reine Modusentscheidung, Auswahl des nächsten sichtbaren echten Messpunkts und Tooltip-Ergebnis.
- Modify: `src/features/fortschritt/lib/chartTooltip.test.ts` — Unit-Tests für Scope, Fenstergrenzen, Gleichstand und Tooltip-Auswahl.
- Modify: `src/features/fortschritt/components/verlauf/useChartTooltipContent.ts` — reicht freien Hover-Zeitpunkt und Auswahloptionen an die reine Tooltip-Logik weiter.
- Modify: `src/features/fortschritt/components/verlauf/MetricTooltip.tsx` — kennzeichnet den echten Messzeitpunkt ausdrücklich.
- Create: `src/features/fortschritt/components/verlauf/ActiveMetricPointLayer.tsx` — zeichnet nur während aktiver Interaktion den ausgewählten echten Messpunkt.
- Modify: `src/features/fortschritt/components/verlauf/MetricChart.tsx` — aktiviert den Modus, trennt Metrik- von Zyklus-Snap-Zielen und unterdrückt permanente Punkte samt Punktanimation.
- Modify: `src/features/fortschritt/components/verlauf/chartAnimation.test.ts` — sichert die Verdrahtung von Linie, permanenten Punkten, temporärem Punkt und Animation.

---

### Task 1: Reine Modus- und Messpunktauswahl

**Files:**
- Modify: `src/features/fortschritt/lib/chartTooltip.ts`
- Test: `src/features/fortschritt/lib/chartTooltip.test.ts`

**Interfaces:**
- Consumes: `MetricKey` aus `src/features/fortschritt/types.ts` und `ChartWindowKey` aus `src/features/fortschritt/lib/chartWindow.ts`.
- Produces: `MetricChartPoint`, `usesReducedMetricPoints(metricKey, windowKey)` und `nearestVisibleMetricPoint(metricData, hoverTs, viewStart, viewEnd)` für Tooltip, Marker und Chart.

- [ ] **Step 1: Failing tests für den exakt begrenzten 3M-Modus schreiben**

In `chartTooltip.test.ts` die neue Funktion importieren und diese Fälle ergänzen:

```ts
usesReducedMetricPoints,

describe('reduced metric points', () => {
  it('uses the reduced mode only for weight and body fat in 3m', () => {
    expect(usesReducedMetricPoints('weight', '3m')).toBe(true)
    expect(usesReducedMetricPoints('body_fat', '3m')).toBe(true)
    expect(usesReducedMetricPoints('weight', '30t')).toBe(false)
    expect(usesReducedMetricPoints('body_fat', '30t')).toBe(false)
    expect(usesReducedMetricPoints('Vitamin D', '3m')).toBe(false)
  })
})
```

- [ ] **Step 2: Den Scope-Test ausführen und das erwartete Fehlschlagen bestätigen**

Run:

```powershell
npm test -- src/features/fortschritt/lib/chartTooltip.test.ts
```

Expected: FAIL, weil `usesReducedMetricPoints` noch nicht exportiert wird.

- [ ] **Step 3: Minimale Modusentscheidung implementieren**

In `chartTooltip.ts` ausschließlich Type-Imports und diese Funktion ergänzen:

```ts
import type { MetricKey } from '../types'
import type { ChartWindowKey } from './chartWindow'

export function usesReducedMetricPoints(
  metricKey: MetricKey,
  windowKey: ChartWindowKey,
): boolean {
  return windowKey === '3m'
    && (metricKey === 'weight' || metricKey === 'body_fat')
}
```

- [ ] **Step 4: Den Scope-Test erneut ausführen**

Run:

```powershell
npm test -- src/features/fortschritt/lib/chartTooltip.test.ts
```

Expected: PASS.

- [ ] **Step 5: Failing tests für den nächsten echten sichtbaren Messpunkt schreiben**

Import und Tests ergänzen:

```ts
nearestVisibleMetricPoint,

describe('nearest visible metric point', () => {
  const points = [
    { date: '2026-04-01', ts: Date.parse('2026-04-01T12:00:00'), value: 90 },
    { date: '2026-04-10', ts: Date.parse('2026-04-10T12:00:00'), value: 88 },
    { date: '2026-04-20', ts: Date.parse('2026-04-20T12:00:00'), value: 86 },
  ]

  it('selects the nearest real point without interpolation', () => {
    const result = nearestVisibleMetricPoint(
      points,
      Date.parse('2026-04-17T12:00:00'),
      Date.parse('2026-04-01T12:00:00'),
      Date.parse('2026-04-30T12:00:00'),
    )
    expect(result).toEqual(points[2])
  })

  it('selects the older point when distances are equal', () => {
    const result = nearestVisibleMetricPoint(
      points.slice(0, 2),
      Date.parse('2026-04-06T00:00:00'),
      Date.parse('2026-04-01T12:00:00'),
      Date.parse('2026-04-10T12:00:00'),
    )
    expect(result).toEqual(points[0])
  })

  it('ignores points outside the visible window', () => {
    const result = nearestVisibleMetricPoint(
      points,
      Date.parse('2026-04-11T12:00:00'),
      Date.parse('2026-04-15T12:00:00'),
      Date.parse('2026-04-30T12:00:00'),
    )
    expect(result).toEqual(points[2])
  })

  it('returns null when the visible window has no valid points', () => {
    expect(nearestVisibleMetricPoint(
      points,
      Date.parse('2026-05-10T12:00:00'),
      Date.parse('2026-05-01T12:00:00'),
      Date.parse('2026-05-31T12:00:00'),
    )).toBeNull()
  })
})
```

- [ ] **Step 6: Den Auswahltest ausführen und das erwartete Fehlschlagen bestätigen**

Run:

```powershell
npm test -- src/features/fortschritt/lib/chartTooltip.test.ts
```

Expected: FAIL, weil `nearestVisibleMetricPoint` und `MetricChartPoint` noch fehlen.

- [ ] **Step 7: Die minimale echte Messpunktauswahl implementieren**

In `chartTooltip.ts` ergänzen:

```ts
export interface MetricChartPoint {
  date: string
  ts: number
  value: number | null
}

export function nearestVisibleMetricPoint(
  metricData: ReadonlyArray<MetricChartPoint>,
  hoverTs: number,
  viewStart: number,
  viewEnd: number,
): MetricChartPoint | null {
  if (!Number.isFinite(hoverTs)) return null

  let best: MetricChartPoint | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const point of metricData) {
    if (
      point.ts < viewStart
      || point.ts > viewEnd
      || point.value == null
      || !Number.isFinite(point.value)
    ) continue

    const distance = Math.abs(point.ts - hoverTs)
    if (
      distance < bestDistance
      || (distance === bestDistance && best != null && point.ts < best.ts)
    ) {
      best = point
      bestDistance = distance
    }
  }

  return best
}
```

- [ ] **Step 8: Task-1-Tests und TypeScript-Build ausführen**

Run:

```powershell
npm test -- src/features/fortschritt/lib/chartTooltip.test.ts
npm run build
```

Expected: beide Befehle PASS.

- [ ] **Step 9: Task 1 isoliert committen**

```powershell
git add -- src/features/fortschritt/lib/chartTooltip.ts src/features/fortschritt/lib/chartTooltip.test.ts
git commit --only -m "feat(fortschritt): select nearest visible metric point" -- src/features/fortschritt/lib/chartTooltip.ts src/features/fortschritt/lib/chartTooltip.test.ts
```

Expected: Der Commit enthält genau die beiden genannten Dateien.

---

### Task 2: Tooltip und temporärer echter Messpunkt

**Files:**
- Modify: `src/features/fortschritt/lib/chartTooltip.ts`
- Modify: `src/features/fortschritt/lib/chartTooltip.test.ts`
- Modify: `src/features/fortschritt/components/verlauf/useChartTooltipContent.ts`
- Modify: `src/features/fortschritt/components/verlauf/MetricTooltip.tsx`
- Create: `src/features/fortschritt/components/verlauf/ActiveMetricPointLayer.tsx`

**Interfaces:**
- Consumes: `nearestVisibleMetricPoint(...)` aus Task 1 sowie bestehende `useFluidChartHover(snapDates)`-Daten `{ fluidX, dateIso, hoverTs }`.
- Produces: `resolveChartTooltipContent(...)` mit `metricDateIso` und `metricTs`; `useChartTooltipContent(..., options)`; `ActiveMetricPointLayer` für `MetricChartBody` in Task 3.

- [ ] **Step 1: Failing Tooltip-Tests für echten Messwert und getrennte Datumswerte schreiben**

Den bestehenden `resolveChartTooltipContent`-Tests diese Fälle hinzufügen:

```ts
it('returns the nearest visible real metric point in reduced mode', () => {
  const metricData = [
    { date: '2026-04-10', ts: Date.parse('2026-04-10T12:00:00'), value: 88 },
    { date: '2026-04-20', ts: Date.parse('2026-04-20T12:00:00'), value: 86 },
  ]
  const content = resolveChartTooltipContent({
    hoverDateIso: '2026-04-18',
    hoverTs: Date.parse('2026-04-18T12:00:00'),
    bands: [],
    metricData,
    nearestMetric: true,
    viewStart: Date.parse('2026-04-01T12:00:00'),
    viewEnd: Date.parse('2026-04-30T12:00:00'),
  })

  expect(content?.dateIso).toBe('2026-04-18')
  expect(content?.metricDateIso).toBe('2026-04-20')
  expect(content?.metricTs).toBe(metricData[1].ts)
  expect(content?.metricValue).toBe(86)
})

it('keeps cycle hover date while exposing a different real metric date', () => {
  const content = resolveChartTooltipContent({
    hoverDateIso: '2026-04-12',
    hoverTs: Date.parse('2026-04-12T12:00:00'),
    bands: [{
      id: 'cycle',
      startDate: '2026-04-12',
      x1: Date.parse('2026-04-12T12:00:00'),
      startVisible: true,
    }],
    metricData: [{
      date: '2026-04-10',
      ts: Date.parse('2026-04-10T12:00:00'),
      value: 88,
    }],
    nearestMetric: true,
    viewStart: Date.parse('2026-04-01T12:00:00'),
    viewEnd: Date.parse('2026-04-30T12:00:00'),
  })

  expect(content?.dateIso).toBe('2026-04-12')
  expect(content?.metricDateIso).toBe('2026-04-10')
  expect(content?.starts.map(start => start.id)).toEqual(['cycle'])
})
```

- [ ] **Step 2: Tooltip-Test ausführen und das erwartete Fehlschlagen bestätigen**

Run:

```powershell
npm test -- src/features/fortschritt/lib/chartTooltip.test.ts
```

Expected: FAIL, weil Resolver-Optionen und Messpunkt-Metadaten noch fehlen.

- [ ] **Step 3: Tooltip-Resolver abwärtskompatibel um echte Messpunkte erweitern**

`resolveChartTooltipContent` erhält optionale Felder, sodass bestehende Aufrufer weiterhin den exakten Tageswert verwenden:

```ts
export function resolveChartTooltipContent<T extends BandWithStart>({
  hoverDateIso,
  hoverTs,
  bands,
  metricData,
  nearestMetric = false,
  viewStart = Number.NEGATIVE_INFINITY,
  viewEnd = Number.POSITIVE_INFINITY,
}: {
  hoverDateIso: string | null
  hoverTs?: number
  bands: T[]
  metricData: ReadonlyArray<MetricChartPoint>
  nearestMetric?: boolean
  viewStart?: number
  viewEnd?: number
}): {
  dateIso: string
  metricDateIso: string | null
  metricTs: number | null
  metricValue: number | null
  starts: T[]
} | null {
  if (!hoverDateIso) return null

  const dateIso = normalizeDateIso(hoverDateIso)
  const selected = nearestMetric && hoverTs != null
    ? nearestVisibleMetricPoint(metricData, hoverTs, viewStart, viewEnd)
    : metricData.find(point => normalizeDateIso(point.date) === dateIso) ?? null
  const hasMetric = selected?.value != null && Number.isFinite(selected.value)

  return {
    dateIso,
    metricDateIso: hasMetric ? normalizeDateIso(selected!.date) : null,
    metricTs: hasMetric ? selected!.ts : null,
    metricValue: hasMetric ? selected!.value : null,
    starts: cycleStartsOnDate(bands, dateIso),
  }
}
```

Bestehende Testdaten in `chartTooltip.test.ts`, die an den Resolver gehen, um einen `ts`-Wert pro Punkt ergänzen. `metricValueAtDate` bleibt für bestehende direkte Aufrufer unverändert.

- [ ] **Step 4: Resolver-Tests ausführen**

Run:

```powershell
npm test -- src/features/fortschritt/lib/chartTooltip.test.ts
```

Expected: PASS für alte exakte Tageslogik und neue Nächster-Messwert-Logik.

- [ ] **Step 5: Tooltip-Hook um Auswahloptionen erweitern**

In `useChartTooltipContent.ts` definieren:

```ts
interface TooltipSelectionOptions {
  nearestMetric: boolean
  viewStart: number
  viewEnd: number
}

export function useChartTooltipContent(
  snapDates: string[],
  bands: CycleBandDraw[],
  metricData: ChartPoint[],
  options: TooltipSelectionOptions,
) {
  const pointerX = useChartPointerX()
  const hover = useFluidChartHover(snapDates)

  return useMemo(() => {
    if (pointerX == null || !hover) return null
    return resolveChartTooltipContent({
      hoverDateIso: hover.dateIso,
      hoverTs: hover.hoverTs,
      bands,
      metricData,
      nearestMetric: options.nearestMetric,
      viewStart: options.viewStart,
      viewEnd: options.viewEnd,
    })
  }, [pointerX, hover, bands, metricData, options.nearestMetric, options.viewStart, options.viewEnd])
}
```

- [ ] **Step 6: Tooltip-Copy auf den echten Messzeitpunkt erweitern**

`MetricTooltip.tsx` erhält `nearestMetric`, `viewStart` und `viewEnd` als Props und reicht sie an den Hook. Das bestehende Cursor-/Zyklusdatum bleibt oben stehen; direkt am Metrikwert erscheint die Herkunft:

```tsx
const { dateIso, metricDateIso, metricValue, starts } = content

{hasMetric && (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
    <span style={{
      width: 7,
      height: 7,
      marginTop: 3,
      borderRadius: '50%',
      background: metric.color,
      flexShrink: 0,
    }} />
    <div>
      {nearestMetric && metricDateIso && (
        <p style={{ color: 'var(--text-muted)', margin: '0 0 2px' }}>
          Messwert vom {fmtDate(metricDateIso)}
        </p>
      )}
      <span style={{ color: 'var(--text-dim)' }}>
        {metric.label}: {formatTooltipValue(metricValue!, metric.unit)}
      </span>
    </div>
  </div>
)}
```

In exaktem Modus bleibt die zusätzliche `Messwert vom`-Zeile ausgeblendet.

- [ ] **Step 7: Temporäre Recharts-Messpunktebene erstellen**

Neue Datei `ActiveMetricPointLayer.tsx`:

```tsx
import { DefaultZIndexes, useXAxisScale, useYAxisScale, ZIndexLayer } from 'recharts'
import type { MetricChartPoint } from '../../lib/chartTooltip'
import type { CycleBandDraw } from './CycleBandLayer'
import { useChartTooltipContent } from './useChartTooltipContent'

interface Props {
  enabled: boolean
  snapDates: string[]
  bands: CycleBandDraw[]
  metricData: MetricChartPoint[]
  viewStart: number
  viewEnd: number
  color: string
}

export function ActiveMetricPointLayer({
  enabled,
  snapDates,
  bands,
  metricData,
  viewStart,
  viewEnd,
  color,
}: Props) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale('metric')
  const content = useChartTooltipContent(snapDates, bands, metricData, {
    nearestMetric: true,
    viewStart,
    viewEnd,
  })

  if (!enabled || !xScale || !yScale || content?.metricTs == null || content.metricValue == null) {
    return null
  }

  const cx = xScale(content.metricTs, { position: 'start' })
  const cy = yScale(content.metricValue)
  if (cx == null || cy == null) return null

  return (
    <ZIndexLayer zIndex={DefaultZIndexes.activeDot}>
      <circle
        aria-hidden
        cx={cx}
        cy={cy}
        r={4.5}
        fill={color}
        stroke="#07091a"
        strokeWidth={2}
        pointerEvents="none"
      />
    </ZIndexLayer>
  )
}
```

Alle Hooks werden unabhängig von `enabled` aufgerufen; dadurch bleibt die React-Hook-Reihenfolge stabil.

- [ ] **Step 8: Task-2-Dateien über TypeScript prüfen**

Run:

```powershell
npm run build
```

Expected: PASS. `useYAxisScale('metric')` verwendet dieselbe Achsen-ID wie die bestehende `<YAxis yAxisId="metric" />`.

- [ ] **Step 9: Task 2 isoliert committen**

```powershell
git add -- src/features/fortschritt/lib/chartTooltip.ts src/features/fortschritt/lib/chartTooltip.test.ts src/features/fortschritt/components/verlauf/useChartTooltipContent.ts src/features/fortschritt/components/verlauf/MetricTooltip.tsx src/features/fortschritt/components/verlauf/ActiveMetricPointLayer.tsx
git commit --only -m "feat(fortschritt): expose nearest real metric reading" -- src/features/fortschritt/lib/chartTooltip.ts src/features/fortschritt/lib/chartTooltip.test.ts src/features/fortschritt/components/verlauf/useChartTooltipContent.ts src/features/fortschritt/components/verlauf/MetricTooltip.tsx src/features/fortschritt/components/verlauf/ActiveMetricPointLayer.tsx
```

Expected: Der Commit enthält genau diese fünf Dateien.

---

### Task 3: Reduzierten 3M-Modus im Chart verdrahten

**Files:**
- Modify: `src/features/fortschritt/components/verlauf/MetricChart.tsx`
- Modify: `src/features/fortschritt/components/verlauf/chartAnimation.test.ts`

**Interfaces:**
- Consumes: `usesReducedMetricPoints(...)` aus Task 1 und `ActiveMetricPointLayer` sowie die erweiterten Tooltip-Props aus Task 2.
- Produces: vollständiges Nutzerverhalten für Gewicht/KFA in 3M; keine neue öffentliche Schnittstelle außerhalb des Fortschritt-Charts.

- [ ] **Step 1: Failing Source-Integrationstests für den reduzierten Modus schreiben**

In `chartAnimation.test.ts` ergänzen:

```ts
test('reduziert nur Gewicht und KFA in 3M auf Linie plus aktiven Messpunkt', () => {
  const source = readSource('./MetricChart.tsx')

  expect(source).toContain('usesReducedMetricPoints(metricKey, windowKey)')
  expect(source).toContain('showPersistentDots')
  expect(source).toContain('dot={showPersistentDots ?')
  expect(source).toContain('<ActiveMetricPointLayer')
  expect(source).toContain('enabled={reducedMetricPoints}')
})

test('entfernt im reduzierten Modus nur Metrik-Snap-Ziele', () => {
  const source = readSource('./MetricChart.tsx')

  expect(source).toContain('reducedMetricPoints ? [] : series.map(point => point.date)')
  expect(source).toContain('buildTooltipSnapDates(metricSnapDates, bands)')
})

test('beendet die reduzierte Animation nach der Linie ohne Punktlaufzeit', () => {
  const source = readSource('./MetricChart.tsx')

  expect(source).toContain('showPersistentDots')
  expect(source).toContain('? Math.max(0, visiblePointTotal - 1) * POINT_ANIMATION_STEP_MS + POINT_ANIMATION_MS')
  expect(source).toContain(': 0')
})
```

- [ ] **Step 2: Integrationstest ausführen und das erwartete Fehlschlagen bestätigen**

Run:

```powershell
npm test -- src/features/fortschritt/components/verlauf/chartAnimation.test.ts
```

Expected: FAIL, weil Modus, Marker und konditionale Punkte noch nicht verdrahtet sind.

- [ ] **Step 3: ChartBody-Props und Importe ergänzen**

In `MetricChart.tsx` importieren:

```ts
import {
  buildTooltipSnapDates,
  usesReducedMetricPoints,
} from '../../lib/chartTooltip'
import { ActiveMetricPointLayer } from './ActiveMetricPointLayer'
```

`ChartBodyProps` ergänzen:

```ts
showPersistentDots: boolean
reducedMetricPoints: boolean
```

Beide Props in `MetricChartBody` destrukturieren.

- [ ] **Step 4: Permanente Punkte konditional rendern und temporären Punkt einsetzen**

In der `<Line>` die bestehende Dot-Funktion vollständig beibehalten, aber konditional setzen:

```tsx
dot={showPersistentDots ? (dotProps: any) => {
  const animationIndex = dotProps.payload?.ts != null
    ? visiblePointIndex.get(dotProps.payload.ts)
    : undefined
  if (animationIndex == null) return null
  return (
    <AnimatedMetricDot
      {...dotProps}
      fill="#07091a"
      stroke={metric.color}
      animationIndex={animationIndex}
      strokeWidth={2}
      animate={animateMetric}
    />
  )
} : false}
```

Direkt nach der `<Line>` ergänzen:

```tsx
<ActiveMetricPointLayer
  enabled={reducedMetricPoints}
  snapDates={snapDates}
  bands={bands}
  metricData={lineData}
  viewStart={viewStart}
  viewEnd={viewEnd}
  color={metric.color}
/>
```

- [ ] **Step 5: Tooltip in beiden Modi mit denselben Grenzen verdrahten**

Am bestehenden `<MetricTooltip>` ergänzen:

```tsx
nearestMetric={reducedMetricPoints}
viewStart={viewStart}
viewEnd={viewEnd}
```

Damit verwenden Tooltip und temporärer Punkt dieselbe reine Auswahlregel.

- [ ] **Step 6: Modus und getrennte Snap-Ziele im Chart-Container berechnen**

Nach `animationPointData` ergänzen:

```ts
const reducedMetricPoints = usesReducedMetricPoints(metricKey, windowKey)
const showPersistentDots = !reducedMetricPoints
```

Die bisherige `snapDates`-Berechnung ersetzen:

```ts
const metricSnapDates = reducedMetricPoints
  ? []
  : series.map(point => point.date)
const snapDates = useMemo(
  () => buildTooltipSnapDates(metricSnapDates, bands),
  [metricSnapDates, bands],
)
```

`metricSnapDates` selbst mit `useMemo` stabilisieren, damit die nachgelagerten Hooks nicht bei jedem Render ein neues Array erhalten:

```ts
const metricSnapDates = useMemo(
  () => reducedMetricPoints ? [] : series.map(point => point.date),
  [reducedMetricPoints, series],
)
```

- [ ] **Step 7: Animationsdauer ohne unsichtbare Punktsequenz berechnen**

Im bestehenden `useLayoutEffect`:

```ts
const pointDuration = showPersistentDots
  ? Math.max(0, visiblePointTotal - 1) * POINT_ANIMATION_STEP_MS + POINT_ANIMATION_MS
  : 0
const duration = LINE_ANIMATION_MS + pointDuration + 100
```

`showPersistentDots` in die Effect-Abhängigkeiten aufnehmen:

```ts
}, [metricKey, lineData.length, showPersistentDots])
```

So bleibt die Linienanimation 900 ms lang, ohne im reduzierten Modus intern auf bis zu 90 nicht gerenderte Punkte zu warten.

- [ ] **Step 8: Neue Props an `MetricChartBody` reichen**

Beim bestehenden Aufruf ergänzen:

```tsx
showPersistentDots={showPersistentDots}
reducedMetricPoints={reducedMetricPoints}
```

- [ ] **Step 9: Targeted Tests ausführen**

Run:

```powershell
npm test -- src/features/fortschritt/lib/chartTooltip.test.ts src/features/fortschritt/components/verlauf/chartAnimation.test.ts
```

Expected: PASS. Insbesondere bleiben die bisherigen Tests für sichtfenstergebundene Linien- und Punktanimation grün.

- [ ] **Step 10: Produktions-Build ausführen**

Run:

```powershell
npm run build
```

Expected: PASS ohne TypeScript- oder Vite-Fehler.

- [ ] **Step 11: Task 3 isoliert committen**

```powershell
git add -- src/features/fortschritt/components/verlauf/MetricChart.tsx src/features/fortschritt/components/verlauf/chartAnimation.test.ts
git commit --only -m "feat(fortschritt): simplify dense 3m metric charts" -- src/features/fortschritt/components/verlauf/MetricChart.tsx src/features/fortschritt/components/verlauf/chartAnimation.test.ts
```

Expected: Der Commit enthält genau die beiden genannten Dateien.

---

### Task 4: Gesamte Regression und Browser-Abnahme

**Files:**
- Modify only if a verified defect is found: one of the files listed in Tasks 1–3, plus its directly corresponding test.

**Interfaces:**
- Consumes: vollständige Implementierung aus Tasks 1–3.
- Produces: verifizierte, abnahmefähige Fortschritt-Interaktion ohne Änderungen an anderen Features.

- [ ] **Step 1: Gesamte Testsuite ausführen**

Run:

```powershell
npm test
```

Expected: alle Tests PASS; Ausgangsbasis vor dieser Änderung waren 455 bestandene Tests.

- [ ] **Step 2: Produktions-Build erneut ausführen**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 3: Fortschritt im lokalen Browser öffnen und 3M-Gewicht prüfen**

Run:

```powershell
npm run dev
```

Manuelle Abnahme:

- Fortschritt öffnet standardmäßig mit Gewicht und 3M.
- Die Gewichtslinie baut sich von links nach rechts auf.
- Danach erscheinen keine permanenten Gewichtspunkte.
- Maus-Hover beziehungsweise Touch-Halten zeigt genau einen gefüllten Punkt in Linienfarbe.
- Der vertikale Cursor bleibt flüssig und wird nicht zu täglichen Gewichtswerten gezogen.
- Der Tooltip zeigt `Messwert vom dd.MM.` und den Wert desselben echten Punkts.

- [ ] **Step 4: KFA, 30T, Blutwerte und Zyklusstarts prüfen**

Manuelle Abnahme:

- KFA verhält sich in 3M genauso wie Gewicht.
- Gewicht und KFA zeigen in 30T weiterhin permanente Punkte mit gestaffelter Animation.
- Blutwerte zeigen in 30T und 3M weiterhin ihre bisherigen Punkte und ihr bisheriges Snapping.
- An sichtbaren Zyklusstarts bleibt das bestehende Einrasten und die Start-Hervorhebung erhalten.
- Bei einem Zyklusstart und einem abweichenden nächsten Messdatum bleiben Cursor-/Zyklusdatum und `Messwert vom` klar getrennt.
- Beim Wischen in ein 3M-Fenster ohne echte Gewicht-/KFA-Werte erscheinen weder temporärer Punkt noch Metrikwert.
- Pan, „Jetzt“-Sprung, vertikales Scrollen und Touch-Halten funktionieren unverändert.

- [ ] **Step 5: Reduzierte Bewegung prüfen**

Im Betriebssystem oder in DevTools `prefers-reduced-motion: reduce` aktivieren.

Expected:

- Die Linie erscheint ohne Reveal-Animation vollständig.
- Es gibt in 3M weiterhin keine permanenten Gewicht-/KFA-Punkte.
- Der temporäre Punkt beim Ablesen funktioniert weiterhin.

- [ ] **Step 6: Bei einem Defekt die Abnahme stoppen**

Wenn eine manuelle Prüfung fehlschlägt, den exakten Metrik-/Fensterzustand, die
Cursorposition und das beobachtete Ergebnis notieren. Task 4 nimmt selbst keine
unvorhergesehene Codeänderung vor; der reproduzierte Defekt wird zuerst als eigener
fehlschlagender Test in der direkt zuständigen Testdatei geplant. Ohne Defekt entsteht
in Task 4 kein zusätzlicher Commit.
