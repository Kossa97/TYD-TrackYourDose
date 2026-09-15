# Titration und Dosisänderung

## Die Korrektur vorweg

Im Gespräch hatte ich vorgeschlagen, Titration „über `schedule_history` statt
über `dose_escalations`" zu bauen — als wäre es zu bauen. Beim genauen Lesen des
RPC stimmt das nicht: **`save_stack_item_with_plan` tut es bereits.**

`supabase-my-stack-tracking-depth.sql:822-881`:

```sql
schedule_changed := cycle_row.frequency is distinct from plan_frequency
  or … or cycle_row.slot_doses is distinct from plan_slot_doses
  or … or cycle_row.dose is distinct from plan_dose;

if schedule_changed then
  previous_segment := jsonb_build_object('effective_from', cycle_row.start_date, …);
  next_segment     := jsonb_build_object('effective_from', plan_effective_date, …);
  -- Historie anlegen, falls leer; Segment mit gleichem Datum ersetzen; anhängen.
  next_history := next_history || jsonb_build_array(next_segment);
end if;
```

Und `plan_effective_date := (p_plan ->> 'start_date')::date` — **das Feld
„Start / gültig ab" im Formular IST das Stichdatum des neuen Segments.** Der
Doppelname war kein Zufall.

Gelesen wird es auf beiden Seiten segmentaufgelöst: `scheduleForDay(cycle, day)`
in der App, dieselbe Regel im Cron, `cycleAsIntakePlanDraft(cycle, new Date())`
lädt zum Bearbeiten das Segment, das **heute** gilt. Auch die Mengen je
Zeitpunkt sind im Segment (`slot_doses`), seit der vorigen Runde auch die Tage
(`slot_days`).

Damit ist die zweite Frage — *eine Menge steigern, die andere nicht* — schon
beantwortet: ein Segment trägt den **ganzen** Plan, also auch zwei verschiedene
Mengen an zwei Zeitpunkten.

| ab | morgens | abends |
|---|---|---|
| 01.09. | 250 mg | 500 mg |
| 01.10. | 500 mg | 500 mg |
| 15.10. | 750 mg | 500 mg |

Drei Segmente. Dass die Abenddosis dreimal gleich dasteht, ist der Grund, warum
es trägt: jedes Segment sagt die ganze Wahrheit für seinen Zeitraum, und keine
Regel muss wissen, welche Einnahme „mitsteigt".

**Warum trotzdem noch nichts davon läuft:** `save_stack_item_with_plan` existiert
in der Produktivdatenbank nicht — das My-Stack-Schema ist nicht ausgerollt. Von
148 Zyklen trägt keiner Historie, weil der Code, der sie schreibt, dort nie
gelaufen ist.

## Was wirklich fehlt

### 1. Ein Stichdatum in der Zukunft

`initialWizardState` überschreibt beim Öffnen eines bestehenden Plans:

```ts
startDate: format(new Date(), 'yyyy-MM-dd')
```

Jede Änderung gilt damit **ab heute**. „Ab dem 1. Oktober" lässt sich nicht
sagen, obwohl RPC und Auflösung es könnten. Das ist die kleinste und wichtigste
Lücke.

Die Zusicherung dahinter bleibt richtig und bleibt bestehen: der RPC weist ein
Stichdatum **vor** dem Zyklusstart ab (`Plan effective date cannot precede cycle
start`), und bestätigte Einnahmen werden nie rückwirkend geändert.

### 2. Die Stufen sind unsichtbar

Es gibt keine Stelle, an der man sieht, was ab wann gilt. Wer heute den Plan
öffnet, sieht das Segment von heute — dass ab dem 15.10. etwas anderes
vorgemerkt ist, steht nirgends. Ohne diese Liste ist Titration nicht bedienbar,
sondern nur gespeichert.

### 3. Eine Stufe zurücknehmen

Der RPC **ersetzt** ein Segment mit gleichem `effective_from` (die
`where … is distinct from`-Zeile) — ändern geht also. **Löschen** geht nicht:
es gibt keinen Weg, ein vorgemerktes Segment wieder aus der Historie zu nehmen.

### 4. `dose_escalations` daneben

