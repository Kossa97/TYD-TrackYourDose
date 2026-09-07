# My Stack — Vorschau mit Farbpalette über dem Formular

**Datum:** 2026-09-07
**Betrifft:** `StackItemWizard`, `DosageFormPreview`, `PeptideColorPalette`
**Status:** umgesetzt

Sobald eine Darreichungsform gewählt ist, steht das Objekt über dem Formular
und übernimmt Name, Farbe und Wirkstoffmenge während des Tippens. Direkt
darunter liegt jetzt die Farbpalette.

## Was sich geändert hat

Die Farbe war ein **Hex-Textfeld im letzten Schritt** — weit weg von allem, was
sie verändert, und mit einem Wert, den man tippen musste (`#00ccf5`). Jetzt ist
sie eine Palette direkt unter dem Objekt, das sie färbt. Ein Griff, und die
Dose wechselt die Farbe, ohne einen Schritt weiterzugehen.

| Thema | Entscheidung | Grund |
|---|---|---|
| Bedienung | `PeptideColorPalette` | Dieselbe **Komponente** wie beim Anlegen eines Peptids, nicht eine zweite mit denselben zwölf Farben. Wer beides kennt, bedient dasselbe. |
| Ort | unter der Vorschau, nicht im Schritt „Details" | Die Farbe gehört zu dem Objekt, das sie färbt. Zwischen Wahl und Wirkung soll nichts liegen. |
| Sichtbarkeit | ab der gewählten Form, auf jedem Schritt | Farbe und Menge kommen aus verschiedenen Schritten; man soll sehen, was man gerade ändert. |
| Ohne Farbe | nichts ausgewählt | Die Formen haben ihr eigenes Material als Rückfall. Eine vorgewählte Farbe wäre eine Behauptung. |

Die Auswahlreihen darunter tragen dieselbe Farbe: man sieht an jedem Objekt,
wie der Eintrag in dieser Form aussähe.

## Maße

Der Vorschaublock misst mit Palette 300 px. Das ist viel über jedem Schritt —
bewusst in Kauf genommen, weil das Färben genau hier stattfindet. Wenn es zu
schwer wiegt, ist der nächste Schritt, ihn auf den späteren Schritten
zusammenzuklappen.

## Geprüft

`StackItemWizard.interaction.test.tsx` — die Palette steht im Vorschaublock, und
ein Griff auf ein Feld färbt das Objekt sofort um, ohne Schrittwechsel.
