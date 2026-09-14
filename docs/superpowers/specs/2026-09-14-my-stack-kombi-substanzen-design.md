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

---

## Nachtrag: Stufe 3 umgesetzt — die Konzentration war der fehlende Schritt

Die offene Frage oben hat der Nutzer beantwortet, und zwar mit der Wirklichkeit:

> bei peptiden ist es beispielsweise so, das vial enthält 5mg cjc1295 no dac und
> 5mg ipamorelin, je nachdem wieviel an bac wasser hinzugefügt wird und
> anschließend einheiten aufgezogen werden hat man dann die menge an wirkstoff

Damit ist die Plan-Menge **ein Volumen**, keine Wirkstoffmenge — und die Dosis
je Wirkstoff folgt aus seiner eigenen Konzentration:

```
Vial:   5 mg CJC-1295 ohne DAC  +  10 mg Ipamorelin
      + 2 ml BAC-Wasser
      ⇒ 2,5 mg/ml CJC        und  5,0 mg/ml Ipamorelin

Plan:   0,2 ml aufgezogen
      ⇒ 0,5 mg CJC           und  1,0 mg Ipamorelin
```

### Das war schon für eine EINZELNE Substanz kaputt

`toPkMilligrams` kannte nur `mg`, `mcg` und `IU`. Wer sein Vial in **ml** oder
in **Spritzen** plante — also so, wie man es tatsächlich aufzieht — bekam
`unsupported`, und die Karte verschwand wortlos aus dem Karussell. Der
Planschritt bietet beide Einheiten an (`getIntakePlanUnitSuggestions` gibt für
ein Vial `syringe`, `mcg`, `mg`, `IU`, `vial`, `ml` aus).

Die Angaben dafür liegen längst vor: der Stärke-Schritt erfasst genau
„Wirkstoffmenge je Produktmenge", und beim aufgelösten Vial ist die
Produktmenge das Lösungsmittel in ml.

### Was jetzt gilt

`mgPerMlFromStrength(amount, amountUnit, basis, basisUnit)` rechnet die
Konzentration aus der Stärke **einer Zutat**. `toPkMilligrams` nimmt sie als
vierten Faktor und kann damit Milliliter. Und weil jede Zutat ihre eigene
Stärke trägt, fällt die Kombination als Sonderfall weg — sie ist derselbe
Rechenweg, zweimal.

Der Blutspiegel sammelt deshalb nicht mehr die **erste** Zutat mit Profil,
sondern **alle** (`linkedProfiles`), und rechnet je Zutat einen eigenen
Spiegel: eigene Konzentration, eigene Halbwertszeit, eigene Verfügbarkeit.
Die große Zahl gehört der ersten; die übrigen stehen darunter in je einer
Zeile mit Namen und Wert, damit die Karte keine Tabelle wird.

### Nebenbei aufgeräumt

`calculateHistoryBlutspiegelCurve` nahm sieben Argumente, das siebte war eine
nackte Zahl (`iuPerMg`). Mit `mgPerMl` wären es acht geworden. Beide Faktoren
stehen jetzt in einem `DoseUmrechnung`-Objekt — sie gehören ohnehin zusammen:
beides sind Angaben, die nicht der Kurve gehören, sondern der Substanz und
ihrer Zubereitung.

### Verifikation

- Neun neue Tests, darunter der Kombi-Fall mit zwei verschiedenen Stärken
  (5 mg und 10 mg in denselben 2 ml → 0,5 mg und 1,0 mg aus denselben 0,2 ml)
  und der Nachweis, dass ein in ml geplanter Zyklus vorher `unsupported` war
  und jetzt `ready` ist.
- Ohne Konzentration bleibt es bei `null` — „können wir nicht umrechnen", nicht
  „sind null Milligramm". Ein Test hält das fest.
- `TZ=Europe/Berlin npx vitest run` — **1518 Tests grün** (143 Dateien).
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.

### Was bleibt

Stufe 2 (fertige Kombi-Einträge im Katalog) ist offen — sie ist reine
Bequemlichkeit, seit Stufe 1 jede Zutat an den Katalog hängt.
