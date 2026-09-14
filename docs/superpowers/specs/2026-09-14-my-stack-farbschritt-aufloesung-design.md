# Farbschritt — nicht mehr hochziehen, sondern groß zeichnen

**Datum:** 2026-09-14
**Betrifft:** `objektSkala`, `large`-Größen von Vial, Tablette, Kapsel, Gel, Pulver, `POWDER_LABEL`
**Status:** umgesetzt

## Der Befund

Gemessen, was der Farbschritt mit jeder der zehn Formen macht, die die Farbe
zeigen — `zoom`, den `objektSkala` setzt:

| | vorher |
|---|---|
| Pen | 0,58 |
| Nasenspray | 0,74 |
| Ampulle, Tropfen, Spray | 0,94 |
| **Pulver** | **1,20** |
| **Gel** | **1,29** |
| **Kapsel** | **1,52** |
| **Vial** | **1,68** |
| **Tablette** | **2,15** |

**Fünf der zehn Formen wurden vergrößert, die Tablette mehr als verdoppelt.**
Genau die fünf sahen schlechter aus als im Karussell daneben — und der Vial,
die Peptid-Darstellung, war der zweitschlimmste Fall.

Der Nachtrag vom 2026-09-11 hatte `transform` durch `zoom` ersetzt, weil `zoom`
die Layout-Maße wirklich ändert und Weichzeichner, Schatten und Schrift beim
neuen Wert neu rechnet. Das stimmt und war die richtige Entscheidung — es
macht das Hochziehen nur **erträglich**, nicht gut. Ein Weichzeichnerradius,
eine Haarlinie und ein Schattenversatz sind für eine bestimmte Größe gezeichnet
worden; auf das Doppelte gebracht sind sie proportional richtig und trotzdem
nicht das, was jemand für diese Größe gezeichnet hätte.

## Die Entscheidung

**Verkleinern ist verlustfrei, vergrößern nicht.**

### 1. `objektSkala` geht nie über 1

```ts
return Math.min(nachHoehe, nachBreite, 1)
```

Wer ein Objekt größer will, **zeichnet es größer** — er streckt es nicht.

### 2. `large` ist die Größe des Farbschritts

`size="large"` hat in der App genau einen Aufrufer: den Farbschritt
(`StackItemWizard`). Die Größe kann deshalb frei auf die Fläche dort gelegt
werden — 388 × 366 px, bei 94 % Deckung also 365 × 344 px.

| Form | `large` vorher | jetzt |
|---|---|---|
| Vial | `w-28 sm:w-36` (112/144) | `w-[184px]` |
| Tablette | `w-[160px]` | `w-[344px]` |
| Kapsel | `w-[240px]` | `w-[364px]` |
| Gel | 282,6 × 226,1 | 364 × 291 |
| Pulver | 191,5 × 287,3 | 229,3 × 344 |

Die Schriftgrößen der `large`-Stufe wandern im selben Verhältnis mit
(Tablette `text-base` → `text-[34px]`, Vial `text-lg sm:text-xl` →
`text-[26px]`, …), sonst stünde der Name plötzlich winzig auf einem doppelt so
großen Objekt.

**Ergebnis:** alle zehn Formen stehen jetzt bei `zoom ≤ 1,00` — und zwar bei
derselben Bildgröße wie vorher (Vial 184 statt 188, Tablette 344, Kapsel 364,
Pulver 229, Gel 364). Größe behalten, Auflösung gewonnen.

`large` ist damit keine Sprosse der Karussell-Leiter mehr (Schritt ×1,2706).
Das ist Absicht und steht in den Tests: die Leiter ordnet Formen
**nebeneinander**, der Farbschritt zeigt immer nur **eine**.

## Das Pulveretikett lief nicht bis an die Wand

Jede Form leitet ihren Etikett-Einzug aus der eigenen Korpuskante her —
`(BODY.x - VIEWBOX.x) / VIEWBOX.width`. Gemessen am jeweiligen Korpus stehen
Vial, Ampulle, Gel, Spray, Tropfen und Nasenspray damit von Wand zu Wand.

Nur die Pulverdose hatte zusätzlich `POWDER_LABEL.inset = 4` — vier Einheiten
**innerhalb** der Korpuskante, als einzige Form eine getippte Zahl. Sichtbar
als Rand, den sonst niemand hat. Jetzt `0`.

## Verifikation

- Alle zehn Formen im Browser auf dem Farbschritt aufgenommen, vorher und
  nachher, bei doppelter Pixeldichte.
- `zoom` je Form nachgemessen: **jede ≤ 1,00**.
- `TZ=Europe/Berlin npx vitest run` — **1491 Tests grün** (142 Dateien), 1 neu;
  acht Tests, die die alten Größen festhielten, auf die neuen gezogen.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.

## Was das nicht ist

Keine neue Grafik. Die Formen sind dieselben — sie werden nur in der Größe
gezeichnet, in der sie stehen, statt in einer kleineren und dann gestreckt.
Wer die Zeichnungen selbst schöner will (mehr Glanzlichter, feinere Verläufe),
ist im nächsten Entwurf.
