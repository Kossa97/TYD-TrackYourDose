# Peptipedia Publication Readiness

## Ziel

Peptipedia soll als öffentlich sichtbares, knappes und quellenbasiertes Peptidlexikon fachlich nachvollziehbar sein. Der gesamte bestehende Katalog mit 66 Profilen wird so überarbeitet, dass fehlende Evidenz, ungeklärte Produktidentität und regionale Zulassungsunterschiede sichtbar bleiben. Die Oberfläche darf keine Dosier- oder Zyklusempfehlung suggerieren.

## Umfang

Die Arbeit umfasst sechs miteinander verbundene Bereiche:

1. Vervollständigung aller derzeit unvollständigen Profile.
2. Strukturierte Behandlung ungeklärter Molekül-, Produkt- und Blend-Identitäten.
3. Ersatz subjektiver Konfidenzangaben durch eine transparente Evidenzmatrix.
4. Abrufdaten, Reviewfristen und eine automatisierte Aktualitätsprüfung für Quellen und Profile.
5. Technische Vorbereitung einer externen medizinischen und juristischen Freigabe.
6. Fehlerfreier Test-, Build- und Lint-Stand des Haupt-Workspace.

Nicht im Umfang sind individuelle Therapieempfehlungen, patientenbezogene Entscheidungen sowie Dosier- oder Zyklusvorschläge. Der bereits gewünschte rein rechnerische Rekonstitutionsrechner bleibt ausschließlich auf der öffentlichen Website; er erscheint nicht in der persönlichen App und darf keine Anwendungsempfehlung ableiten.

## Inhaltsstandard für alle Profile

Jedes Profil enthält auf Deutsch und Englisch mindestens:

- eindeutige Bezeichnung und Aliasnamen;
- Substanztyp und Identitätsstatus;
- kurze Einordnung ohne Wirkversprechen;
- untersuchte Bereiche;
- Wirkmechanismus mit klarer Trennung von Hypothese und Humanbefund;
- höchstes Evidenzniveau und dessen Grenzen;
- patientenrelevante Ergebnisse, sofern vorhanden;
- bekannte Risiken und ausdrücklich benannte Datenlücken;
- Gegenanzeigen und Interaktionen, sofern durch Fachinformationen oder Studien belegt;
- regionalen Zulassungsstatus mit Produkt und Indikation;
- mindestens eine substanzspezifische Primär- oder Behördenquelle, sofern auffindbar;
- Reviewdatum und Inhaltsversion.

Wenn ein Punkt nicht zuverlässig ermittelbar ist, wird er nicht leer gelassen. Er erhält eine standardisierte Aussage wie „nicht ausreichend untersucht“, „keine direkt zurechenbaren Humandaten“ oder „Produktidentität nicht bestätigt“.

## Identitätsmodell

Die Identität wird als eigenes Datenfeld geführt:

- `confirmed`: Wirkstoff oder definiertes biologisches Arzneimittel ist eindeutig.
- `ambiguous`: Name wird für unterschiedliche Sequenzen, Salze oder Formen verwendet.
- `brand_or_blend`: Handels- oder Blendname; Zusammensetzung ist an die konkrete Quelle gebunden.
- `complex_mixture`: kein einzelnes definiertes Peptid.

Bei `ambiguous` und `brand_or_blend` zeigt die Detailseite einen prominenten Hinweis. Nicht belegte Produktbestandteile werden nicht als gesichert ausgegeben. Für PEG-MGF, CJC-1295 NO DAC, MGF und vergleichbare Namen werden Sequenz, Modifikation und Salz als fehlende Identitätsmerkmale benannt. Blends erhalten keine von Einzelbestandteilen abgeleiteten Wirksamkeits- oder Sicherheitsbewertungen.

## Evidenzmatrix

Der bisherige numerische oder pauschale Konfidenzwert wird vollständig aus der sichtbaren Oberfläche entfernt. Stattdessen zeigt Peptipedia sechs voneinander unabhängige Dimensionen:

1. Molekülidentität: bestätigt, teilweise geklärt oder ungeklärt.
2. Humanforschung: keine, sehr begrenzt, begrenzt, moderat oder stark.
3. Replikation: keine, einzelne Arbeitsgruppe, mehrere unabhängige Gruppen oder systematische Evidenz.
4. Klinische Endpunkte: keine, Surrogatwerte, symptom-/funktionsbezogen oder harte patientenrelevante Endpunkte.
5. Sicherheit: nicht ausreichend untersucht, begrenzt beschrieben oder durch Fachinformation/umfangreiche Studien beschrieben.
6. Zulassung: keine belegte Zulassung oder regional aufgeschlüsselte Zulassungen.

