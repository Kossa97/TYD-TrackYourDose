# My Stack Generalisierung – Teilprojekt 1: Grundlage

**Datum:** 2026-07-21
**Status:** Design abgenommen, selbst geprüft, bereit zur Nutzerprüfung
**Bereich:** My Stack, Substanzkatalog, Anlage-/Bearbeitungsflow und Migration

## Ziel

My Stack wird von einer peptidspezifischen Verwaltung zu einer allgemeinen Stack-Verwaltung für Peptide, Medikamente, Hormone, Supplemente und Vitamine umgebaut.

Teilprojekt 1 schafft dafür das saubere Fundament:

1. ein neutrales Stack-Datenmodell,
2. einen allgemeinen Substanzkatalog mit Synonymen,
3. einen dynamischen Flow zum Anlegen und Bearbeiten,
4. Unterstützung für Einzel- und Mehrfachwirkstoff-Produkte,
5. eine kontrollierte Migration des heutigen Peptidstands,
6. eine modulare My-Stack-Architektur für die Folgeprojekte.

Das bestehende hochwertige Vial bleibt funktional und visuell erhalten. Neue Einnahmeroutinen, Bestandsautomatik, KI-Etikettenimport und weitere Darreichungsform-Grafiken werden in getrennten Folgeprojekten umgesetzt.

## Ausgangslage

Der aktuelle My-Stack-Bereich verwendet zwar teilweise den allgemeinen Begriff „Substanz“, ist aber technisch und visuell peptidspezifisch:

- `src/pages/Peptide.tsx` bündelt Laden, CRUD, Archiv, Vial-Karussell, Inventar, Zyklen, Dosiseskalationen und Detaildarstellung in einer großen Seite.
- `PeptideFormModal` fragt vor allem nach Wirkstoff pro Vial, Rekonstitution, Haltbarkeit und Vial-Bestand.
- Die zentrale Datenbanktabelle heißt `peptides`; abhängige Tabellen referenzieren sie über `peptide_id`.
- Das aktuelle Objektmodell vermischt Substanz, konkrete Produktvariante, vorbereitetes Vial, Bestand und Einnahmeplanung.
- Peptidfarben liegen teilweise nur in `localStorage`.

Der Graphify-Architekturgraph bestätigt die breite Kopplung: `Peptide.tsx` ist ein zentraler Knoten mit Verbindungen zu Formular, Vial-Grafik, Supabase, Einnahmeplanung, Bestand, Fortschritt, Protokoll und Simulation. Da die App noch nicht veröffentlicht ist und nur einen Nutzer hat, wird jetzt bewusst ein sauberer Komplettumbau vorgenommen, statt die alte Benennung dauerhaft über Kompatibilitätsschichten mitzuschleppen.

## Abgenommene Produktentscheidungen

| Thema | Entscheidung |
|---|---|
| Grundprinzip | Ein Stack-Objekt repräsentiert eine konkrete Variante einer Substanz. |
| Identität | Substanz beziehungsweise Inhaltsstoff-Zusammensetzung + Darreichungsform + Stärke. |
| Unterschiedliche Formen | Vitamin D3 als Kapsel und als Tropfen sind zwei getrennte Stack-Objekte. |
| Unterschiedliche Stärken | Vitamin D3 1.000 IU und 5.000 IU sind zwei getrennte Stack-Objekte. |
| Markenwechsel | Gleiche Substanz, Form und Stärke bleiben standardmäßig derselbe Eintrag; die Marke ist optional und manuell änderbar. |
| Duplikate | Warnen und bestehenden Eintrag anbieten, aber bewusstes separates Anlegen erlauben. |
| Einstieg | Zuerst „Was möchtest du hinzufügen?“ mit Katalogsuche und Synonymen. |
| Unbekannte Substanzen | Freie Eingabe bleibt immer möglich. |
| Kategorie | Bei Katalogtreffern automatisch übernehmen; bei freien Einträgen abfragen; später editierbar. |
| Mehrfachwirkstoffe | Ein Stack-Objekt kann mehrere Inhaltsstoffe mit eigener Stärke enthalten. |
| Darreichungsform | Bestimmt Bezugsgröße, passende Einheiten, Fähigkeiten und später den Grafik-Renderer. |
| Änderungen | Form und Stärke bleiben editierbar; alte Einnahmen müssen über Momentaufnahmen historisch korrekt bleiben. |
| Einnahmeplan | Gehört später in denselben geführten Anlageflow, bleibt aber überspringbar. |
| Bestand | Wird später als optionaler letzter Schritt im selben Flow angeboten. |
| Medizinische Aussagen | Katalog und Formular helfen bei Identifikation und Struktur, empfehlen aber keine Dosierung. |

