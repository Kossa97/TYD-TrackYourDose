# UI-Fundament: Theming, Motion & Icons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine semantische Theme-Token-Ebene (Dark + Light) mit System-Erkennung, Umschalter, Motion-System und vereinheitlichten Lucide-Icons einführen — angewendet auf die geteilte Ebene (index.css, DesignSystem, Layout) und die Home-Seite als Pilot.

**Architecture:** CSS-Variablen in `:root` (Dark) + `[data-theme="light"]`-Override. `data-theme` wird per Pre-Paint-Inline-Script in `index.html` gesetzt (System → Fallback Dark, persistierte manuelle Wahl). Inline-Styles und CSS-Klassen referenzieren `var(--token)`. Migration ist mechanisch (hartkodierte Farbe → Token via Mapping-Tabelle).

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind 3, lucide-react. Verifikation: `npm run build`, `npm run lint`, gezielte `grep`-Checks, visuelle Sichtung in beiden Themes.

**Hinweis zum Test-Ansatz:** Dies ist CSS/UI-Arbeit ohne sinnvolle Unit-Tests. Statt TDD-Tests dienen als Verifikation: erfolgreicher Build, grünes Lint, `grep`-Vollständigkeits-Checks (keine hartkodierten Farben mehr in migrierten Dateien) und explizite visuelle Sichtungs-Schritte in Dark **und** Light.

---

## Kanonisches Token-Set (Referenz für alle Tasks)

Diese Namen/Werte sind verbindlich. Spätere Tasks mappen hartkodierte Farben auf diese Tokens.

| Token | Dark (`:root`) | Light (`[data-theme="light"]`) |
|---|---|---|
| `--app-bg` | `#020308` | `#f4f7fb` |
| `--surface` | `rgba(6,7,20,0.92)` | `#ffffff` |
| `--surface-raised` | `rgba(18,22,48,0.92)` | `#ffffff` |
| `--surface-input` | `rgba(2,3,12,0.82)` | `#ffffff` |
| `--glass-bg` | `rgba(6,7,20,0.78)` | `rgba(255,255,255,0.80)` |
| `--text` | `#eaeefc` | `#0c1626` |
| `--text-dim` | `#9aaabf` | `#556070` |
| `--text-muted` | `#465265` | `#9aa3b0` |
| `--border` | `rgba(255,255,255,0.07)` | `rgba(15,30,60,0.10)` |
| `--border-strong` | `rgba(255,255,255,0.12)` | `rgba(15,30,60,0.18)` |
| `--accent` | `#00ccf5` | `#0091c4` |
| `--accent-weak` | `rgba(0,204,245,0.10)` | `rgba(0,145,196,0.10)` |
| `--accent-border` | `rgba(0,204,245,0.28)` | `rgba(0,145,196,0.30)` |
| `--accent-contrast` | `rgba(0,8,20,0.95)` | `#ffffff` |
| `--cat-violet` | `#8b5cf6` | `#7c4dff` |
| `--cat-emerald` | `#10b981` | `#059669` |
| `--cat-amber` | `#f59e0b` | `#d97706` |
| `--cat-rose` | `#f43f5e` | `#e11d48` |
| `--shadow-card` | `0 8px 40px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.05), inset 0 -1px 0 rgba(0,0,0,0.3)` | `0 6px 20px rgba(20,40,80,0.10)` |
| `--glow-accent` | `0 0 28px rgba(0,204,245,0.24)` | `none` |

**Bestehende `--c-*`-Tokens bleiben als Aliase** auf die neuen Namen (z. B. `--c-text: var(--text);`), damit noch nicht migrierte Seiten weiterlaufen.

---

## Task 1: Semantische Dark-Tokens + `--c-*`-Aliase in index.css

**Files:**
- Modify: `src/index.css` (`:root`-Block, ~Zeile 429–472)

- [ ] **Step 1: Neue semantische Tokens in `:root` ergänzen**

Im bestehenden `:root`-Block (beginnt bei `--c-bg: #020308;`) die neuen Tokens **oberhalb** der `--c-*`-Zeilen einfügen:

