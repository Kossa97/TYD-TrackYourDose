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

## 16. Gemessene Abschlussprüfung — 2026-09-19 (Task 14)

**Nur lokaler Dry-run; keine Produktionsmigration, kein Push.** Der interne
Schalter `planTimelineV2` ist auf diesem Branch nach bestandenen lokalen Gates
aktiviert. Legacy-Tabellen und -Spalten bleiben für Rollback erhalten. Die
Produktionsfreigabe und die Migration in Supabase sind weiterhin separat nötig.

### PostgreSQL 16.15: produktionsnaher synthetischer Datenbestand

`scripts/sql/my-stack-plan-integrity-dry-run.test.sql` lädt die eingecheckten
Legacy-, Foundation- und Tracking-Depth-Schemata einschließlich Constraints,
Indizes, RLS und der echten Completeness-/Review-Trigger. Nur Auth/Storage werden
lokal nachgebildet. Vier vollständig konfigurierte synthetische Einträge haben
sechs Cycles: zwei konkurrierende offene Cycles, einen beendeten Cycle mit
anschließendem Neustart, PRN und eine 72-Stunden-Pause über mehrere Tage. Enthalten
sind schedule_history, alle drei Escalation-Startarten, bestätigte/übersprungene
Logs sowie ein bestätigter PRN-Log. Es wurden keine echten Nutzerdaten kopiert.

| Tabelle | Vorher | Additiv 1 | Additiv 2 | Konflikt aufgelöst + Enforcement 2× |
| --- | ---: | ---: | ---: | ---: |
| stack_items | 4 | 4 | 4 | 4 |
| cycles | 6 | 6 | 6 | 6 |
| cycle_plan_versions | nicht vorhanden (0) | 10 | 10 | 10 |
| cycle_pause_periods | 1 | 1 | 1 | 1 |
| dose_escalations | 3 | 3 | 3 | 3 |
| dose_logs | 3 | 3 | 3 | 3 |
| plan_mutation_receipts | nicht vorhanden (0) | 0 | 0 | 1 |
| cycle_migration_conflicts | nicht vorhanden (0) | 1 | 1 | 0 |

Beide additiven Läufe und beide Enforcement-Läufe mit `ON_ERROR_STOP=1` bestanden.
Die vorbestehende Pause prüft zusätzlich einen partiell additiven Installationsstand.
Der zweite Lauf änderte weder Counts noch Versions-/Pausen-Snapshots. Alle alten
Log-Felder blieben in kanonisch serialisierten Snapshots bytegleich; neue
Provenienzfelder blieben null. Jeder Cycle hat eine initiale Version zum Start.
Genau der erwartete Konflikt wurde mit beiden Cycle-IDs angezeigt und über
`resolve_cycle_migration_conflict` als `authenticated` aufgelöst. Der anschließende
Versuch eines zweiten offenen Cycles scheiterte am Unique-Index. Auch die bisherige
SQL-Verhaltenssuite `scripts/sql/my-stack-plan-integrity.test.sql` bestand vollständig.

Der produktionsnahe RED-Lauf fand einen zuvor verdeckten Fehler: Der
Foundation-Trigger verweigerte `complete → needs_review`, sodass die additive
Migration beim Markieren des Konflikts mit `Complete stack items cannot return to
needs_review` vollständig zurückrollte. Die gezielte Korrektur erlaubt den Wechsel
nur bei einem bereits vorhandenen, ungelösten Konflikt derselben Eintrag-/User-ID.
Negative Tests für fehlende, fremde und bereits gelöste Konflikte sowie das
INSERT-Verbot bestanden weiterhin. Kein Trigger wurde deaktiviert.

### Parität, Anwendung und Abhängigkeitsprüfung

- Finale Parität: 7 Dateien, 111 Tests bestanden (Legacy-/V2-Vergleich über 60 Tage,
  TypeScript-/Node-Timeline, Intake-Rhythmus und Reminder). SQL prüft unabhängig
  die erwarteten historischen Dosen `[10,11,13,16,26]`. Keine ungeklärte Abweichung.
- `npm test`: Exit 0, 160 Dateien, 1.896 Tests bestanden.
- `npm run build`: Exit 0, 4.049 Module, PWA mit 134 Precache-Einträgen. Vorhandene
  Warnungen zu großen Chunks und `inlineDynamicImports` bleiben bestehen.
