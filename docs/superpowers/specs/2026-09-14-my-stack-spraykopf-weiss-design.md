# Spray — der Pumpkopf trägt keine Eintragsfarbe

**Datum:** 2026-09-14
**Betrifft:** `SprayVisual`
**Status:** umgesetzt

## Der Befund

Der Kopf des Mundsprays — Düse, Kragen und Druckknopf — war mit der
**Eintragsfarbe** gefüllt. Bei einem blauen Eintrag stand da ein blauer
Pumpkopf, bei einem roten ein roter.

Den gibt es so nicht. Ein Pumpkopf ist ein Mechanikteil aus weißem
Polypropylen; die Farbe eines Präparats steckt im Inhalt und auf dem Etikett,
nicht im Aufsatz darüber. Das Nasenspray macht es schon richtig: sein Kopf
trägt einen `-pp`-Verlauf und bleibt weiß, egal was in der Flasche ist.

## Die Änderung

Derselbe Verlauf, byteweise:

```
#9aa6b4 → #f4f7fb → #e2e8f0 → #c2cbd7 → #8d99a8
```

Ein Test hält fest, dass beide Sprays daraus sind — sonst stehen zwei
Pumpflaschen aus verschiedenem Kunststoff nebeneinander.

**Die Licht- und Schattenebene musste mit.** Sie war für eine gesättigte
Eintragsfarbe gerechnet (bis `rgba(0,0,0,0.6)` an den Rändern) und hätte aus
dem weißen Material Grau gemacht. Die Werte sind auf etwa die Hälfte
zurückgenommen, die Glanzkante bleibt.

## Was die Farbe weiter trägt

Die Flüssigkeit und das Etikettband. `showsColor` bleibt für das Spray also
`true` — der Farbschritt wird weiterhin gestellt, und die Wahl kommt an,
nur eben dort, wo sie hingehört.

## Verifikation

- Vier Eintragsfarben nebeneinander gerendert, dazu das Nasenspray zum
  Vergleich: der Kopf bleibt in allen vier Fällen derselbe, die Flüssigkeit
  wechselt.
- Test umgeschrieben: alle drei Kopfteile tragen `url(#…-pp)` und **nicht**
  die Eintragsfarbe; ein zweiter prüft, dass die Farbe trotzdem im Bild
  ankommt.
- `TZ=Europe/Berlin npx vitest run` — **1500 Tests grün** (143 Dateien).
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.
