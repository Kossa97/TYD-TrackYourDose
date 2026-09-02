# My Stack: Tube als sechste Bühnenform

**Datum:** 2026-09-02
**Branch:** `codex/my-stack-foundation`
**Status:** Vom Nutzer bestätigt
**Bereich:** My-Stack-Bühne, Darreichungsform-Renderer

## Ziel

Die Tube als sechste Bühnenform — eine Aluminiumtube, die auf ihrem schwarzen
Klappdeckel steht, mit der Quetschnaht nach oben.

Sie bringt zwei Premieren mit. Sie ist die erste Form, deren Erscheinung
**maßgeblich von der Beleuchtung** getragen wird statt von Material oder Inhalt.
Und sie ist die erste Form, die **`color_hex` überhaupt nicht benutzt**.

## Was die Tube vorfindet

| Baustein | Für die Tube |
|---|---|
| `useStageLight` | wird genutzt — und ist hier der Haupteffekt |
| `StageMarquee` | wird genutzt |
| `StageLabel` | unzulässig — kein Behälter mit sichtbarer Flüssigkeit |
| `LiquidGraphic`, `liquidGeometry` | nicht anwendbar |
| Glas-Malstapel | nicht anwendbar |
| Slosh-Anbindung | nicht anwendbar |
| `StageFormSpec` | unverändert nutzbar, `chamber: null` |

Damit steht es drei zu drei: Vial, Ampulle und Nasenspray teilen das Material,
Kapsel, Tablette und Tube teilen nur Licht und Bewegung.

## Abgenommene Produktentscheidungen

| Thema | Entscheidung |
|---|---|
| Ansicht | Aufrecht, stehend **auf dem Deckel**, Quetschnaht oben. |
| Silhouette | Durchgehend: die Naht ist die breiteste Stelle, der Körper verjüngt sich von ihren Ecken bis zum Deckel. |
| Material Körper | Aluminium, **feste Farbe**. |
| Material Deckel | Mattschwarzer Kunststoff. |
| Aufschrift | Weiß aufgedruckt. |
| Deckel | Schmaler als das Tubenende, flach, Trennfuge **durch die Daumenmulde**. |
| Übergang | Eingerundetes Tubenende hinter dem Deckel, Kehlschatten, Kantenlicht. |
| Beleuchtung | **Oberlicht**, dessen Richtung mit der Lage im Karussell kippt. |
| Höhe im Karussell | 186,4 px, am `sm`-Breakpoint 236,8 px. |
| Bewegung | Keine außer Licht. |
| `gel` | Bekommt **keinen** Renderer. |

### Warum die Naht die breiteste Stelle ist

Der erste Entwurf setzte die Quetschnaht als eigenes Rechteck mit eigener Kontur
auf einen separaten Körper. Genau diese Trennlinie ließ sie wie einen
aufgesetzten Deckel wirken.

Eine gequetschte Tube ist **ein Stück Blech**. Die Naht hat deshalb keine eigene
Kontur und keine gerundeten Ecken; sie ist der obere Abschluss desselben Pfades,
und ihre Außenecken sind zugleich die breitesten Punkte der ganzen Form. Von dort
verjüngt sich der Körper durchgehend.

### Warum `color_hex` ungenutzt bleibt

Aluminium mit fester Farbe bedeutet: alle Tuben sehen gleich aus. Das ist
bewusst abgenommen, mit der Aufschrift als Ersatz für die Farbe.

Die Folge muss beim Namen mitgedacht werden: er ist bei dieser Form das
**einzige** Merkmal, an dem zwei Einträge auseinanderzuhalten sind. Bei Kapsel,
Tablette und den Glasformen hilft die Farbe immer mit; hier nicht. Deshalb Weiß
auf hellem Metall — der zuverlässigste Kontrast — und deshalb muss der Name in
jeder Größe lesbar bleiben.

### Warum `gel` keinen Renderer bekommt

`tube` benennt einen **Behälter**, `gel` einen **Stoff**. Ein Gel kann in einer
Tube stecken, in einem Spender oder in einem Beutel. Einen Gel-Eintrag als
Alutube zu zeichnen behauptet einen Behälter, den die Daten nicht hergeben —
derselbe Grund, aus dem der generische `spray`-Schlüssel keinen Nasenspray-
Renderer bekommen hat.

## Beleuchtung

Das ist der Kern dieser Form und der Punkt, an dem mehrere Entwürfe gescheitert
sind. Die tragfähige Fassung geht von **einer Lampe über der Bühne** aus.

