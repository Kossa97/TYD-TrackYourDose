# TYD — Track Your Dose · Handoff-Dokument
> Stand: Mai 2026 · Entwickelt mit Claude Code

---

## 0. Projektstatus

**Ziel:** Eine vollständige, mobile-first Peptid-Tracking-App — Inventar, Rekonstitution, Zyklen, Kalender, Dosierungsrechner, Tagebuch, Bewertungen, Profil.

**Aktueller Stand:** App ist funktionsfähig und vollständig. Alle Kernfunktionen implementiert. Visuelles Design (Premium Biotech / Luxury Cyberpunk) abgeschlossen. Onboarding für neue Nutzer integriert.

**Files — aktiv genutzte Hauptdateien:**
- `src/pages/Peptide.tsx` — Inventar + Meine Peptide (größte Datei, ~1700 Zeilen)
- `src/pages/Dashboard.tsx` — Kalender + Tagesprotokoll
- `src/index.css` — Gesamtes Design-System
- `src/components/Onboarding.tsx` — 9-Schritte Nutzer-Anleitung
- `src/context/OnboardingContext.tsx` — Onboarding-State
- `tailwind.config.js` — Überschriebene Slate/Sky-Farben

**Geändert (verschoben gegenüber ursprünglichem Plan):**
- Bestand-Abzug im Inventar erfolgt NICHT mehr beim Anlegen eines Peptids — nur noch bei Verwerfen oder Rekonstitution wiederholen
- „Status"-Feld im Tagebuch entfernt (immer `eingetreten` gesetzt)
- Spritzenvolumen-Feld aus dem Peptid-Formular entfernt (nur noch im Rechner)
- Protokollieren-Button im Dashboard entfernt
- `backdrop-filter` aus Bottom-Sheet-Modals entfernt (bricht Scroll)

**Gescheitert / Nicht umsetzbar:**
- Push-Notifications für Snooze: kein Service Worker → `setTimeout` only (App muss offen sein)
- PDF-Vorschau direkt in der App: wird extern im Browser geöffnet
- Spotlight-Effekt im Onboarding (DOM-Highlighting): zu komplex → floating Panel stattdessen

**› Next — mögliche nächste Schritte:**
- SQL-Migration für `inventory_items` + `taken`-Spalte in Supabase ausführen (falls noch nicht getan)
- Ungenutzte Altdateien löschen: `Vorrat.tsx`, `Journal.tsx`, `Inventar.tsx`, `Zyklen.tsx`
- PWA / Offline-Support (Service Worker)
- Tablet-Sync via `git pull` nach jedem Push vom PC

---

## 1. Projektübersicht

**TYD (Track Your Dose)** ist eine persönliche Peptid-Management-App als Progressive Web App (PWA). Sie läuft im Browser, ist mobil-optimiert (max-w-lg, Bottom-Navigation) und ist für den privaten Gebrauch einer einzelnen Person ausgelegt.

### Tech-Stack

| Schicht | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 + custom CSS (index.css) |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Routing | React Router v6 |
| Icons | lucide-react |
| Notifications | react-hot-toast |
| Datums-Utils | date-fns (de locale) |
| Deployment | Lokal via `npm run dev` |

### Zugang

- **GitHub:** `https://github.com/Kossa97/TYD-TrackYourDose`
- **Supabase:** Dashboard unter `app.supabase.com` (Account: `devinko97@gmail.com`)
- **Lokal starten:** `cd C:\Users\Devin\peptid-tracker && npm run dev`

---

## 2. Datenbankschema (Supabase)

Alle Tabellen haben Row Level Security (RLS) aktiviert — jeder User sieht nur seine eigenen Daten.

### `profiles`
```
id (uuid, FK → auth.users)
username, display_name, age, weight_kg, height_cm, gender
notes, is_public, public_bio
share_peptide, share_kalender, share_tagebuch, share_bewertungen (boolean)
```

### `inventory_items` ← NEU
```
id, user_id
name, batch_number, batch_source, batch_file_url
vials_count, vials_initial      ← vials_initial = Ausgangsbestand (nie überschreiben)
mg_per_vial
created_at
```
> **Wichtig:** `vials_initial` wird nur beim ersten Einlagern gesetzt. Beim Bearbeiten nicht überschreiben.

### `peptides`
```
id, user_id
name, default_unit, default_dose, default_method
vial_amount_mg, reconstitution_ml
syringe_type                    ← Format: "1:100" (mL:Einheiten)
vials_in_stock, vials_initial   ← 100%-Basis für Vial-Balken
reconstitution_date, expiry_days
batch_number, batch_source, batch_file_url
inventory_item_id (FK → inventory_items)  ← NEU: Verknüpfung zum Rohstofflager
notes
created_at
```

### `cycles`
```
id, user_id, peptide_id
name, dose, unit, method
frequency, x_days_interval, schedule_days (text[])
start_date, end_date, active
intake_time, intake_time_custom
reminder                        ← Format: "on_time,2h" (komma-getrennt)
```

### `dose_escalations`
```
id, user_id, cycle_id
increase_amount, unit
start_type ('date' | 'after_days' | 'after_weeks')
start_date, start_after_days
notes
```

