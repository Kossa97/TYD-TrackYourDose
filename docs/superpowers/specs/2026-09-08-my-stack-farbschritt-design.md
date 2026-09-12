# My Stack: Farbe wird ein eigener Schritt

Stand 2026-09-08. Betrifft `wizardState.ts`, `StackItemWizard.tsx`.

## Der Wunsch

Farbe und Darreichungsform waren derselbe Schritt: wer eine Form waehlte, sah
sofort das Farbfeld direkt darunter, noch bevor „Weiter" gedrueckt war. Das
sollten zwei getrennte Schritte werden — erst Substanz, dann Darreichungsform
im Karussell waehlen, erst nach bewusstem „Weiter" kommt die Farbauswahl.

## Die Entscheidung

### Ein neuer Schritt zwischen `dosage_form` und `tracking_level`

`WizardStep` bekommt `'color'`, `wizardSteps()`s `gemeinsam`-Array wird zu
`['substance', 'dosage_form', 'color', 'tracking_level']`. Kein Sonderfall in
`firstInvalidField()`: die Farbe ist optional, es gibt nichts zu validieren.

### Der grosse Vorschau-Block zieht um, der Formschritt zeigt gar nichts mehr

Vorher stand das Objekt-plus-Farbfeld ueber dem `dosage_form`-Schritt selbst
— ein Nebeneffekt, keine Absicht: die zwei Karussells (aus dem vorigen Umbau)
brauchen den ganzen Bildschirm, eine zweite Vorschau darueber nahm ihnen genau
den Platz wieder weg, den sie gerade bekommen hatten. Jetzt zeigt der
Formschritt ueberhaupt keine Vorschau — die Bedingung wurde von
`state.step !== 'substance'` auf `state.step !== 'substance' && state.step
!== 'dosage_form'` erweitert. Der grosse Block (Objekt in `size="compact"` +
`ColorField`) erscheint stattdessen nur auf dem neuen `color`-Schritt; jeder
Schritt danach (Tracking-Tiefe, Inhaltsstoffe, Staerke, Plan, Review) bekommt
weiterhin die kompakte Zeile (Mini-Objekt + Name), damit man sieht, woran man
arbeitet, ohne dass ein Farbfeld jeden weiteren Schritt nach unten schiebt.

`renderStep()` bekommt einen eigenen `case 'color': return null` — der
Schritt hat keinen eigenen Inhalt, alles Sichtbare steht schon im
gemeinsamen Vorschau-Block darueber.

### i18n: ein neuer Label-Schluessel

`my_stack_step_color` ("Farbe" / "Color") fuer die Fortschrittsanzeige, in
allen 14 Sprachdateien ergaenzt (DE/EN sorgfaeltig, die uebrigen zwoelf
plausibel, aber nicht gegengelesen — siehe `CLAUDE.md`).

## Verifikation

Alle 5 hartcodierten Schrittarrays in `wizardState.test.ts` um `'color'`
ergaenzt. In `StackItemWizard.interaction.test.tsx` brauchte praktisch jede
`continueWizard()`-Zaehlung eine Anpassung, weil sich die Schrittfolge um
eins verlaengert hat — zwei Tests hatten zudem eine Annahme, die durch den
Umbau falsch wurde (dass der grosse Block schon auf dem Formschritt selbst
erscheint) und wurden neu geschrieben, statt nur die Zaehlung zu korrigieren.
`aria-valuemax` fuer die vollstaendige Tracking-Tiefe steigt von 7 auf 8.

1353 Tests insgesamt gruen, `tsc` sauber, eslint unveraendert bei 140
Altbefunden.

---

## Nachtrag 2026-09-11: kein Rahmen, volle Höhe, Farbe unten am Daumen

„Runden Rahmen entfernen, der Pen ist nicht ganz zu sehen, ruhig mehr die
Höhe des Handybildschirms ausnutzen, die Farbpalette unten anordnen damit
sie mit dem Daumen direkt besser zu erreichen ist."

