# My Stack: Ampulle als zweite Bühnenform

**Datum:** 2026-08-28
**Branch:** `codex/my-stack-foundation`
**Status:** Vom Nutzer bestätigt
**Bereich:** My-Stack-Bühne, Darreichungsform-Renderer, Flüssigkeitsdarstellung

## Ziel

My Stack zeigt heute für jeden Eintrag dasselbe Vial. Langfristig soll jede
Darreichungsform als eigenes physisches Objekt im Karussell stehen — Tablette,
Kapsel, Ampulle, Nasenspray, Pulver — in derselben Qualität wie das bestehende
Vial.

Dieses Teilprojekt macht den ersten Schritt: die **Ampulle** als vollwertige
zweite Bühnenform, und das Herauslösen der Bausteine, die beide Formen teilen.

Die Ampulle ist bewusst als erste gewählt. Sie ist wie das Vial ein Glasbehälter
mit Flüssigkeit, wodurch sich die geteilten Bausteine an einem nahen Nachbarn
herausschälen lassen, statt sie für einen Sonderfall zu erfinden. Der bewusst
in Kauf genommene Preis: ob die Abstraktion trägt, zeigt sich erst bei der
ersten festen Form.

## Ausgangslage

`PeptideVialVisual.tsx` bündelt auf 751 Zeilen mehrere Dinge, die sich sauber
trennen lassen:

- **Material** — der Flüssigkeits-Malstapel, die Glasgradienten, die
  Stage-Light-Choreografie, das Etikettenband. Formunabhängig.
- **Form** — die Shell-Kontur, die Metallkappe, das Seitenverhältnis,
  die Lage der Flüssigkeitskammer. Vial-spezifisch.

`liquidGeometry.ts` ist bereits ein reines, geteiltes Modul. `sloshEngine.ts`
und `SloshContext.tsx` sind bereits formunabhängig und werden von einer
gemeinsamen Engine pro View getrieben.

`StackStage.tsx` ist die vorhandene Weiche, `dosageForms.ts` trägt pro Form ein
optionales Feld `stageRenderer`. Aktuell ist dort nur `'vial'` gesetzt; die
übrigen dreizehn Formen fallen auf „Visual folgt“ zurück.

## Abgenommene Produktentscheidungen

| Thema | Entscheidung |
|---|---|
| Füllstand | Konstant. Die Grafik ist das Objekt, kein Messgerät. |
| Luftraum | ~88 % Füllung, entsprechend dem realen Kopfraum einer versiegelten Ampulle. |
| Bauform | Klassische Brechampulle: runde Spitze, breiter Kopf, sanfte Einschnürung, konische Schulter, gerader Zylinder, Punt im Boden. |
| Zustand | Versiegelt, nicht aufgebrochen. |
| Bruchring | Kein Farbring. `color_hex` färbt die Flüssigkeit, wie beim Vial. |
| Größe | Gleiche Gesamthöhe wie das Vial, uniform skaliert, Breite ergibt sich. |
| Etikett | Behälter mit Flüssigkeit tragen unser Etikett, alle anderen Formen keins. Wird aus der Flüssigkeitskammer abgeleitet, ist kein eigenes Feld. |
| Architektur | Nur Material wird geteilt. Shell und Kappe bleiben formspezifisch. |

### Warum kein Füllstand

Eine Ampulle ist im echten Leben Einweg: aufbrechen, aufziehen, wegwerfen. Sie
ist voll oder sie ist weg. Ein sinkender Pegel, der in Wahrheit den Restbestand
einer Schachtel abbildet, wäre eine erfundene Menge in Bildform. Die
Tracking-Tiefe-Spec vom 2026-07-25 schließt genau das aus: „Unbekannte Mengen
werden nie geschätzt.“ Dieses Prinzip gilt auch für die Grafik.

Der Luftraum von ~88 % ist keine Umgehung dieser Regel, sondern Realismus: es
gibt keine randvolle Ampulle. Er liefert nebenbei die freie Oberfläche, ohne die
`fillSloshResponse()` bei voller Füllung auf ihren Minimalwert fiele und die
Ampulle die trägste Grafik im Karussell wäre.

