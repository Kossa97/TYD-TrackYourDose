# Gel als elfte Bühnenform

**Datum:** 2026-09-05
**Branch:** `codex/my-stack-foundation`
**Status:** Gebaut

## Ziel

`gel` bekommt eine eigene Bühnengrafik. Danach fehlen nur noch `liquid` und
`spray`; `other` bleibt als Auffangeintrag bewusst auf der Textkarte.

## Die eigentliche Frage: wogegen grenzt sich Gel ab?

Gel hat zwei Nachbarn, die dasselbe zeigen könnten.

**Die Tube** deckt Gel heute faktisch mit ab — Diclofenac-Gel kommt in der Tube.
Sie ist bereits eine eigene Form und bleibt es. Gel bekommt deshalb *nicht*
noch eine Tube, sondern den anderen Behälter, in dem Gel steht: den **Tiegel**.

**Die Pulverdose** ist seit heute ebenfalls ein Zylinder mit Schraubdeckel. Ohne
klare Unterscheidung stünden zwei fast gleiche Objekte nebeneinander. Drei
Signale trennen sie, und jedes einzelne trägt schon allein:

| | Pulverdose | Gel-Tiegel |
|---|---|---|
| Silhouette | höher als breit (0,64) | **breiter als hoch (1,25)** |
| Material | undurchsichtiges HDPE | **durchscheinend, Inhalt sichtbar** |
| Deckel | geriffelt | **glatt** |

Der Tiegel ist damit die erste Form überhaupt, die breiter als hoch steht. Auf
dem Regal ist er auf einen Blick von allem anderen zu unterscheiden.

## Abgenommene Entscheidungen

| Thema | Entscheidung | Grund |
|---|---|---|
| Behälter | Tiegel mit glattem Schraubdeckel | Die Tube ist als Form vergeben. |
| Material | durchscheinendes Glas | Erbt den Klarglas-Stapel von Vial, Ampulle, Nasenspray und Tropfen — dieselben Verlaufswerte, andere Silhouette. |
| Inhalt | sichtbar, als ruhende gewölbte Masse | Gel ist der Grund für den Tiegel. Ohne sichtbaren Inhalt wäre das durchscheinende Glas sinnlos. |
| Physik | dieselbe Geste, zähe Antwort | Gel bewegt sich, aber es schwappt nicht. Es hört dieselbe Feder wie die Flüssigkeit und filtert sie durch ein Verzögerungsglied. Kein `LiquidGraphic`, kein Pegel, keine Bläschen. |
| Etikettband | keins | `chamber: null`. Die Regel „Etikett nur, wo Flüssigkeit ist" wird nicht angefasst; der Name steht auf einem gedruckten Etikett des Tiegels, wie bei Tube und Pulverdose. |
| Farbe | Deckel und Gel | Wie bei der Tropfflasche, wo Kappe und Flüssigkeit sie tragen. |

## Warum Gel keine Flüssigkeit ist

Das ist die inhaltliche Neuerung dieser Form. Jede flüssige Form bisher benutzt
`LiquidGraphic`: eine waagerechte Oberfläche, die sich beim Wischen neigt, dazu
Bläschen und ein Pegel. Für Gel ist davon nichts richtig.

- **Die Oberfläche ist gewölbt, nicht waagerecht.** Gel nivelliert sich nicht.
- **Es gibt keinen Pegel.** `hasMeaningfulFill: false`, wie bei Tube, Pflaster
  und Pulverdose.
- **Es bewegt sich — aber zäh.** Siehe unten.

Die Masse wird deshalb eigens gezeichnet: ein Körper, dessen obere Kante der
vordere Bogen der Oberflächenellipse ist, darüber die Ellipse selbst als
Aufsicht auf das Gel, darauf ein Glanz. Derselbe Kunstgriff wie bei der
Deckfläche der Pulverdose, nur für den Inhalt.

## Dieselbe Geste, andere Antwort

Die Slosh-Maschine liefert `tilt`: den Winkel einer unterdämpften Feder. Sie
schwingt über die Ruhelage hinaus, schwappt zurück und pendelt sich ein — für
Flüssigkeit genau richtig, für Gel falsch. Eine zähe Masse kriecht der Bewegung
hinterher und bleibt stehen, wo sie angekommen ist.

Gel übernimmt die Federantwort deshalb nicht, sondern **filtert** sie: ein
Verzögerungsglied erster Ordnung (`gelFlow.ts`) auf denselben Eingang, mit einer
Zeitkonstante von 0,38 s. Ein solches Glied kann seinen Zielwert nie
überschreiten — genau das ist der Unterschied zwischen „schwappt" und „fliesst
zäh", und genau das hält ein Test fest: dieselbe Anregung, die Feder schwingt
durch die Null, das Gel nie.