## Begriffe und Ebenen

### Substanzkatalog

Der globale Katalog enthält kanonische, wiederverwendbare Informationen:

- kanonischer Name, zum Beispiel „Vitamin D3“,
- Synonyme, zum Beispiel „Cholecalciferol“,
- organisatorische Kategorie,
- sinnvolle Einheiten,
- mögliche Darreichungsformen,
- optionale Verknüpfung zu bestehenden PK-Profilen.

Der Katalog ist eine Eingabehilfe, kein vollständiges medizinisches Wissenssystem. Ein fehlender Katalogtreffer darf das Anlegen niemals blockieren.

### Stack-Objekt

Ein Stack-Objekt ist die persönliche, konkrete Variante des Nutzers:

- Vitamin D3 · Kapsel · 5.000 IU pro Kapsel,
- Vitamin D3 · Tropfen · 1.000 IU pro Tropfen,
- Testosteron · Vial · 250 mg pro ml,
- Multivitamin · Kapsel · mehrere Inhaltsstoffe pro Portion.

Es besitzt eine eigene Darreichungsform, Stärke beziehungsweise Inhaltsstoffliste, optionale Marke, Farbe, Notizen und Archivzustand.

### Produktdetails

Marke, Charge, Packungsgröße und hochgeladene Verpackungsinformationen sind optionale Details. Die Marke bestimmt weder die Identität noch die Grafik. Exakte Herstellerverpackungen werden nicht nachgebildet; die spätere Visualisierung stellt die physische Darreichungsform in der hochwertigen TYD-Designsprache dar.

## Datenmodell

### `substance_catalog`

Globale, für angemeldete Nutzer lesbare Katalogtabelle:

| Feld | Bedeutung |
|---|---|
| `id` | Stabile UUID |
| `canonical_name` | Kanonischer Anzeigename |
| `aliases` | Suchbare alternative Namen |
| `default_category` | Vorgeschlagene organisatorische Kategorie |
| `suggested_units` | Sinnvolle, aber nicht verpflichtende Stärke-Einheiten |
| `suggested_dosage_forms` | Mögliche Darreichungsformen |
| `pk_profile_id` | Optionale Verknüpfung für bekannte PK-Profile |
| `active` | Eintrag in der Suche verfügbar |

Katalogschreibrechte bleiben administrativ beschränkt. Benutzerdefinierte Substanzen werden nicht automatisch in den globalen Katalog übernommen.

### `stack_items`

Nutzerbezogener Haupteintrag:

| Feld | Bedeutung |
|---|---|
| `id`, `user_id` | Identität und Eigentümer |
| `display_name` | Sichtbarer Name des Stack-Objekts |
| `category` | `peptide`, `medication`, `hormone`, `supplement` oder `vitamin` |
| `dosage_form` | Stabiler Darreichungsform-Schlüssel |
| `brand` | Optionale Marke |
| `color_hex` | Persistierte Darstellungsfarbe, nicht mehr nur `localStorage` |
| `notes` | Freie Notizen |
| `configuration_status` | `complete` oder `needs_review` für uneindeutig migrierte Altstände |
| `archived`, `archived_at` | Bestehende Archivsemantik |
| `created_at`, `updated_at` | Zeitstempel |

Ein Stack-Objekt verweist nicht zwingend direkt auf genau eine Katalogsubstanz. Die Zuordnung erfolgt über seine Inhaltsstoffe, damit Einzel- und Mehrfachwirkstoff-Produkte dasselbe Modell verwenden.

### `stack_item_ingredients`

Mindestens ein Inhaltsstoff pro Stack-Objekt:

| Feld | Bedeutung |
|---|---|
| `id`, `stack_item_id` | Identität und Zugehörigkeit |
| `catalog_substance_id` | Optionaler Katalogtreffer |
| `custom_name` | Pflicht, wenn kein Katalogtreffer existiert |
| `amount_value` | Stärke als Dezimalwert; nur für migrierte `needs_review`-Einträge vorübergehend null |
| `amount_unit` | Zum Beispiel `mg`, `mcg`, `IU`, `g`; nur für migrierte `needs_review`-Einträge vorübergehend null |
| `basis_value` | Bezugsmenge, standardmäßig `1` |
| `basis_unit` | Zum Beispiel Kapsel, Tablette, Tropfen, ml, Vial oder Portion |
| `position` | Stabile Reihenfolge im Mehrfachwirkstoff-Formular |

