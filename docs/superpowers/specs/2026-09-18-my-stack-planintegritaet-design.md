# My Stack: Planintegrität und versionierter kontinuierlicher Plan

**Status:** Im Produktgespräch freigegeben  
**Branch:** `codex/my-stack-foundation`  
**Ausgangsstand:** `1dba2b64b73db40f1fd2fe818e678395dcaa2040`

## 1. Anlass

My Stack kann heute mehrere aktive `cycles` für denselben Stack-Eintrag führen.
Beim Bearbeiten einer konkreten Zykluszeile wird außerdem nicht zuverlässig
dieser Cycle weitergereicht; stattdessen wählt die Seite den neuesten aktiven
Cycle. Gleichzeitig verteilen sich dauerhafte Änderungen auf zwei Modelle:

- vollständige Planstufen in `cycles.schedule_history`,
- additive Änderungen in `dose_escalations`.

Dadurch gibt es nicht immer genau eine Antwort auf die Frage, welcher Plan für
eine Substanz zu einem bestimmten Zeitpunkt galt. Das betrifft My Stack, Home,
Kalender, Reminder, Einnahmebestätigungen, Consistency und spätere Auswertungen.

Diese Spezifikation ersetzt bei Konflikten die bisherigen Aussagen aus
`2026-09-15-titration-dosisaenderung-design.md` und
`2026-09-16-ein-schreibweg-zyklus-design.md`. Insbesondere ist
`schedule_history` nicht mehr das langfristige Zielmodell, sondern eine zu
migrierende Legacy-Quelle.

## 2. Ziel

Für jeden Stack-Eintrag gibt es höchstens einen nicht beendeten Cycle. Ein
Cycle steht für eine zusammenhängende Anwendungsphase. Dosis-, Frequenz-,
Wochentags- und Uhrzeitänderungen erzeugen zeitlich gültige Plan-Versionen
innerhalb dieses Cycles, nicht weitere Cycles.

Ein zentraler Resolver beantwortet für jeden Zeitpunkt:

1. Welchen Lifecycle-Status hat der Cycle?
2. Ist der Zeitpunkt von einer Pause erfasst?
3. Welche Plan-Version gilt?
4. Welche Einnahmen sind fällig?

My Stack, Home, Kalender und Reminder verwenden diese gemeinsame Antwort.

## 3. Nicht-Ziele

Dieses Teilprojekt enthält ausdrücklich nicht:

- Vereinheitlichung des Bestands- und Vial-Trackings,
- Earn oder Verified Health Data,
- Gamification,
- Dosierungs- oder Zyklusempfehlungen,
- ein visuelles Redesign von My Stack,
- vollständige Offline-Synchronisation,
- Performance-Arbeiten an der visuellen Bühne,
- die übrigen Punkte aus dem My-Stack-Produktreview.

## 4. Fachliche Begriffe

### Stack-Eintrag

Eine vom Nutzer getrennt verwaltete Substanz- oder Produktvariante. Dieselbe
Katalogsubstanz darf bewusst mehrfach im Stack vorkommen, etwa mit anderer
Darreichungsform, Stärke, Marke oder getrenntem Bestand.

Die Eindeutigkeitsregeln gelten pro Stack-Eintrag, nicht pro Katalogsubstanz.

### Cycle

Eine zusammenhängende Anwendungsphase vom geplanten oder tatsächlichen Start
bis zum ausdrücklichen Beenden. Eine Pause beendet den Cycle nicht.

### Plan-Version

Eine vollständige Momentaufnahme der Planung, die ab ihrer absoluten oder
lokalen Wirksamkeitsgrenze gilt. Sie enthält nicht nur die geänderten Felder,
sondern die vollständige Dosis- und Schedule-Konfiguration. Dadurch benötigt
der Resolver keine additive Sonderlogik und keine Kenntnis darüber, welche
einzelne Dosis „mitsteigt“.

### Pause

Ein Zeitraum innerhalb eines Cycles, in dem keine Einnahmen fällig werden.
Eine Pause verändert die Plan-Version nicht.

### Dose Log

Die tatsächlich bestätigte oder bewusst übersprungene Einnahme. Ein neuer Log
verweist eindeutig auf Cycle und Plan-Version und behält zusätzlich Dosis,
Einheit und Methode als historischen Snapshot.

## 5. Verbindliche Produktregeln

