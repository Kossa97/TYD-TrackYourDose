# My Stack: Kapsel als dritte Bühnenform

**Datum:** 2026-09-01
**Branch:** `codex/my-stack-foundation`
**Status:** Vom Nutzer bestätigt
**Bereich:** My-Stack-Bühne, Darreichungsform-Renderer

## Ziel

Die Kapsel als dritte Bühnenform — und die erste **feste** Form. Vial und
Ampulle sind beides Glasbehälter mit Flüssigkeit; erst hier zeigt sich, was von
den geteilten Bausteinen wirklich trägt.

Die Antwort ist ernüchternd und wichtig: **fast nichts.** Von fünf geteilten
Bausteinen bleibt einer.

## Was die Kapsel vorfindet

| Baustein | Für die Kapsel |
|---|---|
| `useStageLight` | wird genutzt |
| `LiquidGraphic`, `liquidGeometry` | nicht anwendbar — keine Flüssigkeit |
| `StageLabel` | unzulässig — kein Behälter mit Flüssigkeit |
| `usePrefersReducedMotion` | nicht nötig — nichts ist animiert |
| `StageFormSpec` | unverändert nutzbar, `chamber: null` |

Das bestätigt den Vorbehalt aus dem Ampullen-Spec vom 2026-08-28, wo Shell und
Kappe bewusst nicht abstrahiert wurden: Zwei gleichartige Beispiele hätten eine
falsche Abstraktion begründet.

## Abgenommene Produktentscheidungen

| Thema | Entscheidung |
|---|---|
| Lage | Liegend, flach auf der Bodenlinie. |
| Größe | Echtes Verhältnis 2,9:1, im Karussell 92 × 32 px. |
| Hülle | Durchsichtig, durchgehend aus `color_hex` getönt. |
| Beschriftung | Name direkt auf der Hülle, kein Etikettband, kein Name darunter. |
| Schrift | Exakt die des Etiketts auf Vial und Ampulle, mitsamt Durchlauf und Licht-Sheen. |
| Kontur | Neutral und durchscheinend, nie in der Eintragsfarbe — wie bei allen Formen. |
| Bewegung | Keine. Nur Glanz und Reflexe aus dem Stage-Light. |
| Kapselinhalt | Wird nicht dargestellt. |

### Warum keine Bewegung

Eine liegende Kapsel ist ein Zylinder mit runden Enden. Auf einer Fläche würde
sie wegrollen, nicht zurückschwingen. Ein Nachwippen wäre erfunden — dieselbe
Falle wie ein Füllstand, den es nicht gibt.

Damit ist die Kapsel die erste Bühnenform **ohne Physik**. Sie abonniert die
Slosh-Engine nicht. Ihr einziger Effekt ist das Stage-Light: Bloom, wandernder
Sweep, Kantenlicht und mitwandernder Bodenschatten — dieselbe Choreografie wie
bei Vial und Ampulle, nur ohne Flüssigkeit darunter.

Ein zwischenzeitlich erwogener geteilter Baustein `useRigidTilt`, der den
Federwinkel in eine Objektdrehung übersetzt hätte, **entfällt ersatzlos**. Er
war für eine stehende Kapsel gedacht und trägt liegend nicht.

### Warum kein Kapselinhalt

Sichtbares Pulver oder Pellets hinter der durchsichtigen Hülle wären reizvoll,
aber `stack_item_ingredients` kennt nur Wirkstoff, Menge und Bezugsgröße — nicht
die Beschaffenheit des Inhalts. Eine Darstellung müsste ihn erfinden. Das
bleibt einem Nachfolgeprojekt mit passender Datenerweiterung vorbehalten.

## Grafik

### Aufbau

Grundkörper ist eine **durchgehende** Kapselform über die volle Länge. Die
Kappe liegt als zusätzliche Schicht über der linken Hälfte. Dadurch gibt es
genau eine sichtbare innere Linie: die Naht am Kappenrand.

Diese Reihenfolge ist keine Stilfrage. Zeichnet man Kappe und Körper als zwei
aneinanderstoßende Teile, scheint die harte Kante des Körpers durch die
durchsichtige Kappe und erzeugt einen Streifen quer über die Kapsel.

### Material

Die Hülle nutzt den Glas-Malstapel von Vial und Ampulle, quer statt längs:
dunkle Ober- und Unterkante, klare Mitte, doppelte Kontur für die Hüllenstärke
mit `vector-effect="non-scaling-stroke"`, Lichtstreifen oben, schwächerer
Reflex unten, Bodenschatten.

Die Tönung aus `color_hex` liegt über der ganzen Hülle. Kappe und Körper teilen
**einen** Verlauf in `userSpaceOnUse`-Einheiten; bei objektbezogenen Einheiten
würden die unterschiedlich hohen Pfade dieselben Farbstopps auf verschiedene
absolute Höhen abbilden und an der Naht sichtbar springen.

### Beschriftung

