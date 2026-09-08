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
