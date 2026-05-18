# TYD — Track Your Dose · Handoff-Dokument
> Stand: Mai 2026 · Entwickelt mit Claude Code

---

## 0. Projektstatus

**Ziel:** Eine vollständige, mobile-first Peptid-Tracking-App — Inventar, Rekonstitution, Zyklen, Kalender, Dosierungsrechner, Tagebuch, Bewertungen, Profil — international verfügbar in 14 Sprachen.

**Aktueller Stand:** App ist funktionsfähig, vollständig und deployed auf Vercel. PWA-fähig (installierbar auf iPhone & Android). Internationalisierung (i18n) mit 14 Sprachen implementiert. Homescreen mit Kacheln und Quick-Stats. Interaktives Onboarding mit Highlight-Ring.

**Deployment:**
- **Vercel:** Automatisches Deployment bei jedem `git push` auf `main`
- **GitHub:** `https://github.com/Kossa97/TYD-TrackYourDose`
- **Lokal:** `cd C:\Users\Devin\peptid-tracker && npm run dev`

---

## 1. Tech-Stack

| Schicht | Technologie |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 + custom CSS (index.css) |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Routing | React Router v6 |
| Icons | lucide-react |
| Notifications | react-hot-toast |
| Datums-Utils | date-fns (de locale) |
| i18n | i18next + react-i18next + i18next-browser-languagedetector |
| PWA | vite-plugin-pwa |
| Deployment | Vercel (Auto-Deploy via GitHub) |

### Zugang
- **GitHub:** `https://github.com/Kossa97/TYD-TrackYourDose`
- **Supabase:** `app.supabase.com` (Account: `devinko97@gmail.com`)
- **Lokal starten:** `cd C:\Users\Devin\peptid-tracker && npm run dev`

---

## 2. Datenbankschema (Supabase)

Alle Tabellen haben Row Level Security (RLS) aktiviert.

### `profiles`
```
id (uuid, FK → auth.users)
username, display_name, age, weight_kg, height_cm, gender
notes, is_public, public_bio
share_peptide, share_kalender, share_tagebuch, share_bewertungen (boolean)
```

### `inventory_items`
```
id, user_id
name, batch_number, batch_source, batch_file_url
vials_count, vials_initial      ← vials_initial = Ausgangsbestand (NIE überschreiben)
mg_per_vial
created_at
```

### `peptides`
```
id, user_id
name, default_unit, default_dose, default_method
vial_amount_mg, reconstitution_ml
syringe_type                    ← Format: "1:100" (mL:Einheiten)
vials_in_stock, vials_initial
reconstitution_date, expiry_days
batch_number, batch_source, batch_file_url
inventory_item_id (FK → inventory_items)
notes, created_at
```

### `cycles`
```
id, user_id, peptide_id
name, dose, unit, method
frequency, x_days_interval, schedule_days (text[])
start_date, end_date, active
intake_time, intake_time_custom
reminder    ← Format: "on_time,2h" (komma-getrennt)
```

### `dose_escalations`
```
id, user_id, cycle_id
increase_amount, unit
start_type ('date' | 'after_days' | 'after_weeks')
start_date, start_after_days, notes
```

### `dose_logs`
```
id, user_id, peptide_id
dose, unit, method, logged_at (timestamptz), notes
taken (boolean | null)   ← null=ausstehend, true=eingenommen, false=übersprungen
```

### `effects` (Tagebuch)
```
id, user_id, peptide_id
type ('effect' | 'side_effect')
description, severity (1-5), status, duration, occurred_at, notes
```

### `reviews`
```
id, user_id, peptide_id
rating (1-5), title, body, pros, cons
experience ('gut' | 'mittel' | 'schlecht'), created_at
```

### Storage Buckets
- `batch-files` — PDFs und Bilder für Analyse-Dokumente (public)

### SQL (falls noch nicht ausgeführt)
```sql
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

alter table peptides
  add column if not exists inventory_item_id uuid references inventory_items(id);

alter table dose_logs
  add column if not exists taken boolean default null;
```

---

## 3. Dateistruktur

