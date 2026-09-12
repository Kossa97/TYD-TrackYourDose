# My Stack — Substanzkatalog, Welle 1: Fundament und Ernte

**Datum:** 2026-09-12
**Betrifft:** `scripts/substance-catalog-source.mjs`, `scripts/generate-substance-catalog-sql.mjs`, `supabase-my-stack-catalog-expansion.sql`
**Status:** umgesetzt und eingespielt

## Der Bestand, bevor etwas passierte

| | |
|---|---|
| Substanzen mit Darreichungsform | **20** |
| davon mit gefüllten `suggested_units` | **0** — das Feld wurde nie befüllt |
| PK-Profile in `pk_profiles` | **44** |
| PK-Profile **ohne** Katalogeintrag | **30** |

Der Seed importierte `peptide_library` (11 Peptide) und neun handgesetzte
Zeilen. Die 44 Profile aus `scripts/seed-pk-profiles.ts` — Retatrutid,
Tesamorelin, MK-677, PT-141, Melanotan II, HCG, IGF-1 LR3, HGH, Semax,
Testosteron Cypionat, Liraglutid, GHRP-6, Hexarelin, MOTS-c, AOD-9604, DSIP,
Kisspeptin-10, Cerebrolysin, SS-31, KPV … — standen nicht im Katalog. Die App
kannte ihre Pharmakokinetik, aber man konnte sie nicht auswählen.

## Was ein Katalogeintrag ist

Eine **Tippersparnis, kein Nachschlagewerk**: Name, Aliase, Kategorie, übliche
Darreichungsformen, übliche Einheiten. Nichts weiter.

Dosierungen, Wirkungen, Nebenwirkungen gehören **nicht** hinein — die liegen in
`peptide_library` und in den PK-Profilen und bleiben dort. Genau diese Trennung
macht einen Eintrag billig: Wer eine Substanz in den Katalog schreibt, behauptet
nichts Medizinisches, sondern nur, unter welchem Namen man sie sucht. Deshalb
sind Hunderte Einträge machbar.

## Die Aliase sind der Klebstoff

Der Katalog schrieb „Semaglutid", das PK-Profil „Semaglutide". Die Verknüpfung
läuft über Name **oder** Alias — ohne den Alias finden sich die beiden nie, und
wer den englischen Namen tippt, findet gar nichts.

Daraus die Regel, die ein Test festhält: **deutscher Name vorn, englische
Schreibweise als erster Alias, Handelsnamen dahinter.** Semaglutid trägt
Semaglutide, Ozempic, Wegovy, Rybelsus; HGH trägt Somatropin, Human Growth
Hormone, Wachstumshormon.

## Quelle statt SQL-Blob

Der Katalog wuchs bisher durch handgeschriebene SQL-Dateien, die jemand in den
Supabase-Editor einfügte. Nicht diffbar, nicht testbar, keine Doppelprüfung.

Jetzt wie bei den Übersetzungen: eine **versionierte Quelldatei**
(`scripts/substance-catalog-source.mjs`), aus der ein Generator die Migration
erzeugt (`npm run catalog:sql`). Die SQL-Datei trägt einen Kopf, der sagt, dass
sie generiert ist; zweimal ausgeführt ändert der zweite Lauf nichts.

Der Upsert trifft den bestehenden Unique-Index
`substance_catalog_canonical_name_idx` auf `lower(canonical_name)`: bekannte
Zeilen werden aktualisiert, neue angelegt, keine doppelt. `pk_profile_id` wird
mit `coalesce` gesetzt — eine bestehende Verknüpfung wird ergänzt, nie gelöscht.

**Keine Schemaänderung.** Alle fünf Felder existieren; `suggested_units` wird
zum ersten Mal befüllt.

## Ergebnis dieser Welle

**52 Substanzen** (von 20), jede mit Formen und Einheiten, alle 44 PK-Profile
geerntet. Jede Darreichungsform außer `other` hat mindestens eine Substanz —
`other` ist der Auffangkorb für alles, was die Liste nicht kennt, kein Produkt,
das jemand kauft.

Die Einheiten sind nicht geraten: sie müssen zu einer der genannten Formen
passen (`DOSAGE_FORMS[].suggestedUnits`), sonst schlägt der Test an. „g" bei
einem Vial wäre kein Tippfehler, den man sieht — die Form bietet die Einheit
gar nicht an, und der Vorschlag liefe ins Leere.

## Der Vertrag

`src/features/my-stack/lib/substanceCatalogSource.test.ts` — acht Fälle. Daten
werden durch Abschreiben falsch, nicht durch Denkfehler; nichts davon fängt ein
Typ ab:

- kein Name und kein Alias doppelt, auch nicht über Einträge hinweg
- gültige Kategorie, gültige Formen, keine Form doppelt, kein Eintrag ohne Form
- jede Einheit passt zu einer der genannten Formen
- jeder `pkProfile`-Name existiert wirklich (ein Tippfehler bricht nichts — die
  Unterabfrage findet still nichts, und die Substanz hat kein Profil mehr)
- jeder eingedeutschte Name führt die englische Schreibweise als Alias
- **jede Darreichungsform hat mindestens eine Substanz** — die Lückenanzeige
  für Welle 2: schlägt sie fehl, nennt sie die Form beim Namen
- **jedes PK-Profil hat einen Katalogeintrag** — der Befund, mit dem diese
  Welle anfing, als Test festgehalten

## Was als Nächstes kommt

**Welle 2 — je Darreichungsform auffüllen, nicht alphabetisch.** Pro Form
15–30 Substanzen, die man realistisch so trackt, zuerst dort, wo die App heute
am schwächsten ist: Tablette und Kapsel (Vitamine, Mineralien, Medikamente,
Alltagssupplemente), dann Tropfen, Spray, Gel, Pflaster. Ziel ~250 Einträge.

**Welle 3 — der Nutzer als Quelle.** Wer heute eine eigene Substanz anlegt, tut
das ins Leere. Ein aggregierter Blick auf häufig selbst angelegte Namen sagt,
was als Nächstes in den Katalog gehört. Produkt- und Datenschutzfrage, kein
Code-Detail.

**Offen:** die fünf Kategorien. Seit dem Stärke-Schritt steuern sie echtes
Verhalten (ob ein Vial rekonstituiert wird). Für „alles tracken" müsste Zink
unter „supplement" fallen oder es bräuchte „Mineral". Mehr Schubladen heißen
mehr Regeln — bis auf Weiteres bleibt es bei fünf und großzügiger Einsortierung.

## Eingespielt am 2026-09-12

Über den Supabase-Connector, nach der Reihenfolge aus `CLAUDE.md`.

**Der erste Trockenlauf war wertlos** — er lief gegen einen *angenommenen*
Ist-Zustand (die 20 Zeilen aus den Repo-SQL-Dateien). Die echte Datenbank hatte
**26**, und zwei davon hätten Doppeleinträge erzeugt:

| in der Datenbank | in der Quelldatei | ohne Korrektur |
|---|---|---|
| `Retatrutide` | `Retatrutid` | zwei Zeilen |
| `Melanotan II (MT2)` | `Melanotan II` | zwei Zeilen |

Daraus das Feld **`renameFrom`**: der Generator setzt vor den Upsert ein
`update canonical_name`, sodass die bestehende Zeile ihre `id` behält — und
damit alle Verweise aus `stack_item_ingredients.catalog_substance_id`. Eine
`not exists`-Bedingung schützt vor einer Unique-Verletzung, falls die
Umbenennung schon gelaufen ist.

Die Lehre für alles Weitere: **erst lesen, dann den Trockenlauf aufsetzen.**
Der Ist-Zustand steht in der Datenbank, nicht in den Migrationsdateien.

Weitere Funde beim Lesen:

- Die bisherigen `aliases` waren **Beschreibungen**, keine Suchbegriffe — bei
  Tesamorelin der vollständige IUPAC-Name. Sie wurden ersetzt.
- Vier Zeilen trugen den toten Formschlüssel **`liquid`** (GHK-Cu, Magnesium,
  Metformin, Omega-3), den die App seit `supabase-my-stack-drop-liquid.sql`
  nicht mehr kennt. Jetzt nirgends mehr.
- **`SLU-PP-332`** steht im Katalog und nicht in der Quelldatei. Der Upsert
  löscht nichts, also blieb die Zeile unberührt — sie ist die eine ohne Form
  und ohne Einheiten. Sie gehört in Welle 2, sobald jemand ihre üblichen
  Darreichungsformen benennt.

**Ergebnis, gemessen nach dem Lauf:**

| | vorher | nachher |
|---|---|---|
| Substanzen | 26 | **53** |
| ohne Einheiten | 26 | **1** (SLU-PP-332) |
| ohne Darreichungsform | 6 | **1** (SLU-PP-332) |
| mit PK-Profil | 12 | **44** |
| doppelte Namen | — | **0** |
| toter Formschlüssel `liquid` | 4 | **0** |
| verwaiste Katalogverweise | — | **0** |

## Rückweg

