# My Stack: Nasenspray als fünfte Bühnenform

**Datum:** 2026-09-02
**Branch:** `codex/my-stack-foundation`
**Status:** Vom Nutzer bestätigt
**Bereich:** My-Stack-Bühne, Darreichungsform-Renderer

## Ziel

Das Nasenspray als fünfte Bühnenform — und die erste seit der Ampulle, bei der
der **Glas-Malstapel wieder trägt**.

Bei Kapsel und Tablette lautete der Befund dreimal: geteilt werden Licht und
Bewegung, nicht Material. Das Nasenspray kehrt das um. Es ist ein Glasbehälter
mit sichtbarer Flüssigkeit, also erbt es Flüssigkeitsgeometrie, Etikett, Schwapp‑
physik und Lichtführung unverändert. Neu ist allein die Form — und ihr Kopf.

## Was das Nasenspray vorfindet

| Baustein | Für das Nasenspray |
|---|---|
| `useStageLight` | wird genutzt |
| `StageLabel` | wird genutzt — es ist ein Behälter mit Flüssigkeit |
| `LiquidGraphic`, `liquidGeometry` | werden genutzt |
| Glas-Malstapel (Tiefe, Wand, Sweep, Innenclip) | **greift vollständig** |
| Slosh-Anbindung über `SloshProvider` | wird genutzt |
| `StageFormSpec` | unverändert nutzbar, `chamber` gesetzt |

Kein neuer geteilter Baustein. Der einzige Teil ohne Vorbild ist der Kopf aus
weißem Kunststoff, und der gehört in die Form, nicht in `stage/`.

## Abgenommene Produktentscheidungen

| Thema | Entscheidung |
|---|---|
| Ansicht | Aufrecht, frontal, stehend. |
| Kopf | Düse offen, **keine Schutzkappe**. |
| Kopfaufbau | Dreiteilig: Schraubkragen, Fingerauflage, Düse. |
| Kopfmaterial | Mattes weißes Polypropylen, **kein Metall**. |
| Körper | Klarglas mit sichtbarer Flüssigkeit. |
| Glasbreite | 78 Einheiten (Variante C). |
| Füllstand | Fester Pegel, **keine Prozentzeile**. |
| Etikett | Ja, wie Vial und Ampulle. |
| Höhe im Karussell | 186,4 px, am `sm`-Breakpoint 236,8 px. |
| Bewegung | Flüssigkeit schwappt, Flasche steht still. |

### Warum die Düse offen bleibt

Jede Darreichungsform hat genau ein Merkmal, das sie eindeutig macht: bei der
Ampulle die Einschnürung, bei der Tablette die Bruchrille, beim Nasenspray die
konische Düse mit ihrer Fingerauflage. Jede Schutzkappe legt sich genau darüber.

Das ist hier nicht theoretisch. `DOSAGE_FORMS` führt `nasal_spray` **und**
`spray` als getrennte Schlüssel. Mit Kappe wären beide nicht zu unterscheiden.

In `mini` (76 px) und `compact` verschwände ein Kappendetail ohnehin und bliebe
als unklare Verdickung stehen.

### Warum der Kopf weiß ist und nicht metallisch

Echte Nasensprays haben einen Kopf aus weißem oder eingefärbtem Polypropylen.
Ein metallischer Kopf trüge die Farbfamilie der **Bördelkappe des Vials** — und
beide stehen im Karussell direkt nebeneinander. Weißer Kunststoff trennt die
Formen auf den ersten Blick; Metall würde das Spray wie ein hohes Vial wirken
lassen.

Entsprechend matt gehalten: weiche Kante statt hartem Spitzlicht.

### Warum es keinen Füllstand zeigt

`getVialFillPct` in `MyStackPage.tsx:176` liest `vials_in_stock` und
`vials_initial` — **vial-spezifische Altfelder**. Für ein Nasenspray gibt es kein
Gegenstück. Die App kann nicht wissen, wie voll die Flasche ist.

Die Grafik zeigt die Flüssigkeit trotzdem, auf festem Stand. Das folgt einem
Muster, das dieselbe Datei schon anwendet: `MyStackPage.tsx:2433` zeichnet
`fillPct={vialPct ?? 100}`, blendet die Prozentzahl aber aus, wenn `vialPct`
null ist. **Die Grafik zeigt das Objekt, die Zahl wäre eine Behauptung.**

