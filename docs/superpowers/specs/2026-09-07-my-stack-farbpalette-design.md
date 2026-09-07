# My Stack — Farbpalette aus unseren Farben

**Datum:** 2026-09-07
**Betrifft:** `lib/colors.ts`, `PeptideColorPalette`
**Status:** umgesetzt

Die zwölf Farben waren eine willkürliche Auswahl fremder Hex-Werte, gezeichnet
als flache Kreise. Beides ist ersetzt.

## Die Farben

Ein geschlossener Farbkreis um unsere eigenen Farben herum. **Fünf davon sind
die Marke selbst**, unverändert aus `index.css`:

| Token | Hex | Farbton |
|---|---|---|
| `--cat-amber` | `#f59e0b` | 38° |
| `--cat-emerald` | `#10b981` | 160° |
| `--accent` | `#00ccf5` | 190° |
| `--cat-violet` | `#8b5cf6` | 258° |
| `--cat-rose` | `#f43f5e` | 350° |

Die **restlichen sieben** füllen die Lücken: alle 30 Grad ein Ton, alle mit
derselben Sättigung (70 %) und derselben Helligkeit (58 %). Dadurch treten sie
hinter die Markenfarben zurück, statt mit ihnen zu konkurrieren — und
untereinander lesen sie sich als eine Familie statt als sieben Einzelfälle.

Sortiert nach Farbton, nicht nach Zufall: die Palette liest sich als Kreis.
Der kleinste Abstand zwischen zwei Tönen beträgt 24 Grad — nah genug für einen
geschlossenen Kreis, weit genug zum Auseinanderhalten. `colors.test.ts` misst
beides, statt es zu behaupten.

## Die Darstellung

Jedes Feld ist eine **Perle, keine Fläche**: Glanzpunkt oben links, dunkler Rand
unten rechts, derselbe Verlauf für jede Farbe. Der Browser rechnet ihn aus, es
gibt also keine zwölf handgepflegten Sonderfälle.

Warum überhaupt: die Objekte im Formular tragen Material und Licht. Zwölf flache
Kreise daneben sahen aus wie aus einem anderen Programm.

Der Ring der Auswahl liegt **außen und in der Farbe selbst**, mit dem Untergrund
als Lücke dazwischen. Ein weißer Rahmen um zwölf Farben herum hätte sie alle
gleich aussehen lassen.

## Zwei Folgen, die mitbedacht sind

**Alte gespeicherte Farben verschwinden nicht.** Steht der gespeicherte Wert
nicht mehr in der Palette, hängt er sich hinten an. Sonst sähe ein alter Eintrag
aus, als hätte er nie eine Farbe gehabt.

**Einträge ohne gespeicherte Farbe wechseln ihren Farbton.**
`getStableStackItemColor` greift über einen Hash in die Palette; eine andere
Palette heißt ein anderer Treffer. Betroffen sind nur Einträge, die
`colorMigration` noch nicht angefasst hat — gespeicherte Farben bleiben.

Der Test dazu hing an einem festen Hex-Wert und fiel bei jeder Farbänderung um,
ohne dass etwas kaputt war. Er prüft jetzt die Eigenschaft: derselbe Eintrag
bekommt immer dieselbe Farbe, sie stammt aus der Palette, und verschiedene
Einträge landen nicht alle auf derselben.

## Geprüft

`colors.test.ts` (Markenfarben enthalten, nach Farbton sortiert, Mindestabstand,
Stabilität), `PeptideColorPalette.test.ts` (Perlenverlauf auf jedem Feld,
Anhängen einer fremden Farbe, Auswahlzustand). Beide Themes im Browser
angesehen: der Haken bleibt weiß, weil die helle Theme-Regel `.text-white`
umfärbt — auf einer farbigen Perle wäre das ein dunkler Haken auf dunklem
Violett.
