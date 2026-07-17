# Sichtfenstergebundene Chart-Animation

## Ziel

Beim Öffnen von „Fortschritt“ animiert die standardmäßig ausgewählte Metrik „Gewicht“ ausschließlich innerhalb der standardmäßigen 3-Monatsansicht. Zuerst wird die sichtbare Linie langsam von links nach rechts aufgebaut, danach erscheinen die sichtbaren Punkte einzeln von links nach rechts. Beim Wechsel auf eine andere Metrik läuft dieselbe Sequenz erneut.

## Verhalten

- Standardmetrik bleibt `weight`, Standardfenster bleibt `3m`.
- Animiert werden nur Datenpunkte mit Zeitstempel innerhalb von `viewStart` und `viewEnd`.
- Die Linie endet vollständig, bevor der erste Punkt beginnt.
- Punktstarts haben einen konstanten zeitlichen Abstand.
- Ein Metrikwechsel setzt die Animation vor dem nächsten sichtbaren Frame zurück.
- Wischen oder Springen im Zeitfenster startet die Animation nicht erneut.
- Zyklusbalken bleiben von Metrikwechseln unberührt.
- `prefers-reduced-motion` zeigt Linie und Punkte ohne Animation vollständig an.

## Prüfung

Quelltests sichern Sichtfensterfilter, Reihenfolge und Neustartlogik. Eine Browsermessung prüft aufsteigende X-Positionen, konstante Delays und die Reihenfolge Linie vor Punkten.
