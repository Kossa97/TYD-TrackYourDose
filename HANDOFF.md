# TYD — Track Your Dose · Handoff-Dokument
> Stand: Mai 2026 · Entwickelt mit Claude Code

---

## 0. Projektstatus

**Ziel:** Eine vollständige, mobile-first Peptid-Tracking-App — Inventar, Rekonstitution, Zyklen, Kalender, Dosierungsrechner, Tagebuch, Bewertungen, Profil, Injektionsstellen-Rotation — international in 14 Sprachen.

**Aktueller Stand:** App ist funktionsfähig, vollständig und deployed auf Vercel. PWA-fähig (installierbar auf iPhone & Android). 14 Sprachen. Homescreen mit Quick-Stats (Nächste Einnahme, Streak, Studie des Tages) + Kacheln. Geführtes **Onboarding** (24 Schritte): Sprach-Gate beim ersten Start, Spotlight-Ring auf Eingabefeldern, Feld-für-Feld-Cycling mit ✓-Button, Tour-Karte immer im Vordergrund (z-index 10050). Neues **Injektionsstellen-Modul** (/injektionen) mit SVG-Körperkarte und Rotationsprotokoll.

**Peptipedia** (evidenzbasierte Peptid-Datenbank) + **Studies** (PubMed-Forschungsmodul) komplett umgesetzt und auf Home-Screen integriert.

Neu in dieser Session (23. Mai 2026):
- **Protokoll-Redesign** (/protokoll): Biohacking-Dashboard mit KPI-Streifen (Adherence, Gewicht Δ, IGF-1 Δ, CRP Δ), 6 Preset-Chips, freie Marker-Toggles, Chart 1 (% Veränderung ab Start, alle Marker normalisiert auf einer Achse, Glow-Linien + Gradient-Fills + Zyklusphasen-Hintergründe + Bluttest-Ereignislinien + Hover-Tooltip), Chart 2 (Small Multiples — ein Mini-Chart je aktivem Marker mit echter Einheit + Normalbereich-Band, synchronisierter Hover), Gradient-Adherence-Balken je Peptid
- **Health-Seite** (/health): BMI, Körperfett-Schätzung (Deurenberg-Formel), Idealgewicht (Devine-Formel), Körperprofil aus Profil-Daten (Alter, Geschlecht, Größe)
- **Profil-Seite**: "Gesundheitsdaten"-Karte entfernt (Daten jetzt auf /health)
- **Blutwerte + Gewichtslogs geseedet**: `scripts/seed-health-data.mjs` — 3 Bluttests × 15 Marker (45 Einträge) + 26 Gewichts-Wochenmessungen (90.3 → 82.6 kg)
- **Test-Account vollständig geseedet**: `scripts/seed-test-data.mjs` — 6 Monate rückwirkend, 6 Peptide, 7 Zyklen, 533 Dose-Logs, Effekte, Bewertungen
- **Vercel-MIME-Fix**: vercel.json von `rewrites` auf `routes` mit `{ "handle": "filesystem" }` umgestellt (JS-Assets wurden als HTML ausgeliefert)

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
| Datums-Utils | date-fns (14 Locales) |
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
intake_time, intake_time_custom  ← komma-getrennte Slot-Keys: morgens,mittags,abends,custom
intake_time_custom               ← komma-getrennte HH:MM-Strings für custom-Slots
reminder                         ← Format: "on_time,2h" (komma-getrennt)
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

### `bloodwork`
```
id, user_id
test_date (date)
marker (text)       ← z.B. 'IGF-1', 'Testosteron', 'CRP', 'TSH', ...
value (numeric)
unit (text)
notes (text)
created_at
```

