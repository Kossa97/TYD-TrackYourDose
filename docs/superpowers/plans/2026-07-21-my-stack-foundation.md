# My Stack Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** My Stack von einer peptidspezifischen Verwaltung zu einem neutralen, migrationssicheren Fundament für Peptide, Medikamente, Hormone, Supplemente und Vitamine umbauen, ohne die Qualität oder Funktion des bestehenden Vials zu verlieren.

**Architecture:** Die bestehende Tabelle `peptides` wird beim finalen Cutover zu `stack_items` umbenannt; alle fachlich zugehörigen Fremdschlüssel wechseln von `peptide_id` zu `stack_item_id`. `substance_catalog` liefert globale Vorschläge, `stack_item_ingredients` modelliert Einzel- und Mehrfachwirkstoffe, und eine transaktionale RPC-Funktion speichert Hauptobjekt plus Inhaltsstoffe atomar. Im Frontend entsteht `src/features/my-stack/` mit reiner Fachlogik, Services, adaptivem Wizard und Renderer-Grenze. Das aktuelle Vial bleibt der einzige freigeschaltete Bühnen-Renderer; andere Darreichungsformen sind zunächst vollständig speicher- und in der Listenansicht bearbeitbar. Die eigentliche Datenbankumbenennung wird erst ausgeführt, wenn alle Consumer im Branch umgestellt und getestet sind.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 3 (Node-Umgebung), Supabase/Postgres/RLS/RPC/Storage, React Router 7, i18next, Tailwind CSS, React Three Fiber/Three.js für das bestehende Vial.

**Spec:** `docs/superpowers/specs/2026-07-21-my-stack-foundation-design.md`

## Global Constraints

- Teilprojekt 1 enthält keine Routinen, Reminder, gebündelte Bestätigung, PRN-Logik, Bestandsautomatik, OCR oder neuen Darreichungsform-Renderer.
- Stärke, Einnahmedosis und Frequenz bleiben fachlich getrennt. Teilprojekt 1 speichert nur die Produktstärke; Einnahmedosis und Frequenz bleiben im bestehenden Zyklusmodell, bis das Folgeprojekt sie generalisiert.
- Das bestehende `PeptideVialVisual` wird nicht optisch vereinfacht. Licht, Schatten, Reflexion, Slosh, Füllstand und Karussellverhalten müssen ihre Regressionstests behalten.
- `peptide_library`, Peptipedia-Seiten, Forschungsinhalte und deren peptidspezifische Begriffe werden nicht umbenannt.
- Es gibt keine dauerhafte `peptides`-View, keinen dauerhaften `peptide_id`-Alias und keine doppelte Schreiblogik. Der Wechsel erfolgt als kontrollierter Cutover.
- Ein neuer Stack-Eintrag benötigt mindestens einen Inhaltsstoff, Darreichungsform, Stärke, Einheit und Bezugsgröße. Nur migrierte Altstände dürfen mit `configuration_status = 'needs_review'` unvollständig sein.
- Katalogausfall blockiert freie Eingabe nicht. Katalogdaten geben keine Dosierungsempfehlung.
- Dateien mit Backups, Nutzerinhalten, Datenbankkennwörtern oder Storage-Objekten bleiben außerhalb des Repositorys.
- Jede Implementierungsaufgabe endet mit fokussierten Tests und einem kleinen Commit. Vor dem Cutover müssen Gesamttests, Lint und Build grün sein.
- Die Ausführung beginnt mit `superpowers:using-git-worktrees` auf einem isolierten Branch `codex/my-stack-foundation`; die bestehende Nutzeränderung `supabase/.temp/cli-latest` bleibt unangetastet und ungecommittet.

---

## File Structure

### Neu

| Datei | Verantwortung |
|---|---|
| `supabase-my-stack-verify.sql` | Ausschließlich lesende Zählungs-, Orphan-, RLS- und RPC-Prüfung |
| `supabase-my-stack-rollback.sql` | Vorab lokal geprüfter Rückweg für einen unmittelbar fehlgeschlagenen Cutover |
| `docs/superpowers/checklists/my-stack-backup-manifest.md` | Nicht-sensitiver Nachweis von Tag, Backup, Hashes und Restore-Test |
| `supabase-my-stack-foundation.sql` | Einmalige, transaktionale Schema-, Daten- und FK-Migration inklusive RLS und RPC |
| `src/features/my-stack/types.ts` | Neutrale Katalog-, Stack-, Inhaltsstoff- und Wizard-Typen |
| `src/features/my-stack/lib/categories.ts` | Kategorien und Labels |
| `src/features/my-stack/lib/dosageForms.ts` | Darreichungsformen, Fähigkeiten, Einheiten und Bezugsgrößen |
| `src/features/my-stack/lib/validation.ts` | Validierung für neue und migrierte Stack-Objekte |
| `src/features/my-stack/lib/duplicateFingerprint.ts` | Normalisierter Identitätsschlüssel und Duplikatvergleich |
| `src/features/my-stack/lib/wizardState.ts` | Testbarer Zustandsautomat für den Anlage-/Bearbeitungsflow |
| `src/features/my-stack/lib/colorMigration.ts` | Einmalige Übernahme von `tyd_peptide_colors` nach Supabase |
| `src/features/my-stack/services/substanceCatalog.ts` | Katalogsuche und ausfallsicherer freier Fallback |
| `src/features/my-stack/services/stackItems.ts` | Laden, Duplikatprüfung und RPC-Aufruf |
| `src/features/my-stack/components/SubstanceSearch.tsx` | Leitfrage, Katalogtreffer und freie Eingabe |
| `src/features/my-stack/components/IngredientEditor.tsx` | Einzel-/Mehrfachwirkstoffe |
| `src/features/my-stack/components/DosageFormPicker.tsx` | Formauswahl aus zentraler Registry |
| `src/features/my-stack/components/StrengthEditor.tsx` | Wert, Einheit und Bezugsgröße pro Inhaltsstoff |
| `src/features/my-stack/components/StackItemWizard.tsx` | Dialog, Schrittsteuerung, Review und Duplikatentscheidung |
| `src/features/my-stack/components/StackStage.tsx` | Renderer-Grenze und Vial-Freigabe |
| `src/features/my-stack/components/StackItemDetails.tsx` | Generische Detaildaten plus Vial-Erweiterung |
| `src/features/my-stack/components/StackArchive.tsx` | Archivliste und Wiederherstellung |
| `src/features/my-stack/extensions/peptide/VialRenderer.tsx` | Adapter zum unveränderten hochwertigen `PeptideVialVisual` |
| `src/features/my-stack/MyStackPage.tsx` | Orchestrierung des bestehenden My-Stack-Bereichs |
| `src/features/my-stack/**/*.test.ts` | Reine Logik-, Service-, Contract- und Quelltests |
| `scripts/my-stack-i18n-source.mjs` | Deutsche/englische Quelle der neuen Wizard-Texte |
| `scripts/generate-my-stack-i18n.mjs` | Übersetzt die neuen Texte in die übrigen zwölf Sprachen |
| `scripts/merge-my-stack-i18n.mjs` | Führt generierte Texte deterministisch in die Locale-Dateien zusammen |

### Verschoben oder ersetzt

| Von | Nach / Ergebnis |
|---|---|
| `src/pages/Peptide.tsx` | Logik nach `src/features/my-stack/MyStackPage.tsx`; temporärer Re-Export, in Task 13 löschen |
| `src/pages/Peptide.test.ts` | Regressionen nach `src/features/my-stack/MyStackPage.test.ts`; temporärer Re-Export-Test, in Task 13 löschen |
| `src/lib/peptideColors.ts` | `src/features/my-stack/lib/colors.ts` mit neutraler Benennung |
| `src/lib/peptideStock.ts` | `src/features/my-stack/extensions/peptide/vialStock.ts` |
| `src/components/PeptideFormModal.tsx` | Nach Wizard-Integration entfernen |
| `src/components/PeptideFormModal.test.ts` | Durch Wizard-/Validierungstests ersetzen |
| `src/lib/peptideFormTypes.ts` | Durch `my-stack/types.ts` und `wizardState.ts` ersetzen |

### Bestehende Consumer mit neutraler DB-Benennung

Die folgenden Dateien werden gezielt auf `stack_items`, `stack_item_id` und neutrale lokale Typnamen umgestellt. Peptipedia-Dateien sind ausdrücklich nicht Teil dieser Liste.

- Kernplanung: `src/lib/intakeSchedule.ts`, `src/lib/intakeSchedule.test.ts`, `src/lib/doseAdjustmentBackfill.ts`, `src/lib/doseAdjustmentBackfill.test.ts`, `src/lib/insights.ts`
- Start/Kalender: `src/pages/Home.tsx`, `src/pages/Dashboard.tsx`
- Fortschritt: `src/features/fortschritt/types.ts`, `hooks/useFortschrittData.ts`, `lib/substances.ts`, `lib/substances.test.ts`, `lib/focusSummary.ts`, `lib/metrics.ts`
- Protokoll/PDF: `src/pages/Protokoll.tsx`, `src/lib/protocolPdf/types.ts`, `loadProtocolData.ts`, `renderProtocolPdf.ts`, `protocolPdf.test.ts`
- Injektionen: `src/lib/injectionLogTypes.ts`, `injectionPersistence.ts`, `injectionPersistence.test.ts`, `injectionGeometry.test.ts`, `injectionHistory.test.ts`, `injectionPinPresentation.test.ts`, `src/pages/InjektionsTracker.tsx`
- Weitere Seiten/Services: `src/pages/Bewertungen.tsx`, `BlutspiegelSimulation.tsx`, `PublicProfile.tsx`, `Rechner.tsx`, `Tagebuch.tsx`, `src/services/blutspiegelHistory.ts`
- Testdaten: `scripts/seed-test-data.ts`, `scripts/seed-test-data.mjs`
- Navigation und Texte: `src/App.tsx`, `src/components/Layout.tsx`, `src/i18n/locales/*.json`, `package.json`

### Datenbank-Matrix

| Alt | Neu |
|---|---|
| `public.peptides` | `public.stack_items` |
| `peptides.name` | `stack_items.display_name` |
| `vials.peptide_id` | `vials.stack_item_id` |
| `dose_logs.peptide_id` | `dose_logs.stack_item_id` |
| `cycles.peptide_id` | `cycles.stack_item_id` |
| `effects.peptide_id` | `effects.stack_item_id` |
| `reviews.peptide_id` | `reviews.stack_item_id` |
| `injection_logs.peptide_id` | `injection_logs.stack_item_id` |
| Policy `Own peptides` | Policy `Own stack items` |
| Index `peptides_user_archived_idx` | `stack_items_user_archived_idx` |

