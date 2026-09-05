# Pulver als zehnte Bühnenform

**Datum:** 2026-09-05
**Branch:** `codex/my-stack-foundation`
**Status:** Gebaut und vom Nutzer geprüft

## Ziel

`powder` bekommt eine eigene Bühnengrafik. Bisher fällt die Form auf die
Textkarte „Darstellung folgt" zurück, wie `liquid`, `spray`, `gel` und `other`.

## Ausgangslage

Neun der vierzehn Darreichungsformen werden gerendert. Pulver ist die erste,
die weder Glas noch Flüssigkeit erbt: der ganze Stapel aus `LiquidGraphic`,
Schwappen, Pegel und Etikettband entfällt. Die einzige undurchsichtige Form
davor ist die Tube — sie liefert das Muster, nicht die Grafik.

## Abgenommene Entscheidungen

| Thema | Entscheidung | Grund |
|---|---|---|
| Behälter | Dose mit Schraubdeckel | Der Beutel ist Einweg; My Stack führt einen Bestand über Wochen. Die Dose ist der Behälter, den Nutzer vor sich haben. |
| Füllstand | keiner | Undurchsichtiges Pulver in einer undurchsichtigen Dose. Ein Pegel wäre eine Behauptung — dieselbe Lage wie bei Tube und Pflaster. |
| Etikettband | keins | `chamber: null`. Die Regel „Etikett nur, wo Flüssigkeit ist" wird nicht angefasst; der Name wird direkt auf den Körper gedruckt, wie bei der Tube. |
| Farbe | auf dem Deckel | Der Körper bleibt Material. Wie bei der Tropfflasche trägt das kleinere, glattere Teil die Eintragsfarbe; ein ganz eingefärbter Korpus verlöre die Dose als Objekt. |
| Material | dunkles mattes Polymer, Stop für Stop der Pen-Korpus | Kein Glas, kein Blech. Der Korpus teilt die Legierung des Pens (`#23272e → #6f7683 → #454b55 → #5e646f → #1d2127`) statt sie nur zu zitieren — zwei knapp verschiedene Dunkel lesen sich als Fehler. Auf dunklem Korpus trägt die Kontur hell (`rgba(255,255,255,0.28)`), Schulter und Fuß schatten in echtem Schwarz. |

## Warum eine Sprosse unter dem Vial

Der Maßstab aus dem Vial ist 3,6 px je Millimeter. Eine Kreatindose misst rund
120 mm — maßstäblich also 432 px, ein Vielfaches der Karussellzeile. Derselbe
Konflikt wie bei Nasenspray und Tube, dieselbe Auflösung: die Leiter entscheidet,
nicht der Maßstab.

Die Dose nimmt aber als **erste stehende Form eine Sprosse nach unten**:
115,5 → 146,7 px statt 146,7 → 186,4. Grund ist ihr Charakter. Sie ist die
einzige stehende Form, die breiter als hoch wirkt; auf der oberen Sprosse wäre
sie mit 94 px Breite fast doppelt so breit wie die breiteste bisherige Form und
erschlüge die Reihe. Eine Sprosse tiefer ist sie niedrig und gedrungen — genau
das, was eine Dose neben schlanken Flaschen ist.

Der Schritt bleibt ×1,2706, die Leiter also intakt: 115,5 · 1,2706 = 146,7,
und das ist exakt die Höhe, auf der Vial, Ampulle und Tropfflasche stehen.

| Größe | Höhe | Breite |
|---|---|---|
| `large` | 287,3 px | 191,5 px |
| `carousel` | 115,5 px, `sm` 146,7 px | 77 px, `sm` 97,8 px |
| `compact` | 86,6 px | 57,7 px |
| `mini` | 47,2 px | 31,5 px |

## Grafik

Raster 120 × 170, viewBox auf die Objektgrenzen beschnitten: `10 6 100 150`,
Seitenverhältnis 0,667.

Grundsatz für alles: **reine Frontansicht, wie jede andere Bühnenform.** Vial,
Ampulle, Nasenspray und Tropfen zeigen nie eine Deckfläche; ihre Rundheit kommt
allein aus dem waagerechten Verlauf, und `liquidGeometry` hält die
Flüssigkeitsoberfläche ausdrücklich flach („real water is flat").

Eine Zwischenfassung zeigte Deckel und Boden von leicht oben, mit elliptischen
Rändern und einer sichtbaren Deckfläche. In sich stimmig, aber quer zur
Familie: im Karussell neben einem Vial war der Bruch sofort zu sehen. Sie ist
zurückgebaut.

**Deckel.** Breiter als der Korpus, damit er als aufgeschraubt liest und nicht
als abgesetztes Segment. Über der Riffelung ein glatter heller Streifen, wie ihn
jede Schraubkappe hat.

**Riffelung.** Sie wird über den **Winkel um die Zylinderachse** verteilt, nicht
über den Abstand auf dem Bildschirm. Daraus folgen beide Eigenschaften von
selbst: die Rillen rücken zu den Rändern hin zusammen, wie es die Verkürzung
verlangt. **Das ist kein Aufsicht-Merkmal** — es folgt aus der waagerechten
Krümmung und gilt in der Frontansicht genauso, weshalb es den Rückbau überlebt
hat. Weggefallen sind nur die senkrechten Versätze: alle Rillen beginnen und
enden auf derselben Höhe. Kerbe und helle Kante sind je Rille verschieden stark
— die Lampe steht links oben, und zu den Rändern hin dreht sich die Fläche weg.

**Korpus.** Gerader Zylinder, unten ein Bogen statt einer Rundung, dazu Schulter
und Fuß als Licht. Der Verlauf ist weicher als beim Glas: Kunststoff hat kein
Kantenlicht, sondern einen breiten Kern.

**Etikett.** Ein Band mit farbigem Fußstreifen, der die Deckelfarbe unten wieder
aufnimmt. Gerade Kanten: die gewölbten der Zwischenfassung waren die Aufsicht in
klein. Der Streifen liegt **unter** der Zylinderschattierung, sonst wäre er das
einzige flache Teil auf einer runden Dose.

**Name.** Auf dem Etikett, mit `StageMarquee` wie bei der Tube. Die Dose ist die
breiteste stehende Form und damit die einzige, auf der übliche Namen ohne
Durchlauf hineinpassen.

**Wanderndes Licht.** Ein breiter Glanzkern, auf den Korpus beschnitten, plus
der Bodenschatten der Bühne. Beide folgen `lightOffset`, beide liegen in einem
Clip — die Wache aus dem Tabletten-Fehler gilt hier genauso.

## Architektur

Neu, ausschließlich in `extensions/powder/`:

| Datei | Verantwortung |
|---|---|
| `powderShape.ts` | Konturen, Deckelmaße, Namenslage, `StageFormSpec`. Reine Daten. |
| `PowderVisual.tsx` | Die Grafik samt Größenleiter und Bühnenlicht. |
| `PowderRenderer.tsx` | Anbindung an `StackStage`. |

Geteilt werden nur `useStageLight`, `StageMarquee` und
`usePrefersReducedMotion`. Kein `LiquidGraphic`, kein `StageLabel`, keine
Slosh-Anbindung.

## Nicht Teil davon

- Beutel und Stick-Packs als eigene Form
- eine sichtbare Pulveroberfläche oder ein Messlöffel
- `liquid`, `spray`, `gel` und `other`, die weiter auf die Textkarte fallen
