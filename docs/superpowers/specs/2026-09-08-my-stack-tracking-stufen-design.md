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
