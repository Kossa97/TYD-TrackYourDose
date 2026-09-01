# Kapsel als dritte Bühnenform — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Kapsel als dritte Bühnenform rendern — liegend, durchsichtig getönt, mit Konturgravur und ohne jede Bewegung.

**Architecture:** Alles Neue liegt in `src/features/my-stack/extensions/capsule/`. Geteilt wird ausschließlich `useStageLight`. Die Gravur bleibt bewusst formspezifisch, bis eine zweite Form eine braucht. `StageFormSpec` bekommt kein neues Feld: `chamber: null` liefert bereits „kein Etikett" und „kein Füllstand".

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind, Inline-SVG.

**Spec:** `docs/superpowers/specs/2026-09-01-my-stack-kapsel-buehnenform-design.md`

---

## Global Constraints

1. **Vial- und Ampullen-Tests bleiben unverändert grün.** `src/components/PeptideVialVisual.test.ts` (24 Tests) und `src/features/my-stack/extensions/ampoule/*.test.ts` werden nicht angefasst.
2. **Die Kapsel dient heute als Negativbeispiel.** `StackStage.test.ts` prüft an drei Stellen mit `capsuleItem`, dass Formen ohne Renderer im Textzustand bleiben (Zeilen 61, 65, 119). Diese Prüfungen ziehen auf `tablet` um — die Absicht bleibt, das Beispiel wechselt.
3. **`dosageForms.test.ts` erwartet heute genau `['vial', 'ampoule']`** (Zeile 20) und `isStageRenderable('capsule') === false` (Zeile 49). Beides wird auf den neuen Stand gehoben, weiterhin streng.
4. **Keine neuen i18n-Schlüssel.** Die Kapsel zeigt ausschließlich Daten.
5. **Keine Slosh-Anbindung.** `CapsuleVisual` importiert weder `SloshContext` noch `sloshEngine`.
6. Testbefehl `npx vitest run <pfad>`, volle Suite `npm test`, alles aus dem Worktree `C:/Users/Devin/peptid-tracker/.worktrees/my-stack-foundation`.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `extensions/capsule/capsuleShape.ts` | Konturen, Maße, Gravurmaße, `StageFormSpec`. Reine Daten. |
| `extensions/capsule/capsuleShape.test.ts` | Prüft die Formkonstanten. |
| `extensions/capsule/engraving.ts` | Reine Fit-Logik: Schriftgröße und Abschneiden. |
| `extensions/capsule/engraving.test.ts` | Prüft Schrumpfen und hartes Abschneiden. |
| `extensions/capsule/CapsuleVisual.tsx` | Hülle, Tönung, Reflexe, Gravur. |
| `extensions/capsule/CapsuleVisual.test.ts` | Strukturtests. |
| `extensions/capsule/CapsuleRenderer.tsx` | Adapter von `StackItem` auf `CapsuleVisual`. |

Geändert: `lib/dosageForms.ts`, `lib/dosageForms.test.ts`, `components/StackStage.tsx`, `components/StackStage.test.ts`, `src/pages/__VialPreview.tsx`.

---

### Task 1: Formdaten der Kapsel