```css
:root {
  /* ── Semantic theme tokens (dark defaults) ── */
  --app-bg:          #020308;
  --surface:         rgba(6,7,20,0.92);
  --surface-raised:  rgba(18,22,48,0.92);
  --surface-input:   rgba(2,3,12,0.82);
  --glass-bg:        rgba(6,7,20,0.78);
  --text:            #eaeefc;
  --text-dim:        #9aaabf;
  --text-muted:      #465265;
  --border:          rgba(255,255,255,0.07);
  --border-strong:   rgba(255,255,255,0.12);
  --accent:          #00ccf5;
  --accent-weak:     rgba(0,204,245,0.10);
  --accent-border:   rgba(0,204,245,0.28);
  --accent-contrast: rgba(0,8,20,0.95);
  --cat-violet:      #8b5cf6;
  --cat-emerald:     #10b981;
  --cat-amber:       #f59e0b;
  --cat-rose:        #f43f5e;
  --glow-accent:     0 0 28px rgba(0,204,245,0.24);
```

- [ ] **Step 2: Bestehende `--c-*`-Tokens zu Aliasen umschreiben**

Die vorhandenen Zeilen ersetzen, sodass sie auf die neuen Tokens zeigen (Werte bleiben dadurch identisch):

```css
  --c-bg:          var(--app-bg);
  --c-surface:     var(--surface);
  --c-input:       var(--surface-input);
  --c-cyan:        var(--accent);
  --c-cyan-10:     var(--accent-weak);
  --c-cyan-20:     rgba(0,204,245,0.20);
  --c-cyan-border: var(--accent-border);
  --c-border:      var(--border);
  --c-border-hi:   var(--border-strong);
  --c-text:        var(--text);
  --c-text-dim:    var(--text-dim);
  --c-text-muted:  var(--text-muted);
```

(Die `--r-*`, `--t-*`, `--shadow-*`, `--bottom-nav-*` Tokens bleiben unverändert.)

- [ ] **Step 3: Build prüfen**

Run: `npm run build`
Expected: Erfolgreicher Build, keine CSS-Fehler. Optik unverändert (nur Indirektion eingeführt).

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(theme): add semantic color tokens with --c-* aliases"
```

---

## Task 2: Light-Mode-Overrides in index.css

**Files:**
- Modify: `src/index.css` (direkt nach dem `:root`-Block einfügen)

- [ ] **Step 1: `[data-theme="light"]`-Block ergänzen**

Unmittelbar nach dem schließenden `}` des `:root`-Blocks einfügen:

```css
/* ── Light theme overrides ── */
[data-theme="light"] {
  --app-bg:          #f4f7fb;
  --surface:         #ffffff;
  --surface-raised:  #ffffff;
  --surface-input:   #ffffff;
  --glass-bg:        rgba(255,255,255,0.80);
  --text:            #0c1626;
  --text-dim:        #556070;
  --text-muted:      #9aa3b0;
  --border:          rgba(15,30,60,0.10);
  --border-strong:   rgba(15,30,60,0.18);
  --accent:          #0091c4;
  --accent-weak:     rgba(0,145,196,0.10);
  --accent-border:   rgba(0,145,196,0.30);
  --accent-contrast: #ffffff;
  --cat-violet:      #7c4dff;
  --cat-emerald:     #059669;
  --cat-amber:       #d97706;
  --cat-rose:        #e11d48;
  --glow-accent:     none;
  --c-cyan-20:       rgba(0,145,196,0.20);
  --shadow-card:     0 6px 20px rgba(20,40,80,0.10);
  --shadow-btn-primary: 0 2px 10px rgba(0,145,196,0.25), inset 0 1px 0 rgba(255,255,255,0.4);
  --shadow-input:    inset 0 1px 3px rgba(20,40,80,0.08);
}
```

- [ ] **Step 2: Body-Hintergrund-Gradienten für Light abschwächen**

Im `@layer base`-`body`-Block nutzt der Hintergrund dunkle radiale Gradienten. Direkt nach dem `body { ... }`-Block (im selben `@layer base`) ergänzen:

```css
  [data-theme="light"] body {
    background-image:
      radial-gradient(ellipse 90% 60% at 10% 35%, rgba(0,145,196,0.05) 0%, transparent 65%),
      radial-gradient(ellipse 70% 50% at 90% 10%, rgba(120,90,255,0.04) 0%, transparent 55%);
  }
