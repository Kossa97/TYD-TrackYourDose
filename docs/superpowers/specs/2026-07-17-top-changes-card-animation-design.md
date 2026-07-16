# Animation der größten Veränderungen

## Ziel

Die bis zu vier Karten unter „Größte Veränderungen“ sollen ihre neu berechneten Daten hochwertig und nachvollziehbar präsentieren, ohne das 2×2-Raster zu verschieben oder die Chart-Navigation zu verzögern.

## Verhalten beim Öffnen

- Die Animation startet erst, wenn die Fortschrittsdaten geladen sind und mindestens eine Veränderungskarte vorhanden ist.
- Die Karten werden in Leserichtung gestaffelt: oben links, oben rechts, unten links, unten rechts.
- Jede Karte blendet ein und bewegt sich ungefähr 10 px nach oben.
- Innerhalb der Karte erscheinen Titel und Wertezeile zuerst; der farbige Veränderungswert folgt mit einem kurzen, weichen Glow.
- Eine Karte animiert ungefähr 400 ms. Der Abstand zwischen den Kartenstarts beträgt ungefähr 90 ms, sodass sich die Animationen überlappen und das Raster nach ungefähr 700 ms vollständig aufgebaut ist.
- Abmessungen und Positionen des Rasters sind schon vor der Animation reserviert, damit kein Layout-Sprung entsteht.

## Verhalten beim Zeitraumwechsel

- Die Kartenflächen und das Raster bleiben stabil.
- Bestehende Inhalte werden kurz abgedämpft und durch die neu berechneten Inhalte ersetzt.
- Die neuen Veränderungswerte werden in Leserichtung kurz nacheinander hervorgehoben.
- Hinzukommende Karten blenden weich ein; wegfallende Karten blenden weich aus.
- Es gibt kein Zahlen-Hochzählen und keine animierte Umsortierung der Kartenpositionen.

## Sonderfälle und Bedienung

- Wenn keine Veränderungskarten vorhanden sind, bleiben die bestehenden Leerzustände unverändert und werden nicht animiert.
- Bei `prefers-reduced-motion: reduce` erscheinen alle Karten und Inhalte sofort ohne Bewegung oder Glow.
- Karten bleiben während und nach der Animation anklickbar. Die bestehende Navigation zur jeweiligen Chart-Metrik ändert sich nicht.
- Schnelle aufeinanderfolgende Zeitraumwechsel dürfen keine veralteten Animationen oder Werte zurücklassen; nur der aktuelle Kartenbestand ist sichtbar.

## Technischer Zuschnitt

- `TopChangesSection` erhält den aktuell gewählten Zeitraum als Animationsauslöser oder eine daraus abgeleitete stabile Kennung.
- `ChangeCard` erhält ihren Kartenindex, um die Verzögerung ausschließlich aus der sichtbaren Reihenfolge abzuleiten.
- Die Bewegung verwendet nur `transform` und `opacity`; der Glow verändert ausschließlich Darstellungswerte und keine Geometrie.
- Bestehende Datenberechnung in `computeTopChanges` bleibt unverändert.

## Verifikation

- Komponententests sichern Reihenfolge, Zeitraumwechsel, leere Zustände und unveränderte Kartennavigation ab.
- Ein Test sichert die Variante für reduzierte Bewegung ab.
- Visuelle Prüfung erfolgt mit einer, zwei, drei und vier Karten sowie bei einem Zeitraumwechsel auf einem mobilen Viewport.