- `npm run lint`: Exit 1, genau 145 Fehler und 17 Warnungen — identisch mit der
  Task-13-Baseline, kein Anstieg. Alle fünf geänderten TS-/JS-Dateien separat ohne
  Diagnostik geprüft. Keine neue Diagnose betrifft Task-14-Änderungen.
- TDD: Der CRLF/LF-Quellreihenfolgetest wurde erst reproduziert (26/27), dann nur
  durch Zeilenendennormalisierung korrigiert (27/27). Die Rollout-Erwartung wurde
  zuerst auf true geändert und scheiterte vor der Aktivierung, danach bestand sie.
- Die abschließende Reminder-Prüfung entdeckte noch `peptides(name)` statt der
  realen Foundation-Relation `stack_items(display_name)`. Zwei echte
  Query-/Payload-Grenztests schlugen zuerst fehl; nach der minimalen Korrektur
  bestanden sie samt sämtlicher oben genannter finalen Gates.
- `graphify update .` und `graphify query "plan timeline cycle versions pauses Home
  Dashboard reminders"` wurden nach allen Code-/Teständerungen erneut ausgeführt:
  5.278 Nodes, 9.114 Edges, 849 Communities; fokussierte Query: 313 Nodes.
  Resolver/Service sind mit My Stack, Home, Dashboard, Routinen, Reminder,
  Injektionen und PK verbunden. Kein geprüfter Live-V2-Pfad hängt ausschließlich
  an dose_escalations/schedule_history; Legacy-Fallbacks bleiben erhalten.
  Graph-JSON/Report/Cache-Ausgaben werden mit committed. Das alte HTML wurde vom
  Generator entfernt und wegen des 5.000-Node-Limits nicht neu generiert (aus Git
  wiederherstellbar); der letzte Lauf meldete unveränderte
  Topologie und ließ die zuvor aktualisierten Graph-Ausgaben bestehen.

Die lokale Prüfung ersetzt weder einen Produktions-Recount noch die gesonderte
Freigabe für die beiden SQL-Dateien. Es wurde kein Produktionssystem verändert.

### Review-Korrektur 1: archivierte und ungeklärte Einträge (2026-09-19)

Die unabhängige Prüfung zeigte zwei zusätzliche Cutover-Lücken: archivierte
Einträge blieben im V2-Due-Pfad sichtbar, und konkurrierende Cycles eines
ungeklärten Migrationseintrags konnten widersprüchliche Reminder erzeugen.
Die gemeinsame Read-Policy unterdrückt jetzt geplante Aktionen für archivierte
Einträge, `needs_review` und vorhandene ungelöste Konflikte. Der Reminder-Worker
liest dieselben Metadaten aus `stack_items` samt Konfliktrelation. My Stack lädt
die ausgeblendeten Timelines ausdrücklich weiter für die Konfliktauflösung.
Archivieren beendet keinen Cycle; unter V2 entfällt der abgewiesene Legacy-Write.
Mutationsfehler werden angezeigt, auch der Legacy-Cycle-Write wird geprüft.

RED/GREEN wurde an Service, Home, Dashboard, Reminder-Worker und Archiv-Dialog
nachgewiesen. Je drei Fälle prüfen Archivierung, `needs_review` und ungelöste
Konflikte samt anschließender Freigabe. Zwei Dialogfälle prüfen erfolgreichen
Archiv-Write ohne Cycle-Mutation und den Fehlerpfad. Die bestehende
Konfliktauflösungs-UI bleibt mit realistischen Statusmetadaten getestet. Ein alter
Quellreihenfolgetest wurde an den nun gemeinsam geprüften Fehlerpfad angepasst;
sein zuvor fehlgeschlagener Lauf wurde nicht übergangen.

Frische finale Messungen nach allen Code-/Teständerungen:

- Fokussierte Grenz-/Paritätssuiten: 9 Dateien, 239 Tests bestanden.
- Vollsuite: 160 Dateien, 1.910 Tests bestanden, 0 Fehler (`npm test` mit
  JSON-Reporter, Exit 0).
- `npm run build`: Exit 0, 4.049 Module, 134 PWA-Precache-Einträge; bekannte
  Chunk-/`inlineDynamicImports`-Warnungen unverändert.
- `npm run lint`: Exit 1, 145 Fehler und 17 Warnungen, unveränderte Baseline.
  Keine neue Diagnose betrifft die Korrektur; vorhandene Diagnosen in
  MyStackPage und planLifecycle.test bleiben unverändert.
