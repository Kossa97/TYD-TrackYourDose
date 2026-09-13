# My Stack — der Farbschritt, der nichts färbte

**Datum:** 2026-09-13
**Betrifft:** `dosageForms.showsColor`, `wizardSteps`, Farbschritt im `StackItemWizard`
**Status:** umgesetzt

## Der Befund

Gemeldet als „die Farben werden nicht angenommen". Im Browser nachgestellt:
Substanz wählen → Vial → Farbschritt → an der Fläche ziehen. Das Objekt färbt
sich mit, und beim Speichern kommt genau der gezogene Wert an
(`colorHex: "#21a1d9"`). **Der Farbwähler selbst ist in Ordnung** — Fläche,
Farbtonschiene, Übergabe an den Entwurf, alles korrekt.

Kaputt war, wem das Formular die Frage stellte.

`color_hex` wird an genau einer Stelle sichtbar: in der Bühnengrafik
(`StackStage`). Drei Formen zeigen sie dort nicht:

| Form | Grafik | zeigt `color_hex` | Farbschritt vorher |
|---|---|---|---|
| Pflaster | ja | **nein** — hautfarben, mit Absicht | Farbfeld + Objekt, Wahl ohne Wirkung |
| Tube | ja | **nein** — Aluminium, mit Absicht | Farbfeld + Objekt, Wahl ohne Wirkung |
| Sonstige (`other`) | **keine** | — | **völlig leerer Schritt** |

Bei Pflaster und Tube zog man an der Fläche, und das Objekt darüber blieb, wie
es war. Genau das beschreibt „wird nicht angenommen". Bei `other` war der
Schritt sogar ganz leer: `renderStep('color')` gibt `null` zurück, weil Objekt
und Farbfeld im gemeinsamen Vorschaublock stehen — und der ist auf
`isStageRenderable(dosageForm)` gestellt, was für `other` `false` ist. Übrig
blieb eine Überschrift, ein leerer Kasten und ein „Weiter".

## Die Entscheidung

**Ein Schritt, dessen Antwort nirgends ankommt, wird nicht gestellt.**

Die Aussage gehört zur Darreichungsform, nicht zum Formular — also steht sie
in der Formentabelle, neben `strengthShape` und `stageRenderer`:

```ts
readonly showsColor: boolean
```

`wizardSteps()` lässt `'color'` weg, sobald eine Form feststeht, die die Farbe
nicht zeigt. Aus acht Schritten werden dort sieben.

Die naheliegende Alternative — das Farbfeld stehen lassen und einen Hinweis
danebenschreiben („diese Form zeigt keine Farbe") — wäre schlechter: sie
erklärt eine Frage, statt sie zu unterlassen.

Warum nicht einfach Pflaster und Tube färben? Beide Entscheidungen sind
begründet und dokumentiert (`patchShape.ts`, `TubeRenderer.tsx`): ein farbiger
Balken auf einem hautfarbenen Pflaster war der eine Fremdkörper im Bild. Das
Problem war nie die Grafik, sondern die Frage davor.

Solange **keine** Form gewählt ist, bleibt der Schritt in der Liste — er kommt
ohnehin erst nach dem Formschritt. Damit kann der aktuelle Schritt nie aus der
Liste fallen (`steps.indexOf(state.step) === -1`, was „Weiter" an den Anfang
zurückspringen ließe); ein Test hält das fest.

## Verifikation

Im Browser gegen den echten Wizard gefahren, nicht nur im Test:

| Form | Schritt nach der Formwahl | Farbfeld |
|---|---|---|
| `patch` | Tracking-Tiefe | 0 |
| `tube` | Tracking-Tiefe | 0 |
| `other` | Tracking-Tiefe | 0 |
| `vial` | Farbe | 1 |
| `capsule` | Farbe | 1 |

Und der vollständige Durchlauf mit einem Vial: Ziehen auf der Fläche →
`#21BAD9`, Farbtonschiene → `#21A1D9`, Objekt färbt sich mit, und beim
Speichern kommt `colorHex: "#21a1d9"` an.

- `TZ=Europe/Berlin npx vitest run` — **1488 Tests grün** (142 Dateien), 3 neu.
- `npx tsc -p tsconfig.app.json --noEmit` — sauber.
- `npx eslint src scripts` — **140 Probleme**, unverändert zur Baseline.

## Was dabei auffiel, aber nicht geändert wurde

Auf dem Farbschritt trägt das Vial-Etikett vor der Stärkeeingabe die Zeile
„WIRKSTOFF / VIAL" — die Feldnamen als Platzhalter. Sichtbar, aber gewollt:
das Etikett zeigt, wo die Angaben später stehen. Wenn es stören soll, ist das
eine eigene Entscheidung.
