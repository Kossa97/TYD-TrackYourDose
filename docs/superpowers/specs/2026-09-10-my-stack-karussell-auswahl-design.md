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
