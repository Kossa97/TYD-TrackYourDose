# My Stack: die Tracking-Stufen aufgeräumt

Stand 2026-09-08. Betrifft `trackingDepth.ts`, `dosePlan.ts`, `wizardState.ts`,
`StackItemWizard.tsx`, `TrackingLevelPicker.tsx`, `stackInventory.ts`,
`stackItems.ts`.

## Der Befund

Die drei Stufen schalteten dies frei:

| | Menge | Titration | Produktstärke | PK | Bestand |
|---|---|---|---|---|---|
| Nur Einnahme | – | – | – | – | – |
| Mit Menge | ✓ | ✓ | – | – | – |
| Vollständig | ✓ | ✓ | ✓ | ✓ | ✓ |

Drei Dinge stimmten daran nicht.

**Der Bestand lag auf der falschen Achse.** Wie genau jemand misst, und ob er
Vorräte führt, sind zwei unabhängige Fragen. Wer nur abhakt, will trotzdem
wissen, wann die Packung leer ist — und musste dafür „Vollständig" wählen und
Produktstärken eintragen, die ihn nicht interessieren.

**„Vollständig" benannte keine Wirkung.** „Nur Einnahme" und „Mit Menge" sagen,
was erfasst wird. „Vollständig" sagte nur *viel*. Der Unterschied zur Stufe
darunter ist genau eine Angabe: der Wirkstoff je Einheit.

**Dieselbe Regel stand an vier Stellen.** `trackingDepth.ts` als Tabelle,
`dosePlan.ts` als eigenständiges `level !== 'intake_only'`, `stackInventory.ts`
als `!== 'complete'`, und `wizardState.ts` als fest verdrahtete Schrittliste.
Solange alle vier dasselbe sagen, fällt eine Abweichung nie auf.

## Die Entscheidungen

### Der Bestand hängt am eigenen Schalter

`TrackingCapabilities` kennt `inventory` nicht mehr. Der Bestand hat seinen
Schalter im Entwurf (`InventoryDraft.enabled`) — der gilt auf jeder Stufe und
ist das einzige Kriterium.

Folgen im Code: `stackInventory.saveStackItemInventory` bekommt kein
`trackingLevel` mehr übergeben — es gäbe sonst wieder eine Stelle, an der
jemand die Regel nachbaut. Die Bestandsprüfung in `stackItems.ts` prüft nur
noch den Schalter. Der Wizard würgt den Bestand beim Speichern nicht mehr ab,
und die Zusammenfassung zeigt ihn, sobald er eingeschaltet ist.

Wer die Stufe senkt, verliert seine Packungsangaben nicht mehr. Das ist als
Test festgehalten, weil es vorher genau andersherum war.

### Der Abschnitt „Produkt & Bestand" steht im Plan-Schritt

Damit der Bestand auf jeder Stufe erreichbar ist, muss er in einem Schritt
stehen, den jede Stufe hat. Das ist der Einnahmeplan — und das passt
inhaltlich: was verbraucht wird, steht direkt darüber.

Der Schritt `details` entfällt damit. Er war eine Resthalde aus Marke, Bestand
und Notizen unter einem Namen, der nichts benennt; beide Inhalte sind jetzt im
Plan-Schritt, der Abschnitt „Produkt & Bestand" wie bisher zugeklappt.

„Vollständig" hat dadurch sieben statt acht Schritte, die beiden leichten
Stufen unverändert fünf.

### Die dritte Stufe heißt „Mit Wirkstärke"

DE „Mit Wirkstärke", EN „With strength". Parallel zu „Nur Einnahme" und
„Mit Menge", und es benennt genau das, was dazukommt: die Produktstärke je
Einheit, aus der die PK-Kurve rechnet.

Der gespeicherte Wert bleibt `complete`. Umbenannt wird die Aufschrift, nicht
das Datum — eine Datenmigration wäre für einen Namen nicht zu rechtfertigen.

Mitgeändert: die Zeilen, die den Bestand als „nicht erforderlich" aufführten
(er ist jetzt überall verfügbar), und `pk_requirement_complete_tracking`, das
die Stufe in der Blutspiegel-Simulation beim Namen nennt.

