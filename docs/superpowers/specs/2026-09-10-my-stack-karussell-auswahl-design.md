# My Stack: welche Darreichungsform gewählt ist, muss man sehen

Stand 2026-09-10. Betrifft `DosageFormPicker.tsx`.

## Der Befund

Aus dem laufenden Formular gemeldet: „die Karussells zeigen immer noch nicht
die jeweiligen richtigen Darreichungsformen an". Im Bild stand unter der
Überschrift „Vial", während in der oberen Reihe genauso hell und mittig eine
Kapsel stand. Dahinter steckten drei getrennte Fehler.

### 1. Die Mitte war um 29 px verschoben

`messen()` verglich `el.offsetLeft` mit `karussell.scrollLeft +
karussell.clientWidth / 2`. `offsetLeft` zählt aber vom **offsetParent**, und
das Karussell ist keines — es hat keine `position`. Jedes Objekt bekam dadurch
denselben Zuschlag von 29 px (gemessen bei 430 px Fensterbreite), die Mitte
wurde ohne ihn gerechnet. Der Nullpunkt saß neben der sichtbaren Mitte, also
galt beim Wischen der Nachbar als zentriert und wurde ausgewählt, obwohl
mittig etwas anderes stand.

Jetzt misst `getBoundingClientRect()` beides in Bildschirmkoordinaten. Das hat
keinen Bezugspunkt, den eine CSS-Änderung woanders still verschieben kann, und
enthält den Scrollstand bereits — `scrollLeft` fällt weg.

Nachgemessen im echten Chromium, drei Wischschritte durch die obere Reihe:
zentriertes Objekt, gemeldeter Name und markierte Auswahl stimmen jetzt bei
jedem Schritt überein. Auf dem Ausgangsbild wird weiterhin nichts gemeldet —
die Regel „kein stilles Auswählen beim ersten Bild" bleibt.

### 2. Der Standplatz war halb so breit wie angeschrieben

Der Rand zum Zentrieren des ersten und letzten Objekts hing als `px-[15%]` am
Karussell. Prozentbreiten der Kinder beziehen sich aber auf die content-box,
also auf die um das Padding verkürzte Breite: aus `w-[70%]` wurden statt
260 px nur 182 px, und die Mitte des Standplatzes lag 10 px neben der
sichtbaren Mitte.

Der Rand hängt jetzt als Margin an genau den beiden Kindern
(`[&>*:first-child]:ml-[25%]`, `[&>*:last-child]:mr-[25%]`). Dann bezieht sich
`w-` auf die volle Karussellbreite, 25 % + 25 % trifft die Mitte exakt, und
bei nur einem einzigen Objekt ergeben beide Margins zusammen mit ihm genau
100 %.

Die Breite selbst ist bewusst 50 %, nicht 70 %: bei 70 % steht die Mitte zwar
allein da, aber die Nachbarobjekte liegen mittig in ihrem dann sehr breiten
Standplatz und damit komplett außerhalb des schmalen Streifens, in dem sie zu
sehen sein sollen. 50 % ist genau der Zustand, der vorher — versehentlich,
durch den Breitenfehler — auf dem Bildschirm stand und abgenommen wurde.

### 3. Zwei Karussells haben zwei Mitten, aber nur eine Auswahl

In beiden Reihen steht gleichzeitig etwas zentriert, hell und mit blauem
Spot — gewählt ist aber nur eines davon. Der Unterschied war nicht zu sehen.

Das Licht sagt jetzt zwei verschiedene Dinge: farbig und kräftig
(`rgba(56,189,248,0.42)`) über der wirklich gewählten Form, farblos und
schwach (`rgba(255,255,255,0.10)`) unter dem, was nur gerade zentriert ist.
Dazu trägt die Gewählte als Einzige die Eintragsfarbe (färbte sie alle, wäre
sie kein Zeichen mehr, sondern Hintergrund) und steht 8 % größer — vom Boden
aus skaliert, damit sie nicht über der gemeinsamen Standlinie schwebt.

