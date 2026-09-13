# Protokoll-PDF — Wohlbefinden über lange Zeiträume

**Datum:** 2026-09-13
**Betrifft:** `renderProtocolPdf.renderWellness`, `wellnessBuckets` (neu),
`PdfDailyLog`, `loadProtocolData`, `sections.hasWellness`
**Status:** umgesetzt

## Der Befund

Auf dem Testaccount liegt ein Jahr täglicher Einträge. Die Sektion
„Wohlbefinden" zeichnete daraus:

- **drei** Serien (Energie, Schlaf, Libido) **übereinander** in einem Kasten,
- **jeden Rohpunkt**, also 365 je Serie,
- in **42 mm Höhe und 168 mm Breite** — 0,46 mm je Tag,
- unterschieden **nur durch Farbe** (cyan, indigo, pink) plus Legende.

Eine tägliche Selbsteinschätzung auf einer 1–10-Skala springt zwischen
Nachbartagen um zwei, drei Punkte. Heraus kommen drei ineinander liegende
Zickzackbänder. Auf Papier gibt es kein Hineinzoomen, und in einer Arztpraxis
wird schwarzweiß gedruckt: dort werden aus den drei Farben drei ähnliche
Graustufen, und die Legende ordnet keine davon mehr zu.

Nebenbefund: **`wohlbefinden` wurde gar nicht gezeichnet.** Die Metrik, nach
der die Sektion heißt, stand weder im Typ `PdfDailyLog` noch im `select` von
`loadProtocolData`. Gezeigt wurden drei von vier Werten, unter dem Namen des
vierten.

## Die zwei Antworten

### 1. Gröbere Eimer statt weniger Daten

`src/lib/protocolPdf/wellnessBuckets.ts` — reine Rechnung, kein jsPDF.

Die Regel ist **nicht** „ab X Tagen wird zusammengefasst", sondern: nimm die
**feinste** Einteilung, die unter 40 Punkten bleibt.

| Einteilung | wann sie greift |
|---|---|
| Tag | bis 40 Tage mit Einträgen |
| Woche | bis ~40 Wochen |
| Monat | bis ~40 Monate |
| Quartal | darüber |

Wer ein Jahr lang nur einmal im Monat etwas einträgt, bekommt deshalb weiter
Tagespunkte — zusammengefasst wird nur, was das Blatt erzwingt.

Je Eimer wird der **Median** gezeichnet, nicht der Mittelwert. Eine Grippewoche
mit sechs Siebenern und einer Eins zieht den Mittelwert auf 6,4; der Median
bleibt bei 7. Der Ausreißer verschwindet trotzdem nicht: die **Spannweite**
(min–max) steht als senkrechter hellgrauer Strich hinter dem Punkt.

Unter jedem Chart steht, was man sieht — „Median je Monat · 13 Monate · 365
Einträge" — und rechts der **echte** erste und letzte Eintrag, nicht der Beginn
des ersten Eimers. Ein Datum unter einem Chart wird als Datenbeginn gelesen.

### 2. Ein Chart je Metrik

Vier Charts untereinander: Energie, Schlaf, Wohlbefinden, Libido. Jeder mit
eigener Überschrift, fester Achse 0–10 und **einer** Linie.

Damit trägt die Farbe nichts mehr — die Überschrift sagt, was zu sehen ist.
Die feste Achse hält die vier trotzdem vergleichbar. Die Legende entfällt.
Rechts neben der Überschrift steht die Zusammenfassung: `Start 5 · Ende 9 ·
Veränderung +4`.

Eine Metrik ohne Einträge bekommt keinen leeren Kasten. Eine Metrik mit genau
einem Eimer bekommt statt eines Charts ihren Wert als Zeile — ein Punkt ist
kein Verlauf.

## Warum Datums-Strings und keine `Date`-Objekte

`log_date` ist ein Kalendertag ohne Uhrzeit. `new Date('2026-03-01T00:00:00')`
liest ihn in der **Ortszeit** — westlich von UTC landet der Eintrag im Februar
und damit im falschen Monatseimer. Der alte Code tat genau das. Gerechnet wird
jetzt auf den Zeichen des Datums und, wo eine Zahl nötig ist, in UTC; ein Test
läuft dazu unter `TZ=America/Los_Angeles`.

Dieselbe Falle beim Wochenanfang: `getUTCDay()` liefert für Sonntag 0, und
„minus eins" landet am Samstag statt am Montag der Vorwoche. Die Verschiebung
ist `(wochentag + 6) % 7`.

## Verifikation

- `TZ=Europe/Berlin npx vitest run` — **1485 Tests grün** (142 Dateien), 21 neu.
- `wellnessBuckets.test.ts` zusätzlich unter `TZ=America/Los_Angeles` grün.
- Ein PDF mit 365 Tageseinträgen braucht **genauso viele Seiten** wie eines mit
  zwei — die Datenmenge treibt die Seitenzahl nicht mehr (Test).
- Erzeugtes Jahres-PDF gegengelesen: vier Charts, alle vier auf einer Seite,
  Beschriftungen korrekt („Median je Monat · 13 Monate · 365 Einträge",
  „14.09.2025 – 13.09.2026").
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.

## Was offen bleibt

Die Sektion zeigt vier Metriken einzeln. Ein **fünfter, zusammenfassender**
Chart über alle vier (ein „Gesamtindex") wäre ein eigener Entwurf: er müsste
begründen, warum sich Schlaf und Libido zu einer Zahl addieren lassen. Solange
das niemand begründet, sind vier ehrliche Linien besser als eine erfundene.
