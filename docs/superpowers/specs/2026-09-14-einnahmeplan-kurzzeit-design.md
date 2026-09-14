# Einnahmeplan: Enddatum, mehrmals täglich, bei Bedarf

**Datum:** 2026-09-14
**Betrifft:** `IntakePlanEditor`, `wizardState`, `validation`, `stackItems`,
`intakeSchedule`, `Dashboard`, `supabase-my-stack-tracking-depth.sql`
**Status:** umgesetzt

## Der Ausgangspunkt

Gefragt: nehmen wir Apothekenmedikamente auf, auch wenn man manche nur kurz
nimmt?

Antwort: ja — ein Katalogeintrag kostet eine Zeile, und die kurze Einnahme ist
eher der Fall, der protokolliert werden *will* (eine Antibiotikakur hakt man
ab, ein Kortisonstoß erklärt später einen Blutwert).

Beim Nachsehen zeigte sich aber: die Lücke lag nicht im Katalog, sondern im
**Planschritt**. Drei Dinge fehlten dort, und alle drei betreffen genau die
Kurzzeitmittel.

## Was fehlte — und was schon da war

| | |
|---|---|
| **Enddatum** | `IntakePlanDraft` trug `endDate`, die alte Zyklusmaske konnte es, der Assistent fragte nie danach. Eine 7-Tage-Kur lief weiter, bis jemand sie von Hand beendete. |
| **2x / 3x täglich** | `cycleAppliesToDay` kannte beide Frequenzen **längst**, `intake_time` hält mehrere Zeitpunkte kommagetrennt, `resolveScheduleSlots` löst sie auf, der PDF-Export übersetzt sie, das FAQ erklärt sie — nur angeboten hat sie niemand. |
| **Bei Bedarf** | Gab es gar nicht. Alle sieben Frequenzen waren Dauerschemata; Ibuprofen oder Loperamid passten in keines. |

Das Muster ist dasselbe wie beim Katalog: die Auswerteseite konnte mehr als die
Eingabeseite anbot, und niemand merkte es, weil beide Seiten ihre eigene
Wahrheit hatten.

Schlimmer noch: der Entwurf trug **einen** Einnahmezeitpunkt
(`routineGroup` + `time`). Beim Bearbeiten eines bestehenden „2x täglich"-Zyklus
nahm er `intake_time.split(',').find(Boolean)` — die zweite Einnahme fiel still
weg, und Speichern löschte sie.

## Was jetzt gilt

### Ein Ort für die Frequenz

`src/features/my-stack/lib/intakeFrequency.ts` hält die Liste **und** was sie
bedeutet: `slotCountForFrequency` (1 / 2 / 3, bei Bedarf 0), `isOnDemand`,
`needsWeekdays`, `needsInterval`. Formular und Seite lesen beide von dort.

Ein Test hält beide Seiten zusammen: **jede angebotene geplante Frequenz muss
von `cycleAppliesToDay` auch tatsächlich einen Tag planen.** Genau das war
vorher nicht garantiert.

### Der Plan trägt mehrere Zeitpunkte

```ts
interface IntakeSlotDraft { routineGroup: RoutineGroup; time: string | null }
interface IntakePlanDraft { …; slots: IntakeSlotDraft[]; endDate: string | null }
```

Die **Zahl der Zeitpunkte folgt der Frequenz**, und zwar im Reducer, nicht im
Formular — so führt jeder Weg zum selben Ergebnis, auch das Laden eines
bestehenden Zyklus. Ein neuer Zeitpunkt startet auf der Tageszeit, die noch
frei ist (zweimal „morgens" ist nie gemeint); beim Verringern bleiben die
vorderen samt gesetzter Uhrzeit stehen.

Gespeichert wird, wie die Auswertung es liest: `intake_time`
= `morgens,mittags,abends`, `intake_time_custom` = `08:00,,20:00` — die leere
Position in der Mitte muss stehen, sonst verrutscht die Zuordnung.

### „Bei Bedarf" ist das Gegenteil eines Plans

`cycleAppliesToDay` gibt für diese Frequenz **nie** true zurück: nichts wird
fällig, nichts gilt als verpasst, nichts wird automatisch als ausgelassen
geloggt. Das folgte vorher schon aus dem Fallthrough — jetzt steht es als
Absicht da, mit Test.

Daraus folgte der Haken: eine Frequenz, die in keiner Tagesliste auftaucht,
ließe sich auch nirgends eintragen. Das Dashboard bekommt deshalb unter dem
Plan einen eigenen Abschnitt „Bei Bedarf" mit einem Knopf je Substanz, der eine
Einnahme für **jetzt** einträgt, samt Zähler, wie oft es an diesem Tag schon
war. Eine Frequenz anzubieten, die man nicht loggen kann, wäre schlimmer
gewesen als keine.

### Das Schema

`supabase-my-stack-tracking-depth.sql` (noch nicht ausgerollt — die RPC
`save_stack_item_with_plan` existiert in der Produktion nicht, also genügt die
Datei, keine Nachmigration):

- `intake_time` darf jetzt eine Liste von ein bis drei gültigen Tageszeiten
  sein statt genau einer. Die Längenprüfung steht mit `coalesce(…, 0)`, weil
  `string_to_array('', ',')` ein leeres Array liefert und `array_length` darauf
  null ist — ohne das ginge ein leerer Wert durch.
- Ein `end_date` vor dem `start_date` wird abgewiesen.

## Verifikation

- **18 neue Tests** (1534 → **1552**), 145 Dateien grün.
- Trockenlauf des geänderten Prüferblocks gegen Postgres 16 lokal: `morgens`,
  `morgens,abends`, `morgens,mittags,abends` und ein Ende nach dem Start gehen
  durch; `nachts`, vier Zeitpunkte, ein leerer Wert und ein Ende vor dem Start
  werden abgewiesen.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.

## Offen

Die Welle „Apotheke" — rund 120–150 Wirkstoffe entlang der
Verordnungshäufigkeit. Sie war der Anlass; erst musste der Plan die
Kurzzeitfälle abbilden können.
