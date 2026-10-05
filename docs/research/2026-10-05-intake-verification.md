# Einnahmeabläufe und automatisierte Freigabeprüfung

Stand: 5. Oktober 2026. Geprüft wurde der Ablauf Plan → Einnahme → Kalender → Bestand in der gebauten App mit isolierten Testdaten. Vor der abschließenden Prüfung wurden die Änderungen auf den aktuellen `main` (`670badb0`) übertragen; dessen Node-24-, Sentry-11-, App- und Teständerungen bleiben erhalten.

## Gefundener und behobener Produktfehler

Der Assistent zum Anlegen eines einzelnen Pulver-Vials speicherte beispielsweise `5 mg / 2 ml`. Die Bestandsbuchung zählt dagegen Vials und benötigt die Wirkstoffmenge je Vial. Dadurch konnte die Einnahme gespeichert werden, während die Bestandsbuchung fehlschlug.

Beim Speichern werden jetzt `5 mg / 1 Vial` und die `2 ml` Lösungsmittel getrennt über bestehende Schnittstellen abgelegt. Der Editor stellt daraus seine gewohnten Eingabefelder wieder her. Eine spätere Notizänderung erhält Stärke, Lösungsmittel und angebrochenen Bestand. Der Rechner übernimmt die gespeicherte Flüssigkeitsmenge auch bei ausgeschalteter Bestandsverfolgung. Alte Konzentrationsangaben bleiben für die Duplikaterkennung berücksichtigt. Es gibt keine Datenbankmigration.

Der Browserfall reproduzierte den Bestandsfehler vor der Korrektur. Anschließend bestanden sowohl dieser Ablauf als auch Anlegen → Bestätigen → Notiz bearbeiten → Neuladen.

Die zusätzliche WebKit-Prüfung deckte einen zweiten Produktfehler auf: Wenn weitere Sichtbarkeitsmeldungen ausbleiben, aktivierte die Ersatzprüfung ein sichtbares Vial, stoppte es nach dem Herausscrollen aber nicht wieder. Die vorhandene Geometrieprüfung arbeitet jetzt in beiden Richtungen, weiterhin höchstens alle 0,3 Sekunden und ohne zusätzlichen Timer. Der zuvor fehlgeschlagene Karusselltest besteht damit in allen vier Profilen.

## Abdeckung

Die 59 vorhandenen Browserfälle des aktuellen `main` bleiben erhalten. Elf zusätzliche Fälle prüfen:

- Anlegen mit Plan und Bestand, Bestätigung auf Home, Kalender und Bestand nach Neuladen.
- Bearbeiten eines neuen Vials nach einer Einnahme.
- Überspringen, Wiederöffnen, Rückbuchung und erneute Bestätigung mit derselben Einnahme-ID.
- Verbindungsabbruch vor dem Speichern und verlorene Antwort nach erfolgreichem Speichern.
- Erneute Bestandsbuchung nach einem Fehler, ohne eine zweite Einnahme anzulegen.
- Doppeltippen bei noch laufender Anfrage.
- Englischen Ablauf.
- Künftige Planänderung bei unverändertem alten Einnahmebeleg.
- Bestätigung kurz nach lokaler Mitternacht am Tag der Zeitumstellung.

Die 70 Fälle werden in drei Chromium-Geräteprofilen und einem WebKit-Profil ausgewählt. Von 280 Kombinationen laufen 277; drei explizite WebKit-Skips betreffen ausschließlich zwei native CDP-Touch-Prüfungen und die CDP-Safe-Area-Emulation. Alle 44 Kombinationen der elf neuen Einnahmefälle laufen vollständig. Die HTTP-Nachbildung prüft unerwartete Anfragen; unbehandelte Seitenfehler lassen Tests fehlschlagen. 14 zusätzliche Vertragstests sichern die für diese Abläufe eingeführten Mock-Funktionen ab. Die zusammengeführte Filterauswertung berücksichtigt sowohl verschachtelte Kalenderfilter als auch maskierte Suchbegriffe der Tagebuchsuche.

## Lokale Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| `npm test -- --maxWorkers=2 --reporter=dot` | 2.748 Tests in 228 Dateien bestanden |
| `npm run lint` | Erfolgreich; 0 Fehler, 27 vorhandene Warnungen |
| `npm run build` | Erfolgreich; TypeScript, Produktionsbundle und 134 vorgerenderte öffentliche Seiten |
| `npm run test:e2e:typecheck` | Erfolgreich |
| `npm run test:e2e -- --workers=2` | 277 bestanden, 3 begründete WebKit/CDP-Skips, 0 Fehler; 5,3 Minuten |
| Unabhängige Codeprüfung | Keine offenen Blocker nach Korrektur der Befunde |

Ein Generatorvergleich im aktuellen Stand scheiterte unter Windows ausschließlich an CRLF statt LF. Beide gelesenen Dateien werden vor dem weiterhin vollständigen Inhaltsvergleich normalisiert. Der Fehler wurde vor der Änderung reproduziert; danach bestanden die vier betroffenen Tests.

Ein bestehender Wischtest begann seine nächste Geste während der noch laufenden Schließanimation. Er wartet jetzt auf tatsächlich versteckte Aktionen; seine ursprünglichen Assertions bleiben erhalten. Der Deployment-Test simuliert einen alten Entry mit entferntem Chunk und nach einem echten Neuladen den aktuellen Entry mit neuer Chunk-Adresse. Er prüft die genaue Zahl der Anfragen und sichtbar geladene Kalenderinhalte.

Auf dem älteren lokalen Ausgangsstand waren zusätzlich ein veraltetes Zukunftsdatum und eine empfindliche Kalender-Laufzeitprüfung aufgefallen. Der aktuelle `main` hatte beides bereits korrigiert; diese Korrekturen wurden übernommen. Ein Prerender-Timeout unter starker Parallelisierung begründet die Begrenzung auf zwei Unit-Testprozesse in CI und Dokumentation. Testgrenzen und inhaltliche Assertions wurden nicht gelockert.

Der Build meldet weiterhin die vorhandene Chunk-Größenwarnung und eine veraltete `inlineDynamicImports`-Option.

Die vorgeschriebene Aktualisierung mit `graphify update .` wurde auch nach Integration des aktuellen `main` ausgeführt. Die installierte Version verweigerte den Neuaufbau mit 5.983 statt 6.610 Knoten. Deshalb wurde der aktuelle Index vollständig und bytegleich wiederhergestellt; alle 92 semantischen Knoten bleiben erhalten. `graphify-out` bleibt unverändert. Die sichere Aktualisierung des Codeindex ist eine offene Werkzeuggrenze dieses Laufs.

## CI und Grenzen

Der Workflow `Gerätetests` führt bei Push und manuellem Start Unit-Tests, Lint, den vollständigen Produktionsbuild, Browser-TypeScript und Chromium/WebKit aus. Browserfehler behalten Screenshots und Traces; die CI lädt Berichte als Artefakte hoch. Diese Workflow-Konfiguration allein richtet keine Vercel-Deployment-Sperre ein.

Die Browserprüfungen ersetzen keine echten Datenbank-, RLS-, Transaktions- oder Gerätetests. Auth und Onboarding sind vorbereitet; Service Worker sind für die HTTP-Nachbildung blockiert. Offline-PWA, Push-Zustellung und beide Vorkommen der doppelt auftretenden Herbststunde sind nicht Teil dieses Nachweises. Produktive Nutzerdaten wurden für die Prüfungen nicht verwendet.
