# My Stack — Anlege-Formular und Bühnenformen verbinden

**Datum:** 2026-09-06
**Betrifft:** `DosageFormPicker`, `StackItemWizard`, `DosageFormPreview`, `stagePreview`
**Status:** umgesetzt

Zwölf Bühnenformen standen fertig da, aber wer eine Substanz anlegte, sah sie
nirgends: die Auswahl bestand aus Lucide-Symbolen, und das Objekt erschien erst
nach dem Speichern im Stack. Zwei Stellen verbinden das jetzt.

## 1. Die Auswahlkacheln zeigen das Objekt

Jede Kachel zeigt die echte Bühnengrafik in Miniaturgröße statt eines Symbols.
Man wählt damit, was man sieht.

| Thema | Entscheidung | Grund |
|---|---|---|
| Standplatz | 100 px hoch, Objekt unten bündig | Alle Formen stehen auf einer gemeinsamen Bodenlinie und behalten ihre Größenverhältnisse. Ein Pen ist höher als eine Tablette — das ist eine wahre Aussage über die Objekte, keine Layoutlaune. 100 px, weil der Pen als größte Form 96,9 px misst. |
| Farbe | die schon eingetragene Eintragsfarbe | Steht sie noch nicht fest, zeigen die Kacheln das Material der Form. Kein Vorgabeblau, das später nicht stimmt. |
| Aufschrift | keine | Die Kachel beschriftet sich selbst. Eine zweite Aufschrift auf dem Glas wäre in dieser Größe ein Fleck — und stünde im zugänglichen Namen des Knopfes. |
| `liquid`, `other` | Rückfall auf das Symbol | Sie haben keine Bühnengrafik. Die Regel „Formen ohne Bühnengrafik bleiben textlich" wird nicht aufgeweicht, indem man ihnen eine erfindet. |

## 2. Eine Vorschau über jedem Schritt

Sobald eine Darreichungsform gewählt ist, steht das Objekt über dem Formular und
übernimmt Name, Farbe und Wirkstoffmenge, während man sie eintippt.

Über **jedem** Schritt, nicht nur über der Formauswahl: Farbe und Menge kommen
aus späteren Schritten. Stünde die Vorschau nur dort, sähe man genau die
Änderungen nicht, die man gerade macht.

Kein Bühnenlicht und keine Physik. Die Lampe gehört dem Karussell, wo sie aus
der Lage der Karte kommt; im Formular gibt es keine Lage, also stünde sie still
— und eine stillstehende Lampe ist kein Effekt, sondern ein fest eingebautes
Gefälle.

## Wie es angeschlossen ist

`stagePreviewItem` gießt den Entwurf in einen `StackItem`, den `StackStage`
ohnehin rendert. **Absichtlich keine zweite Zuordnung Darreichungsform →
Grafik:** die gibt es einmal, in `StackStage`. Eine zweite könnte auseinander
laufen, und dann zeigte das Formular etwas anderes an als der Stack danach.

Halb getippte Farben werden abgefangen. Im Farbfeld steht während des Tippens
jeder Zwischenstand (`#`, `#f`, `#f9`); durchgereicht flackerte die Vorschau bei
jedem Tastendruck durch Schwarz, weil SVG einen unvollständigen Hex-Wert als
Schwarz zeichnet. Nur `#rgb` und `#rrggbb` kommen durch.

## `showLabel` für alle zwölf Formen

Fünf Formen kannten `showLabel` schon (die mit Etikettband). Sieben drucken
ihren Namen direkt auf den Körper und hatten keinen Schalter dafür. Ohne einen
stünde in jeder Auswahlkachel ein Fleck aus 3,5-px-Text.

Der Schalter heißt jetzt bei allen zwölf dasselbe: **beschriftet oder nackt**.
Bei den Glasformen schaltet er das Band, bei den anderen die Aufschrift auf dem
Körper. Der Kommentar in `PowderRenderer`, der `showLabel` als „das
Glas-Etikettband" beschrieb, ist entsprechend nachgezogen.

Eine Ausnahme bleibt sichtbar: das Zählwerk des Pens zeigt seine Null weiter.
Sie gehört zum Gerät wie die Riffelung, nicht zur Beschriftung.

## Geprüft

- `DosageFormPicker.test.tsx` — jede Kachel zeigt ihr Objekt, `liquid`/`other`
  ihr Symbol, keine Aufschrift im Bild, Farbe kommt an, halbe Hex-Werte nicht.
- `DosageFormPreview.test.tsx` — richtiger Renderer je Form, nichts für Formen
  ohne Grafik, Name/Farbe/Menge kommen an, `showLabel={false}` hält den Namen
  bei allen zwölf aus dem Bild.
- `stagePreview.test.ts` — Entwurf → Bühne, Hex-Prüfung, Wirkstoffe werden
  kopiert statt verlinkt.
- `StackItemWizard.interaction.test.tsx` — Vorschau erst ab gewählter Form,
  bleibt über den weiteren Schritten stehen, kein leerer Kasten für `liquid`.
- `DosageFormIcon.test.tsx` — die Symbolprüfungen, die vorher im Picker-Test
  standen, gehören jetzt zur Komponente, die sie zeichnet.
