# Pulver als zehnte Bühnenform

**Datum:** 2026-09-05
**Branch:** `codex/my-stack-foundation`
**Status:** Entwurf

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
| Material | mattes HDPE | Kein Glas, kein Blech. Weicher Zylinderverlauf ohne harte Glanzkante — sonst sähe sie aus wie die Tube. |

## Warum eine Sprosse unter dem Vial

Der Maßstab aus dem Vial ist 3,6 px je Millimeter. Eine Kreatindose misst rund
120 mm — maßstäblich also 432 px, ein Vielfaches der Karussellzeile. Derselbe
Konflikt wie bei Nasenspray und Tube, dieselbe Auflösung: die Leiter entscheidet,
nicht der Maßstab.

Die Dose nimmt aber als **erste stehende Form eine Sprosse nach unten**:
115,5 → 146,7 px statt 146,7 → 186,4. Grund ist ihr Charakter. Sie ist die
einzige stehende Form, die breiter als hoch wirkt; auf der oberen Sprosse wäre
sie mit 98 px Breite doppelt so breit wie die breiteste bisherige Form und
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

Grundsatz für alles: **die Dose ist ein Zylinder, von leicht oben gesehen.**
Jeder waagerechte Rand ist deshalb ein Ellipsenbogen, kein Strich. Wo dieser
Satz verletzt wird, sieht man es sofort — die erste Fassung hatte einen flachen
Deckel auf einem gerundeten Rechteck und las sich als aufgeklebte Grafik.

**Deckel.** Breiter als der Korpus, damit er als aufgeschraubt liest und nicht
als abgesetztes Segment. Die Deckfläche ist eine eigene Ebene mit eigenem Licht
und einem eingesenkten Spiegel, wie ihn jede Schraubkappe hat — nicht bloß ein
dunkles Band am oberen Rand.

**Riffelung.** Sie wird über den **Winkel um die Zylinderachse** verteilt, nicht
über den Abstand auf dem Bildschirm. Daraus folgen beide Eigenschaften von
selbst: die Rillen rücken zu den Rändern hin zusammen, wie es die Verkürzung
verlangt, und jede beginnt auf dem vorderen Bogen des oberen Randes statt an
einer gemeinsamen geraden Kante. Kerbe und helle Kante sind je Rille
verschieden stark — die Lampe steht links oben, und zu den Rändern hin dreht
sich die Fläche weg.

**Korpus.** Gerader Zylinder, unten ein Bogen statt einer Rundung, dazu Schulter
und Fuß als Licht. Der Verlauf ist weicher als beim Glas: Kunststoff hat kein
Kantenlicht, sondern einen breiten Kern.

**Etikett.** Ein umlaufendes Band mit farbigem Fußstreifen, der die
Deckelfarbe unten wieder aufnimmt. Ober- und Unterkante sind dieselben Bögen wie
am Deckelrand, und der Streifen liegt **unter** der Wölbungsschattierung — sonst
wäre er das einzige flache Teil auf einer runden Dose.

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