### `weight_logs`
```
id, user_id
logged_at (timestamptz)
weight_kg (numeric)
notes (text)
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
├── index.css                  ← Design-System (Tokens, Components, ob-*-Klassen)
│
├── i18n/
│   ├── index.ts               ← i18next-Konfiguration, LANGUAGES-Array, applyDirection()
│   ├── faq/                   ← FAQ-Bundles: getFaqBundle(lang) (alle 14 Sprachen)
│   │   ├── types.ts / index.ts
│   │   └── locales/           ← de.ts, en.ts, *.categories.ts …
│   ├── data/
│   │   └── onboarding-i18n.json
│   └── locales/
│       ├── de.json            ← Deutsch (Basis, ~200 Keys)
│       ├── en.json … ko.json  ← 13 weitere Sprachen
│
├── context/
│   ├── AuthContext.tsx
│   └── OnboardingContext.tsx  ← Keys: `_ob_done_${uid}`, `tyd_lang_picked_${uid}`
│
├── components/
│   ├── Layout.tsx             ← 5-Item Bottom-Nav + FAQ-Button + Onboarding-Overlay
│   ├── ProtectedRoute.tsx
│   ├── NewDot.tsx
│   ├── LanguageGate.tsx       ← Erststart-Sprachwahl (i18n.language.split('-')[0] für Erkennung)
│   ├── Onboarding.tsx         ← Scrim + Tour-Karte + ✓-Button + Feld-Cycling
│   ├── onboardingSteps.ts     ← 24 Schritte (Metadaten, Routen, Selektoren)
│   ├── onboardingTarget.ts    ← Rect-Messung, Modal-Erkennung
│   ├── onboardingPlacement.ts ← Karten-Position (Viewport, Tab-Bar, snap top/bottom)
│   └── onboardingLayers.ts   ← z-index-Stapel (Scrim 10000 … Panel 10050)
│
├── pages/
│   ├── Home.tsx               ← Begrüßung + Stats (Nächste Einnahme, Streak, Studie) + Kacheln
│   ├── Dashboard.tsx          ← Kalender + Tagesprotokoll (/kalender)
│   ├── Peptide.tsx            ← Lager-Tab + Meine Peptide-Tab (~1900 Zeilen)
│   ├── InjectionTracker.tsx   ← Injektionsstellen-Rotation (/injektionen)
│   ├── TheLab.tsx             ← Studies / PubMed-Forschungsmodul (/lab)
│   ├── StudyDetail.tsx        ← Studien-Detail-Seite (/lab/study/:id)
│   ├── PeptideLibrary.tsx     ← Peptipedia-Übersicht (/lab/library) ⚠️ noch nicht i18n
│   ├── PeptideDetailPage.tsx  ← Peptid-Profil (/lab/library/:slug) ⚠️ noch nicht i18n
│   ├── lab/
│   │   ├── PeptideCard.tsx    ← Karte für Peptipedia ⚠️ noch nicht i18n
│   │   ├── AdminPanel.tsx     ← AI-gestütztes Admin-Panel (/lab/admin)
│   │   ├── pubmed.ts          ← PubMed eutils API (esearch, esummary, efetch)
│   │   ├── LabHero.tsx        ← Hero-Section mit Search
│   │   ├── ResearchSnapshot.tsx ← 3 Snapshot-Karten
│   │   ├── StudyCard.tsx      ← Studie-Kachel im Feed
│   │   ├── StudySidebar.tsx   ← Desktop-Sidebar mit Filtern
│   │   ├── StudyFeed.tsx      ← Study-Feed + Sidebar-Layout
│   │   └── FilterSheet.tsx    ← Mobile Bottom-Sheet Filter
│   ├── Rechner.tsx
│   ├── Tagebuch.tsx
│   ├── Bewertungen.tsx
│   ├── Protokoll.tsx          ← Biohacking-Dashboard (KPI-Strip, Preset-Chips, 2 Charts, Adherence)
│   ├── Health.tsx             ← Körperprofil (BMI, Körperfett, Idealgewicht) + Gewicht-Sparkline
│   ├── Blutwerte.tsx          ← Bluttest-Verlauf + Marker-Tabelle (/blutwerte)
│   ├── Profil.tsx
│   ├── FAQ.tsx
│   ├── PublicProfile.tsx
│   └── Auth.tsx
│
├── lib/
│   ├── supabase.ts
│   ├── peptideColors.ts       ← 12 Farben + getPeptideColor(index)
│   └── useNew.ts
│
├── services/
│   └── peptideLibrary.ts      ← Typen (PeptideEntry etc.), Supabase-Queries, Display-Helpers
│                              ← ⚠️ CATEGORY_LABELS, STATUS_LABELS, EVIDENCE_LABELS, getConfidenceLabel
│                              ←    sind noch hardcoded Deutsch — für i18n durch t()-Calls ersetzen
│
└── components/
    └── LabLoader.tsx          ← Full-Screen Ladeanimation (spinning FlaskConical)

scripts/
├── seed-test-data.mjs         ← Test-Account seeden (6 Monate, alle Features)
├── seed-health-data.mjs       ← Blutwerte + Gewichtslogs seeden
├── update-ob-texts.cjs        ← Onboarding-Texte in alle 14 Locales schreiben
├── update-escalation-steps.cjs ← Dosiserhöhungs-Steps (16-18) initial hinzugefügt
├── fix-subtitle-numbers.cjs   ← Schritt-Nummern in Subtiteln korrigieren
├── merge-onboarding-i18n.mjs  ← Legacy-Merge-Skript
└── generate-faq-locales.mjs
```

