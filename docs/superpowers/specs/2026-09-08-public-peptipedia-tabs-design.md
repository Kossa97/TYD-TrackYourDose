# Öffentliche Peptipedia mit horizontaler Tab-Navigation

**Datum:** 2026-09-08  
**Status:** Zur Nutzerprüfung  
**Ausgangslage:** Die bestehende Peptipedia ist visuell bereits hochwertig, liegt aber innerhalb des geschützten App-Bereichs und bezieht ihre Inhalte aus Supabase. Die Detailseite zeigt alle Themen untereinander und wiederholt einzelne Informationen.

## Ziel

Peptipedia wird zu einem öffentlichen, suchmaschinenlesbaren Wissensbereich innerhalb derselben App. Die vorhandene visuelle Sprache bleibt unverändert. Eine kurze Erklärung steht am Anfang jedes Peptidprofils; alle vertiefenden Informationen werden direkt darunter über eine horizontale, mobil bedienbare Tab-Leiste gegliedert.

Die erste öffentliche Version umfasst die elf bereits vorhandenen Peptide. Alle veröffentlichten Inhalte werden redaktionell geprüft und im Repository versioniert.

## Verbindliche Gestaltungsregel

Dies ist **kein Redesign**.

- Die bestehenden Schriften, Schriftgrößen, Farben, Flächen, Karten, Radien, Schatten, Abstände und Animationseigenschaften von Peptipedia bleiben die visuelle Quelle der Wahrheit.
- Vorhandene Peptipedia-Komponenten und Designklassen werden wiederverwendet, wo das ohne inhaltliche Kopplung möglich ist.
- Neue Oberflächen übernehmen exakt die bereits verwendeten Werte und Muster; es entsteht kein paralleles Designsystem.
- Die Änderung betrifft nur öffentliche Erreichbarkeit, Datenquelle, Informationshierarchie und Navigation.

## Öffentliche Seiten und Abgrenzung

### Öffentliche Bereiche

- `/peptipedia` – deutschsprachige Übersicht
- `/peptipedia/:slug` – deutschsprachiges Peptidprofil
- `/en/peptipedia` – englischsprachige Übersicht
- `/en/peptipedia/:slug` – englischsprachiges Peptidprofil

Die öffentlichen Routen liegen außerhalb von `ProtectedRoute`. Die bestehende persönliche App, My Stack, Gesundheitsdaten, Einnahmen und Simulationen bleiben vollständig geschützt.

### Bestehende interne Links

Aufrufe der bisherigen Pfade `/lab/library` und `/lab/library/:slug` werden auf die entsprechenden öffentlichen Peptipedia-Seiten weitergeleitet. Dadurch bleiben vorhandene Einstiege nutzbar und es gibt nur eine kanonische Detailseite pro Sprache.

### Nicht Teil dieser Version

- Community-Protokolle oder von Nutzern eingereichte Dosierungen
- individuelle Dosierempfehlungen oder automatisch erzeugte Zyklen
- Einkaufsmöglichkeiten, Produktanbieter oder Affiliate-Links
- Bewertungen, Kommentare oder soziale Funktionen
- mehr als Deutsch und Englisch
- eine inhaltliche Ausweitung über die bestehenden elf Peptide hinaus

## Detailseite: Informationshierarchie

### 1. Kopfbereich

Der Kopfbereich übernimmt die Informationsdichte und den Stil der bestehenden Peptidkarte:

- Kategorie
- Peptidname und vollständiger Name
- kurze, allgemein verständliche Erklärung aus dem vorhandenen `tldr`
- Forschungs- beziehungsweise Zulassungsstatus
- kompakte Einordnung der Human-Evidenz

Dieser Bereich bleibt sichtbar, bevor der Nutzer eine Detailrubrik wählen muss. Er enthält keine Dosierungsangaben.

### 2. Horizontale Tab-Leiste

Direkt unter dem Kopfbereich stehen in dieser Reihenfolge:

1. **Überblick**
2. **Wirkung**
3. **Studienprotokolle**
4. **Rechner**
5. **Sicherheit**
6. **Quellen**