## Architektur

### Geteiltes Material: `src/features/my-stack/stage/`

| Datei | Verantwortung |
|---|---|
| `liquidGeometry.ts` | Umzug aus `src/components/`. Reine Geometrie der Flüssigkeitsoberfläche. |
| `LiquidGraphic.tsx` | Der vollständige Flüssigkeits-Malstapel als eine Komponente. |
| `useStageLight.ts` | Imperativer Focus-/LightOffset-Kanal samt `StageLightHandle`. |
| `StageLabel.tsx` | Das Glasband inklusive Marquee für lange Namen. |
| `types.ts` | `StageRendererProps`, `StageFormSpec`, `StageLightHandle`. |

`LiquidGraphic` enthält: Körperfüllung, Tiefen- und Seitengradient, Bodenglow,
Kaustik, zwei Refraktionsbänder, Sub-Surface-Streuband, aufsteigende Bubbles,
Oberflächenband, Wandglints, Specular-Halo und -Kern, Meniskus. Sie abonniert
die Slosh-Engine und schreibt pro Frame direkt ins DOM, ohne React-Render.

`sloshEngine.ts` und `SloshContext.tsx` bleiben unverändert an ihrem Ort.

### Formspezifisch

`src/components/PeptideVialVisual.tsx` bleibt an seinem heutigen Pfad, damit die
sieben vorhandenen Importe unberührt bleiben. Es konsumiert künftig die
geteilten Bausteine aus `stage/`, behält aber Shell-Pfad, Kappe,
Seitenverhältnis und sein Etikettenband unverändert. Ein Umzug in
`extensions/peptide/` gehört nicht in dieses Teilprojekt.

`extensions/ampoule/AmpouleVisual.tsx` — Außenkontur, Innenkontur,
Kammerrechteck, Kantenlichter, Punt, Etikettposition. Reine Formdaten plus
Komposition der geteilten Bausteine.

`dosageForms.ts` erhält `stageRenderer: 'ampoule'` beim Eintrag `ampoule`.
`StackStage.tsx` verzweigt auf `stageRenderer`; unbekannte Formen fallen
weiterhin auf „Visual folgt“ zurück.

### Was bewusst nicht abstrahiert wird

Shell-Kontur und Kappe. Zwei Glasbehälter mit Flüssigkeit sagen nicht aus, was
eine Tablette oder ein Pflaster braucht. Eine Formabstraktion aus zwei
gleichartigen Beispielen wäre geraten. Sie entsteht, wenn die erste feste Form
vorliegt.

## Bühne und Größen

Für alle Bühnenformen gilt dieselbe Regel:

- uniform skalieren, niemals in eine feste Box stauchen,
- unten bündig auf einer gemeinsamen Bodenlinie,
- pro Form ein Höhenfaktor auf dieselbe Bühnenhöhe.

Vial und Ampulle haben beide den Faktor 1.0, sind also gleich hoch. Die
Ampullenbreite ergibt sich aus ihrem eigenen Seitenverhältnis.

Im Karussell (mobil): Vial 80 × 147 px, Ampulle 38,6 × 147 px.

Das Vial wird weiterhin mit `preserveAspectRatio="none"` gerendert und dadurch
gestaucht. Das bleibt unangetastet — die Ampulle übernimmt dieses Verhalten
ausdrücklich **nicht**, sonst verlöre sie ihre Proportionen.

Wegen der geringen Breite läuft die Innenkontur mit
`vector-effect="non-scaling-stroke"`, damit die Glaswandstärke bei jeder
Skalierung sichtbar bleibt. Im Karussell werden Bubbles reduziert; die
Detailansicht zeigt den vollen Stapel.

## Grafik der Ampulle

### Kontur

Runde Spitze, breiter Kopf, der sich zur Einschnürung hin verjüngt, sanfte
Einschnürung ohne Kante, konische Schulter, gerader Zylinder, flacher Boden mit
Punt. Zwei Konturen — außen und innen versetzt — bilden die Glaswandstärke ab.
Diese Doppellinie ist das Merkmal, das den Hohlkörper von einer Silhouette
unterscheidet.

