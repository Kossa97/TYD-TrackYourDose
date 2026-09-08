# My Stack: der Anfang des Anlege-Formulars

Stand 2026-09-08. Betrifft `SubstanceSearch.tsx`, `IngredientEditor.tsx`,
`StackItemWizard.tsx`, `wizardState.ts`.

## Der Befund

Drei Dinge, alle gemessen statt vermutet.

### 1. Ein Tastendruck warf die Katalogverknüpfung weg — lautlos

```
nach Auswahl:           katalogId: vitamin-d3   kategorie: vitamin   einheit: IU
nach einem Tastendruck: katalogId: null         kategorie: null      einheit: null
```

Das Suchfeld schickte bei jedem Anschlag ein `custom_started` los, und dessen
`wasCatalogSelection`-Zweig ersetzte den Katalog-Inhaltsstoff durch einen freien.
Mit der Katalog-ID fiel auch `selectedCatalogEntry` weg — und damit
`suggested_dosage_forms`, `suggested_units` und **das PK-Profil**, also genau
das, wofür jemand die tiefste Tracking-Stufe wählt.

Kein Hinweis, kein Rückweg außer neu suchen. Wer nach der Wahl auch nur einmal
ins Suchfeld tippte, um zu prüfen, was dort steht, hatte es zerstört.

### 2. Nach der Wahl sah der Bildschirm aus wie davor

Gemessen: Trefferliste weiter offen, „Als eigene Substanz hinzufügen" weiter da,
die eben angeklickte Karte unverändert. Nichts sagte „das hier ist gewählt".

Beide Befunde haben dieselbe Wurzel: **der Zustand „aus dem Katalog gewählt"
hatte kein Aussehen.** Er war unsichtbar, deshalb ließ er sich versehentlich
zerstören.

### 3. Der Name stand in zwei Feldern mit zwei Beschriftungen

Schritt 1 fragte „Was möchtest du hinzufügen?", der Inhaltsstoff-Schritt
„Produktname". Beide schrieben `displayName`, beide trugen
`data-field="displayName"`. Für den Nutzer zwei Dinge, für die Daten eins — und
`brand` (Marke) gibt es ohnehin separat, „Produktname" war also ein dritter
Begriff für dasselbe Feld.

## Die Entscheidungen

### Der Katalogtreffer bekommt ein Aussehen und einen Ausgang

Steht eine Katalogwahl, tritt an die Stelle des Suchfelds die Wahl selbst:

```
✓  Vitamin D3                                              ✕
   Aus dem Katalog · PK-Profil vorhanden
```

Trefferliste und „eigene Substanz"-Knopf verschwinden — es gibt keinen zweiten
Weg, solange einer gegangen ist. Der Zusatz nennt beim Namen, was die
Verknüpfung wert ist: ohne PK-Profil steht dort nur „Aus dem Katalog".

Gelöst wird über das Kreuz. Das ist eine neue Reducer-Aktion
`catalog_detached` und kein Nebeneffekt von `custom_started` mehr: sie nimmt
die Katalog-ID weg und lässt stehen, was der Nutzer selbst gesetzt hat — Name
und Kategorie. Wer löst, hat es gewollt und sieht, was passiert.

Damit ist der lautlose Pfad zu, ohne dass eine Warnung nötig wäre: man kann
nicht mehr aus Versehen tippen, weil es kein Feld gibt, in das man tippen
könnte.

### Das doppelte Namensfeld fällt weg

`IngredientEditor` hat kein `displayName` mehr. Ein Wert, ein Ort. Wer den
Namen ändern will, geht einen Schritt zurück — dafür ist die Schrittleiste da.
Ein Kombipräparat benennt man in Schritt 1 („Vitamin D3 + K2") und listet die
Wirkstoffe dann im Inhaltsstoff-Schritt.

Der Namensfehler zieht mit: er erscheint jetzt dort, wo der Name steht. Vorher
gab es ihn an zwei Stellen mit derselben `data-field`-Marke, was `focusField`
nur deshalb nicht verwirrte, weil nie beide gleichzeitig im DOM standen.

`my_stack_product_name` ist damit weg; dafür kommen `my_stack_from_catalog`,
`my_stack_from_catalog_pk` und `my_stack_detach_catalog`.

### Eine Farbe theme-fest gemacht

Die nicht gewählte Trefferkarte stand auf `border-white/10 bg-white/[0.04]` und
war auf hellem Grund unsichtbar — sie las sich als freistehender Text, nicht als
anklickbare Karte. Jetzt `slate-400` mit Alpha, das steht auf beiden Gründen.
Dieselbe Falle wie bei den Tracking-Karten; das ist ihr dritter Fund.

## Verifikation

1348 Tests grün, `tsc -p tsconfig.app.json` sauber, eslint unverändert bei 141
Altbefunden. Beide Themes gerendert gegengeprüft.

Zwei Tests halten die Befunde fest, damit sie nicht zurückkommen: dass die Wahl
sichtbar ist und das Suchfeld verschwindet, und dass Löschen nur über das Kreuz
geht und dabei Name und Kategorie stehen bleiben.