---

## 4. Navigation & Routing

### Bottom-Nav (5 Items)
```
Lager    → /peptide?tab=inventar
Peptide  → /peptide
🏠 Home  → /   (Mitte, Cyan-hervorgehoben)
Kalender → /kalender
Profil   → /profil
```
FAQ erreichbar über schwebendes `?`-Icon (unten rechts über der Nav).

### Alle Routen
```
/                    ← Homescreen
/kalender            ← Kalender + Tagesprotokoll
/peptide             ← Lager + Meine Peptide (?tab=inventar)
/rechner             ← Dosierungsrechner
/tagebuch            ← Wirkungen & Nebenwirkungen
/bewertungen         ← Sterne-Bewertungen
/profil              ← Nutzer-Einstellungen + Sprache
/faq                 ← Hilfe
/injektionen         ← Injektionsstellen-Rotation
/lab                 ← Studies (PubMed-Forschung) ← NEU
/lab/study/:id       ← Studien-Detail-Seite ← NEU
/lab/library         ← Peptipedia (Peptid-Datenbank) ← NEU
/lab/library/:slug   ← Peptid-Detail-Profil ← NEU
/lab/admin           ← Admin-Panel (AI-gestützt, nur eingeloggte User) ← NEU
/protokoll           ← Biohacking-Dashboard (Zyklusauswertung)
/health              ← Körperprofil (BMI, Körperfett, Idealgewicht)
/blutwerte           ← Bluttest-Verlauf
/auth                ← Login (außerhalb Layout)
/u/:username         ← Öffentliches Profil (außerhalb Layout)
```

---

## 5. Internationalisierung (i18n)

### 14 Sprachen
🇩🇪 Deutsch · 🇬🇧 English · 🇪🇸 Español · 🇫🇷 Français · 🇮🇹 Italiano · 🇧🇷 Português · 🇷🇺 Русский · 🇹🇷 Türkçe · 🇸🇦 العربية · 🇮🇳 हिन्दी · 🇮🇩 Bahasa Indonesia · 🇨🇳 中文 · 🇯🇵 日本語 · 🇰🇷 한국어

### Sprache wechseln
- **LanguageGate** beim ersten Start (User-spezifisch: `tyd_lang_picked_${uid}`)
- **Profil → Sprache** jederzeit änderbar
- `localStorage('tyd_lang')` speichert die Wahl, i18n liest sie beim Start
- `i18n.language.split('-')[0]` — regionaler Code (z.B. `de-DE`) wird korrekt auf `de` gemappt
- Arabisch aktiviert RTL (`dir="rtl"`)

### Keys hinzufügen
```ts
// 1. Key in src/i18n/locales/de.json + en.json eintragen
// 2. Für alle 14 Sprachen via Node-Skript in scripts/ schreiben
// 3. In Komponente:
const { t } = useTranslation()
{t('mein_key')}
```

**KRITISCH:** Locale-JSON-Dateien nur per `node` schreiben — PowerShell `ConvertTo-Json` escaped keine Zeilenumbrüche in Strings und erzeugt kaputtes JSON.

---

## 6. Kernfunktionen

### Homescreen — Quick-Stats (Home.tsx)
Drei Karten oben, live aus Supabase:

| Karte | Inhalt | Datenquelle |
|---|---|---|
| ⏱ Nächste Einnahme | Nächste geplante Uhrzeit (HH:MM) oder ✓ wenn erledigt | `cycles.intake_time` aktiver Zyklen |
| 🔥 Streak | Aufeinanderfolgende Tage mit mind. 1 `taken=true` Log | `dose_logs` |
| 📰 Studie des Tages | Täglich rotierend aus 14 Peptid-Forschungsschnipseln | Statisches Array in `Home.tsx`, `Math.floor(Date.now()/86400000) % 14` |

### Inventar-Workflow (kritische Logik)
```
1. Einlagern → inventory_items erstellt (vials_count & vials_initial gesetzt)
   → vials_initial wird NIEMALS danach überschrieben

2. "Peptid anlegen" → peptides-Eintrag mit inventory_item_id
   → KEIN Abzug von vials_count bei Anlage

3. Vials-Abzug NUR bei:
   a) "Peptid verwerfen"           → vials_count - 1
   b) "Rekonstitution wiederholen" → vials_count - 1

4. Nach savePeptide/saveCycle: setExpandedId(savedId) → Peptid-Karte klappt auf
```

### Frequenzen & Einnahmezeiten (cycles)
```
BASE_FREQUENCIES: Täglich | Jeden 2. Tag | 5 Tage an / 2 aus | Mo-Fr |
                  Wöchentlich | Alle X Tage | Wochentage wählen

INTAKE_TIME_CONFIG:
  morgens → 08:00
  mittags → 12:00
  abends  → 20:00
  custom  → HH:MM aus intake_time_custom

daily_freq: '1' | '2' | '3'  ← Wie oft täglich (Buttons im Formular)
```

### Injektionsstellen (/injektionen) — NEU
- **12 Zonen**: Deltoid L/R, Bauch L/R, Oberschenkel L/R (front) + Gesäß L/R, Oberschenkel hinten L/R, Deltoid hinten L/R (back)
- **SVG-Körperkarte** bei 1.65× Skalierung via `<g transform="scale(1.65,1.65)">` — `shapeRendering="geometricPrecision"`
- **Farbcodierung** nach Tagen seit letzter Injektion: grün (5+T) → gelb (2–3T) → orange (gestern) → rot (heute)
- **Empfehlung** — Zone mit längster Pause, ⭐-Markierung + Puls-Ring
- **✓ Markieren** — Tap auf Zone oder ✓-Button in Liste → setzt `days[key] = 0`
- **Undo-Toast** — erscheint 6 Sekunden, Rückgängig stellt exakten Vorwert wieder her
- **Verlauf** — letzte 5 Aktionen mit Rückgängig-Button
- **Aktuell:** Mock-Daten (`INITIAL_DAYS`). Für Produktion: Supabase-Tabelle `injection_sites` anlegen

---

## 7. Onboarding (24 Schritte)

### Ablauf beim ersten Start
1. `LanguageGate` — Sprache wählen → `tyd_lang_picked_${uid}` + `tyd_lang` gesetzt
2. Willkommen (Schritt 0, zentriert) → Route `/`
3. Tour Schritte 1–22 → Finish (Schritt 23)

### Schritte (`onboardingSteps.ts`)

| # | ID | Fokus | Advance |
|---|---|---|---|
| 0 | welcome | — | next |
| 1 | inv-nav | Bottom-Nav Lager | click |
| 2 | add-stock | + Einlagern | click (auto-advance bei Modal) |
| 3 | inv-name | Peptidname-Feld | next + ✓ |
| 4 | inv-amounts | Vials + mg | next + ✓ |
| 5 | inv-batch | Batch + Quelle | next + ✓ |
| 6 | inv-save | Einlagern-Button | click |
| 7 | create-peptide | Peptid anlegen | click |
| 8 | pep-liquid | Zugefügte Flüssigkeit | next + ✓ |
| 9 | pep-expiry | Datum + Haltbarkeit | next + ✓ (2 Felder) |
| 10 | pep-dose | Dosis + Einheit + Methode | next + ✓ |
| 11 | pep-save | Peptid speichern | click |
| 12 | pep-tab | Tab Meine Peptide | click |
| 13 | add-cycle | + Zyklus hinzufügen | click |
| 14 | cycle-plan | Zyklus-Formular (alle Felder) | next + ✓ |
| 15 | cycle-save | Zyklus speichern | click |
| 16 | esc-open | + Dosiserhöhung hinzufügen | click |
| 17 | esc-form | Dosiserhöhungs-Formular | next + ✓ |
| 18 | esc-save | Erhöhung speichern | click |
| 19 | calendar-nav | Kalender-Nav | click |
| 20 | calendar-use | Monatsansicht | next |
| 21 | home-nav | Home-Button | click |
| 22 | home-features | Kacheln-Übersicht | next |
| 23 | finish | — | next |

