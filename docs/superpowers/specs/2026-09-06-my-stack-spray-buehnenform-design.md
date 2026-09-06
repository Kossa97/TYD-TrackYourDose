# My Stack — Bühnenform „Spray"

**Datum:** 2026-09-06
**Betrifft:** `src/features/my-stack/extensions/spray/`
**Status:** umgesetzt

Die zwölfte Bühnenform und die zweite Pumpflasche. Damit haben alle
Darreichungsformen außer `liquid` und `other` eine eigene Grafik.

## Welches Objekt

`spray` ist im Katalog die Form, unter der Vitamin D3 und Melatonin geführt
werden (`catalogDosageForms.test.ts`) — also das **Mundspray**, nicht der
Raumspray oder die Sprühflasche. Gezeichnet ist deshalb die kleine Pumpflasche
mit seitlicher Düse, in die man in die Wange sprüht.

## Warum es nicht wie das Nasenspray aussehen darf

Beide sind Pumpflaschen. Unterschieden sie sich nur in der Größe, wäre eine von
beiden überflüssig — im Karussell stünden zwei Formen, die niemand
auseinanderhalten kann. Jeder Unterschied unten stimmt am echten Objekt:

| | Nasenspray | Mundspray |
|---|---|---|
| Düse | kegelig, nach oben | Stummel, **seitlich** |
| Bedienung | Fingerauflage, zwei Finger | schmaler Druckkopf, Daumen |
| Körper | 78 Einheiten breit | 60 breit, eine Sprosse kleiner |
| Kopf | weißes PP | **Eintragsfarbe**, einfarbig |
| Steigrohr | nicht gezeichnet | **sichtbar im Glas** |
| Füllung | 0,94 | 0,88 |

Die seitliche Düse ist das Erkennungsmerkmal, wie die Einschnürung bei der
Ampulle und die Bruchrille bei der Tablette.

## Entscheidungen

| Thema | Entscheidung | Grund |
|---|---|---|
| Glas | dasselbe Klarglas, Stop für Stop | Vial, Ampulle, Nasenspray und Tropfflasche teilen diesen Verlauf. Ein eigener wäre ein anderes Material in derselben Reihe. |
| Kopffarbe | Eintragsfarbe, einfarbig über alle drei Teile | Dieselbe Entscheidung wie beim Tropfenkopf. Licht und Schatten liegen als eigene Ebene darüber, damit der Kopf aus einem Guss wirkt und nicht aus drei verschieden hellen Stücken. |
| Steigrohr | gezeichnet, mittig, endet über dem Boden | Ohne Rohr gäbe es keinen Weg nach oben, die Pumpe wäre Dekoration. Auf dem Boden aufstehend saugte sie nichts an. |
| Düsenansatz | reicht **unter** den Druckkopf | An dessen gerundeter Kante angesetzt blieb ein keilförmiger Spalt stehen, die Düse sah angeklebt aus. Kopf wird nach der Düse gezeichnet. |
| Füllstand | 0,88, `hasMeaningfulFill: false` | Erst dadurch steht das Rohr ein Stück frei im Kopfraum. Tiefer sah die Flasche halb leer aus — eine Behauptung über einen Stand, den die App nicht kennt. |
| Etikett | Band der Glasformen, auf Flaschenbreite eingezogen | Die viewBox ist wegen der Düse breiter als das Glas; ohne Einzug stünde das Band links und rechts in der Luft. |
| Etikettlage | y 205–243 | Inhalt bleibt oberhalb **und** unterhalb sichtbar — die Regel, die beim Gel aufgestellt wurde. |
| Schwappen | ja, dieselbe Feder | Es ist eine Flüssigkeit in Klarglas. Alles andere wäre eine Ausnahme ohne Grund. |

## Größe

Eine Sprosse unter dem Nasenspray: **146,7 → 186,4** statt 186,4 → 236,8,
Schritt ×1,2706. Das ist dieselbe Höhe wie Vial, Ampulle und Tropfflasche. Am
echten Objekt ist das Mundspray auch die kleinere Flasche, und zwei
Pumpflaschen auf derselben Sprosse wären in der Reihe nicht zu trennen.

Die viewBox misst 74 × 220 bei 60 Einheiten Flaschenbreite. Die zusätzlichen
14 Einheiten sind der Platz für die Düse; die Flasche steht trotzdem mittig im
Rahmen (Rahmenmitte = 60 = Flaschenmitte), sonst hinge die ganze Reihe schief.

## Bühnenlicht

Nach der Regel aus `stageLightDirection.test.ts`: Bodenschatten weg von der
Lampe (−6), Korpusglanz (+18), Schleier (+12) und Kopflicht (+8) zu ihr hin.
Die Form ist dort mitgeprüft.

## Geprüft

- `sprayShape.test.ts` — Rahmen, Wandstärke 5 %, lückenloser Kragen,
  Düsenüberlappung, Steigrohr zwischen Kopf und Boden, Pegel über dem Etikett,
  Etiketteinzug, schlanker als das Nasenspray.
- `SprayVisual.test.ts` — Teile, einfarbiger Kopf, Familienglas, Beschnitt auf
  die Innenkontur, Zeichenreihenfolge, Größenleiter, weißes zentriertes Band.
- `stageLightDirection.test.ts` — Lichtrichtung, zusammen mit den elf anderen.