1. Pro Stack-Eintrag darf es höchstens einen nicht beendeten Cycle geben.
2. Dosis- und Schedule-Änderungen bleiben im bestehenden Cycle.
3. Ein neuer Cycle entsteht erst nach dem ausdrücklichen Beenden des alten.
4. Ein beendeter Cycle kann nicht wieder aktiviert werden.
5. „Neu starten“ erzeugt einen neuen Cycle und darf die letzten Einstellungen
   als Vorlage übernehmen.
6. Pausieren verhindert Fälligkeiten, beendet den Cycle aber nicht.
7. Eine Pause darf optional ein geplantes Fortsetzungsdatum besitzen.
8. Während einer Pause kann kein zweiter Cycle vorbereitet werden. Soll später
   ein wirklich neuer Cycle beginnen, wird der laufende zuerst beendet.
9. Änderungen gelten entweder ab sofort oder ab einem zukünftigen Datum.
10. „Ab sofort“ verwendet den exakten Bestätigungszeitpunkt.
11. Ein zukünftiges Datum gilt ab Beginn dieses Tages in der für die Planung
    verwendeten lokalen Zeitzone.
12. Bereits bestätigte und vergangene Einnahmen werden nie rückwirkend
    verändert.
13. Frühere offene Einnahmen am Änderungstag behalten den alten Plan.
14. Erst Einnahmen ab der jeweiligen Wirksamkeitsgrenze verwenden die neue
    Plan-Version.
15. Wirksame und vergangene Plan-Versionen sind unveränderlich.
16. Zukünftige Plan-Versionen dürfen bearbeitet oder zurückgenommen werden.
17. Einnahmen innerhalb einer Pause sind „entfallen wegen Pause“. Sie sind
    weder eingenommen noch übersprungen oder verpasst und beeinflussen keine
    Consistency.
18. Eine vor der Pause bereits fällige Einnahme bleibt offen beziehungsweise
    kann verpasst sein.
19. Gleichnamige Stack-Einträge bleiben erlaubt und unabhängig.
20. Earn beeinflusst weder Cycle noch Plan. Selbst bestätigte My-Stack-Daten
    werden nicht allein dadurch zu Verified Health Data.
21. Geplante Uhrzeiten sind lokale Uhrzeiten und folgen auf Reisen der
    aktuellen lokalen Zeitzone. „08:00 Uhr“ bleibt am Aufenthaltsort 08:00 Uhr.
22. Tatsächliche Bestätigungen und sofortige Änderungen werden unabhängig
    davon als absolute UTC-Zeitpunkte gespeichert.

## 6. Lifecycle

Der Status wird aus Zeitpunkten und Pausen abgeleitet, nicht parallel als
mehrfach beschreibbare Wahrheit gespeichert:

- **Geplant:** `started_at` liegt in der Zukunft.
- **Aktiv:** gestartet, nicht beendet und der Zielzeitpunkt liegt in keinem
  Pausezeitraum.
- **Pausiert:** gestartet, nicht beendet und der Zielzeitpunkt liegt in einem
  Pausezeitraum.
- **Beendet:** `ended_at` ist gesetzt.

Erlaubte Übergänge:

```text
Kein Cycle -> Geplant oder Aktiv
Geplant    -> Aktiv
Aktiv      -> Pausiert oder Beendet
Pausiert   -> Aktiv oder Beendet
Beendet    -> unveränderliche Historie
Beendet    -> Neustart erzeugt einen neuen Cycle
```

Ein geplanter Cycle wird durch Erreichen von `started_at` aktiv; dafür ist kein
zweiter vom Client auszuführender Schreibvorgang nötig. Ein für den betrachteten
Zeitpunkt wirksamer Pausezeitraum überstimmt diesen Status und macht ihn
pausiert.

## 7. Ziel-Datenmodell

### `cycles`

`cycles` bleibt der Container einer Anwendungsphase und enthält nur
Cycle-Identität, Zugehörigkeit und Lifecycle-Daten. Planinhalte sind nach der
Umstellung nicht mehr die kanonische Quelle in der Cycle-Zeile.

Relevante Zielattribute:

- `id`
- `user_id`
- `stack_item_id`
- `name`
- `started_at timestamptz`
- `ended_at timestamptz null`
- `created_at`

Ein partieller Unique Index erzwingt pro `stack_item_id` höchstens eine Zeile
mit `ended_at is null`. Die RPCs prüfen zusätzlich Eigentümer und zulässige
Transition, damit Fehler verständlich zurückgegeben werden.

### `cycle_plan_versions`

Eine normalisierte Zeile pro vollständiger Plan-Version:

- `id uuid`
- `user_id uuid`
- `cycle_id uuid`
- `effective_kind` (`instant`, `local_date`)
- `effective_at timestamptz null`
- `effective_local_date date null`
- `change_kind` (`initial`, `dose`, `schedule`, `titration`)
- vollständige bestehende Rhythmusfelder
- vollständige Slot-, Mengen-, Einheiten- und Methodenfelder
- `created_at`

Ein Check-Constraint erzwingt passend zu `effective_kind` genau einen der
beiden Wirksamkeitswerte. „Ab sofort“ verwendet `effective_at`; „ab Datum“
verwendet `effective_local_date` und beginnt mit diesem Kalendertag in der dann
aktuellen lokalen Zeitzone. Eindeutigkeitsregeln verhindern doppelte
Wirksamkeitsgrenzen derselben Art pro Cycle. Eine lokale Tagesgrenze und eine
spätere Sofortänderung am selben Tag dürfen bewusst nebeneinander bestehen.

Die vorhandene Slot-Repräsentation wird in diesem Teilprojekt nicht zusätzlich
neu modelliert; das wäre ein unabhängiger Schemaumbau.

### `cycle_pause_periods`

- `id uuid`
- `user_id uuid`
- `cycle_id uuid`
- `paused_at timestamptz`
- `ends_at timestamptz null`
- `created_at`

`ends_at` darf nicht vor `paused_at` liegen. `null` bedeutet eine Pause ohne
geplantes Ende. Eine geplante Fortsetzung setzt `ends_at` in die Zukunft; ein
manuelles Fortsetzen setzt es atomar auf den aktuellen Zeitpunkt. Eine
PostgreSQL-Exclusion-Constraint verhindert überlappende Pausezeiträume pro
Cycle. Der Cycle gilt für jeden Zielzeitpunkt im halboffenen Intervall
`[paused_at, ends_at)` als pausiert.

### `dose_logs`

Neue Logs erhalten zusätzlich:

- `cycle_id uuid null`
- `plan_version_id uuid null`

Die Felder bleiben für Legacy-Zeilen nullable. Dosis, Einheit, Methode und
Zeitpunkt bleiben als Snapshot im Log und werden bei späteren Planänderungen
nicht neu berechnet.

### Legacy-Felder

`cycles.schedule_history`, flache Planfelder und `dose_escalations` bleiben
während Migration und Rollback-Fenster erhalten, werden nach dem Cutover aber
nicht mehr beschrieben. Ein späteres Entfernen ist eine eigene, ausdrücklich
freizugebende destruktive Migration.

## 8. Zentraler Resolver

Der Resolver ist eine reine, deterministische Domänenfunktion. Er erhält:

- Cycle,
- sortierte Plan-Versionen,
- Pausezeiträume,
- Zielzeitpunkt,
- die aktuelle lokale IANA-Zeitzone.

Er liefert mindestens:

- `status`: geplant, aktiv, pausiert oder beendet,
- die gültige `planVersion` oder `null`,
- ob der Zielzeitpunkt durch eine Pause neutral unterdrückt wird,
- die aus der Version abgeleiteten fälligen Slots.

Regeln:

1. `ended_at <= target` bedeutet beendet.
2. `started_at > target` bedeutet geplant.
3. Liegt `target` in einem Pausezeitraum, werden keine Slots erzeugt.
4. Sonst gilt die jüngste Plan-Version, deren absoluter Zeitpunkt erreicht ist
   oder deren lokales Wirksamkeitsdatum im Zielkontext begonnen hat.
5. Existiert nach dem Start keine gültige Plan-Version, wird dies als
   Datenfehler behandelt und nicht als leerer Plan verschwiegen.
6. PRN erzeugt keine automatische Fälligkeit und keinen Miss.

Die App synchronisiert die aktuelle IANA-Zeitzone des Geräts mit dem
Nutzerprofil, damit serverseitige Reminder dieselbe lokale Uhrzeit verwenden.
Ein Zeitzonenwechsel verschiebt keine bestätigten Logs; diese besitzen bereits
absolute Zeitpunkte und Snapshots.

Home, Kalender, My Stack, Reminder und Einnahmebestätigung dürfen keine eigene
abweichende Planauflösung mehr pflegen.

## 9. Schreibwege und Transaktionen

Plan- und Lifecycle-Inhalte werden ausschließlich über klar begrenzte RPCs
geschrieben. Direkte Client-Updates an diesen Feldern sind nicht zulässig.