- `graphify update .` nach den Änderungen und fokussierte Query bestanden:
  5.281 Nodes, 9.117 Edges, 844 Communities, Query 313 Nodes. Der abschließende
  Update-Lauf meldete keine weitere Topologieänderung. Importkanten und
  Quellprüfung verbinden weiterhin My Stack, Home, Dashboard, Routinen,
  Reminder, Injektionen und PK mit Service/Resolver; kein geprüfter Live-V2-Pfad
  liest ausschließlich Legacy-Escalations/History. Generierte Ausgaben bleiben
  Bestandteil des Fix-Commits; HTML-Limit unverändert.

In dieser Korrekturrunde wurden keine SQL-Dateien geändert und keine Datenbanken
ausgeführt. Die oben dokumentierten PostgreSQL-16-Dry-Runs bleiben die lokale
SQL-Evidenz. V2 bleibt aktiviert. Keine Produktionsmigration, kein Push.

### Review-Korrektur 2: verworfener Cycle bleibt Historie (2026-09-19)

Die erneute Prüfung zeigte, dass der Konflikt-RPC verworfene Cycles korrekt
aufbewahrt und mit `closed_by_migration_resolution=true` sowie dem
Auflösungszeitpunkt als `ended_at` markiert. Nach Auflösung konnten deren
frühere Tagesslots trotzdem erneut als fällig erscheinen. Der gemeinsame
Scheduling-Loader liest nun den Marker und schließt ausschließlich diese
verworfenen Cycles aus. Explizite Management-/Historien-Reads behalten sie mit
allen Versionen und Pausen; normale beendete Cycles werden nicht herausgefiltert.

Die Home-/Dashboard-Tests behalten jetzt beide echten Post-RPC-Zeilen: offener
ausgewählter Cycle mit 20 mg und verworfener Cycle mit 10 mg, beendet um 10:00
lokal. Um 10:05 darf nur der ausgewählte 08:00-Slot eine Aktion anbieten.
RED: 99 bestanden, sieben erwartete Fehler (je drei Home/Dashboard-Fälle mit
zwei statt einer Aktion und ein Service-Fall). GREEN: 240 fokussierte Tests in
neun Dateien, inklusive Legacy-Flag-off-Pfade, My-Stack-Konflikt-UI und Parität.
Der neue Service-Test prüft zusätzlich unveränderte normale Ended-Cycle-Reads
und die vollständigen verworfenen Management-Snapshots.

Final nach allen Code-/Teständerungen: 1.911/1.911 Tests in 160 Dateien bestanden;
Build Exit 0 (4.049 Module, 134 PWA-Einträge); Lint unverändert 145 Fehler/17
Warnungen, keine neue Diagnose auf geänderten Zeilen. Ein zwischenzeitlicher
Build-Fehler betraf zu eng als null typisierte Testdaten; die Fixtures erlauben
nun die realen nullable Datumswerte. Graphify erneut ausgeführt und geprüft:
5.282 Nodes, 9.118 Edges, 842 Communities; fokussierte Query 313 Nodes. Der letzte
Update-Lauf meldete keine weitere Topologieänderung. Die zuvor dokumentierten
Service-/Resolver-Verbindungen bleiben erhalten, generierte Ausgaben werden
mit committed. Keine SQL-Änderung, kein neuer Datenbanklauf, keine
Produktionsmigration, kein Push. V2 bleibt aktiviert.

### Finale Review-Welle: Lifecycle-, Zeit- und Mutationsgrenzen (2026-09-19)

Nur lokal gemessene Evidenz; keine Produktionsmigration und kein Push. V2 bleibt
aktiviert. Alle Legacy-Spalten und -Tabellen bleiben für Rollback erhalten.

Die authentifizierte Bestätigung nach Enforcement wurde in PostgreSQL 16 zuerst
mit `permission denied for table cycles` bei `SELECT ... FOR UPDATE` reproduziert.
`confirm_intake_group` verwendet nun SECURITY DEFINER mit festem Suchpfad
`pg_catalog, public, pg_temp`, behält die expliziten Eigentümer-/Item-/Log-/Slot-
Prüfungen und prüft unter dem Lifecycle-Lock `started_at <= logged_at < ended_at`.
Gewöhnliche, gruppierte und Injektionsrouten-Bestätigungen funktionieren auch mit
den echten Foundation-Triggern nach Enforcement; fremde Eigentümer und direkte
Cycle-Updates bleiben abgewiesen. Ein Zwei-Verbindungs-Test bestätigt, dass eine
veraltete Bestätigung auf den End-Lock wartet und danach ohne Log abgewiesen wird.