Die Leiste ist horizontal scrollbar und auf Touch-Geräten wischbar. Tabs sind zusätzlich immer antippbar und per Tastatur bedienbar. Ein angeschnittener nächster Tab beziehungsweise eine dezente Verlaufskante macht weitere Einträge erkennbar, ohne einen neuen visuellen Stil einzuführen.

Beim vertikalen Scrollen haftet die Tab-Leiste unterhalb der vorhandenen Kopfzeile. Nur der aktive Reiter wird visuell hervorgehoben, mit dem bereits vorhandenen Peptipedia-Akzent. Bewegungen berücksichtigen `prefers-reduced-motion`.

Der aktive Tab wird als URL-Fragment abgebildet, zum Beispiel `/peptipedia/bpc-157#sicherheit`. Direkte Links, Neuladen sowie Vor- und Zurücknavigation stellen denselben Tab wieder her. Ohne Fragment ist **Überblick** aktiv.

### 3. Inhalte der Tabs

#### Überblick

- Peptidtyp und Einordnung
- kompakter Forschungsstand
- untersuchte Forschungsbereiche
- Zulassungsstatus
- Evidenzübersicht für Human-, Tier- und klinische Daten

#### Wirkung

- Wirkmechanismus in verständlicher Sprache
- untersuchte Wirkpfade und Forschungsbereiche
- Trennung zwischen beobachtetem Ergebnis und vermutetem Mechanismus
- bekannte Forschungslücken

#### Studienprotokolle

Es werden nur exakte, quellengebundene Protokolle aus zugelassenen Fachinformationen oder veröffentlichten Human-, Tier- beziehungsweise Laborstudien angezeigt. Jeder Eintrag nennt:

- Evidenztyp: zugelassene Fachinformation, Humanstudie, Tierstudie oder Laborstudie
- untersuchte Population beziehungsweise Modell
- Applikationsweg
- Menge und Einheit exakt wie in der Quelle
- Frequenz und Dauer exakt wie in der Quelle
- untersuchtes Ziel und wesentliches Ergebnis
- direkte Primärquelle

Tier- und Labormengen werden niemals auf Menschen umgerechnet. Studienprotokolle werden deutlich als Forschungsbeschreibung und nicht als Empfehlung gekennzeichnet. Wenn keine belastbare Quelle vorliegt, zeigt der Tab eine klare leere Darstellung statt einer abgeleiteten oder üblichen Community-Dosis.

#### Rechner

Der Rechner ist ausschließlich eine Rechenhilfe. Er verwendet eine vom Nutzer selbst eingegebene Zielmenge sowie Produkt- und Rekonstitutionsangaben. Er schlägt keine Zielmenge vor, befüllt keine Dosierung vor und erzeugt keinen Zyklus.

Die Ausgabe zeigt die reine mathematische Umrechnung und einen dauerhaft sichtbaren Hinweis, dass die Berechnung keine medizinische Empfehlung darstellt.

#### Sicherheit

- bekannte Nebenwirkungen und unerwünschte Ereignisse
- Kontraindikationen und relevante Risikogruppen, sofern belegt
- bekannte Wechselwirkungen sowie ausdrücklich benannte Datenlücken
- Zulassungs- und Behördenstatus
- klarer Hinweis auf nicht ausreichend untersuchte Langzeitrisiken

#### Quellen

- direkte Primärquellen statt allgemeiner Suchlinks als Standard
- Titel, Publikationsjahr und Quellentyp
- DOI-, PubMed-, Behörden- oder Fachinformationslink
- Datum der letzten redaktionellen Prüfung des Peptidprofils

## Inhaltliche Datenquelle

Öffentliche Peptipedia-Inhalte werden im Repository gespeichert und überprüfbar versioniert. Supabase ist nicht mehr die maßgebliche Quelle für öffentliche Profile.

Jedes Peptid erhält einen eigenständigen, strukturierten Inhaltseintrag pro Sprache. Ein gemeinsames Schema umfasst mindestens:

- Identität: Slug, Name, vollständiger Name, Kategorie
- Kurzbeschreibung und Überblick
- Forschungs- und Zulassungsstatus
- Evidenzstufen und Begründung
- Mechanismus und Forschungsbereiche
- Forschungslücken
- Sicherheitsinformationen
- strukturierte Studienprotokolle
- strukturierte Primärquellen
- Inhaltsversion und Datum der letzten Prüfung

