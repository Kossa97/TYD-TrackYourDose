# Testaccount-Jahresverlauf: Design

## Ziel

Für den freigegebenen Testaccount werden die Fortschrittswerte vom 17.07.2025 bis einschließlich 17.07.2026 durch 366 synthetische Tageseinträge ersetzt. Andere Tabellen und Zeiträume bleiben unverändert.

## Datenverlauf

- Gewicht: täglich, realistisch schwankend, exakt 115,0 kg am ersten und 88,0 kg am letzten Tag.
- KFA: synthetische Schätzung von 34,5 % auf 19,0 %, mit kleinen Schwankungen.
- Energie: langfristig etwa 4 auf 8.
- Schlaf: langfristig etwa 5 auf 8.
- Wohlbefinden: langfristig etwa 4 auf 9.
- Libido: langfristig etwa 5 auf 8.
- Alle Zufallskomponenten sind deterministisch, damit derselbe Lauf dieselben Werte erzeugt.

## Schreibregeln

- `daily_logs`: alle 366 Tage per Konfliktschlüssel `(user_id, log_date)` ersetzen.
- `weight_logs`: vorhandene Zeilen im freigegebenen Zeitfenster löschen und genau eine neue Zeile pro Tag einfügen.
- Fotos, Blutwerte, Zyklen, Dosis-Logs, Profil und Werte außerhalb des Fensters werden nicht verändert.

## Verifikation

- Exakt 366 vollständige `daily_logs` und 366 eindeutige Gewichtstage.
- Exakte Gewichts-Endpunkte 115,0 und 88,0 kg.
- KFA und Wellnesswerte innerhalb ihrer Schema-Grenzen.
- Durchschnitt der letzten 30 Tage gegenüber den ersten 30 Tagen: niedrigeres Gewicht/KFA und höhere Wellnesswerte.