### Kein Rahmen mehr

Der Vorschaukasten hatte `rounded-2xl border border-white/10 bg-white/[0.02]`
— eine eingerahmte Karte mitten im Schritt. Der Formschritt davor hatte genau
das schon hinter sich: „Kein Rahmen, kein Radius, eine durchgehend dunkle
Fläche" (siehe `DosageFormPicker`). Der Farbschritt bekommt jetzt dieselbe
Behandlung — `-mx-4`/`sm:-mx-6` holt die Fläche bis an den Dialogrand,
`bg-slate-950/60` statt Rahmen und Radius.

### Volle Höhe statt fester 220px

Der Kasten stand vorher auf `min-h-[220px]` — eine Zahl, die für die meisten
Formen reichte, für einen Pen in voller Höhe (589px bei `size="large"`, hier
skaliert auf ~300px) aber knapp war. Die Behebung ist keine größere Zahl,
sondern gar keine feste Zahl mehr: der ganze Block ist jetzt `h-full flex
flex-col`, das Objekt sitzt in einem `flex-1`-Feld darüber. Auf einem hohen
Bildschirm bekommt es entsprechend mehr Platz, auf einem niedrigen nicht mehr,
als tatsächlich da ist — dasselbe Prinzip, das die zwei Karussells im
Formschritt schon benutzen (`h-full` auf `DosageFormPicker`, geprüft in
diesem Dialog-Wrapper).

Die Skalierung selbst ist von `scale-[1.7]` auf `scale-[2]` gestiegen: mehr
Höhe im Kasten ohne ein größeres Objekt wäre nur mehr Leerraum gewesen.

### Die Farbe wandert ans untere Ende

Weil das Objekt jetzt `flex-1` ist und das Farbfeld danach als normales
Flex-Kind folgt, sitzt Letzteres automatisch am unteren Rand der Spalte — und
damit direkt über dem „Weiter"-Knopf im Footer. Das ist keine zusätzliche
Positionierung, sondern die Konsequenz der flex-1-Verteilung: das Objekt
wächst nach oben, die Bedienfläche bleibt unten, wo der Daumen sie greift.

### Gegengeprüft

1365 Tests grün, `tsc` sauber, ESLint unverändert bei 140. Im Chromium bei
390×844 mit einem Pen: Objektrahmen und Vorschaukasten überlappen sich auf
unter 2px genau (`objRect.top` 148.3 gegen `wrapRect.top` 149.75 — im Rahmen
der Sub-Pixel-Rundung der Skalierung), kein Rahmen, kein Radius mehr in der
Klasse. Das Farbfeld liegt sichtbar am unteren Bildschirmrand, direkt über
„Weiter".

---

## Nachtrag 2026-09-11, zweiter Teil: die Flaeche wird gemessen, nicht geschaetzt

„Jetzt kannst du den Bereich über der Palette perfekt mit jeder
Darreichungsform füllen, aber so, dass die Proportionen nicht verloren
gehen."

### Eine feste Zahl passt nie fuer alle

`scale-[2]` (aus dem Nachtrag davor) war fuer den Pen abgemessen — bei jeder
anderen Form blieb Luft, bei einem noch groesseren Bildschirm waere selbst
der Pen zu klein geblieben. Die feste Zahl konnte nicht gleichzeitig
„perfekt fuellen" und „nichts verlieren" fuer vierzehn verschiedene
Seitenverhaeltnisse und beliebig viele Bildschirmgroessen leisten.

### `objektSkala`: dieselbe Idee wie `object-fit: contain`