Die Matrix ist deskriptiv und erzeugt keinen Gesamtscore. Sortierung und Filterung verwenden keine versteckte medizinische Rangliste.

## Quellen und Aktualität

Jede Quelle erhält Typ, Titel, Herausgeber oder Autoren, Jahr, URL und `accessedAt`. Profile führen `reviewedAt` und `contentVersion`.

Ein deterministischer Katalog-Audit prüft:

- Pflichtfelder und gültige Datumsformate;
- Quellen ohne Abrufdatum;
- Zulassungsbehauptungen ohne regionale Behörden- oder Fachinformationsquelle;
- Profile mit mehr als 180 Tagen seit dem letzten Review;
- zugelassene Profile mit mehr als 90 Tagen seit dem letzten Review;
- ungeklärte Identitäten ohne sichtbaren Warnhinweis;
- leere Sicherheitsbereiche;
- Texte, die Dosier- oder Zyklusempfehlungen nahelegen.

Der Audit läuft lokal über ein npm-Skript und wöchentlich in GitHub Actions. Der Wochenlauf recherchiert nicht automatisch und verändert keine Inhalte; er erzeugt ausschließlich einen nachvollziehbaren Prüfbedarf.

## Medizinische und juristische Freigabe

Peptipedia erhält einen redaktionellen Freigabestatus für medizinische und juristische Prüfung. Beide Stati beginnen ehrlich mit `pending`. Namen von Prüfern oder Freigabedaten werden nur eingetragen, wenn eine reale externe Prüfung stattgefunden hat.

Ein Validator verhindert öffentliche Dosier- oder Zyklusempfehlungen, solange nicht beide Freigaben dokumentiert sind. Studienmengen dürfen ausschließlich als historische Studienbeschreibung erscheinen und benötigen Population, Route, Forschungszweck und den Hinweis, dass daraus keine Anwendungsempfehlung folgt.

Eine separate Checkliste dokumentiert, welche Punkte ein approbierter medizinischer Prüfer und eine für deutsches/EU-Recht qualifizierte juristische Person vor einer entsprechenden Produkterweiterung bewerten müssen. Diese Vorbereitung ist keine professionelle Freigabe.

## Oberfläche

Das bestehende dunkle Peptipedia-Design, die Typografie, Farben und horizontalen Tabs bleiben erhalten. Geändert werden nur informationsrelevante Teile:

- die Evidenzkarte zeigt die sechs Matrixdimensionen;
- regionale Zulassungen bleiben als Chips sichtbar;
- Identitätswarnungen erscheinen oberhalb der Tabs;
- fehlende Sicherheitsdaten werden als Warntext statt als leere Liste dargestellt;
- Quellen zeigen Jahr und Abrufdatum;
- auf Mobilgeräten bleibt die Tab-Leiste horizontal scrollbar.
- der rein rechnerische Rekonstitutionsrechner bleibt auf öffentliche Detailseiten beschränkt und wird in der App nicht angezeigt.

## Qualitätsgrenzen

Der ESLint-Lauf erfasst den Haupt-Workspace. Generierte Artefakte, Build-Ausgaben und separate Git-Worktrees werden ausgeschlossen, weil sie nicht Teil des aktuellen Main-Quellstands sind. Alle verbleibenden Lintfehler im Hauptcode werden ohne fachfremde Refactorings behoben.

## Verifikation und Abnahmekriterien

Die Umsetzung gilt erst als abgeschlossen, wenn:

- alle 66 Profile den Inhaltsvalidator bestehen;
- jedes Profil eine vollständige Evidenzmatrix besitzt;
- alle Quellen ein Abrufdatum besitzen;
- keine ungeklärte Identität ohne Warnhinweis existiert;
- keine sichtbaren numerischen oder pauschalen Konfidenzwerte mehr vorkommen;
- der Aktualitäts-Audit lokal und in der geplanten CI-Ausführung funktioniert;
- medizinische und juristische Freigaben ehrlich als ausstehend dokumentiert sind;
- alle Peptipedia-Tests, der vollständige Testlauf, der Produktions-Build und der globale Main-Lint ohne Fehler bestehen;
- Bibliothek und Detailseiten auf Desktop und Mobile visuell geprüft wurden.

## Reihenfolge

1. Datenmodell, Validatoren und fehlschlagende Tests.
2. Inhaltsüberarbeitung nach Profilgruppen mit Primär- und Behördenquellen.
3. Evidenzmatrix, Identitäts- und Sicherheitshinweise in der Oberfläche.
4. Aktualitäts-Audit, CI und externe Freigabecheckliste.
5. Projektweiter Lint-Abbau.
6. Vollständige automatische und visuelle Abnahme.