`hasMeaningfulFill: false` schaltet die Prozentzeile ab. `chamber` bleibt
gesetzt, damit Flüssigkeit, Schwappen und — über `carriesLabel` — das Etikett
erhalten bleiben. Die Etikettregel wird nicht angefasst.

### Warum es höher ist als Vial und Ampulle, aber nicht maßstäblich

Maßstab aus dem Vial: 3,6 px je Millimeter. Eine Nasenspray-Flasche misst mit
Pumpe rund 97 mm, ein Vial etwa 45 mm — maßstäblich wäre das Spray also **2,2×
so hoch**, über 300 px. Es würde die Karussellzeile von 187 px auf 356 px treiben
und alle anderen Formen an den unteren Rand drücken.

Gewählt ist stattdessen die nächste Sprosse der Leiter, die die stehenden Formen
schon steigen: 146,7 → 186,4 → 236,8 px, jeder Schritt ×1,2706. Das Spray nimmt
die beiden oberen Sprossen. **186,4 px ist keine neue Zahl** — es ist exakt die
Höhe, die die Ampulle am `sm`-Breakpoint erreicht.

Es wächst am `sm`-Breakpoint mit, anders als Kapsel und Tablette. Täte es das
nicht, wären am Desktop alle stehenden Formen gleich hoch und das gewählte
Größenverhältnis wäre wieder verschwunden.

Der Konflikt liegt genau umgekehrt zur Tablette: dort war maßstäblich zu klein
für einen lesbaren Namen, hier wäre maßstäblich zu groß für die Bühne. Beide Male
weicht der Maßstab bewusst ab, in entgegengesetzte Richtungen.

## Grafik

### Aufbau

Zeichenraster ist ein Feld von 120 × 294 Einheiten; die `viewBox` der Form ist
darauf beschnitten und lautet `{ x: 21, y: 6, width: 78, height: 288 }` — genau
die Objektgrenzen, wie bei der Ampulle. Von oben nach unten:

| Teil | y-Bereich | Breite | Anteil |
|---|---|---|---|
| Düse, verjüngt, gerundete Spitze | 6 … 75,5 | 29 → 19 | 24,1 % |
| Fingerauflage | 75,5 … 87,5 | 76 | 4,2 % |
| Schraubkragen mit umlaufender Rille | 87,5 … 140,5 | 54 | 18,4 % |
| Flaschenkörper aus Glas | 140,5 … 294 | **78** | 53,3 % |

Die Teile stoßen lückenlos aneinander. Kragen und Auflage teilen sich die Kante
bei 87,5 — eine Lücke dort würde sich bei `large` als heller Spalt zeigen.

Die Kopfgruppe nimmt damit 46,7 % der Gesamthöhe ein, der Körper 53,3 %. Das ist die
Proportion einer realen Flasche und der auffälligste Unterschied zu einer
naiven Zeichnung, bei der der Körper dominiert.

Die Umrissbreite beträgt 78 Einheiten — die Fingerauflage misst 76 und bleibt
damit knapp innerhalb des Glases. **Das ist die Untergrenze der Glasbreite:**
schmaler, und der Kopf ragt über den Flaschenrand hinaus.

Gesamtverhältnis 78 : 288 ≈ **0,271**. Bei 186,4 px Höhe ist die Form damit
50,5 px breit.

### Material

Der Flaschenkörper ist Glas und benutzt denselben Malstapel wie Vial und
Ampulle: Wandverlauf, Innenclip, Tiefe an den Kanten, wanderndes Licht.

Der Kopf ist mattes weißes Polypropylen — ein eigener, flacherer Verlauf ohne
Metallglanz, mit weicher statt harter Lichtkante. Die Rille am Kragen ist eine
dunkle Linie, wie die Bruchrille der Tablette.

### Flüssigkeit

Steht fast bis zum Glasrand, in `color_hex` des Eintrags. Sie füllt die Kammer,
schwappt beim Wischen über `sloshEngine` und wird am Innenumriss des Glases
beschnitten — nicht am Außenumriss. Das war beim Ampullenbau der häufigste
Fehler und ist hier von Anfang an so vorgesehen.

Das Kammerverhältnis liegt bei rund 0,52 und damit nahe an dem der Ampulle
(0,483). Der Neigungswinkel der Oberfläche passt ohne Nachjustierung von
`chamberAspect`.

### Beschriftung

`StageLabel` auf dem Flaschenkörper, unterhalb der Schulter — der einzige gerade
Bereich. Name und Wirkstoffmenge, wie bei Vial und Ampulle.