### Feld-Cycling & ✓-Button
- `getCycleFields(el)` sammelt sichtbare `input`/`select` **und** `[data-ob-self]`-Container in DOM-Reihenfolge
- `data-ob-self` = ganzer Block als eine Einheit (z.B. Haltbarkeit-Buttons, Wochentage, Einnahmezeitpunkt, Erinnerung)
- `isModalTarget = showSpotlight && modalOpen` → Karte snapped via `snap='top'|'bottom'` weg vom aktiven Feld
- `confirmBtn` (Portal, runder ✓-Button rechts im Feld): erscheint bei `isModalTarget && advance==='next'`
- Datum-Inputs: Button um 32px nach links verschoben (freie Kalender-Icon-Zone)
- `ob_confirm_hint`-Banner in der Karte wenn Feld-Cycling aktiv

### Klick-Handler (Event-Delegation)
```typescript
// Alle advance:'click' Steps nutzen document-Level Delegation
// → Handler funktioniert auch wenn Element erst nach dem Effect im DOM erscheint
document.addEventListener('click', delegated, true)
```

### data-ob Attribute (Übersicht)
```
Layout:    nav-lager, nav-kalender, nav-home
Inventar:  btn-einlagern, inv-name, inv-amounts, inv-batch, btn-inv-save
Peptid:    btn-peptid-anlegen, pep-liquid, pep-expiry (+ data-ob-self Haltbarkeit),
           pep-dose, btn-pep-save, tab-peptide
Zyklus:    btn-zyklus-add, cycle-core (umschließt ALLE Felder), btn-cycle-save
Eskalation:btn-esc-add, esc-core, btn-esc-save
Kalender:  calendar-main
Home:      home-tiles
```

### z-Index-Stapel (onboardingLayers.ts)
```
Scrim:     10000
Nav:       10030
Modal:     10040
Ring:      10045  ← außerhalb #ob-scrim-root (eigener Stacking Context)
Panel:     10050
```

### Onboarding zurücksetzen (Browser-Konsole)
```js
localStorage.removeItem('_ob_done_' + userId)
localStorage.removeItem('tyd_lang_picked_' + userId)
location.reload()
```

---

## 8. Design-System

### Farben
- `slate-900` → `#07091a` · `slate-800` → `#0e1428`
- `sky-400` → `#00ccf5` (Neon-Cyan) · `sky-500` → `#00aad4`

### CSS-Architektur (index.css)
```
:root          → Design-Tokens
@layer base    → html/body overflow-x:hidden, overscroll-behavior-x:none
@layer components → .card, .btn-primary/secondary/danger, .input, .select, .label
@layer utilities → .glass, .glow-cyan-sm/md, .text-gradient-cyan
Onboarding-CSS → #ob-callout, .ob-highlight-ring, .ob-scrim-pane,
                 .ob-tap-cue, .ob-confirm-cue, .ob-callout-actions,
                 @keyframes ob-ring-pulse, ob-step-enter
```

### Wichtige CSS-Regeln
- **KEIN** `backdrop-filter` auf scrollbaren Containern (bricht overflow-y)
- `html, body, #root` haben `overflow-x: hidden` — kein horizontales Scrollen
- `min-h-dvh` statt `min-h-screen` (mobile Browser)
- iOS Safe-Area: `padding-bottom: env(safe-area-inset-bottom)` in Nav + Main

---

## 9. Bekannte Limitierungen