Datumsbasierte Kurgrenzen erhalten eine persistierte feste IANA-Zeitzone
`lifecycle_timezone`: Start am lokalen Tagesanfang, Ende exklusiv am Anfang des
Folgetags. Beide werden als exakte `started_at`/`ended_at` gespeichert. Ein
zukünftiges Ende bedeutet nicht bereits beendet; Leser, Erinnerungen, PK und
Lifecycle-RPCs berücksichtigen die tatsächliche Grenze. Explizites Beenden und
Neustarten bleiben exakte Instant-Operationen ohne zusätzliche Zeitzonenparameter.
Die Wiederholungsreferenz kommt separat aus dem initialen `effective_local_date`.
Der Wechsel der Betrachtungszeitzone ändert keine Lifecycle-Grenze.

Für Migrationen ist eine einzige eindeutige gültige gespeicherte
`push_subscriptions.timezone` die vorhandene Quelle. Fehlende/mehrdeutige Quellen
werden nicht stillschweigend als UTC interpretiert: `timezone_review_required`
und ein ungelöster Migrationskonflikt blockieren Aktionen und Enforcement. My Stack
zeigt einen blockierenden Review mit vorausgewählter, bearbeitbarer Geräte-IANA-
Zone und verlangt explizite Bestätigung. Der idempotente, eigentümergeprüfte RPC
materialisiert dann die Grenzen, ohne Versionen/Logs zu verändern; eine zusätzliche
Mehr-Cycle-Auswahl bleibt bei widersprüchlichen Cycles erforderlich. Dieser
bewusste Migrationsaufwand ersetzt jede versteckte Zeitzonenannahme.

Weitere Korrekturen: Planversionen werden in TS/Node nach tatsächlichem Instant
geordnet (einschließlich wiederholter Berliner DST-Stunde und persistiertem
Erstellzeitpunkt bei Gleichstand). Management sortiert dieselben Grenzen zeitlich.
Neue Änderungen akzeptieren serverseitig nur zukünftige Grenzen oder ein vom
Server materialisiertes „jetzt“. Die unverzichtbare initiale Version kann nicht
entfernt werden; versionlose Cycles ergeben einen sichtbaren Ladefehler. V2 zeigt
für bereits entschiedene Dashboard-Logs keine Umschreib-/Löschaktionen mehr.
Metadaten/PK werden separat vom initialen Plan gespeichert; der echte
Metadaten-Wizard bietet keine verworfenen Planfelder an. Planänderungen zeigen nur
eine wirksame Gültigkeitssteuerung und deren Review. PK-Historie trägt die gespeicherte
Route; fehlende/abweichende Routen unterbrechen konservativ statt umgedeutet zu
werden. `set_pause_end` sperrt Cycle vor Pause und liest die Pause danach erneut.
Fehler-/Review-Texte sind im DE/EN-Overlay mit expliziten Fallbacks aller 14 Locales.

PostgreSQL-Befehle im ausschließlich für diese Welle erstellten Container
`codex-task14-final` (`postgres:16`, Repository read-only nach `/workspace` gemountet):

```text
docker exec codex-task14-final createdb -U postgres final_production_shape2
docker exec codex-task14-final psql -U postgres -d final_production_shape2 -v ON_ERROR_STOP=1 -q -f /workspace/scripts/sql/my-stack-plan-integrity-dry-run.test.sql
docker exec codex-task14-final createdb -U postgres final_sql_race
docker exec codex-task14-final psql -U postgres -d final_sql_race -v ON_ERROR_STOP=1 -q -f /workspace/scripts/sql/my-stack-plan-integrity.test.sql -f /workspace/scripts/sql/my-stack-final-boundaries.test.sql -f /workspace/scripts/sql/my-stack-timezone-review.test.sql
```

