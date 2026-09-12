# My Stack — Aufarbeitung des Anlege-Formulars

**Datum:** 2026-09-07
**Betrifft:** `StackItemWizard`, `TrackingLevelPicker`
**Status:** umgesetzt

Drei Befunde, alle im Browser bei 430 px gemessen, nicht geschätzt.

## 1. Der Vorschaublock fraß den Schritt

Der große Block (Objekt + Farbfeld) stand über **jedem** Schritt. Auf dem
Tiefenschritt hieß das:

| | vorher | nachher |
|---|---|---|
| Höhe des Blocks | 368 px | 118 px |
| Anteil der Inhaltsfläche (687 px) | 54 % | 17 % |
| Frage beginnt bei | y = 541 von 900 | y = 288 |
| Karten vollständig sichtbar | **0 von 3** | 2 von 3 |

Man musste scrollen, um überhaupt zu sehen, dass es drei Stufen gibt.

**Jetzt:** der große Block steht nur auf dem Schritt, auf dem man das Aussehen
wählt — dort gehören Form und Farbe zusammen. Auf allen weiteren Schritten
bleibt eine Zeile: das Objekt klein, daneben der Name. Der Formname steht nicht
dabei; das sagt das Objekt. Wer die Farbe ändern will, geht einen Schritt
zurück.

## 2. Der Fortschrittsbalken war voll, bevor es losging

`wizardSteps` liefert drei Schritte, solange keine Tiefe gewählt ist, danach
fünf oder acht. Gemessen:

```
Schritt 1: 1 von 3    Schritt 2: 2 von 3    Schritt 3: 3 von 3   ← sieht fertig aus
nach der Wahl „Vollständig“: 3 von 8       ← der Balken springt zurück
```

**Jetzt:** solange die Zahl offen ist, wird keine behauptet. Die bekannten
Schritte stehen da, dahinter ein blasses, gestreiftes Restfeld; `aria-valuemax`
fehlt und `aria-valuetext` sagt, dass die weiteren Schritte von der Tiefenwahl
abhängen. Sobald sie feststeht, steht auch die Zahl.

## 3. Derselbe Satz dreimal

„Du kannst diese Auswahl später jederzeit ändern" stand in jeder der drei
Karten. Er gilt der Wahl, nicht einer Stufe — jetzt steht er einmal unter der
Gruppe.

Die vier Aussagen je Karte (Erfasst / Nicht erforderlich / Beispiel / Als
Nächstes) **bleiben vollständig**. Der Test hielt das als Vertrag fest, und der
Vertrag ist richtig: man muss die Stufen vergleichen können, *bevor* man wählt.
Wer die Angaben hinter die Auswahl legt, macht den Vergleich unmöglich. Gekürzt
wurde deshalb nur der Satz, nicht der Inhalt: engere Zeilen, kleinere
Grundschrift, weniger Polster — das reichte für eine Karte mehr im Bild.

## Nicht angefasst

**„Vollständig" ist ein Urteil, keine Beschreibung** — es sagt den anderen
beiden Stufen, sie seien unvollständig. „Mit Produktdaten" beschriebe dasselbe
neutral. Der Schlüssel steht in **14 Sprachdateien**; sechs davon kann ich nicht
verantwortlich übersetzen. Das gehört zu einer Runde mit Übersetzung, nicht
hier hinein.

## Geprüft

`StackItemWizard.interaction.test.tsx` — kein `aria-valuemax` und ein Restfeld,
solange die Tiefe offen ist; danach beides umgekehrt. Großer Block nur auf dem
Formschritt, danach die Zeile ohne Farbfeld.
`TrackingLevelPicker.test.tsx` — alle vier Aussagen weiterhin auf jeder Karte,
der Änderungshinweis genau einmal.

---

## Nachtrag 2026-09-12 — der Schritt „Inhaltsstoffe" erklärte sich nicht

**Befund.** Der Schritt bestand aus genau zwei Dingen: einem Feld, in dem der
Name schon stand, und einem Knopf „Inhaltsstoff hinzufügen". Kein Satz dazu.
Wer TB-500 gewählt hat, sieht TB-500 — und danach eine Frage, die niemand
gestellt hat: *warum steht das hier noch einmal, und was soll ich hinzufügen?*

Der Schritt hat zwei Aufgaben, beide unsichtbar:

1. Er trennt das **Produkt** vom **Wirkstoff**. Meist sind sie dasselbe; bei
   einem Kombipräparat (D3+K2, ein Vitamin-Komplex) sind sie es nicht.
2. Er legt die Zeilen an, nach denen der **nächste** Schritt fragt. „Stärke"
   fragt je Wirkstoff nach der Menge je Produkteinheit. Ohne diese Zeilen gibt
   es dort nichts zu füllen.

**Jetzt.** Drei Textblöcke, keine neue Mechanik:

| | |
|---|---|
| Überschrift | „Was steckt in deinem Produkt?" |
| Einleitung | „Meist ein einziger Wirkstoff — er steht schon da. Ein Kombipräparat bekommt je Wirkstoff eine eigene Zeile." |
| Hinweiskasten unten | „Im nächsten Schritt gibst du je Wirkstoff an, wie viel davon in einer Produkteinheit steckt — die Zahl von der Verpackung. Erst damit rechnet die App in Milligramm statt in Kapseln." |

Die Überschrift wiederholt **nicht** „Inhaltsstoffe". Das steht schon als
Untertitel über dem Schritt; ein zweites Mal darunter wäre dieselbe Doppelung,
die aus dem Formschritt bereits geflogen ist. Stattdessen dieselbe Teilung wie
beim Tiefenschritt: Bezeichnung oben, Frage im Inhalt.

Der Hinweiskasten ist in Machart und Ton der Kasten aus „Stärke"
(`my_stack_no_dosage_advice`) — er sagt, was als Nächstes kommt, statt es den
Nutzer erst dort entdecken zu lassen. Er trägt `data-ingredients-next`, damit
der Test ihn findet, ohne auf den Wortlaut zu zielen.

**Schlüssel.** `my_stack_ingredients_question`, `_intro`, `_next` — in allen 14
Sprachdateien. Deutsch und Englisch sind geschrieben, die übrigen zwölf tragen
sinnvolle Übersetzungen und bleiben ungeprüft (siehe `CLAUDE.md`).

**Geprüft.** `IngredientEditor.test.tsx` (neu, 4 Fälle): Frage als `h3`,
Einleitung vorhanden, Hinweiskasten nennt „nächsten Schritt" und
„Produkteinheit", die Überschrift ist nicht wörtlich „Inhaltsstoffe", und die
durchgezählten Zeilen samt Knopf stehen weiterhin.
