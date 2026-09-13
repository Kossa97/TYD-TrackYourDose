# Substanzschritt — der Katalog zum Durchblättern

**Datum:** 2026-09-13
**Betrifft:** `SubstanceBrowser`, `katalogBlaettern`, `SubstanceSearch`, `StackItemWizard`
**Status:** umgesetzt

## Der Befund

Der Katalog ist in drei Wellen von 26 auf **182 Substanzen** gewachsen. Sichtbar
war davon nichts: das Suchfeld zeigt erst etwas, wenn jemand tippt.

Das trifft genau den Fall, für den der Katalog gebaut wurde — wer den Namen
kennt, tippt ihn ohnehin. Wer ihn *nicht* kennt („das Zeug fürs Knie", „der
Blutdrucksenker vom Hausarzt"), hatte keinen Weg. Für den blieb nur „Als eigene
Substanz hinzufügen", also ein Eintrag ohne PK-Profil, ohne Einheiten, ohne
Formvorschlag — die schlechteste aller verfügbaren Antworten.

## Die Entscheidungen

### Zugeklappt, mit Absicht

Der Substanzschritt ist der erste Eindruck des Formulars. Fünf Reiter plus
Liste plus Sprungleiste *über* dem Suchfeld wären mehr, als eine Frage verträgt.
Zugeklappt kostet das Ganze eine Zeile mit der Gesamtzahl (`182`) — und wer
tippen will, tippt einfach weiter.

Der Aufklapper erscheint nur, solange **nichts gewählt und nichts getippt** ist.
Wer schon sucht, will Treffer sehen, keine Liste daneben.

### Die Reiter sind die Kategorien

| Reiter | |
|---|---|
| Medikament | 69 |
| Supplement | 49 |
| Peptid | 39 |
| Vitamin | 14 |
| Hormon | 11 |

Die Zahl steht **am Reiter**. Ohne sie tippt man auf „Hormone", findet elf
Einträge und hält den Katalog für kaputt.

Die Kategorie ist hier kein zusätzliches Raster, sondern die, die die Substanz
ohnehin mitbringt: wer im Katalog wählt, hat das Kategoriefeld schon beantwortet.

### Das Kategoriefeld verschwindet bei einem Katalogtreffer

Vorher stand es als Pflichtfeld darunter — auch nachdem `catalog_selected` die
Kategorie längst gesetzt hatte. Ein Pflichtfeld, das bereits beantwortet ist,
fragt nichts, es prüft nur, ob man dieselbe Antwort ein zweites Mal gibt.
Bei freier Eingabe bleibt es, dort ist es die einzige Quelle.

### A–Z, Umlaute falten auf ihren Grundbuchstaben

`anfangsbuchstabe()` normalisiert über NFD und verwirft die kombinierenden
Zeichen: **Östradiol steht unter O**, nicht unter Ö und nicht unter `#`. Alles,
was nach dem Falten kein A–Z ist (Ziffern, `5-HTP`, `L-Carnitin` bleibt L),
sammelt sich unter `#` — und `#` steht am Ende, nicht vorn.

Leere Buchstaben werden nicht gezeigt.

### Die Sprungleiste ab 12 Einträgen

Die Liste ist rund 320 px hoch, ein Eintrag gut 50 — sichtbar sind also etwa
sechs. Erst ab dem Doppelten muss man wirklich scrollen; darunter ist Wischen
schneller als Zielen. Zweite Bedingung: mehr als drei Buchstabengruppen, sonst
ist die Leiste breiter als ihr Nutzen.

Sie zeigt nur Buchstaben, unter denen wirklich etwas steht. Einer, der ins Leere
springt, ist schlimmer als einer, der fehlt.

### Die Liste scrollt in sich

`max-h-80 overflow-y-auto overscroll-contain`. Sonst schöbe der Reiter mit 69
Einträgen alles darunter aus dem Bild und der Schritt hätte keinen Boden mehr.
`overscroll-contain` verhindert, dass das Weiterwischen am Listenende die Seite
darunter mitnimmt.

## Aufteilung

Das Gruppieren ist reine Rechnung und liegt deshalb außerhalb der Komponente:

| | |
|---|---|
| `lib/katalogBlaettern.ts` | `anfangsbuchstabe`, `nachKategorie`, `nachBuchstaben` — 10 Tests |
| `components/SubstanceBrowser.tsx` | Aufklapper, Reiter, Liste, Sprungleiste — 8 Tests |

`SubstanceSearch` bekam `allEntries?: SubstanceCatalogEntry[]` — **der ganze
Katalog zum Blättern, getrennt von `entries`, den Treffern zur Eingabe.** Zwei
Listen mit verschiedenen Aufgaben teilen sich keine Prop.

## Was bewusst fehlt

- **Keine Suche im Aufklapper.** Dafür ist das Feld darüber da.
- **Keine Filter jenseits der Kategorie** (Darreichungsform, „hat PK-Profil").
  Das wäre Recherchewerkzeug, nicht Auswahlhilfe.
- **Keine Sortierung nach Häufigkeit.** Solange niemand Nutzungszahlen hat,
  wäre jede Reihenfolge außer A–Z geraten.

## Verifikation

- `TZ=Europe/Berlin npx vitest run` — **1462 Tests grün** (141 Dateien), davon
  18 neu.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.
- `src/features/my-stack/lib/i18n.test.ts` — 32 grün, die beiden neuen Schlüssel
  `my_stack_browse_catalog` und `my_stack_jump_to_letter` in allen 14 Sprachen.
- Vorschau-Artefakt mit dem echten Katalog aus
  `scripts/substance-catalog-source.mjs`.
