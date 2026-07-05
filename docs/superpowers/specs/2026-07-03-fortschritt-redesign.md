# Fortschritt Redesign — Design Spec

**Datum:** 2026-07-03  
**Status:** Approved (Planung abgeschlossen, Umsetzung gestartet)

---

## 1. Ziel

Fortschritt und Protokoll werden zu **einem Feature** zusammengeführt. Protokoll (`/protokoll`) fällt langfristig weg; Analytics, tägliche Erfassung und Kontext zu Substanzen leben unter **Fortschritt** (`/progress`). Ein separater PDF-Generator kommt später als eigenständiges Modul.

**Produktthese:** Fortschritt ist der tägliche Spiegel des Körpers im Substanz-Kontext — nicht ein zweites Analytics-Dashboard wie das alte Protokoll.

---

## 2. Abgrenzung zum alten Protokoll

| Protokoll (entfällt) | Fortschritt (neu) |
|----------------------|-------------------|
| KPI-Streifen, Presets, Dual-Charts (%Δ + Small Multiples) | Übersicht mit Zahlen + eine Timeline-Story |
| 15 Marker gleichzeitig | Max. 2 Metriken im Verlauf |
| Insights (Nebenwirkungen/Reviews) | Bleiben in Tagebuch |
| PDF/Share im Header | PDF später separat |
| Monolith 1.300+ Zeilen | Feature-Modul `src/features/fortschritt/` |

---

## 3. Tab-Struktur

```
[ Übersicht ]  [ Verlauf ]  [ Fotos ]  [ Labs ]
```

| Tab | Rolle |
|-----|-------|
| **Übersicht** | Einstieg — Substanzen, Top-Veränderungen, Karten |
| **Verlauf** | Substanz-Schiene + Metrik-Chart + Ereignisse |
| **Fotos** | Eigener Tab (Details später) |
| **Labs** | Blutwerte kompakt |
| **+ Heute** | Sticky — Wellness, Gewicht, Foto (Bottom Sheet) |

---

## 4. Übersicht (Wireframe 1)

### Header

- Titel: Fortschritt
- Subtitle: `Seit {datum} · {n} Zyklen · {m} dauerhaft` (oder Fallback)
- `+ Heute` rechts, sticky

### Sektion: Aktive Substanzen

- Zyklen: gefüllter Dot, `Tag X · bis DD.MM` oder `· offen`
- Dauerhaft: Outline-Dot, `seit X Tagen`
- Divider `── dauerhaft ──` nur wenn beides vorhanden
- Tap → Verlauf, Substanz fokussiert
- > 5 Einträge: „Alle anzeigen"

### Sektion: Größte Veränderungen

- **Dynamisch, max. 3**
- Mindestens 3 Datenpunkte pro Metrik
- Schwellen: Gewicht ≥ 0.3 kg, Wellness ≥ 0.5, Labs sinnvoll
- 0 Treffer: „Noch zu wenig Daten"
- Stabil: „Alles stabil im Zeitraum"
- Tap → Verlauf mit dieser Metrik

### Karten (nur bei Daten)

Reihenfolge: Gewicht → Wellness → Adherence → Labs → Fotos → KFA

| Karte | Tap-Ziel |
|-------|----------|
| Gewicht | Verlauf · Gewicht |
| Wellness | Verlauf · stärkster Slider |
| Adherence | Verlauf |
| Labs | Tab Labs |
| Fotos | Tab Fotos |
| KFA | Verlauf · KFA |

### CTA

- „Verlauf ansehen" → Verlauf · Gewicht · voller Zeitraum (disabled ohne Daten)

---

## 5. Verlauf (Wireframe 2)

### Zeitraum-Chips

`30T` `90T` `1J` `Alles` — gekoppelt an Substanz-Schiene und Chart.

Beim Öffnen aus Übersicht: Zeitraum = ältester aktiver Start → heute.

### Substanz-Schiene

- Gantt-Balken pro Substanz (scrollbar bei 4+)
- Zyklus: gefüllt; Dauerhaft: Outline
- Vertikale „heute"-Linie
- Tap → Fokus-Modus

### Metrik-Auswahl

- Standard: **Gewicht**
- Lab-Metriken wählbar (Option A) bei ≥ 2 Werten
- Max. 2 Metriken gleichzeitig

### Chart

- Echte Einheiten, Zyklus-Hintergrund-Bänder
- Pan + Tooltip mit aktiven Substanzen am Tag
- Kein %Δ als Hauptansicht

### Ereignis-Leiste

- 📷 Foto, 🩸 Bluttest auf Zeitachse

### Fokus-Modus (Tap auf Substanz)

**Aktiver Zyklus:** Zusammenfassung Start → heute  
**Beendet:** 7 Tage vor / während / 7 Tage nach (sonst nur Start vs. Ende)  
**Dauerhaft:** seit Start → heute  
Zoom: 7 Tage Puffer vor Start