Die Rückfalltexte im Code sind jetzt wortgleich mit dem deutschen Locale.
Vorher wichen sie ab, und ein Test prüfte den Rückfalltext — also einen Text,
den nie jemand sieht. Die vier Zeilen einer Karte tragen deshalb
`data-tracking-card`: der Test hält die Struktur fest, der Wortlaut steht in
den Sprachdateien und darf sich ändern.

### Die Tabelle ist die einzige Wahrheit

`trackingDepth.ts` ist der einzige Ort, an dem eine Stufe mit einer Fähigkeit
verknüpft wird.

- `dosePlanCapabilities` leitet aus `quantity` und `titration` ab.
- `wizardSteps` leitet aus `productStrength` ab: wer die Fähigkeit hat,
  bekommt `ingredients` und `strength`.
- `stackInventory` fragt gar nicht mehr nach der Stufe.

Ein Test hält fest, dass `dosePlanCapabilities` und die Tabelle dasselbe sagen,
und dass `inventory` nicht in die Tabelle zurückwandert.

## Was offen bleibt

Die Übersetzungen der dritten Stufe und der geänderten Sätze in den zwölf
Sprachen außer DE/EN sind fachlich plausibel gewählt (Wirkstärke →
*concentración*, *dosage*, *dosaggio*, *дозировка*, 함량, 规格 …), aber nicht
von Muttersprachlern geprüft. Sie sind besser als der vorherige Stand, der in
allen zwölf Sprachen behauptete, der Bestand sei nur auf der höchsten Stufe zu
haben — das war schlicht falsch.

## Verifikation

1345 Tests grün, `tsc -p tsconfig.app.json` sauber, eslint unverändert bei 141
Altbefunden (keine neuen).

---

## Nachtrag: Adjektive als Überschrift

Die Bezeichnungen „Nur Einnahme / Mit Menge / Mit Wirkstärke" sind präzise, aber
langsam zu lesen. Ein Adjektiv trägt den Blick schneller.

**Einfach – Genau – Gründlich** (EN *Simple – Precise – Thorough*).

Verworfen wurde *leicht – mittel – schwer*: „schwer" beschreibt die Last für den
Nutzer, nicht den Gewinn. Wer wählt, wie viel vom eigenen Leben er protokolliert,
liest bei „schwer" *das schaffst du wahrscheinlich nicht*. „mittel" sagt für sich
genommen gar nichts. Ebenfalls verworfen: *grob – genau – exakt* („grob" wertet
ab, genau/exakt sind nicht unterscheidbar) und *minimal – normal – maximal*
(klingt nach Einstellungsmenü).

Die drei gewählten Adjektive sind positiv oder neutral, bilden eine echte
Steigerung und beschreiben die Qualität der Aufzeichnung, nicht den Aufwand.

**Das Adjektiv ersetzt die Bezeichnung nicht, es steht darüber.** „Einfach"
allein sagt nicht, was erfasst wird — und genau das muss wissen, wer hier sein
Datenmodell wählt. In der Zusammenfassung steht umgekehrt die Bezeichnung, nicht
das Adjektiv: „Gründlich" sagt dort nichts darüber, was gespeichert wurde.

### Der Text der Karten

Jede Karte sagt jetzt, was sie zur vorherigen **hinzufügt**, und wozu das gut
ist — das beantwortet die eigentliche Frage: *warum sollte ich tiefer gehen?*

- Einfach: „Du hakst ab, dass du X genommen hast. Mehr wird nicht gefragt."
- Genau: „Zusätzlich, wie viel du genommen hast. Damit lässt sich der Verlauf
  deiner Dosis auswerten."
- Gründlich: „Zusätzlich, wie viel Wirkstoff in einer Einheit steckt. Erst damit
  ist eine Blutspiegel-Kurve möglich."

Zwei Zeilen pro Karte sind dafür entfallen:

- **„Nicht erforderlich: …"** wandert als ein Satz unter die Gruppe („Was eine
  Stufe nicht erfasst, fragt die App auch später nicht ab."). Er gilt der Wahl,
  nicht einer Stufe — dasselbe Argument wie bei „später jederzeit ändern".
- **„Als Nächstes: …"** entfällt. Ein Versprechen über den nächsten Bildschirm,
  einen Klick bevor man ihn sieht.

Sechs Zeilen pro Karte sind vier geworden.

### Zwei Farben theme-fest gemacht

