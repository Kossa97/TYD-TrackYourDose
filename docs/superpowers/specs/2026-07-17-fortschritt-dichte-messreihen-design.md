# Fortschritt-Chart: Ruhige 3M-Ansicht für Gewicht und KFA

**Datum:** 2026-07-17
**Status:** Design freigegeben

## Ziel

In der 3M-Ansicht erzeugen tägliche Gewichts- und KFA-Einträge zu viele dauerhaft
sichtbare Punkte. Die Kurve soll dort ruhig und gut lesbar bleiben, ohne beim Ablesen
Werte zu erfinden oder die Herkunft eines angezeigten Werts zu verschleiern.

## Entscheidungen

| Bereich | Verhalten |
|---|---|
| Gewicht, 30T | Unverändert: Linie und dauerhaft sichtbare Messpunkte |
| KFA, 30T | Unverändert: Linie und dauerhaft sichtbare Messpunkte |
| Gewicht, 3M | Nur die Linie; keine dauerhaften Messpunkte |
| KFA, 3M | Nur die Linie; keine dauerhaften Messpunkte |
| Blutwerte | In beiden Chart-Fenstern unverändert |
| Zyklusbalken | Darstellung und bisheriges Cursorverhalten unverändert |

Die Regel richtet sich bewusst nach Metrik und Chart-Fenster, nicht nach einer
veränderlichen Punktanzahl. Der Chart besitzt nur die lokalen Fenster 30T und 3M; damit
ist das Verhalten für den Nutzer stabil und vorhersehbar.

## Ablesen in der 3M-Ansicht

Für Gewicht und KFA gilt in 3M:

1. Der vertikale Cursor folgt Finger oder Maus flüssig und rastet nicht an den
   Messzeitpunkten der Metrik ein.
2. Zum freien Cursorzeitpunkt wird der zeitlich nächstgelegene **echte** Messwert aus
   dem sichtbaren Fenster bestimmt. Es wird kein Wert zwischen zwei Einträgen
   interpoliert.
3. Nur während der Interaktion erscheint dieser Messwert als einzelner temporärer
   Punkt in der Farbe der Metriklinie.
4. Der temporäre Punkt liegt an Datum und Wert des echten Eintrags. Der vertikale
   Cursor bleibt an der tatsächlichen Finger- oder Mausposition und wird nicht zum
   Punkt gezogen.
5. Der Tooltip benennt die Herkunft ausdrücklich, zum Beispiel:

   ```text
   Messwert vom 14. Juli
   88,4 kg
   ```

Das Messdatum im Tooltip ist immer das Datum des gewählten Eintrags, nicht das freie
Cursordatum. Dadurch bleiben auch größere Lücken in der Erfassung ehrlich erkennbar.

Bestehendes Einrasten an Zyklusstarts bleibt erhalten. Entfernt wird ausschließlich
das Einrasten an den Gewichts- beziehungsweise KFA-Messpunkten.

## Auswahl des echten Messwerts

- Berücksichtigt werden nur echte Messpunkte innerhalb des aktuell sichtbaren
  3M-Fensters.
- Gewählt wird der zeitlich nächstgelegene Eintrag zum freien Cursorzeitpunkt.
- Bei identischem Abstand gewinnt deterministisch der ältere Eintrag.
- Liegt im sichtbaren Fenster kein Messwert vor, erscheint kein temporärer Metrikpunkt
  und kein Metrikwert im Tooltip. Vorhandene Zyklusinformationen funktionieren weiter.
- Am linken und rechten Rand wird niemals ein Messwert außerhalb des sichtbaren
  Fensters eingeblendet.

## Animation

- Beim Öffnen von Fortschritt und beim Wechsel auf Gewicht oder KFA wird in 3M nur die
  sichtbare Linie von links nach rechts aufgebaut.
- Die anschließende permanente Punkteanimation entfällt für diese beiden Metriken in
  3M vollständig.
- In 30T sowie bei Blutwerten bleibt die bestehende Sequenz aus Linie und anschließend
  einzeln erscheinenden Punkten unverändert.
- `prefers-reduced-motion` bleibt unverändert berücksichtigt.

## Technischer Zuschnitt

Die Änderung bleibt auf die bestehende Recharts-Struktur begrenzt:

- `MetricChart` entscheidet anhand von Metrik und lokalem Fenster, ob permanente Punkte
  und deren Animation gerendert werden.
- Die Snap-Daten für den Cursor trennen Metrikmessungen von Zyklusstarts. In 3M werden
  bei Gewicht und KFA nur die Metrikmessungen als Snap-Ziele entfernt.
- Die Tooltip-Auswertung erhält zusätzlich den nächsten sichtbaren echten Messpunkt.
- Ein eigener temporärer Marker wird ausschließlich während aktiver Cursorinteraktion
  an dessen echten Chartkoordinaten dargestellt.
- Die gespeicherten Daten, die Liniengeometrie und die Zyklusbalken werden nicht
  verändert.

## Verifikation

Automatisierte Tests sichern:

- Gewicht und KFA verwenden nur in 3M den reduzierten Modus.
- 30T und alle Blutwerte behalten die bisherigen Punkte.
- Der nächste echte Messwert wird links und rechts korrekt gewählt.
- Bei gleichem Abstand wird der ältere Eintrag gewählt.
- Messwerte außerhalb des sichtbaren Fensters werden ignoriert.
- Metrikmessungen ziehen den Cursor im reduzierten Modus nicht an; Zyklusstarts bleiben
  Snap-Ziele.
- In 3M gibt es für Gewicht und KFA keine permanente Punkteanimation.

Manuell im Browser wird geprüft:

- Die 3M-Linie wirkt ohne Punktteppich ruhig.
- Maus und Touch bewegen den Cursor flüssig ohne Einhaken an Tageswerten.
- Der temporäre Punkt wechselt nachvollziehbar zwischen echten Messungen.
- Tooltip-Datum, Punktposition und Wert gehören immer zum selben gespeicherten Eintrag.
- Der Metrikwechsel startet weiterhin die vorgesehene Linienanimation.
- Pan, Halten zum Ablesen und Zyklusbalken verhalten sich unverändert.