**Senkrecht.** Nur die Schulter zeigt zur Lampe, der senkrechte Körper wird
streifend getroffen. Die Helligkeit fällt daher von der Naht zum Deckel ab: von
72 % Weiß auf 40 % Schwarz. Frühere Entwürfe hatten rein seitliches Licht ohne
senkrechten Anteil — deshalb waren dort alle Reflexionen gleich lang von oben
nach unten, was wie satiniertes Plastik aussah.

**Waagerecht.** Die Richtung kippt mit der Lage: eine Tube unter der Lampe wird
symmetrisch beleuchtet, eine links davon von rechts oben, eine rechts davon von
links oben. Umgesetzt als Drehung des Verlaufs um bis zu **34 Grad**, gesteuert
von `lightOffset`, plus ein weicher Glanzkern, der um bis zu 17 Einheiten zur
beleuchteten Seite wandert.

**Ein Nebeneffekt, der zum Merkmal wird:** Die aktive Tube steht mittig unter der
Lampe und ist dadurch symmetrisch und am hellsten beleuchtet; die Nachbarn kippen
weg und werden dunkler. Das Bühnenlicht zeigt damit von selbst, welcher Eintrag
gewählt ist — ohne Rahmen, ohne Skalierung, und es fällt aus der Physik heraus
statt aufgesetzt zu sein.

**Fest bleiben:** die beiden Kantensäume auf der Silhouette. Sie gehören zur
Form, nicht zur Beleuchtung, und sie sind die einzigen Teile, die der Verjüngung
folgen müssen.

## Grafik

### Aufbau

Zeichenraster 120 × 294 Einheiten; die `viewBox` ist auf die Objektgrenzen
beschnitten und lautet `{ x: 21, y: 6, width: 78, height: 279 }`.

| Teil | y-Bereich | Breite |
|---|---|---|
| Quetschnaht mit feiner Riffelung | 6 … 22 | 78 (breiteste Stelle) |
| Körper, verjüngt | 22 … 242 | 78 → 54,8 |
| Eingerundetes Ende | 242 … 254 | läuft hinter den Deckel |
| Deckel | 250 … 285 | 51 |

Gesamtverhältnis 78 : 279 ≈ **0,2796**.

### Übergang zum Deckel

Vier Elemente greifen ineinander, und keines trägt allein:

1. Der Körper rundet sich ab y 242 ein, statt gerade abgeschnitten zu sein.
2. Er endet erst bei y 254 — hinter der Deckeloberkante bei 250, so wie ein
   Deckel über das Tubenende geschoben wird.
3. Ein Kehlschatten über den untersten 34 Einheiten, zunehmend auf 54 % Schwärze.
4. Ein Kontaktschatten auf den obersten 9 Einheiten des Deckels. Ohne ihn bliebe
   der Deckel oben so hell wie in seiner Mitte und die Teile flössen ineinander.

Auf der Rundung liegt ein **Kantenlicht**: ein Bogen, in der Mitte 85 % hell und
zu beiden Flanken auf null auslaufend, mit einem dunklen Bogen 1,5 Einheiten
darunter. Erst das Paar hell-über-dunkel liest sich als Kante — ein gleichmäßig
heller Strich sieht aufgemalt aus.

### Deckel

Schmaler als das Tubenende, wodurch am Übergang eine Schulter entsteht. Höhe zu
Breite 35 : 51 ≈ **0,69**. Die **Trennfuge läuft quer durch die Daumenmulde**, bei 60 %
ihrer Höhe, über die volle Deckelbreite — so öffnet ein Klappdeckel: die Fuge ist
die Öffnung, die Mulde der Angriffspunkt. Darunter eine hauchfeine helle Linie
als Lippe des unteren Teils, sonst liest sich die Fuge als aufgemalter Strich.

Die Mulde ist eine Vertiefung, kein Aufkleber: oben Schatten, nach unten heller,
die Unterkante fängt Licht.

### Beschriftung

Weiß aufgedruckt, mittig auf **46 % der Objekthöhe**.

Der Einzug wird **aus der Verjüngung hergeleitet**, nicht pauschal gesetzt: auf
Namenshöhe misst der Körper 66,2 von 78 Einheiten, macht **7,59 % Einzug pro
Seite**.

Das ist die Umkehrung des Nasenspray-Falls. Dort war die viewBox ebenfalls auf
den Umriss beschnitten, aber der Körper hatte auf Etiketthöhe die volle Breite —
ein prozentualer Einzug landete deshalb auf der Innenkontur, und der richtige
Wert war null. Hier ist der Körper auf Namenshöhe schmaler als die viewBox, und
null wäre falsch. Derselbe Fehler, andere Richtung.

