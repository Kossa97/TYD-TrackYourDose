# Wertevergleich-Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Wertekarte verwendet weiterhin bevorzugt die beiden Kalenderhälften, fällt bei ungleich verteilten Messungen ab vier Gesamtwerten aber auf zwei chronologisch gleich große Messwertgruppen zurück.

**Architecture:** Die Änderung bleibt vollständig in der reinen Funktion `buildValueOverview`. Eine interne Hilfsfunktion wählt entweder die bestehenden Kalendergruppen oder teilt alle im ausgewählten Zeitraum vorhandenen Werte; React-Komponente, Datenbank und Ladeweg bleiben unverändert.

**Tech Stack:** TypeScript, date-fns, Vitest

## Global Constraints

- Der Fallback gilt für `30T`, `90T`, `6M`, `1J` und `Alles`.
- Der Fallback berücksichtigt ausschließlich Werte innerhalb des ausgewählten Zeitraums.
- Der Kalendervergleich bleibt Standard, sobald jede Kalenderhälfte mindestens `2` Werte enthält.
- Unter `4` Gesamtwerten wird kein Delta berechnet.
- Bei ungerader Messwertanzahl erhält die neuere Gruppe den zusätzlichen Wert.
- Reihenfolge, Rundung, Statusfarben, KFA-Invertierung, Kartenhöhe und Zeilenlayout bleiben unverändert.

---

### Task 1: Metrikspezifischen Vergleichs-Fallback implementieren

**Files:**
- Modify: `src/features/fortschritt/lib/valueOverview.test.ts`
- Modify: `src/features/fortschritt/lib/valueOverview.ts:45-105`

**Interfaces:**
- Consumes: `buildValueOverview(logs: DailyLogEntry[], range: DateRange): ValueOverviewRow[]`
- Produces: Unveränderte öffentliche Signatur von `buildValueOverview`; nur die interne Gruppenauswahl ändert sich.

- [ ] **Step 1: Failing regression tests schreiben**

In `src/features/fortschritt/lib/valueOverview.test.ts` `addDays`, `format` und `parseISO` importieren und im bestehenden `describe('buildValueOverview', ...)` diese Tests ergänzen:

```ts
import { addDays, format, parseISO } from 'date-fns'

const dayFrom = (start: string, offset: number) =>
  format(addDays(parseISO(start), offset), 'yyyy-MM-dd')

it('behält bei mindestens zwei Werten pro Kalenderhälfte den Kalendervergleich', () => {
  const older = Array.from({ length: 15 }, (_, index) =>
    log(dayFrom('2026-07-01', index), { energie: 4 }),
  )
  const newer = [
    log('2026-07-16', { energie: 8 }),
    log('2026-07-17', { energie: 8 }),
  ]

  const row = buildValueOverview(
    [...older, ...newer],
    { from: '2026-07-01', to: '2026-07-30' },
  ).find(item => item.key === 'energie')

  expect(row).toMatchObject({ average: 8, delta: 4 })
})

it('teilt 15 ältere und einen neueren Wert per Fallback in 8 gegen 8', () => {
  const older = Array.from({ length: 15 }, (_, index) =>
    log(dayFrom('2026-07-01', index), { energie: 4 }),
  )
  const newer = log('2026-07-16', { energie: 8 })

  const row = buildValueOverview(
    [newer, ...older],
    { from: '2026-07-01', to: '2026-07-30' },
  ).find(item => item.key === 'energie')

  expect(row).toMatchObject({ average: 4.5, delta: 0.5 })
})

it('teilt 101 ungleich verteilte Werte in 50 ältere und 51 neuere Messwerte', () => {
  const firstFifty = Array.from({ length: 50 }, (_, index) =>
    log(dayFrom('2026-01-01', index), { energie: 4 }),
  )
  const nextFifty = Array.from({ length: 50 }, (_, index) =>
    log(dayFrom('2026-02-20', index), { energie: 6 }),
  )
  const finalValue = log('2026-12-31', { energie: 8 })

  const row = buildValueOverview(
    [finalValue, ...nextFifty.reverse(), ...firstFifty.reverse()],
    { from: '2026-01-01', to: '2026-12-31' },
  ).find(item => item.key === 'energie')

  expect(row).toMatchObject({ average: 6, delta: 2 })
})

it('zeigt bei ein bis drei Werten deren Durchschnitt ohne Vergleich', () => {
  const row = buildValueOverview([
    log('2026-07-01', { schlaf: 4 }),
    log('2026-07-02', { schlaf: 6 }),
    log('2026-07-03', { schlaf: 8 }),
    log('2026-06-30', { schlaf: 10 }),
  ], { from: '2026-07-01', to: '2026-07-30' })
    .find(item => item.key === 'schlaf')

  expect(row).toMatchObject({
    average: 6,
    delta: null,
    tone: 'neutral',
    direction: null,
  })
})
```