Die Unterzeile stand zuerst auf `text-sky-300/70` und war im hellen Theme
ausgewaschen; sie steht jetzt auf `text-slate-400` — leise, weil sie das
Adjektiv erklärt und nicht mit ihm konkurriert.

Der PK-Hinweis stand auf festem `text-sky-200` und war im hellen Theme kaum zu
lesen. Das war schon vorher so; er steht jetzt auf `var(--accent)`, der
Akzentfarbe der App, die beide Themes kennt. In beiden Themes gegengeprüft.

---

## Nachtrag 2: von drei Karten zu einer Reihe mit Vorschau

Die drei Karten waren nicht falsch, nur zu schwer. Sechs Befunde:

1. **Der Schritt war zu schwer für seine Entscheidung.** Reversibel, niedriges
   Risiko — und belegte einen ganzen Bildschirm (≈650 px) mit drei Aufsätzen.
   Die Gestaltung sagte „wichtig", der Text „kannst du jederzeit ändern".
2. **Drei gleich schwere Kästen** führten den Blick nicht.
3. **Der Radio-Knopf war doppelt gemoppelt** — die ganze Karte war klickbar, die
   gewählte leuchtete, und der Kreis links schob jeden Inhalt 50 px nach rechts.
4. **Die Icons trugen nichts.** Kalender, Tacho, Diagramm sagten nichts, was die
   Wörter nicht schon sagten.
5. **Die Steigerung wurde behauptet, nicht gezeigt.** Ein Stapel ist keine Skala.
6. **Wir erzählten, statt zu zeigen** — und das war der eigentliche Punkt. Die
   App zeigt Dinge: die Bühnenformen, die Vorschau überm Formular, das Farbfeld.
   Der Tracking-Schritt war die einzige Stelle, die nur Prosa lieferte.

### Was jetzt dasteht

Eine Reihe aus drei Segmenten (links wenig, rechts viel — die Steigerung ist
räumlich), darunter eine Fläche, die das **Ergebnis** zeigt: ein Eintrag, wie er
nachher im Stack steht.

```
Einfach     ✓ Vitamin D3
Genau       ✓ Vitamin D3 · 1 Kapsel
Gründlich   ✓ Vitamin D3 · 1 Kapsel · 5.000 IU
```

**Zwei Zustände, beide nützlich.** Vor der Wahl steht der Vergleich aller drei
Einträge — man sieht den Unterschied, statt ihn zu lesen. Nach der Wahl steht
nur noch der gewählte Eintrag, darunter der eine Satz, was diese Stufe
*zusätzlich* erfasst. Ein leerer Kasten mit „wähle etwas" hätte nichts erklärt.

Die Radios bleiben echte Radios, nur unsichtbar (`sr-only`): Tastatur und
Screenreader bekommen dieselbe Gruppe wie vorher, das Auge eine Skala.

Der Beispielsatz („Beispiel: „1 Kapsel morgens"") ist zum Eintrag geworden —
drei i18n-Schlüssel weniger, drei neue dafür: die Überschrift der Vorschau und
je ein Detail für die beiden tieferen Stufen. `intake_only` hat kein Detail;
genau das ist seine Aussage.

**Gemessen:** 650 px → 288–331 px je nach Zustand, also rund die Hälfte.

### Farben

Das gewählte Segment trägt dieselbe Machart wie der Eintrag darunter — weiche
Akzentfläche, Akzentrand, Akzentschrift. Eine grelle Vollfläche war der erste
Entwurf; sie brach mit der übrigen App, die mit weichem Leuchten arbeitet, und
band Segment und Eintrag nicht zusammen.

Die gedämpften Vergleichseinträge standen zuerst auf `white/5` und waren auf
hellem Grund unsichtbar — Weiß mit 5 % Deckkraft gibt es auf Weiß nicht. Jetzt
`slate-400` mit Alpha, das steht auf beiden Gründen. In beiden Themes
gegengeprüft.

---

## Nachtrag 2026-09-11: „Gründlich" steht schon da, und zeigt, was es einbringt

„Ich will in dem Formular standardmäßig ‚Gründlich' vorausgewählt haben.
Zudem den Blut-Live-Spiegel und PK-Profil erwähnen und auch anhand eines
Beispieles zeigen. ‚Gründlich' besser erklären."

### Die Pflichtwahl fällt weg

