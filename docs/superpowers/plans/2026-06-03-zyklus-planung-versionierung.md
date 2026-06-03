# Zyklus-Planung versionieren — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schedule- und Basis-Dosis-Änderungen eines Zyklus gelten ab dem Änderungsdatum statt rückwirkend; vergangene Tage behalten die damalige Planung.

**Architecture:** Neue `jsonb`-Spalte `schedule_history` auf `cycles` mit chronologischen Segmenten. Ein zentraler `scheduleForDay(cycle, day)`-Resolver in `intakeSchedule.ts` löst pro Tag Frequenz, Einnahmezeiten und Dosis auf; `cycleAppliesToDay`, die Slot-Expansion und `effectiveDose` nutzen ihn. Die flachen Zyklus-Felder bleiben das aktuelle Segment (Cron + Home-Heute unverändert). Abwärtskompatibel ohne Migration.

**Tech Stack:** TypeScript, React, Supabase (Postgres `jsonb`), Vitest, date-fns.

**Spec:** `docs/superpowers/specs/2026-06-03-zyklus-planung-versionierung-design.md`

---

## File Structure

- `supabase-cycle-schedule-history.sql` — **Create.** `ALTER TABLE` für die neue Spalte.
- `src/lib/intakeSchedule.ts` — **Modify.** Neue Typen `ScheduleSegment`, `EscalationRow`; `scheduleForDay`; `effectiveDose`; `cycleAppliesToDay`/`cycleDaySlots` nutzen `scheduleForDay`; `ScheduleCycle` erweitert.
- `src/lib/intakeSchedule.test.ts` — **Modify.** Tests für `scheduleForDay`, `effectiveDose`, Frequenzwechsel-Overdue.
- `src/pages/Dashboard.tsx` — **Modify.** Lokale `cycleAppliesToDay`/`effectiveDose` entfernen, aus lib importieren; `cycleSlots` + Basis-Dosis-Anzeige über `scheduleForDay`; `Cycle`-Interface + `loadCycles`-Select um `schedule_history`.
- `src/pages/Home.tsx` — **Modify.** Lokale `effectiveDose`/`EscalationRow` entfernen, aus lib importieren; `cycleData`-Select um `schedule_history`.
- `src/pages/Peptide.tsx` — **Modify.** `saveCycle` schreibt `schedule_history`.

---

## Task 1: Schema-Spalte + Resolver `scheduleForDay`

**Files:**
- Create: `supabase-cycle-schedule-history.sql`
- Modify: `src/lib/intakeSchedule.ts`
- Test: `src/lib/intakeSchedule.test.ts`

- [ ] **Step 1: SQL-Migration anlegen**

Create `supabase-cycle-schedule-history.sql`:

```sql
-- Versionierte Zyklus-Planung: Array von Segmenten { effective_from, frequency,
-- intake_time, intake_time_custom, x_days_interval, schedule_days, dose, unit }.
-- Leere/NULL-Historie => flache cycles-Felder gelten ab start_date (abwärtskompatibel).
alter table cycles add column if not exists schedule_history jsonb;
```

- [ ] **Step 2: Typen + `scheduleForDay` — failing test schreiben**

In `src/lib/intakeSchedule.test.ts` oben ergänzen (Import erweitern und Block anhängen):

