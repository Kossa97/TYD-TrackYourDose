# TYD — Track Your Dose · Handoff-Dokument
> Stand: Mai 2026 · Entwickelt mit Claude Code

---

## 0. Projektstatus

**Ziel:** Eine vollständige, mobile-first Peptid-Tracking-App — Inventar, Rekonstitution, Zyklen, Kalender, Dosierungsrechner, Tagebuch, Bewertungen, Profil — international verfügbar in 14 Sprachen.

**Aktueller Stand:** App ist funktionsfähig, vollständig und deployed auf Vercel. PWA-fähig (installierbar auf iPhone & Android). Internationalisierung (i18n) mit 14 Sprachen implementiert. Homescreen mit Kacheln und Quick-Stats. **Geführtes Onboarding** (21 Schritte): Sprach-Gate beim ersten Start, verankerte Tour-Karten neben Buttons/Feldern, Spotlight-Ring auf echten Eingabefeldern, Tour-Karte immer im Vordergrund (z-index 10050).

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
│   ├── faq/                   ← FAQ-Bundles: `getFaqBundle(lang)` (alle 14 Sprachen)
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── locales/           ← de.ts, en.ts, de.categories.ts, en.categories.ts, …
│   ├── data/
│   │   └── onboarding-i18n.json  ← generierte Onboarding-Strings (12 Nicht-DE/EN-Locales)
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
│   └── OnboardingContext.tsx  ← Tour-Status (localStorage: `_ob_done`, `tyd_lang_picked`)
│
├── components/
│   ├── Layout.tsx             ← 5-Item Bottom-Nav (`data-ob` auf Nav-Links) + FAQ + Onboarding
│   ├── ProtectedRoute.tsx
│   ├── NewDot.tsx             ← Pulsierender Punkt für neue Features
│   ├── LanguageGate.tsx       ← Erststart: Sprache wählen (z-index 60, vor Tutorial)
│   ├── Onboarding.tsx         ← Overlay: Scrim + verankerte Tour-Karte (Portal → body)
│   ├── onboardingSteps.ts     ← 21 Schritte (Metadaten, Routen, Selektoren)
│   ├── onboardingTarget.ts    ← Highlight-Rect auf Inputs/Buttons, Modal-Erkennung
│   ├── onboardingPlacement.ts ← Position der Tour-Karte (Viewport, Tab-Bar)
│   ├── onboardingLayers.ts    ← z-index-Stapel (Scrim 10000 … Panel 10050)
│   └── OnboardingRestartButton
│
├── pages/
│   ├── Home.tsx               ← Homescreen: Quick-Stats + Kacheln für alle Bereiche
│   ├── Dashboard.tsx          ← Kalender + Tagesprotokoll (/kalender)
│   ├── Peptide.tsx            ← Lager-Tab + Meine Peptide-Tab (~1700 Zeilen)
│   ├── Rechner.tsx            ← Dosierungsrechner mit SyringeScale
│   ├── Tagebuch.tsx           ← Wirkungen & Nebenwirkungen
│   ├── Bewertungen.tsx        ← Sterne-Bewertungen
│   ├── Profil.tsx             ← Profil + Sharing + Sprache + Onboarding-Restart
│   ├── FAQ.tsx                ← Hilfe: Inhalt aus `i18n/faq` je nach App-Sprache
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

