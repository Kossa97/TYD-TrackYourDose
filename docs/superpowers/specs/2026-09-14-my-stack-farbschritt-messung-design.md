# Farbschritt — die Messung, die nie stattfand

**Datum:** 2026-09-14
**Betrifft:** `farbschrittSkalaMessen` im `StackItemWizard`
**Status:** umgesetzt

## Der Befund

Gemeldet mit Bild: der Pen stand in voller Größe im Farbschritt, oben vom
Kopfbereich und unten vom Farbfeld abgeschnitten.

Der Pen ist mit **589 px** die mit Abstand höchste Form; die Fläche im
Farbschritt ist je nach Gerät 420–510 px hoch. Er wird also immer verkleinert —
auf 0,58 bis 0,81. Im Bild stand er bei **1,0**.

1,0 ist kein gerechneter Wert, sondern der **Rückfall** von `objektSkala`: die
Funktion gibt 1 zurück, wenn eine ihrer vier Maßzahlen ≤ 0 ist. Die Kette:

```
ResizeObserver auf der FLÄCHE feuert, sobald sie ihre Größe hat
  ↓
gemessen wird aber auch das OBJEKT — dessen native Größe steht da noch nicht fest
  ↓
objektSkala({ hoehe: 0, … })  →  Rückfall 1
  ↓
die Fläche ändert sich danach nicht mehr → keine zweite Messung
  ↓
589 px in 420 px, abgeschnitten
```

Die Rechnung hat zwei Seiten, beobachtet wurde nur eine.

## Drei Änderungen

### 1. Bild für Bild nachfassen, bis eine Messung zustande kommt

Kein zweiter `ResizeObserver` auf dem Objekt: dessen Größe hängt an `zoom`, und
jedes Schreiben von `zoom` löste die nächste Messung aus — das schriebe sich im
Kreis. Stattdessen fasst der Schritt nach dem Betreten per
`requestAnimationFrame` nach, bis eine Messung wirklich gelingt (höchstens 60
Bilder). Der Beobachter auf der Fläche bleibt für alles Spätere (Tastatur,
Drehung, Adressleiste).

### 2. Ohne Maße wird nichts gesetzt

Der Rückfall 1 wird nicht mehr festgeschrieben. Kommt keine Messung zustande,
bleibt die Skala `null` — und `null` heißt jetzt ausdrücklich **„noch nicht
gemessen"**, nicht „Faktor 1". Das Objekt steht dann unsichtbar, aber im
Layout: genau dort wird es ja gemessen. So gibt es auch kein Aufblitzen in
falscher Größe.

### 3. Das Ergebnis geht zuerst an den DOM

```ts
wrapper.style.zoom = String(skala)
setFarbschrittSkala(skala)
```

Die Messung setzt `zoom` zum Messen kurz auf 1. Kommt danach derselbe Wert
heraus, den der Zustand schon trägt, rendert React nicht neu — der Stil, den
React geschrieben hätte, bleibt aus, und die 1 aus der Messung bleibt stehen.
Deshalb schreibt die Messung ihr Ergebnis selbst, und der Zustand kommt
danach; er wird weiter gebraucht, weil er Renderrunden überlebt, die nichts
mit der Größe zu tun haben. Auf dem Abbruchpfad wird der vorherige Wert
wiederhergestellt statt die 1 stehen zu lassen.

## Verifikation

- Im Browser bei 517 × 914 (dem Format aus der Meldung) nachgestellt: der Pen
  steht bei `zoom 0,67`, gerendert 51 × 395 px in einer 485 × 420 px großen
  Fläche, **kein Überlauf**.
- Zwei neue Tests in `StackItemWizard.interaction.test.tsx`, die die Maße
  stellen, weil jsdom überall 0 meldet:
  - ohne Maße bleibt das Objekt unsichtbar statt in nativer Größe zu stehen;
  - ein Objekt, das größer ist als die Fläche, wird geschrumpft.
- `TZ=Europe/Berlin npx vitest run` — **1493 Tests grün** (142 Dateien), 2 neu.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.
