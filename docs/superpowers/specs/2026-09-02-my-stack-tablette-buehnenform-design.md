# My Stack: Tablette als vierte Bühnenform

**Datum:** 2026-09-02
**Branch:** `codex/my-stack-foundation`
**Status:** Vom Nutzer bestätigt
**Bereich:** My-Stack-Bühne, Darreichungsform-Renderer

## Ziel

Die Tablette als vierte Bühnenform — und die erste **undurchsichtige**. Vial,
Ampulle und Kapsel sind alle durchscheinende Hüllen mit einem Innenraum. Eine
Tablette ist gepresstes Pulver: matt, massiv, ohne Wand und ohne Inneres.

Sie ist außerdem die einzige Form mit `divisible`. Diese Eigenschaft bekommt
zum ersten Mal einen sichtbaren Ausdruck.

## Was die Tablette vorfindet

| Baustein | Für die Tablette |
|---|---|
| `useStageLight` | wird genutzt |
| `StageMarquee` | wird genutzt |
| Glas-Malstapel (Tiefe, Wand, Sweep, Innenclip) | **nichts davon anwendbar** |
| `LiquidGraphic`, `liquidGeometry` | nicht anwendbar |
| `StageLabel` | unzulässig — kein Behälter mit Flüssigkeit |
| `StageFormSpec` | unverändert nutzbar, `chamber: null` |

Dritte Runde mit demselben Ergebnis: **Geteilt werden Licht und Bewegung, nicht
Material.** Das Glas von Vial, Ampulle und Kapsel trägt hier gar nichts bei.

## Abgenommene Produktentscheidungen

| Thema | Entscheidung |
|---|---|
| Ansicht | Flach von oben, voller Kreis. |
| Bruchrille | Waagerecht, durchgehend durch die Mitte. |
| Name | Unterhalb der Rille, auf der Tablette. |
| Größe | 62 px im Karussell — bewusst größer als maßstäblich. |
| Bruchmenge | Wird nicht dargestellt; die Tablette ist immer ganz. |
| Material | Mattes Presspulver, undurchsichtig, in `color_hex`. |
| Bewegung | Anrollen beim Wischen, gedämpft einpendelnd. Dazu Stage-Light. |

### Warum die Größe nicht maßstäblich ist

Aus dem Vial folgt der Maßstab: 80 px entsprechen rund 22 mm, also 3,6 px pro
Millimeter. Eine typische Tablette misst 8 bis 12 mm und wäre damit 29 bis 44 px
groß. Gewählt sind **62 px**, das entspräche rund 17 mm.

Das ist eine bewusste Abwägung zugunsten der Lesbarkeit, kein Maßstabsfehler.
Bei der Kapsel ging der echte Maßstab auf, weil eine liegende Kapsel lang ist —
der Name hatte die volle Länge zur Verfügung. Ein Kreis hat das nicht:
Maßstäblich blieben für die Schrift rund 35 px nutzbare Breite, bei denen der
Name zur Andeutung verkommt.

Bei 62 px stehen unter der Rille etwa **54 px** zur Verfügung. Kurze Namen
stehen still, längere laufen durch.

### Warum keine Bruchmenge

`IntakePlanEditor` lässt ½, ⅓ und ¼ planen, die Daten existieren also. Trotzdem
zeigt die Grafik immer eine ganze Tablette.

Die Bühne zeigt den **Stack-Eintrag**, nicht eine einzelne Einnahme. In der
Schachtel liegen ganze Tabletten, auch wenn täglich eine halbe genommen wird.
Eine halbe Tablette zu zeichnen würde etwas über das Objekt behaupten, das nicht
stimmt — dieselbe Logik wie beim Ampullen-Pegel.

Hinzu kommt: `StackStage` bekommt heute nur den `StackItem`, keinen Plan. Für
eine Bruchdarstellung müssten Plandaten durch die Schnittstelle aller
Bühnenformen gereicht werden, für ein Detail, das nur eine davon betrifft.

Die Teilbarkeit bleibt sichtbar — über die Rille. Das Objekt sagt „ich lasse
mich teilen", nicht „ich bin geteilt".

### Warum sie rollt, statt zu wackeln

Ursprünglich war beschlossen: keine Bewegung, eine liegende Tablette wackelt
nicht. Das ist für das *Wackeln* richtig geblieben — nur liegt eine Tablette
lose auf der Bühne, und ein Wisch stößt sie an.

Sie abonniert daher dieselbe Feder wie die Flüssigkeiten (`sloshEngine`), wertet
sie aber anders aus: statt eines Pegels ergeben sich Versatz und Drehung. Beide
sind über die **Rollbedingung** gekoppelt — eine Scheibe, die sich um den Winkel
theta dreht, wandert um `r * theta` weiter. Wären sie getrennt gewählt, würde die
Tablette rutschen statt zu rollen.

Der Winkel ist auf 8 Grad begrenzt, damit der aufgedruckte Name lesbar bleibt.
Die Feder schwingt über und läuft auf null zurück: sobald die Tablette zur Ruhe
kommt, liegt sie mittig und gerade.

**Von oben zeigt nur die Bruchrille die Drehung.** Ein Kreis sieht gedreht
identisch aus; Rille und Name sind die einzigen Drehanzeiger, die eine
Draufsicht hat. Der Lichtfleck dreht sich ausdrücklich *nicht* mit — eine
Reflexion kommt von der feststehenden Lampe, nicht vom Körper.