```ts
import { findOldestOverdueIntake, scheduleForDay, type ScheduleCycle, type IntakeLog, type ScheduleSegment } from './intakeSchedule'

const seg = (effective_from: string, intake_time: string, dose: number): ScheduleSegment => ({
  effective_from, frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time, intake_time_custom: null, dose, unit: 'mcg',
})
const versioned: ScheduleCycle = {
  id: 'c1', peptide_id: 'p1', start_date: '2026-01-01', end_date: null,
  frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time: 'morgens,abends', intake_time_custom: null, dose: 300, unit: 'mcg',
  schedule_history: [seg('2026-01-01', 'morgens', 200), seg('2026-03-01', 'morgens,abends', 300)],
}

describe('scheduleForDay', () => {
  it('leere Historie => flache Felder', () => {
    const flat = { ...versioned, schedule_history: null }
    expect(scheduleForDay(flat, new Date(2026, 0, 15)).dose).toBe(300)
    expect(scheduleForDay(flat, new Date(2026, 0, 15)).intake_time).toBe('morgens,abends')
  })
  it('vor zweitem Segment => erstes Segment', () => {
    expect(scheduleForDay(versioned, new Date(2026, 1, 1)).intake_time).toBe('morgens')
    expect(scheduleForDay(versioned, new Date(2026, 1, 1)).dose).toBe(200)
  })
  it('genau am effective_from des zweiten Segments => zweites Segment', () => {
    expect(scheduleForDay(versioned, new Date(2026, 2, 1)).intake_time).toBe('morgens,abends')
  })
  it('nach zweitem Segment => zweites Segment', () => {
    expect(scheduleForDay(versioned, new Date(2026, 5, 1)).dose).toBe(300)
  })
})
```

- [ ] **Step 3: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/intakeSchedule.test.ts`
Expected: FAIL (`scheduleForDay`/`ScheduleSegment` nicht exportiert).

- [ ] **Step 4: Typen + Resolver implementieren**

In `src/lib/intakeSchedule.ts` `import` um `format` ergänzen ist bereits vorhanden. `ScheduleCycle` erweitern und neue Typen/Funktion hinzufügen:

```ts
export interface ScheduleSegment {
  effective_from: string            // 'yyyy-MM-dd'
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  intake_time: string | null
  intake_time_custom: string | null
  dose: number
  unit: string
}

export interface ScheduleCycle {
  id: string
  peptide_id: string
  start_date: string
  end_date: string | null
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  intake_time: string | null
  intake_time_custom: string | null
  dose: number
  unit: string
  schedule_history: ScheduleSegment[] | null
}

// Active schedule segment for a given day. Empty history => flat cycle fields from start_date.
export function scheduleForDay(cycle: ScheduleCycle, day: Date): ScheduleSegment {
  const flat: ScheduleSegment = {
    effective_from: cycle.start_date,
    frequency: cycle.frequency,
    x_days_interval: cycle.x_days_interval,
    schedule_days: cycle.schedule_days,
    intake_time: cycle.intake_time,
    intake_time_custom: cycle.intake_time_custom,
    dose: cycle.dose,
    unit: cycle.unit,
  }
  const history = cycle.schedule_history
  if (!history || history.length === 0) return flat
  const dayKey = format(day, 'yyyy-MM-dd')
  const sorted = [...history].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  let seg = sorted[0]
  for (const s of sorted) {
    if (s.effective_from <= dayKey) seg = s
    else break
  }
  return seg
}
```

> Hinweis: Die alte `ScheduleCycle` (ohne `dose`/`unit`/`schedule_history`) wird ersetzt. `dose`/`unit` sind jetzt Pflichtfelder.

- [ ] **Step 5: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/lib/intakeSchedule.test.ts`
Expected: PASS (scheduleForDay-Block grün; bestehende Overdue-Tests evtl. rot wegen fehlender `dose`/`unit`/`schedule_history` im Test-Cycle — in Task 3 behoben).

- [ ] **Step 6: Commit**

```bash
git add supabase-cycle-schedule-history.sql src/lib/intakeSchedule.ts src/lib/intakeSchedule.test.ts
git commit -m "Schema + scheduleForDay: versionierte Zyklus-Planung (Resolver)"
```

---

## Task 2: `cycleAppliesToDay`, `cycleDaySlots`, `effectiveDose` über `scheduleForDay`

**Files:**
- Modify: `src/lib/intakeSchedule.ts`
- Test: `src/lib/intakeSchedule.test.ts`

- [ ] **Step 1: `effectiveDose`-Test schreiben (failing)**

In `src/lib/intakeSchedule.test.ts` anhängen:

```ts
import { effectiveDose, type EscalationRow } from './intakeSchedule'

describe('effectiveDose mit versionierter Basis-Dosis + Eskalation', () => {
  const esc: EscalationRow = { cycle_id: 'c1', increase_amount: 50, start_type: 'after_days', start_date: null, start_after_days: 14 }
  it('Basis aus Segment + aktive Eskalation', () => {
    // Basis 200 bis 2026-03-01, danach 300; Eskalation +50 ab Tag 14 (relativ start 2026-01-01)
    expect(effectiveDose(versioned, new Date(2026, 0, 5), [esc])).toBe(200)   // Tag 4, keine Eskalation
    expect(effectiveDose(versioned, new Date(2026, 0, 20), [esc])).toBe(250)  // Tag 19, +50
    expect(effectiveDose(versioned, new Date(2026, 5, 1), [esc])).toBe(350)   // Segment 300 + 50
  })
})
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/intakeSchedule.test.ts -t effectiveDose`
Expected: FAIL (`effectiveDose`/`EscalationRow` nicht exportiert).

- [ ] **Step 3: `EscalationRow` + `effectiveDose` hinzufügen, `cycleAppliesToDay`/`cycleDaySlots` umstellen**

In `src/lib/intakeSchedule.ts`:

```ts
export interface EscalationRow {
  cycle_id: string
  increase_amount: number
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null
  start_after_days: number | null
}

// Effective dose for a cycle on a given day: segment base dose + active escalations.
export function effectiveDose(cycle: ScheduleCycle, day: Date, escalations: EscalationRow[]): number {
  const daysFromStart = differenceInDays(day, parseISO(cycle.start_date))
  let total = scheduleForDay(cycle, day).dose
  for (const esc of escalations.filter(e => e.cycle_id === cycle.id)) {
    if (esc.start_type === 'date' && esc.start_date) {
      if (day >= parseISO(esc.start_date)) total += esc.increase_amount
    } else if (esc.start_after_days != null) {
      if (daysFromStart >= esc.start_after_days) total += esc.increase_amount
    }
  }
  return total
}
```

`cycleAppliesToDay` so anpassen, dass die Frequenz-Felder aus dem Tages-Segment kommen (Body ersetzen):

```ts
export function cycleAppliesToDay(cycle: ScheduleCycle, day: Date): boolean {
  const start = parseISO(cycle.start_date)
  const end = cycle.end_date ? parseISO(cycle.end_date) : null
  if (day < start) return false
  if (end && day > end) return false

  const seg = scheduleForDay(cycle, day)
  const freq = seg.frequency
  const dayOfWeek = WEEKDAYS_DE[day.getDay()]
  const diff = differenceInDays(day, start)
  const hasDayFilter = (seg.schedule_days ?? []).length > 0

  if (freq === 'Täglich' || freq === '2x täglich' || freq === '3x täglich')
    return hasDayFilter ? (seg.schedule_days ?? []).includes(dayOfWeek) : true
  if (freq === 'Jeden 2. Tag') return diff % 2 === 0
  if (freq === 'Alle X Tage') {
    const intervalOk = diff % (seg.x_days_interval ?? 2) === 0
    return intervalOk && (hasDayFilter ? (seg.schedule_days ?? []).includes(dayOfWeek) : true)
  }
  if (freq === '5 Tage an / 2 aus') return diff % 7 < 5
  if (freq === 'Mo-Fr') return day.getDay() >= 1 && day.getDay() <= 5
  if (freq === 'Wöchentlich') return diff % 7 === 0
  if (freq === 'Wochentage wählen') return (seg.schedule_days ?? []).includes(dayOfWeek)
  return false
}
```

`cycleDaySlots` auf `(cycle, day)` umstellen (Signatur + Body):

```ts
// All scheduled slots of a cycle ON a given day, sorted by time (segment-resolved).
function cycleDaySlots(c: ScheduleCycle, day: Date): { min: number; time: string }[] {
  const seg = scheduleForDay(c, day)
  const slots = (seg.intake_time ?? '').split(',').filter(Boolean)
  const customs = (seg.intake_time_custom ?? '').split(',')
  const out: { min: number; time: string }[] = []
  slots.forEach((slot, i) => {
    const tm = slot === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slot] ?? '')
    if (!tm) return
    const [h, m] = tm.split(':').map(Number)
    out.push({ min: h * 60 + m, time: tm })
  })
  return out.sort((a, b) => a.min - b.min)
}
```

