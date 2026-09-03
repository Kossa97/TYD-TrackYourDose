# My Stack: Pen als siebte Bühnenform

**Datum:** 2026-09-03
**Branch:** `codex/my-stack-foundation`
**Status:** Vom Nutzer bestätigt
**Bereich:** My-Stack-Bühne, Darreichungsform-Renderer

## Ziel

Der Injektionspen als siebte Bühnenform — aufrecht stehend, Kappe oben, mit
Dosisfenster und geriffeltem Dosierknopf.

Er ist die **schmalste und zugleich höchste** Form im Stack. Aus diesem
Missverhältnis folgt fast jede Entscheidung in diesem Dokument.

## Was der Pen vorfindet

| Baustein | Für den Pen |
|---|---|
| `useStageLight` | wird genutzt |
| `StageMarquee` | wird genutzt — in einer gedrehten Hülle |
| `StageLabel` | unzulässig — keine sichtbare Flüssigkeit, keine Kammer |
| `LiquidGraphic`, `liquidGeometry` | nicht anwendbar |
| Glas-Malstapel | nicht anwendbar |
| Slosh-Anbindung | nicht anwendbar |
| `StageFormSpec` | unverändert nutzbar, `chamber: null` |

Damit steht es drei zu vier: Vial, Ampulle und Nasenspray zeigen Flüssigkeit,
Kapsel, Tablette, Tube und Pen tragen ihren Namen aufgedruckt.

## Abgenommene Produktentscheidungen

| Thema | Entscheidung |
|---|---|
| Ansicht | Aufrecht, Kappe oben, stehend auf dem Dosierknopf. |
| Proportionen | Echt: 155 × 20 mm, Verhältnis **0,130**. |
| Kartuschenfenster | **Entfällt.** Keine sichtbare Flüssigkeit. |
| Dosisfenster | Zeigt eine **0**. |
| Beschriftung | **Längs, um 90° gedreht**, über den ganzen Körper. |
| Gehäuse | Neutrales Grau. |
| `color_hex` | **Farbring unter der Kappe.** |
| Höhe im Karussell | 236,8 px, am `sm`-Breakpoint 300,9 px. |
| Bewegung | Keine außer Bühnenlicht. |

### Warum im Dosisfenster eine 0 steht

Ein Pen hat ein Dosisfenster — es ist sein auffälligstes Merkmal. Die App kennt
die eingestellte Dosis aber nicht: `getVialFillPct` liest vial-spezifische
Altfelder, und Plandaten gehen bewusst nicht durch die Bühnen-Schnittstelle.
Diese Grenze haben wir bei der Bruchmenge der Tablette gezogen: **die Bühne zeigt
den Stack-Eintrag, nicht eine einzelne Einnahme.**

Die 0 löst das, ohne das Merkmal zu opfern. Sie ist der **wahrheitsgemäße
Ruhezustand** eines nicht eingestellten Pens — sie behauptet keine Dosis, sie
sagt „dieser Pen ist nicht eingestellt".

### Warum das Kartuschenfenster entfällt

Es war zunächst vorgesehen und wurde bewusst gestrichen. Der Grund ist der Platz
für den Namen.

Mit Fenster stünde für die Beschriftung nur der Körperabschnitt darunter zur
Verfügung: 84 von 300 Einheiten, also **66,3 px** Laufweite bei Karussellgröße.
Ohne Fenster läuft der Körper von der Kappe bis zum Knopf durch — 154 Einheiten
und **121,6 px**.

Zum Vergleich, alles in Pixeln bei Karussellgröße: Ampulle 35,5 px, Tube 44,2 px,
Nasenspray 50,5 px. Der Pen bekommt längs also **mehr als das Doppelte** der
bisher großzügigsten Form.

**Aus dem schmalsten Objekt im Stack wird damit für die Beschriftung das
großzügigste**, einfach weil die Schrift der langen Achse folgt.

Der Preis ist konsequent mitzutragen: ohne sichtbare Flüssigkeit hat der Pen
keine Kammer. Damit trägt er nach `carriesLabel = chamber !== null` **kein
Etikettband**, zeigt **keine Prozentzeile** und abonniert die **Slosh-Engine
nicht** — es kann nichts schwappen.

### Warum die Schrift längs läuft

Quer stünden dem Pen rund 28 px Laufweite zur Verfügung, weniger als jeder
anderen Form. Längs über dem Dosisfenster sind es 71,0 px — immer noch mehr als
bei jeder anderen Form quer, aber kein Vielfaches mehr. Ein gedrehter
Name nutzt genau die Achse, an der diese Form reich ist — und echte Pens sind so
bedruckt.

**Technisch als gedrehte Hülle.** `StageMarquee` verschiebt über `translateX`.
Der Pen legt eine um 90 Grad gedrehte Hülle darum, in der der bestehende
waagerechte Durchlauf unverändert weiterläuft. Der geteilte Baustein wird nicht
angefasst, die sechs anderen Formen sind nicht betroffen.