| Thema | Detail |
|---|---|
| **Injektionsstellen DB** | Aktuell Mock-Daten — Supabase-Tabelle `injection_sites` noch nicht erstellt |
| **Push-Notifications** | Nur `setTimeout` (App muss offen sein) |
| **FAQ aktualisieren** | `en.categories.ts` → `npm run faq:export` → `npm run faq:generate` |
| **Onboarding-Texte** | Via `scripts/update-ob-texts.cjs` oder direkt in `locales/*.json` |
| **IU-Einheit** | IU = mcg (keine Umrechnung) |
| **Offline** | Keine PWA-Offline-Unterstützung |
| **Registrierung** | Offen für alle (in Supabase einschränkbar) |
| **useEffect-Deps** | Lint-Warnungen in mehreren Dateien, kein Crash |
| **⚠️ Peptipedia nicht i18n-fertig** | `PeptideLibrary.tsx`, `PeptideCard.tsx`, `PeptideDetailPage.tsx` und `peptideLibrary.ts` (CATEGORY_LABELS, STATUS_LABELS, EVIDENCE_LABELS, getConfidenceLabel) haben noch hardcoded deutsche Strings — Seite bleibt auf Deutsch bei anderen Sprachen. Nächste Aufgabe: alle durch `t()`-Calls ersetzen + Keys in alle 14 Locales eintragen |
| **⚠️ Protokoll-Redesign nicht genehmigt** | Der neue Protokoll-Stand (Biohacking-Dashboard mit 2 Charts, KPI-Strip etc.) wurde technisch umgesetzt und deployed, aber dem User hat das Ergebnis nicht gefallen. Ggf. überarbeiten oder zurückrollen. |
| **Injektionsstellen DB** | Aktuell Mock-Daten — Supabase-Tabelle `injection_sites` noch nicht erstellt |

---

## 10. Peptipedia & Studies — Details

### Neue DB-Tabelle: `peptide_library`
Angelegt via SQL-Skripte (im Supabase SQL Editor ausführen):
- `supabase-peptide-library.sql` — Tabelle + 11 Peptide
- `supabase-peptide-library-v2.sql` — evidence_human/animal/clinical + evidence_score + research_gaps
- `supabase-peptide-library-v3.sql` — tags[] Column
- `supabase-admin-policies.sql` — RLS INSERT/UPDATE für eingeloggte User

```
peptide_library-Felder:
  id, slug, name, full_name, category, tldr, mechanism
  benefits (text[]), research_dosage, half_life, administration (text[])
  research_status ('preclinical'|'phase_1'|'phase_2'|'approved')
  side_effects (text[]), contraindications (text[])
  pubmed_query, tags (text[])
  evidence_human, evidence_animal ('none'|'limited'|'sparse'|'moderate'|'strong'|'extensive')
  evidence_clinical ('none'|'sparse'|'limited'|'moderate'|'extensive')
  evidence_score (int, 1–10)
  research_gaps (text[])
  sort_order (int)
```

**RLS:** Alle User lesen, eingeloggte User schreiben (für Admin-Panel).

### Admin-Panel (/lab/admin)
- Vercel Serverless Function: `api/peptide-ai.js` (plain JS, ES module)
- Anthropic API Key als `VITE_ANTHROPIC_KEY` in Vercel Environment Variables
- Modell: `claude-haiku-4-5` (stand 2026 — frühere Claude-3-Modelle deprecated)
- Action `create`: Tippfehler korrigieren, vollständiges Profil generieren + tags
- Action `update`: bestehendes Profil verbessern + tags aktualisieren
- Name + Slug editierbar vor dem Speichern
- `package.json` hat `"type": "module"` → API-Funktionen müssen `export default` nutzen (KEIN `module.exports`)
- `"engines": { "node": "20.x" }` in package.json → globales `fetch` in Vercel verfügbar

