# Ein Reiter je Tag

## Warum die Chips nicht reichten

Die vorige Runde gab jedem Einnahmezeitpunkt seine Wochentage — als Chipreihe
an der Karte. Das konnte, was gefragt war („montags zweimal, mittwochs
einmal"), verlangte aber, **rückwärts** zu denken: man legte einen Zeitpunkt an
und nahm ihm dann die Tage weg, an denen er nicht gilt. Wer wissen wollte, was
freitags passiert, musste die Chipreihen aller Karten lesen und im Kopf filtern.

Die Frage, die der Nutzer stellt, heißt aber: *Was nehme ich montags?* Also
fragt das Formular jetzt so herum.

## Die Form

Ein **Reiter je gewähltem Wochentag**, in Wochenreihenfolge, höchstens sieben:

```
[ Mo 2 ]  [ Mi 1 ]  [ Fr 1 ]
─────────────────────────────
  Tageszeit   ◉ Morgens  ○ Mittags  ○ Abends
  Uhrzeit     08:00
  Menge       500        Einheit  mg
  ─────────────────────────────
  Tageszeit   ○ Morgens  ○ Mittags  ◉ Abends
  …
  [ + Weitere Einnahme am selben Tag ]
```

Die Zahl im Reiter ist die Anzahl der Einnahmen an diesem Tag. Damit steht
„Mo 2 · Mi 1 · Fr 1" lesbar da, ohne dass man sich durch die Reiter klickt —
genau die Auskunft, die vorher nirgends stand.

Jeder Tag gehört sich selbst: Karten hinzufügen und entfernen wirkt nur im
offenen Reiter, und dieselbe Tageszeit lässt sich an verschiedenen Tagen
verschieden belegen. Mehrfach am selben Tag geht, weil jede Einnahme ihre
eigene Karte hat.

Die Reiter erscheinen nur bei „Wochentage wählen". Täglich, im Abstand oder im
Wechsel kennen keine einzelnen Tage — dort bleibt die eine Kartenliste.

## Das Modell

Unverändert `IntakeSlotDraft.weekdays`, mit einer neuen Zusicherung: bei
„Wochentage wählen" trägt **jeder Zeitpunkt genau einen Tag**. Sonst keinen.

Das ist dieselbe Form, in der das Formular ihn zeigt, und dieselbe, in der
`cycles.slot_days` ihn speichert:

```
intake_time = 'morgens,abends,morgens'
slot_days   = 'Mo,Mo,Mi'
```

**Keine Migration.** Die Spalte trägt das seit der vorigen Runde; sie enthält
jetzt einen Tag je Eintrag statt einer `|`-Liste. Gelesen wird beides weiter —
`resolveScheduleSlots` und der Cron trennen an `|`, ob dort ein Tag steht oder
drei. Alte Zeilen bleiben gültig, ohne angefasst zu werden.

### Die drei Stellen, die normalisieren

`slotsFuerRhythmus` ist die eine Regel; sie läuft bei jedem Rhythmuswechsel und
beim **Laden eines gespeicherten Plans**:

1. **Ein Tag kommt dazu** → er übernimmt das Muster des ersten Tages, der schon
   eines hat. Drei Tage anzuwählen heißt nicht, dreimal von vorn zu tippen.
2. **Ein Tag fällt weg** → seine Zeitpunkte gehen mit.
3. **Ein Zeitpunkt ohne Tag** (hieß „an allen") → wird auf alle gewählten Tage
   vervielfacht.

Punkt 3 ist der Grund, warum auch das Laden durch dieselbe Regel läuft: ein Plan
aus der Zeit vor den Reitern trägt seine Zeitpunkte ohne Tag. Ohne
Normalisierung stünde dieselbe Karte in jedem Reiter und änderte sich überall
auf einmal — genau die Verwirrung, die die Reiter beseitigen sollen.

## Die Obergrenze zählt je Tag

`MAX_INTAKE_SLOTS` (vier) galt für den ganzen Plan. Mit einem Zeitpunkt je Tag
wäre ein Mo/Mi/Fr-Plan mit je zwei Einnahmen damit unmöglich gewesen — sechs
Zeitpunkte, an keinem Tag mehr als zwei. Gezählt wird jetzt **je Tag**, im
Formular wie in der Prüfung.

## Was aus dem Satz wurde

Der Plansatz sagte je Zeitpunkt seine Tage. Bei einem Tag je Zeitpunkt stünde
dort dreimal dasselbe. Er fasst jetzt nach Tagen zusammen und sagt es **einmal**,
solange alle Tage dasselbe sagen — welche Tage es sind, steht ohnehin vorn im
Rhythmus. Erst wo sie sich unterscheiden, bekommt jeder Tag seine Zeile:

```
Mo, Mi, Fr — Morgens 08:00 · 500 mg
Mo, Mi — Mo: Morgens 08:00 + Abends 20:00 / Mi: Morgens 08:00
```

## Beschriftung

`my_stack_plan_slot_days` („An welchen dieser Tage?") fällt weg, dafür
`my_stack_plan_day_tabs` (die Reiterleiste) und `my_stack_plan_day_tab`
(`{{day}}: {{count}} Einnahmen`, die Vorlesefassung eines Reiters). Deutsch und
Englisch sorgfältig, die zwölf weiteren sinnvoll übersetzt und ungeprüft.

## Betroffene Dateien

| | |
|---|---|
| `src/features/my-stack/components/IntakePlanEditor.tsx` | Reiter, Panel, Zählung je Tag |
| `src/features/my-stack/lib/wizardState.ts` | `slotsJeTag`, `geladenerPlan` |
| `src/features/my-stack/lib/validation.ts` | Obergrenze je Tag |
| `src/i18n/…` | ein Schlüssel weg, zwei dazu |

Nicht angefasst: `intakeSchedule.ts`, `api/_lib/reminderSchedule.js`,
`stackItems.ts`, die SQL-Dateien. Sie lesen und schreiben `slot_days` wie
bisher — die Form hat sich geändert, das Format nicht.

## Was bewusst nicht drin ist

**Dosis je Wochentag als Matrix** (Marcumar-Stil) — weiterhin offen.
**„Für alle Tage übernehmen"** — die Vervielfachung beim Hinzufügen eines Tages
deckt den Normalfall; ein eigener Knopf dafür wartet, bis jemand ihn vermisst.
