# Fortschritt-Werteübersicht Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Fortschritt-spezifische Blutwerte-Karte durch eine gleich hohe Listenkarte für Energie, Schlaf, Wohlbefinden, Libido und KFA mit Halbzeitraum-Durchschnitten und semantischen Statusfarben ersetzen.

**Architecture:** Eine neue reine Bibliothek teilt den gewählten `DateRange`, berechnet je Metrik den neueren Durchschnitt und optional den Vergleich zur älteren Hälfte und klassifiziert die Veränderung. Eine neue React-Karte rendert ausschließlich diese vorbereiteten Zeilen; `FortschrittDashboard` ersetzt nur die bisherige `BlutwerteCard` und lässt Chart, Top-Veränderungen, Fotos und die eigenständige Blutwerte-Seite unverändert.

**Tech Stack:** React 19, TypeScript 6, date-fns 4, Vitest 3, Vite 8, Inline-Styles und bestehende Fortschritt-Design-Tokens.

## Global Constraints

- Angezeigte Reihenfolge: Energie, Schlaf, Wohlbefinden, Libido, KFA.
- Gewicht und ein kombinierter Gesamtwert dürfen nicht in der Karte erscheinen.
- Der ausgewählte `pageRange` wird inklusive in zwei Kalenderhälften geteilt; bei ungerader Tageszahl liegt der zusätzliche Tag in der zweiten Hälfte.
- Der neuere Durchschnitt braucht mindestens einen Wert; ein Vergleich braucht mindestens zwei Werte pro Hälfte und Metrik.
- Statusfarben betreffen ausschließlich Pfeil und Delta: Grün `#10b981`, Orange `#f59e0b`, Rot `#ef4444`, neutral `var(--text-muted)`.
- Änderungen mit Betrag kleiner `0.2` sind neutral; Verschlechterungen ab `0.2` sind orange und ab `1.0` rot; Verbesserungen ab `0.2` sind grün.
- Für KFA ist eine Abnahme eine Verbesserung; es werden keine medizinischen Zielwerte oder Gesundheitsurteile ergänzt.
- Durchschnitt und Delta werden auf eine Nachkommastelle gerundet und deutsch mit Dezimalkomma dargestellt.
- Fotos-Karte, Chart, Top-Veränderungen und die eigenständige Blutwerte-Seite bleiben unverändert.
- Keine neue Abhängigkeit, Datenbankänderung oder API-Abfrage.

---

## File Structure

- Create `src/features/fortschritt/lib/valueOverview.ts`: Zeitraumteilung, metrikspezifische Durchschnittsberechnung, Mindestdatenregel, Rundung und Statusklassifikation.
- Create `src/features/fortschritt/lib/valueOverview.test.ts`: verhaltensorientierte Tests der vollständigen Vergleichslogik.
- Create `src/features/fortschritt/components/werte/WerteCard.tsx`: kompakte Fünf-Zeilen-Darstellung mit neutralen Hauptwerten und farbigen Deltas.
- Create `src/features/fortschritt/components/werte/WerteCard.test.ts`: Struktur-, Reihenfolge- und Farbumfang-Tests.
- Modify `src/features/fortschritt/components/FortschrittDashboard.tsx`: `WerteCard` statt `BlutwerteCard` rendern und `dailyLogs`/`pageRange` übergeben.
- Modify `src/features/fortschritt/components/fortschrittRemoval.test.ts`: Entfernung der Dashboard-Blutwerte-Karte und neue Verdrahtung absichern.
- Delete `src/features/fortschritt/components/blutwerte/BlutwerteCard.tsx`: nach dem Dashboard-Ersatz ungenutzte Fortschritt-Komponente entfernen.

---

### Task 1: Reine Halbzeitraum-Vergleichslogik

**Files:**
- Create: `src/features/fortschritt/lib/valueOverview.test.ts`
- Create: `src/features/fortschritt/lib/valueOverview.ts`

**Interfaces:**
- Consumes: `DailyLogEntry` und `DateRange` aus `src/features/fortschritt/types.ts`.
- Produces: `buildValueOverview(logs: DailyLogEntry[], range: DateRange): ValueOverviewRow[]`.
- Produces: `splitValueOverviewRange(range: DateRange): { first: DateRange | null; second: DateRange }`.
- Produces types `ValueOverviewKey`, `ValueOverviewTone`, `ValueOverviewDirection` und `ValueOverviewRow` for `WerteCard`.