- [ ] **Step 4: Aufrufstelle in `findOldestOverdueIntake` anpassen**

In `findOldestOverdueIntake` die Zeile `for (const s of cycleDaySlots(c)) {` ersetzen durch:

```ts
      for (const s of cycleDaySlots(c, day)) {
```

- [ ] **Step 5: Tests laufen lassen — effectiveDose grün**

Run: `npx vitest run src/lib/intakeSchedule.test.ts -t effectiveDose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/intakeSchedule.ts src/lib/intakeSchedule.test.ts
git commit -m "intakeSchedule: cycleAppliesToDay/Slots/effectiveDose ueber scheduleForDay"
```

---

## Task 3: Overdue-Test mit Frequenzwechsel + bestehende Tests anpassen

**Files:**
- Test: `src/lib/intakeSchedule.test.ts`

- [ ] **Step 1: Bestehende Overdue-Test-Fixtures um Pflichtfelder ergänzen**

Im bestehenden `cycle`-Objekt (1× → 2× Tests aus früherem Fix) die neuen Pflichtfelder ergänzen und `log`-Helfer beibehalten:

```ts
const cycle: ScheduleCycle = {
  id: 'c1', peptide_id: 'p1', start_date: '2026-06-03', end_date: null,
  frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time: 'morgens,abends', intake_time_custom: null,
  dose: 200, unit: 'mcg', schedule_history: null,
}
```

- [ ] **Step 2: Frequenzwechsel-Test schreiben (failing-fähig)**

Anhängen:

```ts
describe('findOldestOverdueIntake — Frequenzwechsel gilt ab Aenderung', () => {
  // 1x taeglich (morgens) ab 2026-05-01, ab 2026-06-03 auf 2x (morgens,abends).
  const changed: ScheduleCycle = {
    id: 'c2', peptide_id: 'p2', start_date: '2026-05-01', end_date: null,
    frequency: '2x täglich', x_days_interval: null, schedule_days: null,
    intake_time: 'morgens,abends', intake_time_custom: null, dose: 200, unit: 'mcg',
    schedule_history: [
      seg2('2026-05-01', 'morgens'),
      seg2('2026-06-03', 'morgens,abends'),
    ],
  }
  const names2 = new Map([['p2', 'CJC-1295']])
  const lg = (pid: string, day: string, time: string, taken: boolean | null): IntakeLog =>
    ({ peptide_id: pid, logged_at: `${day}T${time}`, taken })

  it('vor dem Wechsel keine zweite (Abend-)Faelligkeit', () => {
    // 2026-05-20: nur morgens geplant; morgens genommen => keine Abend-Faelligkeit.
    const now = new Date(2026, 4, 20, 23, 0)
    expect(findOldestOverdueIntake([changed], [lg('p2', '2026-05-20', '08:30:00', true)], names2, now)).toBeNull()
  })
  it('ab dem Wechsel wird die Abenddosis faellig', () => {
    // 2026-06-03 21:00: morgens genommen, abends offen & vorbei => faellig 20:00.
    const now = new Date(2026, 5, 3, 21, 0)
    const overdue = findOldestOverdueIntake([changed], [lg('p2', '2026-06-03', '08:30:00', true)], names2, now)
    expect(overdue?.time).toBe('20:00')
  })
})
```

`seg2` Helper oben bei den anderen Helfern ergänzen:

```ts
const seg2 = (effective_from: string, intake_time: string): ScheduleSegment => ({
  effective_from, frequency: '2x täglich', x_days_interval: null, schedule_days: null,
  intake_time, intake_time_custom: null, dose: 200, unit: 'mcg',
})
```

- [ ] **Step 3: Alle Tests laufen lassen**

Run: `npx vitest run src/lib/intakeSchedule.test.ts`
Expected: PASS (alle Blöcke). Schlägt der erste neue Test fehl, ist die Segment-Auflösung in `cycleDaySlots`/`cycleAppliesToDay` zu prüfen.