Ein zentraler Index exportiert die elf veröffentlichten Einträge und bestimmt Reihenfolge sowie verfügbare Slugs. Die öffentliche Oberfläche liest synchron aus diesem Index und benötigt zum Anzeigen eines Profils weder Anmeldung noch Supabase-Verbindung.

Die bestehende `peptide_library`-Tabelle kann vorerst für interne Werkzeuge bestehen bleiben, ist aber weder Laufzeit-Fallback noch Veröffentlichungsquelle. Dadurch können abweichende oder veraltete Daten nicht unbemerkt öffentlich erscheinen.

## Vorabgenerierung und Suchmaschinen

Der Produktions-Build erzeugt für die Übersicht und jedes veröffentlichte Peptid vollständiges HTML in Deutsch und Englisch. Die Seiten funktionieren anschließend weiterhin als React-Oberfläche, aber Titel, Kurzbeschreibung, Hauptinhalt und Quellen sind bereits ohne clientseitigen Datenabruf im HTML enthalten.

Jede Seite erhält:

- eindeutigen Seitentitel und Meta-Beschreibung
- kanonische URL
- deutsche und englische Sprachreferenzen
- Open-Graph-Grunddaten
- öffentlich lesbaren Hauptinhalt
- einen Sitemap-Eintrag

Die Tab-Navigation ist nur die visuelle Aufteilung. Sämtliche Textinhalte aller Tabs werden beim Build in das öffentliche Dokument aufgenommen, damit Suche, Screenreader und direkte Links nicht von einem vorherigen Klick oder einem API-Aufruf abhängen.

## Komponenten und Verantwortlichkeiten

### Inhaltsmodell und Validierung

Eine kleine, eigenständige Content-Schicht definiert Typen, validiert Pflichtfelder und stellt den veröffentlichten Index bereit. Fehlerhafte Einträge stoppen den Build, statt unvollständige öffentliche Seiten zu erzeugen.

### Öffentliche Übersicht

Die Übersicht übernimmt Suche, Filterung und vorhandene Peptidkarten aus der aktuellen Peptipedia. Navigation und Admin-Verweise werden so angepasst, dass öffentliche Besucher keine internen Verwaltungswege sehen.

### Öffentliche Detailseite

Die Detailseite setzt sich aus vier klaren Teilen zusammen:

1. bestehende Zurücknavigation und Kopfbereich
2. wiederverwendete Kurzbeschreibung der Peptidkarte
3. eigenständige, haftende Tab-Navigation
4. thematisch getrennte Tab-Panels

Die Tab-Navigation kennt keine medizinischen Inhalte. Sie erhält lediglich Tab-Kennung, Beschriftung und Panel-Zuordnung. Die Inhaltskomponenten bleiben unabhängig davon testbar.

### Rechner

Berechnung und Darstellung werden getrennt. Die Rechenfunktion nimmt ausschließlich validierte Zahlen und Einheiten entgegen und liefert ein mathematisches Ergebnis. Sie enthält keine Peptid-Defaults und keine medizinischen Entscheidungsregeln.

### Build-Ausgabe

Ein Build-Schritt liest den veröffentlichten Content-Index, erzeugt die statischen Routen und ergänzt Metadaten sowie Sitemap. Die normale App-Build-Ausgabe und die PWA bleiben erhalten.

## Datenfluss

1. Ein redaktionell geprüfter Peptideintrag wird im Repository geändert.
2. Schema- und Quellenprüfungen laufen vor dem Produktions-Build.
3. Der Build generiert Übersichts- und Detailseiten für beide Sprachen.
4. Ein öffentlicher Besucher erhält sofort vorgerendertes HTML.
5. React aktiviert Suche, Tabs, URL-Fragmente und Rechner lokal im Browser.
6. Es findet kein Abruf persönlicher Daten und kein öffentlicher Peptidabruf aus Supabase statt.

## Fehler- und Leerzustände

