# Aufschriften — mittig im Band, und drin statt drüber

**Datum:** 2026-09-14
**Betrifft:** `StageLabel`, `AmpouleVisual`, `DropsVisual`
**Status:** umgesetzt

## Der Befund

Gemeldet mit Bild an der Ampulle: „Semagluti…" — die Aufschrift klebte an der
Oberkante des Bandes und war seitlich abgeschnitten.

Nachgemessen an allen zwölf Formen, je Aufschrift der Versatz zur Mitte ihres
Kastens und der Überlauf über die Objektkante:

| | Versatz zur Mitte | Überlauf l/r |
|---|---|---|
| Ampulle | oben anliegend | **+10 / +10** |
| Tropfen | oben anliegend | **+3 / +3** |
| Vial, Gel, Nasenspray, Spray | oben anliegend | im Objekt |
| Pen, Tablette, Kapsel, Pulver, Tube, Pflaster | mittig | im Objekt |

Zwei verschiedene Fehler, die im Bild zusammenfielen.

## 1. Die Aufschrift lag oben an

`StageLabel` setzte seinen Inhalt ohne vertikale Ausrichtung in ein Band, dem
die meisten Formen eine **feste Höhe** geben (`top`/`height` in Prozent). Ein
Block ohne Ausrichtung fängt am oberen Rand an.

Solange zwei Zeilen darin standen — Name und Menge —, füllten sie das Band und
es fiel kaum auf. Seit die Mengenzeile wegfällt, sobald keine Menge eingetragen
ist (und auf dem Farbschritt ist nie eine eingetragen, er kommt vor dem
Stärke-Schritt), stand der Name allein und klebte oben.

```
flex flex-col justify-center
```

`justify-center` richtet den **Inhalt** aus, nicht die Zeilen einzeln: eine
Zeile sitzt in der Mitte, zwei sitzen als Block in der Mitte. Eine Regel, an
einer Stelle, für alle sechs Formen mit Band.

Die übrigen sechs zeichnen ihre Aufschrift selbst und saßen bereits mittig in
ihrem jeweiligen Kasten — nachgemessen, nicht angenommen.

## 2. Die Aufschrift passte nicht ins Band

Ampulle und Tropfflasche sind die schmalsten Objekte mit Etikett (96 px), ihre
`large`-Schriftgröße war aber dieselbe wie bei den breiten Formen: 18 px bzw.
16 px. „Semaglutid" braucht dort 116 px — es lief über beide Kanten hinaus.

Der Marquee, der lange Namen laufen lässt, fing das ab, aber er ist für
**lange** Namen gedacht. Ein Name mit zehn Zeichen, der schon im Stand über
beide Ränder hängt, sieht nicht nach Laufschrift aus, sondern nach kaputt.

Beide jetzt auf `text-[13px]` — fest, ohne Breakpoint, denn `large` ist die
Größe des Farbschritts und hängt nicht an der Fensterbreite.

## Nachher

Alle zwölf Formen: **Versatz 0** zur Mitte ihres Kastens, **kein Überlauf** über
die Objektkante.

## Verifikation

- Zwölf Formen im Browser aufgenommen und vermessen, vorher und nachher.
- Die Ampulle zusätzlich im echten Farbschritt bei 501 × 914 (dem Format aus
  der Meldung): „Semaglutid" vollständig, mittig im Band.
- Neuer Test in `StageLabel.test.ts`: das Band trägt `flex flex-col
  justify-center`, mit Mengenzeile wie ohne.
- `TZ=Europe/Berlin npx vitest run` — **1494 Tests grün** (142 Dateien), 1 neu.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.