- [ ] **Step 4: Commit**

```bash
git add src/lib/intakeSchedule.test.ts
git commit -m "Tests: Overdue respektiert Frequenzwechsel ab Aenderungsdatum"
```

---

## Task 4: Dashboard auf zentrale Helfer umstellen

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Import ergänzen, lokale Duplikate entfernen**

Oben in `Dashboard.tsx` den bestehenden Import aus `../lib/intakeSchedule` (falls vorhanden) bzw. neuen Import setzen:

```ts
import { cycleAppliesToDay, effectiveDose, scheduleForDay } from '../lib/intakeSchedule'
```

Die **lokalen** Definitionen `function cycleAppliesToDay(...)`, `function effectiveDose(...)` in `Dashboard.tsx` **löschen** (werden jetzt importiert).

- [ ] **Step 2: `Cycle`-Interface um `schedule_history` erweitern**

Im `interface Cycle` ergänzen:

```ts
  schedule_history: import('../lib/intakeSchedule').ScheduleSegment[] | null
```

- [ ] **Step 3: `cycleSlots` segment-basiert machen**

Die lokale `cycleSlots(c)` auf `(c, day)` umstellen und Einnahmezeiten aus dem Segment lesen:

```ts
function cycleSlots(c: Cycle, day: Date): DaySlot[] {
  const seg = scheduleForDay(c, day)
  const keys = (seg.intake_time ?? '').split(',').filter(Boolean)
  const customs = (seg.intake_time_custom ?? '').split(',')
  const out: DaySlot[] = []
  keys.forEach((key, i) => {
    if (key === 'morgens' || key === 'mittags' || key === 'abends') {
      const minutes = INTAKE_MINUTES[key]
      out.push({ key, minutes, time: minutesToHHmm(minutes), groupKey: key })
    } else if (key === 'custom' && customs[i]) {
      const [h, m] = customs[i].split(':').map(Number)
      const minutes = h * 60 + m
      out.push({ key: customs[i], minutes, time: customs[i], groupKey: intakePeriodFromMinutes(minutes) })
    }
  })
  if (out.length === 0) out.push({ key: 'later', minutes: 25 * 60, time: '', groupKey: 'later' })
  return out
}
```

Die Aufrufstelle (im `slotsByPeptide`-Aufbau) `for (const s of cycleSlots(cycle)) {` ersetzen durch:

```ts
    for (const s of cycleSlots(cycle, selectedDay)) {
```

- [ ] **Step 4: Basis-Dosis-Anzeige segment-basiert (isEscalated korrekt halten)**

Im Fällig-Karten-Renderer (`section.slots.map(slot => { const c = slot.cycle; ... })`) den Vergleich auf die Segment-Basis-Dosis umstellen. Block ersetzen:

```ts
                  const dose = effectiveDose(c, selectedDay, escalations)
                  const isEscalated = dose !== c.dose
```

durch:

```ts
                  const dose = effectiveDose(c, selectedDay, escalations)
                  const baseDose = scheduleForDay(c, selectedDay).dose
                  const isEscalated = dose !== baseDose
```

Und die Basis-Anzeige `{t('basis_label')} {c.dose} {c.unit} · +{dose - c.dose} {c.unit}` ersetzen durch:

```tsx
                                {t('basis_label')} {baseDose} {c.unit} · +{dose - baseDose} {c.unit}
```

- [ ] **Step 5: `loadCycles`-Select um `schedule_history`**

In `loadCycles` den Select-String ergänzen:

```ts
      .select('*, peptides(name)')
```

> `select('*')` lädt `schedule_history` automatisch mit — falls dort eine explizite Spaltenliste steht, `schedule_history` ergänzen. Prüfen: aktueller Select in `loadCycles` ist `'*, peptides(name)'` → keine Änderung nötig.

- [ ] **Step 6: Typecheck + Lint**