- Unbekannte Slugs zeigen eine öffentliche 404-Darstellung mit Rückweg zur Peptipedia.
- Ein ungültiges URL-Fragment fällt auf **Überblick** zurück.
- Fehlende optionale Angaben werden ehrlich als „Keine belastbaren Daten verfügbar“ dargestellt; sie werden nicht geschätzt.
- Fehlende Pflichtangaben, ungültige Einheiten, unvollständige Quellen oder doppelte Slugs lassen den Build fehlschlagen.
- Der Rechner blockiert leere, negative, nicht endliche oder einheitenlogisch unvereinbare Eingaben mit verständlichen Feldhinweisen.
- Externe Quellen öffnen sicher mit `noopener` und bleiben als externe Ziele erkennbar.
- Der Ausfall von Supabase beeinflusst die öffentlichen Peptipedia-Seiten nicht.

## Barrierefreiheit und mobile Bedienung

- Semantische Tab-Rollen mit korrekter Verknüpfung zwischen Tab und Panel
- Bedienung per Tippen, horizontalem Wischen der Tab-Leiste und Tastatur
- Touch-Ziele von ungefähr 44 Pixeln Höhe
- sichtbarer Fokuszustand aus dem bestehenden Designsystem
- aktive Auswahl wird nicht ausschließlich über Farbe vermittelt
- haftende Leiste verdeckt weder Überschrift noch angesprungenen Inhalt
- Inhalte funktionieren ab 320 Pixel Breite ohne horizontales Seiten-Scrollen
- Screenreader erhalten die kurze Erklärung und anschließend die vollständige Themenstruktur

## Prüfung und Abnahmekriterien

### Automatisierte Prüfungen

- Schema-Tests für gültige und absichtlich fehlerhafte Inhaltseinträge
- Vollständigkeitstest für alle elf Slugs in Deutsch und Englisch
- Komponententests für Standardtab, Tabwechsel, URL-Fragmente und Tastaturbedienung
- Tests für unbekannte Slugs und fehlende optionale Inhalte
- reine Unit-Tests für Rechnerformeln, Rundung, Einheiten und ungültige Eingaben
- Routing-Test: Peptipedia ist ohne Anmeldung erreichbar; persönliche App-Routen bleiben geschützt
- Build-Test: alle öffentlichen Seiten, Metadaten und Sitemap-Dateien werden erzeugt

### Manuelle Abnahme

- Vergleich mit der aktuellen Peptipedia auf Mobilgerät und Desktop: keine unbeabsichtigte Änderung an Schrift, Farbe, Kartenstil, Schatten oder Abständen
- Tab-Leiste ist auf schmalen Geräten wischbar, antippbar und beim Scrollen haftend
- alle sechs Tabs sind erreichbar und zeigen die richtige Rubrik
- direkte Links auf einen Tab funktionieren nach Neuladen
- Seite bleibt ohne Supabase-Verbindung vollständig lesbar
- Deutsch und Englisch enthalten dieselben fachlichen Aussagen und Quellen
- `npm test`, `npm run lint` und `npm run build` laufen erfolgreich

## Veröffentlichungssicherheit

- Jede quantitative Angabe muss direkt einer Primärquelle zugeordnet sein.
- Zugelassene Fachinformationen, Humanstudien, Tierstudien und Laborstudien werden sichtbar voneinander unterschieden.
- Die Oberfläche formuliert keine individuelle Eignung, Zielmenge, Dauer oder Empfehlung.
- Änderungen an Protokollen, Sicherheitstexten oder Quellen sind über Git nachvollziehbar und erhöhen die Inhaltsversion beziehungsweise das Prüfdatum.
- Vor Veröffentlichung erfolgt eine manuelle fachliche Prüfung jedes der elf Profile.

## Erfolgskriterium

Ein nicht angemeldeter Nutzer kann ein Peptidprofil über eine öffentliche URL öffnen, das Peptid innerhalb weniger Sekunden verstehen und anschließend über die vertraute, horizontal wischbare Tab-Leiste gezielt zu Wirkung, Studienprotokollen, Rechner, Sicherheit oder Quellen wechseln. Dabei bleibt Peptipedia visuell erkennbar dieselbe Funktion wie heute, während alle öffentlichen Informationen nachvollziehbar, vorab generiert und unabhängig von Supabase verfügbar sind.
