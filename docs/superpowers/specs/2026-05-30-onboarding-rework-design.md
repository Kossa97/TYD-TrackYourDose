# Onboarding-Rework: Substanz → Zyklus → Dosiserhöhung → Kalender → simulierte Bestätigung

**Datum:** 2026-05-30
**Status:** Genehmigt (Brainstorming)

## Kontext

Durch den UI/Layout-Umbau passt das alte Onboarding nicht mehr: Es startet mit
„Lager/Einlagern" (`nav-lager`, `btn-einlagern`, `inv-*`) — diese Anker existieren
nicht mehr. Die **Engine** (`src/components/Onboarding.tsx`, `onboardingPlacement.ts`,
`OnboardingContext`) ist solide: step-getriebene Tour mit `data-ob`-Targets,
Platzierung top/bottom/center inkl. Umklappen + Reserve für die Bottom-Nav,
Scroll-to-Target, Scrim/Highlight-Ring, `advance: click|next`, `route`.

**Entscheidungen (Brainstorming):**
- Engine **behalten**, nur Schritt-Konfig neu + fehlende Anker ergänzen.
- Finale Einnahmebestätigung = **reine Simulation** (kein DB-Write).
- Granularität: **jedes Feld einzeln** (Feld für Feld, Button für Button).

## Ziel-Flow

Neuer Nutzer wird geführt:
1. Substanz (Peptid) anlegen — Formular **Feld für Feld**, dann Speichern.
2. Zyklus hinzufügen — Formular Feld für Feld, dann Speichern.
3. Dosiserhöhung anlegen — Formular Feld für Feld, dann Speichern.
4. Kalender kurz zeigen.
5. **Simulierte** fällige Einnahmebestätigung — Nutzer bestätigt (sandbox).

Peptid/Zyklus/Dosiserhöhung werden **real** gespeichert (erste echte Daten).
Nur Schritt 5 ist simuliert.

## Engine-Erweiterungen (klein, additiv)

Am `OnboardingStepMeta`/Renderer ergänzen:

1. **`requireFilled?: boolean`** — Bei `advance: 'next'`: „Weiter" ist erst aktiv,
   wenn das Ziel-Input einen nicht-leeren Wert hat. Sichert valide Pflichtfelder
   (Peptid-Name, Zyklus-Dosis, Erhöhungs-Betrag), sodass die echten Speicherungen klappen.
2. **`optionalTarget?: boolean`** — Erscheint das Ziel nicht innerhalb eines kurzen
   Timeouts (z. B. 600 ms), wird der Schritt automatisch übersprungen. Für bedingte
   Felder (Zyklus „Alle X Tage"-Intervall / Wochentage; Dosiserhöhung Datums-/Tage-Feld),
   die je nach vorheriger Auswahl evtl. nicht sichtbar sind.
3. **In-Modal-Positionierung:** Bei Feld-Targets innerhalb der Formular-Bottom-Sheets
   (`[data-app-modal]`, eigener `overflow-y`-Scroll) das Ziel in den **Modal-Scroll-
   container** scrollen (nicht nur `window`), danach Layout neu berechnen. Die
   Callout-Karte bleibt durch `computeCalloutLayout` über/unter dem Ziel (nie darüber)
   und innerhalb des sichtbaren Bereichs. Wird in `Onboarding.tsx` an der vorhandenen
   Scroll-/Measure-Logik ergänzt.
4. **Simulierte Bestätigungs-Karte:** `Onboarding.tsx` rendert im Schritt `sim-confirm`
   eine eigene, wie die echte „Noch fällig"-Karte gestylte Sandbox-Karte (über dem
   Kalender, kein DB-Zugriff) mit Button `data-ob="ob-sim-confirm"`. Klick → kurze
   Erfolgs-Animation (Häkchen) → nächster Schritt. Kein Schreiben in `dose_logs`.

## Neue `data-ob`-Anker (im JSX zu ergänzen)

