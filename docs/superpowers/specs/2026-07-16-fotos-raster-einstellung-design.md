# Fortschritt-Fotos: adaptives Vorschau-Raster – Design

## Ziel
Die Fotos-Vorschau im Fortschritt bleibt gleich hoch wie die benachbarte Blutwerte-Karte, zeigt aber nur tatsächlich vorhandene Fotos. Die vollständige Fotos-Ansicht behält ihre eigene Klein/Mittel/Groß-Rasterwahl.

## Verhalten
- Fotos aus dem ausgewählten Zeitraum werden zuerst normal angezeigt.
- Falls der Zeitraum weniger Fotos enthält, werden weitere vorhandene Fotos außerhalb des Zeitraums weichgezeichnet mit dem Hinweis „Nicht im ausgewählten Zeitraum“ ergänzt.
- Es werden höchstens sechs Fotos in der Vorschau verwendet.
- Das Raster passt sich der Anzahl an: 1 Foto = 1 Spalte, 2 Fotos = 2 Spalten, 3–4 Fotos = 2 Spalten, 5–6 Fotos = 3 Spalten.
- Fehlende Slots werden nicht mit Plus-Kacheln gefüllt. Eine Hinzufügen-Kachel erscheint nur, wenn insgesamt keine Fotos vorhanden sind.
- Die Kartenhöhe wird nicht durch die Fotoanzahl verändert; das Raster füllt den verfügbaren Innenraum der gestreckten Karte.

## Umsetzung
`buildPhotoSlots` kombiniert Zeitraum-Fotos und außerhalb liegende Fotos mit einem `inRange`-Status. `FotosCard` berechnet daraus Spalten und Zeilen, rendert den Zeitraum-Hinweis als Overlay und nutzt bei null Fotos ausschließlich die Hinzufügen-Darstellung.

## Prüfung
Die Slot-Reihenfolge, die Begrenzung auf sechs Fotos und die Spaltenzuordnung werden als reine Helper-Logik getestet. Anschließend laufen Testsuite, TypeScript-Build und Produktions-Build.