Beide finalen Befehle Exit 0. Die produktionsnahe Fixture lädt die eingecheckten
Schemas, Constraints, Indizes, Policies und Guards sowie eine synthetische New-York-
Subscription; sie enthält zwei konkurrierende Cycles, Historie/Restart,
`schedule_history`, alle drei Escalation-Startarten, bestätigte/übersprungene Logs,
PRN und eine mehrtägige Pause. Additive Migration zweimal: vorab 4 Items / 6 Cycles /
0 Versionen / 1 Pause / 3 Escalations / 3 Logs; nach beiden Läufen jeweils
4 / 6 / 10 / 1 / 3 / 3, 0 Receipts, genau 1 Konflikt. Versionen/Pausen und die
Legacy-Log-Snapshots unverändert, keine erfundene Log-Provenienz, jede Initialversion
vorhanden. Nach expliziter Auswahl und zweimal Enforcement: dieselben sechs
Fachzählungen, 1 Receipt, 0 Konflikte; zweiter offener Cycle abgewiesen. Drei
zusätzliche authentifizierte Bestätigungen wurden in einer zurückgerollten
Transaktion geprüft, sodass die Migrationsevidenz unverändert bleibt.

Erweiterte SQL-Evidenz: fehlende Zeitzone für zwei synthetische Items bleibt
ungelöst; unberechtigte/ungültige Bestätigung abgewiesen; New-York- und Tokio-
Bestätigung erzeugt exakte Tagesgrenzen, Retry liefert denselben Receipt und
Versionen bleiben identisch. Enforcement auf der ungelösten Fixture wurde separat
mit `Unresolved cycle migration conflicts remain` abgewiesen (Exit 1, erwartet).
Pause eines endlichen zukünftigen Kurses erlaubt; DST-Reihenfolge, historische
Änderungsablehnung, lokales „heute“ in beiden Zonen, servergenaues Jetzt,
Initialversionsschutz sowie Lock-Reihenfolge und End/Confirm-Race bestanden.

Finale Verifikation nach allen Code-/Teständerungen: `npm test` Exit 0,
**1.942/1.942 Tests in 162 Dateien**; darunter TS/Node-, Reminder- und Legacy-Dual-
Read-Parität ohne unerklärte Abweichung. `npm run build` Exit 0, 4.050 Module,
Client 1,62 s, 134 PWA-Einträge/4.834,73 KiB; bekannte Chunk-/Deprecation-Warnungen.
`npm run lint` Exit 1 mit exakt **145 Fehlern/17 Warnungen**, unverändert zur
Task-13-Baseline. 32 geänderte bestehende JS/TS-Dateien separat gegen HEAD geprüft:
44 bestehende Fehler/3 Warnungen, keine neue Diagnose (Zeilenverschiebungen
normalisiert). Neue Dateien und zuletzt geänderte Resolver/Worker separat lintfrei.

`graphify update .` nach den Quelländerungen: Exit 0, 723 Dateien, **5.289 Nodes /
9.139 Edges / 847 Communities**. Geforderte fokussierte Query: Exit 0, BFS Tiefe 2,
314 Nodes. Import-Edges für My Stack, Home, Dashboard, Routine-Bestätigung,
Reminder-Adapter, Injection und PK wurden zusätzlich direkt in `graph.json`
geprüft. Kein aktiver V2-Konsument ist ausschließlich an die Legacy-Planquellen
gebunden; Legacy-Pfade bleiben vorhanden. Generierte Ausgaben bleiben im Commit.
Das unveränderte 5.000-Node-HTML-Limit verhindert nur die optionale HTML-Ausgabe.

### Task 15: drei verbleibende temporale Grenzen (2026-09-19)

**Nur lokale Prüfung; keine Produktionsmigration, kein Push.** Die folgenden
Korrekturen ersetzen die oben dokumentierte zeitzonenlose Restart-Schnittstelle
und den Transaktionsstart als Sofortgrenze. V2 bleibt nach den lokalen Gates aktiv.

`restart_cycle` erhält die ausdrücklich gewählte IANA-Zone als
`p_initial_schedule._timezone`; der Client verlangt `timeZone`. Der Server lehnt
fehlende/ungültige Zonen und fremde Eigentümer ab. Er speichert das lokale Datum
des angeforderten Instants separat in `start_local_date` (auch im Legacy-
`start_date`) und die Zone in `lifecycle_timezone`. `started_at` und die initiale
Instant-Version bleiben exakt der angeforderte Zeitpunkt; deren
`effective_local_date` bleibt null. Bereits datumsbasierte Starts bleiben unverändert.
Der Live-RPC-Test mit Start `2026-09-18T00:30Z` in New York reproduzierte zuvor
19./21. September in New York, aber 20. September in Berlin/Tokio. Danach liefern
beide echten Resolver in allen drei Zonen 19./21. September; Monatsrhythmus ergibt
17. Oktober, On/Off wieder 19./21. September. Exakte Aktivierung und unveränderte
idempotente Rückgabe sind separat geprüft.