Damit lassen sich sowohl „5.000 IU pro Kapsel“ als auch „200 mg pro 2 Tabletten“ eindeutig abbilden.

### Bestehende abhängige Daten

Die bisherige Tabelle `peptides` wird sauber zu `stack_items` überführt. Alle betroffenen Fremdschlüssel wie `peptide_id` werden kontrolliert zu `stack_item_id` umbenannt. Dies betrifft unter anderem Zyklen, Einnahmeprotokolle, Effekte, Bewertungen, Vials, Injektionsdaten und weitere von der Schema- und Graphify-Inventur gefundene Abhängigkeiten.

Die Tabellen werden in diesem Teilprojekt nur soweit generalisiert, wie es für eine konsistente Stack-Identität notwendig ist. Bestehende Spezialspalten, die das heutige Vial, die Rekonstitution oder den Bestand weiterhin benötigen, werden nicht vorschnell gelöscht; ihre fachliche Neuordnung erfolgt in den passenden Folgeprojekten. Der saubere Komplettumbau bezieht sich in Teilprojekt 1 auf Identität, Benennung, Fremdschlüssel, Katalog, Inhaltsstoffe und Frontend-Grenzen. Die fachliche Neugestaltung von Zyklen zu allgemeinen Einnahmeplänen und die Generalisierung des Bestands folgen separat.

## Darreichungsform-Definitionen

Darreichungsformen werden nicht als verstreute `if`-Abfragen in Komponenten implementiert. Eine zentrale Definition beschreibt pro Form:

- Anzeigename und Übersetzungsschlüssel,
- erlaubte beziehungsweise vorgeschlagene Stärke-Einheiten,
- Bezugsgrößen,
- spätere Bestandszählung,
- verfügbaren Grafik-Renderer,
- fachliche Fähigkeiten.

Fähigkeiten sind beispielsweise:

- `countable`,
- `divisible`,
- `liquid`,
- `injectable`,
- `reconstitutable`,
- `concentration_based`,
- `inventory_capable`.

Die Fähigkeiten hängen primär von der Form ab, nicht von der Kategorie. Dadurch können etwa Peptide und Hormone dieselbe Vial-, Konzentrations- und Injektionslogik verwenden, ohne Code zu duplizieren.

Vorgesehene Form-Schlüssel für das Gesamtsystem sind Vial, Ampulle, Pen, Tablette, Kapsel, Tropfen, Flüssigkeit, Pulver, Nasenspray, Spray, Gel, Pflaster, Tube und „Andere“. Das Datenmodell darf diese Formen bereits speichern. Eine Form wird jedoch erst im grafischen My-Stack-Karussell freigeschaltet, wenn ihr eigener Renderer den Qualitätsstandard des bestehenden Vials erreicht; bis dahin bleibt sie auf Entwicklungsständen auf die textuelle Listenansicht beschränkt. Es gibt keine minderwertigen Zwischen-Icons als endgültige Darstellung und keine Veröffentlichung einer halbfertigen grafischen Form.

## Hinzufügen-Flow

Der gemeinsame Wizard ist adaptiv und zeigt nur relevante Felder.

### 1. Substanz suchen

- Leitfrage: „Was möchtest du hinzufügen?“
- Suche über kanonische Namen und Synonyme.
- Auswahl eines Katalogtreffers übernimmt Name und Kategorie als Vorschlag.
- Ohne Treffer steht „Als eigene Substanz hinzufügen“ bereit.

### 2. Eigene Substanz oder Produkt definieren

- Bei freien Einträgen: Name und Kategorie wählen.
- Bei Mehrfachwirkstoff-Produkten: Produktname plus beliebig viele Inhaltsstoffzeilen.
- Jede Inhaltsstoffzeile kann einen Katalogtreffer oder einen freien Namen verwenden.

### 3. Darreichungsform wählen

- Die Formauswahl bestimmt die folgenden Felder und Einheiten.
- Bei später verfügbaren Renderern erscheint unmittelbar eine hochwertige Vorschau auf derselben Bühne wie das heutige Vial.
- Exakte Markenverpackungen werden nicht visualisiert.