Bisher war die Tiefe eine Pflichtwahl ohne Vorgabe: `trackingLevelSelected`
stand für neue Entwürfe auf `false`, der Picker bekam `value={null}`, und wer
auf „Weiter" tippte, ohne etwas anzutippen, bekam „Bitte wähle eine
Tracking-Tiefe". Das verlangte eine Entscheidung, bevor der Schritt erklärt
hatte, worin die Stufen sich unterscheiden.

Jetzt startet der Entwurf auf `complete` — der Stufe, aus der die App das
meiste machen kann. Wer weniger pflegen will, stellt zurück; das ist der
billigere Weg als eine Pflichtwahl.

### Was dabei an totem Code anfiel

`trackingLevelSelected` wurde damit konstant wahr: es gab keinen Zustand
mehr, in dem es `false` war. Drei Verzweigungen hingen daran (Schrittliste,
Pflichtfeldprüfung, Fortschrittsbalken) und wären unerreichbar geworden — ein
Flag, das nie umschlägt, mit drei Zweigen darauf, führt den nächsten Leser in
die Irre. Deshalb ist es ganz raus (neun Stellen).

Der Fortschrittsbalken verliert damit sein blasses Restfeld
(`data-progress-open`) und nennt die Schrittzahl von Anfang an. Der Fehler,
gegen den das Restfeld gebaut war — auf dem Tiefenschritt „3 von 3", dann
Sprung auf „3 von 8" —, kann nicht mehr auftreten, weil die Tiefe von Anfang
an feststeht. Stellt jemand auf eine flachere Stufe zurück, geht die Zahl von
8 auf 6: der Balken wird *voller*, nicht leerer. Das ist die harmlose
Richtung — er behauptet nie, fertig zu sein, wenn er es nicht ist.

Der Picker selbst behält `value: TrackingLevel | null` und seinen
Vergleichszustand: er ist eine eigenständige Komponente, und dass der
derzeitige Aufrufer diesen Zustand nicht mehr erzeugt, macht ihn nicht
falsch. `my_stack_step_open_count` bleibt aus demselben Grund in den
Sprachdateien stehen, wird aber vorerst nicht mehr gerendert.

### Die Kurve als Bild statt als Wort

„Erst damit ist eine Blutspiegel-Kurve möglich" war eine Behauptung über
etwas, das man an dieser Stelle nie gesehen hatte. Der neue Block unter der
gewählten tiefsten Stufe zeigt sie: zwei Einnahmen als grüne Punkte, dazwischen
der gerechnete Verlauf, in derselben Bildsprache wie der echte Live-Spiegel
(`LiveBlutspiegelChart`) — Akzentlinie über einer nach unten auslaufenden
Fläche, `#10b981` für die Einnahmen.

Der zweite Punkt sitzt bewusst auf einem Spiegel, der noch nicht bei null
ist, und der zweite Gipfel liegt höher als der erste. Das ist die eigentliche
Aussage der Stufe: die App weiß nicht nur, *dass* du genommen hast, sondern
was davon noch da war, als du das nächste Mal genommen hast.

Ausgewiesen als „Beispiel", ohne Zahlen und ohne Achsenbeschriftung — es ist
die Form der Aussage, keine Vorhersage für diese Substanz. Ob es für sie
überhaupt eine Kurve gibt, sagt weiterhin die PK-Zeile darunter.

Zwei Details: das SVG skaliert gleichmäßig (kein
`preserveAspectRatio="none"`), sonst zieht die Breite die Einnahme-Punkte zu
Ellipsen; und die Verlaufs-ID kommt aus `useId()`, weil eine feste ID
kollidiert, sobald zwei Picker gleichzeitig im Dokument stehen.

### Besser erklärt

`my_stack_tracking_complete_recorded` sagt jetzt, was die Wirkstärke *tut*,
statt nur, was sie ermöglicht: „Damit rechnet die App in Milligramm statt in
Kapseln — und weiß, wie viel davon zu jeder Stunde noch in dir ist."

Drei neue Schlüssel (`my_stack_tracking_curve_caption`, `_example`,
`_explained`) in allen vierzehn Sprachen; DE und EN sorgfältig, die übrigen
zwölf sinnvoll übersetzt, aber nicht auslieferungsreif gegengelesen (siehe
CLAUDE.md).

### Gegengeprüft

1365 Tests grün, `tsc` sauber, ESLint unverändert bei 140. Im Chromium bei
430×932: „Gründlich" vorgewählt, Kurve da, Balken bei 4 von 8, alles ohne
Scrollen im Bild.