Lokale Datumsgrenzen folgen in TS und Node nun PostgreSQL: bei doppelter
Mitternacht der spätere Instant, bei übersprungener Mitternacht der Offset vor
dem Sprung. Dieselbe Grenze entscheidet über Eligibility und Versionsreihenfolge.
Die lokale Slotauflösung erzeugt keine Einnahme vor dieser Tagesgrenze; außerhalb
dieses Sonderfalls bleibt die frühere gewöhnliche Fold-Einnahme erhalten und ein
Gap wird weiterhin auf die erste darstellbare Minute gelegt. Intake- und
Management-Code nutzen dieselben TS-Helfer, Reminder den geprüften Node-Zwilling.
SQL-Erstellung, exklusives Kursende und Zeitzonen-Review materialisieren weiterhin
die unveränderte native PostgreSQL-Konvertierung. Gemessene Parität:

| Zone / lokales Datum | Tagesgrenze UTC |
| --- | --- |
| America/Havana / 2026-11-01 (doppelt) | 2026-11-01 05:00Z |
| America/Havana / 2026-03-08 (übersprungen) | 2026-03-08 05:00Z |
| America/Santiago / 2026-09-06 (übersprungen) | 2026-09-06 04:00Z |

Die konkurrierende Havana-Instant-Version um 04:45Z gilt bis unmittelbar vor
05:00Z, danach die lokale Datums-Version. Ein Kurs mit letztem Datum 31. Oktober
erzeugt weder einen 00:30-Slot noch einen Reminder am 1. November; RED hatte noch
einen solchen Slot geliefert. Bestehende Berlin-/New-York-/Tokio-Parität besteht.

`create_plan_version` erfasst einen einzigen `clock_timestamp()` erst nach dem
Eigentümer-Cycle-Lock. Lifecycle-/Future-Prüfung und Sofortgrenze verwenden diesen
Wert; Receipt und Rückgabe enthalten dieselbe gespeicherte Grenze. Im echten
Zwei-Verbindungs-RED lag die Grenze 20:38:42.223991Z vor dem während des Wartens
bestätigten Log 20:38:42.235004Z; dessen spätere Auflösung wählte die falsche neue
Version. GREEN: Log 20:42:58.622121Z, Grenze 20:42:58.631339Z, gespeicherte und
aufgelöste alte Version identisch. Nachfolgende Bestätigung verwendet die neue
Version; Retry behält die vollständige ursprüngliche Rückgabe.

Verifikation: beide PostgreSQL-16-Fixtures mit additiver Migration und Enforcement
je zweimal bestanden; produktionsnahe Counts bleiben 4 Items / 6 Cycles /
10 Versionen / 1 Pause / 3 Escalations / 3 Logs, final 1 Receipt / 0 Konflikte.
Zusätzliche SQL-Suites prüfen temporale Policy, Restart-Validierung und Race sowie
die bisherigen Provenienz-/Berechtigungs-/Review-Grenzen. Vollsuite: **1.948 Tests
in 162 Dateien**, Build Exit 0 (4.050 Module; 134 PWA-Einträge); Lint unverändert
**145 Fehler / 17 Warnungen**. Sieben geänderte TS-Dateien gegen HEAD verglichen:
19 bestehende Diagnosen, keine neue. Graphify nach allen Codeänderungen: 726
Dateien, **5.296 Nodes / 9.160 Edges / 852 Communities**; Restart/Recurrence/
Datumsgrenzen-Query 160 Nodes, Sofortänderungs-Query 168 Nodes. Direkte Call-Kanten
für TS/Node-Datumsgrenzen und Management zusätzlich geprüft. Generierte Ausgaben
bleiben committed; bekannte Build-Warnungen, Lint-Backlog und HTML-Limit bleiben.

### Final-Gate-Nachweis: Abdeckung, Lock-Zeit und Skip-Entscheidungen (2026-09-19)

