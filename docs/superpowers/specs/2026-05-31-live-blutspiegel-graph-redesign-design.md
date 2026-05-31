# Live-Blutspiegel-Graph — Neubau (Design)

**Datum:** 2026-05-31
**Status:** Genehmigt (Design)
**Betroffene Komponente:** `LiveCycleCard` in `src/pages/BlutspiegelSimulation.tsx`

## Problem

Der Graph in der „Live-Blutspiegel"-Karte (`LiveCycleCard`) ist mit **Recharts** gebaut.
Bei jedem Wisch-Frame ändert sich das Zeitfenster (`windowDomain`), wodurch Recharts das
komplette SVG-Diagramm neu rendert. Das ist zäh und fühlt sich kaputt an („Scrollen
funktioniert nicht"). Außerdem fehlen: flüssiges, einrastfreies Wischen, eine Halten-zum-
Ablesen-Geste, ein 10-Sekunden-Live-Wachstum, dezente Marker und saubere Achsenbeschriftung.

Hinweis: Es existiert bereits ein Canvas-Chart `src/components/LiveBlutspiegelChart.tsx`
(„60 fps Pan ohne Recharts"), das aber per Feature-Flag `LIVE_VERLAUF_CHART: false`
abgeschaltet ist, auf *mehrere* Zyklen ausgelegt ist und die falsche Wischrichtung +
Nachschwingen hat. Es dient als Muster, wird aber nicht direkt wiederverwendet.

## Ziel

Den Chart-Bereich der `LiveCycleCard` auf eine fokussierte, Canvas-basierte
Einzelzyklus-Komponente umstellen. Das Karten-Drumherum (Name, GLP1-Badge, großes %,
Trend, Stat-Kacheln „Nächste Dosis / Level danach / Peak", PK-Zeile T½/Tmax/F) bleibt
unverändert.

## Anforderungen

1. **Flüssiges Wischen** — 1:1 dem Finger folgend, 60 fps, **kein Nachschwingen, kein Einrasten**.
2. **Wischrichtung** — Finger links→rechts = zurück in die Vergangenheit; rechts→links = Richtung jetzt.
3. **Voller Verlauf** — bis zum Zyklusstart (erste bestätigte Einnahme) zurück scrollbar.
4. **Live-Wachstum** — alle **10 s** neu berechnen; Kurve wächst am rechten Rand mit.
5. **Halten zum Ablesen** — Finger ~0,3 s still halten → vertikale Ables-Linie mit Datum · Uhrzeit · exaktem %-Wert, die beim Weiterbewegen mitläuft.
6. **Dezente Marker** — kleine Punkte, kein übertriebener Stil.
7. **Saubere Achsen** — X- und Y-Achse vernünftig beschriftet, X-Ticks ohne Überlappung.

## Rendering-Ansatz

Eigene Canvas-Komponente (Arbeitstitel `LiveCycleChartCanvas`), die den Recharts-Block in
`LiveCycleCard` ersetzt (aktuell ca. Zeilen 595–692). Pan-/Lerp-/Pointer-Muster werden vom
vorhandenen `LiveBlutspiegelChart` übernommen.

- `<canvas>` mit DPR-Skalierung (max 2×).
- Redraw via `requestAnimationFrame`; Pan-Zustand lebt in Refs (kein React-Re-Render pro Frame).
- Nur die UI-relevanten Dinge (Ables-Chip-Inhalt, „Jetzt ↩"-Sichtbarkeit) in React-State.

### Gezeichnete Elemente

- **Kurve:** grüne Linie (~1,8 px) + Verlaufsfüllung. Glatt durch dichte 15-Min-Punkte → physikalisch korrekte Form (gerundeter Anstieg, exponentieller Abbau). Keine Dreiecks-Zacken.
- **Y-Achse:** Ticks 0/25/50/75/100, dezente horizontale Gridlines, vertikaler Titel „Spiegel %". Normierung auf Peak = 100 % (wie bisher).
- **X-Achse:** Tages-Ticks im Format `EEE dd.` (de-Locale). **Tick-Dichte adaptiv** an die Canvas-Breite (Mindestabstand in px), damit nichts überlappt.
- **Einnahme-Marker:** kleiner grüner Punkt (r≈3), ohne gestrichelten Stiel.
- **Peak-Marker:** feiner oranger Ring (r≈3, dünne Linie), je Dosis bei Injektion + Tmax.
- **„jetzt"-Indikator:** dezentes Label am rechten Rand (am Live-Ende).
- **Ables-Linie:** dünne vertikale Linie + Punkt auf der Kurve + Chip (Datum · Uhrzeit · exakter %-Wert).

## Interaktion

### Wischen (Pan)
- Folgt 1:1 dem Finger; pro Frame Canvas-Redraw aus Refs.
- Finger →rechts erhöht das betrachtete „Zurück", →links verringert es.
- **Kein Momentum, kein Snap** — Fenster bleibt exakt dort stehen, wo losgelassen wird.
- **Grenzen:** links nicht über die erste Einnahme hinaus, rechts nicht über „jetzt".
- **„Jetzt ↩"-Button** erscheint nur, wenn in der Vergangenheit; Tipp = Sprung ans Live-Ende.

### Halten zum Ablesen
- Finger sofort bewegen = wischen.
- Finger ~0,3 s **still halten** (Bewegung unter kleinem Schwellwert) → Ables-Modus aktiv:
  vertikale Linie + Chip erscheinen; weitere Fingerbewegung **scrubbt die Linie** statt zu scrollen.
- Loslassen = Ables-Linie weg, Wischen wieder aktiv.
- **Desktop (Maus):** Hover zeigt die Ables-Linie direkt (kein Halten); Ziehen mit gedrückter Taste = wischen.

### Live-Wachstum (10 s)
- `LiveCycleCard`: Recompute-Intervall **60 s → 10 s** (`calculateHistoryBlutspiegelCurve`).
- **Anker:** Das betrachtete Fenster-Ende wird als **absolute Zeit** + Flag `folgtLive` gehalten:
  - `folgtLive = true` (am Live-Ende): Fenster-Ende = jetzt, läuft mit.
  - `folgtLive = false` (in der Vergangenheit): Fenster-Ende fest → springt beim 10-s-Tick nicht weg.

## Daten

- Kurvenpunkte: `calculateHistoryBlutspiegelCurve(events, halfLife, tmax, bioavailability, 15)` — erste Einnahme → jetzt, normiert auf Peak = 100 %.
- Einnahme-Marker: `taken`-Events, Höhe per Interpolation auf der Kurve.
- Peak-Marker: je Dosis Zeitpunkt = Injektion + `tmax_hours`, Höhe interpoliert.
- Ables-Wert: lineare Interpolation (`lerp`) zwischen Kurvenpunkten am Finger-Zeitpunkt.
- Sichtfenster: 7 Tage (`WINDOW_HOURS = 168`), durch das gescrollt wird.

## Bewusst außerhalb des Scope (YAGNI)

- Zoom / Pinch / Doppeltipp-Zoom.
- Dauerhaft sichtbares Fadenkreuz (Variante C wurde verworfen).
- Übersprungen-Marker (rotes ×) — bleibt wie bisher weg, hält die Marker dezent.
- Änderungen am PK-Modell selbst.
- Aufräumen des toten `LiveBlutspiegelChart` / `loadAllCycleChartData` (separat, optional).

## Performance

- Rendering (60-fps-Pan) ist unabhängig vom 10-s-Daten-Recompute.
- Recompute alle 10 s ist für typische Zyklus-Längen günstig (<10 ms). Sollte es bei sehr
  langen Zyklen eng werden, kann später auf inkrementelles „Ende verlängern" umgestellt werden.

## Verifikation

Überwiegend visuell im Preview:
- Flüssiges, ruckelfreies Wischen bis zum Zyklusstart.
- Richtige Wischrichtung (Finger rechts = Vergangenheit).
- Kein Nachschwingen / kein Einrasten beim Loslassen.
- Halten ~0,3 s zeigt korrekten interpolierten Wert; Linie läuft beim Bewegen mit.
- Live-Tick alle 10 s; Ansicht bleibt stabil, wenn in die Vergangenheit gescrollt.
- Marker dezent; Achsen lesbar, keine überlappenden X-Ticks.

Unit-Tests:
- `lerp` (Interpolation an Punkten / außerhalb / dazwischen).
- Anker-Logik (`folgtLive` an/aus, Fenster-Ende-Berechnung).
- Adaptive X-Tick-Auswahl (kein Überlappen bei gegebener Breite).