```

- [ ] **Step 3: Manueller Theme-Test via DevTools**

Run: `npm run dev`
Im Browser DevTools-Konsole: `document.documentElement.setAttribute('data-theme','light')`.
Expected: Hintergrund wird hell, Text dunkel. (Komponenten-Klassen sind noch nicht migriert — vollständige Korrektheit folgt in Task 5–7. Hier nur: Tokens schalten um.)

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(theme): add light-mode token overrides"
```

---

## Task 3: Theme-Init-Script + Theme-Modul

**Files:**
- Modify: `index.html` (Inline-Script vor `#root`)
- Create: `src/lib/theme.ts`

- [ ] **Step 1: Pre-Paint-Init-Script in index.html**

In `index.html` im `<head>`, **vor** dem schließenden `</head>`, einfügen (vor Paint, verhindert Flash):

```html
    <script>
      (function () {
        try {
          var stored = localStorage.getItem('tyd_theme'); // 'light' | 'dark' | 'system' | null
          var mode = stored || 'system';
          var dark = mode === 'dark' ||
            (mode === 'system' && !window.matchMedia('(prefers-color-scheme: light)').matches);
          document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        } catch (e) {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      })();
    </script>
```

- [ ] **Step 2: Theme-Modul anlegen**

Create `src/lib/theme.ts`:

```ts
import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'tyd_theme'

function systemPrefersLight(): boolean {
  return window.matchMedia('(prefers-color-scheme: light)').matches
}

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return systemPrefersLight() ? 'light' : 'dark'
  return mode
}

export function getThemeMode(): ThemeMode {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

export function applyTheme(mode: ThemeMode) {
  const resolved = resolveTheme(mode)
  document.documentElement.setAttribute('data-theme', resolved)
}

export function setThemeMode(mode: ThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode)
  applyTheme(mode)
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getThemeMode)

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const update = (next: ThemeMode) => {
    setThemeMode(next)
    setMode(next)
  }

  return { mode, resolved: resolveTheme(mode), setMode: update }
}
```

- [ ] **Step 3: Build + Lint**

Run: `npm run build && npm run lint`
Expected: Beides grün, keine TS-Fehler in `theme.ts`.

- [ ] **Step 4: Commit**

```bash
git add index.html src/lib/theme.ts
git commit -m "feat(theme): add pre-paint init script and theme module"
```

---

## Task 4: Theme-Umschalter im Profil

**Files:**
- Modify: `src/pages/Profil.tsx` (Import + neue Komponente + Einbindung bei ~Zeile 299)

- [ ] **Step 1: ThemeSwitcher-Komponente anlegen**

In `src/pages/Profil.tsx` `useTheme` importieren (zu bestehendem React-Import passend) und Icons aus lucide ergänzen:

```ts
import { useTheme, type ThemeMode } from '../lib/theme'
import { Monitor, Sun, Moon } from 'lucide-react'
```

Neue Komponente (z. B. oberhalb von `function PushSettings()` bei ~Zeile 312) einfügen:

```tsx
function ThemeSwitcher() {
  const { t } = useTranslation()
  const { mode, setMode } = useTheme()
  const options: { value: ThemeMode; label: string; icon: typeof Monitor }[] = [
    { value: 'system', label: t('theme_system', { defaultValue: 'System' }), icon: Monitor },
    { value: 'light',  label: t('theme_light',  { defaultValue: 'Hell' }),   icon: Sun },
    { value: 'dark',   label: t('theme_dark',   { defaultValue: 'Dunkel' }), icon: Moon },
  ]
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <p className="label" style={{ marginBottom: 10 }}>
        {t('theme_label', { defaultValue: 'Erscheinungsbild' })}
      </p>
      <div className="rounded-xl p-1" style={{ display: 'flex', gap: 4 }}>
        {options.map(opt => {
          const active = mode === opt.value
          const Icon = opt.icon
          return (
            <button
              key={opt.value}
              onClick={() => setMode(opt.value)}
              className={active ? 'bg-sky-500' : ''}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 5, padding: '10px 6px', borderRadius: 9, cursor: 'pointer',
                color: active ? 'var(--accent-contrast)' : 'var(--text-dim)',
                fontSize: '0.72rem', fontWeight: 700,
              }}
            >
              <Icon size={18} />
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Einbinden nach LanguageSwitcher**

Bei ~Zeile 299, direkt nach `<LanguageSwitcher />`:

```tsx
      {/* ── Erscheinungsbild / Theme ── */}
      <ThemeSwitcher />