scripts/
├── merge-onboarding-i18n.mjs  ← `ob_step_*` aus onboarding-i18n-source → alle locales/*.json
├── onboarding-i18n-source.mjs ← EN/DE Master-Texte für Onboarding
├── export-faq-en.ts / generate-faq-locales.mjs
└── generate-onboarding-i18n.mjs  ← optional (API); bei Fehler: merge-Skript nutzen
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
- **FAQ** (`src/i18n/faq/`): vollständig in allen **14 Sprachen** (`*.categories.ts` + UI-Strings in `*.ts`)
- **Onboarding & Sprach-Gate**: alle **14 Sprachen** (`lang_gate_*`, `ob_step_0`…`ob_step_20`, `ob_step_*_tap` in `locales/*.json`); beim ersten Start zuerst Sprachwahl (`tyd_lang_picked`), dann Tutorial (`_ob_done`)
- Onboarding-Texte pflegen: `scripts/onboarding-i18n-source.mjs` → `npm run i18n:onboarding:merge`
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

### Onboarding (LanguageGate + Onboarding.tsx)

**Ablauf beim ersten Start**
1. `LanguageGate` — Sprache wählen → `tyd_lang_picked` + `tyd_lang` in localStorage  
2. Willkommen (Schritt 0, zentriert) → Route `/`  
3. Tour Schritte 1–19 → Finish (Schritt 20)

**21 Schritte** (`onboardingSteps.ts`, Anzeige „Schritt 1–19“ ohne Welcome/Finish)

| # | ID | Fokus | Route / Hinweis |
|---|---|---|---|
| 0 | welcome | — | `/` |
| 1 | inv-nav | Bottom-Nav **Lager** | `/`, Klick auf Tab |
| 2 | add-stock | **+ Einlagern** | `/peptide?tab=inventar` → Sheet öffnet → auto Weiter |
| 3–5 | inv-name / amounts / batch | Felder im Inventar-Sheet | `advance: next` |
| 6 | inv-save | **Einlagern** speichern | Klick |
| 7 | create-peptide | Peptid anlegen | Klick |
| 8–10 | pep-liquid / expiry / dose | Peptid-Formular | next |
| 11 | pep-save | Peptid speichern | Klick |
| 12 | pep-tab | Tab Meine Peptide | Klick |
| 13–15 | Zyklus anlegen / Plan / speichern | | |
| 16–17 | Kalender-Nav + Monatsansicht | `/kalender` | |
| 18–19 | Home-Nav + Kacheln | `/` | |
| 20 | finish | — | zentriert |

**Technik**
- **Tour-Karte** (`#ob-callout`): z-index **10050**, immer klickbar; verankert neben Ziel mit Pfeil (`onboardingPlacement.ts`)
- **Scrim**: vier Paneelen um „Loch“ (`SpotlightScrim`), Ring auf **Inputs/Buttons** (`getOnboardingHighlightRect` in `onboardingTarget.ts`)
- **Sheets** (`data-app-modal`): z-index 10040; Klicks im offenen Sheet erlaubt, Ring nicht auf Buttons hinter dem Sheet
- **Bottom-Nav**: `data-ob` auf `<NavLink>` (nicht nur inneres Div); während Tour z-index 10030
- **Restart** (Profil): `OnboardingRestartButton` setzt `_ob_done` zurück und `navigate('/')`

**Onboarding zurücksetzen (Browser-Konsole)**
```js
localStorage.removeItem('_ob_done')
localStorage.removeItem('tyd_lang_picked')
location.reload()
```

**`data-ob` in Peptide.tsx** (Auszug): `nav-lager` (Layout), `btn-einlagern`, `inv-name`, `inv-amounts`, `inv-batch`, `btn-inv-save`, `btn-peptid-anlegen`, `pep-liquid`, `pep-expiry`, `pep-dose`, `btn-pep-save`, `tab-peptide`, `btn-zyklus-add`, `cycle-core`, `btn-cycle-save`; Kalender: `calendar-main`; Home: `home-tiles`

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
- **Onboarding** (`body.onboarding-active`): Stapel in `index.css` + `onboardingLayers.ts` — Scrim 10000, Modal 10040, Nav 10030, **`#ob-callout` 10050**; Ring-Animation **ohne** `transform: scale` (sonst versatz)

### Onboarding-CSS-Klassen (index.css)
`#ob-callout`, `.ob-callout-header`, `.ob-callout-main`, `.ob-callout-anchored`, `.ob-highlight-ring`, `.ob-scrim-pane`, `.ob-tap-cue`, `.ob-callout-actions`

---

## 8. Bekannte Limitierungen

| Thema | Detail |
|---|---|
| **Push-Notifications** | Nicht implementiert. Snooze nur via `setTimeout` (App muss offen sein) |
| **FAQ aktualisieren** | Englisch in `en.categories.ts` ändern → `npm run faq:export` → `npm run faq:generate` (oder `*.categories.ts` manuell pflegen) |
| **Onboarding-Texte** | `scripts/onboarding-i18n-source.mjs` (EN/DE) bearbeiten → `npm run i18n:onboarding:merge` |
| **generate-onboarding-i18n.mjs** | API-Übersetzung oft fehlerhaft unter Windows/PowerShell — Merge-Skript + manuelle `locales/*.json` bevorzugen |
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
| Onboarding schwarzer Bildschirm | Kaputtes SVG-Mask oder Scrim über allem | Vier-Panel-Scrim in `SpotlightScrim`; Panel z-index 10050 |
| Tour-Karte nicht klickbar | Scrim oder falsche z-index | `#ob-callout` mit `pointer-events: auto`; siehe `onboardingLayers.ts` |
| Ring neben Feld / Button | `data-ob` auf großem Wrapper | `getOnboardingHighlightRect` nutzt Union der `input`/`button` |
| Stock-Tab im Tutorial tot | Klick-Blocker / Nav unter Scrim | `data-ob` auf `<NavLink>`; Nav z-index 10030 |
| Restart bleibt auf Profil | Keine Navigation | `OnboardingRestartButton` → `navigate('/')` |
| `<motion>` in TSX | Tippfehler beim Generieren | Immer `<div>` — Build mit `npx tsc -b` prüfen |

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

# Onboarding-Strings in alle Locale-JSONs mergen
npm run i18n:onboarding:merge

# Typecheck
npx tsc -b
```

---

*Zuletzt aktualisiert: 19. Mai 2026 (Onboarding-Überarbeitung: verankerte Prompts, z-index, Highlight auf Feldern)*
