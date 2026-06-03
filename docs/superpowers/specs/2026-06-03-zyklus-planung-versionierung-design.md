# Zyklus-Planung versionieren — „gilt ab Änderung" (Design)

**Datum:** 2026-06-03
**Status:** Entwurf (Design)
**Betroffene Dateien:** `src/lib/intakeSchedule.ts`, `src/pages/Dashboard.tsx`, `src/pages/Home.tsx`, `src/pages/Peptide.tsx` (`saveCycle`), `cycles`-Schema (neue Spalte). **Unverändert:** `api/send-reminders.js`.

## Problem

Ein Zyklus speichert seine Planung in **einer** veränderlichen Zeile (`frequency`, `intake_time`, `intake_time_custom`, `x_days_interval`, `schedule_days`, `dose`, `unit`). `saveCycle` überschreibt diese Felder beim Bearbeiten (`.update(payload)`). Alle Lesepfade (`cycleAppliesToDay`, `cycleDaySlots`, `effectiveDose`) wenden die **aktuelle** Planung rückwirkend ab `start_date` auf die gesamte Historie an.

Folge: Ändert man die Frequenz nachträglich (z. B. 1× → 2× täglich), entstehen rückwirkend bis zu 90 Tage „fehlender" zweiter Einnahmen, die als überfällig auftauchen und einzeln bestätigt werden müssten. Das ist falsch — eine Planungsänderung soll **ab dem Änderungszeitpunkt** gelten, vergangene Tage sollen die **damalige** Planung behalten.

## Ziel

Die zeitliche Planung **und** die Basis-Dosis eines Zyklus pro Tag korrekt auflösen: vergangene Tage = damalige Einstellung, ab Änderungsdatum = neue Einstellung. Keine rückwirkenden Falsch-Fälligkeiten. Bestehende Zyklen funktionieren ohne Datenmigration weiter.

## Nicht-Ziel

- Keine UI zum Wählen eines abweichenden „gültig ab"-Datums — `effective_from` ist immer das Bearbeitungsdatum (heute).
- Keine Änderung an Eskalationen (`dose_escalations`). Sie bleiben additive Deltas (siehe unten).
- `method` wird **nicht** versioniert (kein Zeit-/Dosis-Bezug).
- Geloggte Einnahmen (`dose_logs`) bleiben unberührt — sie speichern ihre Dosis bereits fest; historische Ist-Werte und der Live-Blutspiegel sind dadurch schon korrekt.

## Datenmodell

Neue Spalte auf `cycles`:

```sql
alter table cycles add column if not exists schedule_history jsonb;
```

`schedule_history` ist ein chronologisch aufsteigendes Array von Segmenten:

```ts
interface ScheduleSegment {
  effective_from: string            // 'yyyy-MM-dd'
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  intake_time: string | null
  intake_time_custom: string | null
  dose: number
  unit: string
}
```

Die **flachen** Zyklus-Felder bleiben erhalten und spiegeln stets das **letzte** (aktuelle) Segment. Dadurch bleiben Pfade, die nur „heute/zukünftig" brauchen (Reminder-Cron, Home-Heute-Timer), unverändert und lesen weiter die flachen Felder.

## Schreiben (`saveCycle` in `Peptide.tsx`)

Beim Bearbeiten werden die planungsrelevanten Felder (`frequency`, `x_days_interval`, `schedule_days`, `intake_time`, `intake_time_custom`, `dose`, `unit`) mit dem bisherigen Stand verglichen.

- **Keine Änderung dieser Felder** (z. B. nur Name) → kein neues Segment.
- **Änderung & Historie leer** → Historie mit dem **alten** Stand seeden: `[{ effective_from: start_date, ...alteFelder }]`, dann neues Segment `{ effective_from: heute, ...neueFelder }` anhängen.
- **Änderung & Historie vorhanden** → neues Segment `{ effective_from: heute, ... }` anhängen; ist `effective_from` des letzten Segments bereits heute, dieses **ersetzen** (mehrfaches Bearbeiten am selben Tag erzeugt kein Duplikat).
- Neuer Zyklus (Insert) → `schedule_history = null` (flache Felder genügen, gelten ab `start_date`).

In allen Fällen werden die flachen Felder auf den neuen (aktuellen) Stand gesetzt.

## Lesen

Neuer Helper in `intakeSchedule.ts`:

```ts
function scheduleForDay(cycle, day): ScheduleSegment
```