**Nur lokal; keine Produktionsmigration, kein Push.** Eine zukünftige Version darf
beim Ersetzen nicht hinter `cycle.started_at` verschoben werden, wenn danach keine
andere Version den Zyklusstart abdeckt. Die geprüfte Reproduktion mit geplantem
Start am 1. Januar und Ersatzgrenze am 3. Januar wird nun atomar abgelehnt; der
Resolver liefert am 2. Januar weiterhin die unveränderte initiale Version. Eine
gleichzeitige Änderung des Zyklusstarts gehört nicht zu dieser Operation.

`replace_future_plan_version` und `remove_future_plan_version` erfassen nach den
Locks auf Zyklus und Zielversion exakt einen `clock_timestamp()` und verwenden
ihn für alle End-/Wirksamkeitsprüfungen. Der PostgreSQL-16-Test eröffnet echte
Remote-Transaktionen nachweislich vor der Zukunftsgrenze, blockiert beide am
Zyklus-Lock bis nach der Grenze und erwartet anschließend für Remove und Replace
`Plan version is already effective`; beide Zielversionen bleiben unverändert.

Normalisierte Home-/Dashboard-Skips laufen nicht mehr über direkte `dose_logs`-
Writes. Das bestehende lifecycle-gesperrte `confirm_intake_group` verarbeitet mit
dem optionalen strikten Boolean `taken` nun beide Entscheidungen; fehlend bleibt
für bestehende Clients gleichbedeutend mit `true`. Pending-Zeilen werden weiter
wiederverwendet, entschiedene Zeilen akzeptieren nur identische idempotente
Wiederholungen. Ein gültiger Skip speichert `false` mit exaktem Zyklus-/Versions-
Bezug; ein während eines konkurrierend committen Pause-Vorgangs wartender Skip
wird danach ohne Zeile abgewiesen. V1 bleibt unverändert.

Gemessene Gates: fokussiert **109/109**, Vollsuite **1.931/1.931 Tests in 162
Dateien**, Build Exit 0 (4.050 Module, 134 PWA-Einträge), Lint unverändert **145
Fehler / 17 Warnungen**. Verhaltensfixture plus neue Final-Gate-SQL-Regressionen
und produktionsnaher Double-Migration-/Double-Enforcement-Dry-Run bestanden.
Graphify wurde nach den Quelländerungen aktualisiert und fokussiert abgefragt;
generierte Ausgaben bleiben im Commit. Bestehende Build-Warnungen und Lint-Schuld
bleiben; der SQL-Rollout erfordert weiterhin separate Produktionsfreigabe.

#### Re-Review-Ruling: Final-Gate-Fixture (2026-09-20)

**Important bestätigt; ausschließlich Testkorrektur, kein Produkt-SQL und kein
Rollout.** Der bisherige Nachweis für die beiden gealterten Future-Mutationen war
ungültig: Die äußere `DO`-Transaktion fügte die Zielversionen ein und hielt dadurch
FK-Key-Share-Locks auf den Cycles, während die dblink-Lock-Session auf denselben
Cycles `FOR UPDATE` anforderte. RED: Die unveränderte Fixture lief nach 12 Sekunden
noch; `pg_stat_activity` zeigte den `DO`-Backend im dblink-Warten und die
Lock-Session im `transactionid`-Wait, unmittelbar durch diesen Backend blockiert.

Die Future-Versionen werden nun vor dem `DO` committed angelegt. Die echten
Remote-Transaktionen beginnen weiterhin vor der Grenze, warten nachweislich am
Cycle-Lock bis hinter die Grenze und müssen für Remove und Replace weiterhin
`Plan version is already effective` liefern. Nach jedem asynchronen Resultat wird
auch das abschließende leere dblink-Resultat konsumiert, bevor Rollback oder
Disconnect erfolgen; dasselbe gilt für den Pause-vs-Skip-Race.

GREEN: Verhaltensfixture und korrigierte Final-Gate-Fixture bestanden in zwei
separaten frischen Datenbanken desselben schreibgeschützt gemounteten
`postgres:16`-Wegwerfcontainers. Beide Future-Versionen blieben vorhanden, der
gültige Skip blieb mit `taken=false` und exakter Provenienz gespeichert, für den
stale Skip entstand keine Zeile. Die fokussierten Planintegritäts-, Intake-, Home-
und Dashboard-Tests bestanden mit **87/87**. Produkt-Vollsuite und Build wurden
nicht erneut ausgeführt, weil der Diff nur die SQL-Testfixture und diesen Nachweis
berührt.
