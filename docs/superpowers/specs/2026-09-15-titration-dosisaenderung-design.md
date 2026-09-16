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

---

## Nachtrag 16.09.: Die Voraussetzung ist erfüllt

`supabase-my-stack-tracking-depth.sql` liegt in Produktion (`peptid-tracker`),
in fünf Teilen angewendet.

**Der Trockenlauf hat zwei Dinge gefunden**, bevor irgendetwas die echte
Datenbank berührte:

1. `stack_item_ingredients_name_check` — die Migration bricht ab, wenn eine
   Zutat weder Katalogbezug noch eigenen Namen trägt. Meine erste Fixture hatte
   genau solche Zeilen. **Gegen Produktion geprüft: 0 von 15 verletzen die
   Regel**, die Migration war dort also gefahrlos.
2. `role "authenticated" does not exist` — die Supabase-Rollen fehlen einem
   nackten Postgres. Umgebungssache; lokal nachgestellt.

**Zählung, vorher und nachher gleich:**

| | vorher | nachher |
|---|---|---|
| `stack_items` | 15 | 15 |
| `stack_item_ingredients` | 15 | 15 |
| `cycles` | 148 | 148 |
| `dose_logs` | 9145 | 9145 |
| `substance_catalog` | 335 | 335 |
| `pk_profiles` | 93 | 93 |
| `dose_escalations` | 9 | 9 |

Dazu: `tracking_level` überall `complete` (der Vorgabewert),
`pk_profile_method` in genau den 3 Einträgen gefüllt, die ein PK-Profil haben,
die drei neuen Tabellen angelegt und leer, sechs Funktionen vorhanden.

**Byte-Abgleich gegen den Trockenlauf**, damit die stückweise Übertragung
nachweislich nichts verändert hat:

| | Trockenlauf | Produktion |
|---|---|---|
| `md5(prosrc)` von `save_stack_item_with_plan` | `fba6c777…` | `fba6c777…` ✓ |
| Spalten der sieben Tabellen | `dc99c152…` | `dc99c152…` ✓ |
| Check-Constraints | `7943af5b…` | `7985895f…` ✗ |

Die Check-Liste weicht ab, und zwar erklärbar: **neun Prüfungen gibt es nur in
Produktion** (`stack_items_category_check`, `…_dosage_form_check`,
`cycles_interval_unit_check` und weitere aus früheren Migrationen). Mein
Nachbau entstand aus `information_schema.columns`, und das trägt keine
Check-Constraints. Umgekehrt fehlt nichts — alles, was diese Migration anlegt,
ist in beiden. Für den nächsten Trockenlauf gehören die Constraints in den
Nachbau.

**Der RPC wurde im Trockenlauf durchgespielt**, mit genau dem Fall aus der
Fragestellung:

```
nach dem Anlegen:  zyklen=1  historie=0
nach der Stufe:    historie=2  stichtage=2026-09-01 | 2026-10-01
                               mengen=1000,500 | 1500,500
nach dem Ersetzen: historie=2  mengen=1000,500 | 1750,500
```

Morgens gesteigert, abends gleich — als zweites Segment ab dem 01.10. Und ein
zweiter Speichervorgang auf dasselbe Stichdatum **ersetzt** die Stufe, statt sie
zu verdoppeln.

Damit sind von den vier offenen Punkten oben nur noch die drei aus „Was wirklich
fehlt" übrig: Stichdatum in der Zukunft, die Liste der Stufen, das Entfernen
einer vorgemerkten Stufe.

---

## Nachtrag 16.09., zweiter Teil: gebaut

Und noch eine Korrektur an dieser Spec. Unter „Was wirklich fehlt" stand als
Punkt 1, ein Stichdatum in der Zukunft lasse sich **nicht** sagen. Das stimmt
nicht: `initialWizardState` setzt das Feld beim Öffnen auf heute, aber es
bleibt danach frei editierbar, die Prüfung kennt keine Obergrenze, und der RPC
weist nur ein Datum **vor** dem Zyklusstart ab. Es war eine Vorgabe, keine
Sperre — die Lücke war Auffindbarkeit, nicht Fähigkeit.

Gebaut wurde darum:

**Ein Hinweis am Datumsfeld.** „Gilt ab diesem Datum. Heute stehen lassen
korrigiert den laufenden Plan; ein Datum in der Zukunft legt eine Stufe an —
bis dahin gilt der bisherige Plan weiter." Damit ist ein Eingabefeld, das die
ganze Titration trägt, auch als solches lesbar.

**Die Liste der Stufen** (`planSegments.ts`, `data-plan-steps`). Sie erscheint
nur, wo es mehr als eine Stufe gibt — bei einem nie geänderten Plan wäre sie
eine Wiederholung. „Gilt jetzt" folgt derselben Regel wie `scheduleForDay`: die
jüngste Stufe, deren Stichdatum nicht in der Zukunft liegt. Ein Plan ohne
Historie ist genau eine Stufe: er selbst, ab seinem Start.

**Das Zurücknehmen** (`supabase-plan-segment-remove.sql`,
`remove_plan_segment`). Nur was noch nicht angefangen hat; eine laufende oder
vergangene Stufe ist eingetreten, der Kalender hat danach geplant. Die Regel
steht im RPC, nicht in der Oberfläche — dort ließe sie sich umgehen.

Das Feine daran: die flachen Spalten von `cycles` tragen immer den **jüngsten**
Plan, weil der nächste Speichervorgang sie als „bisher" vergleicht. Fällt die
letzte Stufe weg, müssen sie auf die dann letzte zurück, sonst bliebe die
zurückgenommene Menge dort stehen. Der Trockenlauf zeigt es:

```
drei Stufen: 250,500 | 500,500 | 750,500 · flach=750,500
Mitte weg:   250,500 | 750,500          · flach=750,500
letzte weg:  historie=null               · flach=250,500
```

Und die vier Zusicherungen greifen: eine laufende Stufe, heute, ein unbekanntes
Stichdatum und ein fremder Zyklus werden alle abgewiesen.

`remove_plan_segment` liegt in Produktion, `md5(prosrc)` stimmt mit dem
Trockenlauf überein (`943f9203…`). Bestand unverändert: 148 Zyklen, 0 mit
Historie, 15 Einträge, 9145 Protokollzeilen.

**Offen geblieben**, bewusst: mehrere Stufen in einer Tabelle auf einmal
anzulegen. Jede Stufe ist ein eigener Speichervorgang — umständlicher, aber es
benutzt genau den Weg, den der RPC ohnehin geht, und braucht keine zweite
Schreiblogik. Und `dose_escalations` bleibt daneben bestehen: die bestehende
Zeitleiste in der Detailansicht zeigt weiter die neun Produktivzeilen, die
Planstufen stehen als eigener Block darunter.
