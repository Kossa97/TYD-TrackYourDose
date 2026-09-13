# Farbschritt — die Darstellung der Objekte

**Datum:** 2026-09-13
**Betrifft:** `PeptideVialVisual`, `capsuleShape`, `CapsuleVisual`, Farbschritt im `StackItemWizard`
**Status:** umgesetzt

## Vorgehen

Alle zehn Formen, die die Farbe zeigen, im Browser auf dem Farbschritt
aufgenommen — mit gesetzter Farbe, bei doppelter Pixeldichte, und vermessen:
wie viel der Fläche das Objekt füllt und woraus es besteht. Drei Befunde.

## 1. Der Vial trug einen Feldnamen als Etikett

`vialAmountLabel()` fiel auf den Text `'Wirkstoff / Vial'` zurück, sobald keine
Wirkstoffmenge eingetragen war. Dieser Rückfall war:

- **ein Feldname als Inhalt** — fett, in Versalien, auf dem Etikett, in
  derselben Größenordnung wie der Substanzname;
- **hartkodiertes Deutsch** in einer App, die auf Deutsch *und* Englisch
  startet — auch im `aria-label`;
- **auf dem Farbschritt immer sichtbar**, denn der kommt vor dem Stärke-Schritt.
  Die Menge ist dort per Definition noch leer.

Keine andere Form tut das: Tablette und Kapsel tragen dort nur den Namen. Der
Vial stand also als einziger mit zwei zusätzlichen Zeilen Platzhaltertext da —
genau die Form, die als Peptid-Darstellung am häufigsten vorkommt.

**Ein leeres Feld beschriftet man nicht mit seinem eigenen Namen.** Fehlt die
Menge, fällt die Zeile weg (`StageLabel` lässt `null` aus) und das Etikett
schrumpft auf eine Zeile. Ist sie da, bleibt alles wie zuvor.

## 2. Die Kapsel hatte ein Rechteck quer über der linken Hälfte

`CAPSULE_CAP_PATH` ist geschlossen — das braucht die Füllung und der Clip. Sie
wurde aber auch **gestrichen**, und dann zeichnet das schließende `Z` eine
Senkrechte über die volle Höhe bei x = 130: die offene Seite der Kappe, die in
Wirklichkeit im Körper steckt und nichts zu zeigen hat. Zusammen mit den beiden
waagerechten Kanten, die vier Einheiten außerhalb des Körpers verlaufen (die
Kappe ist weiter — so steckt man eine Kapsel zusammen), ergab das ein sichtbares
Rechteck.

Gefüllt und gestrichen wird jetzt getrennt: die Kontur läuft über eine **offene**
Fassung derselben Kanten (`CAPSULE_CAP_OUTLINE_PATH`,
`CAPSULE_CAP_INNER_OUTLINE_PATH`). Ein Test hält fest, dass die offene Fassung
genau die geschlossene ohne `Z` ist — sonst laufen Füllung und Kontur
auseinander.

## 3. Flache Objekte klebten am Boden

Die Objektfläche stand auf `items-end`. Bei der liegenden Kapsel sind das
128 px Objekt in 366 px Fläche: **238 px Leere darüber**, das Objekt unten an
der Kante. Die Bühnenregel, die mehrere Formen nebeneinander auf dieselbe
Bodenlinie stellt, gilt hier nicht — auf dem Farbschritt steht immer genau ein
Objekt. Jetzt `items-center`.

Für hohe Formen (Vial, Pen, Ampulle, Tropfen, Spray) ändert das nichts: sie
füllen die Höhe ohnehin zu 94 %.

## Gemessen

Anteil der Fläche, den das Objekt einnimmt — die Skalierung selbst war in
Ordnung, die knappere Seite kommt überall auf 94 %:

| Form | füllt Höhe | füllt Breite |
|---|---|---|
| Vial, Ampulle, Pen, Tropfen, Nasenspray, Spray, Pulver | 94 % | 12–59 % |
| Tablette | 94 % | 89 % |
| Gel | 80 % | 94 % |
| Kapsel | 35 % | 94 % |

## Verifikation

- Alle zehn Formen vor und nach der Änderung aufgenommen und verglichen.
- `TZ=Europe/Berlin npx vitest run` — **1490 Tests grün** (142 Dateien), 2 neu.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.

## Was auffiel und nicht geändert wurde

Der Vial ist mit 188 px die schmalste der breiten Formen — er wird von der
Höhe begrenzt und lässt seitlich Platz. Das ist die richtige Rechnung
(`object-fit: contain`), kein Fehler: breiter ziehen hieße, die Proportionen
zu verlieren.