```

- [ ] **Step 3: Manueller Funktionstest**

Run: `npm run dev` → Profil öffnen.
Expected: Drei Optionen (System/Hell/Dunkel). Klick auf „Hell" schaltet sofort um; Reload behält die Wahl (localStorage `tyd_theme`); „System" folgt OS-Einstellung.

- [ ] **Step 4: Build + Lint + Commit**

Run: `npm run build && npm run lint` → grün.

```bash
git add src/pages/Profil.tsx
git commit -m "feat(theme): add appearance switcher in profile settings"
```

---

## Task 5: index.css-Komponenten & Overrides auf Tokens migrieren

**Files:**
- Modify: `src/index.css` (`@layer components` ~589–809; „TARGETED OVERRIDES" ~811–988; `@layer utilities` ~1041–1057)

Ziel: Die app-weiten Klassen (`.card`, `.btn-*`, `.input`, `.select`, `.label`, `.badge`, Tab-/Chip-/Modal-Overrides) nutzen Tokens, damit sie in beiden Themes korrekt sind.

- [ ] **Step 1: Hartkodierte Neutralfarben in `@layer components` durch Tokens ersetzen**

Mapping (gilt für den gesamten Block; Akzent-Cyan-Werte → Token, Neutral → Token):

| Hartkodiert | Token |
|---|---|
| `#eaeefc`, `#d8e0f0`, `#f0f6ff` (Textfarben) | `var(--text)` |
| `#9aaabf` | `var(--text-dim)` |
| `rgba(0, 8, 20, 0.95)` (Text auf Primary-Button) | `var(--accent-contrast)` |
| `rgba(255,255,255,0.07)` / `0.09` (Borders) | `var(--border)` |
| `rgba(255,255,255,0.12)`/`0.16` (Hover-Border) | `var(--border-strong)` |
| Primary-Gradient `rgba(0,220,255,..)→rgba(0,100,210,..)` | `linear-gradient(150deg, var(--accent), color-mix(in srgb, var(--accent) 80%, #003a6e))` |
| `.input`/`.select` `background: var(--c-input)` | `var(--surface-input)` |

Konkret die `.btn-primary`-Textfarbe `color: rgba(0, 8, 20, 0.95);` → `color: var(--accent-contrast);` und Hover-`color`-Zeilen ebenso. `.btn-secondary`-`color: #9aaabf;` → `var(--text-dim)`, Hover `#d8e0f0` → `var(--text)`.

- [ ] **Step 2: „TARGETED OVERRIDES"-Block (Tab/Chip/Modal/Dropdown) auf Tokens umstellen**

Die `!important`-Overrides für `.bg-slate-700`, `.rounded-t-2xl`, `.sticky.top-0`, `.shadow-xl`, Divider, Borders nutzen feste dunkle `rgba`-Werte. Ersetzen:

| Hartkodiert | Token |
|---|---|
| `rgba(3,4,14,0.92)`, `rgba(4,5,18,0.98)`, `rgba(7,8,24,0.98)` (Surface-BGs) | `var(--surface)` |
| `rgba(18,22,48,0.92)` (aktiver Tab) | `var(--surface-raised)` |
| Border-`rgba(255,255,255,0.0x)`-Werte | `var(--border)` |
| `.bg-sky-500`-Gradient | `linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 75%, #003a6e))` + `color: var(--accent-contrast)` |
| Divider `border-*-color: rgba(255,255,255,0.05)` | `var(--border)` |

Die `bg-emerald/amber`-Aktiv-Tab-Gradienten bleiben (Kategorie-Akzente, in beiden Themes vivid).

- [ ] **Step 3: `@layer utilities` `.glass` auf Token**

`.glass { background: rgba(6,7,20,0.78); ... }` → `background: var(--glass-bg);` und `border: 1px solid var(--border);`.

- [ ] **Step 4: Build + Vollständigkeits-Check**

