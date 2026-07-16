# Blutwerte-Feinschliff – Design

**Datum:** 2026-07-17
**Feature:** Blutwerte (`src/pages/Blutwerte.tsx` → `src/features/blutwerte/`)
**Status:** Design abgenommen, bereit für Implementierungsplan

## Ziel

Das bestehende Blutwerte-Feature um drei Kernfähigkeiten erweitern:

1. **Intelligenter Import** – Laborbefund abfotografieren oder als PDF hochladen, KI erkennt die Werte automatisch.
2. **Verständlichkeit** – jeder Blutwert wird für Laien erklärt, der Referenzbereich wird deutlich angezeigt.
3. **Filtern & Sortieren** – Blutwerte nach Kategorie und weiteren Kriterien sortier- und filterbar.

Zusatzumfang (in diesem Feinschliff): Befund-Gruppierung, Auffällige-Werte-Sektion, PDF-Upload.
Bewusst später: Zyklus-Kontext im Chart, CSV/PDF-Export.

## Ausgangslage

- `src/pages/Blutwerte.tsx` (~560 Zeilen), Supabase-Tabelle `bloodwork` (`tested_at, marker, value, unit, notes`).
- 15 hardcodierte Marker (`ALL_MARKERS`), 11 mit hardcodierten Referenzbereichen (`REFERENCE_RANGES`).
- Marker-Grid → Marker-Detail (Chart mit Referenz-Zone, Zeitraumfilter) → manuelles Eingabe-Modal.
- Bestehende Muster im Repo: Supabase Edge Function `pubmed` (Deno.serve, CORS), Storage-Buckets, Feature-Struktur `src/features/fortschritt/` (Components + `lib/` mit getesteten Pure Functions).

## Entscheidungen (abgenommen)

| Thema | Entscheidung |
|---|---|
| KI-Extraktion | Claude Vision (**Haiku 4.5**) via Supabase Edge Function |
| Kostenkontrolle | Rate-Limit 10 Importe/Monat pro User + clientseitige Bildverkleinerung |
| Unbekannte Marker | Großer Katalog (~60) **+** Custom-Marker: unbekannte Werte werden trotzdem gespeichert, nur ohne Erklärung/Kategorie |
| Referenzbereiche | **Labor-Referenz bevorzugen**, Fallback Katalog-Standard, sonst „kein Referenzbereich" |
| Markerkatalog | TypeScript-Modul im Frontend (`lib/markerCatalog.ts`), versioniert in Git |
| Hochgeladene Datei | Nur zur Extraktion, danach **nicht** gespeichert (Datenschutz, keine Storage-Kosten) |

## Architektur

### Struktur-Refactoring (Voraussetzung)

`Blutwerte.tsx` würde mit den neuen Features zu groß. Aufteilen nach dem Muster von `src/features/fortschritt/`:

```
src/features/blutwerte/
  BlutwertePage.tsx        # Orchestrierung, Daten-Laden, Routing der Sub-Views
  components/
    MarkerGrid.tsx         # Übersichts-Grid + Kategorie-Chips + Sortierung
    AuffaelligeWerte.tsx   # Sektion "Auffällige Werte" oben
    MarkerDetail.tsx       # Detailansicht: Hero, Erklärung, Referenzbalken, Chart, Liste
    ReferenceBar.tsx       # Visueller Referenzbalken (Skala + aktueller Wert)
    EntryModal.tsx         # Manuelles Eingabe-Modal (bestehend, extrahiert)
    import/
      ImportFlow.tsx       # Upload → Extraktion → Review → Speichern
      ReviewTable.tsx      # Editierbare Tabelle der erkannten Werte
    BefundListe.tsx        # Liste der Befunde (gruppierte Termine)
  lib/
    markerCatalog.ts       # Katalog-Daten + Normalisierung
    bloodwork.ts           # Pure Functions: Trend, effektive Referenz, In-Range, Filter, Sortierung
    imageResize.ts         # Clientseitige Bildverkleinerung (Canvas)
    extractResult.ts       # Typen + Validierung der Edge-Function-Antwort
  types.ts
```

`src/pages/Blutwerte.tsx` wird zu einem dünnen Re-Export von `BlutwertePage`, damit bestehende Routen unverändert bleiben.

### Markerkatalog (`lib/markerCatalog.ts`)

~60 gängige Marker. Pro Eintrag:

```ts
interface MarkerDef {
  name: string            // kanonischer Name, z.B. "Testosteron"
  synonyme: string[]      // z.B. ["Testosteron gesamt", "Gesamttestosteron", "Testo"]
  kategorie: Kategorie
  einheit: string         // Standard-Einheit
  refMin?: number
  refMax?: number
  lowerIsBetter?: boolean // für Trend-Farbe (z.B. CRP)
  erklaerung: string      // 2–3 Sätze Laiendeutsch: was der Wert bedeutet, wann relevant
}

type Kategorie =
  | 'Hormone' | 'Schilddrüse' | 'Blutbild' | 'Leber' | 'Niere'
  | 'Lipide' | 'Entzündung' | 'Vitamine & Mineralstoffe' | 'Stoffwechsel'
```

Die bestehenden 15 Marker gehen im Katalog auf. `REFERENCE_RANGES` und `ALL_MARKERS` werden entfernt.

**Normalisierung:** `normalizeMarker(raw): MarkerDef | null` – matcht case-insensitiv gegen `name` und `synonyme`. Kein Treffer → Custom-Marker (Rohname bleibt erhalten, keine Kategorie/Erklärung).

### Datenbank

Neue Tabelle `bloodwork_reports`:

| Spalte | Typ | Notiz |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | RLS wie `bloodwork` |
| tested_at | date | Testdatum des Befunds |
| lab_name | text null | erkanntes Labor |
| source | text | `'manual'` \| `'import'` |
| created_at | timestamptz | für Rate-Limit-Zählung |

`bloodwork` wird erweitert:

| Spalte | Typ | Notiz |
|---|---|---|
| report_id | uuid null FK → bloodwork_reports | gruppiert Werte eines Termins |
| ref_min | numeric null | Labor-Referenz-Untergrenze |
| ref_max | numeric null | Labor-Referenz-Obergrenze |

Migration als neue SQL-Datei im bestehenden Migrations-Verzeichnis. Bestehende Einträge behalten `report_id = null` (Einzelwerte ohne Befund) und funktionieren unverändert.

**Effektive Referenz (überall gleich, in `lib/bloodwork.ts`):**
`ref_min/ref_max` am Eintrag → sonst Katalog-`refMin/refMax` → sonst „kein Referenzbereich".

**Rate-Limit-Zählung** (keine Extra-Tabelle):
`count(*) from bloodwork_reports where user_id = ? and source = 'import' and created_at > now() - interval '30 days'`.

### Edge Function `bloodwork-extract`

- Muster: `supabase/functions/pubmed/index.ts` (Deno.serve, CORS-Header, POST/OPTIONS).
- **Auth:** Supabase JWT aus dem `Authorization`-Header, `user_id` daraus ableiten (Service-Role-Client für DB-Check).
- **Input:** `{ file: string /* base64 */, mimeType: string }` – erlaubt: `image/jpeg|png|webp`, `application/pdf`.
- **Ablauf:**
  1. Rate-Limit prüfen → bei Überschreitung `429` mit `{ error: 'rate_limit', resetsAt }`.
  2. Claude **Haiku 4.5** aufrufen (Vision für Bilder, Document-Block für PDF) mit Markerliste (Namen aus dem Katalog) im Prompt, strikter JSON-Output erzwungen.
  3. Antwort gegen Schema validieren, unplausible Einträge verwerfen.
- **Output:**
  ```json
  {
    "tested_at": "2026-07-10",
    "lab_name": "Labor XY",
    "values": [
      { "marker": "Testosteron", "matched": true, "value": 620, "unit": "ng/dL", "ref_min": 300, "ref_max": 1000 },
      { "marker": "GPT (ALT)", "matched": false, "value": 34, "unit": "U/L", "ref_min": null, "ref_max": 45 }
    ]
  }
  ```
- `matched` = ob der Marker im Katalog gefunden wurde (Server-seitig via `normalizeMarker` gesetzt).
- **Secret:** `ANTHROPIC_API_KEY` als Supabase-Secret.
- **Prompt-Regeln:** Unleserliche/mehrdeutige Werte weglassen statt raten; Einheiten und Labor-Referenzbereiche mit übernehmen; nur numerische Laborwerte, kein Freitext/Befundinterpretation.

### Import-Flow (`components/import/ImportFlow.tsx`)

1. Button **„Befund importieren"** auf der Übersicht → Foto aufnehmen (`capture`) oder Datei wählen (Bild/PDF).
2. Bilder clientseitig auf max. **1568 px** längste Kante verkleinern (`lib/imageResize.ts`, Canvas → JPEG base64). PDFs unverändert.
3. POST an `bloodwork-extract`, Ladeindikator.
4. **Review-Screen** (`ReviewTable.tsx`):
   - Datum + Labor editierbar.
   - Tabelle aller erkannten Werte: Marker, Wert, Einheit, Referenz – alle editierbar; jede Zeile per Checkbox abwählbar; Katalog-Treffer visuell markiert, Custom-Marker gekennzeichnet.
   - Nutzer bestätigt bewusst – die KI liefert nur Vorschläge.