`data-dosage-active` markiert genau ein Objekt im ganzen Feld. Ein Test hält
das fest, mit derselben Pointe wie schon beim Bestand und der Katalogwahl:
was man nicht unterscheiden kann, ist keine Auswahl.

## Nebenbefund: die Überschrift stimmte nicht

Schlägt der Katalog etwas vor, überschreibt das die häufigen Formen komplett —
Vitamin D3 schlägt nur `capsule` vor, also stand oben eine einzelne Kapsel,
während Vial, Tablette und Tropfen nach unten rutschten. „Häufige
Darreichungsformen" war dort eine falsche Aussage. Die Zeile heißt in diesem
Fall jetzt „Für diese Substanz" (`my_stack_suggested_dosage_forms`).

## Verifikation

15 Tests in `DosageFormPicker.test.tsx` (drei neue: genau eine Markierung
trotz zweier zentrierter Objekte, Farbe nur an der gewählten Form, Überschrift
nach Herkunft der Reihe). Die Geometrie-Stubs der Tests setzen jetzt
`getBoundingClientRect` statt `offsetLeft` — sie hingen sonst an genau der
Eigenschaft, die den Fehler verursacht hat.

1356 Tests insgesamt grün, `tsc` sauber, eslint unverändert bei 140
Altbefunden.

---

## Nachtrag am selben Tag: Bühne, Größe, Maus

Aus dem laufenden Formular kamen fünf weitere Punkte.

### Das Licht ist wieder Licht, die Farbe ist das Zeichen

Der blaue Spot unter der gewählten Form war ein zweites Signal für dieselbe
Aussage. Jetzt liegt unter jedem Objekt dasselbe gewöhnliche Bühnenlicht
(weiß, `0.16`), und es sagt nur noch, was in der Mitte steht. Was gewählt
ist, sagt die Form selbst: sie trägt als Einzige Farbe — die eigene
Eintragsfarbe, sobald es eine gibt, sonst das Cyanblau der App (`#00ccf5`).
Auf dem Formschritt steht die eigene Farbe noch nicht fest, sie kommt erst
im Schritt danach.

### Kein Rahmen, mittige Überschriften, keine Trennlinie

Die zwei Karussells sind nicht zwei Kacheln. Rahmen, Radius und der helle
Kachelgrund sind weg, die Fläche ist durchgehend dunkel und reicht per
`-mx-4` bis an den Rand des Dialogs — die angeschnittenen Nachbarn blenden
dort aus, statt an einer Kante zu enden. Was die Reihen trennt, sind ihre
Überschriften; die Linie dazwischen war eine zweite Antwort auf dieselbe
Frage.

### Die Höhe kommt vom Bildschirm, die Objektgröße von der Höhe

`h-[27dvh]` war eine geratene Zahl: unten blieb Rand stehen, auf 390×844
liefen 22 px über. Und größer wurden die Objekte davon ohnehin nicht — die
Bühnenformen bringen feste Pixelgrößen mit. Jetzt teilen sich beide Reihen
per `flex-1` den Platz, den der Schritt übrig hat, und `skalenMessen` bringt
die Objekte auf die Höhe, die ihre Reihe tatsächlich hat. Gemessen: 719 von
719 px bei 430×932, 631 von 631 px bei 390×844 — beide ohne Scrollen.

Der Maßstab untereinander wird dabei gelockert, nicht aufgegeben
(`buehnenSkala`, eigene Datei, weil dort die Entscheidung steckt): die
Zielhöhe wächst mit der 0,35-ten Potenz des Größenverhältnisses. Der Pen
bleibt sichtbar der größte, eine Kapsel daneben ist kein Krümel mehr. Die
Breite begrenzt mit — eine liegende Kapsel ist 42 px hoch, aber 140 px
breit, und lag nur nach der Höhe skaliert über ihrem Nachbarn.

`offsetHeight` statt `getBoundingClientRect`, weil es die Transform-Skalierung
ignoriert; sonst misst die zweite Messung die erste mit und die Objekte
schaukeln sich auf. Ein `ResizeObserver` hält die Größen am Platz fest,
statt sie einmal beim Start zu raten.