**Files:**
- Create: `src/features/my-stack/extensions/capsule/capsuleShape.ts`
- Test: `src/features/my-stack/extensions/capsule/capsuleShape.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  CAPSULE_ASPECT, CAPSULE_CAP_PATH, CAPSULE_CAP_INNER_PATH, CAPSULE_ENGRAVING,
  CAPSULE_SEAM_X, CAPSULE_SHELL_PATH, CAPSULE_SHELL_INNER_PATH, CAPSULE_SPEC,
} from './capsuleShape'

describe('capsuleShape', () => {
  it('schliesst alle vier Konturen, damit sie als Fuellung und Clip taugen', () => {
    for (const d of [CAPSULE_SHELL_PATH, CAPSULE_SHELL_INNER_PATH, CAPSULE_CAP_PATH, CAPSULE_CAP_INNER_PATH]) {
      expect(d.startsWith('M')).toBe(true)
      expect(d.trimEnd().endsWith('Z')).toBe(true)
    }
  })

  it('zeichnet den Grundkoerper durchgehend, nicht nur die rechte Haelfte', () => {
    // Ein an die Kappe anstossender Koerper zeigt seine harte Kante durch die
    // durchsichtige Huelle — deshalb muss er die volle Laenge haben.
    const xs = [...CAPSULE_SHELL_PATH.matchAll(/(?:^M|[LC])\s*(\d+(?:\.\d+)?)/g)].map(m => Number(m[1]))
    expect(Math.min(...xs)).toBeLessThan(CAPSULE_SEAM_X)
    expect(Math.max(...xs)).toBeGreaterThan(200)
  })

  it('legt die Naht dort, wo die Kappe endet', () => {
    expect(CAPSULE_CAP_PATH.startsWith(`M${CAPSULE_SEAM_X} `)).toBe(true)
  })

  it('liegt flach: breiter als hoch, Verhaeltnis rund 2,9 zu 1', () => {
    expect(CAPSULE_ASPECT).toBeCloseTo(84 / 240, 3)
    expect(1 / CAPSULE_ASPECT).toBeGreaterThan(2.5)
    expect(1 / CAPSULE_ASPECT).toBeLessThan(3.2)
  })

  it('hat keine Fluessigkeitskammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(CAPSULE_SPEC.chamber).toBeNull()
    expect(CAPSULE_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(CAPSULE_SPEC)).toBe(false)
  })

  it('zentriert die Gravur auf der Kapselmitte', () => {
    expect(CAPSULE_ENGRAVING.centerX).toBe(120)
    expect(CAPSULE_ENGRAVING.baselineY).toBeGreaterThan(42)
    expect(CAPSULE_ENGRAVING.baselineY).toBeLessThan(56)
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/capsule/capsuleShape.test.ts`
Expected: FAIL — `Cannot find module './capsuleShape'`.

- [ ] **Step 3: Die Formdaten anlegen**

```ts
import type { StageFormSpec } from '../../stage/types'

// Zweiteilige Hartkapsel, liegend. Der Grundkoerper laeuft ueber die volle
// Laenge; die Kappe liegt als zusaetzliche Schicht darueber. Nur so bleibt die
// Naht am Kappenrand die einzige sichtbare innere Linie — ein an die Kappe
// anstossender Koerper zeigt seine harte Kante durch die durchsichtige Huelle.
export const CAPSULE_SHELL_PATH = 'M42 8 L198 8 C217 8 232 23 232 42 C232 61 217 76 198 76 L42 76 C23 76 8 61 8 42 C8 23 23 8 42 8 Z'
export const CAPSULE_SHELL_INNER_PATH = 'M44 11.5 L198 11.5 C215 11.5 228.5 25 228.5 42 C228.5 59 215 72.5 198 72.5 L44 72.5 C27 72.5 11.5 59 11.5 42 C11.5 25 27 11.5 44 11.5 Z'

// Die Kappe ist minimal hoeher als der Koerper — sie schiebt sich im echten
// Bauteil darueber.
export const CAPSULE_SEAM_X = 130
export const CAPSULE_CAP_PATH = 'M130 4 L42 4 C21 4 4 21 4 42 C4 63 21 80 42 80 L130 80 Z'
export const CAPSULE_CAP_INNER_PATH = 'M127 7.5 L42 7.5 C23 7.5 7.5 23 7.5 42 C7.5 61 23 76.5 42 76.5 L127 76.5 Z'

export const CAPSULE_VIEWBOX = { x: 0, y: 0, width: 240, height: 84 } as const
// Hoehe geteilt durch Breite. Die Kapsel skaliert uniform, nie gestaucht.
export const CAPSULE_ASPECT = 84 / 240

export const CAPSULE_ENGRAVING = {
  centerX: 120,
  baselineY: 48.5,
  // Nutzbare Breite fuer den Schriftzug in viewBox-Einheiten.
  maxWidth: 150,
  maxFontSize: 15,
  minFontSize: 11,
  letterSpacing: 2.6,
} as const

export const CAPSULE_SPEC: StageFormSpec = {
  viewBox: CAPSULE_VIEWBOX,
  // Keine Fluessigkeit: damit kein Etikett und kein Fuellstand.
  chamber: null,
  hasMeaningfulFill: false,
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/capsule/capsuleShape.test.ts`
Expected: PASS, 6 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/extensions/capsule/capsuleShape.ts src/features/my-stack/extensions/capsule/capsuleShape.test.ts
git commit -m "feat: add capsule shape data"
```

---

### Task 2: Gravur-Fit als reine Logik

**Files:**
- Create: `src/features/my-stack/extensions/capsule/engraving.ts`
- Test: `src/features/my-stack/extensions/capsule/engraving.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest'
import { estimateEngravingWidth, fitEngraving } from './engraving'
import { CAPSULE_ENGRAVING } from './capsuleShape'