### `dose_logs`
```
id, user_id, peptide_id
dose, unit, method
logged_at (timestamptz)
notes
taken (boolean | null)          ← null=ausstehend, true=eingenommen, false=übersprungen
```

### `effects` (Tagebuch)
```
id, user_id, peptide_id
type ('effect' | 'side_effect')
description, severity (1-5)
status                          ← wird als 'eingetreten' gesetzt (UI-Feld entfernt)
duration, occurred_at
notes
```

### `reviews` (Bewertungen)
```
id, user_id, peptide_id
rating (1-5), title, body, pros, cons
experience ('gut' | 'mittel' | 'schlecht')
created_at
```

### Storage Buckets
- `batch-files` — PDFs und Bilder für Analyse-Dokumente (public)

### SQL das noch ausgeführt werden muss (falls noch nicht getan)
```sql
-- Inventar-Tabelle
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  batch_number text, batch_source text, batch_file_url text,
  vials_count integer not null default 1,
  vials_initial integer,
  mg_per_vial numeric not null,
  created_at timestamptz default now()
);
alter table inventory_items enable row level security;
create policy "Users manage own inventory" on inventory_items
  for all using (auth.uid() = user_id);

-- FK auf peptides
alter table peptides
  add column if not exists inventory_item_id uuid references inventory_items(id);

-- Taken-Status auf dose_logs
alter table dose_logs
  add column if not exists taken boolean default null;
```

---

## 3. Dateistruktur

```
src/
├── App.tsx                    ← Routes + Provider-Stack
├── main.tsx
├── index.css                  ← Gesamtes Design-System (Tokens, Components, Utilities)
│
├── context/
│   ├── AuthContext.tsx        ← Supabase Auth
│   └── OnboardingContext.tsx  ← Onboarding-Schritte (localStorage-basiert)
│
├── components/
│   ├── Layout.tsx             ← Bottom-Nav + Onboarding eingebunden
│   ├── ProtectedRoute.tsx
│   ├── NewDot.tsx             ← Pulsierender Punkt für unbesuchte Features
│   └── Onboarding.tsx        ← 9-Schritte Onboarding-Panel + RestartButton
│
├── pages/
│   ├── Dashboard.tsx          ← Kalender + Tagesprotokoll
│   ├── Peptide.tsx            ← Inventar-Tab + Meine Peptide-Tab (GROSSE Datei ~1700 Zeilen)
│   ├── Rechner.tsx            ← Dosierungsrechner mit SyringeScale
│   ├── Tagebuch.tsx           ← Wirkungen & Nebenwirkungen
│   ├── Bewertungen.tsx        ← Sterne-Bewertungen für Peptide
│   ├── Profil.tsx             ← Profil + Sharing + Onboarding-Restart
│   ├── FAQ.tsx                ← Hilfe (11 Kategorien, accordion)
│   ├── PublicProfile.tsx      ← Öffentliches Profil (/u/username)
│   └── Auth.tsx               ← Login / Registrierung
│
├── lib/
│   ├── supabase.ts            ← Supabase Client
│   ├── peptideColors.ts       ← 12 Peptid-Farben + getPeptideColor(index)
│   └── useNew.ts              ← Hook: erstes Mal sehen eines Features tracken
│
└── [ungenutzte Altdateien]
    ├── pages/Vorrat.tsx       ← Nie verlinkt, kann gelöscht werden
    ├── pages/Journal.tsx      ← Nie verlinkt, kann gelöscht werden
    ├── pages/Inventar.tsx     ← Nie verlinkt, kann gelöscht werden
    └── pages/Zyklen.tsx       ← Nie verlinkt, kann gelöscht werden
```

---

## 4. Kernfunktionen im Detail

### Inventar-Workflow (wichtigste Logik)
```
1. User legt Peptid im Inventar an (inventory_items)
   → vials_count & vials_initial werden gesetzt
   → vials_initial wird NIEMALS danach überschrieben

2. User klickt "Peptid anlegen" auf einem Inventar-Item
   → peptides-Eintrag wird erstellt mit inventory_item_id
   → Wirkstoff/Batch/Vials kommen aus Inventar (gesperrt im Formular)
   → Kein Abzug von vials_count bei Anlage!

3. Vials-Abzug erfolgt NUR bei:
   a) "Peptid verwerfen" → vials_count - 1
   b) "Rekonstitution wiederholen" → vials_count - 1

4. Vials-Grafik (VialStockDisplay):
   - Grüne Vials = verfügbar (vials_count - inUse)
   - Amber Vials = in Verwendung (= verknüpfte Peptide)
   - Grau (opacity 0.5) = nur wenn vials_count === 0
```

### Peptid-Farben (peptideColors.ts)
Jedes Peptid bekommt eine konsistente Farbe basierend auf seinem Index in der `peptides`-Liste (sortiert nach Name aus DB). Verwendet in:
- Kalender-Punkte (Dashboard)
- Zyklus-Zeilen (Dashboard)
- Vial-Animation (Peptide)