### Mit der Maus ließ sich nicht wischen

Am Handy wischt der Finger die Reihe nativ. Am Schreibtisch — und damit in
jeder Vorschau — tat ein Klick-Zug auf `overflow-x-auto` nichts, und das
Mausrad scrollt vertikal: das Karussell sah aus, als ließe es sich nicht
bewegen. Ein Pointer-Zug (nur `pointerType === 'mouse'`, sonst liefe er
gegen das native Scrollen) zieht die Reihe jetzt mit. Ab 4 px gilt es als
Zug: der Zeiger wird eingefangen und der Klick beim Loslassen wählt nichts
aus — wer gezogen hat, wollte wischen, nicht die Form unter dem Zeiger.

### Verifikation des Nachtrags

17 Tests in `DosageFormPicker.test.tsx`, darunter zwei neue auf
`buehnenSkala`: die Reihenfolge der Größen bleibt und das größte schöpft die
Reihe aus; die Breite begrenzt die Skalierung, schöpft ihren Standplatz aber
aus. Im echten Chromium nachgemessen: kein Objekt überlappt seinen Nachbarn
mehr, ein Mauszug bewegt `scrollLeft` von 0 auf 268.

1358 Tests grün, `tsc` sauber, eslint unverändert bei 140 Altbefunden.

---

## Nachtrag 2026-09-11: die Mechanik kommt vom Vial-Karussell

„Das jetzige lässt sich nicht wischen und hat Fehler." Die Wischmechanik ist
jetzt die des Vial-Karussells auf der Peptid-Seite (`Peptide.tsx`,
`updateVialFocus` und die Zeiger-Handler daneben), übernommen statt
nachgebaut. Drei Dinge fehlten:

### 1. Snapping muss während des Ziehens aus

`snap-mandatory` bleibt aktiv, während der Zug `scrollLeft` setzt — der
Browser zieht bei jedem gesetzten Wert sofort zum nächsten Snap-Punkt
zurück, und die Reihe klebt fest. Das Vial-Karussell schaltet Snapping für
die Dauer des Zugs ab (`snap-none`, am Element auch `snap-center` weg) und
fängt beim Loslassen von Hand ein, was in der Mitte steht. Genau das macht
die Reihe jetzt auch.

### 2. Am Schreibtisch gibt es kein Wischen

Das Mausrad scrollt vertikal, und `overflow-x-auto` nimmt davon nichts an.
Eine Radumdrehung rückt die Reihe jetzt um ein Objekt weiter, mit 280 ms
Sperre danach — sonst rauscht ein Trackpad-Wisch durch die halbe Reihe.

### 3. Prozentbreiten vertragen sich nicht mit `paddingInline`

Der Standplatz ist jetzt absolut breit (`min(12rem, 50vw)`), und der Rand
zum Zentrieren hängt wieder als `paddingInline` am Karussell — zusammen mit
`scrollPaddingInline`, das den Snap-Punkt auf dieselbe Mitte setzt. So macht
es das Vial-Karussell, und so entsteht das content-box-Problem gar nicht
erst, das vorher den Standplatz heimlich halbierte.

### Eine Reihe, zweimal gerendert

Die ganze Mechanik steckt in `DosageFormCarousel` — Messung, Zug, Rad,
Snapping, Skalierung. Der Picker reicht nur noch Überschriften und Formen
durch. Vorher stand alles doppelt im Picker, einmal für jede Reihe, mit
je eigenen Refs; dass sich beide gleich anfühlen, war damit eine Frage der
Sorgfalt statt eine der Bauart.

### Verifikation

In echtem Chromium alle drei Eingabewege gemessen: Maus-Ziehen bewegt
`scrollLeft` von 0 auf 196 und wählt „Kapsel", das Mausrad rückt weiter auf
„Vial", ein Touch-Wisch wählt „Kapsel". 1358 Tests grün, `tsc` sauber,
eslint unverändert bei 140 Altbefunden.