Run: `npx tsc -b`
Expected: Exit 0
Run: `npx eslint src/pages/Dashboard.tsx`
Expected: keine **neuen** Fehler (vorbestehende `CalendarInfoPill`/`set-state-in-effect` bleiben).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "Dashboard: zentrale Schedule-Helfer + segment-basierte Dosis/Slots"
```

---

## Task 5: Home auf zentrale `effectiveDose` umstellen

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Import ergänzen, lokale `effectiveDose`/`EscalationRow` entfernen**

Import erweitern:

```ts
import { findOldestOverdueIntake, effectiveDose, type EscalationRow } from '../lib/intakeSchedule'
```

Die lokale `interface EscalationRow {...}` und `function effectiveDose(...)` in `Home.tsx` **löschen**.

- [ ] **Step 2: `cycleData`-Select um `schedule_history`**

Im `supabase.from('cycles').select(...)` die Spaltenliste ergänzen:

```ts
            .select('id, intake_time, intake_time_custom, peptide_id, dose, unit, start_date, end_date, frequency, x_days_interval, schedule_days, schedule_history')
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: Exit 0

> `effectiveDose(c, now, escalations)` (heute) und `effectiveDose(overdueCycle, parseISO(overdue.dateKey), escalations)` (vergangener Tag) lösen jetzt automatisch das passende Segment auf — die Überfällig-Dosis stimmt damit auch für vergangene Tage.

- [ ] **Step 4: Test-Suite + Lint**

Run: `npx vitest run`
Expected: PASS
Run: `npx eslint src/pages/Home.tsx`
Expected: keine neuen Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "Home: zentrale effectiveDose (segment-basiert) + schedule_history laden"
```

---

## Task 6: `saveCycle` schreibt `schedule_history`

**Files:**
- Modify: `src/pages/Peptide.tsx`

- [ ] **Step 1: Helfer für Historie-Aufbau ergänzen**

Auf Modulebene in `Peptide.tsx` (oder oberhalb von `saveCycle`) einfügen. `ScheduleSegment` importieren:

```ts
import { type ScheduleSegment } from '../lib/intakeSchedule'

// Schedule-relevante Felder eines Standes (für Vergleich + Segmentaufbau).
type SchedFields = Pick<ScheduleSegment, 'frequency' | 'x_days_interval' | 'schedule_days' | 'intake_time' | 'intake_time_custom' | 'dose' | 'unit'>

function schedKey(s: SchedFields): string {
  return JSON.stringify([s.frequency, s.x_days_interval, [...(s.schedule_days ?? [])].sort(), s.intake_time, s.intake_time_custom, s.dose, s.unit])
}

// Neue Historie nach einem Edit. prev = geladener Zyklus vor dem Edit; next = neue Felder.
function nextScheduleHistory(
  prevHistory: ScheduleSegment[] | null,
  prevFields: SchedFields,
  prevStartDate: string,
  next: SchedFields,
  today: string,
): ScheduleSegment[] | null {
  if (schedKey(prevFields) === schedKey(next)) return prevHistory ?? null
  const history: ScheduleSegment[] = (prevHistory && prevHistory.length > 0)
    ? [...prevHistory]
    : [{ effective_from: prevStartDate, ...prevFields }]
  const todaySeg: ScheduleSegment = { effective_from: today, ...next }
  if (history[history.length - 1].effective_from === today) history[history.length - 1] = todaySeg
  else history.push(todaySeg)
  return history
}
```

- [ ] **Step 2: In `saveCycle` Historie berechnen und in payload aufnehmen**

In `saveCycle`, **vor** dem `update`/`insert`, die neuen Schedule-Felder sammeln und (nur beim Edit) die Historie bauen. Die `payload`-Konstante hat bereits `frequency`, `intake_time`, `dose`, `unit` etc. Direkt nach der `payload`-Definition einfügen:

```ts
    const nextFields: SchedFields = {
      frequency: payload.frequency,
      x_days_interval: payload.x_days_interval,
      schedule_days: payload.schedule_days,
      intake_time: payload.intake_time,
      intake_time_custom: payload.intake_time_custom,
      dose: payload.dose,
      unit: payload.unit,
    }
    let scheduleHistory: ScheduleSegment[] | null = null
    if (editingCycleId) {
      const prev = cycles.find(c => c.id === editingCycleId)
      if (prev) {
        scheduleHistory = nextScheduleHistory(
          prev.schedule_history ?? null,
          { frequency: prev.frequency, x_days_interval: prev.x_days_interval, schedule_days: prev.schedule_days, intake_time: prev.intake_time, intake_time_custom: prev.intake_time_custom, dose: prev.dose, unit: prev.unit },
          prev.start_date,
          nextFields,
          format(new Date(), 'yyyy-MM-dd'),
        )
      }
    }