### Flüssigkeit

Die Flüssigkeit wird von der **Innenkontur** geclippt, nie von der Außenkontur.
Kammer: `x 29,4 … 90,6`, `y 146,6 … 273,4` im viewBox-System `0 0 120 294`.

Darunter bleiben ~3,6 Einheiten Glasboden stehen, in denen Punt und Bodenreflex
sitzen. Der Punt liegt hinter der Flüssigkeit und wird durch sie hindurch
gesehen.

Die Wasserlinie sitzt am Schulteransatz, also am oberen Ende des geraden Teils.
Dadurch bleibt die Kammer rechteckig und `buildLiquid()` läuft ohne
Breitenprofil — derselbe Kunstgriff, den das Vial bereits nutzt.

Diese Clip-Regel gilt ab jetzt für jede Glasform.

### Etikett

Die Regel lautet: **ein Behälter mit Flüssigkeit trägt unser Etikett.** Alles
andere trägt keins.

Das ist kein eigenes Feld, sondern wird aus der Flüssigkeitskammer abgeleitet,
die eine Form in ihren Bühnendaten ohnehin definieren muss, damit der Clip
funktioniert. Eine Form mit Kammer bekommt das Band, eine ohne nicht. Dadurch
können die beiden Angaben nicht auseinanderlaufen: es gibt kein Etikett ohne
Flüssigkeit und keine Flüssigkeit ohne Etikett.

Damit tragen Vial, Ampulle, Pen, Tropfen, Nasenspray, Spray und Flüssigkeit ein
Etikett; Tablette, Kapsel, Pulver, Gel, Pflaster und Tube nicht. Wie die Formen
ohne Etikett beschriftet werden, entscheidet das Teilprojekt, das die erste
davon einführt. Hier wird nur die Weiche gebaut.

Nicht zu verwechseln mit dem Füllstand: Vial und Ampulle haben beide eine
Flüssigkeitskammer und damit beide ein Etikett, aber nur das Vial hat einen
Pegel, der etwas aussagt. Das bleibt ein getrenntes Feld in `StageFormSpec`.

Eine bekannte Folge dieser Regel: eine Pulverdose hat im echten Leben ein
Etikett, unter dieser Regel aber keins, weil keine Flüssigkeit darin ist. Das
wird entschieden, wenn die Form Pulver drankommt.

Waagerechtes Glasband in derselben Materialsprache wie beim Vial: Milchglas,
Randlinien oben und unten, Schattenwurf, Licht-Sheen beim Durchwischen.

Zentriert auf dem Glaskörper, also zwischen Schulteransatz und Bodenrundung:
Detailansicht Oberkante 247 px, Karussell 99 px. Damit sitzt es vollständig auf
dem geraden Glas und lässt den Meniskus frei.

Name im Marquee, Wirkstoffmenge darunter. In der Detailansicht ist das Band
breit genug, dass der Name ohne Lauf steht; das Marquee bleibt auf das Karussell
beschränkt.

### Reflexe

Die Kantenlichter folgen der Kontur und biegen unten in den Bodenradius ein. Am
Kopf läuft ein zweiter Reflex die Verjüngung entlang. An der Einschnürung sitzt
ein Glanzpunkt, wo echtes Glas das Licht bündelt.

## Slosh

Die Federphysik bleibt unverändert; eine Engine treibt weiterhin alle Objekte
einer View.

Eine Anpassung ist nötig: `TILT_RISE` ist heute eine feste Zahl in
viewBox-Einheiten. Weil die Flüssigkeitskammer nicht-uniform in ihre echte
Pixelgröße abgebildet wird, bedeutet dieselbe Zahl je nach Form etwas anderes.

| | Kammer in px | Hub bei vollem Tilt | Hub relativ zur halben Breite |
|---|---|---|---|
| Vial | 74,7 × 94,1 | 10,3 px | 0,277 |
| Ampulle, fester Hub | 32,8 × 67,9 | 7,5 px | 0,455 |

