# My Stack: Reiter, große Bühne, Vollbild

## Die Spannung, um die es ging

„Hochwertig" heißt: eins groß, ruhig, mit Tiefe. „Übersichtlich" heißt: alle auf
einmal. Ein Karussell kann nicht beides — es zeigt eins und verbirgt den Rest.

Für v1 fällt die Entscheidung auf die Bühne: **das Karussell zeigt eins, groß**,
und die Übersicht kommt über die Reiter und die Punktezeile, nicht über
gleichzeitig sichtbare Objekte. Die Liste bleibt als zweite Ansicht bestehen.

## Reiter

„Alle" und alle sechs Kategorien, **feste Plätze, auch die leeren.**

In Produktion sind drei der sechs Kategorien gar nicht belegt:

| | Einträge |
|---|---|
| Peptide | 13 |
| Hormone | 2 |
| Vitamine | 1 |
| Medikamente · Supplemente · Sonstiges | 0 |

Nur die belegten zu zeigen wäre die naheliegende Lösung — und die falsche. Ein
leerer Reiter „Medikamente" ist hier keine Lücke, sondern eine Auskunft: die App
kann das auch. Nachdem der Katalog genau dafür erweitert wurde, wäre es schade,
das zu verstecken. Feste Plätze deshalb, weil ein Reiter, der beim ersten
Medikament von hinten nach vorn springt, das Muskelgedächtnis zerstört.

Gezählt wird über den **ganzen** Stack, nicht über die gefilterte Liste — sonst
stünde in jedem Reiter außer dem offenen eine 0.

Der Reiterwechsel braucht keinen Effekt: welcher Eintrag auf der Bühne steht,
fällt über `Math.max(0, findIndex(...))` von selbst auf den ersten des Reiters.
Zu tun bleibt nur, was keine Ableitung kann — das Karussell an den Anfang rollen
und das Licht neu rechnen.

## Sortierung im Reiter

Angeboten wird nur, was der Reiter beantworten kann. Füllstand, Rekonstitution
und Bestand lesen **Vial-Felder**; in einem Reiter aus lauter Kapseln sind sie
überall leer, die Reihenfolge ändert sich nicht, und die App wirkt kaputt.
`sortAbilities` sagt je Reiter, welche Angaben überhaupt vorkommen.

Ein leerer Bestand (`vials_in_stock = 0`) zählt dabei **nicht** als
Bestandsangabe: „keine da" ist etwas anderes als „hier lässt sich ordnen".

Neu dazu: **neu → alt** und **alt → neu** über `created_at` — die Sortierung, die
gefehlt hat. Fehlt das Feld bei alten Zeilen, wird hinten einsortiert.

Und wer nach Füllstand sortiert und dann in einen Reiter ohne Vials wechselt,
fällt auf die Vorgabe zurück, statt eine Auswahl zu sehen, die das Menü nicht
mehr führt.

## Die Bühne

| | vorher | jetzt |
|---|---|---|
| Objektbreite | `min(6rem, 25vw)` ≈ 96 px | `min(15rem, 62vw)` ≈ 240 px |
| Nachbarn | `scale-90` | `scale-[0.82]`, 45 % deckend, entsättigt |
| Skalierung | um die eigene Mitte | **`origin-bottom`** |
| Licht | Abfall 0,78 je Abstand, min. 0,22 | Abfall 1,35, min. 0,10 |
| Boden | breiter, weichgezeichneter Spot | schmalerer Spot **+ Kontaktschatten** |

`origin-bottom` ist die wichtigste Zeile. Vorher skalierte jedes Objekt um seine
eigene Mitte — die Nachbarn schrumpften nach oben *und* unten weg und schwebten
über dem Boden. Beim Formular-Karussell war das längst entschieden („vom Boden
aus skaliert, damit sie nicht über der gemeinsamen Standlinie schwebt", Spec vom
10.09.), im Stack-Karussell fehlte es. Bei 96 px fällt das kaum auf, bei 240 px
sofort.

Weil die Nachbarn jetzt nur noch angeschnitten sind, stehen darunter **Punkte**:
bis sieben Einträge zum Antippen, darüber eine Leiste. Fünfzehn Punkte zählt
niemand mehr.

## Der Übergang ins Vollbild

**Erst wischen, dann tippen.** Ein Tipp auf einen Nachbarn holt ihn nur in die
Mitte; ein Tipp auf das Objekt, das schon mittig steht, öffnet das Vollbild. So
braucht es keine zweite Schaltfläche, und ein Fehltipp beim Wischen kostet einen
Schritt, nie einen Bildschirmwechsel.

Der Übergang ist **FLIP**: das Objekt wird an seinem Platz im Karussell gemessen
(`getBoundingClientRect`), im Vollbild an seiner Zielstelle gezeichnet, und die
Differenz als `transform` abgespielt — `translate` + `scale`, kein Layout. Das
läuft in jeder WebView, ohne dass wir Browserunterstützung für die
View-Transitions-API prüfen müssen.

Möglich ist das, weil die Objekte **SVG mit `viewBox`** sind (`CapsuleVisual.tsx`),
kein Canvas: das Verkleinern ist verlustfrei und braucht kein zweites Bild.

```
0 ms      Tippen, Ursprungsrechteck gemessen
0–340 ms  Das Objekt fliegt und verkleinert sich · Physik still
340 ms+   Die Angaben steigen ein (300 ms, von unten, ausblendend)
```

Drei Zusicherungen, jede mit einem Test:

- **Die Physik ist im Flug still** (`sloshEngine.setEnabled(false)`) — ein
  schwappendes Vial mitten im Flug wirkt falsch.
- **`prefers-reduced-motion`** macht aus dem Flug ein Erscheinen.
- **Hat die Zielstelle noch keine Größe**, unterbleibt der Flug. Ohne das teilte
  die Rechnung durch 0 und das Objekt verschwände hinter einer unendlichen
  Skalierung.

## Betroffene Dateien

| | |
|---|---|
| `lib/stackTabs.ts` + Test | Reiter, Zählung, Filter |
| `lib/stackSort.ts` + Test | welche Sortierung ein Reiter beantworten kann |
| `components/StageDetailSheet.tsx` + Test | Vollbild mit FLIP |
| `MyStackPage.tsx` | Reiterleiste, Pipeline, Bühnenmaße, Punkte, Einstieg |
| `i18n` | zehn Schlüssel in vierzehn Sprachen |

## Was offen bleibt

**Gesehen hat das niemand.** Tests, `tsc` und eslint decken Verhalten und
Struktur ab, nicht das Bild. Die vier Stellen, an denen es sich beim Ansehen
entscheidet: das Karussell bei sieben Reitern auf Telefonbreite, das Objekt bei
62 % Breite, der Kontaktschatten unter den verschiedenen Darreichungsformen, und
der Flug ins Vollbild.

Der **Inhalt des Vollbilds** ist vorerst `StackItemDetails` — dieselbe
Komponente, die vorher im aufklappbaren „Info" steckte. Was sonst noch in der
Detailtafel steht (Planstufen, Bestand, Blutspiegel, Verlauf), liegt weiterhin
unter dem Karussell und gehört in einer nächsten Runde dorthin.