`lib/objektSkala.ts` ist eine neue, pure Funktion — kein Bezug zu
`buehnenSkala`, die absichtlich anders rechnet: `buehnenSkala` lockert den
Groessenunterschied zwischen mehreren Formen, die NEBENEINANDER in einer
Karussellreihe stehen (eine Kapsel neben einem Pen soll nicht winzig wirken,
aber auch nicht gleich gross). Hier steht immer nur ein einziges Objekt
allein in seiner Flaeche — es darf sie ganz ausfuellen, ohne Ruecksicht auf
einen Nachbarn:

```
nachHoehe  = platzHoehe  * DECKUNG / hoehe
nachBreite = platzBreite * DECKUNG / breite
skala      = min(nachHoehe, nachBreite)
```

Die knappere Seite gewinnt: ein Pen (hoch, schmal) scheitert an der Hoehe,
eine liegende Kapsel (flach, breit) an der Breite — genau das Verhalten von
`object-fit: contain`, nur fuer ein Objekt mit fester Pixelgroesse statt
eines Bildes. `DECKUNG = 0.94` laesst etwas Luft zur Kante.

### Gemessen wie im Karussell, nicht neu erfunden

Zwei Refs: `farbschrittPlatzRef` auf die `flex-1`-Flaeche (`clientHeight`/
`clientWidth`), `farbschrittVorschauRef` auf das Objekt in seiner nativen,
unskalierten Groesse (`offsetHeight`/`offsetWidth` — die ignorieren die
eigene Transform-Skala, sonst wuerde die naechste Messung die vorherige
Skalierung mitmessen und sich aufschaukeln; genau die Falle, die im
Karussell schon einmal zuschlug). Ein `ResizeObserver` auf der Flaeche
uebernimmt die Messung: kein direkter Aufruf im Effekt (der waere
`react-hooks/set-state-in-effect`), `observe()` meldet die aktuelle Groesse
sofort von selbst. Ein Wechsel der Darreichungsform baut den Beobachter neu
auf (er steht in den Abhaengigkeiten des Effekts) und erzwingt damit dieselbe
sofortige Neumessung, ohne einen zweiten Codepfad zu brauchen.

### Gegengeprueft

1370 Tests gruen (fuenf neue fuer `objektSkala`: Rueckfall auf 1 bei
ungueltigen Massen, Hoehe begrenzt ein Pen-Mass, Breite begrenzt ein
Kapsel-Mass, das Seitenverhaeltnis bleibt exakt erhalten, die Deckung laesst
Luft zur Kante), `tsc` sauber, ESLint unveraendert bei 140.

Im Chromium bei 390×844, sechs Formen nacheinander gemessen (Flaeche
358×349.75px):

| Form    | Objektbreite | Objekthoehe | begrenzt von |
|---------|-------------:|------------:|--------------|
| Pen     | 42.7px       | 328.2px     | Hoehe |
| Vial    | 180.0px      | 329.9px     | Hoehe |
| Gel     | 337.3px      | 270.0px     | Breite |
| Kapsel  | 336.5px      | 117.8px     | Breite |
| Tablette| 329px        | 329px       | beide (Kreis) |
| Pulver  | 218.2px      | 327.5px     | Hoehe |

Jede Form schoepft ihre knappere Seite bis auf die Deckung aus
(358×0.94≈336.5, 349.75×0.94≈328.7) — beide Werte treffen exakt zu.

---

## Nachtrag 2026-09-11, dritter Teil: `zoom` statt `transform`

„Die Darreichungsformen verlieren an Qualität, zudem auch die Effekte,
außerdem ist das Etikett nicht mehr so wie erstellt."

### Woran das lag

Der Nachtrag davor vergrößerte das Objekt mit `transform: scale(...)` — bis
zu 4× je nach Form. Ein CSS-Transform skaliert aber nur das schon fertig
gemalte Bild. Die Bühnenformen bringen feste Pixelwerte fuer alles mit, was
nicht die reine Form ist: `backdrop-blur-[2px]` auf dem Glasetikett,
`box-shadow` mit festen Offsets, Textgrößen wie `text-[10px]`. Bei einem
großen Transform bleiben die auf ihrer ursprünglichen, kleinen Größe
gerechnet und werden zusammen mit dem Rest hochskaliert — ein 2px-Weichzeichner
wird zu einem unverhältnismäßig weichen, verwaschenen Rand, sobald das
Objekt selbst viermal so groß im Bild steht. Genau das meldete der Nutzer:
Qualität, Effekte und das Etikett sahen nicht mehr so aus, wie sie gebaut
worden waren.