Der Name steht in **HTML** über der Hülle, nicht als SVG-Text, und trägt exakt
die Klassen des Etikettnamens von Vial und Ampulle. Überlänge löst denselben
Durchlauf aus — die Kapsel benutzt dieselbe Komponente, nicht nur dieselbe
Bewegung. Darüber liegt derselbe Licht-Sheen wie auf dem Etikettband.

Der Umweg über SVG-Text mit Fase, Maske und Verläufen wurde verworfen: HTML-Text
bekommt Hinting und Subpixel-Glättung, SVG-Text nicht. Der Unterschied liegt in
der Rendering-Technik, nicht in den Parametern — kein Nachjustieren holt ihn auf.

Ein Band bekommt die Kapsel trotzdem nicht: Sie ist kein Behälter mit
Flüssigkeit, und die Etikettregel bleibt unangetastet.

## Bühne

Die Kapsel ist die erste Form, die den Höhenfaktor 1.0 bricht: Sie ist 22 % der
Vialhöhe. Vial und Ampulle sind beide 147 px hoch, die Kapsel 32 px.

Anders als bei den stehenden Formen begrenzt sie nicht die Höhe, sondern die
**Slot-Breite**. Bei 96 px Slot und Verhältnis 2,9:1 sind 92 × 32 px das
Maximum, ohne die Proportionen zu verletzen.

Sie bleibt unten bündig auf der gemeinsamen Bodenlinie und skaliert uniform.

Anders als Vial und Ampulle wächst sie am `sm`-Breakpoint **nicht** mit: Der
Slot ist dort ohnehin schon 96 px breit, und die Kapsel füllt ihn bereits. Sie
bleibt bei 92 × 32 px, während das Vial von 147 auf 186 px Höhe geht. Auf sehr
schmalen Geräten, wo der Slot auf `25vw` schrumpft, skaliert sie proportional
mit.

`StageFormSpec` bekommt **kein neues Feld**. `chamber: null` liefert bereits
beides: kein Etikett über `carriesLabel()` und keine Prozentzeile über
`hasMeaningfulFill: false`. Die Beschriftung ist Sache des Renderers — das
Karussell muss von ihr nichts wissen.

## Architektur

Neu, ausschließlich in `extensions/capsule/`:

| Datei | Verantwortung |
|---|---|
| `capsuleShape.ts` | Konturen, Nahtlage, Maße, `StageFormSpec`. Reine Daten. |
| `CapsuleVisual.tsx` | Hülle, Tönung, Reflexe, Beschriftung. |
| `CapsuleRenderer.tsx` | Adapter von `StackItem` auf `CapsuleVisual`. |

Ein geteilter Baustein kommt trotzdem hinzu: `StageLabelMarquee` wird als
`StageMarquee` exportiert. Genau der Fall, auf den das Ampullen-Spec gewartet
hat — jetzt gibt es zwei echte Konsumenten, und die Kapsel nutzt dieselbe
Komponente statt einer nachgebauten Bewegung.

Geändert: `dosageForms.ts` erhält `stageRenderer: 'capsule'` und `stageForm`
beim Eintrag `capsule`; `StackStage.tsx` verzweigt zusätzlich darauf.

## Fehler- und Grenzfälle

- Fehlende `color_hex`: derselbe neutrale Rückfallwert wie bei den anderen Formen.
- Sehr langer Anzeigename: läuft durch wie auf dem Etikett, wird nie gekürzt.
- Leerer Anzeigename: Rückfall auf „Kapsel", nie eine leere Beschriftung.
- `prefers-reduced-motion`: ohne Wirkung, da nichts animiert ist.
- Kein `sloshEngine` im Kontext: unerheblich, die Kapsel abonniert ihn ohnehin nicht.

## Verifikation

- Kontur: durchgehender Grundkörper plus Kappenschicht, genau eine sichtbare Naht.
- Tönung: ein gemeinsamer Verlauf in `userSpaceOnUse` über Kappe und Körper.
- Beschriftung: HTML mit den Klassen des Etikettnamens, kein SVG-Text.
- Kontur: dieselben neutralen Werte wie bei der Ampulle, nicht eingefärbt.
- Die Kapsel abonniert die Slosh-Engine nicht.
- Kein Etikett, keine Prozentzeile.
- Seitenverhältnis 2,9:1 bei jeder Größe.
- `StackStage` verzweigt korrekt; unbekannte Formen bleiben im Textzustand.
- **Die Testsuiten von Vial und Ampulle bleiben unverändert grün.**
- Keine neuen i18n-Schlüssel; die Kapsel zeigt ausschließlich Daten.

## Nicht Bestandteil dieses Teilprojekts

- weitere feste Darreichungsformen,
- die Darstellung des Kapselinhalts,
- eine eingefärbte Kontur — sie bliebe eine Entscheidung für alle Formen,
- Bewegung oder Physik für feste Formen,
- Änderungen an Vial, Ampulle, Datenbank oder Tracking-Logik.
