# Fortschritt-Chart: Festes 30T/3M-Fenster mit Pan in die Vergangenheit

**Datum:** 2026-07-15
**Status:** Design freigegeben

## Ziel

Der Verlaufs-Chart im Fortschritt-Feature zeigt künftig immer nur ein 30-Tage- oder
3-Monats-Fenster. Ältere Daten erreicht man durch Wischen nach rechts — mit exakt dem
Gestenverhalten des Blutspiegel-Charts. Die X-Achse zeigt dabei Kalendertage, die beim
Wischen mit der Kurve mitwandern.

**Problem heute:** Der Chart übernimmt den Seiten-Zeitraum (bis zu „Alles"). Bei langen
Zeiträumen wird die Kurve unlesbar und die fünf gleichverteilten X-Ticks kleben an den
Fensterrändern.

## Entscheidungen

| Frage | Entscheidung |
|---|---|
| Fenstergrößen | Nur 30T (30 Tage) und 3M (90 Tage), Default 3M |
| Scope des Umschalters | Chart-lokal. Die globalen Seiten-Chips bleiben unverändert |
| Touch-Geste | Wie Blutspiegel: Ziehen = Pan, ~300 ms Halten = Ablesen |
| X-Achse | Kalendertag-Raster, wandert mit der Kurve; Label-Format bleibt (`d. MMM`) |
| Y-Achse | Fix über alle Daten der Metrik — springt beim Wischen nicht |
| Fokus-Substanz | Springt die Ansicht an den Zyklus-Start; Fenstergröße bleibt |
| Technik | Recharts bleibt; X-Domain wird verschoben (kein Canvas-Rewrite) |

### Warum die Seiten-Chips unangetastet bleiben

`rangeChip` in `FortschrittPage.tsx` speist über `pageRange` nicht nur den Chart, sondern
auch die KPI-Serien, `computeTopChanges`, `FotosCard` und `BlutwerteCard`. Ein Kürzen auf
30T/3M würde diesen Karten die Langzeit-Ansicht nehmen, obwohl nur der Chart gemeint war.
Der Chart entkoppelt sich stattdessen vom Seiten-Zeitraum und bekommt seinen eigenen,
kleinen Umschalter.

Konsequenz: Die Seite trägt zwei Zeitraum-Regler. Das ist gewollt — jede Karte behält den
Zeitraum, der für sie Sinn ergibt.

### Warum Recharts bleibt (Ansatz A)

Ein Canvas-Rewrite nach Vorbild des Blutspiegel-Charts würde `CycleBandLayer`,
`FluidCursorLayer`, `MetricTooltip` und die Tooltip-Snap-Logik wegwerfen und von Hand neu
zeichnen. Stattdessen wird nur die X-Domain verschoben; die Pan-Mathematik kommt
unverändert aus dem Blutspiegel-Chart.

**Offene Wette:** Recharts rendert das SVG pro Frame neu. Die Drosselung per
`requestAnimationFrame` sollte bei ~90 Punkten reichen, ist aber am Gerät zu verifizieren.
Falls es merklich ruckelt, ist der Canvas-Rewrite der Rückfallplan.

## Architektur

### Wiederverwendet (unverändert)

Aus `src/components/liveCycleChart/chartMath.ts`:

- `panViewEnd(startViewEnd, dxPx, widthPx, windowMs)` — Finger rechts = Vergangenheit
- `clampViewEnd(viewEnd, dataStart, now, windowMs)` — Grenzen des Fensters
- `panHapticStepMs(...)` — Schrittweite der Haptik-Ticks
- `pickChartTimeTicks(...)` — fällt bei 30 T und 90 T selbsttätig auf `pickDayTicks` zurück

Reine Mathematik ohne Abhängigkeiten. Der Blutspiegel-Chart wird nicht angefasst.

### Neu

**`src/features/fortschritt/lib/chartWindow.ts`**

```ts
export type ChartWindowKey = '30t' | '3m'
export const DEFAULT_CHART_WINDOW: ChartWindowKey = '3m'
export const CHART_WINDOWS: { key: ChartWindowKey; label: string; days: number }[]
export function windowMsFor(key: ChartWindowKey): number
```

**`src/features/fortschritt/hooks/useChartPan.ts`**

Kapselt die Geste, hält `viewEnd` in einer Ref und drosselt per `requestAnimationFrame` —
dieselbe Aufteilung wie im Canvas, nur ohne Zeichnen.

Verantwortung:

- Pan: Pointer-Drag → `panViewEnd` + `clampViewEnd`, Haptik-Ticks über `panHapticStepMs`
- Lesen: Touch ~300 ms halten → Lese-Modus; speist den bestehenden `ChartPointerContext`,
  sodass `FluidCursorLayer` und `MetricTooltip` unverändert weiterlaufen
- Abgrenzung: Finger > 6 px vor Ablauf des Timers → Timer stirbt, es wird gepannt
- Maus: Hovern liest ab, Ziehen pannt (wie Blutspiegel)

Gibt zurück: `{ viewStart, viewEnd, handlers, jumpToNow, jumpToDate, showJetzt, hasHistory }`

### Geändert

**`MetricChart.tsx`**

- Prop `range` (zugeschnitten) → voller Datenbereich; Serie wird über alles gebaut
- `XAxis`: `domain={[viewStart, viewEnd]}` + `allowDataOverflow` schneidet die Anzeige zu
- `ticks`: `pickChartTimeTicks(viewStart, viewEnd, plotWidth, MIN_PX_PER_TICK)` statt
  `buildTimeTicks` (letzteres entfällt)
- `YAxis`: **keine Änderung nötig** — Recharts leitet die Skala aus den übergebenen Daten
  ab, und die sind jetzt der volle Bereich. Damit ist sie automatisch stabil.
- Pointer-Tracking wandert von den Recharts-Handlern auf den Wrapper-Div (`useChartPan`)
- Bänder: `x1`/`x2` auf den vollen Bereich klemmen statt auf das Fenster; `allowDataOverflow`
  übernimmt das Clipping
- Neu im Header: 30T/3M-Segmented-Control neben dem `ChartSettingsButton`
- Neu: „Jetzt"-Button, sobald man in der Vergangenheit steht (Vorbild `showJetzt`)
- Ref-Handle `jumpToDate(date)` für den Fokus-Sprung
- Wrapper-Div: `touchAction: 'pan-y'`, `userSelect: 'none'` (wie Blutspiegel)

**`VerlaufSection.tsx`**

- `chartRange` ist immer `state.fullRange`; `focusRangeForSubstance` entfällt
- Fokus auf eine Substanz → `chartRef.jumpToDate(substance.startDate)`
- Hält den `ChartWindowKey`-State und reicht ihn an `MetricChart`

### Was verwaist und entfernt wird

Direkte Folge der Entkopplung von den Seiten-Chips — keine davon hat danach noch einen
Aufrufer:

- `focusRangeForSubstance` in `lib/verlaufRange.ts` (+ zugehörige Tests)
- `buildTimeTicks` in `MetricChart.tsx`
- Die `onRangeLockedChange`-Kette: `VerlaufSection` → `FortschrittDashboard` →
  `FortschrittPage`
- `rangeLocked`-State in `FortschrittPage.tsx`
- `disabled`-Prop an `StickyRangeBar`
- Hinweis „Zeitraum folgt Fokus-Substanz · Chips oben deaktiviert"

`RANGE_CHIPS`, `rangeFromChip` und `DEFAULT_RANGE_CHIP` bleiben — sie bedienen weiterhin
die Seiten-Chips.

## Verifikation

**Unit-Tests**

- `chartWindow.test.ts`: Fenstergrößen, Default, `windowMsFor`
- Clamping an den Fortschritt-Fenstern: nicht über heute hinaus, nicht vor den ersten
  Datenpunkt
- `chartMath.test.ts` deckt die Pan-Mathematik bereits ab — keine neuen Tests nötig

**Am Gerät** (der eigentliche Beweis)

- Wischen fühlt sich an wie im Blutspiegel-Chart, kein spürbares Ruckeln
- 300 ms Halten öffnet den Tooltip; Ziehen pannt statt abzulesen
- X-Labels wandern mit der Kurve statt zu springen
- Y-Skala bleibt beim Wischen stehen
- Fokus springt an den Zyklus-Start, Fenstergröße bleibt
- Vertikales Seiten-Scrollen über dem Chart funktioniert weiter (`touchAction: 'pan-y'`)

## Risiken

| Risiko | Umgang |
|---|---|
| Recharts ruckelt beim Pan pro Frame | rAF-Drosselung; Rückfallplan ist der Canvas-Rewrite |
| `CycleBandLayer` verträgt keine Bänder, die aus dem Fenster ragen | Beim Umbau prüfen; sonst Bänder aufs Fenster clippen und beim Pan neu rechnen |
| Wrapper-Div liefert andere X-Koordinate als `getRelativeCoordinate` | Beim Umbau gegen das heutige Verhalten abgleichen |
| Zwei Zeitraum-Regler verwirren | Bewusst akzeptiert; der Chart-Umschalter sitzt im Chart und ist damit klar zugeordnet |