Bei Überlänge läuft der Name durch, wie bei allen Formen.

## Bühne

| Stufe | Höhe | Breite |
| --- | --- | --- |
| `large` | 464 px | 129,7 px |
| `carousel` | 186,4 px, `sm` 236,8 px | 52,1 px, `sm` 66,2 px |
| `compact` | 140 px | 39,1 px |
| `mini` | 76 px | 21,2 px |

Dieselbe Sprosse wie das Nasenspray. Maßstäblich wäre eine Salbentube bei
3,6 px/mm rund 470 px hoch und würde die Reihe erschlagen — derselbe Konflikt,
dieselbe Auflösung. Die Breiten liegen mit 52,1 und 66,2 px sehr nah an denen des
Nasensprays (50,5 und 64,1 px); die beiden großen stehenden Objekte stehen damit
ruhig nebeneinander.

## Architektur

Neu, ausschließlich in `extensions/tube/`:

| Datei | Verantwortung |
|---|---|
| `tubeShape.ts` | Konturen, Deckelmaße, Namenslage samt hergeleitetem Einzug, `StageFormSpec`. Reine Daten. |
| `TubeVisual.tsx` | Blech, Deckel, Beleuchtung, Aufschrift. |
| `TubeRenderer.tsx` | Adapter von `StackItem`. Kein `SloshProvider`. |

Geändert: `dosageForms.ts` erhält `stageRenderer: 'tube'` und `stageForm` beim
Eintrag `tube`; `StackStage.tsx` verzweigt zusätzlich darauf; `__VialPreview.tsx`
nimmt die Form auf.

## Auswirkungen auf bestehende Tests

- `dosageForms.test.ts` erwartet heute `['vial', 'ampoule', 'tablet', 'capsule', 'nasal_spray']`
  und `isStageRenderable('tube') === false`. Beides wird gehoben; `tube` steht in
  `DOSAGE_FORMS` nach `patch`, die Liste endet also auf `'tube'`.
- **Das Negativbeispiel bleibt erneut stehen.** `patch` hat weiterhin keinen
  Renderer, die Wache in `StackStage.test.ts` bleibt unangetastet und grün.
- `gel` kommt als weiterer Beleg dazu, dass Formen ohne Renderer im Textzustand
  bleiben.
- Die Suiten von Vial, Ampulle, Kapsel, Tablette und Nasenspray bleiben unverändert.

## Fehler- und Grenzfälle

- Fehlende `color_hex`: unerheblich, die Form benutzt sie nicht.
- Sehr langer Name: läuft durch, wird nie gekürzt.
- Leerer Name: Rückfall auf „Tube", nie eine leere Beschriftung.
- Fehlende Wirkstoffmenge: die Tube trägt ohnehin nur den Namen, keine Detailzeile.
- `prefers-reduced-motion`: wirkt auf den Durchlauf, wie bei allen Formen.
- Kein `sloshEngine` im Kontext: unerheblich, die Tube abonniert ihn nicht.

## Verifikation

- Aufrecht, stehend auf dem Deckel, Quetschnaht oben.
- Die Naht hat keine eigene Kontur; die Silhouette ist durchgehend.
- Deckel schmaler als das Tubenende, mit sichtbarer Schulter.
- Trennfuge läuft **durch** die Daumenmulde, über die volle Deckelbreite.
- Kantenlicht auf der Rundung, Kehlschatten darunter, Kontaktschatten auf dem Deckel.
- Beleuchtung: hell an der Naht, dunkel am Deckel; die Richtung kippt mit
  `lightOffset` um bis zu 34 Grad, der Glanzkern wandert um bis zu 17 Einheiten.
- Die Kantensäume bleiben beim Wischen stehen.
- Aufschrift weiß, mittig auf 46 % der Höhe, 7,59 % Einzug pro Seite.
- Kein Etikettband, keine Prozentzeile, keine Slosh-Anbindung.
- Seitenverhältnis 0,2796 auf jeder Stufe; Karussellhöhe 186,4 px, ab `sm` 236,8 px.
- Gemeinsame Bodenlinie mit allen fünf bestehenden Formen.
- `gel`, `spray`, `patch` und `powder` bleiben im Textzustand.
- Keine neuen i18n-Schlüssel — `dosage_form_tube` liegt in allen Sprachen vor.

## Nicht Bestandteil dieses Teilprojekts

- der `gel`-Schlüssel,
- eine Füllstandsanzeige für die Tube,
- eine gequetschte oder aufgerollte Tube als Zustand,
- weitere Darreichungsformen,
- Änderungen an den fünf bestehenden Formen, Datenbank oder Tracking-Logik.
