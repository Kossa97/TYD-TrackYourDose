# Protokoll Redesign — Design Spec
**Datum:** 2026-05-23  
**Status:** Approved

---

## 1. Ziel

Die `/protokoll`-Seite soll von einer einfachen Chart-Sammlung zu einem hochwertigen Biohacking-Dashboard werden. Mehr Daten parallel sichtbar, bessere visuelle Hierarchie, moderner Dark-UI-Stil mit Glow-Effekten.

---

## 2. Seitenstruktur (top → bottom)

```
Header (Titel + Zeitraum-Info + PDF-Button + Share-Button)
KPI-Streifen (4 Karten)
Zeitraum-Selektor (aktuell / eigener Zeitraum) — unverändert
───────────────────────────────────────────────────────────
Schnell-Ansichten (Preset-Chips)
Marker-Toggles (Checkboxen)
CHART 1: % Veränderung (Korrelations-Übersicht)
CHART 2: Small Multiples (echte Einheiten + Normalbereich)
───────────────────────────────────────────────────────────
Adherence je Peptid (Fortschrittsbalken)
Vergangene Zyklen — unverändert
```

---

## 3. KPI-Streifen

4 Karten in einer Zeile (`grid-cols-4`, auf Mobile `grid-cols-2`):

| Karte | Wert | Farbe |
|---|---|---|
| Adherence | % (gesamt im Zeitraum) | `#10b981` |
| Gewicht Δ | Start → Ende (kg) | `#00ccf5` |
| IGF-1 Δ | % Veränderung | `#8b5cf6` |
| CRP Δ | % Veränderung | `#10b981` oder `#f43f5e` je nach Richtung |

Jede Karte hat einen farbigen 2px-Streifen oben (`::before`), Akzentfarbe und einen Delta-Hinweis (`↑ +4% vs. Vormonat`).  
Wenn ein Marker im Zeitraum keine Daten hat → Karte zeigt `—`.

---

## 4. Preset-Chips + Marker-Toggles

**Presets** (Pill-Chips, einer aktiv zur Zeit):
- ⚖️ Gewicht + IGF-1
- 💉 GH-Panel (Gewicht + IGF-1 + Vitamin D)
- 🔥 Entzündung (Gewicht + CRP)
- 🧬 Metabolismus (Gewicht + Insulin)
- ⚗️ Hormone (Testosteron + IGF-1 + Insulin)
- 📊 Alle Marker

**Marker-Toggles** (kleine Pills, bis zu 5 gleichzeitig aktiv):  
Ein Toggle je verfügbarem Blutmarker im Zeitraum. Gewicht ist immer verfügbar. Beim Klick: Preset-Chip-Selektion aufheben, freie Auswahl.

---

## 5. Chart 1 — % Veränderung (Korrelations-Chart)

**Zweck:** Zeigt relative Entwicklung aller ausgewählten Marker auf einer Achse — direkte Korrelation sichtbar.

**Y-Achse:** `% Δ ab Start` (normalisiert). 0% = Startwert jedes Markers. Typischer Range: −50% bis +60%.

**X-Achse:** Zeitachse (Monats-Labels + Tick-Marks).

**Hintergrund:**
- Zyklus-Phasen als farbige Rechtecke (Farbe je Peptid, niedrige Opacity)
- Phasentrenner als gestrichelte vertikale Linie
- Phasenname als Label oben links

**Bluttest-Ereignisse:** Vertikale gestrichelte Linien + kleiner Kreis oben an jedem Bluttest-Datum. Label „Bluttest" nur beim ersten.

