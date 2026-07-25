# My Stack: Tracking-Tiefe, Routinen und Dosierungsverlauf

**Datum:** 2026-07-25
**Branch:** `codex/my-stack-foundation`
**Status:** Vom Nutzer bestätigt

## Ziel

My Stack soll sowohl sehr leichtes Einnahmetracking als auch eine vollständige
Produkt-, Dosis- und PK-Dokumentation unterstützen. Nutzer wählen die gewünschte
Genauigkeit ausdrücklich pro Substanz. Die App fragt nur Daten ab, die für diese
Stufe benötigt werden, erklärt jeden Schritt verständlich und erfindet niemals
fehlende Mengen.

Die drei Stufen sind:

1. **Nur Einnahme** – ausschließlich festhalten, ob eine Einnahme erfolgt ist.
2. **Mit Menge** – zusätzlich Mengen, Dosisänderungen und Titrationspläne
   dokumentieren.
3. **Vollständig** – alles aus „Mit Menge“ plus Produktstärke beziehungsweise
   Konzentration, PK-/Live-Blutspiegel-Funktionen und optionale Produkt- und
   Bestandsdaten.

Keine Stufe wird als medizinisch besser, sicherer oder empfehlenswerter
dargestellt. Die Auswahl beschreibt ausschließlich die gewünschte
Dokumentationstiefe.

## Begriffe

- **Substanz:** Der grundlegende Eintrag, zum Beispiel Vitamin D3, Zink oder
  Testosteron.
- **Produktstärke:** Wirkstoffmenge pro Bezugsmenge, zum Beispiel
  `5.000 IU pro Kapsel` oder `250 mg pro ml`.
- **Einnahmemenge/Dosis:** Die tatsächlich oder geplant eingenommene Menge, zum
  Beispiel `1 Kapsel`, `5.000 IU` oder `0,5 Tabletten`.
- **Verpackung:** Die konkrete Gebindegröße, zum Beispiel eine Flasche mit
  120 Kapseln, eine Packung mit 30 Tabletten oder ein 10-ml-Vial. Sie ist nur für
  Produktidentifikation und Bestandsberechnungen relevant.
- **Bestand:** Die noch verfügbare Anzahl beziehungsweise Menge eines Produkts.
- **Tracking-Stufe:** Die pro Stack-Objekt gewählte Dokumentationstiefe.

## Anlegeablauf

Der Wizard folgt diesem Grundablauf:

1. Substanz über Katalogsuche auswählen oder frei eingeben.
2. Darreichungsform auswählen oder einen Katalogvorschlag bestätigen. Sie
   bestimmt Darstellung, passende Einheiten und verfügbare Funktionen.
3. Tracking-Stufe ausdrücklich auswählen.
4. Nur die für die gewählte Stufe erforderlichen Angaben erfassen.
5. Einnahmeplan und Routinegruppe direkt beim Anlegen festlegen.
6. Eine verständliche Zusammenfassung vor dem Speichern zeigen.

Die Auswahl der Tracking-Stufe trägt die Überschrift:

> Wie möchtest du [Substanz] tracken?

Darunter steht dauerhaft:

> Du kannst diese Einstellung jederzeit ändern und später weitere Angaben
> ergänzen.

### Nur Einnahme

Erklärung:

> Du bestätigst lediglich, ob du [Substanz] eingenommen hast. Eine Menge,
> Produktstärke oder Marke ist nicht erforderlich.

Benötigte Schritte:

- Darreichungsform für die grafische Darstellung;
- Tage beziehungsweise Frequenz;
- feste Routinegruppe;
- optionale Uhrzeit.

Die Zusammenfassung erklärt ausdrücklich, dass im Alltag nur die Einnahme
bestätigt wird.

### Mit Menge

Erklärung:

> Zusätzlich zur Einnahme wird erfasst, wie viel du genommen hast. Das kann zum
> Beispiel 5.000 IU, 20 mg, 1 Kapsel oder eine halbe Tablette sein. Marke,
> Verpackung und Bestand sind nicht erforderlich.

Benötigte Schritte:

- Darreichungsform;
- geplante Einnahmemenge und passende Einheit;
- Einnahmeplan und Routinegruppe;
- optional direkt ein Dosis- oder Titrationsplan.

Bruchmengen wie `1/2`, `1/3` und `1/4` einer Tablette oder Kapsel werden als
komfortable Eingabe angeboten und intern als exakter Dezimalwert gespeichert.

### Vollständig

Erklärung:

> Du dokumentierst Einnahme, Menge und Produktstärke vollständig. Wenn für die
> gewählte Substanz und Darreichungsform ein geeignetes PK-Profil vorhanden ist,
> stehen zusätzlich Live-Blutspiegel und Prognosen zur Verfügung.

Benötigte Schritte:

- Darreichungsform und Darreichungsweg;
- Produktstärke beziehungsweise Konzentration;
- geplante Einnahmemenge;
- Einnahmeplan, Routinegruppe und optional genaue Uhrzeit;
- Prüfung der PK-Voraussetzungen.