- Historie leer/null → flache Felder als ein Segment ab `start_date` zurückgeben.
- Sonst das Segment mit dem **größten `effective_from ≤ day`** wählen; liegt `day` vor dem ersten Segment, das erste verwenden (durch `start_date`-Prüfung in `cycleAppliesToDay` ohnehin ausgeschlossen).

`cycleAppliesToDay(cycle, day)`, `cycleDaySlots(cycle, day)` und `effectiveDose(cycle, day, escalations)` lösen über `scheduleForDay` auf:

- `cycleAppliesToDay`: nutzt `frequency`/`x_days_interval`/`schedule_days` des Tages-Segments. `start_date`/`end_date` bleiben zyklusweit. (Bekannte Vereinfachung: Der Intervall-Anker für „Alle X Tage" bleibt `start_date`, auch über Planungswechsel hinweg.)
- `cycleDaySlots`: expandiert `intake_time`/`intake_time_custom` des Tages-Segments.
- `effectiveDose`: `Segment-Dosis(tag) + Σ aktive Eskalationen(tag)`.

### Eskalationen

Eskalationen sind additive Deltas (`increase_amount`) und vom Basiswert unabhängig:

```
effectiveDose(tag) = scheduleForDay(cycle, tag).dose + Σ aktive Eskalationen(tag)
```

Beispiel — Basis 200, Eskalation +50 ab Tag 14, Basis ab Tag 30 auf 300 geändert: Tag 0–13 = 200, Tag 14–29 = 250, Tag 30+ = 350. Anker `after_days` bleibt relativ zu `start_date`.

## Zentralisierung

`cycleAppliesToDay`, die Slot-Expansion und `effectiveDose` sind aktuell mehrfach dupliziert (`Dashboard.tsx`, `intakeSchedule.ts`, `Home.tsx`, `Peptide.tsx`). Sie werden in `intakeSchedule.ts` als alleinige Quelle geführt (inkl. `scheduleForDay`) und von den Seiten importiert, damit die Versionslogik nicht auseinanderdriftet. Wichtig: Da `effectiveDose(cycle, day, escalations)` die Dosis über `scheduleForDay(cycle, day)` auflöst, wird auch die in `Home.tsx` angezeigte Dosis einer **überfälligen** (vergangenen) Einnahme automatisch korrekt — ohne separaten Pfad.

Die Zyklus-`SELECT`s müssen `schedule_history` mitladen, wo vergangene Tage aufgelöst werden: `Dashboard.tsx` (`loadCycles`) und `Home.tsx` (`cycleData`). Der Reminder-Cron und der Home-Heute-Timer brauchen es nicht (flache Felder).

## Betroffene Lesepfade

| Pfad | Tag | Änderung |
|---|---|---|
| `api/send-reminders.js` | heute | keine (flache Felder) |
| `Home.tsx` Heute-Timer / `decidedCountByPeptide` | heute | keine (flache Felder) |
| `Home.tsx` → `findOldestOverdueIntake` | Lookback 90 T | nutzt `scheduleForDay` pro Tag |
| `Dashboard.tsx` Kalender/Fällig (gewählter Tag) | beliebig | nutzt `scheduleForDay` pro Tag |

## Abwärtskompatibilität

Bestehende Zyklen haben `schedule_history = null` → `scheduleForDay` fällt auf die flachen Felder zurück (gilt ab `start_date`). Verhalten bleibt identisch, bis der Zyklus das erste Mal bearbeitet wird; erst dann wird die Historie geseedet. Keine Backfill-Migration nötig.

## Tests

- `scheduleForDay`: Segmentwahl (vor erstem Segment, exakt auf `effective_from`, zwischen Segmenten, leere Historie → flache Felder).
- `findOldestOverdueIntake` mit Frequenzwechsel: Tage vor dem Wechsel (1×) erzeugen **keine** zweite Falsch-Fälligkeit; Tage ab dem Wechsel (2×) werden korrekt slotweise erkannt.
- `effectiveDose` mit Dosis-Segmentwechsel + aktiver Eskalation (das 200/250/350-Beispiel).

## Offene Risiken

- Intervall-Anker für „Alle X Tage" über Planungswechsel hinweg (siehe Vereinfachung oben) — für den Hauptfall (Einnahmen-pro-Tag ändern) irrelevant.
- `saveCycle` muss den **Vor-Edit-Stand** der flachen Felder kennen, um beim ersten Edit korrekt zu seeden (liegt im Bearbeiten-Modus über das geladene Zyklus-Objekt vor).
