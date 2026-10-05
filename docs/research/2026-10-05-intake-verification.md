# Einnahmeabläufe und automatisierte Freigabeprüfung

Stand: 6. Oktober 2026. Geprüft wurde der Ablauf Plan → Einnahme → Kalender → Bestand in der gebauten App mit isolierten Testdaten. Vor der abschließenden Prüfung wurden die Änderungen auf den aktuellen `main` (`670badb0`) übertragen; dessen Node-24-, Sentry-11-, App- und Teständerungen bleiben erhalten.

## Gefundene und behobene Produktfehler

Der Assistent zum Anlegen eines einzelnen Pulver-Vials speicherte beispielsweise `5 mg / 2 ml`. Die Bestandsbuchung zählt dagegen Vials und benötigt die Wirkstoffmenge je Vial. Dadurch konnte die Einnahme gespeichert werden, während die Bestandsbuchung fehlschlug.

Beim Speichern werden jetzt `5 mg / 1 Vial` und die `2 ml` Lösungsmittel getrennt über bestehende Schnittstellen abgelegt. Der Editor stellt daraus seine gewohnten Eingabefelder wieder her. Eine spätere Notizänderung erhält Stärke, Lösungsmittel und angebrochenen Bestand. Der Rechner übernimmt die gespeicherte Flüssigkeitsmenge auch bei ausgeschalteter Bestandsverfolgung. Alte Konzentrationsangaben bleiben für die Duplikaterkennung berücksichtigt. Es gibt keine Datenbankmigration.

Der Browserfall reproduzierte den Bestandsfehler vor der Korrektur. Anschließend bestanden sowohl dieser Ablauf als auch Anlegen → Bestätigen → Notiz bearbeiten → Neuladen.

Die zusätzliche WebKit-Prüfung deckte einen zweiten Produktfehler auf: Wenn weitere Sichtbarkeitsmeldungen ausbleiben, aktivierte die Ersatzprüfung ein sichtbares Vial, stoppte es nach dem Herausscrollen aber nicht wieder. Die vorhandene Geometrieprüfung arbeitet jetzt in beiden Richtungen, weiterhin höchstens alle 0,3 Sekunden und ohne zusätzlichen Timer. Der zuvor fehlgeschlagene Karusselltest besteht damit in allen vier Profilen.

Die anschließende Prüfung des Schließen-Knopfs nach Neuladen deckte einen dritten Fehler auf: Die Detail-ID bleibt im Browserverlauf erhalten, der lokale Animationsursprung dagegen nicht. Das erneute Öffnen derselben Substanz legte nochmals dieselbe Detail-ID ab; einmaliges Schließen führte deshalb zurück auf eine weiterhin offene Detailansicht. Beim erneuten Öffnen wird jetzt der vorhandene Eintrag ersetzt. Normales Öffnen erzeugt weiterhin einen neuen Verlaufseintrag. Die neue Schließen-Assertion reproduzierte den Fehler wiederholt vor der Korrektur.

Nach dieser Korrektur bestand der Bearbeitungsablauf zwölfmal (dreimal je Browserprofil); zusätzlich bestanden alle 45 My-Stack-Komponententests. Der angepasste Deployment-Test bestand in allen vier Profilen. TypeScript und Lint der betroffenen Dateien sind erfolgreich; die unabhängige Prüfung hatte keine offenen Befunde.

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

Der [abschließende GitHub-Lauf 37382227598](https://github.com/Kossa97/TYD-TrackYourDose/actions/runs/37382227598) für Code-Commit `4545d871` ist erfolgreich: 2.748 Tests in 228 Dateien, Lint, vollständiger Produktionsbuild mit 134 vorgerenderten Seiten, Browser-TypeScript sowie 277 Browserprüfungen bestanden. Drei dokumentierte CDP-Fälle sind auf WebKit übersprungen; Wiederholungen sind nicht aktiviert. Der Browserlauf dauerte 13,3 Minuten. Vercel meldet für denselben Commit ein erfolgreiches Deployment.

Der Workflow `Gerätetests` führt bei Push und manuellem Start Unit-Tests, Lint, den vollständigen Produktionsbuild, Browser-TypeScript und Chromium/WebKit aus. Browserfehler behalten Screenshots und Traces; die CI lädt Berichte als Artefakte hoch. Diese Workflow-Konfiguration allein richtet keine Vercel-Deployment-Sperre ein.

Der erste vollständige GitHub-Lauf deckte fünf bestehende Tests mit einer bislang unausgesprochenen Berliner Zeitzonenannahme auf. Unter UTC wurden dieselben fünf Fehler lokal reproduziert. `vitest.config.ts` setzt jetzt vor dem Start der Worker `Europe/Berlin`; die Zeitpunkte und Assertions bleiben unverändert. Tests mit anderen Zeitzonen wählen diese weiterhin ausdrücklich. Die Korrektur betrifft ausschließlich die Testumgebung. Danach bestanden alle 2.748 Tests auch beim Start aus einer UTC-Umgebung; Lint blieb bei null Fehlern und 27 vorhandenen Warnungen.

Der anschließende Linux-Lauf bestand alle vorherigen CI-Schritte sowie 275 Browserfälle, zeigte aber zwei WebKit-Navigationsfehler. Beim Bearbeiten waren gespeicherte Daten und Bestand bereits erfolgreich nach Neuladen geprüft; der nächste Dokumentwechsel begann noch während der Detailanimation und blieb hängen. Der Test wartet jetzt auf die sichtbare Detailansicht und schließt sie über die Oberfläche. Dabei wurde der oben beschriebene Verlaufseintrag-Fehler entdeckt und separat korrigiert. Der Deployment-Test startet von geladenem My Stack und prüft weiterhin denselben entfernten Chunk, echten Reload und geladenen Kalender. Er enthält damit keine gleichzeitigen Home-Preload-Abbrüche mehr. Beide Testanpassungen erhalten sämtliche fachlichen Assertions und sind kein Nachweis einer behobenen WebKit-Engineursache.

Der nächste Linux-Lauf bestand 276 Browserfälle einschließlich Deployment-Recovery und Schließen nach Neuladen. Der anschließende direkte `page.goto` vom Stack zum Kalender ließ den Linux-WebKit-26-Prozess weiterhin abstürzen; diesmal belegt der Trace den Absturz vor dem Testzeitlimit. Die genaue Ursache bleibt offen. Der Bearbeitungsablauf verwendet für diesen letzten Schritt jetzt den regulären Kalender-Link der App, mit identischen Assertions zu Anzahl, offenen Einnahmen und Menge. Der Reload-Nachweis davor bleibt bestehen. Dieser spezifische direkte Dokumentwechsel unter Linux-WebKit ist damit eine offene Testgrenze; er wird weder als behoben noch als erfolgreich geprüft dargestellt.

Die Browserprüfungen ersetzen keine echten Datenbank-, RLS-, Transaktions- oder Gerätetests. Auth und Onboarding sind vorbereitet; Service Worker sind für die HTTP-Nachbildung blockiert. Offline-PWA, Push-Zustellung und beide Vorkommen der doppelt auftretenden Herbststunde sind nicht Teil dieses Nachweises. Produktive Nutzerdaten wurden für die Prüfungen nicht verwendet.
