# Kategorie „Sonstiges"

**Datum:** 2026-09-13
**Betrifft:** `StackCategory`, `categories`, `dosageForms.strengthShapeFor`,
`SubstanceBrowser`, `stack_items_category_check`, `substance_catalog_default_category_check`
**Status:** umgesetzt, Migration eingespielt

## Der Befund

Der Katalog hat 182 Einträge und deckt trotzdem nicht alles ab. Wer seine
Substanz frei einträgt, musste sie in eines von fünf Fächern zwingen: Peptid,
Medikament, Hormon, Supplement, Vitamin.

Das ist keine Kosmetik. Die Kategorie ist im Formular ein **Schalter**, kein
Etikett: beim Vial entscheidet sie, ob nach einer Rekonstitution (10 mg auf
2 ml) oder nach einer fertigen Konzentration (250 mg pro 1 ml) gefragt wird.
Eine erzwungene Wahl ist also eine erzwungene *Behauptung*, und die App wertet
sie aus.

## Die Entscheidung

`other`, angezeigt als **„Sonstiges"**, als sechste und letzte Kategorie.

### Es trägt bewusst keine Aussage

```ts
if (category === null || category === 'other') return vorgabe
return category === 'peptide' ? 'reconstituted' : 'per_volume'
```

`other` fällt in denselben Zweig wie „noch nichts gewählt". Der naheliegende
Fehler wäre gewesen, es zum sechsten Fall zu machen und daraus `per_volume`
abzuleiten — aus „nicht Peptid" folgt aber nicht „fertig gelöst". Wer
„Sonstiges" wählt, sagt gerade, dass er es nicht weiß; die App darf daraus
nichts schließen.

Damit ist die Kategorie zum ersten Mal sauber in ihren zwei Rollen getrennt:
als **Etikett** hat sie jetzt sechs Werte, als **Schalter** weiterhin genau
einen Fall (Peptid ja/nein) plus „keine Angabe".

### Zuletzt in der Liste

Ein Auffangfach ganz oben ist eine Einladung, die anderen fünf nicht zu lesen.

### Nicht im Katalog

Ein kuratierter Katalogeintrag mit „Sonstiges" wäre keine ehrliche Antwort,
sondern eine Lücke — dann fehlt die Kategorie, nicht die Substanz. Der
Vertragstest (`substanceCatalogSource.test.ts`) leitet seine erlaubten
Kategorien jetzt aus `STACK_CATEGORIES` ab, statt sie ein zweites Mal
aufzuschreiben, und **nimmt `other` ausdrücklich aus**.

Folge für den Durchblättern-Katalog: „Sonstiges" hätte dort einen dauerhaft
leeren Reiter. Deshalb zeigt `SubstanceBrowser` nur noch Reiter, hinter denen
etwas steht — ein Reiter, der auf eine leere Liste führt, sieht aus wie ein
Fehler. Der aktive Reiter wird dabei **abgeleitet**, nicht nachgezogen:

```ts
const aktiveKategorie = sichtbar.some(o => o.key === kategorie)
  ? kategorie
  : sichtbar[0]?.key ?? kategorie
```

Ein Effekt, der den Zustand hinterher korrigiert, hätte für einen Bildwechsel
eine leere Liste gezeigt.

## Datenbank

Zwei CHECK-Constraints tragen die Liste ein zweites Mal, ein drittes Mal steht
sie in `public.save_stack_item`.

`supabase-my-stack-category-other.sql` erweitert die beiden Constraints —
additiv, keine Zeile wird geändert, zweimal laufen ist folgenlos. Die Liste
**in** der Funktion ist an ihrer Quelle ergänzt
(`supabase-my-stack-foundation.sql`, `supabase-my-stack-tracking-depth.sql`,
und der zugehörige Rollback): diese Funktion wird beim Einspielen des Schemas
ohnehin als Ganzes neu geschrieben, sie hier zu flicken hieße, etwas zu
überschreiben, das der nächste Schema-Lauf ersetzt.

### Trockenlauf

Postgres 16 lokal, Ist-Zustand der Produktion nachgestellt (Constraint-Namen
und -Definitionen wörtlich aus `pg_get_constraintdef()`, Zeilenzahlen
182 / 15):

| | vorher | nach Lauf 1 | nach Lauf 2 |
|---|---|---|---|
| `substance_catalog` | 182 | 182 | 182 |
| `stack_items` | 15 | 15 | 15 |
| `category = 'other'` erlaubt | nein | ja | ja |
| `category = 'quatsch'` erlaubt | nein | nein | nein |

### Produktion

Eingespielt. Nachgezählt: **182 Katalogzeilen, 15 stack_items — unverändert**,
beide Constraints tragen jetzt sechs Werte, `default_category = 'other'` und
`category = 'other'` je **0** Zeilen (erwartet: die Kategorie ist neu).

## Ein Befund nebenbei

Beim Lesen des Ist-Zustands: in der Produktion existiert **kein**
`save_stack_item_with_plan`, und `stack_items` hat **keine** Spalte
`tracking_level`. Das Schema dieses Branches (`supabase-my-stack-foundation.sql`,
`supabase-my-stack-tracking-depth.sql`) ist dort nie eingespielt worden —
angewendet wurden bisher nur Katalog und PK-Profile. Das My-Stack-Formular
dieses Branches kann gegen die Produktivdatenbank also noch gar nicht
speichern. Das ist kein Fehler dieser Änderung, muss aber vor dem Release
passieren.

## Verifikation

- `TZ=Europe/Berlin npx vitest run` — **1464 Tests grün** (141 Dateien), 2 neu.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.
- `stack_category_other` in allen 14 Sprachen; Wortlaut geprüft nur für
  `de` („Sonstiges") und `en` („Other").