### Studies (/lab) — PubMed-Integration
- `src/pages/lab/pubmed.ts` — eutils API (esearch, esummary, efetch), 429-Retry-Logik
- Vite Dev Proxy: `/ncbi` → `eutils.ncbi.nlm.nih.gov` (CORS-Workaround lokal)
- In Production: direkter Aufruf (kein Proxy)
- `LabLoader.tsx` — Full-Screen-Ladeanimation beim ersten Laden (faded sich aus)
- `src/pages/lab/` enthält: LabHero, ResearchSnapshot, StudyCard, StudySidebar, StudyFeed, StudyDetail, FilterSheet, PeptideCard, AdminPanel
- `src/services/peptideLibrary.ts` — Typen, Supabase-Queries, Display-Helpers

### Naming-Konventionen
- **"Studies"** = PubMed-Recherche-Modul (`tile_lab` in i18n → "Studies")
- **"Peptipedia"** = Evidenz-Datenbank (`tile_bibliothek` in i18n → "Peptipedia")

---

## 11. Häufige Fehler & Fixes

| Fehler | Ursache | Fix |
|---|---|---|
| Modal-Scrollen kaputt | `backdrop-filter` auf `.rounded-t-2xl` | Nicht hinzufügen |
| JSON-Fehler nach PowerShell | `ConvertTo-Json` escaped keine `\n` | Immer Node.js für JSON-Writes |
| Sprache zeigt Keys | i18n resources nicht in `{ translation: {} }` | `resources: { de: { translation: de } }` |
| LanguageGate zeigt 'en' auf DE-Gerät | `i18n.language` = `'de-DE'` → kein Match | `split('-')[0]` bereits implementiert |
| Ring unsichtbar | Ring in `#ob-scrim-root` (z-index gebunden) | Ring als SVG-Geschwister außerhalb des Scrim-Root rendern |
| ✓-Button blockiert | Click-Blocker fing `data-ob-confirm` ab | `node.closest('[data-ob-confirm]')` Exception |
| btn-zyklus-add nicht gefunden | Peptid nicht aufgeklappt | `setExpandedId(savedId)` nach `savePeptide` + `saveCycle` |
| Klick-Step geht nicht weiter | Handler zu früh attached (Element noch nicht im DOM) | Event-Delegation auf `document` statt direktes `addEventListener` |
| Karte überdeckt Eingabefeld | Immer `snap='top'` bei modalen Schritten | Jetzt dynamisch: `fieldTop < cardBottomWhenAtTop ? 'bottom' : 'top'` |
| Karte bleibt bei Resize | `targetRect=null` → kein State-Change → kein Recompute | `viewportKey` State, inkrementiert bei `resize` |
| Vercel schwarzer Screen / MIME-Fehler | `rewrites: [{ source: "/(.*)", destination: "/index.html" }]` fängt JS-Assets ab → Browser bekommt HTML statt JS | `routes` mit `{ "handle": "filesystem" }` zuerst, dann SPA-Fallback. Außerdem alten Service Worker in DevTools deregistrieren (cached bad response) |
| Push rejected | Remote hat neuere Commits | `git pull --rebase origin main` |
| App startet nicht (Windows) | PowerShell Execution Policy | `Set-ExecutionPolicy Bypass -Scope Process` |

---

## 12. Entwicklungs-Workflow

```bash
# Lokal starten
cd C:\Users\Devin\peptid-tracker
npm run dev          # http://localhost:5173

# Deployen
git add .
git commit -m "Beschreibung"
git push             # → Vercel deployed automatisch

# Locale-Keys in alle 14 Sprachen schreiben (Node-Skript)
node scripts/update-ob-texts.cjs

# Typecheck
npx tsc -b

# Onboarding zurücksetzen (Konsole)
localStorage.removeItem('_ob_done_' + userId)
localStorage.removeItem('tyd_lang_picked_' + userId)
location.reload()
```

---

*Zuletzt aktualisiert: 23. Mai 2026 — Protokoll-Redesign (Biohacking-Dashboard, 2 Charts, KPI-Strip, Preset-Chips), Health-Seite (BMI, Körperfett, Idealgewicht), Profil-Bereinigung (Gesundheitsdaten ausgelagert), Test-Account vollständig geseedet (6 Monate), Vercel-MIME-Fix (vercel.json routes), bloodwork + weight_logs Tabellen. Offene Tickets: Peptipedia nicht i18n-fertig; Protokoll-Redesign dem User nicht gefallen → ggf. überarbeiten.*