### Die Behebung: `zoom` statt `transform`

`zoom` ist kein reines Paint-Transform, sondern ändert die tatsächlichen
Layout-Maße des Teilbaums — der Browser rechnet SVG, Schrift, Schatten und
Weichzeichner beim neuen, größeren Wert neu. Ein "2px"-Weichzeichner bleibt
dadurch proportional zur neuen Größe richtig, statt als eingefrorenes,
hochskaliertes Pixelraster zu erscheinen. Fuer die Bühnenformen (SVG-Grafik,
CSS-Schatten, `backdrop-filter`) ist das genau der Unterschied zwischen
"aussehen wie gebaut" und "aussehen wie hochskaliert".

### Was sich dadurch bei der Messung ändern musste

Ein CSS-Transform ändert nie die Layout-Maße eines Elements — `offsetWidth`/
`offsetHeight` ignorieren es, deshalb konnte die vorherige Messung ungestört
auf dem schon skalierten Element weiterlaufen. `zoom` ändert diese Maße
dagegen wirklich: misst man ein Element, dessen `zoom` noch auf dem letzten
Wert steht, bekommt man die BEREITS vergrößerte Größe zurück — die nächste
Berechnung würde darauf aufbauen und sich aufschaukeln (dieselbe Falle wie
im Karussell, nur an einer neuen Stelle, weil `zoom` anders funktioniert als
`transform`).

Die Messfunktion setzt deshalb den Zoom-Wrapper vor jeder Messung explizit
auf `1` zurück, bevor sie `offsetHeight`/`offsetWidth` liest — erst dann ist
die native Größe wieder sichtbar. Der synchrone Lesezugriff auf
`offsetHeight` erzwingt den nötigen Zwischenschritt (Reflow) von selbst, kein
zusätzlicher Aufruf nötig.

### Gegengeprüft

1370 Tests grün, `tsc` sauber (die `zoom`-Eigenschaft ist in den
TypeScript-Typen fuer `CSSProperties` bereits vorhanden), ESLint unverändert
bei 140. Im Chromium bei dreifacher Geräte-Pixel-Dichte: Vial-Etikett und
Tabletten-Schrift beide randscharf, kein Verwaschen mehr sichtbar. Eine
Fensterverkleinerung und -vergrößerung nacheinander liefert exakt denselben
Zoom-Wert wie zuvor (`3.42708` vor und nach dem Wechsel) — keine
Selbstverstärkung durch die Rücksetzung vor jeder Messung.

Browser-Unterstützung fuer `zoom`: seit Firefox 126 (Mai 2024) in allen
gängigen Engines vorhanden — Chrome, Safari und Edge unterstützen es schon
deutlich länger.

---

## Nachtrag 2026-09-11, vierter Teil: die Detailstufe statt einer gezoomten Miniatur

„Es geht eher um das Etikett (die Qualität wie sie vorher war, die Form links
und rechts an den Seiten), und den Flüssigkeitseffekten und physikalischen
Animationen der Darreichungsformen."

### Das Etikett: die falsche Groessenstufe, nicht die falsche Technik

`zoom` war richtig (siehe Nachtrag davor), aber gezoomt wurde die falsche
Vorlage. Der Farbschritt rief `size="compact"` auf — die Stufe, die im Code
ausdruecklich fuer „tiny inline previews" gebaut ist: beim Vial 64px breit
mit 9px Aufschrift. `size="large"` ist die Stufe fuer „detail views (edit
form, previews)", 144px breit, mit eigenem Etikettenmass.