### 4. Stärke erfassen

Die Oberfläche erfasst Wert, Einheit und Bezugsgröße passend zur Form:

- 5.000 IU pro Kapsel,
- 100 mg pro Tablette,
- 1.000 IU pro Tropfen,
- 250 mg pro ml,
- 10 mg pro Vial,
- 300 mg pro Portion.

Bekannte Substanzen erhalten sinnvolle Einheitenvorschläge. „Andere Einheit“ bleibt verfügbar. Die App gibt keine Dosierungsempfehlung.

### 5. Optionale Produktdetails

- Marke,
- Farbe,
- Notizen.

Bestandsdaten werden im späteren Bestandsprojekt als optionaler Wizard-Schritt ergänzt.

### 6. Einnahme und Tracking

Der finale Gesamtflow wird direkt beim Anlegen nach der gewünschten Nutzung fragen:

- Tagesroutine,
- einzeln bestätigen,
- bei Bedarf,
- nur in My Stack.

Die dazugehörigen Felder für Einnahmemenge, berechnete Wirkstoffdosis, Frequenz, Routinegruppe, Uhrzeit, Start- und Enddatum werden im Einnahmeplan-Teilprojekt umgesetzt. „Nur in My Stack“ beendet den Flow ohne Plan. Der technische Wizard wird bereits so geschnitten, dass diese Schritte später ohne Umbau des Substanzkerns ergänzt werden können.

### 7. Zusammenfassung und Speichern

- Alle Angaben vor dem Speichern prüfen.
- Stack-Objekt und Inhaltsstoffe über eine transaktionale Datenbankfunktion atomar speichern.
- Nach Erfolg My Stack aktualisieren.
- Kein teilweise angelegtes Mehrfachwirkstoff-Produkt bei einem Fehler.

## Bearbeiten und Varianten

Alle Kerndaten bleiben später editierbar. Die App unterscheidet drei Fälle:

1. **Markenwechsel bei gleicher Form und Stärke:** bestehenden Eintrag aktualisieren.
2. **Alte Variante vollständig ersetzt:** bestehenden Eintrag ändern; die Historie bleibt durch gespeicherte Momentaufnahmen korrekt.
3. **Varianten parallel verwendet oder getrennt bevorratet:** „Als neue Variante anlegen“ empfehlen.

Form- oder Stärkeänderungen zeigen deshalb eine verständliche Auswahl zwischen „Bestehenden Eintrag ändern“ und „Als neue Variante anlegen“. Die App empfiehlt, blockiert aber nicht.

Bestätigte Einnahmen speichern im späteren Einnahmeplan-Projekt eine Momentaufnahme des damaligen Namens, der Form, der Inhaltsstoffe, der Stärke, der praktischen Einnahmemenge und der berechneten Wirkstoffdosis. Änderungen am aktuellen Stack-Objekt schreiben vergangene Daten niemals rückwirkend um.

## Duplikaterkennung

Vor dem Speichern bildet die App aus Inhaltsstoff-Zusammensetzung, Darreichungsform und Stärke einen normalisierten Vergleichsschlüssel.

Bei einem Treffer:

- „Bestehenden Eintrag öffnen“ als empfohlene Aktion,
- „Trotzdem separat hinzufügen“ für bewusste getrennte Produkte oder Bestände,
- „Abbrechen“.

Es gibt keine harte Datenbank-Eindeutigkeit auf diesem Vergleichsschlüssel, weil reale parallele Varianten erlaubt bleiben müssen.

## Modulare Frontend-Struktur

Die bisherige große Peptidseite wird in einen fokussierten Feature-Bereich aufgeteilt:

```text
src/features/my-stack/
  MyStackPage.tsx
  types.ts
  components/
    StackItemWizard.tsx
    SubstanceSearch.tsx
    IngredientEditor.tsx
    DosageFormPicker.tsx
    StrengthEditor.tsx
    StackStage.tsx
    StackItemDetails.tsx
    StackArchive.tsx
  lib/
    categories.ts
    dosageForms.ts
    duplicateFingerprint.ts
    validation.ts
  services/
    substanceCatalog.ts
    stackItems.ts
  extensions/
    peptide/
```

Verantwortlichkeiten:

- `MyStackPage`: Orchestrierung, Laden, Suche, Sortierung und Auswahl.
- `StackItemWizard`: Schrittsteuerung, aber keine verstreute Darreichungsform-Fachlogik.
- `SubstanceSearch`: Katalogsuche plus freie Eingabe.
- `IngredientEditor`: Einzel- und Mehrfachwirkstoffe.
- `dosageForms`: zentrale Regeln, Einheiten, Bezugsgrößen und Fähigkeiten.
- `stackItems`-Service: Aufruf der transaktionalen Datenbankfunktion und Duplikatprüfung.
- `extensions/peptide`: PK-Profil und wirklich peptidspezifische Funktionen.
- `StackStage`: gemeinsame Renderer-Schnittstelle; das bestehende Vial bleibt der erste Renderer.

Die bestehende Route kann für Kompatibilität auf `MyStackPage` weiterleiten. Nutzerseitige Begriffe werden konsequent von „Peptid“ auf „Substanz“ beziehungsweise „My Stack“ umgestellt, außer wo tatsächlich eine Peptid-Spezialfunktion gemeint ist.

## Backup- und Migrations-Gate

Vor jeder strukturellen Änderung wird der aktuelle Peptidstand vollständig gesichert:

1. unveränderlicher Git-Tag des funktionierenden Codes,
2. vollständiger Supabase-Schema- und Datenexport,
3. Export vorhandener Supabase-Storage-Dateien,
4. Export lokaler Peptidfarben und vorbereitete einmalige Client-Migration in die Datenbank,
5. dokumentierte Wiederherstellungsprüfung.

Sensible Daten und Zugangsdaten werden nicht in Git committed.

Die eigentliche Migration:

1. neue Katalog- und Inhaltsstoffstruktur anlegen,
2. bestehende Peptidzeilen in Stack-Objekte überführen,
3. vorhandene Peptid-Stärke als ersten Inhaltsstoff abbilden; fehlt sie, den Eintrag als `needs_review` übernehmen statt einen Wert zu erfinden,
4. Farben beim ersten Start nach der Migration einmalig aus `localStorage` in persistierte Stack-Daten übernehmen; fehlt der lokale Wert, den bestehenden deterministischen Farbfallback verwenden,
5. Tabellen und Fremdschlüssel sauber umbenennen,
6. RLS-Policies und Indizes auf die neuen Namen übertragen,
7. Frontend auf das neutrale Modell umstellen,
8. alte Peptidpfade erst nach erfolgreicher Verifikation entfernen.

Darreichungsformen bestehender Peptide werden nur bei eindeutigen Daten automatisch erkannt. Injektion plus Vial-/Rekonstitutionsdaten wird als Vial übernommen. Mehrdeutige nasale, orale oder transdermale Einträge werden als `needs_review` übernommen, behalten zunächst ihre bisherige Darstellung und verlangen bei der nächsten Bearbeitung eine einmalige Bestätigung der Form. Für neue Einträge lässt der Wizard keine unvollständige Stärke oder Form zu.

## Fehlerverhalten

- **Katalog nicht erreichbar:** freie Eingabe anbieten; der Wizard bleibt benutzbar.
- **Unvollständige Stärke:** fehlenden Wert, Einheit oder Bezugsgröße direkt an der Inhaltsstoffzeile markieren.
- **Unvollständiger Mehrfachwirkstoff:** Speichern blockieren und betroffene Zeile fokussieren.
- **Duplikat:** Warnung mit Öffnen-, Trotzdem-anlegen- und Abbrechen-Aktion.
- **Transaktionsfehler:** die Datenbankfunktion rollt vollständig zurück; verständliche Fehlermeldung und Eingaben im Wizard behalten.
- **Migration inkonsistent:** Veröffentlichung stoppen und über den geprüften Backup-Punkt zurückrollen.
- **Nicht unterstützter Renderer:** Darreichungsform nicht für das grafische Karussell freischalten, bis der hochwertige Renderer fertig ist.

## Barrierefreiheit und Internationalisierung

- Alle neuen sichtbaren Texte erhalten Übersetzungsschlüssel in sämtlichen unterstützten Sprachen.
- Suchergebnisse, Inhaltsstoffzeilen, Formularfehler und Dialogaktionen sind vollständig per Tastatur bedienbar.
- Fokus wird bei Validierungsfehlern zum ersten fehlerhaften Feld geführt.
- Dialoge besitzen Fokusfalle, Escape-Verhalten und zugängliche Beschriftungen.
- Einheiten werden fachlich gespeichert und lokalisiert dargestellt, ohne Werte stillschweigend zu verändern.
- Touch-Ziele bleiben mindestens 44 × 44 Pixel groß.