### Warum ein Farbring und nicht das ganze Gehäuse

Ohne Flüssigkeit hätte `color_hex` nichts einzufärben, und der Pen wäre nach der
Tube die zweite Form, bei der die gewählte Farbe unsichtbar bleibt.

Das Gehäuse bleibt neutral grau, die Eintragsfarbe sitzt als **Ring unter der
Kappe**, rund 10 von 310 Einheiten hoch. Echte Pens sind farbkodiert; der Ring
greift das auf, ohne die ganze Form einzufärben.

## Beleuchtung

Der Pen ist glattes Kunststoffgehäuse, kein Glas und kein Metall — also weder
Glas-Malstapel noch das Oberlichtmodell der Tube. Er bekommt die einfachste
Fassung, dieselbe wie die Kapsel:

- Ein **senkrechtes Glanzband** auf dem Gehäusekörper, das mit `lightOffset`
  seitlich wandert. Es ist **auf den Körper beschnitten** — die Regel aus der
  Tabletten-Prüfung gilt ohne Ausnahme, und der Pen ist die schmalste Form,
  also die anfälligste dafür.
- **Focus** dimmt Gehäuse und Bodenschatten, wenn der Eintrag nicht der aktive
  ist.
- Der **Bodenschatten** wandert leicht mit dem Licht.

Kappe und Dosierknopf behalten ihre eigene feste Zylinderschattierung; sie
gehören zur Form, nicht zur Beleuchtung.

## Grafik

### Aufbau

Zeichenraster 40 × 310 Einheiten; die `viewBox` ist auf die Objektgrenzen
beschnitten und lautet `{ x: 0.5, y: 6, width: 39, height: 300 }`.

| Teil | y-Bereich | Breite |
|---|---|---|
| Nadelkappe mit Clip | 6 … 96 | 27 |
| Farbring in `color_hex` | 96 … 106 | 32 |
| Gehäusekörper | 96 … 250 | 32 |
| Dosisfenster mit 0 | 196 … 213 | 14 |
| Dosierknopf, geriffelt | 250 … 306 | **39** (breiteste Stelle) |

Gesamtverhältnis 39 : 300 = **0,1300**. Real misst ein Pen 20 × 155 mm, also
0,1290 — die gezeichnete Form trifft die echten Proportionen.

Der **Dosierknopf ist die breiteste Stelle**, nicht der Körper. Er bestimmt
damit die Umrissbreite und das Seitenverhältnis.

### Beschriftung

Der Name steht längs auf dem Gehäusekörper, um 90 Grad gegen den Uhrzeigersinn
gedreht, **mittig über dem Dosisfenster** — die Zone reicht von der Unterkante
des Farbrings bis zur Oberkante des Fensters, 90 von 300 Einheiten.

Das kostet Laufweite: **71,0 px** bei Karussellgröße statt 121,6 über den ganzen
Körper. Es bleibt weiterhin mehr als bei jeder anderen Form quer (bestes
Nasenspray: 50,5 px), aber der Vorsprung ist deutlich kleiner. Am
Mobilbreakpoint gemessen passt der längste Testname mit **exakt 0 px Reserve**
gerade noch ohne Durchlauf. Weiß, mit Schattenwurf, in denselben
Klassen wie bei allen anderen Formen.

**Als HTML, nicht als SVG-Text** — dieselbe Lehre wie bei der Kapsel, deren
Gravur erst lesbar wurde, als sie von SVG- auf HTML-Text umgestellt wurde: HTML
bekommt Hinting und Subpixel-Glättung, SVG-Text nicht. Das gilt auch für die
**0 im Dosisfenster**, die bei Karussellgröße nur rund 8 px misst.

Bei Überlänge läuft er durch — senkrecht, weil die gedrehte Hülle die Achse des
waagerechten Durchlaufs mitdreht.

Leerer Name: Rückfall auf „Pen".

## Bühne

| Stufe | Höhe | Breite |
| --- | --- | --- |
| `large` | 589,2 px | 76,6 px |
| `carousel` | 236,8 px, `sm` 300,9 px | 30,8 px, `sm` 39,1 px |
| `compact` | 177,6 px | 23,1 px |
| `mini` | 96,9 px | 12,6 px |

Die Stufen folgen denselben Verhältnissen, die die Ampulle zwischen ihren Stufen
benutzt, angewandt auf die Karussellhöhe 236,8 px.

**236,8 px ist keine neue Zahl** — es ist die Höhe, die Ampulle und Nasenspray am
`sm`-Breakpoint erreichen. Der Pen nimmt die nächste Sprosse derselben Leiter und
wächst am `sm`-Breakpoint auf 300,9 px mit. Ohne dieses Mitwachsen wären am
Desktop wieder alle stehenden Formen gleich hoch — derselbe Fehler, der beim
Nasenspray einmal beinahe passiert wäre.