- [ ] **Step 1: Write the failing tests for range splitting and per-metric minimum data**

Create `src/features/fortschritt/lib/valueOverview.test.ts` with fixtures that prove the split and row states:

```ts
import { describe, expect, it } from 'vitest'
import type { DailyLogEntry } from '../types'
import {
  buildValueOverview,
  splitValueOverviewRange,
} from './valueOverview'

const log = (
  log_date: string,
  values: Partial<Omit<DailyLogEntry, 'log_date'>>,
): DailyLogEntry => ({
  log_date,
  energie: null,
  schlaf: null,
  wohlbefinden: null,
  libido: null,
  body_fat_pct: null,
  ...values,
})

describe('splitValueOverviewRange', () => {
  it('legt bei einer ungeraden Tageszahl den zusätzlichen Tag in die zweite Hälfte', () => {
    expect(splitValueOverviewRange({ from: '2026-07-01', to: '2026-07-05' })).toEqual({
      first: { from: '2026-07-01', to: '2026-07-02' },
      second: { from: '2026-07-03', to: '2026-07-05' },
    })
  })

  it('behandelt einen einzelnen Tag als ausschließlich zweite Hälfte', () => {
    expect(splitValueOverviewRange({ from: '2026-07-05', to: '2026-07-05' })).toEqual({
      first: null,
      second: { from: '2026-07-05', to: '2026-07-05' },
    })
  })
})

describe('buildValueOverview', () => {
  it('zeigt den neueren Durchschnitt ab einem Wert, aber noch keinen Vergleich', () => {
    const rows = buildValueOverview(
      [log('2026-07-04', { energie: 8 })],
      { from: '2026-07-01', to: '2026-07-04' },
    )

    expect(rows.find(row => row.key === 'energie')).toMatchObject({
      average: 8,
      delta: null,
      tone: 'neutral',
      direction: null,
    })
  })

  it('berechnet nur Metriken mit mindestens zwei Werten pro Hälfte', () => {
    const rows = buildValueOverview([
      log('2026-07-01', { energie: 5, schlaf: 6 }),
      log('2026-07-02', { energie: 7 }),
      log('2026-07-03', { energie: 8, schlaf: 8 }),
      log('2026-07-04', { energie: 10 }),
    ], { from: '2026-07-01', to: '2026-07-04' })

    expect(rows.find(row => row.key === 'energie')).toMatchObject({ average: 9, delta: 3 })
    expect(rows.find(row => row.key === 'schlaf')).toMatchObject({ average: 8, delta: null })
  })

  it('liefert alle fünf Zeilen in der freigegebenen Reihenfolge', () => {
    const rows = buildValueOverview([], { from: '2026-07-01', to: '2026-07-04' })
    expect(rows.map(row => row.key)).toEqual([
      'energie', 'schlaf', 'wohlbefinden', 'libido', 'body_fat_pct',
    ])
    expect(rows.every(row => row.average === null && row.delta === null)).toBe(true)
  })

  it('rundet Durchschnitt und Delta auf eine Nachkommastelle', () => {
    const rows = buildValueOverview([
      log('2026-07-01', { energie: 5.1 }),
      log('2026-07-02', { energie: 5.2 }),
      log('2026-07-03', { energie: 6.2 }),
      log('2026-07-04', { energie: 6.3 }),
    ], { from: '2026-07-01', to: '2026-07-04' })

    expect(rows.find(row => row.key === 'energie')).toMatchObject({
      average: 6.3,
      delta: 1.1,
    })
  })
})
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```bash
npm test -- src/features/fortschritt/lib/valueOverview.test.ts
```

Expected: FAIL because `./valueOverview` does not exist.

- [ ] **Step 3: Implement the range split and base averages minimally**

Create `src/features/fortschritt/lib/valueOverview.ts` with these public types and helpers:

```ts
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { DailyLogEntry, DateRange } from '../types'
import { filterByDateRange } from './range'

export type ValueOverviewKey =
  | 'energie'
  | 'schlaf'
  | 'wohlbefinden'
  | 'libido'
  | 'body_fat_pct'

export type ValueOverviewTone = 'positive' | 'neutral' | 'warning' | 'negative'
export type ValueOverviewDirection = 'up' | 'down' | 'flat'

export interface ValueOverviewRow {
  key: ValueOverviewKey
  label: string
  unit: '' | '%'
  average: number | null
  delta: number | null
  tone: ValueOverviewTone
  direction: ValueOverviewDirection | null
}

