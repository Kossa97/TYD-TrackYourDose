# Einnahmezeitpunkte je Wochentag

## Der Anlass

Im Schritt „Einnahmeplan" ließ sich bis hierher sagen: *an welchen Tagen* (Rhythmus),
*wie oft am Tag* (Zeitpunkte) und *wie viel je Zeitpunkt* (Menge). Was fehlte, war die
Verbindung der ersten beiden Achsen — **welcher Zeitpunkt gilt an welchem Tag**.

Wer montags zweimal und mittwochs einmal einnimmt, musste bisher lügen: entweder an
beiden Tagen zweimal oder an beiden einmal. Genau das ist der Alltag bei ausschleichenden
Dosierungen, bei Trainings- gegen Ruhetage und bei allem, was am Wochenende anders läuft.

## Das Modell: Zeitpunkt zuerst, Tage daran

Die naheliegende Form wäre eine Matrix Tag × Zeitpunkt gewesen — sieben Spalten, vier
Zeilen, achtundzwanzig Felder. Sie zeigt viel Leere und fragt nach Angaben, die fast
niemand macht.

Stattdessen trägt **jeder Einnahmezeitpunkt seine Tage**:

```ts
interface IntakeSlotDraft {
  routineGroup: RoutineGroup   // morgens | mittags | abends | nachts
  time: string | null          // Uhrzeit, optional
  dose: number | null          // Menge je Zeitpunkt
  weekdays: string[]           // leer = an jedem Tag, den der Rhythmus auswählt
}
```

„Montags zweimal, mittwochs einmal" sind damit zwei Karten:

| Karte | Tageszeit | Uhrzeit | Menge | Tage |
|---|---|---|---|---|
| 1 | morgens | 08:00 | 1 | *(leer = Mo und Mi)* |
| 2 | abends | 20:00 | 1 | Mo |

Der Normalfall — jeden ausgewählten Tag gleich — bleibt damit **eine leere Angabe**.
Die Tageschips erscheinen nur, wenn der Rhythmus „Wochentage wählen" ist; bei „Täglich"
oder einem Abstand gibt es keine Tage zu unterscheiden.

## Speicherform

Eine weitere Kommaliste in `cycles`, in derselben Konvention wie `intake_time` und
`slot_doses` — gleiche Reihenfolge, gleiche Länge. Die Tage **eines** Zeitpunkts trennt
`|`:

```
intake_time = 'morgens,abends'
slot_doses  = '1,1'
slot_days   = ',Mo'          -- morgens an allen Tagen, abends nur montags
slot_days   = 'Mo|Mi,Mo'     -- morgens Mo und Mi, abends nur Mo
```

Ein leerer Eintrag heißt „an jedem Tag, den der Rhythmus auswählt" — genau wie ein
fehlender Wert in `slot_doses` „die Standardmenge" heißt. `NULL` heißt dasselbe für
alle Zeitpunkte und ist der Zustand jedes Zyklus, der vor dieser Änderung entstanden ist.

`slot_days` wird nur geschrieben, wenn mindestens ein Zeitpunkt eigene Tage hat. Ein
Plan ohne diese Feinheit sieht in der Datenbank aus wie vorher.

## Was geprüft wird

**Im Formular** (`validation.ts`):

- Ein Zeitpunkt darf nur Tage nennen, die der Rhythmus auch auswählt → `unknown_day`.
- Jeder ausgewählte Tag braucht mindestens eine Einnahme → `day_without_intake`.
  Sonst stünde „Mo, Mi, Fr" im Rhythmus, und freitags passierte nichts.
- Zwei Karten sind erst dann doppelt, wenn Tageszeit, Uhrzeit **und** Tage gleich sind.
  „Morgens montags" und „morgens mittwochs" sind zwei Einnahmen, keine doppelte.

**In der Datenbank** (`save_stack_item_with_plan`):

- `slot_days` hat so viele Einträge wie `intake_time`, sonst
  `Slot days must line up with intake times`.