### Onboarding (OnboardingContext + Onboarding.tsx)
- Startet automatisch beim ersten App-Aufruf (localStorage-Check: `_ob_done`)
- 9 Schritte mit Vor/Zurück-Navigation und Skip
- Floating Panel über der Nav-Bar (z-index 40, `bottom: 76px`)
- Restart-Button in Profil-Seite
- **Achtung:** Kein `backdrop-filter` auf dem Panel (würde Scroll in Modals brechen)

### "Neu"-Signale (useNew.ts + NewDot.tsx)
localStorage-Keys `_new_*` tracken ob ein Feature zum ersten Mal gesehen wurde:
- `_new_nav_*` — Nav-Items (werden beim Besuchen der Route gecleart)
- `_new_inventar_tab` — Inventar-Tab
- `_new_peptide_info` — Info-Button (FileText) auf Peptid-Karten
- `_new_zyklus_btn` — Zyklus-hinzufügen-Button
- `_new_peptid_anlegen` — Peptid-anlegen-Button im Inventar

### Snooze (Dashboard)
`setTimeout` basiert — funktioniert NUR wenn die App offen ist. Kein Service Worker / Push.

---

## 5. Design-System

### Tailwind-Farb-Overrides (tailwind.config.js)
Die Standard-Tailwind-Farben `slate` und `sky` sind überschrieben:
- `slate-900` → `#07091a` (tiefes Blauschwarz)
- `slate-800` → `#0e1428`
- `sky-400` → `#00ccf5` (Neon-Cyan)
- `sky-500` → `#00aad4`

### CSS-Architektur (index.css)
```
:root          → Design-Tokens (CSS-Variablen)
@layer base    → Body-Gradient, Scrollbar, Range-Slider, Checkbox
@layer components → .card, .btn-primary/secondary/danger, .input, .select, .label, .badge
[global]       → Targeted Overrides für Tailwind-Klassen-Kombinationen
               → Tab-Switcher, Chips, Toggles, Bottom Sheets, Dropdowns
@layer utilities → .glass, .glow-cyan-sm/md, .text-gradient-cyan
```

### Bekannte CSS-Einschränkungen
- `backdrop-filter` auf scrollbaren Containern (`.rounded-t-2xl`) entfernt — bricht `overflow-y: auto`
- `.rounded-xl.p-1` und `.rounded-lg.p-1` Selektoren sind breit — treffen alle Tab-Container-Divs
- `button.bg-slate-800` und `button.bg-sky-500` sind globale Selektoren — wirken auf alle Inline-Buttons

---

## 6. Nav-Struktur

```
/ (Kalender/Dashboard)   ← Standard-Route
/peptide                 ← Inventar + Meine Peptide
/rechner                 ← Dosierungsrechner
/tagebuch                ← Wirkungen & Nebenwirkungen
/bewertungen             ← Sterne-Bewertungen
/profil                  ← Nutzer-Einstellungen
/faq                     ← Hilfe
/auth                    ← Login (außerhalb des Layouts)
/u/:username             ← Öffentliches Profil (außerhalb des Layouts)
```

---

## 7. Bekannte Limitierungen & TODOs

| Thema | Detail |
|---|---|
| **Snooze** | Nur während App offen. Kein persistentes Reminder-System. |
| **PDF-Upload** | Funktioniert nur wenn `batch-files` Storage Bucket existiert |
| **IU-Einheit im Rechner** | IU wird identisch wie mcg berechnet — keine Umrechnung. Pre-existing. |
| **useEffect-Deps** | In mehreren Dateien fehlen `user`/`loadX` in Dependency Arrays. Lint-Warnungen, kein Crash. |
| **Tote Dateien** | `Vorrat.tsx`, `Journal.tsx`, `Inventar.tsx`, `Zyklen.tsx` — können sicher gelöscht werden |
| **Tablet-Sync** | Über GitHub (`git pull` auf Tablet nach jedem `git push` vom PC) |
| **Offline** | Keine PWA-Offline-Unterstützung. App braucht Internet. |

---

## 8. Häufige Fehler & Fixes

| Fehler | Ursache | Fix |
|---|---|---|
| Modal-Scrollen funktioniert nicht | `backdrop-filter` auf `.rounded-t-2xl` | Nicht hinzufügen |
| Formular springt beim Öffnen | CSS-Animation auf `main > *` | Nicht animieren |
| Push rejected | Tablet hat neuere Commits | `git pull --rebase origin main` dann `git push` |
| App startet nicht | PowerShell Execution Policy | `Set-ExecutionPolicy Bypass -Scope Process` |
| Vials werden komplett abgezogen | Falsche `savePeptide`-Logik | Kein Abzug bei Neuanlage, nur bei Verwerfen/Rekonstitution |

---

## 9. Entwicklungs-Workflow

```bash
# Lokal starten (PC)
cd C:\Users\Devin\peptid-tracker
npm run dev          # öffnet http://localhost:5173

# Änderungen pushen
git add .
git commit -m "Beschreibung"
git push             # Passwort = Personal Access Token

# Auf Tablet aktualisieren
git pull
npm run dev
```

---

*Erstellt am 18. Mai 2026*