describe('fitEngraving', () => {
  it('setzt kurze Namen in voller Groesse', () => {
    const fit = fitEngraving('Vitamin D3')
    expect(fit.text).toBe('VITAMIN D3')
    expect(fit.fontSize).toBe(CAPSULE_ENGRAVING.maxFontSize)
    expect(fit.truncated).toBe(false)
  })

  it('schrumpft die Schrift, bevor sie kuerzt', () => {
    const fit = fitEngraving('Magnesiumcitrat')
    expect(fit.fontSize).toBeLessThan(CAPSULE_ENGRAVING.maxFontSize)
    expect(fit.fontSize).toBeGreaterThanOrEqual(CAPSULE_ENGRAVING.minFontSize)
    expect(fit.text).toBe('MAGNESIUMCITRAT')
    expect(fit.truncated).toBe(false)
  })

  it('kuerzt hart, wenn auch die kleinste Groesse nicht reicht', () => {
    const fit = fitEngraving('Acetyl-L-Carnitin Hydrochlorid Komplex')
    expect(fit.fontSize).toBe(CAPSULE_ENGRAVING.minFontSize)
    expect(fit.truncated).toBe(true)
    expect(fit.text.endsWith('…')).toBe(false)
    expect(fit.text.endsWith('...')).toBe(false)
    expect(estimateEngravingWidth(fit.text, fit.fontSize)).toBeLessThanOrEqual(CAPSULE_ENGRAVING.maxWidth)
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck statt leer zu bleiben', () => {
    expect(fitEngraving('   ').text).toBe('KAPSEL')
    expect(fitEngraving('').text).toBe('KAPSEL')
  })

  it('bleibt bei jeder Eingabe innerhalb der nutzbaren Breite', () => {
    for (const name of ['A', 'Zink', 'Vitamin D3', 'Omega 3 Fischoel Konzentrat hochdosiert']) {
      const fit = fitEngraving(name)
      expect(estimateEngravingWidth(fit.text, fit.fontSize)).toBeLessThanOrEqual(CAPSULE_ENGRAVING.maxWidth)
    }
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/capsule/engraving.test.ts`
Expected: FAIL — `Cannot find module './engraving'`.

- [ ] **Step 3: Die Fit-Logik implementieren**

```ts
import { CAPSULE_ENGRAVING } from './capsuleShape'

export interface EngravingFit {
  text: string
  fontSize: number
  truncated: boolean
}

// Schmale Versalien laufen bei rund 0,52 der Schriftgroesse pro Zeichen, dazu
// der Sperrsatz. Reicht fuer die Layoutentscheidung und braucht kein DOM.
export function estimateEngravingWidth(text: string, fontSize: number): number {
  return text.length * (fontSize * 0.52 + CAPSULE_ENGRAVING.letterSpacing)
}

// Erst schrumpfen, dann kuerzen — und beim Kuerzen keine Auslassungspunkte:
// eine Praegung endet einfach, sie kuendigt nichts an.
export function fitEngraving(displayName: string): EngravingFit {
  const { maxWidth, maxFontSize, minFontSize } = CAPSULE_ENGRAVING
  const text = (displayName ?? '').trim().toUpperCase() || 'KAPSEL'

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize -= 0.5) {
    if (estimateEngravingWidth(text, fontSize) <= maxWidth) {
      return { text, fontSize, truncated: false }
    }
  }

  let cut = text.length
  while (cut > 1 && estimateEngravingWidth(text.slice(0, cut), minFontSize) > maxWidth) cut--
  return { text: text.slice(0, cut).trimEnd(), fontSize: minFontSize, truncated: true }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/capsule/engraving.test.ts`
Expected: PASS, 5 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/extensions/capsule/engraving.ts src/features/my-stack/extensions/capsule/engraving.test.ts
git commit -m "feat: fit the capsule engraving before truncating it"
```

---

### Task 3: `CapsuleVisual`

**Files:**
- Create: `src/features/my-stack/extensions/capsule/CapsuleVisual.tsx`
- Test: `src/features/my-stack/extensions/capsule/CapsuleVisual.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CapsuleVisual } from './CapsuleVisual'

const base = { name: 'Vitamin D3', color: '#f0b357' }
const render = (props: Partial<Parameters<typeof CapsuleVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(CapsuleVisual, { ...base, ...props }))

describe('CapsuleVisual', () => {
  it('meldet sich als Kapsel-Renderer', () => {
    expect(render()).toContain('data-capsule-detail="root"')
  })

  it('zeichnet Grundkoerper, Kappe und beide Innenkonturen', () => {
    const html = render()
    expect(html).toContain('data-capsule-detail="shell"')
    expect(html).toContain('data-capsule-detail="cap"')
    expect(html).toContain('data-capsule-detail="shell-inner"')
    expect(html).toContain('data-capsule-detail="cap-inner"')
  })

  it('haelt die Huellenkante bei jeder Groesse sichtbar', () => {
    expect(render({ size: 'carousel' })).toContain('vector-effect="non-scaling-stroke"')
  })

  it('teilt einen absoluten Verlauf zwischen Kappe und Koerper', () => {
    // Bei objektbezogenen Einheiten springt die Toenung an der Naht, weil die
    // beiden Pfade unterschiedlich hoch sind.
    const html = render()
    expect(html).toContain('gradientUnits="userSpaceOnUse"')
  })

  it('graviert ohne Fuellton im Buchstabeninneren', () => {
    const html = render()
    expect(html).toContain('data-capsule-detail="engraving"')
    const group = html.slice(html.indexOf('data-capsule-detail="engraving"'))
    expect(group.slice(0, 200)).toContain('fill="none"')
  })

  it('zentriert die Gravur auf der Kapselmitte', () => {
    expect(render()).toContain('x="120"')
  })

  it('behaelt liegend das Seitenverhaeltnis bei jeder Groesse', () => {
    for (const size of ['large', 'carousel', 'compact', 'mini'] as const) {
      expect(render({ size })).toContain('aspect-[240/84]')
    }
  })

  it('waechst am sm-Breakpoint nicht mit, schrumpft aber mit einem engen Slot', () => {
    const html = render({ size: 'carousel' })
    expect(html).toContain('w-full max-w-[92px]')
    expect(html).not.toContain('sm:')
  })

  it('bekommt weder Etikett noch Fuellstand', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
  })

  it('haengt nicht an der Slosh-Physik', () => {
    const source = readFileSync(new URL('./CapsuleVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('SloshContext')
    expect(source).not.toContain('sloshEngine')
    expect(source).not.toContain('useSloshSubscribe')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-capsule-focus="0.42"')
    expect(html).toContain('data-capsule-light-offset="-0.35"')
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/capsule/CapsuleVisual.test.ts`
Expected: FAIL — `Cannot find module './CapsuleVisual'`.

- [ ] **Step 3: Die Komponente implementieren**

```tsx
import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  CAPSULE_CAP_INNER_PATH, CAPSULE_CAP_PATH, CAPSULE_ENGRAVING,
  CAPSULE_SHELL_INNER_PATH, CAPSULE_SHELL_PATH,
} from './capsuleShape'
import { fitEngraving } from './engraving'

export interface CapsuleVisualProps {
  name?: string | null
  color: string
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0)
const clampOffset = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0)

// Liegend begrenzt die Slot-Breite, nicht die Hoehe. Die Kapsel waechst am
// sm-Breakpoint deshalb nicht mit — sie fuellt den Slot bereits.
const SIZE_CLASS: Record<NonNullable<CapsuleVisualProps['size']>, string> = {
  large: 'w-[240px] aspect-[240/84]',
  // Fuellt den Slot bis 92 px und schrumpft auf schmalen Geraeten mit ihm.
  // Die Hoehe folgt immer dem Seitenverhaeltnis, nie einer festen Zahl.
  carousel: 'w-full max-w-[92px] aspect-[240/84]',
  compact: 'w-[140px] aspect-[240/84]',
  mini: 'w-[60px] aspect-[240/84]',
}

export function CapsuleVisual({
  name, color, size = 'large', className = '',
  isActive = true, focus, lightOffset = 0, stageLightRef,
}: CapsuleVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const engraving = fitEngraving(name ?? '')

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const glossRef = useRef<SVGPathElement | null>(null)
  const shellRef = useRef<SVGUseElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-capsule-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-capsule-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (120 - o * 10).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.28 + f * 0.3).toFixed(3))
    sweepRef.current?.setAttribute('transform', `translate(${(o * 46).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.12 + f * 0.32).toFixed(3))
    glossRef.current?.setAttribute('stroke-opacity', (0.3 + f * 0.3).toFixed(3))
    shellRef.current?.setAttribute('stroke-opacity', (0.3 + f * 0.26).toFixed(3))
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-capsule-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-capsule-focus={Number(visualFocus.toFixed(2))}
      data-capsule-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={engraving.text}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 240 84"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <path id={`${uid}-shell`} d={CAPSULE_SHELL_PATH} />
          <path id={`${uid}-cap`} d={CAPSULE_CAP_PATH} />
          <clipPath id={`${uid}-shellClip`}><use href={`#${uid}-shell`} /></clipPath>
          {/* Kappe und Koerper sind unterschiedlich hoch. Ein objektbezogener
              Verlauf wuerde dieselben Stopps auf verschiedene absolute Hoehen
              legen und an der Naht sichtbar springen. */}
          <linearGradient id={`${uid}-tint`} gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="80">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="45%" stopColor={color} stopOpacity="0.16" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id={`${uid}-depth`} gradientUnits="userSpaceOnUse" x1="0" y1="4" x2="0" y2="80">
            <stop offset="0%" stopColor="rgba(2,6,23,0.5)" />
            <stop offset="14%" stopColor="rgba(255,255,255,0.16)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="82%" stopColor="rgba(15,23,42,0.2)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.62)" />
          </linearGradient>
          <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id={`${uid}-shadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-30%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        <ellipse
          ref={shadowRef}
          data-capsule-detail="shadow"
          cx={120 - visualLightOffset * 10}
          cy="82" rx="96" ry="5"
          fill={`url(#${uid}-shadow)`}
          opacity={0.28 + visualFocus * 0.3}
        />

        <use href={`#${uid}-shell`} fill={`url(#${uid}-tint)`} />
        <use
          ref={shellRef}
          data-capsule-detail="shell"
          href={`#${uid}-shell`}
          fill={`url(#${uid}-depth)`}
          stroke="rgba(203,213,225,0.5)"
          strokeOpacity={0.3 + visualFocus * 0.26}
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />

        <use href={`#${uid}-cap`} fill={`url(#${uid}-tint)`} opacity="0.55" />
        <use
          data-capsule-detail="cap"
          href={`#${uid}-cap`}
          fill={`url(#${uid}-depth)`}
          stroke="rgba(203,213,225,0.5)"
          strokeWidth="1.1"
          vectorEffect="non-scaling-stroke"
        />

        <g clipPath={`url(#${uid}-shellClip)`}>
          <rect
            ref={sweepRef}
            data-capsule-detail="sweep"
            x="90" y="0" width="60" height="84"
            fill={`url(#${uid}-sweep)`}
            opacity={0.12 + visualFocus * 0.32}
            transform={`translate(${visualLightOffset * 46} 0)`}
          />
        </g>

        <path data-capsule-detail="shell-inner" d={CAPSULE_SHELL_INNER_PATH} fill="none"
              stroke="rgba(226,232,240,0.26)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />
        <path data-capsule-detail="cap-inner" d={CAPSULE_CAP_INNER_PATH} fill="none"
              stroke="rgba(226,232,240,0.28)" strokeWidth="0.9" vectorEffect="non-scaling-stroke" />

        <path
          ref={glossRef}
          data-capsule-detail="gloss"
          d="M30 22 C 80 14, 170 14, 220 23"
          fill="none" stroke="rgba(255,255,255,0.5)"
          strokeOpacity={0.3 + visualFocus * 0.3}
          strokeWidth="5" strokeLinecap="round"
          filter={`url(#${uid}-soft)`}
        />
        <path d="M42 67 C 92 73, 158 73, 212 65" fill="none" stroke="rgba(255,255,255,0.15)"
              strokeWidth="3" strokeLinecap="round" filter={`url(#${uid}-soft)`} />

        {/* Konturgravur: nur die beiden Rillenkanten, kein Fuellton. Das
            Buchstabeninnere zeigt die Huelle selbst. */}
        <g data-capsule-detail="engraving" fill="none">
          <text
            x={CAPSULE_ENGRAVING.centerX} y={CAPSULE_ENGRAVING.baselineY}
            textAnchor="middle"
            fontFamily="'Arial Narrow','Helvetica Neue',system-ui,sans-serif"
            fontSize={engraving.fontSize} fontWeight="500"
            letterSpacing={CAPSULE_ENGRAVING.letterSpacing}
            stroke="rgba(0,0,0,0.55)" strokeWidth="0.55"
            transform="translate(0.35 0.45)"
          >{engraving.text}</text>
          <text
            x={CAPSULE_ENGRAVING.centerX} y={CAPSULE_ENGRAVING.baselineY}
            textAnchor="middle"
            fontFamily="'Arial Narrow','Helvetica Neue',system-ui,sans-serif"
            fontSize={engraving.fontSize} fontWeight="500"
            letterSpacing={CAPSULE_ENGRAVING.letterSpacing}
            stroke="rgba(255,255,255,0.42)" strokeWidth="0.5"
            transform="translate(-0.3 -0.4)"
          >{engraving.text}</text>
        </g>
      </svg>
    </div>
  )
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/capsule`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/extensions/capsule/CapsuleVisual.tsx src/features/my-stack/extensions/capsule/CapsuleVisual.test.ts
git commit -m "feat: render the capsule stage form"
```

---

### Task 4: Adapter, Weiche und die Tests, die umziehen

**Files:**
- Create: `src/features/my-stack/extensions/capsule/CapsuleRenderer.tsx`
- Modify: `src/features/my-stack/lib/dosageForms.ts:23`
- Modify: `src/features/my-stack/lib/dosageForms.test.ts:20`, `:49`
- Modify: `src/features/my-stack/components/StackStage.tsx`
- Modify: `src/features/my-stack/components/StackStage.test.ts:39-119`

- [ ] **Step 1: Die bestehenden Erwartungen umziehen**

`dosageForms.test.ts` Zeile 20 und 46–50 auf den neuen Stand heben — weiterhin
streng, nur mit `tablet` als verbliebenem Negativbeispiel:

```ts
  it('aktiviert genau die Formen mit fertiger Bühnengrafik', () => {
    expect(DOSAGE_FORMS.filter(form => form.stageRenderer).map(form => form.key)).toEqual(['vial', 'ampoule', 'capsule'])
  })
```

```ts
  it('erkennt Vial, Ampulle und Kapsel als darstellbar, den Rest noch nicht', () => {
    expect(isStageRenderable('vial')).toBe(true)
    expect(isStageRenderable('ampoule')).toBe(true)
    expect(isStageRenderable('capsule')).toBe(true)
    expect(isStageRenderable('tablet')).toBe(false)
    expect(isStageRenderable('patch')).toBe(false)
  })
```

In `StackStage.test.ts` wird `capsuleItem` zu `tabletItem` — die Kapsel taugt
nicht mehr als Beispiel für „ohne Grafik". Zeile 39 ff.:

```ts
const tabletItem: StackItem = {
  ...vialItem,
  id: 'vitamin-d3-tablet',
  display_name: 'Vitamin D3',
  category: 'vitamin',
  dosage_form: 'tablet',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Vitamin D3',
    amount_value: 5_000,
    amount_unit: 'IU',
    basis_unit: 'tablet',
  }],
}
```

Alle drei Verwendungen von `capsuleItem` (Zeilen 61, 65, 119) werden auf
`tabletItem` umgestellt. Die Zusicherungen selbst bleiben unverändert.

- [ ] **Step 2: Den neuen Test ergänzen**

Ans Ende von `StackStage.test.ts`:

```ts
const capsuleItem: StackItem = {
  ...vialItem,
  id: 'vitamin-d3-capsule',
  display_name: 'Vitamin D3',
  category: 'vitamin',
  dosage_form: 'capsule',
  color_hex: '#f0b357',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Vitamin D3',
    amount_value: 5_000,
    amount_unit: 'IU',
    basis_unit: 'capsule',
  }],
}

describe('StackStage — Kapsel', () => {
  it('rendert die Kapsel für Kapsel-Einträge', () => {
    expect(renderStage(capsuleItem)).toContain('data-stack-renderer="capsule"')
  })

  it('graviert den Namen auf die Hülle statt ein Etikett zu tragen', () => {
    const html = renderStage(capsuleItem)
    expect(html).toContain('VITAMIN D3')
    expect(html).toContain('data-capsule-detail="engraving"')
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
  })

  it('hält den Kapsel-Adapter frei von eigener Grafik und von Physik', () => {
    const source = readFileSync(new URL('../extensions/capsule/CapsuleRenderer.tsx', import.meta.url), 'utf8')
    expect(source).toContain('CapsuleVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('SloshProvider')
    expect(source).not.toContain('fillPct')
  })
})
```

- [ ] **Step 3: Tests laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/components/StackStage.test.ts src/features/my-stack/lib/dosageForms.test.ts`
Expected: FAIL — `data-stack-renderer="unsupported"` statt `"capsule"`, und die Datei `CapsuleRenderer.tsx` fehlt.

- [ ] **Step 4: Den Adapter anlegen**

```tsx
import type { Ref } from 'react'
import { CapsuleVisual } from './CapsuleVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface CapsuleRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein SloshProvider: eine liegende Kapsel schwingt nicht, sie lebt allein vom
// wandernden Licht.
export function CapsuleRenderer({ item, ...visualProps }: CapsuleRendererProps) {
  return (
    <div data-stack-renderer="capsule">
      <CapsuleVisual
        name={item.display_name}
        color={item.color_hex ?? '#64748b'}
        {...visualProps}
      />
    </div>
  )
}
```

- [ ] **Step 5: Form freischalten und Weiche erweitern**

`dosageForms.ts` Zeile 23 ergänzen und den Import setzen:

```ts
import { CAPSULE_SPEC } from '../extensions/capsule/capsuleShape'
```

```ts
  { key: 'capsule', labelKey: 'dosage_form_capsule', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['capsule'], capabilities: ['countable', 'inventory_capable'], stageRenderer: 'capsule', stageForm: CAPSULE_SPEC },
```

`DosageFormDefinition.stageRenderer` wird zu `'vial' | 'ampoule' | 'capsule'`.

In `StackStage.tsx` den Import ergänzen und nach dem Ampullenzweig einfügen:

```tsx
  if (renderer === 'capsule') {
    return <CapsuleRenderer item={item} {...visualProps} />
  }
```

`showLabel` und `sloshEngine` werden an `CapsuleRenderer` nicht durchgereicht —
beide sind für die Kapsel bedeutungslos. Dafür destrukturiert `StackStage` sie
zusätzlich heraus:

```tsx
export function StackStage({ item, fillPct, animateOnMount, showLabel, sloshEngine, ...visualProps }: StackStageProps) {
```

und gibt sie an Vial und Ampulle wie bisher weiter.

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack`
Expected: PASS, inklusive der umgezogenen Negativprüfungen.

- [ ] **Step 7: Commit**

```bash
git add src/features/my-stack/extensions/capsule src/features/my-stack/lib/dosageForms.ts src/features/my-stack/lib/dosageForms.test.ts src/features/my-stack/components/StackStage.tsx src/features/my-stack/components/StackStage.test.ts
git commit -m "feat: route capsule items to the capsule stage"
```

---

### Task 5: Kapsel in die Vorschau

**Files:**
- Modify: `src/pages/__VialPreview.tsx`

- [ ] **Step 1: Kapseln in die gemischte Karussellzeile aufnehmen**

`MIXED_CAROUSEL` um einen `kind: 'capsule'` erweitern und drei Einträge
ergänzen, damit die flache Silhouette zwischen den stehenden Formen beurteilbar
ist:

```ts
type MixedEntry = {
  kind: 'ampoule' | 'vial' | 'capsule'
  name: string
  amount: number | null
  unit: string | null
  color: string
  fillPct?: number
}
```

```ts
  { kind: 'capsule', name: 'Vitamin D3', amount: 5000, unit: 'IU', color: '#f0b357' },
  { kind: 'capsule', name: 'Magnesiumcitrat', amount: 400, unit: 'mg', color: '#a3e635' },
  { kind: 'capsule', name: 'Omega 3 Fischoel Konzentrat', amount: 1000, unit: 'mg', color: '#38bdf8' },
```

Im Zweig der Karussellzeile:

```tsx
              ) : entry.kind === 'capsule' ? (
                <CapsuleVisual
                  name={entry.name}
                  color={entry.color}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              ) : (
```

Dazu eine eigene Detailreihe unter den Ampullen:

```tsx
      <p className="mx-auto max-w-4xl pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Kapseln — Gravur in Detailgröße
      </p>
      <div className="mx-auto flex max-w-4xl items-end justify-center gap-10 pb-2">
        {PREVIEW_CAPSULES.map(c => (
          <CapsuleVisual key={c.name} name={c.name} color={c.color} size="large" />
        ))}
      </div>
```

```ts
const PREVIEW_CAPSULES = [
  { name: 'Vitamin D3', color: '#f0b357' },
  { name: 'Magnesiumcitrat', color: '#a3e635' },
  { name: 'Omega 3 Fischoel Konzentrat hochdosiert', color: '#38bdf8' },
]
```

Der dritte Eintrag ist bewusst zu lang — an ihm ist zu sehen, ob Schrumpfen und
hartes Abschneiden greifen.

- [ ] **Step 2: Typen und Lint prüfen**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe.

Run: `npx eslint src/pages/__VialPreview.tsx src/features/my-stack/extensions/capsule`
Expected: keine Ausgabe.

- [ ] **Step 3: Commit**

```bash
git add src/pages/__VialPreview.tsx
git commit -m "feat: add capsules to the stage preview"
```

---

### Task 6: Regression, Sichtprüfung, Build und Graph

- [ ] **Step 1: Volle Suite**

Run: `npm test`
Expected: PASS. Die 24 Vial-Tests und alle Ampullen-Tests sind unverändert grün.

- [ ] **Step 2: Typen und Build**

Run: `npm run build`
Expected: `tsc -b` und Vite-Build ohne neue Fehler.

- [ ] **Step 3: Lint ohne neue Verstöße**

Run: `npx eslint src 2>&1 | tail -3`
Expected: dieselbe Problemzahl wie vor Task 1 (vorbestehende Schuld im Repo).

- [ ] **Step 4: Sichtprüfung**

Dev-Server aus dem Worktree starten und `http://localhost:5176/__vialpreview` öffnen:

1. Kapsel liegt flach auf der Bodenlinie, deutlich flacher als Vial und Ampulle.
2. Die Hülle ist durchsichtig getönt, die Naht am Kappenrand ist die einzige innere Linie — **kein Streifen quer über die Kapsel**.
3. Die Gravur ist zentriert, das Buchstabeninnere zeigt die Hülle, nicht Schatten.
4. Der lange Name ist geschrumpft oder abgeschnitten, ohne Auslassungspunkte.
5. Beim Wischen wandern Glanz und Sweep — die Kapsel selbst kippt **nicht**.
6. Kein Etikett, keine Prozentzeile.

- [ ] **Step 5: Graph aktualisieren**

Run: `graphify update .`
Diff auf fremde Pfade prüfen, dann behalten — dieses Repository versioniert `graphify-out/`.

- [ ] **Step 6: Commit**

```bash
git add graphify-out
git commit -m "chore: update knowledge graph"
```

---

## Final Acceptance Criteria

- Ein Kapsel-Eintrag wird im Karussell und in der Detailansicht als liegende Kapsel gerendert.
- Die Hülle ist durchsichtig, aus `color_hex` getönt, mit einem gemeinsamen absoluten Verlauf über Kappe und Körper.
- Genau eine sichtbare innere Linie: die Naht am Kappenrand.
- Die Gravur ist zentriert, ohne Füllton im Buchstabeninneren, und läuft nie über die nutzbare Breite hinaus.
- Die Kapsel trägt kein Etikett und keine Prozentzeile.
- Die Kapsel abonniert die Slosh-Engine nicht; ihr Quelltext enthält keinen Slosh-Bezug.
- Das Seitenverhältnis bleibt bei jeder Größe erhalten.
- `tablet` und `patch` bleiben im Textzustand.
- Die Vial- und Ampullen-Testsuiten sind unverändert und grün.
- Keine neuen i18n-Schlüssel.
- `npm test`, `npm run build` und `npx eslint src` ohne neue Fehler.