```
src/
├── App.tsx                    ← Routes + Provider-Stack
├── main.tsx                   ← i18n-Import + RTL-Richtung setzen
├── index.css                  ← Design-System (Tokens, Components, Utilities)
│
├── i18n/
│   ├── index.ts               ← i18next-Konfiguration, LANGUAGES-Array, applyDirection()
│   └── locales/
│       ├── de.json            ← Deutsch (Basis-Sprache, ~160 Keys)
│       ├── en.json            ← English
│       ├── es.json            ← Español
│       ├── fr.json            ← Français
│       ├── it.json            ← Italiano
│       ├── pt.json            ← Português
│       ├── ru.json            ← Русский
│       ├── tr.json            ← Türkçe
│       ├── ar.json            ← العربية (RTL)
│       ├── hi.json            ← हिन्दी
│       ├── id.json            ← Bahasa Indonesia
│       ├── zh.json            ← 中文
│       ├── ja.json            ← 日本語
│       └── ko.json            ← 한국어
│
├── context/
│   ├── AuthContext.tsx        ← Supabase Auth
│   └── OnboardingContext.tsx  ← Onboarding-Schritte (localStorage: _ob_done)
│
├── components/
│   ├── Layout.tsx             ← 5-Item Bottom-Nav + FAQ Floating Button + Onboarding
│   ├── ProtectedRoute.tsx
│   ├── NewDot.tsx             ← Pulsierender Punkt für neue Features
│   └── Onboarding.tsx        ← 9-Schritte Onboarding mit Highlight-Ring + RestartButton
│
├── pages/
│   ├── Home.tsx               ← Homescreen: Quick-Stats + Kacheln für alle Bereiche
│   ├── Dashboard.tsx          ← Kalender + Tagesprotokoll (/kalender)
│   ├── Peptide.tsx            ← Lager-Tab + Meine Peptide-Tab (~1700 Zeilen)
│   ├── Rechner.tsx            ← Dosierungsrechner mit SyringeScale
│   ├── Tagebuch.tsx           ← Wirkungen & Nebenwirkungen
│   ├── Bewertungen.tsx        ← Sterne-Bewertungen
│   ├── Profil.tsx             ← Profil + Sharing + Sprache + Onboarding-Restart
│   ├── FAQ.tsx                ← Hilfe (Kategorien, Accordion)
│   ├── PublicProfile.tsx      ← Öffentliches Profil (/u/username)
│   └── Auth.tsx               ← Login / Registrierung
│
├── lib/
│   ├── supabase.ts            ← Supabase Client
│   ├── peptideColors.ts       ← 12 Peptid-Farben + getPeptideColor(index)
│   └── useNew.ts              ← Hook: erstes Mal sehen tracken
│
└── public/
    ├── icon-192.png           ← PWA Icon (Peptid-Vial Design)
    ├── icon-512.png           ← PWA Icon groß
    └── favicon.svg
```

---

## 4. Navigation & Routing

### Bottom-Nav (5 Items)
```
Lager → /peptide?tab=inventar
Peptide → /peptide
🏠 Home (Mitte, hervorgehoben) → /
Kalender → /kalender
Profil → /profil
```
- Home-Button ist ein Cyan-Quadrat das sich leicht nach oben hebt
- FAQ erreichbar über schwebendes `?` Icon unten rechts über der Nav

### Alle Routen
```
/              ← Homescreen (Standard-Route)
/kalender      ← Kalender + Tagesprotokoll
/peptide       ← Lager + Meine Peptide (Tab per ?tab=inventar)
/rechner       ← Dosierungsrechner
/tagebuch      ← Wirkungen & Nebenwirkungen
/bewertungen   ← Sterne-Bewertungen
/profil        ← Nutzer-Einstellungen + Sprache
/faq           ← Hilfe
/auth          ← Login (außerhalb Layout)
/u/:username   ← Öffentliches Profil (außerhalb Layout)
```

---

## 5. Internationalisierung (i18n)

### 14 Sprachen
🇩🇪 Deutsch · 🇬🇧 English · 🇪🇸 Español · 🇫🇷 Français · 🇮🇹 Italiano · 🇧🇷 Português · 🇷🇺 Русский · 🇹🇷 Türkçe · 🇸🇦 العربية · 🇮🇳 हिन्दी · 🇮🇩 Bahasa Indonesia · 🇨🇳 中文 · 🇯🇵 日本語 · 🇰🇷 한국어

### Sprache wechseln
- **Profil-Seite → Sprache** → Dropdown → Sprache auswählen → **Übernehmen**
- Sprache wird in `localStorage('tyd_lang')` gespeichert
- Arabisch aktiviert automatisch RTL-Layout (`dir="rtl"`)
- Browser-Sprache wird beim ersten Start automatisch erkannt

### Übersetzt
- Navigation, Homescreen, Auth, Dashboard, Peptide/Lager, Rechner, Tagebuch, Bewertungen, Profil
- FAQ-Inhalte: noch auf Deutsch (sehr umfangreich)
- Supabase-Fehlermeldungen: kommen vom Server auf Englisch

### Keys hinzufügen
```ts
// 1. Key in src/i18n/locales/de.json + en.json hinzufügen
// 2. In Komponente:
import { useTranslation } from 'react-i18next'
const { t } = useTranslation()
// 3. Verwenden:
{t('mein_key')}
```

---

## 6. Kernfunktionen