---

## 6. Leere Zustände (Wireframe 3)

| ID | Szenario | Haupt-CTA |
|----|----------|-------------|
| A | Komplett leer | Zyklus anlegen |
| B | Substanzen, keine Logs | + Heute |
| C | Logs, keine Substanzen | Zyklus anlegen |
| D | < 3 Datenpunkte | + Heute (Fortschrittsbalken) |
| E | Nur 1 Zyklus | Normale UI, vereinfacht |
| F | Nur dauerhaft | Kein Divider |
| G | Keine merkliche Änderung | „Alles stabil" |

**Regeln:** Keine leeren Karten mit „—". Karten ohne Daten ausblenden.

---

## 7. Datenmodell

### Einheitliche Quellen

| Daten | Tabelle | Fortschritt schreibt |
|-------|---------|----------------------|
| Wellness | `daily_logs` | Ja (+ Heute) |
| Gewicht | `weight_logs` | Ja (+ Heute) — **nicht** `daily_logs.weight_kg` |
| KFA | `daily_logs.body_fat_pct` | Ja |
| Fotos | `progress_photos` | Ja |
| Labs | `bloodwork` | Lesen (+ Labs-Tab); CRUD über Labs |
| Adherence | `dose_logs` | Lesen |
| Substanzen | `cycles` (später generisch) | Lesen |

### Schema-Änderungen

```sql
-- daily_logs: separates Feld Wohlbefinden
alter table daily_logs add column if not exists wohlbefinden integer check (wohlbefinden between 1 and 10);

-- weight_logs (falls fehlend)
create table if not exists weight_logs (...);

-- progress_photos (falls fehlend)
create table if not exists progress_photos (...);
```

### Zukunft: generische Substanzen

```
substance (peptid | supplement | medikament)
tracking_period (mode: cycle | ongoing, start_date, end_date?)
```

Phase 1: nur `cycles` als Zyklen; `ongoing` vorbereitet im Typ-System.

---

## 8. Technische Struktur

```
src/features/fortschritt/
  FortschrittPage.tsx
  types.ts
  constants.ts
  hooks/
    useFortschrittData.ts
  lib/
    substances.ts
    metrics.ts
    range.ts
    colors.ts
  components/
    FortschrittHeader.tsx
    FortschrittTabs.tsx
    TodayLogSheet.tsx
    overview/
      OverviewTab.tsx
      ActiveSubstancesSection.tsx
      TopChangesSection.tsx
      OverviewCards.tsx
      EmptyOverview.tsx
    verlauf/   (Phase 2)
    fotos/     (Phase 2)
    labs/      (Phase 2)
```

---

## 9. Routing & Migration

| Route | Phase 1 | Ziel |
|-------|---------|------|
| `/progress` | Neues Fortschritt-Modul | Bleibt |
| `/protokoll` | Redirect → `/progress` | Entfernen |

Home/Profil-Links: Protokoll → Fortschritt (folgt in späterer Phase).

---

## 10. Umsetzungsphasen

### Phase 1 (aktuell)

- Spec-Dokument
- SQL-Migration
- Feature-Modul + Übersicht-Tab
- TodayLogSheet (Gewicht → `weight_logs`, Wohlbefinden getrennt)
- `/protokoll` Redirect
- Unit-Tests für `metrics.ts`

### Phase 2 (aktuell)

- Verlauf-Tab (Substanz-Schiene, Chart, Fokus)
- Fotos-Tab
- Labs-Tab (Kompakt + Link zu /blutwerte)
- i18n

### Phase 3

- Navigation (Home, Profil, Bottom Nav)
- `Protokoll.tsx` / altes `Progress.tsx` entfernen
- Generisches Substanzen-Modell

### Phase 4

- Separater PDF-Generator
- Fotos/Wellness im PDF

---

## 11. i18n-Keys (Vorbereitung)

| Key | DE |
|-----|-----|
| `progress_empty_title` | Dein Fortschritt beginnt hier |
| `progress_no_logs` | Noch keine Werte erfasst |
| `progress_few_data` | Noch zu wenig Daten |
| `progress_stable` | Alles stabil im Zeitraum |
| `progress_no_substances` | Ohne aktive Substanz siehst du nur deine Werte |
| `progress_top_changes` | Größte Veränderungen |
| `progress_view_chart` | Verlauf ansehen |

Phase 1: Deutsch hardcoded wie bisherige Progress-Seite; i18n in Phase 2.

---

## 12. Nicht-Ziele (Phase 1)

- Verlauf-Chart-Implementierung
- Fotos/Labs vollständig
- PDF-Export
- Protokoll.tsx löschen
- Generische Substanzen-DB