Das Band ist 74 Einheiten breit — die Innenweite des Glases bei 78 Außenmaß. Zum Vergleich: die Ampulle kommt mit 61
aus und trägt dort beides. Die Breite ist keine Grenze.

## Bühne

| Stufe | Höhe |
| --- | --- |
| `large` | 464 px |
| `carousel` | 186,4 px, `sm` 236,8 px |
| `compact` | 140 px |
| `mini` | 76 px |

Die Stufen folgen denselben Verhältnissen, die die Ampulle zwischen ihren Stufen
benutzt, angewandt auf die neue Karussellhöhe. Die Breite folgt der Höhe über das
feste Verhältnis 0,271.

`large` fällt mit 464 px hoch aus. Das ist die Detailansicht, in der die Form
allein steht; ob die Höhe dort trägt, ist bei der Umsetzung im Browser zu prüfen
und gegebenenfalls zu deckeln.

## Architektur

Neu, ausschließlich in `extensions/nasal-spray/`:

| Datei | Verantwortung |
|---|---|
| `nasalSprayShape.ts` | Konturen, Kopfmaße, Kammer, Etikettlage, `StageFormSpec`. Reine Daten. |
| `NasalSprayVisual.tsx` | Glas, Kopf, Flüssigkeit, Etikett. |
| `NasalSprayRenderer.tsx` | Adapter von `StackItem`, reicht `SloshProvider` durch. |

Geändert: `dosageForms.ts` erhält `stageRenderer: 'nasal_spray'` und `stageForm`
beim Eintrag `nasal_spray`; `StackStage.tsx` verzweigt zusätzlich darauf;
`__VialPreview.tsx` nimmt die Form auf.

## Auswirkungen auf bestehende Tests

- `dosageForms.test.ts` erwartet heute `['vial', 'ampoule', 'tablet', 'capsule']`
  und `isStageRenderable('nasal_spray') === false`. Beides wird gehoben.
  Die Reihenfolge folgt `DOSAGE_FORMS`, wo `nasal_spray` nach `capsule` steht.
- **Das Negativbeispiel bleibt diesmal stehen.** `patch` hat weiterhin keinen
  Renderer, die beim Tablettenbau eingeführte Wache bleibt grün. Erstmals seit
  drei Formen zieht die Negativrolle nicht um.
- Die Suiten von Vial, Ampulle, Kapsel und Tablette bleiben unverändert.

## Fehler- und Grenzfälle

- Fehlende `color_hex`: derselbe neutrale Rückfallwert wie bei den anderen Formen.
- Fehlende Wirkstoffmenge: Etikett trägt nur den Namen, kein Platzhalter.
- Sehr langer Name: läuft durch, wird nie gekürzt.
- Leerer Name: Rückfall auf „Nasenspray", nie eine leere Beschriftung.
- `prefers-reduced-motion`: von `sloshEngine` und Durchlauf bereits abgehandelt.
- Kein `sloshEngine` im Kontext: die Flüssigkeit steht still, sonst unverändert.

## Verifikation

- Aufrecht, frontal, Düse offen, keine Kappe.
- Kopfgruppe rund 48 % der Höhe, Körper rund 52 %.
- Kopf weiß und matt, ohne Metallglanz.
- Glasbreite 78 Einheiten; die Fingerauflage bleibt innerhalb des Glases.
- Flüssigkeit am **Innen**umriss beschnitten, nicht am Außenumriss.
- Etikett mit Name und Wirkstoffmenge, kein Prozentwert.
- Karussellhöhe 186,4 px, am `sm`-Breakpoint 236,8 px, Seitenverhältnis 0,271
  auf jeder Stufe.
- Gemeinsame Bodenlinie mit Vial, Ampulle, Kapsel und Tablette.
- Beim Wischen schwappt die Flüssigkeit; die Flasche selbst bewegt sich nicht.
- `spray`, `patch` und `powder` bleiben im Textzustand.
- Keine neuen i18n-Schlüssel — `dosage_form_nasal_spray` liegt in allen Sprachen vor.

## Nicht Bestandteil dieses Teilprojekts

- der generische `spray`-Schlüssel (Rachen- und Hautsprays: andere Flasche,
  andere Düse),
- die Darstellung verbleibender Sprühstöße,
- ein echter Füllstand und die dafür nötige Tracking-Tiefe-Migration,
- weitere Darreichungsformen,
- Änderungen an Vial, Ampulle, Kapsel, Tablette, Datenbank oder Tracking-Logik.