## Verifikation

### Datenmodell und Migration

- Vorher-/Nachher-Zählungen für Stack-Objekte und alle abhängigen Datensätze stimmen überein.
- Keine verwaisten Fremdschlüssel nach der Umbenennung.
- RLS erlaubt weiterhin nur den Zugriff auf eigene Stack-Daten.
- Archive, Wiederherstellung und permanentes Löschen behalten ihre bestehende Semantik.
- Die einmalige Client-Migration persistiert vorhandene lokale Farben; fehlende lokale Werte verwenden nachvollziehbar den bestehenden Fallback.
- Migrierte Einträge ohne eindeutige Stärke oder Form sind als `needs_review` markiert und enthalten keine erfundenen Werte.

### Reine Logik

- Katalogsuche findet kanonische Namen und Synonyme case-insensitiv.
- Freie Substanzen funktionieren ohne Katalog-ID.
- Darreichungsform-Definitionen liefern korrekte Einheiten, Bezugsgrößen und Fähigkeiten.
- Einzel- und Mehrfachwirkstoff-Validierung deckt fehlende Werte, Einheiten und Bezugsgrößen ab.
- Duplikat-Fingerprints normalisieren Reihenfolge, Groß-/Kleinschreibung und numerisch gleichwertige Werte.
- Variantenentscheidung unterscheidet Markenwechsel, Ersatz und parallele Variante.

### UI und Regression

- Geführter Flow für Katalogtreffer, freie Substanz und Mehrfachwirkstoff-Produkt.
- Editieren, Archivieren, Wiederherstellen und bewusstes Duplizieren.
- Katalogausfall mit funktionierender freier Eingabe.
- Aktuelles Vial: Darstellung, Bühnenlicht, Schatten, Reflexionen, Slosh, Füllstand und Karussellinteraktion bleiben unverändert hochwertig.
- Bestehende Peptidfunktionen wie PK-Verknüpfung und Rekonstitution bleiben nach der Modularisierung erreichbar.
- Mobile und Desktop-Ansichten ohne horizontalen Overflow; Tastatur- und Screenreader-Prüfung der neuen Flows.
- Fokussierte Tests, vollständige Testsuite, Lint und Produktionsbuild bestehen.

## Folgeprojekte

1. **Einnahmepläne und Routinen:** praktische Menge einschließlich Bruchteilen, berechnete Wirkstoffdosis, mehrere Einnahmen pro Tag, feste Routinegruppen mit optionaler Uhrzeit, gebündelte Bestätigung, individuelle Bestätigung, „bei Bedarf“, Planversionierung ab Datum sowie gemeinsame Erinnerungen pro Gruppe.
2. **Optionaler Bestand:** Packungsgröße und Bestandsart pro Form, manuelle Korrekturen, Abzug nur nach Bestätigung, grafische Bestandsdarstellung nur bei aktivierter Verfolgung.
3. **Gemeinsames Bühnensystem:** materialgerechte Licht-, Schatten-, Fokus-, Reflexions- und Physikschnittstellen auf Basis der heutigen Vial-Qualität.
4. **Darreichungsformen einzeln:** jede Form erhält einen eigenen Design-, Implementierungs- und Feinschliffzyklus; keine pauschalen oder minderwertigen Ersatzgrafiken.
5. **Verpackungs-/Etikettenimport:** Foto oder Datei auslesen, Produkt, Portionen und mehrere Inhaltsstoffe als bearbeitbaren Entwurf erkennen; verpflichtende manuelle Prüfung vor dem Speichern; keine automatische Dosierungsempfehlung.

## Nicht in Teilprojekt 1

- Fertige Tagesroutine, Erinnerungslogik oder gebündelte Einnahmebestätigung.
- Allgemeine Planversionierung und „bei Bedarf“-Protokollierung.
- Automatische Bestandsabzüge oder neue Bestandsvisualisierungen.
- KI-/OCR-Auslesen von Verpackungen, Fotos oder PDFs.
- Neue fertige Objektgrafiken außer dem bestehenden Vial.
- Medizinische Dosierungsempfehlungen, Interaktionsprüfung oder Risikobewertung.
- Vollständigkeitsgarantie für den Substanzkatalog.
