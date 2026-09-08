# My Stack: die Darreichungsform-Auswahl als zwei große Karussells

Stand 2026-09-08. Betrifft `DosageFormPicker.tsx`.

## Der Wunsch

Zwei Wischreihen (schmale Standplätze, 100 px hoch, still per Antippen wählbar)
sollten zwei „ruhig große" Karussells werden — untereinander fast die gesamte
Höhe eines Handybildschirms nutzend, mit demselben Fokus-Verhalten wie das
Vial-Karussell auf der My-Stack-Seite: Objekte werden beim Wischen heller, je
näher sie der Mitte stehen, und das zentrierte Objekt **wird** die Auswahl,
ohne dass man extra antippen muss. Darunter erscheint der Name.

## Die Entscheidungen

### Größe: die vorhandene `carousel`-Stufe der Größenleiter

Jede Bühnenform kennt schon eine `carousel`-Größe — exakt für diesen Zweck
gebaut (das Vial-Karussell auf der My-Stack-Seite benutzt sie). Pen ist dort
bis 300,9 px hoch, Kapsel liegend nur 32 px — verschiedene Objekte, dieselbe
Bodenlinie. Der Wechsel von `size="mini"` auf `size="carousel"` gibt genau
das gewünschte „ruhig groß", ohne eine neue Stufe zu erfinden.

Der Standplatz hat keine feste Breite mehr (`w-[76px]` → `min-w-[84px]`): bei
„carousel"-Größe ist ein Patch 190 px breit, eine Ampulle 49 px — eine feste
Breite hätte den Patch beschnitten.

### Höhe: `dvh`, empirisch auf die Modal-Chrome kalibriert

Der Wizard-Dialog ist `h-[100dvh]` mit festem Header/Footer; `<main>` ist
`flex-1 overflow-y-auto` und bekommt den Rest. Gemessen bei 430×932: `main`
hat 719 px sichtbare Höhe. `h-[27dvh]` je Karussell (plus Labels, Rahmen,
Namens-Zeile) trifft das nahezu exakt — `scrollHeight` (719) gleich
`clientHeight` (719), kein Scrollen nötig. Bei 390×844 (kleineres Gerät):
672 von 631 px, 41 px Rest — praktisch nichts. `sm:h-[240px]` fängt größere
Breakpoints ab, wo `dvh` gegen die zentrierte Desktop-Karte nichts mehr sagt.

### Wischen wählt aus — dieselbe Mechanik wie das Vial-Karussell

`updateVialFocus` in `MyStackPage.tsx` misst bei jedem Scroll-Event (per
`requestAnimationFrame` entkoppelt) den Abstand jedes Objekts zur Mitte und
treibt daraus eine stetige Helligkeit. Das Vial-Karussell macht daraus auch
gleich die Auswahl: das der Mitte nächste Objekt wird `activePeptideId`, ganz
ohne Antippen.

Dieselbe Formel, hier auf zwei unabhängige Karussells verteilt (`messen()`,
zweimal aufgerufen, einmal je Karussell-Ref):

```
fokus = max(0.22, 1 - |Abstand/Spanne| * 0.78)
```

0,22 als Boden, damit die Nachbarn nie ganz schwarz werden — ebenfalls aus dem
Vial-Karussell übernommen, nicht neu erfunden.

Das Leuchten unter dem Objekt (vorher ein binärer An/Aus-Schalter) folgt jetzt
derselben Zahl, linear auf 0–1 umgerechnet ab dem Boden. Der `focus`-Wert an
`DosageFormPreview` ist ohnehin schon eine kontinuierliche Zahl (treibt in
jeder Bühnenform Deckkraft- und Lichtwerte) — vorher bekam er nur zwei
Zustände (1 oder 0,55) statt seiner vollen Spannbreite.

### Kein stilles Auswählen beim ersten Bild

Ein Karussell hat beim Öffnen noch keine Nutzerhandlung — trotzdem steht
*irgendein* Objekt am nächsten an der geometrischen Mitte. Würde das erste
Messen sofort auswählen, entschiede sich das Formular selbst für etwas, noch
bevor jemand etwas getan hat.

Deshalb zwei getrennte Signale in `messen()`: `melden` entscheidet, ob ein
Wechsel des nächsten Objekts auch `onSelect` auslösen darf. Der Mount-Effekt
ruft `messen(..., melden=false)` — nur die Helligkeit wird gesetzt, die
Auswahl bleibt unberührt. Jeder tatsächliche Scroll-Handler ruft
`messen(..., melden=true)`. Ein Test hält das fest, mit derselben Pointe wie
schon beim Bestand und der Katalogwahl in dieser Woche: was unsichtbar
passiert, darf nichts auswählen.

### Tippen bleibt

Der `onClick`-Handler ruft weiterhin direkt `onSelect(form.key)` — für
Tastatur- und Screenreader-Nutzer, die die Wisch-Mechanik nie auslösen. Beide
Wege laufen in denselben Reducer-Fall (`dosage_form_selected`), der bei
gleichem Wert ohnehin früh zurückkehrt (`if (state.draft.dosageForm ===
action.dosageForm) return state`) — häufiges Feuern beim Durchwischen ist
also folgenlos, kein Extra-Schutz nötig.

### Ein Fund beim Testen: kein Meta-Viewport in der Vorschau-Seite

Beim ersten Live-Check mit Playwright zeigte der Screenshot die
Desktop-Kartenform (zentriert, gerundet) statt der mobilen Vollbild-Ansicht —
`window.innerWidth` war 980, nicht die eingestellten 430. Ursache: die
Vorschau-HTML hatte kein `<meta name="viewport" content="width=device-width">`.
Ohne dieses Tag legen Browser (und Playwright-Mobile-Emulation) einen
klassischen 980-px-Fallback-Viewport zugrunde, und Tailwinds `sm:`-Klassen
(≥640 px) griffen. Kein Fehler in der Komponente — ein fehlendes Tag in der
Testseite selbst, seither immer mit dabei.

## Verifikation

13 Tests in `DosageFormPicker.test.tsx` (9 alte, unverändert grün, 3 neue):
kein stilles Auswählen beim ersten Bild, Auswahl folgt echtem Wischen (mit
`offsetLeft`/`offsetWidth`-Stubs, da jsdom nicht layoutet), stetige statt
binäre Helligkeit. 1353 Tests insgesamt grün, `tsc` sauber, eslint bei 140
Altbefunden (vorher 141 — keine neuen, einer verschwand durch die Neufassung
der Datei).

Live in echtem Chromium gegengeprüft (430×932 und 390×844, beide Themes):
Karussell-Höhe trifft die verfügbare Fläche nahezu exakt ohne Scrollen, ein
horizontales Mausrad-Wischen auf dem zweiten Karussell ändert `scrollLeft`
und aktualisiert den Namen live auf „Gel" — ganz ohne Antippen. Tippen auf
„Ampulle" funktioniert unverändert in beiden Themes.
