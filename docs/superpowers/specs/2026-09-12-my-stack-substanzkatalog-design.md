# My Stack — Substanzkatalog, Welle 1: Fundament und Ernte

**Datum:** 2026-09-12
**Betrifft:** `scripts/substance-catalog-source.mjs`, `scripts/generate-substance-catalog-sql.mjs`, `supabase-my-stack-catalog-expansion.sql`
**Status:** umgesetzt (SQL noch auszuführen)

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

## Auszuführen

`supabase-my-stack-catalog-expansion.sql` im Supabase-SQL-Editor (dort greift
RLS nicht; seit `supabase-rls-hardening.sql` ist das der einzige Weg,
Katalogzeilen zu schreiben).

## Geprüft

Generator zweimal gelaufen, byte-gleiches Ergebnis. Suche in der Vorschau:
„Semaglutide", „Ozempic" und „Semaglutid" finden denselben Eintrag; „Test E"
findet Testosteron Enantat, „Wachstumshormon" findet HGH.
