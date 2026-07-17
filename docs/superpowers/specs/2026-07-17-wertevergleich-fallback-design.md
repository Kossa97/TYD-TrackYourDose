# Wertevergleich: metrikspezifischer Fallback

**Datum:** 2026-07-17  
**Feature:** Fortschritt → Deine Werte  
**Status:** Zur schriftlichen Freigabe

## Ziel

Die Karte „Deine Werte“ soll auch dann einen belastbaren Vergleich zeigen, wenn eine Metrik innerhalb des ausgewählten Zeitraums ungleich auf die beiden Kalenderhälften verteilt ist. Der bestehende Kalendervergleich bleibt der bevorzugte Standard. Nur wenn er wegen zu weniger Messwerte in einer Hälfte nicht möglich ist, greift ein metrikspezifischer Fallback.

## Freigegebene Berechnung

Jede der fünf Metriken wird unabhängig ausgewertet. Es zählen ausschließlich vorhandene, endliche Zahlen innerhalb des ausgewählten Zeitraums; `null`-Werte werden ignoriert.

1. Die Werte werden chronologisch sortiert.
2. Bei `0` Werten zeigt die Zeile „Keine Daten“.
3. Bei `1–3` Werten zeigt die Zeile deren arithmetischen Durchschnitt und „Noch kein Vergleich“.
4. Ab `4` Werten wird zuerst der bestehende Kalendervergleich versucht:
   - mindestens `2` Werte in der älteren Kalenderhälfte;
   - mindestens `2` Werte in der neueren Kalenderhälfte.
5. Erfüllen beide Kalenderhälften die Mindestmenge, ist der große Wert der Durchschnitt der neueren Kalenderhälfte. Die Veränderung ist dieser Durchschnitt minus dem Durchschnitt der älteren Kalenderhälfte.
6. Hat mindestens eine Kalenderhälfte weniger als `2` Werte, greift der Fallback:
   - alle vorhandenen Werte der Metrik innerhalb des ausgewählten Zeitraums werden chronologisch halbiert;
   - bei einer ungeraden Anzahl erhält die neuere Gruppe den zusätzlichen Wert;
   - der große Wert ist der Durchschnitt der neueren Messwertgruppe;
   - die Veränderung ist dieser Durchschnitt minus dem Durchschnitt der älteren Messwertgruppe.

Der Fallback gilt gleichermaßen für `30T`, `90T`, `6M`, `1J` und `Alles`. Er verlässt niemals den ausgewählten Zeitraum.

## Verbindliche Beispiele

### Standardvergleich

In einer 1‑Monatsansicht liegen `15` Werte in der älteren und `2` Werte in der neueren Kalenderhälfte. Beide Hälften erfüllen die Mindestmenge. Verglichen wird daher der Durchschnitt der `15` älteren Werte mit dem Durchschnitt der `2` neueren Werte.

### Fallback

In einer 1‑Monatsansicht liegen `15` Werte in der älteren und `1` Wert in der neueren Kalenderhälfte. Der Kalendervergleich scheitert. Alle `16` Werte werden chronologisch sortiert; die ersten `8` bilden die ältere Messwertgruppe und die letzten `8` die neuere Messwertgruppe.

Bei `101` Gesamtwerten bilden entsprechend die ersten `50` die ältere und die letzten `51` die neuere Messwertgruppe.

## Unverändertes Verhalten

- Reihenfolge der Metriken, Rundung und Einheiten bleiben unverändert.
- Statusfarben und Pfeilrichtungen bleiben unverändert.
- Für KFA gilt weiterhin: Ein niedrigerer Durchschnitt wird als Verbesserung gewertet.
- Kartenhöhe, Zeilenlayout, Zeitraumleiste und andere Fortschritt-Komponenten werden nicht verändert.
- Die Datenbank und die gespeicherten Tageswerte werden nicht verändert.

## Technischer Zuschnitt

Die Änderung bleibt in der reinen Berechnungsfunktion `buildValueOverview`. Die React-Komponente erhält weiterhin fertig berechnete Zeilen und benötigt keine neue Zustandslogik. Eine kleine interne Hilfsfunktion teilt chronologisch sortierte Messwerte so, dass bei ungerader Anzahl die neuere Gruppe den zusätzlichen Wert erhält.

## Tests

Die bestehenden Tests für Kalenderhälften, Mindestmengen, Rundung, Statusfarben und KFA-Invertierung bleiben bestehen. Ergänzt werden mindestens folgende Fälle:

- `15` ältere und `2` neuere Kalenderwerte verwenden den Standardvergleich;
- `15` ältere und `1` neuerer Kalenderwert lösen den `8/8`-Fallback aus;
- `101` Werte werden als `50/51` geteilt;
- `1–3` Werte zeigen ihren Durchschnitt ohne Veränderung;
- `0` Werte zeigen weiterhin „Keine Daten“;
- der Fallback berücksichtigt ausschließlich Werte im ausgewählten Zeitraum.

