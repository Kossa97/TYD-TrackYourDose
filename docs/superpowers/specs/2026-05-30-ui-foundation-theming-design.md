# UI-Fundament: Theming, Motion & Icons (Phase 1)

**Datum:** 2026-05-30
**Status:** Genehmigt (Brainstorming)
**Phase:** 1 von N — Fundament + geteilte Ebene + Home-Pilot

## Kontext

Der Peptid-Tracker ist eine große React-19 + TypeScript + Vite + Tailwind-3 App
(~20 Seiten, mehrere >1.000 Zeilen, >15.000 Zeilen UI-Code). Sie besitzt bereits
eine kohärente Identität: dunkles Neon-Cyan-Glassmorphism, `lucide-react`-Icons,
Design-Tokens in `src/index.css` (`:root`) und geteilte Primitive in
`src/components/ui/DesignSystem.tsx`.

Der Gesamtauftrag (komplette UI/UX-Überarbeitung, Light Mode, moderne Animationen,
Bug-Fixes, FPS-Optimierung, einheitliche Icons) ist zu groß für ein einzelnes Spec
und wird in Phasen zerlegt. Dieses Dokument spezifiziert **Phase 1**.

**Gewählte Grundrichtung:** "A · Refined Current" — die bestehende
Neon-Cyan-Glas-Identität beibehalten, sauberer/konsistenter machen und um einen
echten Light Mode erweitern. Geringstes Regressionsrisiko, vertraute Optik.

### Kern-Blocker, den Phase 1 löst

Farben sind als feste `rgba()`/Hex-Werte in tausenden Inline-Styles und in
`index.css` hartkodiert. Ein funktionierender Light Mode ist erst möglich, wenn
diese Farben in **semantische CSS-Variablen** überführt werden. Diese Token-Ebene
ist die Voraussetzung für alles Weitere und wird hier geschaffen.

## Getroffene Entscheidungen

| Thema | Entscheidung |
|---|---|
| Visuelle Richtung | A · Refined Current (Neon-Cyan-Glas beibehalten + polieren + Light Mode) |
| Standard-Theme | System folgen (`prefers-color-scheme`), Fallback **Dark**; manuelle Wahl persistiert |
| Theme-Umschalter | Im Profil/Einstellungen |
| Motion-Level | Snappy & Pro (schnell, dezent, 60fps), `prefers-reduced-motion` respektiert |
| Icons | Alle UI-Emojis → einheitliche Lucide-Icons; Fließtexte (Onboarding/FAQ) unangetastet |

## Umfang von Phase 1

**Enthalten:**
1. Semantische Token-Architektur (Dark + Light) in `index.css`.
2. Theme-Umschaltmechanik: `data-theme` auf `<html>`, Pre-Paint-Init-Script,
   System-Erkennung, Persistenz, Umschalter im Profil.
3. Migration der **geteilten Ebene** auf Tokens:
   - `src/index.css` (Komponenten-Klassen, Overrides, Base).
   - `src/components/ui/DesignSystem.tsx` (alle Primitive).
   - `src/components/Layout.tsx` (Bottom-Nav, Push/iOS-Banner, Quick-Action-Sheet,
     FAQ-Float, `RouteFallback`-Bereich).
4. Zentrales Motion-System (Timing-Tokens + Utility-Klassen + reduce-motion-Block).
5. Icon-Konvention + Ersatz aller UI-Emojis in der geteilten Ebene **und** im Pilot.
6. **Pilot:** `src/pages/Home.tsx` vollständig auf Tokens migriert, poliert,
   in Dark **und** Light verifiziert.

**Nicht enthalten (Folge-Phasen, je eigenes Spec):** Migration & Politur der
übrigen ~19 Seiten, seitenweise Bug-Fixes und Detail-Optimierung. Jede Seite:
Token-Migration → Politur → Bug-Fixes → Verifikation in beiden Themes.

## Architektur

### 4.1 Token-Ebene (`src/index.css`)

Semantische Variablen ersetzen Rohfarben. `:root` hält die Dark-Werte (entspricht
den heutigen Werten), `[data-theme="light"]` überschreibt für Light.

**Token-Gruppen (Namen indikativ, beim Umsetzen final festzurren):**

- Flächen: `--app-bg`, `--surface`, `--surface-raised`, `--surface-input`,
  `--glass-bg`.
- Text: `--text`, `--text-dim`, `--text-muted`.
- Linien: `--border`, `--border-strong`.
- Akzent (Marke): `--accent` (Cyan), `--accent-weak`, `--accent-border`,
  `--accent-contrast` (Textfarbe auf Akzent-Buttons — dunkel im Dark, weiß im Light).
- Kategorie-Akzente: `--cat-violet`, `--cat-emerald`, `--cat-amber`, `--cat-rose`
  (jeweils mit hellen Varianten für Light).
- Effekte: `--shadow-card`, `--shadow-btn-primary`, `--shadow-input`,
  `--glow-accent` (im Light deutlich reduziert/neutralisiert).