Eine Beobachtung am Rand, nicht geändert: der Beispieleintrag steht fest auf
„1 Kapsel · 5.000 IU", auch wenn die gewählte Darreichungsform ein Vial ist.
Das stammt aus der ursprünglichen Fassung des Schritts und wäre eine eigene
Änderung.

---

## Nachtrag 2026-09-12: der Beispieleintrag zählt in der gewählten Form

„Bei ‚Genau' macht manches im Fall vom Screenshot (Testosteron – Ampulle)
keinen Sinn. Nach ‚So sähe deine Einnahme aus' steht ‚Testosteron · 1 Kapsel',
dort sollte aber immer die gewählte Darreichungsform sein."

### Die Zeile war fest verdrahtet

`my_stack_tracking_with_amount_entry` war wörtlich „1 Kapsel" und
`my_stack_tracking_complete_entry` wörtlich „1 Kapsel · 5.000 IU" — unabhängig
davon, was im Formschritt davor gewählt worden war. Bei einer Ampulle stand
also eine Kapsel im Beispiel. Der Fehler stammt aus der ersten Fassung des
Schritts, als es die Formauswahl davor noch nicht gab; im dritten Nachtrag zum
Farbschritt war er schon einmal als Beobachtung vermerkt, aber nicht behoben.

### Aus Schlüsseln wurden Vorlagen

Beide Schlüssel tragen jetzt Platzhalter statt fester Wörter:

```
my_stack_tracking_with_amount_entry: '1 {{form}}'
my_stack_tracking_complete_entry:    '1 {{form}} · {{strength}}'
```

Keine neuen Schlüssel — nur andere Inhalte, in allen vierzehn Sprachen
(dieselben Platzhalter überall, sonst schlägt der i18n-Vertrag fehl).

`{{form}}` kommt aus der Bezeichnung der gewählten Form (`labelKey`), die
ohnehin schon in allen Sprachen vorliegt — „Ampulle", „Vial", „Tablette",
„Pflaster". `{{strength}}` nimmt die Wirkstoffeinheit aus der Vorschlagsliste
derselben Form (`suggestedUnits[0]`), mit einer Größenordnung je Einheit
(IU 5.000, mcg 500, mg 250, g 5, ml 1). Die Zeile zeigt die FORM eines
Eintrags, keine Dosierungsempfehlung — deshalb runde Zahlen und deshalb steht
darüber „So sähe eine Einnahme aus".

Ohne gewählte Form bleibt das Detail leer statt „1 " als halbe Aussage
stehenzulassen.

### Gegengeprüft

Im Chromium, fünf Formen nacheinander durch den Assistenten:

| Form | Genau | Gründlich |
|---|---|---|
| Ampulle | Testosteron · 1 Ampulle | Testosteron · 1 Ampulle · 250 mg |
| Vial | Testosteron · 1 Vial | Testosteron · 1 Vial · 500 mcg |
| Tablette | Testosteron · 1 Tablette | Testosteron · 1 Tablette · 500 mcg |
| Gel | Testosteron · 1 Gel | Testosteron · 1 Gel · 250 mg |
| Pflaster | Testosteron · 1 Pflaster | Testosteron · 1 Pflaster · 500 mcg |

1377 Tests grün (zwei neue: der Eintrag zählt in der gewählten Form, und ohne
Form bleibt das Detail weg), `tsc` sauber, ESLint unverändert bei 140.

Offen geblieben, weil es eine eigene Entscheidung ist: „1 Gel", „1 Pulver" und
„1 Tube" lesen sich holprig — dort ist die Einheit in Wahrheit eine Menge
(Gramm) oder eine Anwendung, nicht das Behältnis. Die übrigen zehn Formen
zählen sich sauber. Wer das glätten will, braucht je Form ein eigenes
Einheitenwort; die Formbezeichnung allein reicht dafür nicht.

---

## Nachtrag 2026-09-12, zweiter Teil: die Einnahmeeinheit je Form

„Das ‚So sähe eine Einnahme aus' muss überarbeitet werden. Beispiel: bei einer
Ampulle werden die Einnahmen mit einer Spritze gemacht, bei einem Vial auch,
bei einem Spray sind es Sprühstöße, usw. Das müssen wir in die Datenbank
einpflegen und auch alles so überarbeiten, dass es konform ist."

