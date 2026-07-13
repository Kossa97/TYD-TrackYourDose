# Substanz archivieren/löschen + Zyklus beenden — Design

**Datum:** 2026-07-13
**Status:** Freigegeben

## Problem

Beim Löschen einer Substanz aus „My Stack" ([Peptide.tsx:820](../../../src/pages/Peptide.tsx)) passiert aktuell ein hartes `delete` auf `peptides`, gesteuert nur durch einen simplen `confirm()`-Dialog. Konsequenzen laut DB-Foreign-Keys:

- **Zyklen** (`cycles`, `ON DELETE CASCADE`) + **Dosis-Eskalationen** (`dose_escalations`, CASCADE) → unwiderruflich gelöscht.
- **Einnahmen** (`dose_logs`, `ON DELETE SET NULL`) → bleiben, aber `peptide_id = NULL` → **verwaiste „Geister-Einträge"**.
- **Injektions-Logs** / **Effekte** (SET NULL) → ebenfalls verwaist.

Fehldarstellung der verwaisten Daten:
- Kalender-Tagesansicht ([Dashboard.tsx:982](../../../src/pages/Dashboard.tsx)) zeigt namenlose Einträge (`log.peptides?.name` = `undefined`).
- Protokoll/Statistik ([Protokoll.tsx:702](../../../src/pages/Protokoll.tsx)) filtert sie komplett raus (`!log.peptide_id → return`).

Zusätzlich fehlt ein Konzept „Zyklus beenden": Es gibt nur `active` (Ein/Aus-Schalter, Kalender lädt nur `active=true` in [Dashboard.tsx:460](../../../src/pages/Dashboard.tsx)) und `end_date` (in [intakeSchedule.ts:97](../../../src/lib/intakeSchedule.ts) wird für Tage nach `end_date` nichts geplant). Kein dedizierter „beendet"-Zustand.

## Ziel

1. Beim Entfernen einer Substanz kann der Nutzer wählen: **Archivieren** (behalten) oder **endgültig löschen** (alle Daten).
2. Archivierte Substanzen sind in My Stack einsehbar und wiederherstellbar.
3. Dedizierte Aktion „Zyklus beenden".

## Entscheidungen (aus Brainstorming)

- Behalten-Mechanik: **Archivieren (Soft-Delete)**.
- Archiv: **Ansicht mit Wiederherstellen** + **endgültig löschen (mit allen Daten)**.
- „Zyklus beenden": **in Scope**.
- Archiv-Ort: **In My Stack**.

## Design

### 1. Datenmodell
```sql
alter table peptides add column if not exists archived boolean not null default false;
```
Boolean (kein Timestamp — YAGNI). Soft-Delete hält die Peptid-Zeile am Leben → alle `peptides(name)`-Joins in Kalender/Protokoll funktionieren weiter, **keine Geister-Einträge**.

### 2. Lösch-Flow (Warndialog)
Der `trash`-Button öffnet statt `confirm()` ein Modal mit Konsequenz-Erklärung und drei Optionen:

| Aktion | Effekt |
|---|---|
| **Archivieren** (primär) | Raus aus My Stack, alle Daten bleiben erhalten & verknüpft. Reversibel. |
| **Endgültig löschen** (destruktiv) | Substanz + alle zugehörigen Daten weg, inkl. Einnahmen. Nicht umkehrbar. |
| **Abbrechen** | — |

### 3. Archivieren-Logik
- `update({ archived: true })` auf die Substanz.
- Zusätzlich aktive Zyklen der Substanz deaktivieren (`active: false`), damit keine Einnahme-Erinnerungen mehr entstehen (Kalender lädt Zyklen unabhängig vom Peptid-Status).
- `.eq('archived', false)` an die My-Stack-Ladeabfragen: [Peptide.tsx:558](../../../src/pages/Peptide.tsx) und [Dashboard.tsx:466](../../../src/pages/Dashboard.tsx). Historische Joins bleiben unberührt.

### 4. Endgültig-löschen-Logik
`dose_logs`, `injection_logs`, `effects` stehen auf SET NULL → müssen explizit vorher gelöscht werden, sonst Geister:
1. `delete dose_logs where peptide_id = id`
2. `delete injection_logs where peptide_id = id`
3. `delete effects where peptide_id = id`
4. `delete peptides where id = id` → CASCADE räumt `cycles`, `dose_escalations`, `vials`, `reviews`.

Sequenziell über Supabase-Client (keine echte Transaktion; akzeptables Restrisiko, optional später RPC).

### 5. Archiv-Ansicht (in My Stack)
Zugang über das bestehende Filter/Sortier-Popover (`SlidersHorizontal`) → Punkt „Archiv". Liste archivierter Substanzen mit:
- Name + Kurzinfo (z.B. Anzahl Zyklen)
- **[Wiederherstellen]** → `archived: false` (Zyklen bleiben deaktiviert; Nutzer reaktiviert selbst)
- **[Endgültig löschen]** → Hard-Delete-Flow mit eigener Bestätigung

### 6. Zyklus beenden
Im Zyklus-Manager je Zyklus neue Aktion „Beenden":
- Setzt `end_date = heute` **und** `active = false`.
- Kurze Bestätigung.
- Semantik „sauber beendet": nicht mehr in Planung, Historie bleibt, Fortschritt 100 %.
- „Beendet"-Badge für Zyklen mit `end_date` in der Vergangenheit (Abgrenzung zu „nur deaktiviert").

### 7. Defensive Härtung
[Dashboard.tsx:982](../../../src/pages/Dashboard.tsx): Fallback-Label („Gelöschte Substanz") statt leerem Namen, falls `peptides?.name` fehlt (Altbestand aus früheren Hard-Deletes).

### 8. i18n & Tests
- Neue Keys (Dialog, Buttons, Archiv, „Beendet"-Badge) — de/en ausformuliert, Keys in alle Locale-Dateien.
- Reine Logik (Tabellen-Purge-Liste beim Hard-Delete) als testbare Helper; UI/Supabase manuell verifizieren.

## Scope-Grenzen (YAGNI)
- Kein Undo für „Endgültig löschen".
- Keine Bulk-Aktionen.
- Keine Auto-Reaktivierung von Zyklen beim Wiederherstellen.
