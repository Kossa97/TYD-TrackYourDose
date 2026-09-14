# Kombi-Substanzen — Stufe 1: jede Zutat am Katalog

**Datum:** 2026-09-14
**Betrifft:** `IngredientCatalogPicker` (neu), `IngredientEditor`, `StackItemWizard`
**Status:** Stufe 1 umgesetzt; Stufe 2 und 3 offen

## Der Ausgangspunkt

Gefragt: „CJC-1295 ohne DAC + Ipamorelin", „Vitamin D3 K2" — geht sowas?

Nachgesehen: **das Datenmodell trägt schon immer mehrere Wirkstoffe je
Eintrag.** Der Inhaltsstoffe-Schritt sagt es wörtlich: *„Ein Kombipräparat
bekommt je Wirkstoff eine eigene Zeile."* Tabelle, Formular, Validierung und
Speichern können es.

Drei Dinge fehlten:

| | |
|---|---|
| 1 | Der Katalog kennt **keine** Kombis — von 182 Einträgen ist keiner einer |
| 2 | Nur die **erste** Zutat hängt am Katalog; jede weitere ist Freitext |
| 3 | Der Blutspiegel nimmt die **erste** Zutat mit Profil und zeigt eine Kurve |

Alle vier genannten Stoffe liegen einzeln im Katalog, `CJC-1295 ohne DAC` und
`Ipamorelin` samt PK-Profil.

## Stufe 1 (umgesetzt): jede Zeile hängt am Katalog

`IngredientEditor` setzte bei jedem Tastendruck in einer weiteren Zeile
`catalog_substance_id: null`. Der zweite Wirkstoff war damit **nur ein Wort** —
ohne Einheitenvorschläge, ohne PK-Profil, für den Blutspiegel unsichtbar.

Jede Zeile ab der zweiten bekommt jetzt ihre eigene Katalogsuche
(`IngredientCatalogPicker`): dieselbe Mechanik wie im Substanzschritt, nur
klein. Ab **zwei** Zeichen (ein Buchstabe trifft die halbe Datenbank), Treffer
über Name **und** Alias, höchstens sechs. Die Wahl steht danach sichtbar da —
samt Hinweis, ob ein PK-Profil dranhängt — bis man sie löst.

Die **erste** Zeile bleibt, wie sie war: sie ist die Substanz des Eintrags und
kommt aus dem Substanzschritt. Eine zweite Suche dort wäre dieselbe Frage ein
zweites Mal.

## Stufe 2 (offen): Kombis im Katalog

Einträge wie „CJC-1295 ohne DAC + Ipamorelin", die beim Auswählen **beide**
Zutatenzeilen füllen. Braucht ein Feld in `scripts/substance-catalog-source.mjs`
(die Bestandteile), eine Spalte in `substance_catalog` — also eine Migration
nach dem Verfahren in `CLAUDE.md` — und im Reducer ein `catalog_selected`, das
mehrere Zeilen anlegt statt einer.

## Stufe 3 (offen, mit einer offenen Frage): eine Kurve je Wirkstoff

Hier steckt eine Entscheidung, die Zahlen betrifft, auf die jemand hört.

`getCurrentBlutspiegelLevel` nimmt die Dosis aus dem **Zyklus** — eine Zahl je
Eintrag (`schedule.dose`, `schedule.unit`). Für eine Kombination braucht jeder
Wirkstoff **seine eigene** Dosis, und die steht nirgends direkt: sie müsste aus
der Stärke der Zutat (`amount_value` je `basis_value basis_unit`) mal der
geplanten Produktmenge gerechnet werden.

Das geht nur eindeutig, wenn klar ist, worin die Plan-Menge gemessen ist:

- **In Produkteinheiten** („1 Spritze", „1 Kapsel") → Dosis je Wirkstoff =
  Plan-Menge × Stärke. Sauber.
- **In Wirkstoffeinheiten** („250 mcg") → die Zahl gilt für *einen* Wirkstoff,
  und für den zweiten lässt sie sich nicht herleiten.

Der Planschritt lässt beides zu (`getIntakePlanUnitSuggestions` schlägt je nach
Form „mg" **oder** „capsule" vor). Bevor hier gerechnet wird, muss diese Frage
beantwortet sein — eine falsch hergeleitete Dosis wäre eine erfundene Zahl in
einer Gesundheits-App.

## Verifikation (Stufe 1)

- Sieben neue Tests: Vorschläge ab zwei Zeichen, Treffer über Alias, Schweigen
  bei einem Buchstaben, Verknüpfen mit Namen, die sichtbare Wahl samt
  PK-Hinweis, das Lösen, und dass die erste Zeile unangetastet bleibt.
- `TZ=Europe/Berlin npx vitest run` — **1509 Tests grün** (143 Dateien).
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.