Run: `npm run build`
Expected: grün.
Run: `npm run dev`, im Light-Theme alle Standard-Buttons/Inputs/Cards sichten (z. B. Profil-Seite, die `.card`/`.input`/`.btn-*` nutzt).
Expected: Karten weiß, Text dunkel, Buttons lesbar (AA-Kontrast), keine grellen Glows.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "refactor(theme): migrate shared CSS classes to semantic tokens"
```

---

## Task 6: DesignSystem.tsx-Primitive auf Tokens migrieren

**Files:**
- Modify: `src/components/ui/DesignSystem.tsx`

Ziel: Neutralfarben (Surface/Text/Border/Shadow) der Primitive nutzen Tokens. Die per Prop übergebenen **Akzentfarben** (Kategorie-Hex) bleiben über `accentAlpha` erhalten (in beiden Themes bewusst vivid).

- [ ] **Step 1: Neutralfarb-Mapping anwenden**

In `GlassPanel`, `IconBadge`, `PageHero`, `SectionHeader`, `MetricCard`, `ResearchDisclaimer`, `ActionTile`:

| Hartkodiert | Token |
|---|---|
| `'linear-gradient(145deg, rgba(9,14,34,0.94), rgba(4,7,18,0.96))'` (GlassPanel-BG) | `'var(--surface)'` |
| `'0 18px 60px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.05)'` | `'var(--shadow-card)'` |
| `'#f8fbff'`, `'#eaeefc'` (Titel/Werte) | `'var(--text)'` |
| `'rgba(213,224,242,0.70)'`, `'rgba(234,238,252,0.82)'` (Subtitle/Label) | `'var(--text-dim)'` |
| `'rgba(154,170,191,0.5x)'` (Hints/Kicker) | `'var(--text-muted)'` |
| Border `rgba(255,255,255,..)` (falls vorhanden) | `'var(--border)'` |

`accent`-abgeleitete Werte (`accentAlpha(accent, ...)`, `IconBadge`-BG/Border/Color) **unverändert** lassen.

- [ ] **Step 2: Build + Lint**

Run: `npm run build && npm run lint`
Expected: grün.

- [ ] **Step 3: Visuelle Sichtung beider Themes**

Run: `npm run dev` → Home (nutzt diese Primitive intensiv). In Dark und Light sichten: Karten-Hintergrund, Text, Icon-Badges.
Expected: Dark unverändert; Light = weiße Panels, dunkler Text, Akzent-Badges farbig & lesbar.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/DesignSystem.tsx
git commit -m "refactor(theme): migrate DesignSystem primitives to semantic tokens"
```

---

## Task 7: Layout.tsx (geteilte Chrome) auf Tokens migrieren

**Files:**
- Modify: `src/components/Layout.tsx`

Ziel: Bottom-Nav, Push-/iOS-Banner, Quick-Action-Sheet, FAQ-Float nutzen Tokens; UI-Glyphen bleiben Lucide (bereits der Fall).

- [ ] **Step 1: Neutralfarb-Mapping in allen Inline-Styles**

| Hartkodiert | Token |
|---|---|
| `'rgba(3, 4, 16, 0.92)'` (Nav-BG), `'linear-gradient(160deg, rgba(13,18,40,0.99), rgba(5,8,20,0.99))'` (Sheet) | `'var(--surface)'` |
| `'rgba(10,14,30,0.92)'` (FAQ-Float-BG) | `'var(--surface)'` |
| `'rgba(255,255,255,0.06)'`/`0.08`/`0.09`/`0.10` (Borders) | `'var(--border)'` |
| `'#eaeefc'` (Sheet-Item-Text) | `'var(--text)'` |
| `'rgba(154,170,191,0.5x)'`, `'rgba(100,115,135,..)'` (inaktive Nav/Labels) | `'var(--text-muted)'` |
| `'#00ccf5'` (aktive Nav/FAQ-aktiv) | `'var(--accent)'` |
| Quick-Button-Gradient `'linear-gradient(135deg, #00ccf5, #0077cc)'` | `'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #003a6e))'` |
| `color="#07091a"` (Plus-Icon auf Quick-Button) | `'var(--accent-contrast)'` |

Die `action.color`/`tile.color`-Akzente der QUICK_ACTIONS/QUICK_TILES bleiben (Kategorie-Hex).

- [ ] **Step 2: Plus-Icon-Farbe als Prop**

`<Plus size={24} color="#07091a" />` → `<Plus size={24} color="var(--accent-contrast)" />` (lucide akzeptiert CSS-Var als `color`).

- [ ] **Step 3: Build + Lint**

Run: `npm run build && npm run lint`
Expected: grün.

- [ ] **Step 4: Visuelle Sichtung beider Themes**