- [ ] **Step 2: RED verifizieren**

Run:

```bash
npm test -- src/features/fortschritt/lib/valueOverview.test.ts
```

Expected: Die bestehenden Tests bestehen; die neuen Fallback-Tests scheitern, weil die aktuelle Implementierung nur die zweite Kalenderhälfte mittelt und bei weniger als zwei Werten pro Hälfte kein Delta erzeugt.

- [ ] **Step 3: Minimale Gruppenauswahl implementieren**

In `src/features/fortschritt/lib/valueOverview.ts` sicherstellen, dass `valuesFor` unabhängig von der Eingabereihenfolge chronologisch sortiert:

```ts
function valuesFor(
  logs: DailyLogEntry[],
  range: DateRange | null,
  key: ValueOverviewKey,
): number[] {
  if (!range) return []
  return filterByDateRange(logs, range, entry => entry.log_date)
    .map(entry => ({ date: entry.log_date, value: entry[key] }))
    .filter((entry): entry is { date: string; value: number } =>
      entry.value != null && Number.isFinite(entry.value),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(entry => entry.value)
}
```

Direkt nach `average` die interne Auswahlfunktion ergänzen:

```ts
function comparisonGroups(
  all: number[],
  calendarFirst: number[],
  calendarSecond: number[],
): { first: number[]; second: number[] } {
  if (calendarFirst.length >= 2 && calendarSecond.length >= 2) {
    return { first: calendarFirst, second: calendarSecond }
  }
  if (all.length < 4) return { first: [], second: all }

  const firstSize = Math.floor(all.length / 2)
  return {
    first: all.slice(0, firstSize),
    second: all.slice(firstSize),
  }
}
```

In `buildValueOverview` die Gruppen vor der Mittelwertbildung auswählen:

```ts
const all = valuesFor(logs, range, metric.key)
const calendarFirst = valuesFor(logs, halves.first, metric.key)
const calendarSecond = valuesFor(logs, halves.second, metric.key)
const { first, second } = comparisonGroups(all, calendarFirst, calendarSecond)
const firstAverage = average(first)
const secondAverage = average(second)
```

Die bestehende Berechnung von `rawDelta`, Rundung und Status unverändert lassen.

- [ ] **Step 4: GREEN verifizieren**

Run:

```bash
npm test -- src/features/fortschritt/lib/valueOverview.test.ts
```

Expected: Alle Tests in `valueOverview.test.ts` bestehen, einschließlich `15/2`, `15/1 → 8/8`, `101 → 50/51` und `1–3` Werte.

- [ ] **Step 5: Geänderte Dateien linten**

Run:

```bash
npx eslint src/features/fortschritt/lib/valueOverview.ts src/features/fortschritt/lib/valueOverview.test.ts
```

Expected: Exit-Code `0`, keine Fehler oder Warnungen.

- [ ] **Step 6: Vollständige Regression verifizieren**

Run:

```bash
npm test
npm run build
```

Expected: Gesamte Vitest-Suite ohne Fehler; TypeScript- und Vite-Produktions-Build mit Exit-Code `0`.

- [ ] **Step 7: Änderung separat committen**

```bash
git add -- src/features/fortschritt/lib/valueOverview.ts src/features/fortschritt/lib/valueOverview.test.ts docs/superpowers/plans/2026-07-17-wertevergleich-fallback.md
git commit -m "fix(fortschritt): compare uneven metric histories"
```