const METRICS: ReadonlyArray<{
  key: ValueOverviewKey
  label: string
  unit: '' | '%'
}> = [
  { key: 'energie', label: 'Energie', unit: '' },
  { key: 'schlaf', label: 'Schlaf', unit: '' },
  { key: 'wohlbefinden', label: 'Wohlbefinden', unit: '' },
  { key: 'libido', label: 'Libido', unit: '' },
  { key: 'body_fat_pct', label: 'KFA', unit: '%' },
]

const isoDate = (date: Date) => format(date, 'yyyy-MM-dd')
const roundOne = (value: number) => Math.round(value * 10) / 10

export function splitValueOverviewRange(range: DateRange): {
  first: DateRange | null
  second: DateRange
} {
  const from = parseISO(range.from)
  const days = Math.max(1, differenceInCalendarDays(parseISO(range.to), from) + 1)
  const firstDays = Math.floor(days / 2)
  const secondFrom = addDays(from, firstDays)

  return {
    first: firstDays === 0
      ? null
      : { from: range.from, to: isoDate(addDays(from, firstDays - 1)) },
    second: { from: isoDate(secondFrom), to: range.to },
  }
}

function valuesFor(
  logs: DailyLogEntry[],
  range: DateRange | null,
  key: ValueOverviewKey,
): number[] {
  if (!range) return []
  return filterByDateRange(logs, range, entry => entry.log_date)
    .map(entry => entry[key])
    .filter((value): value is number => value != null && Number.isFinite(value))
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
```

Add `buildValueOverview` initially with neutral classification so the base tests pass:

```ts
export function buildValueOverview(
  logs: DailyLogEntry[],
  range: DateRange,
): ValueOverviewRow[] {
  const halves = splitValueOverviewRange(range)

  return METRICS.map(metric => {
    const first = valuesFor(logs, halves.first, metric.key)
    const second = valuesFor(logs, halves.second, metric.key)
    const firstAverage = average(first)
    const secondAverage = average(second)
    const rawDelta = first.length >= 2 && second.length >= 2
      && firstAverage != null && secondAverage != null
      ? secondAverage - firstAverage
      : null

    return {
      ...metric,
      average: secondAverage == null ? null : roundOne(secondAverage),
      delta: rawDelta == null ? null : roundOne(rawDelta),
      tone: 'neutral',
      direction: rawDelta == null ? null : 'flat',
    }
  })
}
```

- [ ] **Step 4: Run the base tests and verify green**

Run:

```bash
npm test -- src/features/fortschritt/lib/valueOverview.test.ts
```

Expected: PASS for range splitting, averages, minimum counts and row order.

- [ ] **Step 5: Add failing boundary tests for all four tones and KFA inversion**

Append to `valueOverview.test.ts`:

```ts
it('klassifiziert Wellness-Verbesserung, leichte und deutliche Verschlechterung', () => {
  const rows = buildValueOverview([
    log('2026-07-01', { energie: 5, schlaf: 8, wohlbefinden: 8 }),
    log('2026-07-02', { energie: 5, schlaf: 8, wohlbefinden: 8 }),
    log('2026-07-03', { energie: 5.2, schlaf: 7.5, wohlbefinden: 7 }),
    log('2026-07-04', { energie: 5.2, schlaf: 7.5, wohlbefinden: 7 }),
  ], { from: '2026-07-01', to: '2026-07-04' })

  expect(rows.find(row => row.key === 'energie')).toMatchObject({
    delta: 0.2, tone: 'positive', direction: 'up',
  })
  expect(rows.find(row => row.key === 'schlaf')).toMatchObject({
    delta: -0.5, tone: 'warning', direction: 'down',
  })
  expect(rows.find(row => row.key === 'wohlbefinden')).toMatchObject({
    delta: -1, tone: 'negative', direction: 'down',
  })
})

it('behandelt sinkenden KFA als Verbesserung und steigenden KFA als Warnung', () => {
  const improved = buildValueOverview([
    log('2026-07-01', { body_fat_pct: 18 }),
    log('2026-07-02', { body_fat_pct: 18 }),
    log('2026-07-03', { body_fat_pct: 17.8 }),
    log('2026-07-04', { body_fat_pct: 17.8 }),
  ], { from: '2026-07-01', to: '2026-07-04' })
  const worsened = buildValueOverview([
    log('2026-07-01', { body_fat_pct: 18 }),
    log('2026-07-02', { body_fat_pct: 18 }),
    log('2026-07-03', { body_fat_pct: 18.5 }),
    log('2026-07-04', { body_fat_pct: 18.5 }),
  ], { from: '2026-07-01', to: '2026-07-04' })

  expect(improved.at(-1)).toMatchObject({
    delta: -0.2, tone: 'positive', direction: 'down',
  })
  expect(worsened.at(-1)).toMatchObject({
    delta: 0.5, tone: 'warning', direction: 'up',
  })
})

it('lässt Änderungen unter 0,2 neutral', () => {
  const rows = buildValueOverview([
    log('2026-07-01', { libido: 6 }),
    log('2026-07-02', { libido: 6 }),
    log('2026-07-03', { libido: 6.1 }),
    log('2026-07-04', { libido: 6.1 }),
  ], { from: '2026-07-01', to: '2026-07-04' })

  expect(rows.find(row => row.key === 'libido')).toMatchObject({
    delta: 0.1, tone: 'neutral', direction: 'flat',
  })
})
```

- [ ] **Step 6: Run the focused test and verify tone failures**

Run:

```bash
npm test -- src/features/fortschritt/lib/valueOverview.test.ts
```

Expected: FAIL because every compared row is still returned as neutral/flat.

- [ ] **Step 7: Implement the single tone classifier and use the raw delta**

Add before `buildValueOverview`:

```ts
function classifyChange(
  key: ValueOverviewKey,
  delta: number,
): Pick<ValueOverviewRow, 'tone' | 'direction'> {
  const magnitude = Math.abs(delta)
  if (magnitude < 0.2 - 1e-9) return { tone: 'neutral', direction: 'flat' }

  const direction: ValueOverviewDirection = delta > 0 ? 'up' : 'down'
  const improved = key === 'body_fat_pct' ? delta < 0 : delta > 0
  if (improved) return { tone: 'positive', direction }

  return {
    tone: magnitude >= 1 - 1e-9 ? 'negative' : 'warning',
    direction,
  }
}
```

Replace the neutral return fields inside `buildValueOverview` with:

```ts
const status = rawDelta == null
  ? { tone: 'neutral' as const, direction: null }
  : classifyChange(metric.key, rawDelta)

return {
  ...metric,
  average: secondAverage == null ? null : roundOne(secondAverage),
  delta: rawDelta == null ? null : roundOne(rawDelta),
  ...status,
}
```

- [ ] **Step 8: Run the pure tests and commit Task 1**

Run:

```bash
npm test -- src/features/fortschritt/lib/valueOverview.test.ts
```

Expected: all tests in `valueOverview.test.ts` PASS.

Commit only Task 1 files:

```bash
git add src/features/fortschritt/lib/valueOverview.ts src/features/fortschritt/lib/valueOverview.test.ts
git commit -m "feat(fortschritt): calculate period value comparisons"
```

---

### Task 2: Kompakte Wertekarte

**Files:**
- Create: `src/features/fortschritt/components/werte/WerteCard.test.ts`
- Create: `src/features/fortschritt/components/werte/WerteCard.tsx`

**Interfaces:**
- Consumes: `buildValueOverview(dailyLogs, range)` and `ValueOverviewRow` from Task 1.
- Consumes props `{ dailyLogs: DailyLogEntry[]; range: DateRange }`.
- Produces: `WerteCard`, a dashboard section with five stable metric rows.

- [ ] **Step 1: Write the failing component-source contract test**

Create `src/features/fortschritt/components/werte/WerteCard.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./WerteCard.tsx', import.meta.url), 'utf8')

describe('WerteCard', () => {
  it('zeigt die freigegebene Überschrift und den Halbzeitraum-Kontext', () => {
    expect(source).toContain('Deine Werte')
    expect(source).toContain('Ø zweite Hälfte')
    expect(source).toContain('buildValueOverview(dailyLogs, range)')
  })

  it('nutzt ausschließlich die vier Statusfarben für die Veränderung', () => {
    expect(source).toContain("positive: '#10b981'")
    expect(source).toContain("warning: '#f59e0b'")
    expect(source).toContain("negative: '#ef4444'")
    expect(source).toContain("neutral: 'var(--text-muted)'")
    expect(source).toContain('color: TONE_COLORS[row.tone]')
  })

  it('zeigt definierte Leer- und Vergleichszustände', () => {
    expect(source).toContain('Keine Daten')
    expect(source).toContain('Noch kein Vergleich')
    expect(source).not.toContain('Gewicht')
    expect(source).not.toContain('Blutwerte')
  })
})
```

- [ ] **Step 2: Run the focused test and verify the red state**

Run:

```bash
npm test -- src/features/fortschritt/components/werte/WerteCard.test.ts
```

Expected: FAIL because `WerteCard.tsx` does not exist.

- [ ] **Step 3: Implement the compact list card**

Create `src/features/fortschritt/components/werte/WerteCard.tsx` with the exact component skeleton below. Keep all geometry local to this card and do not modify `FotosCard`.

```tsx
import { TrendingUp } from 'lucide-react'
import type { DailyLogEntry, DateRange } from '../../types'
import {
  buildValueOverview,
  type ValueOverviewDirection,
  type ValueOverviewTone,
} from '../../lib/valueOverview'
import { panel, sectionLabel } from '../../styles'

interface Props {
  dailyLogs: DailyLogEntry[]
  range: DateRange
}

const TONE_COLORS: Record<ValueOverviewTone, string> = {
  positive: '#10b981',
  neutral: 'var(--text-muted)',
  warning: '#f59e0b',
  negative: '#ef4444',
}

const ARROWS: Record<ValueOverviewDirection, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
}