---

### Task 0: Backup- und Restore-Gate abschließen

**Files:**
- Create: `docs/superpowers/checklists/my-stack-backup-manifest.md`
- External only: `C:\Users\Devin\TYD-backups\pre-my-stack-foundation-2026-07-21`

- [ ] **Step 1: Aktuellen Zustand verifizieren und unveränderlich markieren**

Run:

```powershell
git status --short
npm test
npm run build
git tag -a pre-my-stack-foundation-2026-07-21 -m "Pre My Stack foundation backup"
git show --no-patch --decorate pre-my-stack-foundation-2026-07-21
```

Expected: Nur bereits bekannte, unbeteiligte Nutzeränderungen dürfen im Status stehen; Tests und Build bestehen; der Tag zeigt auf den letzten verifizierten Commit vor der Implementierung.

- [ ] **Step 2: Sicheres Backup-Verzeichnis außerhalb des Repositorys anlegen**

Vor diesem Schritt Schreibfreigabe für den expliziten Zielordner einholen. Dann:

```powershell
$backupRoot = 'C:\Users\Devin\TYD-backups\pre-my-stack-foundation-2026-07-21'
New-Item -ItemType Directory -Force -Path $backupRoot
New-Item -ItemType Directory -Force -Path "$backupRoot\storage\batch-files"
New-Item -ItemType Directory -Force -Path "$backupRoot\storage\progress-photos"
$env:SUPABASE_TELEMETRY_DISABLED = '1'
supabase db dump --linked --file "$backupRoot\schema.sql"
supabase db dump --linked --data-only --use-copy --file "$backupRoot\data.sql"
supabase storage cp -r ss:///batch-files "$backupRoot\storage\batch-files" --linked
supabase storage cp -r ss:///progress-photos "$backupRoot\storage\progress-photos" --linked
Get-FileHash "$backupRoot\schema.sql", "$backupRoot\data.sql" -Algorithm SHA256
Get-ChildItem "$backupRoot\storage" -Recurse -File | Get-FileHash -Algorithm SHA256
```

Expected: `schema.sql` und `data.sql` sind nicht leer; beide Storage-Buckets sind vollständig lokal gespiegelt; Hashes werden ausgegeben. Falls ein Bucket leer ist, ist ein erfolgreiches leeres Listing ausreichend und wird dokumentiert.

- [ ] **Step 3: Lokale Farben separat exportieren**

Die App im vorhandenen Browserprofil öffnen, je einen Desktop- und Mobile-Screenshot des aktuellen Vial-Karussells als `$backupRoot\vial-baseline-desktop.png` und `$backupRoot\vial-baseline-mobile.png` sichern und den Wert von `localStorage.getItem('tyd_peptide_colors')` als unverändertes JSON in `$backupRoot\peptide-colors.json` speichern. Danach JSON-Syntax prüfen:

```powershell
Get-Content "$backupRoot\peptide-colors.json" -Raw | ConvertFrom-Json | Out-Null
Get-FileHash "$backupRoot\peptide-colors.json" -Algorithm SHA256
```

Expected: Valides JSON-Objekt; ein leeres Objekt ist zulässig. Keine Nutzer-ID oder Farbe wird erfunden.

- [ ] **Step 4: Backup in einer frischen lokalen Supabase-Instanz wiederherstellen**

Dieser Schritt ist ein hartes Gate. Docker/Supabase Local muss verfügbar sein; andernfalls nicht mit der Migration beginnen.

```powershell
$restoreRoot = 'C:\tmp\tyd-my-stack-restore-check'
New-Item -ItemType Directory -Force -Path $restoreRoot
supabase init --workdir $restoreRoot
New-Item -ItemType Directory -Force -Path "$restoreRoot\supabase\migrations"
Copy-Item "$backupRoot\schema.sql" "$restoreRoot\supabase\migrations\20260721000000_schema.sql"
Copy-Item "$backupRoot\data.sql" "$restoreRoot\supabase\migrations\20260721000001_data.sql"
supabase start --workdir $restoreRoot -x studio,inbucket,analytics,functions,edge-runtime,imgproxy
supabase db reset --local --workdir $restoreRoot --no-seed
supabase storage cp -r "$backupRoot\storage\batch-files" ss:///batch-files --local --workdir $restoreRoot
supabase storage cp -r "$backupRoot\storage\progress-photos" ss:///progress-photos --local --workdir $restoreRoot
supabase db dump --local --workdir $restoreRoot --file "$restoreRoot\restored-schema.sql"
supabase db dump --local --workdir $restoreRoot --data-only --use-copy --file "$restoreRoot\restored-data.sql"
supabase storage ls -r ss:///batch-files --local --workdir $restoreRoot
supabase storage ls -r ss:///progress-photos --local --workdir $restoreRoot
```

Expected: Reset und beide erneuten Dumps gelingen. Die wiederhergestellte Datenbank enthält `public.peptides`; Storage-Listings entsprechen dem Export. Stoppen erst nach dokumentierter Prüfung:

```powershell
supabase stop --workdir $restoreRoot
```

- [ ] **Step 5: Nicht-sensitiven Manifest-Nachweis schreiben**

Create `docs/superpowers/checklists/my-stack-backup-manifest.md` mit:

```md
# My Stack Backup Gate

- Code tag: `pre-my-stack-foundation-2026-07-21`
- Backup location: external, not committed
- Schema dump: restored successfully
- Data dump: restored successfully
- Storage `batch-files`: restored and listed
- Storage `progress-photos`: restored and listed
- Local color JSON: valid and hashed
- Vial visual baselines: desktop and mobile captured
- Restore check: passed before structural migration
- Sensitive files committed: no
```

- [ ] **Step 6: Manifest committen**

```powershell
git add docs/superpowers/checklists/my-stack-backup-manifest.md
git commit -m "docs: verify my stack backup gate"
```

---

### Task 1: Neutrale Fachtypen, Kategorien und Darreichungsformen

**Files:**
- Create: `src/features/my-stack/types.ts`
- Create: `src/features/my-stack/lib/categories.ts`
- Create: `src/features/my-stack/lib/dosageForms.ts`
- Test: `src/features/my-stack/lib/dosageForms.test.ts`

- [ ] **Step 1: Failing Registry-Tests schreiben**

Create `src/features/my-stack/lib/dosageForms.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DOSAGE_FORMS, getDosageForm } from './dosageForms'

describe('DOSAGE_FORMS', () => {
  it('enthält alle freigegebenen stabilen Schlüssel genau einmal', () => {
    expect(DOSAGE_FORMS.map(form => form.key)).toEqual([
      'vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops', 'liquid',
      'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube', 'other',
    ])
  })

  it('modelliert Tabletten als teilbar und Vials als rekonstituierbar', () => {
    expect(getDosageForm('tablet').capabilities).toContain('divisible')
    expect(getDosageForm('vial').capabilities).toEqual(expect.arrayContaining([
      'injectable', 'reconstitutable', 'concentration_based', 'inventory_capable',
    ]))
  })

  it('aktiviert in Teilprojekt 1 nur den hochwertigen Vial-Renderer', () => {
    expect(DOSAGE_FORMS.filter(form => form.stageRenderer).map(form => form.key)).toEqual(['vial'])
  })

  it('liefert formgerechte Bezugsgrößen', () => {
    expect(getDosageForm('capsule').basisUnits).toContain('capsule')
    expect(getDosageForm('drops').basisUnits).toContain('drop')
    expect(getDosageForm('liquid').basisUnits).toContain('ml')
  })
})
```

- [ ] **Step 2: Test ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/lib/dosageForms.test.ts`

Expected: FAIL — Import `./dosageForms` fehlt.

- [ ] **Step 3: Fachtypen implementieren**

Create `src/features/my-stack/types.ts`:

```ts
export type StackCategory = 'peptide' | 'medication' | 'hormone' | 'supplement' | 'vitamin'
export type ConfigurationStatus = 'complete' | 'needs_review'
export type DosageFormKey =
  | 'vial' | 'ampoule' | 'pen' | 'tablet' | 'capsule' | 'drops' | 'liquid'
  | 'powder' | 'nasal_spray' | 'spray' | 'gel' | 'patch' | 'tube' | 'other'
export type DosageFormCapability =
  | 'countable' | 'divisible' | 'liquid' | 'injectable' | 'reconstitutable'
  | 'concentration_based' | 'inventory_capable'

export interface SubstanceCatalogEntry {
  id: string
  canonical_name: string
  aliases: string[]
  default_category: StackCategory
  suggested_units: string[]
  suggested_dosage_forms: DosageFormKey[]
  pk_profile_id: string | null
  active: boolean
}

export interface StackItemIngredient {
  id?: string
  stack_item_id?: string
  catalog_substance_id: string | null
  custom_name: string
  amount_value: number | null
  amount_unit: string | null
  basis_value: number | null
  basis_unit: string | null
  position: number
}

export interface StackItem {
  id: string
  user_id: string
  display_name: string
  category: StackCategory
  dosage_form: DosageFormKey
  brand: string | null
  color_hex: string | null
  notes: string | null
  configuration_status: ConfigurationStatus
  archived: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
  ingredients: StackItemIngredient[]
}