Vorgesehene Operationen:

- `create_cycle_with_initial_plan`
- `create_plan_version`
- `replace_future_plan_version`
- `remove_future_plan_version`
- `pause_cycle`
- `resume_cycle`
- `end_cycle`
- `restart_cycle`

Jede Operation:

- prüft `auth.uid()` und Eigentum,
- sperrt den betroffenen Cycle beziehungsweise Stack-Eintrag,
- prüft die Lifecycle-Invarianten,
- arbeitet atomar,
- akzeptiert einen Idempotency Key,
- gibt den kanonischen aktualisierten Zustand zurück.

`restart_cycle` darf nur auf einen beendeten Cycle angewendet werden. Es legt
einen neuen Cycle mit eigener initialer Plan-Version an; der alte bleibt
unverändert.

## 10. UX

### Plan-Card

Im Substanzdetail zeigt eine zentrale Plan-Card:

- Status,
- aktuelle Dosis,
- Frequenz und Einnahmezeiten,
- nächste Einnahme,
- gegebenenfalls die nächste geplante Änderung.

Primäre Aktionen:

- **Dosis anpassen**
- **Plan anpassen**
- **Pausieren** beziehungsweise **Fortsetzen**
- **Beenden**

### Dosis und Schedule anpassen

Beide Flows zeigen den aktuell gültigen Plan, die neuen Werte und die
Wirksamkeit „ab sofort“ oder „ab Datum“. Vor dem Speichern fasst die App die
Änderung verständlich zusammen. Das Speichern erzeugt eine neue Plan-Version,
keinen Cycle.

### Geplante Änderungen

Zukünftige Plan-Versionen erscheinen unterhalb des aktuellen Plans mit
Wirksamkeitsdatum. Nur sie erhalten Aktionen zum Bearbeiten und Zurücknehmen.
Vergangene und laufende Versionen sind schreibgeschützt.

### Pause

Pausieren gilt ab sofort und kann optional ein geplantes Fortsetzungsdatum
enthalten. Währenddessen zeigt der Kalender statt einzelner ausgefallener
Cards einen kompakten Hinweis:

> Plan pausiert · 18.–24. September  
> In diesem Zeitraum waren keine Einnahmen fällig.

### Beenden und Neustart

Beenden erfordert eine eindeutige Bestätigung und ist für diesen Cycle
endgültig. Anschließend steht „Neu starten“ zur Verfügung. Die letzte gültige
Plan-Version kann als Vorlage übernommen werden.

### Duplikate

Bei einem erkannten möglichen Duplikat bietet die App:

- **Vorhandenen Eintrag öffnen**
- **Separat hinzufügen**

Separate Einträge zeigen Form, Stärke und optional Marke als unterscheidende
Unterzeile. Ein automatisches Zusammenführen von Historien ist nicht Teil
dieses Projekts.

## 11. Migration

Die Migration erfolgt ausschließlich als versionierte `supabase-*.sql`-Datei,
wird in PostgreSQL 16 zweimal trocken ausgeführt und erst nach expliziter
Freigabe auf das echte Supabase-Projekt angewendet.

Reihenfolge:

1. Neue Tabellen, Fremdschlüssel, RLS und RPCs anlegen.
2. Für jeden bestehenden Cycle eine initiale Plan-Version erzeugen.
3. `schedule_history` chronologisch in vollständige Versionen mit lokaler
   Datumsgrenze umwandeln.
4. `dose_escalations` nach exakt derselben bisherigen Wirksamkeitslogik in
   vollständige Plan-Versionen mit absoluter oder lokaler Grenze umrechnen.
5. Bestehende Dose Logs zeitlich einer Version zuordnen, wenn dies eindeutig
   möglich ist.
6. Nicht eindeutig zuordenbare Logs unverändert und mit nullable Referenzen
   erhalten.
7. Konflikte mit mehreren offenen Cycles pro Stack-Eintrag erkennen.
8. Erst nach Konfliktauflösung den Unique Index aktivieren.
9. Alten und neuen Resolver im Vergleichsbetrieb prüfen.
10. Leser und danach Schreiber kontrolliert auf das neue Modell umstellen.

### Konflikte in Bestandsdaten

Bei mehreren offenen Cycles trifft die Migration keine medizinische oder
historische Vermutung. Der Stack-Eintrag erhält „Plan prüfen“. Bis zur
Auflösung werden daraus keine widersprüchlichen neuen Fälligkeiten erzeugt.
Der Nutzer bestimmt den tatsächlich laufenden Cycle; andere werden beendet
oder als fehlerhaft historisiert, aber nicht gelöscht.