const number = (value: number) => value.toLocaleString('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const valueWithUnit = (value: number, unit: '' | '%') =>
  unit ? number(value) + ' ' + unit : number(value)

export function WerteCard({ dailyLogs, range }: Props) {
  const rows = buildValueOverview(dailyLogs, range)

  return (
    <section style={{
      ...panel,
      padding: '14px 14px 12px',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ ...sectionLabel, margin: 0 }}>Deine Werte</p>
        <TrendingUp size={16} color="var(--accent)" aria-hidden="true" />
      </div>
      <p style={{ margin: '3px 0 8px', fontSize: '0.58rem', color: 'var(--text-muted)' }}>
        Ø zweite Hälfte
      </p>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}>
        {rows.map(row => (
          <div key={row.key} style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minHeight: 34,
            borderBottom: row.key === 'body_fat_pct' ? 'none' : '1px solid var(--border)',
          }}>
            <span style={{
              minWidth: 0,
              overflow: 'hidden',
              color: 'var(--text-muted)',
              fontSize: '0.64rem',
              fontWeight: 800,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {row.label}
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
              {row.average == null ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.62rem', fontWeight: 700 }}>
                  Keine Daten
                </span>
              ) : (
                <>
                  <strong style={{ color: 'var(--text-dim)', fontSize: '0.82rem', fontWeight: 900 }}>
                    {valueWithUnit(row.average, row.unit)}
                  </strong>
                  {row.delta == null || row.direction == null ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.55rem', fontWeight: 700 }}>
                      Noch kein Vergleich
                    </span>
                  ) : (
                    <span
                      aria-label={`Veränderung ${valueWithUnit(row.delta, row.unit)}`}
                      style={{ color: TONE_COLORS[row.tone], fontSize: '0.62rem', fontWeight: 800 }}
                    >
                      {ARROWS[row.direction]} {row.delta > 0 ? '+' : ''}{valueWithUnit(row.delta, row.unit)}
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run component and library tests**

Run:

```bash
npm test -- src/features/fortschritt/components/werte/WerteCard.test.ts src/features/fortschritt/lib/valueOverview.test.ts
```

Expected: both test files PASS.

- [ ] **Step 5: Run TypeScript/Vite build and commit Task 2**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite finish with exit code 0.

Commit only Task 2 files:

```bash
git add src/features/fortschritt/components/werte/WerteCard.tsx src/features/fortschritt/components/werte/WerteCard.test.ts
git commit -m "feat(fortschritt): add personal values overview card"
```

---

### Task 3: Dashboard-Ersatz und Abschlussverifikation

**Files:**
- Modify: `src/features/fortschritt/components/FortschrittDashboard.tsx`
- Modify: `src/features/fortschritt/components/fortschrittRemoval.test.ts`
- Delete: `src/features/fortschritt/components/blutwerte/BlutwerteCard.tsx`

**Interfaces:**
- Consumes: `WerteCard({ dailyLogs, range })` from Task 2.
- Preserves: `bloodwork` in `FortschrittDashboard` for `computeTopChanges` and chart trend candidates.
- Produces: dashboard pair `<FotosCard ... />` plus `<WerteCard dailyLogs={dailyLogs} range={pageRange} />`.

- [ ] **Step 1: Add the failing dashboard wiring assertions**

Extend `src/features/fortschritt/components/fortschrittRemoval.test.ts` inside the existing `describe`:

```ts
test('ersetzt nur die Fortschritt-Blutwertekarte durch Deine Werte', () => {
  const dashboard = readSource('./FortschrittDashboard.tsx')

  expect(dashboard).toContain("import { WerteCard } from './werte/WerteCard'")
  expect(dashboard).toContain('<WerteCard dailyLogs={dailyLogs} range={pageRange} />')
  expect(dashboard).not.toContain('BlutwerteCard')
  expect(dashboard).toContain('computeTopChanges(pageRange, weightLogs, dailyLogs, bloodwork)')
})
```

- [ ] **Step 2: Run the focused integration test and verify red**

Run:

```bash
npm test -- src/features/fortschritt/components/fortschrittRemoval.test.ts
```

Expected: FAIL because the dashboard still imports and renders `BlutwerteCard`.

- [ ] **Step 3: Replace the dashboard card surgically**

In `src/features/fortschritt/components/FortschrittDashboard.tsx` replace:

```tsx
import { BlutwerteCard } from './blutwerte/BlutwerteCard'
```

with:

```tsx
import { WerteCard } from './werte/WerteCard'
```

Replace only the second card in the existing two-column grid:

```tsx
<FotosCard photos={photos} range={pageRange} onChange={onReload} />
<WerteCard dailyLogs={dailyLogs} range={pageRange} />
```

Delete `src/features/fortschritt/components/blutwerte/BlutwerteCard.tsx` after `rg "BlutwerteCard" src` confirms that no remaining consumer exists. Do not remove `bloodwork` from the dashboard state destructuring because Top-Veränderungen and trend candidates still use it.

- [ ] **Step 4: Run focused integration, card and pure tests**

Run:

```bash
npm test -- src/features/fortschritt/components/fortschrittRemoval.test.ts src/features/fortschritt/components/werte/WerteCard.test.ts src/features/fortschritt/lib/valueOverview.test.ts
```

Expected: all focused tests PASS.

- [ ] **Step 5: Run the complete regression suite**

Run:

```bash
npm test
```

Expected: all Vitest test files PASS with zero failures.

- [ ] **Step 6: Run lint and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands finish with exit code 0. If lint reports an unrelated pre-existing error, record the exact file and message; do not modify unrelated code.

- [ ] **Step 7: Perform the mobile visual checklist**

Start the existing Vite app with:

```bash
npm run dev -- --host 127.0.0.1
```

Open Fortschritt at a mobile viewport close to `390×844` and verify all of the following before committing:

- Fotos- und Wertekarte remain equal height in the existing two-column grid.
- All five labels are readable without horizontal page scrolling.
- Main values stay neutral; only arrow and delta use green, orange, red or gray.
- KFA decrease is green/down and KFA increase is orange or red/up.
- A row with one newer value shows its average plus `Noch kein Vergleich`.
- A row without a newer value shows `Keine Daten`.
- Changing the top period updates the values without changing the card structure.
- Chart, top-change animations and Fotos interactions behave as before.

- [ ] **Step 8: Commit the dashboard integration**

Stage only the integration files:

```bash
git add src/features/fortschritt/components/FortschrittDashboard.tsx src/features/fortschritt/components/fortschrittRemoval.test.ts
git add -u src/features/fortschritt/components/blutwerte/BlutwerteCard.tsx
git commit -m "feat(fortschritt): replace bloodwork card with value trends"
```

---

## Final Verification

- [ ] Confirm the three implementation commits contain only the files listed per task with `git show --stat --oneline HEAD~2..HEAD`.
- [ ] Confirm `rg "BlutwerteCard" src/features/fortschritt` returns no matches.
- [ ] Confirm `rg "WerteCard" src/features/fortschritt/components/FortschrittDashboard.tsx` shows the import and the `dailyLogs`/`pageRange` props.
- [ ] Re-run `npm test`, `npm run lint`, and `npm run build` immediately before reporting completion.
- [ ] Report the exact test-file/test-count output and build result; mention any unrelated pre-existing lint failure verbatim instead of changing adjacent code.
