# Legacy My Stack – Kompatibilität mit dem neuen Schema

## Ziel

Der Stand auf `main` behält die bisherige My-Stack-Oberfläche, das Vial-Rendering,
das peptide-orientierte Formular und alle bisherigen Abläufe. Lediglich die
Datenanbindung wird an das bereits migrierte Supabase-Schema angepasst.

Die vollständig neue, substanzübergreifende My-Stack-Umsetzung bleibt getrennt
auf `codex/my-stack-foundation`.

## Datenvertrag

Die alte Oberfläche verwendet intern weiterhin ihre bestehenden
Peptid-Modelle. An der Supabase-Grenze werden die neuen Namen verwendet:

- `peptides` → `stack_items`
- `name` → `display_name`
- `peptide_id` → `stack_item_id`
- eingebettete Relation `peptides(name)` → `stack_items(display_name)`

Die bestehenden Vial-, Bestands-, Zyklus- und Peptidfelder auf `stack_items`
bleiben erhalten. Für neu angelegte Einträge werden zusätzlich die festen
Grundwerte `category = peptide` und `dosage_form = vial` gesetzt. Der primäre
Inhaltsstoff wird über die bestehende atomare `save_stack_item`-Funktion
gespeichert, damit `stack_item_ingredients` vollständig bleibt.

## Umfang

Inbegriffen sind alle Laufzeitpfade, die durch die Tabellen- und
Fremdschlüssel-Umbenennung sonst brechen würden: My Stack, Dashboard/Home,
Zyklen und Protokoll, Injektionspfade, Bewertungen, Tagebuch,
Blutspiegelsimulation, Fortschritt und PDF-Daten.

Nicht inbegriffen sind:

- neue Kategorien oder Darreichungsformen in der alten Oberfläche
- der neue My-Stack-Wizard oder die neuen Karten
- visuelle Änderungen
- die unabhängige Peptid-Bibliothek
- ein Rollback der bereits migrierten Datenbank

## Sicherheitsgrenzen

- Keine Änderungen an JSX-Struktur, Styling oder Animationen des alten My Stack.
- Keine Kompatibilitäts-Views oder Trigger mit alten Tabellennamen.
- Keine Änderung am neuen Feature-Branch.
- Tests sichern sowohl die neuen Supabase-Namen als auch das Fehlen der alten
  Laufzeitabfragen ab.

## Erfolgskriterien

1. Das alte My Stack lädt die vorhandenen Datensätze aus `stack_items`.
2. Anlegen, Bearbeiten, Archivieren, Wiederherstellen und Löschen funktionieren
   mit dem neuen Schema.
3. Zyklen und abhängige Ansichten verwenden `stack_item_id`.
4. Das alte Erscheinungsbild und Formular bleiben unverändert.
5. Tests, TypeScript-Prüfung und Produktions-Build bestehen.
