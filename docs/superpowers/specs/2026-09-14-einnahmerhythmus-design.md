# Einnahmerhythmus: drei Achsen statt einer Liste

**Datum:** 2026-09-14
**Betrifft:** `intakeRhythm.ts` (neu), `IntakePlanEditor`, `intakeSchedule.ts`,
`api/_lib/reminderSchedule.js`, `validation`, `wizardState`, `stackItems`,
`MyStackPage`, `supabase-intake-rhythm.sql` (neu)
**Status:** umgesetzt, Schema in der Produktion

## Der Befund

Gefragt: wie bauen wir das so ein, dass **jede** Einnahmefrequenz abgedeckt ist?

„Frequenz" ist keine Frage, sondern drei:

```
RHYTHMUS          ×   ZEITPUNKTE        ×   MENGE
an welchen Tagen      wie oft am Tag        wie viel je Zeitpunkt
```

Alle drei steckten in einem Feld: einem Dropdown mit acht festen Texten. Eine
Liste deckt aber immer nur ab, was jemand hineingeschrieben hat. Nicht
ausdrückbar waren unter anderem:

| Fall | Warum nicht |
|---|---|
| Depot alle 10 Wochen, Denosumab alle 6 Monate | `Alle X Tage` war auf **2–30 Tage** begrenzt |
| Pille: 3 Wochen an, 1 Woche Pause | `5 Tage an / 2 aus` war ein fest verdrahteter Sonderfall |
| „morgens 1000 mg, abends 500 mg" | Der Plan hatte **eine** Dosis für alle Zeitpunkte |

## Was jetzt gilt

### Achse 1 — der Rhythmus, vier Formen statt acht Texte

| Form | Feld darunter |
|---|---|
| **Täglich** | — |
| **Wochentage** | die Mo–So-Chips |
| **Im Abstand von** | `[ N ]` × `[Tagen ▾ / Wochen / Monaten]` |
| **Im Wechsel** | `[ X ]` Tage an, `[ Y ]` Tage Pause |

Daneben, als eigener Schalter: **„Nur bei Bedarf"** — kein Rhythmus, sondern
dessen Abwesenheit.

Diese vier decken alle acht alten Optionen ab (Wöchentlich = Abstand 1 Woche,
Mo-Fr = fünf Wochentage, 5/2 = Wechsel 5/2) **und** die fehlenden. Die Liste
muss nie wieder wachsen.

Monate rechnen über den **Kalender**, nicht über 30 Tage: monatlich ab dem
31. Januar ist der 28. Februar, dann der 31. März — mit Kappung auf den
letzten Tag des Zielmonats, wie es ein Kalender tut.

### Achse 2 — die Zeitpunkte

Unverändert aus der vorigen Runde: ein bis vier je Tag, frei hinzufügbar,
unabhängig vom Rhythmus.

### Achse 3 — die Menge steht am Zeitpunkt

`IntakeSlotDraft` trägt jetzt `dose`. Bei einem Zeitpunkt sieht das Formular
aus wie vorher; bei mehreren bekommt jeder sein eigenes Mengenfeld.

`cycles.dose` bleibt **eine** Zahl und trägt die führende Menge — alles, was
den Zyklus liest, funktioniert unverändert. Die weiteren stehen daneben in
`slot_doses`, kommagetrennt wie `intake_time`, und bleiben **leer**, solange
überall dieselbe Menge steht.

Auch „Bei Bedarf" behält genau einen Zeitpunkt: er trägt die Menge je Einnahme
(„400 mg"), zeigt aber keine Tageszeit.

## Gefunden: der Push-Cron lief auseinander

Die Regel „gilt dieser Zyklus heute?" gibt es **zweimal** — in der App und in
`api/_lib/reminderSchedule.js`, weil die api/-Functions nicht aus `src/`
importieren können. Ein neuer Paritätstest vergleicht beide über 400 Tage und
18 Rhythmen und fand sofort einen Fehler: der Cron las `interval_unit` nicht
aus dem Segment und hielt „alle 2 Wochen" für „alle 2 Tage". Ohne den Test
hätte er an sechs von sieben Tagen zu Unrecht erinnert.

## Die Datenbank

`supabase-intake-rhythm.sql` — vier Spalten auf `cycles` plus zwei Prüfungen
(`interval_unit` nur day/week/month; on/off-Tage zwischen 1 und 90).

**Bestehende Zyklen werden nicht angefasst.** `frequency` bleibt der Formtext
und behält seine bisherigen Werte; `cycleAppliesToDay` versteht alle acht alten
Texte weiter. Beim Öffnen im Formular werden sie auf die vier Formen abgebildet
— „Wöchentlich" wird zu „Abstand 1 Woche", dasselbe in Grün.

**Trockenlauf** (Postgres 16 lokal, `/var/tmp`): den Ist-Zustand nachgebaut —
148 Zyklen in der echten Verteilung (62 Täglich, 48 Wöchentlich, 36 Wochentage,
2 Alle X Tage) —, die Migration **zweimal** laufen lassen. Prüfsumme über alle
bestehenden Spalten vorher und nachher identisch; gültige Werte gehen durch,
`interval_unit='jahr'`, `cycle_on_days=0` und `cycle_off_days=91` fliegen raus.

**Produktion:** 148 Zyklen, **4 neue Spalten**, **2 neue Prüfungen**,
0 Zeilen mit Einheit/Wechsel/Slot-Mengen (niemand hat sie bisher benutzt),
Prüfsumme über den Bestand `5c25d3e311c05d0a88c64d56da5ced05`.

Die RPC `save_stack_item_with_plan` schreibt die neuen Felder und prüft sie;
sie liegt in zwei Dateien (`…-foundation.sql` und `…-tracking-depth.sql`), und
ein Test hält beide Kopien deckungsgleich.

## Bewusst weggelassen

**Dosis je Wochentag** (Marcumar: Mo/Mi/Fr eine, sonst eine halbe). Das ist
eine Matrix aus Achse 1 × Achse 3 und macht das Formular für einen Fall
kaputt, den das Notizfeld auch trägt.

## Verifikation

- **1576 Tests grün** (146 Dateien), darunter der Paritätstest App ↔ Cron über
  400 Tage und 18 Rhythmen
- `npx tsc -p tsconfig.app.json --noEmit` — sauber
- `npx eslint src scripts api` — **140 Probleme**, unverändert zur Baseline