## 12. Fehlerbehandlung

- Ladefehler dürfen nicht wie „kein Plan vorhanden“ aussehen.
- Speichern bleibt sichtbar ausstehend, bis die Transaktion bestätigt wurde.
- Während einer Mutation sind wiederholte Aktionen deaktiviert.
- Idempotente Wiederholung nach Netzwerkabbruch erzeugt keine Duplikate.
- Konflikte liefern eine fachliche Meldung und den aktuellen Serverzustand.
- Ein fehlgeschlagener Lifecycle-Wechsel verändert weder Cycle noch Reminder.
- Unvollständige Migrationen verhindern den Cutover statt still weiterzulaufen.

## 13. Teststrategie

### Resolver-Unit-Tests

- vor Start, exakt bei Start und nach Start,
- vor, innerhalb und exakt am Ende einer Pause,
- vor, exakt bei und nach einer Planänderung,
- Änderung mitten am Tag,
- mehrere Slots am Änderungstag,
- PRN,
- Tages-, Wochen-, Monats- und On-/Off-Rhythmus,
- Zeitumstellung und lokale Datumsgrenzen,
- Reise in eine andere IANA-Zeitzone bei gleichbleibender lokaler Planzeit,
- Beenden und Neustart.

### Datenbanktests

- höchstens ein offener Cycle pro Stack-Eintrag,
- keine überlappenden Pausezeiträume pro Cycle,
- keine doppelten Wirksamkeitszeitpunkte,
- keine Mutation historischer Versionen,
- zukünftige Version ersetzen und entfernen,
- atomare Pause, Fortsetzung, Ende und Neustart,
- Eigentümer- und RLS-Prüfung,
- Idempotency-Wiederholung.

### Integrations- und Verhaltenstests

- der angeklickte Plan wird bearbeitet,
- Dosisänderung erzeugt keinen neuen Cycle,
- Home, Kalender und My Stack zeigen denselben Zustand,
- Reminder entsprechen dem zentralen Resolver,
- pausierte Zeit erzeugt weder Dose Logs noch Misses,
- separate gleichnamige Stack-Einträge bleiben unabhängig,
- Migrationskonflikte zeigen „Plan prüfen“.

### Migrationsprüfung

- realitätsnaher Ist-Zustand der Tabellen im lokalen PostgreSQL,
- Migration zweimal ausführen,
- Zeilen vor und nach der Migration nachzählen,
- alte und neue Resolver-Ergebnisse über repräsentative Zeiträume vergleichen,
- keine Löschung oder Erfindung bestehender Dose Logs.

## 14. Rollout

1. Schema und Backfill lokal verifizieren.
2. Neuen Resolver hinter internem Umschalter lesen lassen.
3. Parität für bestehende Cycles protokollieren, ohne Gesundheitsinhalte zu
   exportieren.
4. Abweichungen fachlich klären.
5. My Stack auf den neuen Leser und die neuen RPCs umstellen.
6. Home, Kalender und Reminder umstellen.
7. Alte Schreibwege sperren.
8. Erst nach stabiler Beobachtung das Rollback-Fenster schließen.

Es gibt keinen Big-Bang, bei dem gleichzeitig migriert, geschrieben und die
Legacy-Daten entfernt werden.

## 15. Abnahmekriterien

Das Teilprojekt ist abgeschlossen, wenn:

1. pro Stack-Eintrag höchstens ein offener Cycle existiert,
2. immer die tatsächlich ausgewählte Plan-Version bearbeitet wird,
3. Dosis- und Schedule-Änderungen keine neuen Cycles erzeugen,
4. vergangene Einnahmen unverändert bleiben,
5. Änderungen mitten am Tag korrekt aufgeteilt werden,
6. Pausen keine Fälligkeiten, Misses oder Consistency-Verluste erzeugen,
7. Beenden endgültig ist und Neustart einen neuen Cycle erzeugt,
8. gleichnamige separate Stack-Einträge unabhängig funktionieren,
9. My Stack, Home, Kalender und Reminder denselben Zustand verwenden,
10. Datenbankfehler keine halbfertigen Zustände hinterlassen,
11. die Migration keine vorhandenen Logs löscht oder inhaltlich erfindet,
12. automatisierte Tests alle vereinbarten Übergänge und Zeitgrenzen abdecken.