Der Unterschied steckt in den absoluten Werten: das Etikettenband hat
`px-1`/`py-1` (4px). Auf einem 64px breiten Vial sind 4px ein Vielfaches
dessen, was sie auf einem 144px breiten sind — und `zoom` haelt dieses
Verhaeltnis fest. Nebeneinander gemessen, beide auf 144×264 gebracht:

| | Bandbreite | Bandhoehe | Umbruch der Zeile |
|---|---|---|---|
| `large`, Zoom 1 | 93% | 34.1% | „WIRKSTOFF /" / „VIAL" |
| `compact`, Zoom 2.25 | 93% | 37.5% | „WIRKSTOFF" / „/ VIAL" |

Das Band wurde hoeher, die Aufschrift brach an einer anderen Stelle um und
der Name schnitt frueher ab — genau „die Form links und rechts an den
Seiten". Der Farbschritt rendert deshalb jetzt `size="large"`, und `zoom`
passt diese Stufe nur noch in die Flaeche ein: bei einem Pen nach unten
(0.56), bei einer Tablette nach oben (2.06).

### Die Physik: es fehlte die Engine

`DosageFormPreview` reicht eine `sloshEngine` an `StackStage` weiter, und
jeder Renderer haengt seinen `SloshProvider` nur dann ein, wenn eine da ist.
Der Farbschritt gab keine mit — also uebersprangen alle Formen den Provider,
`useSloshSubscribe()` lieferte `null` und jede Fluessigkeit stand. Der
Kommentar in `DosageFormPreview` („Kein Buehnenlicht und keine Physik")
stammt aus der Zeit, als die Vorschau eine 124px-Miniatur ueber dem Formular
war; seit sie das Hauptbild des Schritts ist, faellt der Stillstand auf.

Der Assistent haelt jetzt eine eigene Engine (`useSloshEngine()`), wie
MyStackPage und das Karussell es auch tun, und gibt sie dem Farbschritt mit.

### Was sich dadurch bewegt — und was nicht

Gemessen im Chromium (ohne `prefers-reduced-motion`, sonst schaltet die
Engine ab): das Vial zeigt **40 verschiedene Zustaende in 40 Bildern** — die
Daueroberflaeche laeuft wieder. Sie kommt aus der stetig laufenden Uhr der
Engine (`state.time`) und betrifft die Formen mit sichtbarer Fluessigkeit:
Vial, Ampulle, Tropfen, Spray, Nasenspray.

Tablette, Gel, Kapsel und Pen stehen im Ruhezustand weiterhin still, und das
ist so gebaut: sie haben keine Daueranimation, sondern antworten auf einen
Anstoss. Gegengeprueft — dieselbe Tablette im Karussell, mit einem Wischen
angeschubst: **35 verschiedene Zustaende**, sie rollt. Die Verdrahtung ist
also in Ordnung; auf dem Farbschritt gibt es nur nichts, was schiebt. Kapsel,
Pen, Pulver, Tube und Pflaster bekommen von `StackStage` ohnehin nie eine
Engine — eine liegende Kapsel schwingt nicht.

Einen Anstoss aus dem Farbfeld zu erfinden waere moeglich gewesen, ist aber
bewusst unterblieben: die Physik dieses Projekts folgt einer Ursache (die
Lage der Karte im Karussell, ein Wischen). Ein Ziehen am Farbregler bewegt
das Objekt nicht, und eine Flasche schwappen zu lassen, weil nebenan ein
Regler wandert, waere ein Effekt ohne Grund.

### Gegengeprueft

1370 Tests gruen, `tsc` sauber, ESLint unveraendert bei 140. Bei 390×844
fuellt jede Form ihre knappere Seite auf 94% und ueberlaeuft nirgends
(Pen 94% hoch, Tablette 92/94%, Gel 94% breit, Kapsel 94% breit).

---

## Nachtrag 2026-09-12: der Einzug des Etikettbandes, für alle Formen geprüft

„Bei der Ampulle ist das Etikett nicht ganz am linken Rand, bitte beheben und
für alle anderen Darreichungsformen prüfen."

### Drei Konventionen, zwei davon geraten

Das Glasband wird von sechs Formen getragen (Vial, Ampulle, Tropfen,
Nasenspray, Spray, Gel). Die sechs übrigen — Pen, Tablette, Kapsel, Pflaster,
Tube, Pulver — haben keines: ihr Name steht direkt auf dem Objekt, beim Pulver
als gebogenes SVG-Band im Körper selbst.

Bei den sechs Bandformen fanden sich drei verschiedene Regeln für den
seitlichen Einzug:

| Form | Einzug des Bandes | Kante des Körpers | Ergebnis |
|---|---|---|---|
| Ampulle | `left-[4%]` getippt | 2/72 = **2,78 %** | 1,22 % Luft je Seite |
| Vial | `left-[3.5%]` getippt | 4/120 = **3,33 %** | 0,17 % Luft je Seite |
| Tropfen | `left-0` | Körper füllt die viewBox | richtig |
| Nasenspray | `left-0` | Körper füllt die viewBox | richtig |
| Spray | `SPRAY_LABEL_INSET_PCT` | hergeleitet | richtig |
| Gel | `GEL_LABEL_INSET_PCT` | hergeleitet | richtig |

Die Regel stand längst im Code, im Kommentar des Gels: „Das Band sitzt auf dem
GLAS, nicht auf der ganzen Bühne … Der Einzug wird deshalb aus dem Körper
hergeleitet statt geraten." Ampulle und Vial hatten ihn geraten — und bei der
Ampulle ist der Fehler viermal so groß wie beim Vial und fällt auf dem
schmalen Zylinder sofort auf: ein heller Streifen nacktes Glas zwischen
Bandkante und Silhouette.

### Behebung

`AMPOULE_LABEL_INSET_PCT` und `VIAL_LABEL_INSET_PCT` werden jetzt aus
benannten Körperkanten hergeleitet (`AMPOULE_BODY`, `VIAL_BODY` — dieselben
Werte, die schon im äußeren Pfad stehen, nur nicht mehr namenlos). Die beiden
Visuals setzen `left`/`right` über den Stil, wie Gel und Spray es tun; die
getippten Prozentwerte sind aus den Klassennamen verschwunden.

Gemessen im Chromium, Bandbreite als Anteil der Objektbreite:

| Form | vorher | nachher |
|---|---|---|
| Ampulle | 92,0 % | **94,5 %** |
| Vial | 93,0 % | **93,4 %** |

Der gemessene Rest von rund einem Pixel ist der äußere Schein der Objekte, den
die Pixelmessung als „Glas" mitzählt — beim Tropfenfläschchen misst sie
deshalb sogar 102 % Glasbreite. Die Geometrie selbst ist jetzt deckungsgleich,
weil sie aus derselben Zahl kommt.

### Festgehalten

`stage/etikettEinzug.test.ts` hält die Regel für alle sechs Bandformen fest:
die hergeleiteten Werte stimmen mit der Körperkante überein, Tropfen und
Nasenspray dürfen bündig bleiben, solange ihr Körperpfad an den
viewBox-Kanten endet, und in keinem `<StageLabel …>`-Aufruf darf wieder ein
`left-[n%]` stehen. Der Test prüft bewusst nur diesen Aufruf — anderswo sind
feste Prozentwerte richtig, der Glanzstreifen des Vials etwa sitzt zu Recht
auf `left-[24%]`.

1375 Tests grün, `tsc` sauber, ESLint unverändert bei 140. Eine veraltete
Zusicherung in `PeptideVialVisual.test.ts`, die den geratenen Wert festhielt,
ist auf die neue Regel umgestellt.
