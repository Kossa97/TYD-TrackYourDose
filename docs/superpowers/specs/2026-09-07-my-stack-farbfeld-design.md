# My Stack — Farbfeld zum Ziehen

**Datum:** 2026-09-07
**Betrifft:** `ColorField`, `lib/colorField.ts`, `StackItemWizard`
**Status:** umgesetzt

Statt zwölf fertiger Felder eine Fläche zum Ziehen: Sättigung nach rechts,
Helligkeit nach oben, darunter die Farbtonschiene. Der Nutzer wählt **seine**
Farbe, nicht eine aus zwölf. Während des Zuges färbt sich das Objekt darüber
mit.

## Entscheidungen

| Thema | Entscheidung | Grund |
|---|---|---|
| Farbmodell | HSV, nicht HSL | Die Fläche IST HSV: Sättigung mal Helligkeit. In HSL wäre sie nicht rechteckig, und der Griff läge neben der Farbe, die darunter gemalt ist. |
| Rechnung | eigene Datei mit Tests | Ein Rundungsfehler zeigt sich nicht als Absturz, sondern als Griff, der beim Anfassen einen Schritt wegspringt. `colorField.test.ts` prüft den Rundlauf für alle Palettenfarben. |
| Unsere Farben | fünf Striche unter der Schiene | Sie schränken nichts ein — sie zeigen, wo `--cat-amber`, `--cat-emerald`, `--accent`, `--cat-violet` und `--cat-rose` liegen. |
| Startpunkt | unser Akzent (H 190) | Kein Zufallston und kein Grau. Die App hat eine Farbe. |
| Tastatur | Pfeiltasten auf beiden Flächen | Ein Ziehfeld allein ist mit Tastatur unbedienbar. Shift macht große Schritte. |

## Zwei Dinge, ohne die es auf dem Handy nicht funktioniert

**`touch-action: none`** auf beiden Flächen — sonst scrollt die Seite, statt
dass der Griff folgt.

**`setPointerCapture`** beim Aufsetzen — sonst reißt der Zug ab, sobald der
Finger die Fläche verlässt, und der Griff bleibt stehen. Wer über den Rand
hinauszieht, bleibt stattdessen am Rand hängen.

Beides ist im Browser mit echtem Touch geprüft, nicht nur in jsdom: Tippen
setzt die Farbe, Ziehen über die Schiene liefert fünf verschiedene Farben in
Folge, und die Dose darüber färbt sich bei jedem Schritt mit.

## Der eigene Ruf kommt nicht zurück

Die Komponente merkt sich, was sie zuletzt gemeldet hat, und übernimmt einen
Wert von außen nur, wenn er ein anderer ist. Zwei Gründe:

1. Bei Sättigung 0 haben **alle** Farbtöne dieselbe Farbe. Käme der eigene Ruf
   zurück, ginge der Ton beim Ziehen durch Weiß verloren und der Griff der
   Schiene spränge auf Rot.
2. Ein Hex hat 8 Bit je Kanal. Der genaue Farbton überlebt die Rundung nicht —
   der Griff wanderte bei jedem Schritt ein Stück, ohne dass jemand ihn zieht.

## Was bleibt

`PeptideColorPalette` mit den zwölf Perlen steht weiter im Peptid-Editor. Wenn
das Farbfeld sich bewährt, gehört es auch dorthin.

## Geprüft

`colorField.test.ts` (Rundlauf, Ecken, Werte außerhalb, halbe Hex-Werte,
Markentöne), `ColorField.test.tsx` (Griffposition, Tastatur, Rand, Farbkreis,
Zeigerfang, laufendes Melden, Marken, kein Rückspielen),
`StackItemWizard.interaction.test.tsx` (Feld statt Hex-Feld im Vorschaublock,
Objekt färbt sofort mit).