Run: `npm run dev`. In Dark und Light prüfen: Bottom-Nav lesbar, aktiver Tab Akzent, Quick-Action-Sheet (Plus tippen), FAQ-Float.
Expected: Light = helle Nav-Leiste mit feinen Linien, dunkler Text; Quick-Button-Akzent kontrastreich.

- [ ] **Step 5: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "refactor(theme): migrate Layout chrome to semantic tokens"
```

---

## Task 8: Motion-System in index.css

**Files:**
- Modify: `src/index.css` (Keyframes-Bereich oben + neuer Utilities-Block)

- [ ] **Step 1: Timing-Tokens vereinheitlichen**

Im `:root` die `--t-*`-Werte auf das Snappy-&-Pro-Profil setzen:

```css
  --t-fast: 0.14s cubic-bezier(0.4,0,0.2,1);
  --t-std:  0.20s cubic-bezier(0.4,0,0.2,1);
  --t-slow: 0.32s cubic-bezier(0.4,0,0.2,1);
```

- [ ] **Step 2: Wiederverwendbare Motion-Utilities + zentrales Slide-Keyframe**

Am Ende von `src/index.css` ergänzen:

```css
/* ── Motion system ── */
@keyframes tydFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes tydSlideUp {
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
}
.motion-fade-up { animation: tydFadeUp var(--t-std) cubic-bezier(0.22,1,0.36,1) both; }
.motion-press   { transition: transform var(--t-fast); }
.motion-press:active { transform: scale(0.98); }
.stagger-in > * { animation: tydFadeUp var(--t-std) cubic-bezier(0.22,1,0.36,1) both; }
.stagger-in > *:nth-child(1) { animation-delay: 0ms; }
.stagger-in > *:nth-child(2) { animation-delay: 40ms; }
.stagger-in > *:nth-child(3) { animation-delay: 80ms; }
.stagger-in > *:nth-child(4) { animation-delay: 120ms; }
.stagger-in > *:nth-child(5) { animation-delay: 160ms; }
.stagger-in > *:nth-child(6) { animation-delay: 200ms; }