- Jeder genannte Tag ist einer von `Mo Di Mi Do Fr Sa So`, sonst
  `Slot days must be German weekday codes`. Ein „Mx" liefe sonst still als „nie" durch.

## Wer die Regel liest

`resolveScheduleSlots(schedule, day?)` ist die eine Stelle, die aus einem Zyklus die
Einnahmen eines Tages macht. Sie bekommt jetzt den Tag mit und lässt Zeitpunkte weg,
deren Tage den gefragten nicht enthalten. Wer einen Tag meint, reicht ihn durch:
`cycleDaySlots`, die Tagesliste auf Home und die beiden Dashboard-Stellen
(`cycleIntakeMinutes`, `cycleSlots`). Ohne Tag verhält sich die Funktion wie vorher und
gibt alle Zeitpunkte zurück — das ist der Fall in `pkReadiness`, wo nicht der einzelne
Tag gefragt ist, sondern ob der Plan überhaupt eine Uhrzeit trägt.

Dieselbe Regel steht ein zweites Mal in `api/_lib/reminderSchedule.js` — der Cron kann
nicht aus `src/` importieren. Beide Seiten hält
`api/_lib/reminderSchedule.parity.test.js` zusammen: 400 Tage × 18 Rhythmen, beide
Implementierungen müssen dasselbe sagen. Eine Erinnerung darf nicht kommen, wenn die App
für diesen Tag keine Einnahme zeigt.

## Migration

`supabase-intake-rhythm.sql` legt `slot_days` an, `add column if not exists`, idempotent.

**Trockenlauf** (Postgres 16 im Container, `cycles` im Ist-Zustand der Produktion
nachgebaut: 148 Zeilen — 62 Täglich, 48 Wöchentlich, 36 Wochentage wählen, 2 Alle X Tage,
alle mit `intake_time`, keine mit `slot_doses`):

| | vorher | nach Lauf 1 | nach Lauf 2 |
|---|---|---|---|
| Zeilen | 148 | 148 | 148 |
| Prüfsumme über die alten Spalten | `78c79e04…` | `78c79e04…` | `78c79e04…` |
| Spalte `slot_days` | 0 | 1 | 1 |

Die beiden neuen RPC-Prüfungen wurden einzeln gegen den Trockenlauf gefahren:
`Mo|Mi,Mo` und `,Mo` gehen durch, `Mo|Mi` zu zwei Zeitpunkten fällt auf die
Längenprüfung, `Mx,Mo` auf die Tagesprüfung.

**Produktion** (`peptid-tracker`), nach dem Lauf dieselbe Zählung:
148 Zeilen, Prüfsumme über die alten Spalten unverändert (`fd2f7bda…` vor und nach der
Migration), `slot_days` vorhanden und in allen 148 Zeilen leer, beide Checks gesetzt.

## Betroffene Dateien

| | |
|---|---|
| `src/features/my-stack/types.ts` | `IntakeSlotDraft.weekdays` |
| `src/features/my-stack/components/IntakePlanEditor.tsx` | Tageschips je Karte, Plansatz |
| `src/features/my-stack/lib/validation.ts` | `unknown_day`, `day_without_intake` |
| `src/features/my-stack/lib/wizardState.ts` | verwaiste Tage beim Rhythmuswechsel |
| `src/features/my-stack/services/stackItems.ts` | `slot_days` schreiben |
| `src/features/my-stack/MyStackPage.tsx` | `slot_days` lesen |
| `src/lib/intakeSchedule.ts` | `resolveScheduleSlots(schedule, day?)` |
| `api/_lib/reminderSchedule.js` | dieselbe Regel für den Cron |
| `supabase-intake-rhythm.sql` | die Spalte |
| `supabase-my-stack-tracking-depth.sql`, `supabase-my-stack-foundation.sql` | RPC |

## Was bewusst nicht drin ist

**Dosis je Wochentag als Matrix** — Marcumar-Stil, montags 1½ und dienstags ¾ derselben
Tablette zur selben Uhrzeit. Das ginge mit dem Modell, braucht aber eine eigene
Eingabeform; eine Karte je Tag wäre hier die falsche Antwort. Bleibt offen.
