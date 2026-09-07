# My Stack — Formauswahl auf einer Fläche

**Datum:** 2026-09-06
**Betrifft:** `DosageFormPicker`, `DosageFormPreview`
**Status:** umgesetzt

Dritter Anlauf. Der erste (a0721fd) gab jeder Form ihre eigene gerahmte Kachel
und wurde verworfen; der zweite legte sie als Raster auf eine gemeinsame Fläche;
dieser macht zwei Reihen zum Wischen daraus. Vierzehn gerahmte Kacheln lesen sich als vierzehn
Bedienelemente; vierzehn Gegenstände auf einer Fläche lesen sich als das, was
sie sind — eine Auswahl von Dingen.

## Entscheidungen

| Thema | Entscheidung | Grund |
|---|---|---|
| Rahmen | einer, um alles | Kein Kasten je Form. Die Buttons bleiben Buttons, sie tragen nur keine Kante und keine Füllung mehr. |
| Auswahl | Spot unter dem Objekt | Ein Rahmen um das gewählte Objekt zerlegte die Fläche wieder in Kacheln. Der Lichtkegel liegt unter dem Objekt, wie auf einer Bühne, und die Beschriftung wechselt auf Sky. |
| Nicht gewählt | Fokus 0,55 statt 1 | Gedimmt mit demselben Regler, den das Karussell benutzt — nicht mit einer Deckkraft über allem. Ganz aus wäre zu wenig: die Alternativen sollen erkennbar bleiben. |
| Standplatz | 100 px, Objekt unten bündig | Gemeinsame Bodenlinie, echte Größenverhältnisse. Ein Pen ist höher als eine Tablette. 100 px, weil der Pen als größte Form 96,9 px misst. |
| Anordnung | zwei Reihen zum Wischen | Statt eines Rasters: die empfohlenen oben, alle übrigen darunter. Beide stehen immer da — das Aufklappen entfällt, weil eine Reihe nichts verstecken muss, was man wegwischen kann. |
| Kanten | weiches Auslaufen | Ohne Scrollbalken ist das der einzige Hinweis, dass die Reihe weitergeht. Ein hart abgeschnittenes Objekt am Rand liest sich als Fehler, ein ausblendendes als Fortsetzung. |
| Beschriftung | eine, nicht vierzehn | Unter den Objekten steht kein Wort; genannt wird nur, was gerade gewählt ist. Vierzehn Aufschriften waren zu viel, keine einzige wäre ein Rätsel. Die Knöpfe tragen ihren Namen als `aria-label`. |
| Gruppen | Linie statt zweitem Kasten | „Häufige" und „Weitere" bleiben getrennt, aber die Fläche bleibt eine. |
| Aufschrift | keine auf dem Objekt | Der Knopf beschriftet sich selbst. Eine zweite Aufschrift wäre in dieser Größe ein Fleck — und stünde im zugänglichen Namen des Knopfes. |
| `liquid`, `other` | Rückfall auf das Symbol | Sie haben keine Bühnengrafik und bekommen auch keine erfundene. |

## `showLabel` für alle zwölf Formen

Fünf Formen kannten `showLabel` schon (die mit Etikettband). Sieben drucken
ihren Namen direkt auf den Körper und hatten keinen Schalter dafür. Der
Schalter heißt jetzt bei allen zwölf dasselbe: **beschriftet oder nackt**.

Eine Ausnahme bleibt sichtbar: das Zählwerk des Pens zeigt seine Null weiter.
Sie gehört zum Gerät wie die Riffelung, nicht zur Beschriftung.

## Eine Falle, die auffiel

Ein `<fieldset>` hat von Haus aus `min-inline-size: min-content` und weigert
sich damit, schmaler zu werden als sein Inhalt. Ohne `min-w-0` waren die Reihen
636 px breit in einem 430-px-Fenster und scrollten nirgends — sie schoben
stattdessen die Seite auf. Im Browser gemessen, nicht geraten.

## Geprüft

`DosageFormPicker.test.tsx`, `DosageFormPreview.test.tsx`,
`DosageFormIcon.test.tsx` — jedes Objekt an seiner Stelle, Rückfall auf das
Symbol, keine Aufschrift im Bild, Farbe kommt an, halbe Hex-Werte nicht.