Die Stufenkarte zeigt bereits vor der Auswahl dynamisch entweder
„Live-Blutspiegel verfügbar“ oder eine klare Erklärung, dass aktuell kein
geeignetes PK-Profil vorhanden ist.

## Produkt und Bestand

„Produkt & Bestand“ ist auch bei „Vollständig“ ein optionaler, zunächst
eingeklappter Bereich. Er enthält:

- Marke;
- Verpackungs- beziehungsweise Gebindegröße;
- Chargennummer und Ablaufdatum;
- optionales Foto oder Dokument;
- aktuellen Bestand.

Verpackungsgröße und Anfangsbestand werden erst abgefragt, wenn der Nutzer
„Bestand mitverfolgen“ aktiviert. Ohne diese Aktivierung erscheinen im Alltag
keine Bestandsfelder oder Nachkaufhinweise.

Die hochwertige Bühnendarstellung visualisiert weiterhin die Darreichungsform,
nicht die konkrete Markenverpackung.

## Routinen und Bestätigung

Jeder Einnahmeplan wird einer festen Routinegruppe zugeordnet. Die Gruppen haben
eine optionale Uhrzeit. Eine Gruppe darf Einträge aller drei Tracking-Stufen
enthalten.

Mit „Alles eingenommen“ werden alle ausgewählten Einträge gemeinsam bestätigt:

- **Nur Einnahme:** Bestätigung und Zeitpunkt, ohne Menge.
- **Mit Menge:** Bestätigung, Zeitpunkt und aktuell geplante Menge.
- **Vollständig:** dieselben Einnahmedaten; zusätzlich Bestandsabbuchung und
  PK-Ereignis, sofern die jeweiligen Funktionen aktiv und bereit sind.

Vor der Gruppenbestätigung können einzelne Einträge abgewählt oder ihre
tatsächlichen Mengen geändert werden. Injektionstracking bleibt optional und
blockiert weder Einzel- noch Gruppenbestätigungen. Eine Injektionsstelle kann
nach der Einnahmebestätigung ergänzt werden.

## Dosisänderungen und Titration

„Mit Menge“ und „Vollständig“ unterstützen dieselbe Dosierungsplanung:

1. **Einmalige Abweichung:** Nur eine konkrete Einnahme erhält eine abweichende
   tatsächliche Menge.
2. **Dauerhafte Anpassung:** Eine neue Standarddosis gilt ab einem ausgewählten
   Datum.
3. **Mehrstufige Titration:** Mehrere zukünftige Dosisschritte werden mit
   Startdatum, Dosis und Einheit geplant.

Bestätigte Einnahmen werden niemals rückwirkend verändert. Offene zukünftige
Routinen verwenden automatisch die zum jeweiligen Datum gültige Dosis. Die
bestehende Planhistorie und die vorhandene zentrale Dosisauflösung bleiben die
Quelle für vergangene und zukünftige Dosierungssegmente.

Die App dokumentiert ausschließlich nutzereingegebene Entscheidungen. Sie
berechnet oder empfiehlt keine medizinisch „richtige“ Dosis oder Titration.

Bei „Mit Menge“ steuern Anpassungen Routinen, Erinnerungen, Einnahmehistorie und
Dosisstatistiken. Bei „Vollständig“ fließen sie zusätzlich in PK-Prognosen und,
falls aktiviert, Bestandsberechnungen ein.

## Wechsel der Tracking-Stufe

Die Tracking-Stufe gilt pro Stack-Objekt und kann jederzeit geändert werden.

- Ein Upgrade übernimmt vorhandene Daten und fragt nur fehlende Angaben ab.
- Ein Downgrade löscht weder Produktdetails noch historische Einnahmen.
- Ab dem Wechsel zeigt und verlangt der Alltag nur noch Daten der neuen Stufe.
- Ein explizites Entfernen gespeicherter Detaildaten bleibt eine separate,
  bestätigungspflichtige Aktion.

Bestehende Mengen und Simulationen bleiben nach einem Downgrade historisch
sichtbar. Sobald wieder eine Einnahme ohne bekannte Menge bestätigt wird, darf
die Simulation ab diesem Punkt nicht rechnerisch fortgesetzt werden.

## PK- und Live-Blutspiegel

Die Live-Blutspiegel-Funktion gehört zur Stufe „Vollständig“, wird aber nicht
allein durch die Stufe freigeschaltet. Ein zentraler Readiness-Check bewertet:

- numerische, in eine Modell-Einheit umrechenbare Dosis;
- Einnahmezeitpunkt;
- Darreichungsweg und Darreichungsform;
- geeignetes PK-Profil für Substanz und Route;
- gegebenenfalls benötigte Produktstärke oder Konzentration.

Der Readiness-Check liefert genau einen der Zustände:

- **Verfügbar:** Alle Voraussetzungen sind erfüllt.
- **Angaben fehlen:** Die App benennt die konkreten fehlenden Angaben und bietet
  „Angaben ergänzen“ an.
- **Nicht unterstützt:** Für die Kombination existiert kein geeignetes
  PK-Profil; es wird keine Ersatzkurve erzeugt.

Öffnet ein Nutzer mit „Mit Menge“ die Simulation, erklärt die App, dass
„Vollständig“ benötigt wird, übernimmt alle vorhandenen Angaben und fragt nur
die PK-relevanten Lücken ab.

Unbekannte Mengen werden nie geschätzt. Nach einem Upgrade beginnt eine
Simulation erst mit vollständig quantifizierten Einnahmen und kennzeichnet den
Startpunkt. Nach einer späteren mengenlosen Einnahme wird die Kurve unterbrochen.
Vergangene tatsächliche Werte und zukünftige titrationsbasierte Prognosen werden
visuell eindeutig getrennt; Prognosen tragen die Kennzeichnung „geplant“.

## Datenmodell und Persistenz

- `stack_items` erhält eine nicht leere Tracking-Stufe mit den stabilen Werten
  `intake_only`, `with_amount` und `complete`.
- Produktstärke in `stack_item_ingredients` bleibt für `intake_only` und
  `with_amount` optional. Für neu angelegte `complete`-Einträge wird sie
  entsprechend der Darreichungsform validiert.
- Einnahmepläne erlauben für `intake_only` eine leere Dosis und Einheit.
- Einnahmebestätigungen erlauben ebenfalls eine leere Dosis und Einheit. Diese
  Kombination bedeutet ausdrücklich „Menge wurde nicht getrackt“, niemals null
  Milligramm oder eine ausgefallene Einnahme.
- Für `with_amount` und `complete` müssen Dosis und Einheit bei einer regulären
  Bestätigung vorhanden sein; eine ausgelassene Einnahme wird weiterhin über
  den bestehenden Einnahmestatus modelliert.
- Die bestehende zentrale Plan- und Dosislogik wird erweitert, nicht dupliziert.
- Stack-Objekt, Inhaltsstoffe, Tracking-Stufe und initialer Einnahmeplan werden
  innerhalb einer transaktionalen Speichergrenze angelegt, damit kein
  unvollständiger halber Wizard-Stand entsteht.

Bestehende Peptid-Einträge behalten alle heutigen Funktionen und werden beim
Upgrade nicht erneut durch den Wizard gezwungen. Sie erhalten zunächst
`complete`, damit kein bestehendes Feature verschwindet. Bereits markierte
unvollständige Migrationsdaten bleiben `needs_review`; fehlende Angaben werden
erst verlangt, wenn eine konkrete Funktion sie benötigt.

## Fehler- und Leerzustände

- Validierungsfehler erklären nicht nur, welches Feld fehlt, sondern warum es
  für die gewählte Stufe benötigt wird.
- Ein fehlendes PK-Profil ist kein allgemeiner Speicherfehler.
- Ein Fehler bei der optionalen Bestandsaktualisierung darf die bereits
  bestätigte Einnahme nicht duplizieren; der Bestand wird als separat
  wiederholbarer Folgeschritt behandelt.
- Eine fehlgeschlagene transaktionale Neuanlage hinterlässt weder Stack-Objekt
  noch Einnahmeplan.
- Mengenlose Einnahmen werden in Historie und Export als „Menge nicht getrackt“
  dargestellt, nicht als `0`.

## Verifikation

Die Umsetzung muss mindestens folgende Fälle automatisiert prüfen:

- stufengerechte Wizard-Schritte und Erklärtexte;
- Pflichtfelder pro Tracking-Stufe;
- Speicherung einer Einnahme ohne künstliche Dosis;
- gemischte Routinegruppe mit einer gemeinsamen Bestätigung;
- Abwahl und Mengenänderung vor der Gruppenbestätigung;
- optionale Injektionsstelle ohne Blockierung;
- einmalige Abweichung, dauerhafte Anpassung und mehrstufige Titration;
- unveränderte bestätigte Historie nach Planänderungen;
- Upgrade und Downgrade ohne Datenverlust;
- PK-Zustände „verfügbar“, „Angaben fehlen“ und „nicht unterstützt“;
- Unterbrechung der Kurve bei unbekannter Menge;
- klare Trennung tatsächlicher und geplanter PK-Verläufe;
- Bestandsfelder nur nach aktivem Opt-in;
- bestehende Peptid-Einträge ohne erzwungenen neuen Wizard.

## Nicht Bestandteil dieses Teilprojekts

- medizinische Dosierungs- oder Titrationsempfehlungen;
- generische PK-Kurven für nicht unterstützte Substanzen;
- automatische Annahmen über Stärke, Dosis oder Packungsgröße;
- Visualisierung konkreter Markenverpackungen;
- verpflichtende Bestandsverwaltung;
- verpflichtendes Injektionstracking.
