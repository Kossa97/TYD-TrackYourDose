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
