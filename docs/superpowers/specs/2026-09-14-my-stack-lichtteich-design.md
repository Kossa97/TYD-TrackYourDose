# Bühnenlicht — der Teich am Boden der Flüssigkeit

**Datum:** 2026-09-14
**Betrifft:** `LiquidGraphic` (Caustic am Kammerboden)
**Status:** umgesetzt, erster Schritt

## Der Befund

Gemeldet am Nasenspray: unten gefällt es nicht. Nachgesehen: am Boden der
Flüssigkeit lag ein **weißer Fleck über dem halben Boden** — die Farbe war
dort ausgewaschen.

Es ist das Licht, das sich am Kammerboden sammelt (`-caustic`). Es wurde in
festen Maßen gezeichnet:

```jsx
<ellipse cx={W/2} cy={H-13} rx="48" ry="15" fill={caustic} />
// caustic: rgba(255,255,255,0.58) → transparent, ohne Zwischenstufe
```

Zwei Dinge daran:

1. **Die Helligkeit.** `0,58` Weiß mit hartem Übergang ins Nichts war die
   hellste Fläche im ganzen Objekt — heller als der Glanz auf dem Glas.
2. **Die feste Größe.** `rx=48` in einer 120 Einheiten breiten Kammer sind
   80 % der Breite. Wie sehr das auffällt, hängt daran, wie *tief* die
   Flüssigkeit ist: im Vial steht eine hohe Säule darüber und der Teich liegt
   weit unten; im Nasenspray ist die Kammer flach und breit, und derselbe
   Teich deckt fast den ganzen sichtbaren Boden.

`LiquidGraphic` zeichnet in einem festen System (120 × 200) und wird mit
`preserveAspectRatio="none"` in die Kammer jeder Form gezogen. Eine feste
Ellipse darin ist deshalb keine feste Erscheinung.

## Die Änderung

**Halb so hell, mit weichem Rand:**

```
rgba(255,255,255,0.32) → 0.12 bei 55 % → 0
```

**Und an der Füllung bemessen statt an der Kammer:**

```jsx
rx={32 + 10 * fill}   ry={10 + 3 * fill}
```

Steht wenig drin, liegt der Boden nah unter der Oberfläche und das Licht
sammelt sich auf kleinerer Fläche. Der Teich wird damit zu einer Eigenschaft
der Flüssigkeit — und weil jede Form ihren eigenen Füllstand mitbringt
(`SPRAY_FILL`, `DROPS_FILL`, …), passt er sich der Darreichungsform an, ohne
dass irgendwo eine Zahl je Form getippt werden muss.

Bei voller Füllung sind das 84 von 120 Einheiten statt 96 — und nie mehr als
75 % der Kammerbreite, was ein Test festhält.

## Verifikation

- Nasenspray-Fuß bei vierfacher Pixeldichte vorher und nachher verglichen:
  aus dem ausgewaschenen Fleck ist ein Schimmer geworden, die Farbe reicht bis
  zum Boden.
- Alle sechs Flüssigkeitsformen nebeneinander: gleichmäßig, keine sticht
  heraus.
- Zwei neue Tests: die Helligkeit des Verlaufs, und dass der Teich mit der
  Füllung wächst und die Kammerbreite nie zudeckt.
- `TZ=Europe/Berlin npx vitest run` — **1502 Tests grün** (143 Dateien), 2 neu.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.

## Was noch offen ist

Zum Bühnenlicht gehören außerdem der **Schatten unter dem Objekt**
(`stage-shadow`) und der **Lichtschein auf dem Körper** (`bloom`). Beide sind
je Form mit getippten Zahlen gesetzt — der Schatten des Nasensprays ist 90 %
so breit wie seine Standfläche, der des Sprays 81 %, der des Pens 77 %. Das
ließe sich genauso aus der Standfläche herleiten, statt es zu tippen. Nicht
angefasst, weil die Meldung „unten" galt und der Teich der Fleck war, den man
sieht.
