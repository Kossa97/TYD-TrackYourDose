# Etikett — der Durchlauf bis an beide Kanten

**Datum:** 2026-09-14
**Betrifft:** `marquee`, `StageLabel`, `PeptideVialVisual` (Etikettklasse)
**Status:** umgesetzt

## Die Vorgabe

Besprochen statt geraten. Die Antwort des Nutzers:

> jede darreichungsform bekommt ihre schriftgröße die proportional passt, kurze
> namen — perfekt wenn sie passen (bleiben zentral mittig). für die namen die zu
> lang sind nehmen wir unsere etikett durchlauf funktion (aber nicht wie sie
> jetzt ist sondern die buchstaben/zahlen laufen bis ans äußerste ende des
> etikettes durch)

Also **keine** Schrift, die sich je Name auf die Breite rechnet: die Größe bleibt
eine Eigenschaft der Darreichungsform. Was sich ändert, ist der Durchlauf.

## Gemessen

Je Form die Breite des Bandes gegen die Breite der Fläche, auf der die
Aufschrift laufen darf:

| Form | Band | Laufläche | verschenkt |
|---|---|---|---|
| **Vial** | 172 px | 164 px | **8 px** |
| Ampulle, Tropfen, Nasenspray, Spray, Gel | = | = | 0 px |

Der Vial hatte als einzige Form `px-1` am Band — vier Pixel je Seite, die die
Aufschrift nie benutzen konnte. Raus damit.

## Die Ruhelage war die Mitte

Der eigentliche Befund steckte in der Bewegung. Die Ruhelage eines zu langen
Namens war seine **Mitte**:

```
Ruhe:  [ emaglutid Enanta ]   vorn und hinten abgeschnitten
```

Der Gedanke dahinter war, dass ein zu langer Name dann wie jeder kurze
zentriert steht. In der Ansicht heißt das aber: was man sieht, solange nichts
läuft, ist ein Stück aus der Mitte des Wortes. Genau das stand im gemeldeten
Bild („Semagluti" auf der Ampulle).

**Ein Etikett liest man von vorne.** Die Ruhelage ist jetzt der Anfang:

```
Ruhe:  [ Testosteron Enan…    erster Buchstabe an der linken Kante
Lauf:  →  …eron Enantat 250 ] letzter Buchstabe an der rechten Kante
Lauf:  ←  zurück an den Anfang
```

Die Bewegung hält nur noch an den beiden Enden, nicht mehr auf halber Strecke.
Vier Haltepunkte wurden zwei, die Schleife endet, wo sie beginnt.

## Nachgemessen

Die Animation an ihren Haltepunkten angehalten und die Kanten verglichen:

| | erster Buchstabe zur linken Kante | letzter zur rechten |
|---|---|---|
| vorne (Ruhe) | **0 px** | — |
| hinten | — | **0 px** |

Bei allen fünf Formen mit überlangem Namen. Nichts bleibt ungenutzt.

## Verifikation

- Sechs Formen mit „Testosteron Enantat 250" im Browser aufgenommen, an beiden
  Haltepunkten vermessen; Laufläche = Bandbreite bei jeder Form.
- Neue `marquee.test.ts`: Ruhelage 0, die Verschiebungen erreichen genau 0 und
  −overflow und nichts dazwischen, die Schleife endet am Anfang.
- `TZ=Europe/Berlin npx vitest run` — **1499 Tests grün** (143 Dateien), 5 neu.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.