Die Ampulle kippte also deutlich steiler als das Vial. Das wirkt auf einer
schmalen Säule hektisch und ist physikalisch verkehrt herum: in einem engen Rohr
bleibt die Oberfläche flacher, nicht steiler.

`buildLiquid()` erhält daher einen Parameter für das Seitenverhältnis der
Kammer, definiert als Kammerbreite geteilt durch Kammerhöhe in Pixeln. Die
**bewegten** Terme — Kipphub und wandernde Sloshwelle — skalieren mit
`chamberAspect / referenceAspect`. `referenceAspect` ist das heutige
Vialverhältnis `74,7 / 94,1 ≈ 0,794`; für die Ampulle ergibt
`32,8 / 67,9 ≈ 0,483` einen Kipphub von rund 13,4 statt 22 Einheiten. Die
**ruhenden** Terme — Bauch und Kapillaranstieg — bleiben unverändert.

Ohne Angabe verhält sich `buildLiquid()` exakt wie heute, damit das Vial
unverändert bleibt.

## Datenanbindung

Keine Schema-Änderung, keine Migration.

`color_hex` färbt die Flüssigkeit. `fillPct` wird für die Ampulle nicht
angebunden.

Die Prozentzeile unter dem aktiven Karusselleintrag wird an Formen gebunden,
deren Füllstand tatsächlich etwas aussagt. Bei der Ampulle entfällt sie, statt
dauerhaft „100 %“ anzuzeigen.

Wodurch das entschieden wird, ist Teil der Formdaten und nicht des Aufrufers:
`StageFormSpec` trägt ein Feld dafür, ob die Form einen aussagekräftigen
Füllstand hat. Das Vial setzt es, die Ampulle nicht. Die Karussellansicht liest
dieses Feld, statt auf die Darreichungsform zu verzweigen — sonst müsste jede
neue Form an zwei Stellen eingetragen werden.

## Fehler- und Grenzfälle

- Fehlende `color_hex`: derselbe neutrale Rückfallwert wie beim Vial.
- Fehlender Wirkstoff oder fehlende Menge: das Etikett zeigt den Namen und lässt
  die Mengenzeile leer, statt einen Platzhalterwert zu erfinden.
- Sehr lange Namen: Marquee im Karussell, Umbruch nie.
- `prefers-reduced-motion`: Slosh, Bubbles und Marquee stehen still, wie heute
  beim Vial.
- Unbekannte Darreichungsform: unverändert der „Visual folgt“-Zustand.

## Verifikation

- Reine Geometrietests für die Hub-Skalierung: gleicher Oberflächenwinkel bei
  unterschiedlichen Kammerbreiten; ohne Parameter unverändertes Verhalten.
- Strukturtests der Ampulle: `data-stack-renderer="ampoule"`, Flüssigkeit von der
  Innenkontur geclippt, Etikett an der spezifizierten Position, kein
  Füllstandsprop.
- Die Ampulle behält bei jeder Größe ihr Seitenverhältnis.
- `StackStage` verzweigt korrekt auf `stageRenderer`.
- Die Prozentzeile erscheint beim Vial und entfällt bei der Ampulle.
- Das Etikett folgt der Flüssigkeitskammer: eine Bühnenform ohne Kammer rendert
  kein Band, und keine Bühnenform liest die Darreichungsform direkt aus, um
  darüber zu entscheiden.
- **Die bestehende Vial-Testsuite bleibt unverändert grün.** Sie ist das Netz für
  den Umbau, kein neuer Test. Die `data-vial-detail`-Attribute bleiben erhalten.
- i18n-Schlüssel für die Ampullen-Texte in allen Locales.

## Nicht Bestandteil dieses Teilprojekts

- weitere Darreichungsformen,
- Änderungen am Aussehen des Vials,
- eine Formabstraktion für Shell und Kappe,
- die Beschriftung von Formen, die kein Etikett tragen können,
- Änderungen an Datenbank, Bestand oder Tracking-Logik,
- Nachbildung konkreter Herstellerverpackungen.