**My Stack:** `btn-peptid-anlegen` (Header-Button „+ Neu").

**Peptid-Formular (`Peptide.tsx`):** `pep-name`, `pep-color`, `pep-mg`, `pep-liquid`*,
`pep-recon-date`, `pep-expiry`* (Haltbarkeit), `pep-vials`, `pep-batch`, `pep-source`,
`pep-doc`, `pep-dose`* (Dosis+Einheit), `pep-method`, `pep-notes`, `btn-pep-save`*.

**Zyklus-Formular:** `cyc-name`, `cyc-dose`, `cyc-unit`, `cyc-method`, `cyc-frequency`,
`cyc-interval` (bedingt), `cyc-weekdays` (bedingt), `cyc-dates`, `cyc-intake`,
`cyc-reminder`, `btn-cycle-save`* / `btn-zyklus-add`*.

**Dosiserhöhung:** `esc-amount`, `esc-when`, `esc-when-detail` (bedingt), `esc-notes`,
`btn-esc-add`* / `btn-esc-save`*.

**Kalender:** `nav-kalender`*, `calendar-main`*. (`*` = existiert bereits.)
`pep-expiry`/`pep-dose` werden von Section- auf Feld-Granularität verfeinert
(eigene Wrapper-Anker je Feld).

## Schritt-Liste (Reihenfolge, Target, Advance)

| # | id | Target | placement | advance | Flags |
|---|---|---|---|---|---|
| 0 | welcome | – | center | next | |
| 1 | nav-mystack | `nav-peptide` | top | click | navTarget, route `/peptide` |
| 2 | open-peptide | `btn-peptid-anlegen` | bottom | click | |
| 3 | pep-name | `pep-name` | auto | next | requireFilled |
| 4 | pep-color | `pep-color` | auto | next | |
| 5 | pep-mg | `pep-mg` | auto | next | |
| 6 | pep-liquid | `pep-liquid` | auto | next | |
| 7 | pep-recon-date | `pep-recon-date` | auto | next | |
| 8 | pep-expiry | `pep-expiry` | auto | next | |
| 9 | pep-vials | `pep-vials` | auto | next | |
| 10 | pep-batch | `pep-batch` | auto | next | |
| 11 | pep-source | `pep-source` | auto | next | |
| 12 | pep-doc | `pep-doc` | auto | next | |
| 13 | pep-dose | `pep-dose` | auto | next | |
| 14 | pep-method | `pep-method` | auto | next | |
| 15 | pep-notes | `pep-notes` | auto | next | |
| 16 | pep-save | `btn-pep-save` | top | click | scrollTarget |
| 17 | open-cycle | `btn-zyklus-add` | top | click | scrollTarget |
| 18 | cyc-name | `cyc-name` | auto | next | |
| 19 | cyc-dose | `cyc-dose` | auto | next | requireFilled |
| 20 | cyc-unit | `cyc-unit` | auto | next | |
| 21 | cyc-method | `cyc-method` | auto | next | |
| 22 | cyc-frequency | `cyc-frequency` | auto | next | |
| 23 | cyc-interval | `cyc-interval` | auto | next | optionalTarget |
| 24 | cyc-weekdays | `cyc-weekdays` | auto | next | optionalTarget |
| 25 | cyc-dates | `cyc-dates` | auto | next | |
| 26 | cyc-intake | `cyc-intake` | auto | next | |
| 27 | cyc-reminder | `cyc-reminder` | auto | next | |
| 28 | cyc-save | `btn-cycle-save` | top | click | scrollTarget |
| 29 | open-esc | `btn-esc-add` | top | click | scrollTarget |
| 30 | esc-amount | `esc-amount` | auto | next | requireFilled |
| 31 | esc-when | `esc-when` | auto | next | |
| 32 | esc-when-detail | `esc-when-detail` | auto | next | optionalTarget |
| 33 | esc-notes | `esc-notes` | auto | next | |
| 34 | esc-save | `btn-esc-save` | top | click | scrollTarget |
| 35 | nav-calendar | `nav-kalender` | top | click | navTarget, route `/kalender` |
| 36 | calendar-show | `calendar-main` | bottom | next | |
| 37 | sim-confirm | `ob-sim-confirm` | top | click | (onboarding-rendered sandbox card) |
| 38 | finish | – | center | next | |

Texte (Titel/Untertitel/Beschreibung/Tap-Hint) je Schritt neu, knapp und erklärend.

## i18n

Onboarding-Texte über das bestehende System (`src/i18n/data/onboarding-i18n.json`
+ `scripts/generate-onboarding-i18n.mjs` / `merge-onboarding-i18n.mjs`). Deutsche
Texte für alle neuen Schritte schreiben, dann Generator für die übrigen Sprachen.
Alte, nicht mehr genutzte `ob_step_*`-Keys entfernen oder ersetzen.

## Verifikation

- Build/Lint grün.
- Tour läuft vollständig durch (Live, neuer Nutzer / Restart-Button im Profil):
  Peptid wird real angelegt, Zyklus + Dosiserhöhung real gespeichert; finale
  Bestätigung simuliert (kein neuer `dose_logs`-Eintrag).
- Pflichtfeld-Gating: „Weiter" bleibt bis Eingabe deaktiviert (Name, Dosis, Betrag).
- Bedingte Schritte (Intervall/Wochentage/when-detail) werden bei Nichtvorhandensein
  automatisch übersprungen — kein Hängenbleiben.
- **Positionierung:** In jedem Schritt verdeckt die Callout-Karte das markierte
  Element nie, bleibt über der Nav-Bar und scrollt im Formular-Modal korrekt mit.
- Abbruch/Skip jederzeit möglich (vorhandene Skip-Logik).

## Risiken & Annahmen

- **Annahme:** Klick auf „+ Neu"/„+ Zyklus"/„Dosiserhöhung" öffnet das jeweilige
  Modal; die Engine wartet bis das nächste Feld-Target erscheint (wie bisher).
- **Risiko:** Feld-Targets in scrollbaren Modals — daher die explizite In-Modal-
  Scroll-Ergänzung + visuelle Verifikation jedes Schritts.
- **Out of scope:** Inhaltliche Übersetzung der Onboarding-Texte in alle Sprachen
  von Hand (Generator-Skript übernimmt); Home-Features-Schritt am Ende (entfällt).