### Homescreen (Home.tsx)
- Begrüßung mit Uhrzeit (Morgen/Tag/Abend) + Datum
- 3 Quick-Stats: Aktive Zyklen, Vials im Lager, Meine Peptide (live aus Supabase)
- 8 Kacheln für alle App-Bereiche
- Kalender-Kachel ist breit (spanning 2 Spalten)

### Inventar-Workflow (kritische Logik)
```
1. Einlagern → inventory_items erstellt (vials_count & vials_initial gesetzt)
   → vials_initial wird NIEMALS danach überschrieben

2. "Peptid anlegen" → peptides-Eintrag mit inventory_item_id
   → Kein Abzug von vials_count bei Anlage!

3. Vials-Abzug NUR bei:
   a) "Peptid verwerfen" → vials_count - 1
   b) "Rekonstitution wiederholen" → vials_count - 1

4. VialStockDisplay:
   Grün = verfügbar · Amber = in Verwendung · Grau = leer
```

### Onboarding (Onboarding.tsx)
- Startet automatisch beim ersten Aufruf (`localStorage: _ob_done`)
- 9 Schritte mit interaktivem Highlight-Ring (z-index 45, sichtbar über Nav)
- Klick auf den markierten Button → nächster Schritt automatisch
- Panel passt Größe und Position pro Schritt an (kompakt/groß, oben/unten)
- Schritt 5 (Formular): Panel erscheint oben (Form belegt unteren Bereich)
- Restart-Button in Profil-Seite

### PWA (vite.config.ts)
```
Name: "TYD – Track Your Dose"
Short name: "TYD"
Theme color: #00ccf5
Background: #07091a
Icons: icon-192.png, icon-512.png
```
iPhone installieren: Safari → Teilen → „Zum Home-Bildschirm" → „Als Web-App öffnen" aktivieren

---

## 7. Design-System

### Farben (tailwind.config.js)
- `slate-900` → `#07091a` · `slate-800` → `#0e1428`
- `sky-400` → `#00ccf5` (Neon-Cyan) · `sky-500` → `#00aad4`

### CSS-Architektur (index.css)
```
:root          → Design-Tokens
@layer base    → html/body overflow-x:hidden, overscroll-behavior-x:none
@layer components → .card, .btn-primary/secondary/danger, .input, .select, .label, .badge
@layer utilities → .glass, .glow-cyan-sm/md, .text-gradient-cyan
```

### Wichtige CSS-Regeln
- **KEIN** `backdrop-filter` auf scrollbaren Bottom-Sheet-Containern (bricht overflow-y)
- `html, body, #root` haben `overflow-x: hidden` + `max-width: 100vw` → kein horizontales Scrollen
- `min-h-dvh` statt `min-h-screen` (mobile Browser korrekt)
- iOS Safe-Area: `padding-bottom: env(safe-area-inset-bottom)` in Nav + Main

---

## 8. Bekannte Limitierungen

| Thema | Detail |
|---|---|
| **Push-Notifications** | Nicht implementiert. Snooze nur via `setTimeout` (App muss offen sein) |
| **FAQ-Übersetzung** | FAQ-Inhalte noch auf Deutsch — ~100 Strings, zu umfangreich |
| **IU-Einheit** | IU wird identisch wie mcg berechnet — keine Umrechnung |
| **useEffect-Deps** | Lint-Warnungen in mehreren Dateien, kein Crash |
| **Offline** | Keine PWA-Offline-Unterstützung. App braucht Internet |
| **Registrierung** | Offen für alle — in Supabase auf Invite-only einschränkbar |

---

## 9. Häufige Fehler & Fixes

| Fehler | Ursache | Fix |
|---|---|---|
| Modal-Scrollen funktioniert nicht | `backdrop-filter` auf `.rounded-t-2xl` | Nicht hinzufügen |
| Horizontales Scrollen | Element breiter als Viewport | `overflow-x: hidden` auf Wrapper |
| Push rejected | Tablet hat neuere Commits | `git pull --rebase origin main` dann push |
| App startet nicht | PowerShell Execution Policy | `Set-ExecutionPolicy Bypass -Scope Process` |
| Vials falsch abgezogen | `savePeptide`-Logik | Kein Abzug bei Neuanlage |
| Sprache zeigt Keys statt Text | i18n resources nicht in `{ translation: {} }` | `resources: { de: { translation: de } }` |

---

## 10. Entwicklungs-Workflow

```bash
# Lokal starten (PC)
cd C:\Users\Devin\peptid-tracker
npm run dev          # http://localhost:5173

# Änderungen deployen
git add .
git commit -m "Beschreibung"
git push             # → Vercel deployed automatisch

# Auf Tablet aktualisieren
git pull && npm run dev
```

---

*Zuletzt aktualisiert: Mai 2026*