export interface StackItemDraft {
  id?: string
  displayName: string
  category: StackCategory | null
  dosageForm: DosageFormKey | null
  brand: string
  colorHex: string
  notes: string
  ingredients: StackItemIngredient[]
}
```

- [ ] **Step 4: Kategorien und Registry implementieren**

Create `categories.ts` mit exakt den fünf `StackCategory`-Werten und Übersetzungsschlüsseln. Create `dosageForms.ts` als readonly Registry; jede Definition enthält `key`, `labelKey`, `suggestedUnits`, `basisUnits`, `capabilities` und optional `stageRenderer: 'vial'`. Keine Komponente darf Formregeln duplizieren.

Die Mindestregeln sind:

```ts
export const DOSAGE_FORMS = [
  { key: 'vial', suggestedUnits: ['mcg', 'mg', 'IU'], basisUnits: ['vial', 'ml'], capabilities: ['injectable', 'reconstitutable', 'concentration_based', 'inventory_capable'], stageRenderer: 'vial' },
  { key: 'ampoule', suggestedUnits: ['mg', 'ml', 'IU'], basisUnits: ['ampoule', 'ml'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'] },
  { key: 'pen', suggestedUnits: ['mg', 'mcg', 'IU'], basisUnits: ['dose', 'ml'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'] },
  { key: 'tablet', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['tablet'], capabilities: ['countable', 'divisible', 'inventory_capable'] },
  { key: 'capsule', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['capsule'], capabilities: ['countable', 'inventory_capable'] },
  { key: 'drops', suggestedUnits: ['mcg', 'mg', 'IU', 'ml'], basisUnits: ['drop', 'ml'], capabilities: ['liquid', 'concentration_based', 'inventory_capable'] },
  { key: 'liquid', suggestedUnits: ['mcg', 'mg', 'g', 'IU', 'ml'], basisUnits: ['ml', 'portion'], capabilities: ['liquid', 'concentration_based', 'inventory_capable'] },
  { key: 'powder', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'portion'], capabilities: ['inventory_capable'] },
  { key: 'nasal_spray', suggestedUnits: ['mcg', 'mg'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'] },
  { key: 'spray', suggestedUnits: ['mcg', 'mg', 'ml'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'] },
  { key: 'gel', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'application'], capabilities: ['inventory_capable'] },
  { key: 'patch', suggestedUnits: ['mcg', 'mg'], basisUnits: ['patch', 'hour'], capabilities: ['countable', 'inventory_capable'] },
  { key: 'tube', suggestedUnits: ['mg', 'g', 'ml'], basisUnits: ['g', 'ml', 'application'], capabilities: ['inventory_capable'] },
  { key: 'other', suggestedUnits: ['mcg', 'mg', 'g', 'IU', 'ml'], basisUnits: ['unit', 'portion'], capabilities: [] },
] as const
```

Ergänze typisierte `getDosageForm(key)`- und `isStageRenderable(key)`-Funktionen; Definitionen erhalten außerdem `labelKey`.

- [ ] **Step 5: Tests und Typprüfung ausführen**

```powershell
npx vitest run src/features/my-stack/lib/dosageForms.test.ts
npx tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/features/my-stack/types.ts src/features/my-stack/lib/categories.ts src/features/my-stack/lib/dosageForms.ts src/features/my-stack/lib/dosageForms.test.ts
git commit -m "feat: add neutral stack domain model"
```

---

### Task 2: Validierung und Duplikat-Fingerprint

**Files:**
- Create: `src/features/my-stack/lib/validation.ts`
- Create: `src/features/my-stack/lib/validation.test.ts`
- Create: `src/features/my-stack/lib/duplicateFingerprint.ts`
- Create: `src/features/my-stack/lib/duplicateFingerprint.test.ts`

- [ ] **Step 1: Failing Validierungstests schreiben**

Die Tests müssen mindestens abdecken:

```ts
expect(validateStackItemDraft(validVitaminD)).toEqual({})
expect(validateStackItemDraft({ ...validVitaminD, dosageForm: null }).dosageForm).toBeTruthy()
expect(validateStackItemDraft({ ...validVitaminD, ingredients: [] }).ingredients).toBeTruthy()
expect(validateStackItemDraft({ ...validVitaminD, ingredients: [{ ...ingredient, amount_value: null }] }).ingredients?.[0].amountValue).toBeTruthy()
expect(validateStackItemDraft({ ...validVitaminD, ingredients: [{ ...ingredient, basis_unit: null }] }).ingredients?.[0].basisUnit).toBeTruthy()
```

Zusätzlich: freie Substanz ohne `catalog_substance_id` ist gültig, wenn `custom_name` gesetzt ist; Katalogzeile ohne `custom_name` ist gültig; Mehrfachwirkstoff markiert nur fehlerhafte Zeilen.

- [ ] **Step 2: Failing Fingerprint-Tests schreiben**

```ts
it('ignoriert Reihenfolge, Großschreibung und Dezimalformat', () => {
  const a = draft('capsule', [ingredient('Vitamin D3', 5000, 'IU', 1, 'capsule'), ingredient('K2', 100, 'mcg', 1, 'capsule')])
  const b = draft('capsule', [ingredient(' k2 ', 100.0, 'MCG', 1.0, 'CAPSULE'), ingredient('vitamin d3', 5000.00, 'iu', 1, 'capsule')])
  expect(buildDuplicateFingerprint(a)).toBe(buildDuplicateFingerprint(b))
})

it('unterscheidet Form und Stärke, aber nicht Marke', () => {
  expect(buildDuplicateFingerprint(d3Capsule1000)).not.toBe(buildDuplicateFingerprint(d3Drops1000))
  expect(buildDuplicateFingerprint(d3Capsule1000)).not.toBe(buildDuplicateFingerprint(d3Capsule5000))
  expect(buildDuplicateFingerprint({ ...d3Capsule1000, brand: 'A' })).toBe(buildDuplicateFingerprint({ ...d3Capsule1000, brand: 'B' }))
})
```

- [ ] **Step 3: Tests ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/lib/validation.test.ts src/features/my-stack/lib/duplicateFingerprint.test.ts`

Expected: FAIL — Module fehlen.

- [ ] **Step 4: Minimale Implementierung schreiben**

`validation.ts` liefert strukturierte Feldfehler statt Toast-Texten. `duplicateFingerprint.ts` normalisiert mit `trim().toLocaleLowerCase('en-US')`, standardisierter Dezimaldarstellung, kleingeschriebenen Einheiten und sortierten Inhaltsstoffteilen. Der Fingerprint enthält nur Darreichungsform plus vollständige Inhaltsstoffzusammensetzung; `displayName`, `brand`, `colorHex` und `notes` sind ausgeschlossen.

- [ ] **Step 5: Tests ausführen**

```powershell
npx vitest run src/features/my-stack/lib/validation.test.ts src/features/my-stack/lib/duplicateFingerprint.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/features/my-stack/lib/validation.ts src/features/my-stack/lib/validation.test.ts src/features/my-stack/lib/duplicateFingerprint.ts src/features/my-stack/lib/duplicateFingerprint.test.ts
git commit -m "feat: validate stack variants and detect duplicates"
```

---

### Task 3: Datenbankmigration als noch nicht ausgeführten Cutover vorbereiten

**Files:**
- Create: `supabase-my-stack-verify.sql`
- Create: `supabase-my-stack-rollback.sql`
- Create: `supabase-my-stack-foundation.sql`
- Create: `src/features/my-stack/lib/schemaMigration.test.ts`

Die SQL-Datei wird in dieser Aufgabe geschrieben und lokal geprüft, aber noch nicht gegen das verknüpfte Supabase-Projekt ausgeführt.

- [ ] **Step 1: Failing Contract-Test schreiben**

Create `src/features/my-stack/lib/schemaMigration.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(resolve('supabase-my-stack-foundation.sql'), 'utf8').toLowerCase()

describe('my stack migration contract', () => {
  it('läuft in einer Transaktion und benennt die zentrale Tabelle um', () => {
    expect(sql).toContain('begin;')
    expect(sql).toContain('alter table public.peptides rename to stack_items')
    expect(sql).toContain('alter table public.stack_items rename column name to display_name')
    expect(sql.trimEnd().endsWith('commit;')).toBe(true)
  })

  it.each(['vials', 'dose_logs', 'cycles', 'effects', 'reviews', 'injection_logs'])(
    'benennt %s.peptide_id um', table => {
      expect(sql).toContain(`alter table public.${table} rename column peptide_id to stack_item_id`)
    },
  )

  it('legt Katalog, Inhaltsstoffe, RLS und atomare Save-Funktion an', () => {
    expect(sql).toContain('create table public.substance_catalog')
    expect(sql).toContain('create table public.stack_item_ingredients')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('create or replace function public.save_stack_item')
  })

  it('migriert fehlende Stärken als needs_review statt Werte zu erfinden', () => {
    expect(sql).toContain("configuration_status = 'needs_review'")
    expect(sql).toContain('vial_amount_mg is null')
  })

  it('führt Peptipedia nicht in den Rename ein', () => {
    expect(sql).not.toContain('alter table public.peptide_library')
  })
})
```

- [ ] **Step 2: Test ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/lib/schemaMigration.test.ts`

Der Test lädt zusätzlich `supabase-my-stack-verify.sql` und `supabase-my-stack-rollback.sql`: Der Verifier darf keine DDL-/DML-Schlüsselwörter enthalten; der Rollback muss in einer Transaktion die sechs FK-Spalten, `display_name` und `stack_items` zurückbenennen.

Ergänze im selben Test:

```ts
it('hält Verifier lesend und Rollback vollständig', () => {
  const verifySql = readFileSync(resolve('supabase-my-stack-verify.sql'), 'utf8').toLowerCase()
  const rollbackSql = readFileSync(resolve('supabase-my-stack-rollback.sql'), 'utf8').toLowerCase()

  expect(verifySql).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate)\b/)
  expect(rollbackSql).toContain('begin;')
  expect(rollbackSql).toContain('rename column stack_item_id to peptide_id')
  expect(rollbackSql).toContain('rename column display_name to name')
  expect(rollbackSql).toContain('alter table public.stack_items rename to peptides')
  expect(rollbackSql.trimEnd().endsWith('commit;')).toBe(true)
})
```

Expected: FAIL — `supabase-my-stack-foundation.sql` fehlt.

- [ ] **Step 3: Schema- und Datenmigration schreiben**

Create `supabase-my-stack-foundation.sql` mit dieser Reihenfolge innerhalb eines `begin`/`commit`-Blocks:

1. `substance_catalog` erstellen, `pk_profile_id` auf `pk_profiles` optional referenzieren, Select ausschließlich für `authenticated` per RLS erlauben, alle Schreibzugriffe für normale Clients verweigern.
2. Einen case-insensitiven Unique-Index auf `lower(canonical_name)` erstellen.
3. Einen kleinen, überprüfbaren Grundkatalog seeden: Vitamin D3/Cholecalciferol, Vitamin K2/Menachinon-7, Magnesium, Omega-3, Creatin/Kreatin, Testosteron, Testosteron Enantat, Metformin, Melatonin sowie Einträge aus `peptide_library`. Keine Dosierungen seeden.
4. `peptides` zu `stack_items` und `name` zu `display_name` umbenennen.
5. `category`, `dosage_form`, `brand`, `color_hex`, `configuration_status`, `updated_at` ergänzen. Altstände beginnen als `peptide`. Eindeutige Injektions-/Rekonstitutionsstände werden `vial` und `complete`; Nasal wird vorläufig `nasal_spray`, Oral/Transdermal/unklar wird `other`. Alle nicht eindeutigen Zuordnungen bleiben `needs_review` und werden niemals als Vial erfunden.
6. `stack_item_ingredients` mit `position >= 0`, positivem `basis_value` und der Regel „Katalog-ID oder freier Name“ erstellen.
7. Pro Altstand genau einen Inhaltsstoff anlegen. `vial_amount_mg` und `vial_amount_unit` übernehmen; bei fehlender Stärke `amount_value`/`amount_unit` null lassen und `needs_review` setzen.
8. Die sechs FK-Spalten und ihre Constraints umbenennen.
9. Policy und Index umbenennen beziehungsweise neu erstellen; RLS für Inhaltsstoffe prüft die Eigentümerschaft über `stack_items.user_id = auth.uid()`.
10. `updated_at`-Trigger und RPC aus Task 4 anlegen.
11. Einen read-only Verifier mit Vorher-/Nachher-Zählungen, Orphan-Checks, Policy-Metadaten und `has_function_privilege` erstellen.
12. Einen transaktionalen Sofort-Rollback erstellen, der neue Tabellen/Funktion entfernt und Namen/Constraints/Policy/Index zurückführt. Er ist nur zulässig, solange nach dem Cutover keine echten neuen Stack-Einträge geschrieben wurden.

Kernconstraints:

```sql
category text not null default 'peptide'
  check (category in ('peptide', 'medication', 'hormone', 'supplement', 'vitamin')),
dosage_form text not null default 'vial'
  check (dosage_form in ('vial', 'ampoule', 'pen', 'tablet', 'capsule', 'drops', 'liquid', 'powder', 'nasal_spray', 'spray', 'gel', 'patch', 'tube', 'other')),
configuration_status text not null default 'complete'
  check (configuration_status in ('complete', 'needs_review')),
color_hex text check (color_hex is null or color_hex ~ '^#[0-9A-Fa-f]{6}$')
```

Die Legacy-Spalten für Vial, Rekonstitution und Inventar bleiben in `stack_items`, weil deren fachliche Auslagerung nicht Teil dieses Projekts ist.

- [ ] **Step 4: Lokalen Migrationslauf gegen eine Kopie des Backups testen**

Die in Task 0 erzeugte Restore-Instanz erneut starten. Die Migration als dritte temporäre Migration kopieren und Reset ausführen:

```powershell
$backupRoot = 'C:\Users\Devin\TYD-backups\pre-my-stack-foundation-2026-07-21'
$restoreRoot = 'C:\tmp\tyd-my-stack-restore-check'
Copy-Item .\supabase-my-stack-foundation.sql "$restoreRoot\supabase\migrations\20260721000002_my_stack.sql"
supabase start --workdir $restoreRoot -x studio,inbucket,analytics,functions,edge-runtime,imgproxy
supabase db reset --local --workdir $restoreRoot --no-seed
supabase db dump --local --workdir $restoreRoot --schema public --file "$restoreRoot\post-migration-schema.sql"
rg -n "stack_items|stack_item_ingredients|substance_catalog|stack_item_id" "$restoreRoot\post-migration-schema.sql"
rg -n "create table.*peptides|peptide_id" "$restoreRoot\post-migration-schema.sql"
```

Expected: Erster Scan findet die neuen Objekte; zweiter Scan findet keine alte User-Stack-Tabelle und keine alte FK-Spalte. `peptide_library` darf weiterhin vorkommen.

- [ ] **Step 5: Contract-Test ausführen**

Run: `npx vitest run src/features/my-stack/lib/schemaMigration.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add supabase-my-stack-foundation.sql supabase-my-stack-verify.sql supabase-my-stack-rollback.sql src/features/my-stack/lib/schemaMigration.test.ts
git commit -m "feat: prepare my stack schema migration"
```

---

### Task 4: Atomaren Save-Vertrag und Datenservices implementieren

**Files:**
- Modify: `supabase-my-stack-foundation.sql`
- Create: `src/features/my-stack/services/substanceCatalog.ts`
- Create: `src/features/my-stack/services/substanceCatalog.test.ts`
- Create: `src/features/my-stack/services/stackItems.ts`
- Create: `src/features/my-stack/services/stackItems.test.ts`

- [ ] **Step 1: Failing Service-Tests schreiben**

Die Services erhalten einen kleinen injizierbaren Supabase-Client-Vertrag, damit keine Netzwerkverbindung im Unit-Test nötig ist. Abdecken:

```ts
it('durchsucht kanonische Namen und Aliase case-insensitiv', () => {
  expect(filterCatalog(entries, 'chole')).toEqual([vitaminD3])
})

it('liefert bei Katalogfehlern ein leeres Ergebnis statt den freien Flow zu blockieren', async () => {
  const result = await searchSubstanceCatalog(failingClient, 'Vitamin D')
  expect(result).toEqual({ entries: [], unavailable: true })
})

it('sendet Hauptobjekt und Inhaltsstoffe in genau einem RPC-Aufruf', async () => {
  await saveStackItem(mockClient, validDraft)
  expect(mockClient.rpc).toHaveBeenCalledTimes(1)
  expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item', expect.objectContaining({
    p_item: expect.objectContaining({ display_name: 'Vitamin D3' }),
    p_ingredients: expect.any(Array),
  }))
})

it('behält den Draft außerhalb des Services unverändert', async () => {
  const before = structuredClone(validDraft)
  await saveStackItem(mockClient, validDraft)
  expect(validDraft).toEqual(before)
})
```

- [ ] **Step 2: Tests ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/services/substanceCatalog.test.ts src/features/my-stack/services/stackItems.test.ts`

Expected: FAIL — Services fehlen.

- [ ] **Step 3: RPC in der Migration vollständig implementieren**

`public.save_stack_item(p_item jsonb, p_ingredients jsonb)` ist `security invoker`, verwendet ausschließlich `auth.uid()` als Eigentümer und validiert:

- angemeldeter Nutzer,
- mindestens ein Inhaltsstoff,
- gültige Kategorie und Form,
- bei neuen/kompletten Einträgen vollständige Stärke und Bezugsgröße,
- bei Edit nur einen eigenen Datensatz,
- Inhaltsstoffpositionen eindeutig.

Die Funktion führt Insert/Update des Hauptobjekts und Delete/Insert der Inhaltsstoffe in derselben Transaktion aus und gibt die gespeicherte `stack_items`-Zeile zurück. `p_item->>'user_id'` wird ignoriert; der Client kann keinen anderen Besitzer setzen. Die Funktion erhält `grant execute` für `authenticated`, nicht für `anon`.

- [ ] **Step 4: Services minimal implementieren**

`substanceCatalog.ts`:

- lädt nur `active = true`,
- sucht serverseitig breit und normalisiert clientseitig über `canonical_name` plus `aliases`,
- begrenzt sichtbare Vorschläge auf 20,
- gibt `{ entries, unavailable }` zurück.

`stackItems.ts`:

- `loadStackItems(client, archived)` lädt `stack_items` mit `stack_item_ingredients(..., substance_catalog(...))`,
- `saveStackItem` validiert lokal und ruft genau einmal `save_stack_item` auf,
- `archiveStackItem`, `restoreStackItem`, `deleteStackItem` verwenden die neutrale Tabelle,
- `findDuplicate` nutzt `buildDuplicateFingerprint` auf bereits geladenen Einträgen.

- [ ] **Step 5: Tests und SQL-Contract erneut ausführen**

```powershell
npx vitest run src/features/my-stack/services/substanceCatalog.test.ts src/features/my-stack/services/stackItems.test.ts src/features/my-stack/lib/schemaMigration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add supabase-my-stack-foundation.sql src/features/my-stack/services
git commit -m "feat: save stack items atomically"
```

---

### Task 5: Testbaren Wizard-Zustand implementieren

**Files:**
- Create: `src/features/my-stack/lib/wizardState.ts`
- Create: `src/features/my-stack/lib/wizardState.test.ts`

- [ ] **Step 1: Failing Zustands-Tests schreiben**

Der Zustandsautomat hat in Teilprojekt 1 die Schritte `substance`, `ingredients`, `dosage_form`, `strength`, `details`, `review`. Der spätere Schritt `tracking` ist nur ein stabiler Erweiterungspunkt im Typ, wird aber nicht gerendert.

```ts
it('übernimmt beim Katalogtreffer Name, Kategorie und einen Inhaltsstoff', () => {
  const next = wizardReducer(initialWizardState(), { type: 'catalog_selected', entry: vitaminD3 })
  expect(next.draft.displayName).toBe('Vitamin D3')
  expect(next.draft.category).toBe('vitamin')
  expect(next.draft.ingredients).toHaveLength(1)
})

it('erlaubt freie Eingabe ohne Katalog-ID', () => {
  const next = wizardReducer(initialWizardState(), { type: 'custom_started', name: 'Eigene Mischung' })
  expect(next.draft.ingredients[0].catalog_substance_id).toBeNull()
})

it('fügt Mehrfachwirkstoffe hinzu und hält Positionen stabil', () => {
  const next = wizardReducer(stateWithOneIngredient, { type: 'ingredient_added' })
  expect(next.draft.ingredients.map(row => row.position)).toEqual([0, 1])
})

it('setzt formabhängige Bezugsgrößen nur als editierbaren Vorschlag', () => {
  const next = wizardReducer(stateWithVitaminD, { type: 'dosage_form_selected', dosageForm: 'capsule' })
  expect(next.draft.ingredients[0].basis_unit).toBe('capsule')
})

it('unterscheidet Update und neue Variante beim Editieren', () => {
  expect(wizardReducer(editState, { type: 'save_mode_selected', mode: 'duplicate' }).saveMode).toBe('duplicate')
})
```

- [ ] **Step 2: Test ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/lib/wizardState.test.ts`

Expected: FAIL — Modul fehlt.

- [ ] **Step 3: Reducer und Initialzustände implementieren**

Implementiere ausschließlich pure Functions:

- `initialWizardState(existing?: StackItem)`
- `wizardReducer(state, action)`
- `canContinue(state)` über `validation.ts`
- `firstInvalidField(state)` für Fokussteuerung
- `didIdentityChange(original, draft)` für die Variantenabfrage.

Der Reducer setzt keine medizinischen Werte. Vorgeschlagene Einheiten/Formen stammen ausschließlich aus Katalog und Formregistry und bleiben editierbar.

- [ ] **Step 4: Test ausführen**

Run: `npx vitest run src/features/my-stack/lib/wizardState.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/my-stack/lib/wizardState.ts src/features/my-stack/lib/wizardState.test.ts
git commit -m "feat: add adaptive stack wizard state"
```

---

### Task 6: Wizard-Komponenten und barrierefreien Flow bauen

**Files:**
- Create: `src/features/my-stack/components/SubstanceSearch.tsx`
- Create: `src/features/my-stack/components/IngredientEditor.tsx`
- Create: `src/features/my-stack/components/DosageFormPicker.tsx`
- Create: `src/features/my-stack/components/StrengthEditor.tsx`
- Create: `src/features/my-stack/components/StackItemWizard.tsx`
- Create: `src/features/my-stack/components/StackItemWizard.test.ts`

- [ ] **Step 1: Failing Render- und Accessibility-Tests schreiben**

Mit `react-dom/server` und einem Mock für `react-i18next` testen:

```ts
it('beginnt mit der verständlichen Leitfrage', () => {
  const html = renderWizard()
  expect(html).toContain('my_stack_question')
  expect(html).toContain('role="dialog"')
  expect(html).toContain('aria-modal="true"')
})

it('zeigt Katalogtreffer und die freie Alternative', () => {
  const html = renderSearch({ query: 'Vitamin', entries: [vitaminD3] })
  expect(html).toContain('Vitamin D3')
  expect(html).toContain('my_stack_add_custom')
  expect(html).toContain('role="listbox"')
})

it('rendert Mehrfachwirkstoffe mit eindeutigen Beschriftungen', () => {
  const html = renderIngredientEditor(twoIngredients)
  expect(html).toContain('my_stack_ingredient_1')
  expect(html).toContain('my_stack_ingredient_2')
  expect(html).toContain('my_stack_add_ingredient')
})

it('zeigt nur zur Form passende Einheiten und Bezugsgrößen', () => {
  const html = renderStrengthEditor({ dosageForm: 'capsule', ingredient })
  expect(html).toContain('capsule')
  expect(html).not.toContain('vial')
})
```

Ein Quelltest prüft zusätzlich, dass Dialog schließen per Escape behandelt wird, beim ersten Validierungsfehler `focus()` aufgerufen wird und interaktive Touch-Ziele `min-h-11` besitzen.

- [ ] **Step 2: Tests ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/components/StackItemWizard.test.ts`

Expected: FAIL — Komponenten fehlen.

- [ ] **Step 3: Komponenten implementieren**

Flow in Teilprojekt 1:

1. „Was möchtest du hinzufügen?“
2. Bei freier Eingabe Kategorie; bei Produkt mit mehreren Wirkstoffen Produktname plus Inhaltsstoffliste.
3. Darreichungsform.
4. Stärke je Inhaltsstoff.
5. Optionale Marke, Farbe, Notizen.
6. Zusammenfassung.

Regeln:

- Katalogtreffer sind Vorschläge, keine Sperre.
- „Als eigene Substanz hinzufügen“ ist immer sichtbar, sobald Text eingegeben ist.
- Kategorie eines Katalogtreffers ist vorausgefüllt, bleibt editierbar.
- „Weiter“ wird nicht still deaktiviert: Bei Klick werden Feldfehler sichtbar und der Fokus springt zum ersten Fehler.
- Bei Identitätsänderung im Edit-Modus erscheint vor Review die Wahl „Bestehenden Eintrag ändern“ oder „Als neue Variante anlegen“.
- Bei Duplikat erscheinen „Bestehenden Eintrag öffnen“ (primär), „Trotzdem separat hinzufügen“ und „Abbrechen“.
- Fehler vom RPC lassen den Dialog und sämtliche Eingaben offen.
- Der Flow bietet noch keinen Einnahmeplan an; nach Review wird gespeichert. Der Reducer ist für den späteren `tracking`-Schritt vorbereitet.
- Dialog: Fokusfalle, Escape, Rückgabe des Fokus an den auslösenden Button, `aria-labelledby`, `aria-describedby`.

- [ ] **Step 4: Tests ausführen**

```powershell
npx vitest run src/features/my-stack/components/StackItemWizard.test.ts src/features/my-stack/lib/wizardState.test.ts src/features/my-stack/lib/validation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/features/my-stack/components/SubstanceSearch.tsx src/features/my-stack/components/IngredientEditor.tsx src/features/my-stack/components/DosageFormPicker.tsx src/features/my-stack/components/StrengthEditor.tsx src/features/my-stack/components/StackItemWizard.tsx src/features/my-stack/components/StackItemWizard.test.ts
git commit -m "feat: build general substance wizard"
```

---

### Task 7: Vial-Renderer hinter eine neutrale Bühne stellen

**Files:**
- Create: `src/features/my-stack/extensions/peptide/VialRenderer.tsx`
- Create: `src/features/my-stack/components/StackStage.tsx`
- Create: `src/features/my-stack/components/StackStage.test.ts`
- Keep unchanged: `src/components/PeptideVialVisual.tsx`
- Keep unchanged: `src/components/PeptideVialVisual.test.ts`
- Keep unchanged: `src/components/SloshContext.tsx`

- [ ] **Step 1: Failing Bühnen-Contract schreiben**

```ts
it('rendert das bestehende Vial nur für freigeschaltete Vial-Einträge', () => {
  expect(renderStage(vialItem)).toContain('data-stack-renderer="vial"')
  expect(renderStage(capsuleItem)).toContain('data-stack-renderer="unsupported"')
})

it('behält nicht freigeschaltete Formen in einer textuellen Darstellung', () => {
  const html = renderStage(capsuleItem)
  expect(html).toContain('Vitamin D3')
  expect(html).toContain('my_stack_visual_pending')
  expect(html).not.toContain('PeptideVialVisual')
})
```

Der Quelltest prüft, dass `VialRenderer` tatsächlich `PeptideVialVisual`, `VialStageLightHandle` und den vorhandenen Slosh-Kontext verwendet und keine vereinfachte Ersatzgrafik enthält.

- [ ] **Step 2: Test ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/components/StackStage.test.ts src/components/PeptideVialVisual.test.ts`

Expected: Neuer Test FAIL; bestehende Vial-Tests PASS.

- [ ] **Step 3: Adapter und Bühne implementieren**

`VialRenderer` übersetzt nur neutrale `StackItem`-Props in die bestehenden Vial-Props. `StackStage` entscheidet ausschließlich über `isStageRenderable(item.dosage_form)`. Für nicht freigeschaltete Formen wird kein generisches 3D-Objekt und kein minderwertiges Icon erzeugt; die Entwicklungsversion zeigt einen hochwertigen textuellen Platzhalter in der Listenansicht.

- [ ] **Step 4: Regression ausführen**

```powershell
npx vitest run src/features/my-stack/components/StackStage.test.ts src/components/PeptideVialVisual.test.ts
```

Expected: PASS, einschließlich aller bisherigen Licht-, Slosh- und Füllstandstests.

- [ ] **Step 5: Commit**

```powershell
git add src/features/my-stack/extensions/peptide/VialRenderer.tsx src/features/my-stack/components/StackStage.tsx src/features/my-stack/components/StackStage.test.ts
git commit -m "refactor: add neutral stack stage boundary"
```

---

### Task 8: Bestehende My-Stack-Seite modularisieren und Wizard integrieren

**Files:**
- Create: `src/features/my-stack/MyStackPage.tsx`
- Create: `src/features/my-stack/MyStackPage.test.ts`
- Create: `src/features/my-stack/components/StackItemDetails.tsx`
- Create: `src/features/my-stack/components/StackArchive.tsx`
- Temporarily modify: `src/pages/Peptide.tsx`
- Modify: `src/pages/Peptide.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Bestehende Regressionstests auf das neue Ziel ausrichten**

Die umfangreichen Quelltests aus `src/pages/Peptide.test.ts` zunächst unverändert nach `src/features/my-stack/MyStackPage.test.ts` übertragen und nur den gelesenen Dateipfad anpassen. Ergänze Tests, dass:

- `MyStackPage` `StackItemWizard`, `StackStage`, `StackItemDetails` und `StackArchive` verwendet,
- das Vial-Karussell seine Snap-, Pointer-, Wheel-, Bühnenlicht- und Fokuslogik behält,
- Listenansicht alle Formen darstellen kann,
- grafische Ansicht nicht renderbare Formen nicht als falsches Vial zeigt.

`src/pages/Peptide.test.ts` prüft vorübergehend nur den dünnen Re-Export.

- [ ] **Step 2: Tests ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/MyStackPage.test.ts src/pages/Peptide.test.ts`

Expected: FAIL — neue Feature-Seite fehlt.

- [ ] **Step 3: Seite mechanisch verschieben, ohne Verhalten zu ändern**

Mit `apply_patch` den Inhalt von `src/pages/Peptide.tsx` nach `src/features/my-stack/MyStackPage.tsx` verschieben, relative Imports korrigieren und den Export `MyStackPage` nennen. Der alte Pfad exportiert vorübergehend:

```ts
export { MyStackPage as Peptide } from '../features/my-stack/MyStackPage'
```

Danach zuerst die übertragenen Regressionstests grün machen. Keine fachliche Änderung mit dem mechanischen Move vermischen.

- [ ] **Step 4: Generische Abschnitte extrahieren**

Mit separaten `apply_patch`-Schritten:

- Archiv-Dialog nach `StackArchive.tsx`,
- generische Info-/Detailansicht nach `StackItemDetails.tsx`,
- Bühne über `StackStage.tsx`,
- bisheriges `PeptideFormModal` durch `StackItemWizard`,
- direktes CRUD durch `stackItems.ts`.

Bestehende Zyklus-, Eskalations-, Rekonstitutions- und Inventarlogik bleibt in diesem Teilprojekt erreichbar und wird nur auf neutrale IDs umgestellt.

- [ ] **Step 5: Route lokal auf die Feature-Seite umstellen**

`src/App.tsx` importiert `MyStackPage` direkt. In diesem Zwischenschritt darf `/peptide` noch dieselbe Seite rendern; der sichtbare Wechsel auf `/my-stack` erfolgt in Task 13 zusammen mit Navigation und Übersetzungen.

- [ ] **Step 6: Fokussierte Regression ausführen**

```powershell
npx vitest run src/features/my-stack/MyStackPage.test.ts src/features/my-stack/components/StackItemWizard.test.ts src/features/my-stack/components/StackStage.test.ts src/components/PeptideVialVisual.test.ts src/pages/Peptide.test.ts
npx tsc -b --pretty false
```

Expected: PASS. Da der finale Client bereits `stack_items` anspricht, erfolgt der echte Laufzeitvergleich erst nach dem Cutover in Task 15 anhand der gesicherten Baseline-Screenshots; bis dahin sichern die bestehenden Vial-Regressionstests das Verhalten.

- [ ] **Step 7: Commit**

```powershell
git add src/features/my-stack src/pages/Peptide.tsx src/pages/Peptide.test.ts src/App.tsx
git commit -m "refactor: modularize my stack page"
```

---

### Task 9: Farben persistieren und alte Formulargrenze entfernen

**Files:**
- Create: `src/features/my-stack/lib/colors.ts`
- Create: `src/features/my-stack/lib/colorMigration.ts`
- Create: `src/features/my-stack/lib/colorMigration.test.ts`
- Modify: `src/features/my-stack/MyStackPage.tsx`
- Delete after zero-reference scan: `src/lib/peptideColors.ts`
- Delete after zero-reference scan: `src/components/PeptideFormModal.tsx`
- Delete after zero-reference scan: `src/components/PeptideFormModal.test.ts`
- Delete after zero-reference scan: `src/lib/peptideFormTypes.ts`

- [ ] **Step 1: Failing Tests für die Einmalmigration schreiben**

Abdecken:

```ts
it('übernimmt eine lokale Farbe nur wenn die DB noch keine Farbe hat', async () => {
  await migrateLocalColors(client, items, storageWith({ [item.id]: '#06b6d4' }))
  expect(client.updates).toEqual([{ id: item.id, color_hex: '#06b6d4' }])
})

it('überschreibt keine bereits persistierte Farbe', async () => {
  await migrateLocalColors(client, [{ ...item, color_hex: '#ffffff' }], storageWith({ [item.id]: '#06b6d4' }))
  expect(client.updates).toEqual([])
})

it('persistiert bei fehlendem LocalStorage-Wert den stabilen Fallback', async () => {
  await migrateLocalColors(client, [item], storageWith({}))
  expect(client.updates[0].color_hex).toMatch(/^#[0-9a-f]{6}$/i)
})

it('setzt den Migrationsmarker erst nach vollständig erfolgreichen Updates', async () => {
  await expect(migrateLocalColors(failingClient, items, storageWith(localColors))).rejects.toThrow()
  expect(storage.getItem('tyd_stack_colors_migrated_v1')).toBeNull()
})
```

- [ ] **Step 2: Test ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/lib/colorMigration.test.ts`

Expected: FAIL — Module fehlen.

- [ ] **Step 3: Neutrale Farbquelle und Einmalmigration implementieren**

`colors.ts` übernimmt die bestehende Palette unverändert, benennt Exporte neutral und bietet einen stabilen ID-Hash-Fallback. `colorMigration.ts`:

1. prüft `tyd_stack_colors_migrated_v1`,
2. parst `tyd_peptide_colors` defensiv,
3. aktualisiert nur `color_hex is null`,
4. verwendet lokale Farbe oder stabilen Fallback,
5. setzt den Marker erst nach Erfolg,
6. löscht den alten Farbspeicher nicht automatisch; das Backup bleibt rückrollbar.

`MyStackPage` führt die Migration nach dem ersten erfolgreichen Laden genau einmal aus und lädt danach neu.

- [ ] **Step 4: Alte Formular-/Farbdateien erst nach Zero-Reference-Scan entfernen**

```powershell
rg -n "PeptideFormModal|peptideFormTypes|getPeptideColor|getRandomPeptideColor" src
```

Expected vor Delete: keine Referenz außerhalb der zu löschenden Dateien/Tests. Danach mit `apply_patch` löschen.

- [ ] **Step 5: Tests ausführen**

```powershell
npx vitest run src/features/my-stack/lib/colorMigration.test.ts src/features/my-stack/MyStackPage.test.ts src/features/my-stack/components/StackItemWizard.test.ts
npx tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/features/my-stack src/lib/peptideColors.ts src/components/PeptideFormModal.tsx src/components/PeptideFormModal.test.ts src/lib/peptideFormTypes.ts
git commit -m "feat: persist stack colors in database"
```

---

### Task 10: Planungs- und Kalenderkern auf neutrale IDs umstellen

**Files:**
- Modify: `src/lib/intakeSchedule.ts`
- Modify: `src/lib/intakeSchedule.test.ts`
- Modify: `src/lib/doseAdjustmentBackfill.ts`
- Modify: `src/lib/doseAdjustmentBackfill.test.ts`
- Modify: `src/lib/insights.ts`
- Move: `src/lib/peptideStock.ts` → `src/features/my-stack/extensions/peptide/vialStock.ts`
- Modify affected stock tests/imports
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Dashboard.tsx`
- Modify: `src/features/my-stack/MyStackPage.tsx`

- [ ] **Step 1: Tests zuerst auf den neuen Vertrag ändern**

In Fixtures, Interfaces und Assertions ausschließlich fachlich zugehörige Vorkommen ändern:

```ts
interface ScheduleCycle {
  id: string
  stack_item_id: string
  // unveränderte Planfelder
}

interface IntakeLog {
  stack_item_id: string
  logged_at: string
  taken: boolean | null
}
```

Maps heißen `stackItemNameById`, lokale Variablen `stackItemId`. Peptid-spezifische Vial-Funktionen dürfen im Extension-Ordner weiterhin „Vial“/„peptide-specific“ heißen, aber verwenden den neutralen FK.

- [ ] **Step 2: Fokussierte Tests ausführen und erwarteten Fehler bestätigen**

```powershell
npx vitest run src/lib/intakeSchedule.test.ts src/lib/doseAdjustmentBackfill.test.ts src/features/my-stack/MyStackPage.test.ts
```

Expected: FAIL — Implementierungen erwarten noch `peptide_id`.

- [ ] **Step 3: Implementierungen und Query-Strings chirurgisch ändern**

Ändern:

- `.from('peptides')` → `.from('stack_items')`,
- `peptide_id` → `stack_item_id`,
- Join `peptides(name)` → `stack_items(display_name)`,
- Select `name` des Stack-Objekts → `display_name`.

Nicht ändern:

- `peptide_library`,
- `pk_profiles.category = 'peptide'`,
- Forschungs-/Vial-Kommentare, die tatsächlich peptidspezifisch sind.

`Home` und `Dashboard` zeigen weiterhin bestehende Zyklus-/Einnahmelogik; nur Identität und Anzeigename wechseln.

- [ ] **Step 4: Tests und Typprüfung ausführen**

```powershell
npx vitest run src/lib/intakeSchedule.test.ts src/lib/doseAdjustmentBackfill.test.ts src/features/my-stack/MyStackPage.test.ts
npx tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/intakeSchedule.ts src/lib/intakeSchedule.test.ts src/lib/doseAdjustmentBackfill.ts src/lib/doseAdjustmentBackfill.test.ts src/lib/insights.ts src/lib/peptideStock.ts src/features/my-stack/extensions/peptide src/pages/Home.tsx src/pages/Dashboard.tsx src/features/my-stack/MyStackPage.tsx
git commit -m "refactor: generalize stack scheduling references"
```

---

### Task 11: Injektionstracker auf `stack_item_id` umstellen

**Files:**
- Modify: `src/lib/injectionLogTypes.ts`
- Modify: `src/lib/injectionPersistence.ts`
- Modify: `src/lib/injectionPersistence.test.ts`
- Modify: `src/lib/injectionGeometry.test.ts`
- Modify: `src/lib/injectionHistory.test.ts`
- Modify: `src/lib/injectionPinPresentation.test.ts`
- Modify: `src/pages/InjektionsTracker.tsx`

- [ ] **Step 1: Tests und Typen auf den neuen FK-Vertrag ändern**

Payloads und Rows verwenden `stack_item_id`. Die sichtbare Bezeichnung bleibt `substance_label`; Geometrie, Positionen, Warnzustände und Dosisverknüpfung bleiben unverändert.

- [ ] **Step 2: Failing Tests ausführen**

```powershell
npx vitest run src/lib/injectionPersistence.test.ts src/lib/injectionGeometry.test.ts src/lib/injectionHistory.test.ts src/lib/injectionPinPresentation.test.ts
```

Expected: FAIL — Persistence/Typen verwenden noch `peptide_id`.

- [ ] **Step 3: Persistence und Seite umstellen**

Nur DB-Feld, Query-Auswahl und lokale generische Bezeichner ändern. Das in `InjektionsTracker.tsx` eingebettete Schema-Hinweis-Snippet muss ebenfalls `stack_item_id uuid references stack_items` zeigen.

- [ ] **Step 4: Tests ausführen**

```powershell
npx vitest run src/lib/injectionPersistence.test.ts src/lib/injectionGeometry.test.ts src/lib/injectionHistory.test.ts src/lib/injectionPinPresentation.test.ts
npx tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/injectionLogTypes.ts src/lib/injectionPersistence.ts src/lib/injectionPersistence.test.ts src/lib/injectionGeometry.test.ts src/lib/injectionHistory.test.ts src/lib/injectionPinPresentation.test.ts src/pages/InjektionsTracker.tsx
git commit -m "refactor: link injections to stack items"
```

---

### Task 12: Fortschritt, Protokoll und übrige Stack-Consumer neutralisieren

**Files:**
- Modify: `src/features/fortschritt/types.ts`
- Modify: `src/features/fortschritt/hooks/useFortschrittData.ts`
- Modify: `src/features/fortschritt/lib/substances.ts`
- Modify: `src/features/fortschritt/lib/substances.test.ts`
- Modify: `src/features/fortschritt/lib/focusSummary.ts`
- Modify: `src/features/fortschritt/lib/metrics.ts`
- Modify: `src/pages/Protokoll.tsx`
- Modify: `src/lib/protocolPdf/types.ts`
- Modify: `src/lib/protocolPdf/loadProtocolData.ts`
- Modify: `src/lib/protocolPdf/renderProtocolPdf.ts`
- Modify: `src/lib/protocolPdf/protocolPdf.test.ts`
- Modify: `src/pages/Bewertungen.tsx`
- Modify: `src/pages/BlutspiegelSimulation.tsx`
- Modify: `src/pages/PublicProfile.tsx`
- Modify: `src/pages/Rechner.tsx`
- Modify: `src/pages/Tagebuch.tsx`
- Modify: `src/services/blutspiegelHistory.ts`
- Modify: `scripts/seed-test-data.ts`
- Modify: `scripts/seed-test-data.mjs`

- [ ] **Step 1: Tests auf neutrale Datenverträge ändern**

Ändere nur das User-Stack-Modell:

- `CycleRow.stack_item_id`,
- Join-Ergebnis `stack_items: { display_name }`,
- `DoseLogEntry.stack_item_id`,
- `stackItemNames: Map<string, string>`,
- PDF-Felder `stack_item_name` und `stack_item_id`.

PDF-Überschriften und Nutzertexte verwenden „Substanz“, nicht „Peptid“. Peptipedia- und PK-Fachbegriffe bleiben unberührt.

- [ ] **Step 2: Fokussierte Tests ausführen und erwarteten Fehler bestätigen**

```powershell
npx vitest run src/features/fortschritt/lib/substances.test.ts src/lib/protocolPdf/protocolPdf.test.ts
```

Expected: FAIL — Implementierungen/Fixtures verwenden noch den alten Vertrag.

- [ ] **Step 3: Queries und lokale Typen gruppenweise umstellen**

Gruppe A – Fortschritt; Tests grün machen.
Gruppe B – Protokoll/PDF; Tests grün machen.
Gruppe C – Bewertungen, Simulation, Profil, Rechner, Tagebuch und History-Service; Typprüfung grün machen.
Gruppe D – beide Seed-Skripte; gleiche Beispieldaten in `stack_items` und `stack_item_id` schreiben.

Kein blindes globales Ersetzen in `src/pages/lab`, `src/services/peptideLibrary.ts` oder `supabase-peptide-library*.sql`.

- [ ] **Step 4: Tests und Typprüfung ausführen**

```powershell
npx vitest run src/features/fortschritt/lib/substances.test.ts src/lib/protocolPdf/protocolPdf.test.ts
npx tsc -b --pretty false
```

Expected: PASS.

- [ ] **Step 5: Restscan der Runtime-Consumer**

```powershell
rg -n "from\('peptides'\)|peptide_id|peptides\(name\)" src scripts -g "!src/pages/lab/**" -g "!src/pages/PeptideLibrary.tsx" -g "!src/services/peptideLibrary.ts"
```

Expected: keine Treffer. Peptid-spezifische Bibliotheksdateien dürfen bei einem separaten unbeschränkten Scan weiterhin Treffer haben.

- [ ] **Step 6: Commit**

```powershell
git add src/features/fortschritt src/pages/Protokoll.tsx src/lib/protocolPdf src/pages/Bewertungen.tsx src/pages/BlutspiegelSimulation.tsx src/pages/PublicProfile.tsx src/pages/Rechner.tsx src/pages/Tagebuch.tsx src/services/blutspiegelHistory.ts scripts/seed-test-data.ts scripts/seed-test-data.mjs
git commit -m "refactor: generalize remaining stack consumers"
```

---

### Task 13: Übersetzungen, Navigation und alte Peptidpfade bereinigen

**Files:**
- Create: `scripts/my-stack-i18n-source.mjs`
- Create: `scripts/generate-my-stack-i18n.mjs`
- Create: `scripts/merge-my-stack-i18n.mjs`
- Create: `src/features/my-stack/lib/i18n.test.ts`
- Modify: `src/i18n/locales/ar.json`
- Modify: `src/i18n/locales/de.json`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/es.json`
- Modify: `src/i18n/locales/fr.json`
- Modify: `src/i18n/locales/hi.json`
- Modify: `src/i18n/locales/id.json`
- Modify: `src/i18n/locales/it.json`
- Modify: `src/i18n/locales/ja.json`
- Modify: `src/i18n/locales/ko.json`
- Modify: `src/i18n/locales/pt.json`
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/tr.json`
- Modify: `src/i18n/locales/zh.json`
- Modify: `package.json`
- Modify: `src/App.tsx`
- Modify: `src/components/Layout.tsx`
- Delete: `src/pages/Peptide.tsx`
- Delete: `src/pages/Peptide.test.ts`

- [ ] **Step 1: Failing Locale-Paritätstest schreiben**

`i18n.test.ts` lädt alle 14 JSON-Dateien und prüft die vollständige Schlüsselmenge aus `my-stack-i18n-source.mjs`. Mindestschlüssel:

```ts
const MY_STACK_KEYS = [
  'my_stack_question', 'my_stack_search_placeholder', 'my_stack_add_custom',
  'my_stack_category', 'my_stack_product_name', 'my_stack_add_ingredient',
  'my_stack_dosage_form', 'my_stack_strength', 'my_stack_per',
  'my_stack_other_unit', 'my_stack_brand_optional', 'my_stack_color_optional',
  'my_stack_notes_optional', 'my_stack_review', 'my_stack_existing_variant',
  'my_stack_open_existing', 'my_stack_add_anyway', 'my_stack_change_existing',
  'my_stack_create_variant', 'my_stack_needs_review', 'my_stack_visual_pending',
  'stack_category_peptide', 'stack_category_medication', 'stack_category_hormone',
  'stack_category_supplement', 'stack_category_vitamin',
  'dosage_form_vial', 'dosage_form_ampoule', 'dosage_form_pen',
  'dosage_form_tablet', 'dosage_form_capsule', 'dosage_form_drops',
  'dosage_form_liquid', 'dosage_form_powder', 'dosage_form_nasal_spray',
  'dosage_form_spray', 'dosage_form_gel', 'dosage_form_patch',
  'dosage_form_tube', 'dosage_form_other',
]
```

Der Test stellt sicher, dass Werte nicht leer und nicht identisch mit dem Schlüssel sind.

- [ ] **Step 2: Test ausführen und erwarteten Fehler bestätigen**

Run: `npx vitest run src/features/my-stack/lib/i18n.test.ts`

Expected: FAIL — Quellen/Schlüssel fehlen.

- [ ] **Step 3: Deutsche und englische Quelle schreiben**

`my-stack-i18n-source.mjs` enthält alle neuen Schlüssel auf Deutsch und Englisch sowie neutrale Ersatztexte für bestehende generische Keys, darunter:

- `nav_peptide` → „My Stack“ / “My Stack”,
- `stat_peptides` → „Substanzen in My Stack“ / “Substances in My Stack”,
- `tile_peptide` und `tile_peptide_desc` → My Stack / Substanzen und Pläne,
- `keine_peptide`, `zuerst_peptid`, `peptid_label`, `peptid_optional`, `kein_peptid`,
- generische Archiv-, Bewertungs-, Protokoll-, Kalender- und Share-Texte.

Nicht überschreiben: Keys mit `plib_`, forschungsspezifische `lab_`-Texte und Inhalte, die tatsächlich Peptide beschreiben.

- [ ] **Step 4: Generator und Merge-Skript implementieren**

Das Muster entspricht den bestehenden Onboarding-Skripten:

- Deutsch/Englisch sind manuell festgelegt.
- Die zwölf anderen Locales werden mit `@vitalets/google-translate-api` generiert.
- Ein Fehler behält den vorherigen Locale-Wert; er schreibt nicht still Englisch als endgültige Übersetzung.
- Merge sortiert nicht die vollständigen großen JSON-Dateien neu, sondern ersetzt/ergänzt nur die definierten Keys.
- `package.json` erhält `i18n:my-stack:generate` und `i18n:my-stack:merge`.

Run:

```powershell
npm run i18n:my-stack:generate
npm run i18n:my-stack:merge
```

Danach mindestens Deutsch, Englisch und eine RTL-Sprache visuell/stichprobenartig prüfen.

- [ ] **Step 5: Route und Navigation neutralisieren**

`src/App.tsx`:

- lazy import direkt aus `./features/my-stack/MyStackPage`,
- primäre Route `/my-stack`,
- alte Route `/peptide` leitet mit `<Navigate to="/my-stack" replace />` um.

`src/components/Layout.tsx`:

- My-Stack-Link und „Substanz hinzufügen“ verwenden `/my-stack`,
- aktive Route prüft `pathname === '/my-stack'`,
- bestehende Onboarding-`obKey`-Werte dürfen intern stabil bleiben, solange keine sichtbare Peptidbezeichnung entsteht.

Nach einem Zero-Reference-Scan die temporären Dateien `src/pages/Peptide.tsx` und `src/pages/Peptide.test.ts` mit `apply_patch` löschen.

- [ ] **Step 6: Tests und Restscan**

```powershell
npx vitest run src/features/my-stack/lib/i18n.test.ts src/features/my-stack/MyStackPage.test.ts
rg -n "['\"]/peptide|pages/Peptide" src
npm run build
```

Expected: Tests/Build PASS; alter Pfad kommt nur noch in der expliziten Redirect-Route vor.

- [ ] **Step 7: Commit**

```powershell
git add scripts/my-stack-i18n-source.mjs scripts/generate-my-stack-i18n.mjs scripts/merge-my-stack-i18n.mjs src/features/my-stack/lib/i18n.test.ts src/i18n/locales package.json src/App.tsx src/components/Layout.tsx src/pages/Peptide.tsx src/pages/Peptide.test.ts
git commit -m "feat: present my stack as a general substance feature"
```

---

### Task 14: Vollständige statische Verifikation und Graphify-Architekturprüfung

**Files:**
- Modify generated architecture artifacts: `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.html` und weitere von Graphify aktualisierte Dateien

- [ ] **Step 1: Verbotene Altverträge scannen**

```powershell
rg -n "from\('peptides'\)|peptide_id|peptides\(name\)" src scripts -g "!src/pages/lab/**" -g "!src/pages/PeptideLibrary.tsx" -g "!src/services/peptideLibrary.ts"
rg -n "PeptideFormModal|peptideFormTypes|tyd_peptide_colors" src
rg -n "TODO|FIXME|PLACEHOLDER|coming soon" src/features/my-stack supabase-my-stack-foundation.sql
```

Expected:

- erster Scan: keine Runtime-Treffer,
- zweiter Scan: nur die bewusst einmalige LocalStorage-Lesestelle in `colorMigration.ts`,
- dritter Scan: keine Platzhalter.

Ein separater Scan darf `peptide_library`, `PeptideVialVisual` und echte Peptid-Forschungsbegriffe weiterhin finden.

- [ ] **Step 2: Gesamte Qualitätssuite ausführen**

```powershell
npm test
npm run lint
npm run build
```

Expected: Alle Befehle Exit 0. Bestehende unbeteiligte Lint-Probleme nicht still beheben; falls vorhanden, exakt dokumentieren und nur neue My-Stack-Probleme korrigieren.

- [ ] **Step 3: Graphify aktualisieren**

```powershell
graphify update . --force
graphify explain "MyStackPage.tsx"
graphify affected "stack_items" --depth 3
```

Expected:

- `MyStackPage.tsx` ist nicht mehr der alleinige monolithische Knoten für Formular, Archiv, Bühne und Persistence,
- Wizard, Services, Registry und Bühne sind als eigene Nachbarn sichtbar,
- die erwarteten Consumer von `stack_items` entsprechen der Migrationsmatrix,
- kein neuer unbeabsichtigter Pfad von Peptipedia in User-Stack-Persistence.

- [ ] **Step 4: Diff prüfen**

```powershell
git diff --stat
git diff -- src/features/my-stack supabase-my-stack-foundation.sql src/App.tsx src/components/Layout.tsx
git status --short
```

Jede geänderte Zeile muss auf Spec oder Migrationsmatrix zurückführbar sein. Keine Änderung an `supabase/.temp/cli-latest` übernehmen.

- [ ] **Step 5: Graphify-Artefakte committen**

```powershell
git add graphify-out
git commit -m "docs: refresh graph after my stack refactor"
```

---

### Task 15: Verknüpfte Supabase-Datenbank cutovern und End-to-End prüfen

**Files:**
- Modify after verification: `docs/superpowers/checklists/my-stack-backup-manifest.md`
- Use read-only verifier: `supabase-my-stack-verify.sql`
- Emergency only: `supabase-my-stack-rollback.sql`

Dieser Task verändert die verknüpfte Datenbank. Vor Step 3 ist eine ausdrückliche, sichtbare Freigabe des Nutzers einzuholen, auch wenn alle lokalen Prüfungen grün sind.

- [ ] **Step 1: Vorher-Zählungen sichern**

```powershell
$backupRoot = 'C:\Users\Devin\TYD-backups\pre-my-stack-foundation-2026-07-21'
$env:SUPABASE_TELEMETRY_DISABLED = '1'
supabase db query --linked -o json "select json_build_object('peptides',(select count(*) from public.peptides),'vials',(select count(*) from public.vials),'dose_logs',(select count(*) from public.dose_logs),'cycles',(select count(*) from public.cycles),'effects',(select count(*) from public.effects),'reviews',(select count(*) from public.reviews),'injection_logs',(select count(*) from public.injection_logs)) as counts" | Tee-Object -FilePath "$backupRoot\pre-cutover-counts.json"
```

Expected: Valides JSON; Datei außerhalb Git.

- [ ] **Step 2: Letzten lokalen Migrationslauf wiederholen**

```powershell
$restoreRoot = 'C:\tmp\tyd-my-stack-restore-check'
Copy-Item .\supabase-my-stack-foundation.sql "$restoreRoot\supabase\migrations\20260721000002_my_stack.sql" -Force
supabase start --workdir $restoreRoot -x studio,inbucket,analytics,functions,edge-runtime,imgproxy
supabase db reset --local --workdir $restoreRoot --no-seed
supabase db query --local --workdir $restoreRoot --file .\supabase-my-stack-verify.sql
```

Expected: Verifier meldet gleiche Haupt-/Inhaltsstoffanzahl für migrierte Altstände, null verwaiste FKs, aktive RLS-Policies und korrekte RPC-Rechte.

- [ ] **Step 3: Freigabe einholen und Migration atomar ausführen**

Nach ausdrücklicher Freigabe:

```powershell
supabase db query --linked --file .\supabase-my-stack-foundation.sql
```

Expected: Exit 0. Weil die Datei eine Transaktion ist, hinterlässt ein SQL-Fehler keinen Teilzustand.

- [ ] **Step 4: Read-only Verifier gegen die verknüpfte Datenbank ausführen**

```powershell
supabase db query --linked --file .\supabase-my-stack-verify.sql
supabase db query --linked -o json "select json_build_object('stack_items',(select count(*) from public.stack_items),'ingredients',(select count(*) from public.stack_item_ingredients),'vials',(select count(*) from public.vials),'dose_logs',(select count(*) from public.dose_logs),'cycles',(select count(*) from public.cycles),'effects',(select count(*) from public.effects),'reviews',(select count(*) from public.reviews),'injection_logs',(select count(*) from public.injection_logs)) as counts" | Tee-Object -FilePath "$backupRoot\post-cutover-counts.json"
```

Expected:

- `pre.peptides == post.stack_items`,
- alle sechs abhängigen Tabellen und `injection_logs` behalten ihre Anzahl,
- mindestens ein Inhaltsstoff je vollständigem Stack-Objekt; Altstände ohne Stärke sind `needs_review`,
- null verwaiste `stack_item_id`,
- Policy `Own stack items` aktiv,
- `authenticated` darf `save_stack_item` ausführen, `anon` nicht.

Bei jeder Abweichung: App nicht weiter verwenden, keine Testdaten schreiben, Nutzer informieren und den geprüften Rollback ausführen:

```powershell
supabase db query --linked --file .\supabase-my-stack-rollback.sql
```

Danach alte Zählungen erneut prüfen. Falls der Rollback selbst scheitert, keine improvisierten Änderungen; vollständigen Restore aus Task 0 verwenden.

- [ ] **Step 5: Laufzeit-Smoke-Test im angemeldeten App-Profil**

Dev-Server starten und im In-App-Browser prüfen:

```powershell
npm run dev
```

Checkliste:

1. Bestehende Vials laden und mit `vial-baseline-desktop.png`/`vial-baseline-mobile.png` vergleichen; Karussell, Bühnenlicht, Reflexion, Schatten, Slosh, Füllstand, Details und Rekonstitution funktionieren.
2. Archiv öffnen, einen vorhandenen Eintrag ansehen und ohne Änderung schließen.
3. Wizard bis Review für „Vitamin D3 · Kapsel · 5.000 IU pro Kapsel“ durchlaufen und abbrechen.
4. Wizard bis Review für „Testosteron Enantat · Vial · 250 mg pro ml“ durchlaufen und abbrechen.
5. Mehrfachwirkstoff-Produkt mit zwei Zeilen bis Review durchlaufen und abbrechen.
6. Freie Substanz ohne Katalogtreffer bis Review durchlaufen und abbrechen.
7. Einen klar benannten QA-Eintrag über RPC speichern, Marke editieren, Stärkeänderung als neue Variante wählen, Duplikatwarnung prüfen, archivieren und wiederherstellen.
8. Den ausschließlich für diesen Test erzeugten QA-Eintrag und seine QA-Variante nach erfolgreicher Prüfung wieder entfernen; im Abschluss nennen, dass diese Testdaten gelöscht wurden.
9. Kalender, Home, Fortschritt, Protokoll/PDF, Tagebuch, Bewertungen, Injektionstracker und Blutspiegelsimulation öffnen und auf Lade-/Joinfehler prüfen.
10. Mobile Breite und Desktop prüfen; Tastatur durch Wizard, Fehlerfokus und Escape testen; RTL-Sprache stichprobenartig öffnen.

- [ ] **Step 6: Farbübernahme kontrollieren**

Nach erstem Laden:

- vorhandene lokale Farben sind in `stack_items.color_hex` vorhanden,
- bereits persistierte Farben wurden nicht überschrieben,
- `tyd_stack_colors_migrated_v1` wurde erst nach Erfolg gesetzt,
- der externe JSON-Export bleibt bis zum Abschluss erhalten.

- [ ] **Step 7: Manifest aktualisieren und final verifizieren**

Ergänze `docs/superpowers/checklists/my-stack-backup-manifest.md` um:

```md
- Linked cutover: passed
- Pre/post row counts: matched
- Foreign-key orphan check: zero
- RLS/RPC verification: passed
- Existing Vial regression: passed
- Wizard smoke paths: catalog, custom, compound, edit, duplicate, archive
- Local color migration: passed
- QA records removed: yes
```

Dann:

```powershell
npm test
npm run lint
npm run build
git status --short
```

Expected: grün; nur bekannte unbeteiligte Nutzeränderungen bleiben unstaged.

- [ ] **Step 8: Abschluss-Commit**

```powershell
git add docs/superpowers/checklists/my-stack-backup-manifest.md
git commit -m "docs: verify my stack cutover"
```

---

## Definition of Done

- Ein Nutzer kann Katalogsubstanz, freie Substanz oder Mehrfachwirkstoff-Produkt mit Kategorie, Form, Stärke, Bezugsgröße, Marke, Farbe und Notizen anlegen und nachträglich bearbeiten.
- Gleiche Substanz mit anderer Form oder Stärke ist eine eigene Variante; reine Markenänderung bleibt am bestehenden Eintrag; bewusste Duplikate sind nach Warnung möglich.
- Datenmodell, RPC, RLS, Indizes und alle Runtime-Consumer verwenden `stack_items`/`stack_item_id`.
- Peptipedia bleibt peptidspezifisch.
- Bestehende Daten, Beziehungen, Archivzustände und Farben sind erhalten; unklare Altstände sind `needs_review`, nicht erfunden.
- Nur das bestehende Vial ist grafisch freigeschaltet und behält seinen Qualitätsstandard; andere Formen sind sauber in der Liste darstellbar.
- Alle 14 Sprachen enthalten die neuen Texte; generische Nutzertexte sprechen von My Stack/Substanzen.
- Backup und Wiederherstellung wurden vorab real geprüft; Cutover-Zählungen, Orphans, RLS und RPC sind dokumentiert.
- Fokussierte Tests, Gesamttests, Lint, Build, Graphify-Prüfung und manuelle Kernpfade bestehen.