Neun Zeilen in Produktion, ein flacher `increase_amount` auf den ganzen Zyklus,
addiert in `effectiveSlotQuantity`. Zwei Mechanismen für dieselbe Frage, von
denen nur einer pro Zeitpunkt unterscheiden kann.

## Vorschlag

### Der Einstieg

Am bestehenden Eintrag, neben „Bearbeiten": **„Dosis ändern ab …"**. Öffnet
denselben Einnahmeplan-Editor, vorbelegt mit dem heute gültigen Plan, mit dem
Unterschied, dass „Start / gültig ab" auf **morgen** vorbelegt ist statt auf
heute und frei wählbar bleibt.

Ein Editor, zwei Verwendungen — und jede Stufe kann sich in allem unterscheiden,
was ein Plan hat: Menge je Zeitpunkt, Tage, Rhythmus, Einheit.

**„Bearbeiten" bleibt, wie es ist** (Stichdatum heute): eine Korrektur am
laufenden Plan ist etwas anderes als eine geplante Stufe, und wer sich vertippt
hat, will keinen zweiten Eintrag in einer Liste.

### Die Liste

Unter dem Plan eine Aufstellung der Segmente, aufsteigend nach Datum, mit einer
Markierung, welches **jetzt** gilt:

```
  ab 01.09.   morgens 250 mg · abends 500 mg        (gilt jetzt)
  ab 01.10.   morgens 500 mg · abends 500 mg
  ab 15.10.   morgens 750 mg · abends 500 mg        [ändern] [entfernen]
```

Vergangene und das laufende Segment lassen sich nicht entfernen — sie sind
bereits eingetreten. Der Satz je Zeile ist derselbe `planSatz()`, den der Editor
schon unten anzeigt; er wird dafür aus dem Editor herausgelöst.

### Mehrere Stufen

Jede Stufe ist ein eigener Speichervorgang. Kein Mehrschritt-Formular: dreimal
„Dosis ändern ab …" ist umständlicher als eine Tabelle, aber es benutzt genau
den Weg, den der RPC ohnehin geht, und braucht keine zweite Schreiblogik.

### `dose_escalations`

Keine neue Oberfläche. Bestehende Zeilen werden weiter gelesen und addiert, wie
`effectiveSlotQuantity` es tut. Eine Umschreibung der neun Zeilen in Segmente
wäre möglich, ist aber eine eigene Migration mit echten Nutzerdaten und gehört
nicht in diese Runde.

## Was zu tun ist

| | |
|---|---|
| `wizardState.ts` | `initialWizardState` bekommt das Stichdatum als Parameter, statt es auf heute zu zwingen |
| `MyStackPage.tsx` | „Dosis ändern ab …", die Segmentliste, das Entfernen |
| neu: `planSegments.ts` | Segmente eines Zyklus lesen, sortieren, „gilt jetzt" bestimmen |
| RPC (beide SQL-Dateien) | ein Weg, ein **zukünftiges** Segment zu entfernen |
| `IntakePlanEditor.tsx` | `planSatz()` herauslösen, damit die Liste denselben Satz spricht |

**Keine Schemaänderung.** `schedule_history` existiert, `scheduleForDay` liest
es, der Cron auch.

## Verifikation

1. Der Trockenlauf mit einem Zyklus, drei Segmenten und `scheduleForDay` über
   60 Tage: an jedem Tag genau das Segment, das gelten soll.
2. Die Paritätsprüfung App ↔ Cron um Zyklen **mit Historie** erweitern — heute
   deckt sie nur flache Zyklen ab.
3. Ein Test, dass eine Stufe mit gleichem Stichdatum ersetzt und nicht
   verdoppelt wird.
4. Ein Test, dass ein Stichdatum vor dem Zyklusstart abgewiesen wird.

## Die Voraussetzung

Nichts davon läuft, bevor das My-Stack-Schema in der Produktivdatenbank ist:
`save_stack_item_with_plan` und `stack_items.tracking_level` fehlen dort. Das ist
seit Wochen der eigentliche Blocker — der Wizard kann aktuell überhaupt nicht
speichern, Titration hin oder her.