**Linien:** Pro aktivem Marker eine Linie:
- Smooth cubic bezier path (kein `type="monotone"` kink-Verhalten)
- Breite: 2.5px
- Glow: zusätzliche 6px-breite Linie mit 15% Opacity gleicher Farbe darunter
- Gradient-Fill: Area-Fill von Linie bis 0%-Linie, Opacity 0–25%
- Datenpunkte: kleiner Kreis (r=3, fill=#07091a, stroke=Farbe)
- Wert-Label am Ende der Linie (z.B. `−8.5%`)

**Tooltip:** Beim Hover über Chart-Area — vertikale Cursor-Linie + Tooltip-Box mit allen aktiven Markern und interpolierten Werten.

**Legende:** Farbige Linie + Marker-Name, horizontal unter dem Chart.

**Recharts-Umsetzung:** `ComposedChart` mit `Line` je Marker + `ReferenceLine` für Bluttest-Daten + `ReferenceArea` für Zyklusphasen + custom `Dot` + `CustomTooltip`. Normalisierung der Werte vor dem Rendern in `useMemo`.

---

## 6. Chart 2 — Small Multiples (echte Einheiten)

**Zweck:** Zeigt absolute Werte mit echter Einheit und Normalbereich. Jeder aktive Marker bekommt eine eigene Zeile.

**Layout:** Vertikale Stack von Mini-Charts, alle auf derselben Zeitachse.

**Pro Zeile:**
- Marker-Name + Einheit (links, farbig)
- Normalbereich-Band: gefülltes Rechteck in Markerfarbe (5% Opacity) zwischen `normal_min` und `normal_max`
- Normalbereich-Grenzen: gestrichelte Linie in Markerfarbe (20% Opacity)
- Aktuelle Werte: Linie + Punkte an Messpunkten (nur an echten Bluttest-Daten, keine Interpolation zwischen Messungen)
- Aktueller Wert rechts: letzter bekannter Wert fett in Markerfarbe
- Bluttest-Vertikalen: gleiche Linien wie Chart 1 (Synchronisation)

**Normalbereich-Werte** (hardcoded Defaults, aus `bloodwork.tsx` MARKERS-Liste übernehmen):
```
Gewicht:     Idealbereich aus Profil (height_cm + gender → Devine-Formel)
IGF-1:       100 – 300 ng/mL
Testosteron: 264 – 916 ng/dL
Östradiol:   10 – 40 pg/mL
CRP:         0 – 5 mg/L
TSH:         0.4 – 4.0 mIU/mL
Insulin:     2 – 25 µIU/mL
Vitamin D:   30 – 100 ng/mL
Hämoglobin:  13.5 – 17.5 g/dL
Hematokrit:  40 – 52 %
```

**Gewicht in Small Multiples:** Benutzt `weight_logs` (viele Punkte), alle anderen Marker benutzen `bloodwork`-Einträge (wenige Messpunkte).

**Recharts-Umsetzung:** Ein `LineChart` je Marker, `syncId="protokoll"` für synchronisierten Hover, `ReferenceArea` für Normalbereich, `ReferenceLine` für Grenzen. Kein CartesianGrid-Y-Achsen-Label (nur Normalbereich-Beschriftung rechts).

---

## 7. Adherence je Peptid

Einfache Fortschrittsbalken-Liste (unveränderte Logik, neues Design):
- Peptid-Name links (11px, slate-400)
- Track: `rgba(255,255,255,0.05)`, height 6px, rounded
- Fill: Gradient (Peptidfarbe → dunklere Variante), Breite = Adherence-%
- % rechts, fett, in Peptidfarbe

**Keine roten/grünen Adherence-Punkte** auf Charts.

---

## 8. Design-Token (konsistent mit App)

```
Background:    #07091a
Card:          rgba(8,11,26,0.95) + border rgba(255,255,255,0.07)
Card radius:   20px
Cyan:          #00ccf5
Purple:        #8b5cf6
Green:         #10b981
Amber:         #f59e0b
Rose:          #f43f5e
Sky:           #38bdf8
Font weight:   900 title, 800 value, 700 label, 600 body
Glow filter:   feGaussianBlur stdDeviation=3
```

---

## 9. Daten-Flow

```
Protokoll.tsx
  ├── loadRangeData() → weight_logs, bloodwork, dose_logs (unverändert)
  ├── normalizedSeries (useMemo) → % Δ Daten für Chart 1
  ├── smallMultiplesData (useMemo) → absolute Werte + Normalbereich für Chart 2
  ├── adherencePerPeptide (useMemo) → % je Peptid
  └── kpiValues (useMemo) → 4 KPI-Werte
```

Neue Hilfsfunktionen:
- `normalizeToPercent(series)` — berechnet % Δ vom ersten Messpunkt
- `getNormalRange(marker)` — gibt `{min, max}` aus hardcoded Map zurück
- `getGradientId(marker)` — gibt SVG-Gradient-ID zurück

---

## 10. Nicht geändert

- Zeitraum-Selektor (Aktueller Zyklus / Eigener Zeitraum)
- Vergangene Zyklen-Liste
- PDF-Export-Logik
- Share-Button
- Supabase-Queries

---

## 11. Dateistruktur

Nur eine Datei geändert: `src/pages/Protokoll.tsx`  
Keine neuen Dateien, keine neuen DB-Tabellen, keine neuen Pakete (recharts bereits installiert).
