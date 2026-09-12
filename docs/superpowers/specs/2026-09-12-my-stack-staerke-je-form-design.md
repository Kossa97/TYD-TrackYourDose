# My Stack — Stärke je Darreichungsform

**Datum:** 2026-09-12
**Betrifft:** `StrengthEditor`, `dosageForms`, `wizardState`, `konzentration`
**Status:** umgesetzt

## Der Befund

Der Stärke-Schritt stellte jeder Form dieselbe Frage:

```
Wirkstoffmenge [   ] [Einheit]   pro   Produktmenge [   ] [Produkteinheit]
„Wie viel Wirkstoff ist in welcher Produktmenge enthalten? … Beispiel: 250 mg/ml"
```

Für eine Ampulle stimmt das. Für alles andere ist es bestenfalls ungenau und
im schlimmsten Fall falsch:

| Form | was der Schritt fragte | was tatsächlich gemeint ist |
|---|---|---|
| Kapsel | „Produktmenge" — leer | immer 1 Kapsel. Die Zahl ist keine Frage. |
| Gel | „Produktmenge" — leer, Einheit `g` | 50 mg pro 1 g |
| **Pulver-Vial (Peptid)** | „Produktmenge" — leer, Einheit **`vial`** | **das Lösungsmittel.** 10 mg Pulver, aufgelöst in 2 ml. |

Der Vial-Fall ist der schlimme. Vorgeschlagen war `1 vial` — und damit
schrieb der Nutzer „10 mg pro 1 Vial" hin. Das ist zwar wahr, aber nutzlos:
aus einem Vial zieht man mit einer Spritze **Milliliter** auf. Ohne die
Rekonstitution kann die App aus „0,2 ml" nie „1 mg" machen. Genau dafür gibt
es die Stufe „Gründlich".

## Die Staerke-Form

Jede Darreichungsform bekommt in der Registry eine `strengthShape` — nicht
eine Beschriftung, sondern die Aussage, **wie** ihre Stärke zustande kommt:

| shape | Formen | Bedeutung | Vorbelegung der Produktmenge |
|---|---|---|---|
| `per_unit` | Tablette, Kapsel, Pflaster, Nasenspray, Spray | die Stärke steckt in einem Stück | **1** + Stück-Einheit |
| `per_volume` | Ampulle, Pen, Tropfen | Konzentration vom Etikett | **1 ml** |
| `reconstituted` | Vial | Pulver + Lösungsmittel | **leer** + `ml` |
| `per_mass` | Pulver, Gel, Tube | abgewogen | **1 g** |
| `free` | Sonstiges | keine Annahme | leer |

Die Felder bleiben dieselben zwei Zahlenpaare. Was sich ändert, ist, was
danebensteht und womit sie vorbelegt sind — der gespeicherte Datensatz ist
unverändert, und damit auch alles, was darauf rechnet.

**Warum das Vial leer bleibt.** Bei allen anderen Formen steht die
Produktmenge auf der Packung; eine Vorbelegung nimmt dem Nutzer nur das
Tippen ab. Wie viel Lösungsmittel ins Vial kommt, steht auf keinem Etikett —
das entscheidet er beim Anmischen. Eine vorbelegte Zahl wäre dort geraten.

## Die Rekonstitution

Für `reconstituted` heißen die Felder, was sie sind:

```
Wirkstoff im Vial [10] [mg]   pro   Lösungsmittel [2] [ml]
                                    BPC-157: 10 mg pro 2 ml = 5 mg/ml
```

Und der Hinweis erklärt beide Fälle, denn `vial` trägt beide: das
lyophilisierte Peptid, das aufgelöst wird, und das fertige Fläschchen (etwa
Testosteron), bei dem beide Zahlen auf dem Etikett stehen.

**Kein neues Feld, keine Migration.** Die Rekonstitution ist keine zusätzliche
Tatsache neben der Stärke — sie **ist** die Stärke: „10 mg auf 2 ml" sagt
alles, was die App braucht. Sie ein zweites Mal in eine eigene Spalte zu
schreiben (`stack_items.reconstitution_ml` gibt es noch aus dem alten
Peptid-Tracker) hieße, dieselbe Tatsache an zwei Stellen zu pflegen und beim
Auseinanderlaufen raten zu müssen, welche gilt.

## Die Konzentration

`konzentrationProMl()` rechnet aus, was in einem Milliliter steckt, und der
Schritt schreibt es hinter die Vorschau. Sie schweigt, wo sie nichts
hinzufügt:

- Produktmenge **1 ml** — „250 mg pro 1 ml" ist die Konzentration schon.
- Produkteinheit ist kein `ml` — eine Kapsel hat keine Konzentration.
- Wirkstoffeinheit ist selbst ein Volumen — „2 ml pro 10 ml" wäre keine.

Gerundet wird auf drei Nachkommastellen: 10 mg auf 3 ml sind 3,333 mg/ml, und
die vierte Stelle beschreibt keine Menge, die jemand aufziehen kann.

Berechnet, nicht gespeichert — sie steckt bereits in den beiden Zahlen.

## Beim Formwechsel

Wer die Form ändert, ändert die Bedeutung der Produktmenge. Aus „1 Kapsel"
wird beim Wechsel auf eine Ampulle „1 ml", beim Wechsel auf ein Pulver-Vial
eine leere Zeile. Eine stehengebliebene alte Zahl wäre eine falsche Angabe,
kein geretteter Eintrag — die Einheit wurde schon vorher zurückgesetzt, jetzt
gilt dasselbe für die Zahl.

## Schlüssel

Acht neue in allen 14 Sprachen: vier Hinweise (`my_stack_strength_hint_*`),
drei Beschriftungen für die Rekonstitution und die Konzentrationszeile.
`free` behält den alten, geprüften Satz (`my_stack_no_dosage_advice`) — er
sagt genau das Richtige für eine Form, über die wir nichts wissen. Deutsch
und Englisch sind geschrieben, die übrigen zwölf übersetzt und ungeprüft
(siehe `CLAUDE.md`).

## Geprüft

`konzentration.test.ts` (7 Fälle) — Rekonstitution, Rundung, und jeder Fall,
in dem die Zeile schweigen muss.
`dosageForms.test.ts` — jede Form hat eine Staerke-Form und den passenden
Hinweis; die Zuordnung selbst ist Fall für Fall festgehalten; die Vorbelegung
schlägt nur Einheiten vor, die die Form auch kennt.
`StrengthEditor.test.tsx` — die Vorbelegung je Form, die Rekonstitutions-
Beschriftungen (und dass „Produktmenge" dort **nicht** mehr steht), die
Konzentrationszeile samt ihren Schweige-Fällen, und für alle 13 Formen ein
übersetzter Hinweis ohne Schlüssel-Durchschlag.
`wizardState.test.ts` — Kapsel bekommt die 1, das Vial beim Formwechsel die
leere Zeile.