5. **„Übernehmen"** → ein `bloodwork_reports`-Insert (`source='import'`) + Batch-Insert der ausgewählten `bloodwork`-Zeilen mit `report_id`, `ref_min`, `ref_max`.
6. Original-Datei wird **nirgends** gespeichert.

**Fehlerzustände:**
- Extraktion fehlgeschlagen / kein Laborbefund erkennbar → verständliche Meldung + „Manuell eingeben" als Fallback.
- Rate-Limit → Meldung mit Datum, ab wann wieder möglich.

### Übersichts-Seite (`MarkerGrid.tsx` + `AuffaelligeWerte.tsx`)

- **Auffällige Werte** (oben, nur wenn vorhanden): alle Marker, deren letzter Wert außerhalb der effektiven Referenz liegt – rot, mit Wert + Referenz, klickbar zum Detail.
- **Kategorie-Chips:** `Alle · Hormone · Schilddrüse · Blutbild · Leber · Niere · Lipide · Entzündung · Vitamine & Mineralstoffe · Stoffwechsel · Sonstige`. Filtert das Grid.
- **Grid:** gruppiert nach Kategorie mit Zwischenüberschriften. Custom-Marker unter „Sonstige". Ungetestete Katalog-Marker bleiben ausgegraut (wie heute).
- **Sortierung:** Kategorie (Standard) · Name · Zuletzt getestet · Status (auffällige zuerst).
- Mini-Stats (Einträge gesamt, Marker getestet, letzter Test) bleiben.

### Marker-Detail (`MarkerDetail.tsx`)

- **„Was ist das?"**-Block mit Katalog-Erklärung. Custom-Marker: Hinweis, dass keine Erklärung hinterlegt ist.
- **Referenzbalken** (`ReferenceBar.tsx`): horizontale Skala mit grüner Zone (effektive Referenz) und Punkt für den aktuellen Wert – deutlicher als die reine Textzeile. Textzeile bleibt als Ergänzung.
- Chart-`ReferenceArea` nutzt die effektive Referenz (Labor > Katalog).
- Hero, Trend, Zeitraumfilter, Einträge-Liste bleiben; Einträge zeigen ggf. Labor/Befund-Kontext.

### Befund-Ansicht (`BefundListe.tsx`)

- Liste der Befunde (ein Eintrag pro `bloodwork_reports`): Datum, Labor, Anzahl Werte, wie viele auffällig.
- Klick → Detail des Befunds mit allen Werten dieses Termins.
- Erreichbar über einen Tab/Umschalter auf der Blutwerte-Seite (Marker-Ansicht ↔ Befund-Ansicht).

## Medizinischer Disclaimer

„Diese Angaben dienen der Orientierung und ersetzen keine ärztliche Beratung." – sichtbar auf der Übersichtsseite und unter jeder Marker-Erklärung. Pflicht, da das Feature Laborwerte interpretiert.

## Tests

Pure Functions in `lib/` via Vitest (Muster: `src/features/fortschritt/lib/*.test.ts`):

- `markerCatalog`: Normalisierung inkl. Synonyme, Custom-Marker-Fall.
- `bloodwork`: effektive Referenz-Auflösung, In-Range, Trend, Filter (Kategorie), Sortierung (alle Modi), Auffällige-Werte-Ableitung.
- `extractResult`: Validierung/Parsing der Claude-JSON-Antwort (gültig, teilweise ungültig, Müll).
- `imageResize`: Grenzfälle (Bild kleiner als Grenze → unverändert).

Edge-Function-Logik (Rate-Limit-Query, Prompt-Bau, Antwort-Validierung) als reine Funktionen ausgelagert und getestet, soweit ohne Deno-Runtime möglich.

UI-Verifikation über den Dev-Server (Import-Flow mit Beispielbild, Review-Screen, Filter/Sortierung, Detailansicht).

## Nicht in diesem Umfang (YAGNI)

- Zyklus-Kontext im Marker-Chart (eigenes Folgeprojekt).
- CSV/PDF-Export für Arztgespräche.
- Geschlechts-/altersabhängige Katalog-Referenzen (Labor-Referenz deckt den Hauptfall ab).
- Speichern der Original-Datei / Admin-UI für den Katalog.
- Premium-Gating des Imports (Rate-Limit reicht vorerst).