Der Ausschlag ist ein Viertel des flüssigen: 6 Einheiten Wandanstieg gegen die
22 aus `liquidGeometry`. Und **nur die Oberfläche kippt** — der Boden bleibt
liegen, weil eine zähe Masse den Kontakt zur Wand nicht verliert. Deshalb
bekommt der Körper pro Bild einen neuen Pfad statt einer Drehung.

Gemessen am laufenden Karussell: 2,4 Einheiten Ausschlag nach 80 ms, danach
über gut eine Sekunde zurück auf die Ruhelage, ohne sie je zu überschreiten.

## Größe

Der Tiegel nimmt die Sprosse unter der Pulverdose: 90,9 → 115,5 px. Der Schritt
bleibt ×1,2706. Ein flacher Tiegel ist niedriger als eine Pulverdose, und weil
er breiter als hoch ist, wird er trotz der tieferen Sprosse das breiteste
stehende Objekt.

| Größe | Höhe | Breite |
|---|---|---|
| `large` | 226,1 px | 282,6 px |
| `carousel` | 90,9 px, `sm` 115,5 px | 113,6 px, `sm` 144,4 px |
| `compact` | 68,2 px | 85,2 px |
| `mini` | 37,1 px | 46,4 px |

## Grafik

Raster 160 × 128, viewBox auf die Objektgrenzen beschnitten: `5 4 150 120`,
Seitenverhältnis 1,25.

Es gilt derselbe Grundsatz wie bei der Pulverdose: **jede waagerechte Kante ist
ein Ellipsenbogen.** Deckelrand, Glasboden, Geloberfläche und Etikettkanten
folgen ihm alle.

**Deckel.** Glatt, niedrig, mit Deckfläche und Fase — bewusst ohne Riffelung,
das ist das Unterscheidungsmerkmal zur Pulverdose. Er trägt die Eintragsfarbe.

**Glas.** Klarglas-Stapel der Familie: nur die Ränder tragen die Glasdicke,
dazu Schein und wanderndes Glanzband, beide beschnitten.

**Gel.** Durchscheinende Masse in der Eintragsfarbe, Oberfläche als Ellipse mit
eigenem Glanz. Sie steht ein gutes Stück unter dem Deckel — ein bis zum Rand
gefüllter Tiegel sähe aus wie ein Farbtopf.

**Etikett.** Kanten als Bögen, wie bei der Pulverdose — und mit dem Radius des
**Körpers**, nicht des Innenraums: es klebt aussen auf dem Glas und läuft bis
an die Silhouette. Mit Einzug spannte es nur über den Innenraum, und die beiden
Streifen Glas daneben liessen es hinter der Wand liegen statt darauf.

Es liegt in der Mitte der Masse, nicht über ihrem unteren Rand. An der
Mittellinie reicht das Gel vom vorderen Bogen der Oberfläche (60,5) bis zum
vorderen Bogen des Bodens (117,5); das Band nimmt die mittleren 24 Einheiten
und lässt oben wie unten 16,5 stehen. Der Streifen **unter** dem Etikett ist
der wichtigere: erst er zeigt, dass der Tiegel hinter dem Papier weitergeht.

## Architektur

Neu, ausschließlich in `extensions/gel/`:

| Datei | Verantwortung |
|---|---|
| `gelShape.ts` | Konturen, Deckel- und Gelmaße, Namenslage, `StageFormSpec`. Reine Daten. |
| `GelVisual.tsx` | Die Grafik samt Größenleiter und Bühnenlicht. |
| `GelRenderer.tsx` | Anbindung an `StackStage`. |

Geteilt werden nur `useStageLight` und `StageMarquee`. Kein `LiquidGraphic`,
kein `StageLabel`, keine Slosh-Anbindung.

## Folgen ausserhalb

`gel` war seit der Pulverdose das Negativbeispiel im Wächter von
`StackStage.test.ts` — „Formen ohne Bühnengrafik bleiben Text". Es ist auf
**`other`** umgezogen, und damit ist die Wanderung zu Ende: der Auffangeintrag
hat keine Fähigkeiten und soll dauerhaft auf der Textkarte bleiben.
`MyStackPage.visibility.test.tsx` benutzte Gel als Beispiel für „nicht-Vial ohne
Bühne" und ist mitgezogen.

Ein dritter Wächter ist geblieben, hat aber die Richtung gewechselt: der Test
in `StackStage.test.ts`, der festhielt, dass die Tube den `gel`-Schlüssel nicht
schluckt. Er prüfte bisher, dass Gel im Textzustand bleibt; jetzt prüft er, dass
Gel seinen eigenen Tiegel bekommt und *nicht* die Tube. Die Aussage — „gel
benennt einen Stoff, tube einen Behälter" — ist dieselbe geblieben.

## Nicht Teil davon

- Pumpspender und Sachets als eigene Behälter
- eine Änderung an der Tube, die Gel weiter mit abdeckt
- `liquid`, `spray` und `other`