`backups/substance_catalog-2026-09-12.sql` — der Stand der 26 Zeilen vor dem
Lauf, mit ihren echten `id`s. Die Datei setzt genau diese Zeilen zurück, löscht
nichts und lässt alles Spätere stehen. Sie entstand, weil das Projekt keine
Backups führt; für Welle 2 wird dieselbe Aufnahme vorher wieder gemacht.

## Geprüft

Generator zweimal gelaufen, byte-gleiches Ergebnis. Suche in der Vorschau:
„Semaglutide", „Ozempic" und „Semaglutid" finden denselben Eintrag; „Test E"
findet Testosteron Enantat, „Wachstumshormon" findet HGH.


---

## Welle 2a und die PK-Profile — eingespielt am 2026-09-12

**90 Substanzen** für Tablette und Kapsel (53 → 143): 12 Vitamine, 10
Mineralien, 12 Aminosäuren und Alltagssupplemente, 14 pflanzliche und
Longevity-Stoffe, 38 Medikamente, 4 Hormone in Stückform. Handelsnamen als
Aliase, damit die Suche sie findet.

Keine sechste Kategorie. Die Kategorie tut in der App genau zwei Dinge: sie
entscheidet beim Vial über die Rekonstitution und steht als Zeile in der
Zusammenfassung. Zink verhält sich in einer Kapsel wie Magnesium — eine
Schublade „Mineral" wäre eine Regel mehr ohne Gegenwert.

### 49 PK-Profile für den Live-Blutspiegel

Von 143 Substanzen hatten 99 keines. Die Kurve braucht drei Zahlen:
Halbwertszeit, tmax, Peak-Skalierung. Dazugekommen sind 39 Medikamente, 4
Hormone und 6 Supplemente.

**Bewusst ausgelassen, und als Test festgehalten** (`substanceCatalogSource.test.ts`):
Vitamine und Mineralien — ein Blutspiegel von Zink nach Einzeldosis beschreibt
nichts, das sind Speicher. Pflanzenextrakte mit schwankender Bioverfügbarkeit
(Ashwagandha, Kurkuma, Rhodiola, Ginkgo, Mariendistel, Baldrian) — die Werte
hängen am Extrakt, nicht am Stoff. Creatin, Kollagen, Aminosäuren, Whey —
ihr Nutzen hängt an der Sättigung von Speichern.

### Was die Selbstprüfung fand

Vier Fehler, alle vor dem Einspielen gefunden, keiner durch einen Test, den es
schon gab — sondern durch eine Abfrage gegen die eigenen Zahlen:

| | Befund | Korrektur |
|---|---|---|
| **ASS** | tmax 0,5 h über einer Halbwertszeit von 0,33 h — die Kurve wäre gefallen, bevor sie stand | Werte des Salicylats: 3 h / 1 h |
| **Ramipril** | Notiz nannte Ramiprilat, tmax war das der Muttersubstanz | tmax 1 h → 3 h |
| **Pregnenolon** | tmax gleich der Halbwertszeit — geraten, nicht gemessen | tmax 1,5 h → 1 h |
| **Berberin** | Bioverfügbarkeit unter 1 %, Halbwertszeit zwischen 4 und über 20 Stunden berichtet, Wirkort teils im Darm | **gestrichen** — genau der Fall, den wir auslassen wollten |

Daraus ein neuer Test: **tmax ab der Halbwertszeit ist nur für vier namentlich
genannte Fälle erlaubt** — Pantoprazol und Omeprazol (magensaftresistent, die
Aufnahme beginnt erst im Darm), Amoxicillin (Aufnahme und Ausscheidung fast
gleich schnell) und Melatonin (beides bei rund 45 Minuten). Ein fünfter
zwingt den, der ihn einträgt, zur Begründung.

### Gemessen nach dem Lauf

| | vorher | nachher |
|---|---|---|
| Substanzen | 53 | **143** |
| PK-Profile | 44 | **93** |
| Substanzen mit Profil | 44 | **93** |
| Profile ohne Substanz | — | **0** |
| unplausible Werte | — | **0** |
| verwaiste Katalogverweise | — | **0** |

Die 50 ohne Profil sind es absichtlich: 33 Supplemente, 14 Vitamine,
SLU-PP-332, und das generische „Testosteron" — ohne Ester hat es keine eine
Halbwertszeit.

### Bekannte Grenze, nicht Teil dieser Runde

`toPkMilligrams` in `src/features/my-stack/lib/pkReadiness.ts` rechnet nur `mg`
und `mcg` um. Alles in **IU** — HCG und HGH — hat ein PK-Profil, dessen Kurve
still ins Leere läuft. Das ist ein Fehler im Code, kein Datenproblem.