Maßstäblich wäre ein Pen bei 3,6 px/mm **558 px** hoch, fast das Vierfache der
Vialhöhe; die Karussellzeile wüchse von 300 auf 621 px. (Gemessen im Entwurf: 249 px bei Nasenspray-Höhe, 300 px bei der gewählten, 621 px maßstäblich.)

`large` fällt mit 589,2 px sehr hoch aus. Die Form ist dort mit 76,6 px allerdings
schmal, also eine hohe dünne Säule statt einer Fläche. Ob das in der
Detailansicht trägt, ist bei der Umsetzung im Browser zu prüfen und
gegebenenfalls zu deckeln — dieselbe offene Stelle wie bei der Tube.

## Architektur

Neu, ausschließlich in `extensions/pen/`:

| Datei | Verantwortung |
|---|---|
| `penShape.ts` | Konturen, Fenster- und Knopfmaße, Ringlage, Namenslage, `StageFormSpec`. Reine Daten. |
| `PenVisual.tsx` | Kappe, Körper, Ring, Dosisfenster, Knopf, gedrehte Beschriftung. |
| `PenRenderer.tsx` | Adapter von `StackItem`. Kein `SloshProvider`. |

Geändert: `dosageForms.ts` erhält `stageRenderer: 'pen'` und `stageForm` beim
Eintrag `pen`; `StackStage.tsx` verzweigt zusätzlich darauf; `__VialPreview.tsx`
nimmt die Form auf.

## Auswirkungen auf bestehende Tests

- `dosageForms.test.ts` erwartet heute
  `['vial', 'ampoule', 'tablet', 'capsule', 'nasal_spray', 'tube']`.
  **`pen` steht in `DOSAGE_FORMS` direkt nach `ampoule`** — die Liste wird also
  in der Mitte länger, nicht am Ende:
  `['vial', 'ampoule', 'pen', 'tablet', 'capsule', 'nasal_spray', 'tube']`.
  Bei den fünf vorherigen Formen wuchs sie immer hinten; wer das übersieht,
  bekommt einen Fehlschlag, der nach einer Reihenfolgeänderung aussieht.
- `isStageRenderable('pen')` wird von `false` auf `true` gehoben.
- **Das Negativbeispiel bleibt erneut stehen.** `patch` hat weiterhin keinen
  Renderer, die Wache in `StackStage.test.ts` bleibt unangetastet.
- Die Suiten der sechs bestehenden Formen bleiben unverändert.

## Fehler- und Grenzfälle

- Fehlende `color_hex`: derselbe neutrale Rückfallwert wie bei den anderen Formen; der Ring bleibt sichtbar, nur in Grau.
- Sehr langer Name: läuft senkrecht durch, wird nie gekürzt.
- Leerer Name: Rückfall auf „Pen", nie eine leere Beschriftung.
- Fehlende Wirkstoffmenge: unerheblich, der Pen trägt nur den Namen.
- `prefers-reduced-motion`: wirkt auf den Durchlauf, wie bei allen Formen.
- Kein `sloshEngine` im Kontext: unerheblich, der Pen abonniert ihn nicht.

## Verifikation

- Aufrecht, Kappe oben, stehend auf dem Dosierknopf.
- Kein Kartuschenfenster, keine Flüssigkeit, kein Etikettband, keine Prozentzeile.
- Dosisfenster zeigt eine 0.
- Name längs, um 90 Grad gedreht, **über** dem Dosisfenster; läuft bei Überlänge senkrecht durch.
- Farbring unter der Kappe in `color_hex`; Gehäuse neutral grau.
- Der Dosierknopf ist die breiteste Stelle und bestimmt den Umriss.
- Seitenverhältnis 0,130 auf jeder Stufe; Karussellhöhe 236,8 px, ab `sm` 300,9 px.
- Gemeinsame Bodenlinie mit allen sechs bestehenden Formen.
- Jedes bewegliche Licht liegt in einem Clip — die Regel aus der Tabletten-Prüfung.
- Keine Slosh-Anbindung.
- Die Renderer-Liste enthält `pen` an **dritter** Stelle.
- `drops`, `liquid`, `powder`, `spray`, `gel` und `patch` bleiben im Textzustand.
- Keine neuen i18n-Schlüssel — `dosage_form_pen` liegt in allen Sprachen vor.

## Nicht Bestandteil dieses Teilprojekts

- eine echte Restmengenanzeige oder Patronenfüllung,
- die geplante Dosis im Fenster,
- Plandaten in der Bühnen-Schnittstelle,
- ein sichtbares Kartuschenfenster,
- weitere Darreichungsformen,
- Änderungen an den sechs bestehenden Formen, Datenbank oder Tracking-Logik.