**Light-Mode-Prinzipien:** Glow/Neon stark zurücknehmen (sonst auf Weiß grell),
Glas → leicht getöntes Weiß mit feinen grauen Linien, Akzent etwas dunkleres Cyan
(`#0091c4`-Bereich) für AA-Kontrast auf Weiß, Schatten weicher und bläulich-neutral.

Bestehende `!important`-Overrides für Tailwind-Slate-Klassen (Zeilen ~815–988 in
`index.css`) werden auf Tokens umgestellt, damit sie in beiden Themes korrekt sind.

### 4.2 Theme-Umschaltung

- **Init vor Paint:** Inline-Script in `index.html` liest `localStorage`-Wert; falls
  keiner, `window.matchMedia('(prefers-color-scheme: light)')` → sonst Dark. Setzt
  `document.documentElement.dataset.theme`. Verhindert Theme-Flash.
- **Laufzeit:** Kleines Theme-Modul (z. B. `src/lib/theme.ts`) mit
  `getTheme()`, `setTheme('light'|'dark'|'system')`, und einem React-Hook
  `useTheme()` für den Umschalter. Bei "system" wird `matchMedia`-Änderung gehört.
- **UI:** Segment-Umschalter (System / Hell / Dunkel) in `Profil.tsx` bei den
  App-Einstellungen. `color-scheme` (für native Date/Time-Inputs) folgt dem Theme.

### 4.3 Motion-System (`index.css`)

- Timing-Tokens: `--t-fast: 140ms`, `--t-std: 200ms`, `--t-slow: 320ms` mit
  Standard-Easing `cubic-bezier(0.4,0,0.2,1)` (bestehende Werte werden vereinheitlicht).
- Utility-Klassen: gestaffeltes Listen-Einblenden (`.stagger-in` + index-Delay),
  Press-Feedback (`active:scale`), Skeleton-Shimmer (bestehendes `shimmer`-Keyframe
  weiterverwenden), Sheet-Slide (bestehendes `tydSlideUp` zentralisieren).
- Nur `transform`/`opacity` animieren (GPU, 60fps).
- Globaler Block: `@media (prefers-reduced-motion: reduce)` setzt
  `animation`/`transition` auf nahezu 0 und deaktiviert dekorative Keyframes.

### 4.4 Icon-Vereinheitlichung

- Audit der Emoji-Glyphen in UI-Code (nicht in i18n-/FAQ-Fließtexten). Ersatz durch
  semantisch passende Lucide-Icons in einheitlicher Größe/Strichstärke, Farbe via
  `--accent`/Kategorie-Token.
- Kurze Konvention im Spec-Folgedokument/Code-Kommentar: Standardgrößen
  (16/18/20/24), Farbe über Tokens, keine rohen Emojis in der UI.
- Geltungsbereich Phase 1: geteilte Ebene + Home. Übrige Seiten in Folge-Phasen.

### 4.5 Pilot: Home

`src/pages/Home.tsx` (869 Zeilen) wird vollständig:
- auf Tokens migriert (keine hartkodierten Farben mehr),
- mit dem Motion-System poliert (Einblenden, Press-States),
- von UI-Emojis befreit (→ Lucide),
- in Dark **und** Light geprüft.

Dient als Referenz-Implementierung und Vorlage für die Folge-Phasen.

## Migrationsstrategie (mechanisch)

Inline-Styles dürfen `var(--token)` referenzieren (z. B.
`style={{ color: 'var(--text)' }}`). Migration je Datei:
1. Hartkodierte Farb-Strings identifizieren.
2. Auf das passende semantische Token mappen (Mapping-Tabelle beim Umsetzen anlegen,
   um Konsistenz zu sichern).
3. Ersetzen; Datei in beiden Themes sichten.

## Verifikation (Erfolgskriterien)

- `npm run build` und `npm run lint` laufen grün.
- Home rendert korrekt in **Dark** und **Light** (visuelle Sichtung).
- Umschalter funktioniert; System-Erkennung greift beim Erststart; manuelle Wahl
  überlebt Reload (Persistenz).
- **Kein** Theme-Flash beim Laden.
- `prefers-reduced-motion: reduce` deaktiviert dekorative Bewegung.
- Geteilte Ebene (Nav, Banner, Quick-Actions, FAQ-Float) in beiden Themes korrekt.
- Keine UI-Emojis mehr in geteilter Ebene und Home.

## Risiken & Annahmen

- **Annahme:** Inline-`var(--token)`-Referenzen sind in der gesamten Codebasis
  zulässig (Standard-CSS-Verhalten) — bestätigt.
- **Risiko:** Vollständigkeit der Token-Migration in der geteilten Ebene. Gegenmaßnahme:
  nach Migration gezielt nach übrig gebliebenen hartkodierten Farben grep-en.
- **Risiko:** Light-Mode-Kontrast (AA). Gegenmaßnahme: Akzent/Text-Werte gegen Weiß
  prüfen, ggf. dunkleres Cyan.
- **Out of scope:** Funktionale Bug-Fixes außerhalb der geteilten Ebene + Home
  (kommen seitenweise in Folge-Phasen).