Echtes Rollen auf der Kante bliebe der Seitenansicht vorbehalten und ist hier
nicht gemeint; die Silhouette bleibt die Draufsicht.

## Grafik

### Körper

Ein Kreis, flach von oben. Die gewölbte Oberfläche entsteht aus einem radialen
Verlauf mit Lichtquelle oben links: hell an der Wölbung, zur lichtabgewandten
Seite hin dunkler. Dazu ein weicher Lichtfleck im oberen linken Viertel und ein
Bodenschatten darunter.

`color_hex` färbt **das Material selbst**, nicht eine Tönung darüber. Bei einem
undurchsichtigen Körper ist die Farbe das Material; der Verlauf moduliert nur
Helligkeit.

Kein Tiefengradient an den Kanten, keine zweite Kontur, kein Sweep durch den
Körper. All das setzt durchscheinendes Material voraus, das hier fehlt.

### Bruchrille

Waagerecht durch die Mitte, über den vollen Durchmesser. Gezeichnet als
Vertiefung: eine dunkle Linie mit einer helleren Kante unmittelbar darüber — die
lichtzugewandte Oberkante der Rille.

Sie ist der sichtbare Ausdruck von `divisible` und das einzige Merkmal, das eine
Tablette von einem Dragée unterscheidet. Deshalb läuft sie durch und wird nicht
zu Randkerben verkürzt.

### Beschriftung

Der Name sitzt **unterhalb** der Rille, mit seiner Mitte auf **62 % der Höhe**
des Kreises — also ein Viertel des Radius unter der Mittellinie. Dort ist die
Sehne breit genug und der Abstand zur Rille sichtbar.

Technik identisch zur Kapsel: HTML statt SVG-Text, exakt die Klassen des
Etikettnamens, `StageMarquee` bei Überlänge, und Beschnitt entlang der
Kreiskontur in objektbezogenen Einheiten.

Kein Etikettband — die Tablette ist kein Behälter mit Flüssigkeit, und die
Etikettregel bleibt unangetastet.

Die untere Hälfte ist durch die Beleuchtung dunkler als die obere. Reicht der
Kontrast der weißen Schrift dort nicht, wird der Schattenwurf verstärkt; die
Schriftfarbe selbst bleibt unverändert, damit alle Formen gleich beschriftet
sind.

## Bühne

62 px Durchmesser im Karussell, unten bündig auf der gemeinsamen Bodenlinie,
uniform skaliert. Damit liegt die Tablette zwischen Kapsel (32 px) und den
stehenden Formen (147 px).

Die vier Stufen, analog zu Kapsel und Ampulle:

| Stufe | Durchmesser |
| --- | --- |
| `large` | 160 px |
| `carousel` | 62 px |
| `compact` | 96 px |
| `mini` | 40 px |

Wie die Kapsel wächst sie am `sm`-Breakpoint nicht mit und schrumpft auf sehr
schmalen Geräten mit dem Slot.

`StageFormSpec` bekommt **kein neues Feld**. `chamber: null` liefert wieder
beides: kein Etikett und keine Prozentzeile.

## Architektur

Neu, ausschließlich in `extensions/tablet/`:

| Datei | Verantwortung |
|---|---|
| `tabletShape.ts` | Kreisgeometrie, Rillenlage, Namenslage, `StageFormSpec`. Reine Daten. |
| `TabletVisual.tsx` | Körper, Rille, Lichtfleck, Beschriftung. |
| `TabletRenderer.tsx` | Adapter von `StackItem` auf `TabletVisual`. |

Geändert: `dosageForms.ts` erhält `stageRenderer: 'tablet'` und `stageForm` beim
Eintrag `tablet`; `StackStage.tsx` verzweigt zusätzlich darauf.

Kein neuer geteilter Baustein. `useStageLight` und `StageMarquee` liegen bereits
in `stage/` und werden unverändert benutzt.

## Fehler- und Grenzfälle

- Fehlende `color_hex`: derselbe neutrale Rückfallwert wie bei den anderen Formen.
- Sehr langer Name: läuft durch, wird nie gekürzt.
- Leerer Name: Rückfall auf „Tablette", nie eine leere Beschriftung.
- `prefers-reduced-motion`: wirkt auf den Durchlauf, wie bei allen Formen.
- Kein `sloshEngine` im Kontext: die Tablette bleibt schlicht ruhig liegen.

## Verifikation

- Kreis, flach von oben, Seitenverhältnis 1:1 bei jeder Größe.
- Bruchrille waagerecht und über den vollen Durchmesser.
- Name unterhalb der Rille, entlang der Kreiskontur beschnitten.
- Keine SVG-Textelemente in `TabletVisual.tsx`.
- Kein Glas-Malstapel: keine zweite Kontur, kein Sweep, kein Innenclip.
- Die Tablette rollt beim Wischen an und pendelt auf null ein; Versatz und Drehung erfüllen `s = r * theta`.
- Kein Etikett, keine Prozentzeile.
- `StackStage` verzweigt korrekt; Formen ohne Renderer bleiben im Textzustand.
- **Die Suiten von Vial, Ampulle und Kapsel bleiben unverändert grün.**
- Keine neuen i18n-Schlüssel.

## Nicht Bestandteil dieses Teilprojekts

- weitere Darreichungsformen,
- die Darstellung der geplanten Bruchmenge,
- Plandaten in der Bühnen-Schnittstelle,
- eine perspektivische Ansicht für irgendeine Form,
- Änderungen an Vial, Ampulle, Kapsel, Datenbank oder Tracking-Logik.