### Packung ist nicht Einnahme

Der Nachtrag davor hatte den Beispieleintrag von „1 Kapsel" auf die gewählte
Form umgestellt — und damit einen Fehler durch einen kleineren ersetzt:
„1 Ampulle" beschreibt, was im Schrank steht, nicht, was man tut. Aus einer
Ampulle wird mit der Spritze aufgezogen; ein Spray gibt Sprühstöße ab; ein Gel
wird angewendet. Das ist eine dritte Größe neben den beiden, die es schon gab:

| Feld | Was es sagt | Beispiel Ampulle |
|---|---|---|
| `suggestedUnits` | worin der **Wirkstoff** gemessen wird | mg, ml, IU |
| `basisUnits` | worin das **Produkt** gemessen wird | ml, Ampulle |
| `intakeUnit` *(neu)* | womit **eine Einnahme** gezählt wird | Spritze |

### Eingepflegt, nicht geraten

`intakeUnit` ist jetzt ein Pflichtfeld jeder Definition in `DOSAGE_FORMS` —
der Registry, die für Darreichungsformen die Datenbank der App ist (in
Supabase liegt zu Formen nur der gewählte Schlüssel je Eintrag, keine
Metadaten). Der Schlüssel wird gespeichert, das Wort kommt aus der Übersetzung:

| Form | Einheit | DE |
|---|---|---|
| Vial, Ampulle | `syringe` | Spritze |
| Spray, Nasenspray | `spray` | Sprühstoß |
| Pen | `dose` | Dosis |
| Tablette / Kapsel / Tropfen / Pflaster | `tablet` / `capsule` / `drop` / `patch` | zählt sich selbst |
| Gel, Tube | `application` | Anwendung |
| Pulver | `portion` | Portion |
| Andere | `unit` | Einheit |

Zehn neue Schlüssel `my_stack_intake_unit_*` in allen vierzehn Sprachen; DE
und EN sorgfältig, die übrigen zwölf sinnvoll übersetzt (siehe CLAUDE.md).

### Konform gemacht

`intakeUnitLabelKey()` ist die eine Stelle, an der aus einer Form ihr
Einheitenwort wird — damit „Spritze" überall dasselbe Wort ist. Benutzt von:

- dem Beispieleintrag im Tiefenschritt (der Anlass),
- `getIntakePlanUnitSuggestions()`: die Einnahmeeinheit führt jetzt die
  Vorschlagsliste des Einnahmeplans an, vor den Wirkstoffmengen und den
  Packungsmaßen — was der Nutzer im Alltag zählt, steht vorn.

### Gegengeprüft

Alle zwölf Formen mit Bühnengrafik im Chromium durch den Assistenten:

```
ampoule -> 1 Spritze      vial    -> 1 Spritze     nasal_spray -> 1 Sprühstoß
spray   -> 1 Sprühstoß    pen     -> 1 Dosis       tablet      -> 1 Tablette
capsule -> 1 Kapsel       drops   -> 1 Tropfen     powder      -> 1 Portion
gel     -> 1 Anwendung    tube    -> 1 Anwendung   patch       -> 1 Pflaster
```

Damit sind auch die drei holprigen Fälle des vorigen Nachtrags erledigt:
„1 Gel", „1 Pulver" und „1 Tube" heißen jetzt „1 Anwendung", „1 Portion" und
„1 Anwendung".

1380 Tests grün (drei neue in `dosageForms.test.ts`: Ampulle und Vial zählen
in Spritzen, jede Form hat Einheit und Schlüssel, die Einheit führt die
Vorschläge an; der Test im Picker pinnt jetzt die Einnahmeeinheit statt der
Formbezeichnung), `tsc` sauber, ESLint unverändert bei 140.

### Offen

Die Eingabefelder für Einheit im Plan- und Stärkeschritt sind Freitext mit
Vorschlagsliste und zeigen die Schlüssel weiterhin roh („ml", „spray",
„syringe"). Sie übersetzt anzuzeigen hieße, entweder übersetzte Wörter in die
Datenbank zu schreiben — dann hinge der Inhalt an der Sprache des Nutzers —
oder die Felder von Freitext auf Auswahl umzustellen. Das ist eine eigene
Entscheidung und wurde hier nicht mitgetroffen.