Ein Test hat dabei eine eigene Lücke gezeigt: „macht das zentrierte Objekt
heller" wartete auf `ampoule < 1`, und das ist schon im Ruhezustand wahr
(0,42), solange nichts gemessen wurde. Solange das Erst-Messen synchron
lief, fiel das nicht auf. Die Bedingung prüft jetzt beides zusammen —
zentriertes Objekt auf 1 UND Nachbar darunter —, was nur nach einer Messung
mit echter Geometrie gilt.

---

## Nachtrag 2026-09-11, zweiter Teil: keine Vergrößerung, dafür echte Physik

„Ich finde die Vergrößerung beim Swipen nicht gut" und „die Wischanimationen
für alle Darreichungsformen nutzen, so flüssig wie im jetzigen MyStack — es
soll unfassbar flüssig laufen."

### Die Auswahl macht nichts mehr größer

Der 6-%-Zuschlag auf die gewählte Form ist weg. Die Größe hängt jetzt nur
noch am Platz (`buehnenSkala`), nicht an der Auswahl; ein Objekt, das beim
Durchwischen anschwillt und wieder schrumpft, macht die Reihe unruhig. Dass
etwas gewählt ist, sagt allein die Farbe. Ein Test hält das fest: derselbe
`transform` vor und nach dem Wählen.

### Warum es vorher nicht flüssig sein konnte

Der Fokus lief über React-State (`setFokusJeForm`). Das heißt: jedes Bild
eines Wischvorgangs war eine Renderrunde über alle Objekte der Reihe — bei
vierzehn Bühnenformen mit ihren SVGs.

Der Bestand hatte die Antwort längst: `stage/useStageLight.ts` mit
`StageLightHandle`, und `StackStage` reicht `stageLightRef` schon durch. Das
Vial-Karussell nutzt genau das („Stage light bypasses React entirely"). Es
fehlte nur im Formular — `DosageFormPreview` reichte den Griff nicht weiter.

Jetzt meldet jede Form ihren Griff an, und der Mess-Frame schreibt Licht und
Fokus direkt in den DOM: `setStageLight(fokus, -normiert)`, dazu die
Deckkraft des Spots per `style.opacity`. Durch React geht nur noch, was sich
selten ändert — die Auswahl (einmal je Wechsel) und die Größen (einmal je
Platzänderung). Erst messen, dann schreiben, wie im Original: ein Lesen
zwischen zwei Schreiben zwingt den Browser zu einem Zwischenlayout.

### Die Formen schwappen wieder

Formen mit Inhalt — Tablette, Ampulle, Tropfen, Gel, die Sprays — hängen per
`useSloshSubscribe()` an der Flüssigkeitsphysik. Ohne `SloshProvider` liefert
der Context `null`, und sie stehen still: im Formular hing bisher nichts
daran. Die Reihe besitzt jetzt eine eigene Engine (`useSloshEngine`) und
füttert sie mit derselben Verstärkung wie das Vial-Karussell — aus dem
Scrollen (×2,6, damit auch der Nachschwung noch schwappt) und aus dem
Zeigerzug (×2,4).

### Verifikation

Im echten Chromium gemessen, ohne `prefers-reduced-motion` (sonst ist die
Physik per Absicht aus):

- **Imperativer Kanal**: `data-capsule-focus` im DOM wandert beim Wischen von
  0,40 auf 1,00 — geschrieben von der Bühnenform selbst.
- **Flüssigkeit**: 97 Frames während eines Zugs, Median 16,7 ms, p95 16,8 ms,
  **kein einziger Frame über 32 ms**. Durchgehend 60 fps.
- **Physik**: 59 verschiedene Roll-Transformationen an der Tablette während
  eines Wischvorgangs.
- **Keine Vergrößerung**: das Vial misst 120 × 220 px vor und nach dem
  Wählen.

Ein Messfehler unterwegs, der festgehalten gehört: die Tablette setzt ihr
`transform` als **SVG-Attribut**, nicht als `style.transform`. Der erste
Messlauf las `style` und meldete „keine Physik", obwohl sie lief.

1360 Tests grün (zwei neue: Fokus über den Griff, keine Vergrößerung durch
die Auswahl), `tsc` sauber, eslint unverändert bei 140 Altbefunden.
