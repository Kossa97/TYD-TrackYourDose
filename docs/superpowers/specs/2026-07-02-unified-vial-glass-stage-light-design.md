# Unified Vial Glass + Stage Light Design

**Datum:** 2026-07-02
**Status:** Freigegeben fuer Planung
**Branch:** `codex/unified-vial-glass-stage-light`
**Betroffene Bereiche:** `src/components/PeptideVialVisual.tsx`, `src/pages/Peptide.tsx`, `src/components/liquidGeometry.ts`, `src/components/PeptideVialVisual.test.ts`, ggf. `src/pages/__VialPreview.tsx`.

## Ziel

Das Vial soll wie ein zusammenhaengendes medizinisches Glasgefaess wirken. Hals, Schulter und Koerper sollen denselben Glasstil teilen: milchig-transparent, klare dunkle Aussenkanten, weiche vertikale Reflexionen und ein glaubwuerdiger Glasboden. Die aktuell sichtbare Kante zwischen Hals und Koerper soll verschwinden.

Zusaetzlich bekommt das Vial-Karussell einen hochwertigen Fokus-Effekt: Das mittige ausgewaehlte Vial steht optisch in einem weichen Lichtkegel. Schatten, Glanz und Reflexionen reagieren auf die Position des Vials im Karussell.

## Nicht-Ziele

- Deckel-Design nicht veraendern.
- Label-Design, Textlayout und Marquee-Verhalten nicht veraendern.
- Keine echte 3D- oder Raytracing-Lichtsimulation.
- Keine neue Asset-Datei fuer das Vial.
- Keine Aenderungen an Peptid-Daten, Lagerlogik oder Formularen.

## Visuelle Richtung

Die Glasoptik orientiert sich an realistischen medizinischen Vial-Renderings:

- ein durchgehender Vial-Umriss von Hals ueber Schulter bis Boden,
- transparente bis leicht milchige Glaswand,
- dunklere Seitenkanten fuer Glasdicke,
- ein breiter weicher Lichtreflex links,
- ein kleinerer Reflex rechts,
- ein dunkler elliptischer Glasboden,
- keine harte horizontale Trennlinie an der Schulter.

Der Look bleibt passend zur dunklen App: premium, ruhig, medizinisch, nicht comicartig.

## Architektur

### Unified Glass Shell

`PeptideVialVisual` zeichnet Hals, Schulter und Koerper als eine gemeinsame SVG-Glasform. Diese Form definiert:

- den sichtbaren Glasumriss,
- die Clip-Region fuer Glasreflexe,
- die Clip-Region fuer die Fluessigkeit,
- die Position von Boden- und Kantenreflexen.

Der Deckel bleibt als eigener oberer SVG-Teil erhalten, damit sein aktueller Look stabil bleibt. Das Label bleibt als absolut positioniertes Overlay ueber dem Glas.

### Fluessigkeit

Die vorhandene dynamische Fluessigkeitslogik bleibt erhalten. `buildLiquid` kann weiter die bewegte Oberflaeche und Slosh-Geometrie liefern, wird aber in die neue gemeinsame Glasform eingebettet. Die Fluessigkeit darf nicht in Hals oder Deckel laufen; sie bleibt im Koerperbereich und wird sauber durch die Glas-Shell begrenzt.

### Carousel Stage Light

Das Karussell berechnet fuer jedes Vial einen Fokuswert anhand der Entfernung zur Mitte des Scrollcontainers:

- `focus = 1` fuer das mittige Vial,
- abfallend fuer seitliche Vials,
- stabil bei Snap-Positionen,
- aktualisiert ueber vorhandene Scroll-Handler.

Dieser Fokuswert steuert:

- Vial-Skalierung,
- Deckkraft der Glasreflexe,
- Intensitaet des Bodenschattens,
- leichte Abdunklung seitlicher Vials,
- eine dezente Verschiebung der Highlight-Position.

Das Licht wirkt wie ein fester Lichtkegel in der Mitte des Karussells. Beim Scrollen gleiten die Vials durch diesen Kegel; Reflexe und Schatten reagieren auf ihre jeweilige Position.

## Props und Datenfluss

`PeptideVialVisual` erhaelt neue optionale Props:

- `focus?: number` im Bereich `0..1`, Default aus `isActive`.
- `lightOffset?: number` im Bereich `-1..1`, Default `0`.

`Peptide.tsx` berechnet pro Carousel-Item:

- Entfernung des Item-Mittelpunkts zur Container-Mitte,
- daraus `focus`,
- daraus `lightOffset`.

Wenn JavaScript noch keinen Messwert hat, bleibt das bisherige Verhalten stabil: aktives Vial wirkt fokussiert, seitliche Vials reduziert.

## Accessibility und Motion

Die Effekte sind rein dekorativ und veraendern keine Bedienlogik. Keyboard-Navigation und ARIA-Labels bleiben unveraendert.

Bei `prefers-reduced-motion: reduce`:

- keine animierte Highlight-Verschiebung,
- kein nervoeses Nachziehen,
- statischer Fokus fuer das aktive Vial.

## Tests und Verifikation

Automatisierte Tests:

- `PeptideVialVisual` rendert weiterhin Label, Menge, Fill-Status und Liquid-Details.
- Neuer Test: Glas-Shell wird als ein gemeinsames Element gerendert.
- Neuer Test: alte separate Schulter-/Body-Seam-Indikatoren werden nicht mehr benutzt.
- Neuer Test: `focus` und `lightOffset` werden als visuelle Steuerwerte akzeptiert.

Manuelle Verifikation:

- `/__vialpreview`: Hals und Koerper wirken wie ein einziges Glasobjekt.
- Peptid-Karussell: mittiges Vial steht im Lichtkegel.
- Scrollen: Reflexe und Schatten veraendern sich weich mit der Position.
- Label und Deckel bleiben optisch unveraendert.
- Mobile Breite und Desktop Breite pruefen.

## Erfolgskriterien

- Die rot markierte Kante aus dem Screenshot ist nicht mehr sichtbar.
- Hals und Koerper haben denselben Glasstil.
- Das aktive Vial im Karussell wirkt bewusst ausgeleuchtet.
- Seitliche Vials bleiben lesbar, aber weniger prominent.
- Keine Regression bei Fuellstand, Slosh, Label, Deckel oder Carousel-Auswahl.
