# Werteübersicht in Fortschritt

**Datum:** 2026-07-17
**Feature:** Fortschritt
**Status:** Design abgenommen, bereit für Spec-Review

## Ziel

Die bisherige Blutwerte-Karte rechts neben der Fotos-Karte wird durch eine kompakte Übersicht der persönlichen Verlaufswerte ersetzt. Die Karte zeigt nicht nur Einzelwerte, sondern den Durchschnitt der neueren Hälfte des ausgewählten Zeitraums und dessen Veränderung gegenüber der älteren Hälfte.

Gewicht bleibt bewusst außen vor, weil es bereits die standardmäßig ausgewählte Chart-Metrik ist. Die eigenständige Blutwerte-Seite und Blutwerte im Verlauf-Chart bleiben unverändert.

## Abgenommene Darstellung

- Die Fotos-Karte links bleibt unverändert.
- Rechts erscheint eine gleich hohe Karte mit dem Titel **„Deine Werte“**.
- Untertitel: **„Ø zweite Hälfte“**.
- Die Karte verwendet die ruhige Listenstruktur aus Entwurf A.
- Jede Metrik belegt eine Zeile: Bezeichnung links, aktueller Durchschnitt und Veränderung rechts.
- Angezeigte Metriken und Reihenfolge:
  1. Energie
  2. Schlaf
  3. Wohlbefinden
  4. Libido
  5. KFA
- Wellness-Werte werden mit einer Nachkommastelle ohne `/10` dargestellt, beispielsweise `7,6`.
- KFA wird mit einer Nachkommastelle und `%` dargestellt, beispielsweise `17,8 %`.
- Es gibt keinen zusätzlichen Gesamtwert, weil die fünf Metriken unterschiedliche Aussagen haben.
- Die Kartenhöhe wird nicht vom Inhalt verändert. Fotos- und Wertekarte werden im bestehenden Zwei-Spalten-Raster gleich hoch gestreckt.

## Zeitraum und Vergleich

Der oben in Fortschritt ausgewählte Zeitraum steuert sowohl die Fotos-Karte als auch die neue Werteübersicht.

1. Der inklusive Datumsbereich wird in zwei möglichst gleich große Kalenderhälften geteilt.
2. Bei einer ungeraden Anzahl von Tagen enthält die zweite Hälfte den zusätzlichen Tag.
3. Pro Metrik werden nur vorhandene, numerische Werte berücksichtigt; `null`-Werte zählen nicht als Messung.
4. Der große Wert ist der arithmetische Durchschnitt der zweiten Hälfte.
5. Die Veränderung ist `Durchschnitt zweite Hälfte − Durchschnitt erste Hälfte`.
6. Durchschnitt und Veränderung werden für die Anzeige auf eine Nachkommastelle gerundet. Die Statusfarbe wird aus der ungerundeten Veränderung bestimmt.

Für **„Alles“** gilt dieselbe Regel: Der vollständige verfügbare Fortschrittszeitraum wird in eine ältere und eine neuere Hälfte geteilt. Es wird kein separater, gleich langer Vergleichszeitraum vor dem ausgewählten Zeitraum benötigt.

## Mindestdaten und Leerzustände

Die Datenlage wird für jede Metrik unabhängig bewertet.

- Ein Durchschnitt der zweiten Hälfte wird angezeigt, sobald dort mindestens ein Wert vorhanden ist.
- Eine Veränderung wird nur berechnet, wenn in jeder Hälfte mindestens zwei Werte der jeweiligen Metrik vorhanden sind.
- Reichen die Vergleichsdaten nicht aus, bleibt der Durchschnitt sichtbar und rechts steht **„Noch kein Vergleich“** in neutralem Grau.
- Gibt es in der zweiten Hälfte keinen Wert, zeigt die Zeile statt eines Durchschnitts **„Keine Daten“** in neutralem Grau.
- Fehlende Daten einer Metrik unterdrücken keine anderen Zeilen und verändern die Kartenhöhe nicht.

## Statusfarben

