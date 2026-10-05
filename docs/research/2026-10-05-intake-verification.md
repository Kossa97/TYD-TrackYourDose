# Einnahmeabläufe und automatisierte Freigabeprüfung

Stand: 5. Oktober 2026. Geprüft wurde der Ablauf Plan → Einnahme → Kalender → Bestand in der gebauten App mit isolierten Testdaten.

## Gefundener und behobener Produktfehler

Der Assistent zum Anlegen eines einzelnen Pulver-Vials speicherte beispielsweise `5 mg / 2 ml`. Die Bestandsbuchung zählt dagegen Vials und benötigt die Wirkstoffmenge je Vial. Dadurch konnte die Einnahme gespeichert werden, während die Bestandsbuchung fehlschlug.

Beim Speichern werden jetzt `5 mg / 1 Vial` und die `2 ml` Lösungsmittel getrennt über bestehende Schnittstellen abgelegt. Der Editor stellt daraus seine gewohnten Eingabefelder wieder her. Eine spätere Notizänderung erhält Stärke, Lösungsmittel und angebrochenen Bestand. Der Rechner übernimmt die gespeicherte Flüssigkeitsmenge auch bei ausgeschalteter Bestandsverfolgung. Alte Konzentrationsangaben bleiben für die Duplikaterkennung berücksichtigt. Es gibt keine Datenbankmigration.

Der Browserfall reproduzierte den Bestandsfehler vor der Korrektur. Anschließend bestanden sowohl dieser Ablauf als auch Anlegen → Bestätigen → Notiz bearbeiten → Neuladen.

## Abdeckung

Die sechs vorhandenen Browserfälle bleiben erhalten. Elf zusätzliche Fälle prüfen:

- Anlegen mit Plan und Bestand, Bestätigung auf Home, Kalender und Bestand nach Neuladen.
- Bearbeiten eines neuen Vials nach einer Einnahme.
- Überspringen, Wiederöffnen, Rückbuchung und erneute Bestätigung mit derselben Einnahme-ID.
- Verbindungsabbruch vor dem Speichern und verlorene Antwort nach erfolgreichem Speichern.
- Erneute Bestandsbuchung nach einem Fehler, ohne eine zweite Einnahme anzulegen.
- Doppeltippen bei noch laufender Anfrage.
- Englischen Ablauf.
- Künftige Planänderung bei unverändertem alten Einnahmebeleg.
- Bestätigung kurz nach lokaler Mitternacht am Tag der Zeitumstellung.

Alle 17 Fälle laufen in drei Chromium-Geräteprofilen und einem WebKit-Profil. Das ergibt 68 Browserprüfungen. Die HTTP-Nachbildung prüft unerwartete Anfragen; unbehandelte Seitenfehler lassen Tests fehlschlagen. 13 zusätzliche Vertragstests sichern die für diese Abläufe eingeführten Mock-Funktionen ab.

## Lokale Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| `npm test -- --maxWorkers=2 --reporter=dot` | 2.641 Tests in 213 Dateien bestanden |
| `npm run lint` | Erfolgreich; 0 Fehler, 29 bereits vorhandene Warnungen |
| `npm run build` | Erfolgreich; TypeScript, Produktionsbundle und 134 vorgerenderte öffentliche Seiten |
| `npm run test:e2e:typecheck` | Erfolgreich |
| `npm run test:e2e -- --workers=2` | 68 bestanden auf dem lokalen Ausgangsstand; erneute Prüfung nach Integration des aktuellen `main` folgt |
| Unabhängige Codeprüfung | Keine offenen Blocker nach Korrektur der Befunde |

Ein vorhandener Test nutzte ein inzwischen vergangenes Datum als Zukunftsdatum; seine Uhr ist jetzt festgesetzt. Bei uneingeschränkter Parallelisierung traten zusätzlich ein Prerender-Timeout und in einem separaten Lauf eine knappe Laufzeitüberschreitung im Kalender-Test auf. Mit zwei Testprozessen bestand die vollständige Suite. CI und Dokumentation verwenden deshalb diese Begrenzung; Testgrenzen und Assertions wurden nicht gelockert.

Der Build meldet weiterhin die vorhandene Chunk-Größenwarnung und eine veraltete `inlineDynamicImports`-Option.

Die vorgeschriebene Aktualisierung mit `graphify update .` wurde ausgeführt. Die installierte Version verweigerte den kleineren Neuaufbau; eine zusätzlich geprüfte inkrementelle Aktualisierung verlor einen vorhandenen semantischen Knoten. Deshalb wurde der ursprüngliche Index vollständig und bytegleich wiederhergestellt. `graphify-out` bleibt unverändert; die sichere Aktualisierung des Codeindex ist eine offene Werkzeuggrenze dieses Laufs.

## CI und Grenzen

Der Workflow `Gerätetests` führt bei Push und manuellem Start Unit-Tests, Lint, den vollständigen Produktionsbuild, Browser-TypeScript und Chromium/WebKit aus. Browserfehler behalten Screenshots und Traces; die CI lädt Berichte als Artefakte hoch. Diese Workflow-Konfiguration allein richtet keine Vercel-Deployment-Sperre ein.

Die Browserprüfungen ersetzen keine echten Datenbank-, RLS-, Transaktions- oder Gerätetests. Auth und Onboarding sind vorbereitet; Service Worker sind für die HTTP-Nachbildung blockiert. Offline-PWA, Push-Zustellung und beide Vorkommen der doppelt auftretenden Herbststunde sind nicht Teil dieses Nachweises. Produktive Nutzerdaten wurden für die Prüfungen nicht verwendet.
