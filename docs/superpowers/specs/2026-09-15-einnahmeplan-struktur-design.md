# Einnahmeplan: den Schritt durchstrukturieren

**Datum:** 2026-09-15
**Betrifft:** `IntakePlanEditor`, `dosageForms` (Route/Einheit je Form),
`intakeRhythm` (übersetzbare Zusammenfassung), `validation`, `wizardState`
**Status:** umgesetzt

## Der Ausgangspunkt

Der Schritt hatte im Vollausbau **~35 Bedienelemente** und war über drei
Runden gewachsen: Rhythmus, Zeitpunkte und Mengen kamen dazu, die Gliederung
nicht. Sechs Befunde, nach Gewicht:

| | |
|---|---|
| 1 | Die **Einheit** stand unter allen Karten, die Mengen darüber — man tippte „500" und scrollte an drei Karten vorbei, um „mg" zu finden |
| 2 | Der **Mengenfehler** stand unten bei der Einheit, nicht an der Karte, in der die Zahl fehlte |
| 3 | **Erinnerungen** waren ein Versprechen ohne Einlösung: „kann nach dem Speichern eingerichtet werden" — der Assistent fragte nie, jeder Eintrag wurde mit `reminder = 'none'` gespeichert |
| 4 | Die **Methode** stand als leeres Pflichtfeld oben, obwohl sie fast immer aus der Form folgt |
| 5 | Die **Einheit** war ebenfalls ableitbar, wurde aber nie vorbelegt |
| 6 | Nirgends stand, **was man gerade gebaut hat** |

## Was jetzt gilt

### Drei benannte Blöcke plus ein Satz

```
WANN
  [Täglich][Wochentage][Abstand][Wechsel][Nur bei Bedarf]
  └ das Feld der gewählten Form
  Start / gültig ab        Ende (optional)

WAS JE EINNAHME                              Einheit [mg]
  ┌ Einnahme 1 · Morgens · 08:00 · 1000 ┐
  ┌ Einnahme 2 · Abends  · 20:00 ·  500 ┐
  [+ Weitere Einnahme am selben Tag]

ERINNERUNG
  ☐ Bei Einnahme   ☐ 2 Std vorher   ☐ 1 Tag vorher

→ Ab 15.09.2026: Mo, Mi, Fr — Morgens 08:00 · 1000 mg + Abends 20:00 · 500 mg
```

Die Einheit steht **neben** den Mengen, der Mengenfehler **an seiner Karte**,
und „Nur bei Bedarf" ist die fünfte Kachel statt eines Hakens darunter, der
die anderen vier ausgraut.

### Die Route folgt der Form

`methodChoicesFor(form)` sagt, was überhaupt in Frage kommt: eine Kapsel wird
geschluckt, ein Pflaster geklebt, ein Nasenspray genommen wie sein Name sagt.
Nur wo es wirklich mehrere gibt — was man spritzt, kann subkutan,
intramuskulär oder intravenös gehen — bleibt die Wahl stehen. Sonst
verschwindet das Feld, und der Wert wird gesetzt.

**Dabei ist ein echter Fehler aufgefallen**, den erst das Verstecken sichtbar
machte: die Route wurde nur beim *Wählen* einer Form vorbelegt. Beim
Bearbeiten eines bestehenden Eintrags kommt die Form aus der Datenbank, das
Ereignis fällt aus — die Route blieb leer. Vorher sah man das leere Pflichtfeld
und füllte es; jetzt hätte der Schritt **lautlos blockiert**: eine
Pflichtangabe, die niemand sehen und also auch nicht nachtragen kann.
Deshalb zwei Stellen: `emptyPlan` nimmt die Form entgegen, und der Editor
setzt die einzige mögliche Route selbst, falls sie doch einmal fehlt.

Die Einheit folgt derselben Regel: der erste Vorschlag stimmt fast immer.

### Die Zusammenfassung wird übersetzt, nicht zusammengebaut

`rhythmSummary` gab einen fertigen **deutschen** Satz zurück — in der
englischen Oberfläche ein Fremdkörper. Sie liefert jetzt Schlüssel plus Werte,
`rhythmText` setzt sie mit `t` zusammen. Betrifft die Zusammenfassung des
Assistenten genauso wie den neuen Plansatz.

## Verifikation

- **1584 Tests grün** (147 Dateien, 8 neue), darunter: die Einheit steht vor
  der ersten Karte, genau eine Fehlermeldung und zwar in der richtigen Karte,
  die Erinnerungswahl landet als `reminder: 'on_time,2h'` in der RPC, der
  Plansatz liest alle drei Achsen zurück.
- Die Testhelfer klicken nicht mehr eine feste Zahl von `Weiter` durch,
  sondern bis zum Ziel — ein Klick zu viel fiel vorher nur deshalb nicht auf,
  weil ihn die Validierung schluckte.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber
- `npx eslint src scripts api` — **140 Probleme**, unverändert zur Baseline

## Offen

**Dosis je Wochentag** (Marcumar) bleibt bewusst draußen — Matrix aus zwei
Achsen, für einen Fall, den das Notizfeld trägt.