Nur Pfeil und Veränderungswert erhalten eine Statusfarbe. Metrikbezeichnung, Hauptwert, Zeilenhintergrund und Kartenfläche bleiben neutral. Pfeil und Vorzeichen transportieren die Richtung zusätzlich, damit die Bedeutung nicht allein von Farbe abhängt.

### Energie, Schlaf, Wohlbefinden und Libido

| Veränderung | Darstellung |
|---|---|
| mindestens `+0,2` | Grün, Pfeil nach oben |
| größer als `-0,2` und kleiner als `+0,2` | Grau, waagerechter Pfeil bzw. `±0,0` |
| höchstens `-0,2`, aber größer als `-1,0` | Orange, Pfeil nach unten |
| höchstens `-1,0` | Rot, Pfeil nach unten |

### KFA

Für KFA gilt ausschließlich in dieser Verlaufsdarstellung die vereinbarte umgekehrte Richtung: niedriger wird als Verbesserung dargestellt. Daraus wird keine medizinische Bewertung oder Zielzone abgeleitet.

| Veränderung in Prozentpunkten | Darstellung |
|---|---|
| höchstens `-0,2` | Grün, Pfeil nach unten |
| größer als `-0,2` und kleiner als `+0,2` | Grau, waagerechter Pfeil bzw. `±0,0 %` |
| mindestens `+0,2`, aber kleiner als `+1,0` | Orange, Pfeil nach oben |
| mindestens `+1,0` | Rot, Pfeil nach oben |

## Technischer Zuschnitt

- `FortschrittDashboard` rendert anstelle von `BlutwerteCard` eine neue Wertekarte und übergibt `dailyLogs` sowie den bereits berechneten `pageRange`.
- Eine neue reine Bibliotheksfunktion teilt den Zeitraum, bildet die fünf metrikspezifischen Durchschnitte und liefert pro Zeile Anzeigezustand, Delta und Status.
- Die Berechnung bleibt außerhalb der React-Komponente, damit Zeitraumlogik, Mindestdaten und KFA-Invertierung isoliert testbar sind.
- Die Komponente übernimmt nur Reihenfolge, Formatierung und Darstellung.
- Die nicht mehr verwendete Fortschritt-spezifische `BlutwerteCard` wird entfernt. Das Blutwerte-Feature außerhalb dieser Dashboard-Karte bleibt unangetastet.
- Bestehende Top-Veränderungen, Chart-Metriken, Chart-Animationen und Fotos-Logik werden nicht verändert.

## Tests und Verifikation

Pure-Function-Tests decken ab:

- gerade und ungerade Zeiträume einschließlich des zusätzlichen Tages in der zweiten Hälfte;
- unabhängiges Ignorieren von `null`-Werten;
- Durchschnitt der zweiten Hälfte ab einem Wert;
- Vergleich erst ab zwei Werten pro Hälfte;
- Rundung auf eine Nachkommastelle;
- Grün, Grau, Orange und Rot an den Grenzwerten;
- umgekehrte Verbesserungsrichtung für KFA;
- „Keine Daten“ und „Noch kein Vergleich“ pro Metrik.

Komponenten- beziehungsweise Strukturtests sichern ab:

- die feste Reihenfolge der fünf Zeilen;
- das Fehlen von Gewicht und Blutwerte-Karte;
- die Übergabe des aktuell ausgewählten `pageRange`;
- neutrale Hauptwerte und ausschließlich farbige Veränderungsanzeigen.

Abschließend werden der vollständige Testlauf, der Produktions-Build und eine visuelle Prüfung auf mobilem Viewport durchgeführt. Dabei werden volle Daten, teilweise fehlende Daten sowie ein Zeitraumwechsel geprüft.

## Nicht in diesem Umfang

- Ein kombinierter Score über alle fünf Werte.
- Gewicht in der neuen Karte.
- Medizinische KFA-Zielbereiche oder Gesundheitsurteile.
- Änderungen an der eigenständigen Blutwerte-Seite.
- Neue Datenbankfelder oder API-Abfragen.