/* ── Reduced motion: disable decorative animation for FPS & a11y ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Lokales `tydSlideUp` in Layout.tsx auf zentrale Definition umstellen**

In `src/components/Layout.tsx` den inline `<style>{`@keyframes tydSlideUp ...`}</style>`-Block (~Zeile 186–191) entfernen, da das Keyframe jetzt global ist. Die `animation: 'tydSlideUp ...'`-Verwendung bleibt.

- [ ] **Step 4: Build + reduce-motion-Test**

Run: `npm run build` → grün.
Run: `npm run dev`. In DevTools „Emulate CSS prefers-reduced-motion: reduce" aktivieren.
Expected: Quick-Action-Sheet erscheint ohne Slide-Animation; keine dekorative Bewegung.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/Layout.tsx
git commit -m "feat(motion): add motion utilities and reduced-motion guard"
```

---

## Task 9: Icon-Vereinheitlichung — Home-Emojis ersetzen

**Files:**
- Modify: `src/pages/Home.tsx` (PEPTIDE_STUDIES ~26–40; Verwendung ~491; greeting ~329; stat-value ~360)

- [ ] **Step 1: Studien-Datenstruktur von `emoji` auf Lucide-`icon` umstellen**

`PEPTIDE_STUDIES` (Zeile 25–40): das `emoji`-Feld durch ein `icon: LucideIcon` ersetzen. Passende Icons (alle bereits oder neu aus lucide importierbar):

```ts
const PEPTIDE_STUDIES = [
  { icon: FlaskConical, title: 'BPC-157 beschleunigt Sehnen- & Muskelheilung signifikant', source: 'J. Physiol. · 2024' },
  { icon: Dumbbell,     title: 'TB-500 fördert Angiogenese & Wundheilung bei Gewebeschäden', source: 'Wound Rep. Reg. · 2023' },
  { icon: Dna,          title: 'GHK-Cu aktiviert über 4.000 Gene – Gewebereparatur & Anti-Aging', source: 'Biomolecules · 2024' },
  { icon: Zap,          title: 'Ipamorelin: selektive GH-Freisetzung ohne Cortisol- oder Prolaktin-Spitzen', source: 'Endocrinology · 2023' },
  { icon: Moon,         title: 'Epitalon verlängert Telomere & hemmt Tumorwachstum in Langzeitstudie', source: 'Aging · 2023' },
  { icon: Brain,        title: 'Selank (TP-7) zeigt anxiolytische Wirkung ohne Abhängigkeitspotenzial', source: 'Neuropharmacology · 2024' },
  { icon: Microscope,   title: 'MOTS-c verbessert Insulinsensitivität & Mitochondrienfunktion', source: 'Cell Metab. · 2024' },
  { icon: Bandage,      title: 'AOD-9604: gezielter Fettabbau ohne diabetogene Nebenwirkungen', source: 'Obes. Res. · 2023' },
  { icon: HeartPulse,   title: 'Thymosin α1 stärkt Immunantwort bei chronischer Entzündung', source: 'Immunology · 2024' },
  { icon: Lightbulb,    title: 'PT-141 (Bremelanotide) – erstes FDA-zugelassenes Peptid gegen Libidostörungen', source: 'FDA Approval · 2019' },
  { icon: TrendingUp,   title: 'CJC-1295 hält IGF-1-Spiegel über 14 Tage erhöht', source: 'J. Clin. Endocrinol. · 2006' },
  { icon: ShieldCheck,  title: 'Humanin schützt Neuronen vor amyloidbedingtem Zelltod – neue Daten', source: 'PNAS · 2024' },
  { icon: Leaf,         title: 'Epithalon reduziert oxidativen Stress & verbessert Schlafqualität', source: 'Biogerontology · 2023' },
  { icon: Bone,         title: 'BPC-157 fördert Knochenregeneration nach Fraktur – Tierstudie', source: 'Bone · 2024' },
] as const
```

- [ ] **Step 2: Fehlende Icons importieren**

Den lucide-Import (Zeile 5–12) um die neuen Namen ergänzen: `Dumbbell, Dna, Zap, Moon, Brain, Bandage, HeartPulse, Lightbulb, Leaf, Bone`. (`FlaskConical, Microscope, TrendingUp, ShieldCheck` sind bereits importiert.)

- [ ] **Step 3: Render-Stelle anpassen (~Zeile 491)**

`<span style={{ fontSize: '1.35rem' }}>{todayStudy.emoji}</span>` ersetzen durch:

```tsx
{(() => { const StudyIcon = todayStudy.icon; return <StudyIcon size={22} color="var(--accent)" /> })()}
```

(Falls `todayStudy` aus `TODAY_STUDY` stammt: Variablenzugriff entsprechend; das `icon`-Feld nutzen.)

- [ ] **Step 4: Greeting-Emoji entfernen (~Zeile 329)**

`{greeting} 👋` → `{greeting}` (UI-Emoji entfernt; konsistent icon-frei im Titel).

- [ ] **Step 5: Häkchen-Glyphe ersetzen (~Zeile 360)**

`value={todayDone ? '✓' : (nextIntake ?? '–')}` → ein Lucide-`Check`-Icon als Wert verwenden:

```tsx
value={todayDone ? <CheckCircle2 size={26} /> : (nextIntake ?? '–')}
```

(`CheckCircle2` ist bereits importiert.)

- [ ] **Step 6: Vollständigkeits-Check (keine UI-Emojis mehr in Home)**

Run: `npx tsx -e "const s=require('fs').readFileSync('src/pages/Home.tsx','utf8'); const m=s.match(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/gu); console.log(m||'none')"`
Expected: `none` (oder nur in Kommentaren/Quellen-Strings, die kein UI-Glyph sind — visuell verifizieren).

- [ ] **Step 7: Build + Lint + Commit**

Run: `npm run build && npm run lint` → grün.

```bash
git add src/pages/Home.tsx
git commit -m "refactor(icons): replace Home UI emojis with Lucide icons"
```

---

## Task 10: Home.tsx-Farben auf Tokens migrieren + Motion-Politur

**Files:**
- Modify: `src/pages/Home.tsx`

- [ ] **Step 1: Hartkodierte Neutralfarben durch Tokens ersetzen**

Mapping über die gesamte Datei (Inline-Styles):

| Hartkodiert | Token |
|---|---|
| `'rgba(213,224,242,0.72)'` u. ä. (Body-Text) | `'var(--text-dim)'` |
| `'#f8fbff'`, `'#eaeefc'` (Überschriften/Werte) | `'var(--text)'` |
| `'rgba(154,170,191,..)'` (Hints) | `'var(--text-muted)'` |
| `'rgba(0,204,245,..)'` (Akzent-Text/Border) | `'var(--accent)'` bzw. `'var(--accent-weak)'`/`'var(--accent-border)'` |
| feste Surface-`rgba`/Gradients | `'var(--surface)'` |
| Border-`rgba(255,255,255,..)` | `'var(--border)'` |

`accent`-Props an DesignSystem-Primitive (Kategorie-Hex wie `'#10b981'`, `'#8b5cf6'`) bleiben.

- [ ] **Step 2: Sanftes Einblenden der Hauptbereiche**

Am äußeren Container der Home-Seite (PageShell-Wrapper) die Klasse `stagger-in` ergänzen, damit die Top-Level-Sektionen gestaffelt einblenden. Interaktive Kacheln/Buttons erhalten `motion-press`.

- [ ] **Step 3: Build + Lint**

Run: `npm run build && npm run lint`
Expected: grün.

- [ ] **Step 4: Vollständigkeits-Check Farben**

Run: `grep -nE "rgba\(255,255,255|#f8fbff|#eaeefc|rgba\(0,204,245" src/pages/Home.tsx`
Expected: Keine Treffer mehr für Neutral-/Akzent-Hardcodes (Kategorie-Hex-Akzente dürfen bleiben — manuell bewerten).

- [ ] **Step 5: Visuelle Sichtung beider Themes**

Run: `npm run dev` → Home in Dark und Light vollständig durchscrollen.
Expected: Dark unverändert-poliert; Light = saubere weiße Flächen, dunkler Text, kontrastreiche Akzente, dezente Einblend-Animation, flüssig.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "refactor(theme): migrate Home page to tokens and add motion polish"
```

---

## Task 11: Abschluss-Verifikation

**Files:** keine Änderung (nur Prüfung; Fixes inline falls nötig)

- [ ] **Step 1: Build + Lint gesamt**

Run: `npm run build && npm run lint`
Expected: Beides grün.

- [ ] **Step 2: Theme-Flash-Check**

Run: `npm run dev`, Theme auf „Hell" stellen, harter Reload (Ctrl+Shift+R).
Expected: Seite lädt **direkt** hell, kein dunkles Aufblitzen.

- [ ] **Step 3: System-Folge-Check**

localStorage `tyd_theme` auf `system` (Profil → „System"). OS-Theme wechseln (oder DevTools „Emulate prefers-color-scheme").
Expected: App folgt live.

- [ ] **Step 4: Persistenz-Check**

„Dunkel" wählen → Reload → bleibt dunkel. „Hell" → Reload → bleibt hell.

- [ ] **Step 5: Geteilte Ebene in Light final sichten**

Bottom-Nav, Quick-Action-Sheet, Push-Banner (falls auslösbar), FAQ-Float in Light prüfen — alles lesbar, AA-Kontrast, keine grellen Glows.

- [ ] **Step 6: reduce-motion final**

DevTools reduce-motion → Home neu laden: keine Einblend-/Slide-Animation.

- [ ] **Step 7: Abschluss-Commit (falls Inline-Fixes nötig waren)**

```bash
git add -A
git commit -m "fix(theme): final verification adjustments for Phase 1"
```

---

## Self-Review-Ergebnis (gegen Spec)

- **Token-Architektur (Spec 4.1):** Task 1, 2. ✔
- **Theme-Umschaltung, kein Flash (Spec 4.2):** Task 3, 4; Flash-Check Task 11/2. ✔
- **Geteilte Ebene migriert (Spec Umfang 3):** index.css Task 5, DesignSystem Task 6, Layout Task 7. ✔
- **Motion-System + reduce-motion (Spec 4.3):** Task 8; Checks Task 8/4, 11/6. ✔
- **Icon-Vereinheitlichung (Spec 4.4):** Task 9 (Home + geteilte Ebene bereits Lucide). ✔
- **Pilot Home (Spec 4.5):** Task 9, 10. ✔
- **Verifikation (Spec 5):** Task 11. ✔

Keine offenen Platzhalter. Token-Namen über alle Tasks konsistent (`--accent`, `--accent-contrast`, `--text`, `--surface`, …). `useTheme`/`setThemeMode` aus `theme.ts` werden in Task 4 konsistent verwendet.