```

Den `update`/`insert`-Aufruf so anpassen, dass beim Edit `schedule_history` mitgeschrieben wird:

```ts
    const { error } = editingCycleId
      ? await supabase.from('cycles').update({ ...payload, schedule_history: scheduleHistory }).eq('id', editingCycleId)
      : await supabase.from('cycles').insert(payload)
```

> `payload.x_days_interval`/`schedule_days` können `null` sein — das ist für `SchedFields` korrekt. Falls TypeScript bei `payload.*`-Zugriffen meckert (untypisiertes `payload`), `nextFields` aus den `cForm`-abgeleiteten Werten bauen statt aus `payload`.

- [ ] **Step 3: `Cycle`-Interface in `Peptide.tsx` um `schedule_history`**

Im lokalen `interface Cycle` (Peptide.tsx) ergänzen:

```ts
  schedule_history: ScheduleSegment[] | null
```

Sicherstellen, dass `loadCycles` in `Peptide.tsx` `schedule_history` lädt (Select `'*'` → automatisch; sonst ergänzen).

- [ ] **Step 4: Typecheck + Lint**

Run: `npx tsc -b`
Expected: Exit 0
Run: `npx eslint src/pages/Peptide.tsx`
Expected: keine neuen Fehler.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Peptide.tsx
git commit -m "Peptide/saveCycle: schedule_history bei Planungs-/Dosisaenderung schreiben"
```

---

## Task 7: Gesamtverifikation

- [ ] **Step 1: Voller Typecheck + alle Tests + Lint**

Run: `npx tsc -b && npx vitest run`
Expected: Exit 0, alle Tests PASS.
Run: `npx eslint src/pages/Dashboard.tsx src/pages/Home.tsx src/pages/Peptide.tsx src/lib/intakeSchedule.ts`
Expected: keine neuen Fehler.

- [ ] **Step 2: Manuelle Verifikation (lokal, eingeloggt)**

1. SQL `supabase-cycle-schedule-history.sql` in Supabase ausführen.
2. Bestehenden 1×-Zyklus auf 2× ändern.
3. Erwartung: **vergangene** Tage zeigen weiterhin nur 1 Einnahme (keine neuen Überfälligen); **ab heute** erscheint die zweite (Abend-)Einnahme in Kalender + Home.
4. Eskalation prüfen: effektive Dosis = Segment-Basis + Eskalation.

- [ ] **Step 3: Deploy**

Branch nach `main` mergen und pushen (Vercel deployt). **Vorher** sicherstellen, dass die SQL-Migration in der Produktions-DB ausgeführt wurde.

---

## Self-Review (vom Plan-Autor)

- **Spec-Abdeckung:** Datenmodell (T1), Schreiben (T6), Lesen/`scheduleForDay` (T1/T2), Zentralisierung (T4/T5), Eskalationen (T2-Test), Abwärtskompatibilität (T1 Resolver-Fallback, T1/T6-Selects), Tests (T1–T3). Reminder-Cron unverändert (kein Task nötig).
- **Platzhalter:** keine; jeder Code-Schritt enthält konkreten Code.
- **Typkonsistenz:** `ScheduleSegment`/`ScheduleCycle`/`EscalationRow`/`scheduleForDay`/`effectiveDose`/`cycleDaySlots(c, day)`/`cycleSlots(c, day)`/`nextScheduleHistory` durchgängig identisch benannt.
- **Bekannte Vereinfachung:** Intervall-Anker „Alle X Tage" bleibt an `start_date` (Spec).
