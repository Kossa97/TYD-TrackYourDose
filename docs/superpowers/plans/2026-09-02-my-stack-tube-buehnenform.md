# Tube als sechste Bühnenform — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Tube als sechste Bühnenform rendern — eine Aluminiumtube auf schwarzem Klappdeckel, deren Erscheinung von einem Oberlicht getragen wird, das mit der Lage im Karussell kippt.

**Architecture:** Alles Neue liegt in `src/features/my-stack/extensions/tube/`. Geteilt werden nur `useStageLight` und `StageMarquee`. Kein Glas-Malstapel, keine Flüssigkeit, kein `StageLabel`, keine Slosh-Anbindung. Der Beleuchtungsteil ist neu und gehört in die Form, nicht in `stage/`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind, Inline-SVG.

**Spec:** `docs/superpowers/specs/2026-09-02-my-stack-tube-buehnenform-design.md`

---

## Global Constraints

1. **Die Suiten von Vial, Ampulle, Kapsel, Tablette und Nasenspray bleiben unverändert grün.**
2. **Das Negativbeispiel zieht erneut nicht um.** `patch` bleibt ohne Renderer; die Wache in `StackStage.test.ts` bleibt unangetastet. Wer sie anfasst, hat etwas falsch gemacht.
3. **`color_hex` wird nicht benutzt.** Die Tube ist die erste Form, die die Eintragsfarbe ignoriert. Ein Test hält das fest.
4. **Jeder gezeichnete Pfad braucht ein explizites `fill`.** Ein Pfad ohne `fill` füllt schwarz. Die Riffelstriche der Quetschnaht und die Fugenlinien sind Linien und tragen `fill="none"`.
5. **Pfade innerhalb von `<clipPath>` brauchen kein `fill`** — sie werden nie gezeichnet. Eine Prüfung auf schwarze Flächen muss sie ausschließen, sonst meldet sie Fehlalarme.
6. Testbefehl `npx vitest run <pfad>`, volle Suite `npm test`, alles aus dem Worktree `C:/Users/Devin/peptid-tracker/.worktrees/my-stack-foundation`.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `extensions/tube/tubeShape.ts` | Konturen, Deckelmaße, Namenslage samt hergeleitetem Einzug, Lichtkonstanten, `StageFormSpec`. Reine Daten. |
| `extensions/tube/tubeShape.test.ts` | Prüft die Formkonstanten gegeneinander. |
| `extensions/tube/TubeVisual.tsx` | Blech, Deckel, Beleuchtung, Aufschrift. |
| `extensions/tube/TubeVisual.test.ts` | Strukturtests. |
| `extensions/tube/TubeRenderer.tsx` | Adapter von `StackItem`. Kein `SloshProvider`. |

Geändert: `lib/dosageForms.ts`, `lib/dosageForms.test.ts`, `components/StackStage.tsx`, `components/StackStage.test.ts`, `src/pages/__VialPreview.tsx`.

---

### Task 1: Formdaten der Tube

**Files:**
- Create: `src/features/my-stack/extensions/tube/tubeShape.ts`
- Test: `src/features/my-stack/extensions/tube/tubeShape.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  TUBE_ASPECT,
  TUBE_CAP,
  TUBE_CAP_RECESS,
  TUBE_CAP_SEAM_Y,
  TUBE_CRIMP,
  TUBE_LIGHT_CORE_SHIFT,
  TUBE_LIGHT_MAX_DEG,
  TUBE_NAME_INSET_PCT,
  TUBE_NAME_TOP_PCT,
  TUBE_SPEC,
  TUBE_TAPER,
} from './tubeShape'

describe('tubeShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    expect(TUBE_SPEC.viewBox).toEqual({ x: 21, y: 6, width: 78, height: 279 })
  })

  it('leitet das Seitenverhaeltnis aus der viewBox ab', () => {
    expect(TUBE_ASPECT).toBeCloseTo(TUBE_SPEC.viewBox.width / TUBE_SPEC.viewBox.height, 6)
  })

  it('macht die Quetschnaht zur breitesten Stelle der Form', () => {
    // Kein aufgesetzter Deckel: die Naht ist der obere Abschluss desselben
    // Blechs, ihre Aussenecken sind die breitesten Punkte ueberhaupt.
    expect(TUBE_CRIMP.width).toBe(TUBE_SPEC.viewBox.width)
    expect(TUBE_CRIMP.x).toBe(TUBE_SPEC.viewBox.x)
  })

  it('verjuengt den Koerper von der Naht zum Deckel', () => {
    const oben = TUBE_TAPER.xTopRight - TUBE_TAPER.xTopLeft
    const unten = TUBE_TAPER.xBottomRight - TUBE_TAPER.xBottomLeft
    expect(unten).toBeLessThan(oben)
    expect(unten / oben).toBeGreaterThan(0.6)
  })

  it('setzt den Deckel schmaler als das Tubenende, damit eine Schulter entsteht', () => {
    expect(TUBE_CAP.width).toBeLessThan(TUBE_TAPER.xBottomRight - TUBE_TAPER.xBottomLeft)
  })

  it('laesst den Deckel flacher als breit sein', () => {
    expect(TUBE_CAP.height / TUBE_CAP.width).toBeLessThan(0.8)
  })

  it('laesst die Trennfuge durch die Daumenmulde laufen', () => {
    // Die Fuge ist die Oeffnung, die Mulde der Angriffspunkt — liegen sie
    // getrennt, wirken es zwei zusammenhanglose Details.
    const oben = TUBE_CAP_RECESS.cy - TUBE_CAP_RECESS.ry
    const unten = TUBE_CAP_RECESS.cy + TUBE_CAP_RECESS.ry
    expect(TUBE_CAP_SEAM_Y).toBeGreaterThan(oben)
    expect(TUBE_CAP_SEAM_Y).toBeLessThan(unten)
  })

  it('haelt die Mulde innerhalb des Deckels', () => {
    expect(TUBE_CAP_RECESS.cx - TUBE_CAP_RECESS.rx).toBeGreaterThan(TUBE_CAP.x)
    expect(TUBE_CAP_RECESS.cx + TUBE_CAP_RECESS.rx).toBeLessThan(TUBE_CAP.x + TUBE_CAP.width)
  })

  it('leitet den Namenseinzug aus der Verjuengung her', () => {
    // Unabhaengig nachgerechnet: auf Namenshoehe ist der Koerper schmaler als
    // die viewBox, also muss der Einzug groesser als null sein.
    const y = TUBE_SPEC.viewBox.y + TUBE_NAME_TOP_PCT * TUBE_SPEC.viewBox.height
    const t = (y - TUBE_TAPER.yTop) / (TUBE_TAPER.yBottom - TUBE_TAPER.yTop)
    const links = TUBE_TAPER.xTopLeft + (TUBE_TAPER.xBottomLeft - TUBE_TAPER.xTopLeft) * t
    expect(TUBE_NAME_INSET_PCT).toBeCloseTo((links - TUBE_SPEC.viewBox.x) / TUBE_SPEC.viewBox.width, 6)
  })

  it('braucht anders als das Nasenspray einen Einzug groesser als null', () => {
    // Dort lag der Koerper auf Etiketthoehe auf der vollen Breite, hier nicht.
    expect(TUBE_NAME_INSET_PCT).toBeGreaterThan(0.05)
    expect(TUBE_NAME_INSET_PCT).toBeLessThan(0.12)
  })

  it('haelt die Lichtdrehung in einem Bereich, der die Form nicht verdreht', () => {
    expect(TUBE_LIGHT_MAX_DEG).toBeGreaterThan(0)
    expect(TUBE_LIGHT_MAX_DEG).toBeLessThanOrEqual(45)
    expect(TUBE_LIGHT_CORE_SHIFT).toBeGreaterThan(0)
  })

  it('hat keine Kammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(TUBE_SPEC.chamber).toBeNull()
    expect(carriesLabel(TUBE_SPEC)).toBe(false)
    expect(TUBE_SPEC.hasMeaningfulFill).toBe(false)
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/tube/tubeShape.test.ts`
Expected: FAIL — `Cannot find module './tubeShape'`.

- [ ] **Step 3: Die Formdaten anlegen**

```ts
import type { StageFormSpec } from '../../stage/types'

// Gezeichnet auf einem Raster von 120 x 294 Einheiten; die viewBox ist auf die
// Objektgrenzen beschnitten, wie bei Ampulle und Nasenspray. Sie steht zuerst,
// weil Seitenverhaeltnis und Namenseinzug daraus hergeleitet werden.
export const TUBE_VIEWBOX = { x: 21, y: 6, width: 78, height: 279 } as const

// Die Quetschnaht ist die breiteste Stelle der ganzen Form. Sie hat bewusst
// keine eigene Kontur und keine gerundeten Ecken: eine gequetschte Tube ist ein
// Stück Blech, und eine Trennlinie an dieser Stelle liesse sie wie einen
// aufgesetzten Deckel wirken.
export const TUBE_CRIMP = { x: 21, y: 6, width: 78, height: 16 } as const

// Die Riffelung der Naht. Linien, keine Körper — im Markup mit fill="none".
export const TUBE_CRIMP_RIB_XS = [
  24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96,
] as const

// Die Verjüngung als Daten, damit sich Namenseinzug und Kantensäume daraus
// herleiten lassen statt geraten zu werden.
export const TUBE_TAPER = {
  yTop: 22, yBottom: 242,
  xTopLeft: 21, xTopRight: 99,
  xBottomLeft: 32.6, xBottomRight: 87.4,
} as const

// Durchgehende Silhouette: von den Nahtecken bis zum eingerundeten Ende, das
// bei y 254 hinter der Deckeloberkante (250) verschwindet — so wird ein Deckel
// wirklich über ein Tubenende geschoben.
export const TUBE_BODY_PATH = 'M21 6 L99 6 L99 22 L87.4 242 C 87.1 249 84.2 254 79 254 L41 254 C 35.8 254 32.9 249 32.6 242 L21 22 Z'

// Kantensäume auf der Silhouette. Sie gehören zur Form, nicht zur Beleuchtung,
// und sind die einzigen Teile, die der Verjüngung folgen müssen.
export const TUBE_SEAM_LEFT_PATH = 'M21 6 L26.5 6 L36 250 L32.6 250 Z'
export const TUBE_SEAM_RIGHT_PATH = 'M93.5 6 L99 6 L87.4 250 L84 250 Z'

// Kantenlicht auf der Rundung, darunter ein dunkler Bogen. Erst das Paar
// hell-über-dunkel liest sich als Kante; ein einzelner Strich wirkt aufgemalt.
export const TUBE_EDGE_LIGHT_PATH = 'M33.4 243.5 C 33.7 249.4, 36.4 251.9, 41.2 251.9 L78.8 251.9 C 83.6 251.9, 86.3 249.4, 86.6 243.5'
export const TUBE_EDGE_SHADOW_PATH = 'M33.1 245.4 C 33.4 250.6, 36.1 253.4, 41 253.4 L79 253.4 C 83.9 253.4, 86.6 250.6, 86.9 245.4'

// Schwarzer Klappdeckel, schmaler als das Tubenende — daraus entsteht am
// Übergang die Schulter.
export const TUBE_CAP = { x: 34.5, y: 250, width: 51, height: 35 } as const
export const TUBE_CAP_PATH = 'M34.5 250 L85.5 250 L85.5 278 C 85.5 282.5 82.5 285 77.5 285 L42.5 285 C 37.5 285 34.5 282.5 34.5 278 Z'

// Die Daumenmulde und die Fuge, die quer durch sie hindurchläuft: die Fuge ist
// die Öffnung, die Mulde der Angriffspunkt. Darunter die Lippe des unteren
// Teils, die Licht fängt — ohne sie liest sich die Fuge als aufgemalter Strich.
export const TUBE_CAP_RECESS = { cx: 60, cy: 266, rx: 12.5, ry: 7.5 } as const
export const TUBE_CAP_SEAM_Y = 267.6
export const TUBE_CAP_SEAM_LIP_Y = 268.5

// Mitte der Aufschrift auf 46 % der Objekthöhe.
export const TUBE_NAME_TOP_PCT = 0.46

// Der Einzug folgt der Verjüngung: auf Namenshöhe ist der Körper schmaler als
// die viewBox. Beim Nasenspray war der richtige Wert null, weil der Körper dort
// die volle Breite hatte — derselbe Fehler wäre hier nur andersherum.
const TUBE_NAME_Y = TUBE_VIEWBOX.y + TUBE_NAME_TOP_PCT * TUBE_VIEWBOX.height
const TUBE_NAME_T = (TUBE_NAME_Y - TUBE_TAPER.yTop) / (TUBE_TAPER.yBottom - TUBE_TAPER.yTop)
const TUBE_NAME_LEFT = TUBE_TAPER.xTopLeft + (TUBE_TAPER.xBottomLeft - TUBE_TAPER.xTopLeft) * TUBE_NAME_T
export const TUBE_NAME_INSET_PCT = (TUBE_NAME_LEFT - TUBE_VIEWBOX.x) / TUBE_VIEWBOX.width

// Oberlicht: die Lampe steht über der Bühne, die Tube daneben. Ihre Richtung
// kippt deshalb mit der Lage im Karussell, und der Glanzkern wandert zur
// beleuchteten Seite.
export const TUBE_LIGHT_MAX_DEG = 34
export const TUBE_LIGHT_CORE_SHIFT = 17

export const TUBE_ASPECT = TUBE_VIEWBOX.width / TUBE_VIEWBOX.height

export const TUBE_SPEC: StageFormSpec = {
  viewBox: TUBE_VIEWBOX,
  // Undurchsichtig, Paste statt Flüssigkeit: keine Kammer, damit weder
  // Etikettband noch Prozentzeile.
  chamber: null,
  hasMeaningfulFill: false,
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/tube/tubeShape.test.ts`
Expected: PASS, 12 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/extensions/tube
git commit -m "feat: add tube shape data"
```

---

### Task 2: `TubeVisual`

**Files:**
- Create: `src/features/my-stack/extensions/tube/TubeVisual.tsx`
- Test: `src/features/my-stack/extensions/tube/TubeVisual.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TubeVisual } from './TubeVisual'

const render = (props: Partial<Parameters<typeof TubeVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(TubeVisual, { name: 'Ibuprofen', ...props }))

describe('TubeVisual', () => {
  it('meldet sich als Tuben-Renderer', () => {
    expect(render()).toContain('data-tube-detail="root"')
  })

  it('zeichnet Blech, Naht, Deckel und Mulde', () => {
    const html = render()
    expect(html).toContain('data-tube-detail="body"')
    expect(html).toContain('data-tube-detail="crimp"')
    expect(html).toContain('data-tube-detail="cap"')
    expect(html).toContain('data-tube-detail="recess"')
    expect(html).toContain('data-tube-detail="cap-seam"')
  })

  it('gibt Riffelung und Fugen ein explizites fill, damit nichts schwarz fuellt', () => {
    const html = render()
    expect(html).toMatch(/data-tube-detail="crimp-ribs"[^>]*fill="none"/)
    expect(html).toMatch(/data-tube-detail="cap-seam"[^>]*fill="none"/)
  })

  it('kippt das Oberlicht mit der Lage im Karussell', () => {
    // Mittig unter der Lampe symmetrisch, seitlich schraeg.
    expect(render({ lightOffset: 0 })).toContain('rotate(0.0 0.5 0.5)')
    expect(render({ lightOffset: 1 })).toContain('rotate(-34.0 0.5 0.5)')
    expect(render({ lightOffset: -1 })).toContain('rotate(34.0 0.5 0.5)')
  })

  it('laesst den Glanzkern zur beleuchteten Seite wandern', () => {
    expect(render({ lightOffset: 0 })).toMatch(/data-tube-detail="core"[^>]*cx="60"/)
    expect(render({ lightOffset: 1 })).toMatch(/data-tube-detail="core"[^>]*cx="43"/)
    expect(render({ lightOffset: -1 })).toMatch(/data-tube-detail="core"[^>]*cx="77"/)
  })

  it('laesst die Kantensaeume beim Wischen stehen', () => {
    const source = readFileSync(new URL('./TubeVisual.tsx', import.meta.url), 'utf8')
    const saeume = source.match(/data-tube-detail="seams"[\s\S]{0,200}/)?.[0] ?? ''
    // Sie gehoeren zur Silhouette, nicht zur Beleuchtung.
    expect(saeume).not.toContain('lightOffset')
    expect(saeume).not.toContain('rotate')
  })

  it('benutzt die Eintragsfarbe nicht', () => {
    // Erste Form ohne color_hex: Aluminium hat eine feste Farbe, der Name
    // uebernimmt das Unterscheiden.
    const source = readFileSync(new URL('./TubeVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('color_hex')
    expect(source).not.toMatch(/\bcolor\b\s*[:,)]/)
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    expect(render({ size: 'large' })).toContain('h-[464px]')
    expect(render({ size: 'large' })).toContain('w-[129.7px]')
    expect(render({ size: 'carousel' })).toContain('h-[186.4px]')
    expect(render({ size: 'carousel' })).toContain('w-[52.1px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[236.8px]')
    expect(render({ size: 'carousel' })).toContain('sm:w-[66.2px]')
    expect(render({ size: 'compact' })).toContain('h-[140px]')
    expect(render({ size: 'mini' })).toContain('h-[76px]')
  })

  it('setzt die Aufschrift mit dem aus der Verjuengung hergeleiteten Einzug', () => {
    const html = render()
    expect(html).toContain('data-tube-detail="name"')
    expect(html).toContain('top:46%')
    expect(html).toContain('left:7.59%')
    expect(html).toContain('right:7.59%')
  })

  it('beschriftet weiss, wie fuer helles Metall vorgesehen', () => {
    expect(render()).toContain('font-black text-white')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Tube')
  })

  it('bekommt weder Etikettband noch Fuellstand noch Physik', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
    const source = readFileSync(new URL('./TubeVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('SloshContext')
    expect(source).not.toContain('StageLabel')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-tube-focus="0.42"')
    expect(html).toContain('data-tube-light-offset="-0.35"')
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/tube/TubeVisual.test.ts`
Expected: FAIL — `Cannot find module './TubeVisual'`.

- [ ] **Step 3: Die Komponente implementieren**

```tsx
import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  TUBE_BODY_PATH,
  TUBE_CAP,
  TUBE_CAP_PATH,
  TUBE_CAP_RECESS,
  TUBE_CAP_SEAM_LIP_Y,
  TUBE_CAP_SEAM_Y,
  TUBE_CRIMP,
  TUBE_CRIMP_RIB_XS,
  TUBE_EDGE_LIGHT_PATH,
  TUBE_EDGE_SHADOW_PATH,
  TUBE_LIGHT_CORE_SHIFT,
  TUBE_LIGHT_MAX_DEG,
  TUBE_NAME_INSET_PCT,
  TUBE_NAME_TOP_PCT,
  TUBE_SEAM_LEFT_PATH,
  TUBE_SEAM_RIGHT_PATH,
} from './tubeShape'

export interface TubeVisualProps {
  name?: string | null
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0)
const clampOffset = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0)

// Dieselbe Sprosse wie das Nasenspray. Die Breite folgt dem eigenen
// Verhaeltnis 78/279, damit die Form nie in einen fremden Kasten gequetscht
// wird. Als Klassen, weil ein Breakpoint nicht in einem Inline-Style lebt.
const SIZE_CLASS: Record<NonNullable<TubeVisualProps['size']>, string> = {
  large: 'h-[464px] w-[129.7px]',
  carousel: 'h-[186.4px] w-[52.1px] sm:h-[236.8px] sm:w-[66.2px]',
  compact: 'h-[140px] w-[39.1px]',
  mini: 'h-[76px] w-[21.2px]',
}

const NAME_CLASS: Record<NonNullable<TubeVisualProps['size']>, string> = {
  large: 'text-base leading-tight',
  carousel: 'text-[7.5px] sm:text-[9px] leading-tight',
  compact: 'text-[6px] leading-tight',
  mini: 'text-[4px] leading-tight',
}

const lightAngle = (o: number) => -o * TUBE_LIGHT_MAX_DEG
const coreX = (o: number) => 60 - o * TUBE_LIGHT_CORE_SHIFT

export function TubeVisual({
  name,
  size = 'large',
  className = '',
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: TubeVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const tubeName = name?.trim() || 'Tube'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const lightRef = useRef<SVGLinearGradientElement | null>(null)
  const coreRef = useRef<SVGEllipseElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-tube-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-tube-light-offset', o.toFixed(2))
    // Die Lampe steht ueber der Buehne: steht die Tube links davon, faellt das
    // Licht von rechts oben ein, und umgekehrt.
    lightRef.current?.setAttribute('gradientTransform', `rotate(${lightAngle(o).toFixed(1)} 0.5 0.5)`)
    coreRef.current?.setAttribute('cx', coreX(o).toFixed(0))
    coreRef.current?.setAttribute('opacity', (0.18 + f * 0.5).toFixed(3))
    shadowRef.current?.setAttribute('cx', (60 - o * 5).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.3).toFixed(3))
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-tube-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-tube-focus={Number(visualFocus.toFixed(2))}
      data-tube-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={tubeName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="21 6 78 279"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`${uid}-bodyClip`}>
            <path d={TUBE_BODY_PATH} />
          </clipPath>
          {/* Grundton des Aluminiums, ohne Beleuchtung. */}
          <linearGradient id={`${uid}-alu`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b4149" />
            <stop offset="12%" stopColor="#7e858e" />
            <stop offset="50%" stopColor="#8f959e" />
            <stop offset="88%" stopColor="#7a818a" />
            <stop offset="100%" stopColor="#353b42" />
          </linearGradient>
          {/* Oberlicht: hell an der Schulter, Abfall zum Deckel. Der
              gradientTransform kippt die Richtung mit der Lage. */}
          <linearGradient
            ref={lightRef}
            id={`${uid}-light`}
            x1="0.5" y1="0" x2="0.5" y2="1"
            gradientTransform={`rotate(${lightAngle(visualLightOffset).toFixed(1)} 0.5 0.5)`}
          >
            <stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
            <stop offset="9%" stopColor="rgba(255,255,255,0.52)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="34%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="48%" stopColor="rgba(0,0,0,0.10)" />
            <stop offset="63%" stopColor="rgba(255,255,255,0.07)" />
            <stop offset="78%" stopColor="rgba(0,0,0,0.22)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.40)" />
          </linearGradient>
          <radialGradient id={`${uid}-core`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.28)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id={`${uid}-seamL`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-seamR`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.44)" />
          </linearGradient>
          <linearGradient id={`${uid}-throat`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0)" />
            <stop offset="52%" stopColor="rgba(0,0,0,0.18)" />
            <stop offset="86%" stopColor="rgba(0,0,0,0.40)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.54)" />
          </linearGradient>
          <linearGradient id={`${uid}-edge`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="40%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="62%" stopColor="rgba(255,255,255,0.60)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-capBody`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a0d12" />
            <stop offset="20%" stopColor="#333944" />
            <stop offset="46%" stopColor="#20252d" />
            <stop offset="72%" stopColor="#2c323b" />
            <stop offset="100%" stopColor="#080a0e" />
          </linearGradient>
          <linearGradient id={`${uid}-capTop`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-recess`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.72)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.34)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.16)" />
          </linearGradient>
          <radialGradient id={`${uid}-groundShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={`${uid}-soft`}><feGaussianBlur stdDeviation="0.55" /></filter>
          <filter id={`${uid}-seamSoft`}><feGaussianBlur stdDeviation="0.9" /></filter>
          <filter id={`${uid}-coreSoft`}><feGaussianBlur stdDeviation="3.4" /></filter>
        </defs>

        <ellipse
          ref={shadowRef}
          data-tube-detail="ground-shadow"
          cx={60 - visualLightOffset * 5}
          cy="288"
          rx="30"
          ry="4.5"
          fill={`url(#${uid}-groundShadow)`}
          opacity={0.2 + visualFocus * 0.3}
        />

        <path data-tube-detail="body" d={TUBE_BODY_PATH} fill={`url(#${uid}-alu)`} />
        <path data-tube-detail="light" d={TUBE_BODY_PATH} fill={`url(#${uid}-light)`} />

        <g clipPath={`url(#${uid}-bodyClip)`}>
          <ellipse
            ref={coreRef}
            data-tube-detail="core"
            cx={Number(coreX(visualLightOffset).toFixed(0))}
            cy="64"
            rx="21"
            ry="46"
            fill={`url(#${uid}-core)`}
            opacity={0.18 + visualFocus * 0.5}
            filter={`url(#${uid}-coreSoft)`}
          />
        </g>

        {/* Die Saeume gehoeren zur Silhouette, nicht zur Beleuchtung: sie
            bleiben beim Wischen stehen und folgen als einzige der Verjuengung. */}
        <g data-tube-detail="seams" clipPath={`url(#${uid}-bodyClip)`}>
          <path d={TUBE_SEAM_LEFT_PATH} fill={`url(#${uid}-seamL)`} filter={`url(#${uid}-seamSoft)`} />
          <path d={TUBE_SEAM_RIGHT_PATH} fill={`url(#${uid}-seamR)`} filter={`url(#${uid}-seamSoft)`} />
        </g>

        {/* Riffelung der Naht. Linien — deshalb fill="none". */}
        <g
          data-tube-detail="crimp-ribs"
          fill="none"
          stroke="rgba(70,76,85,0.42)"
          strokeWidth="0.7"
        >
          {TUBE_CRIMP_RIB_XS.map(x => (
            <path key={x} d={`M${x} ${TUBE_CRIMP.y + 1.5} L${x} ${TUBE_CRIMP.y + TUBE_CRIMP.height - 1}`} />
          ))}
        </g>
        <path
          data-tube-detail="crimp"
          d={`M${TUBE_CRIMP.x} ${TUBE_CRIMP.y + TUBE_CRIMP.height} L${TUBE_CRIMP.x + TUBE_CRIMP.width} ${TUBE_CRIMP.y + TUBE_CRIMP.height}`}
          fill="none"
          stroke="rgba(60,66,74,0.5)"
          strokeWidth="0.8"
        />

        {/* Kehlschatten, dann Kantenlicht mit dunklem Bogen darunter. */}
        <g clipPath={`url(#${uid}-bodyClip)`}>
          <rect x="20" y="220" width="80" height="36" fill={`url(#${uid}-throat)`} />
          <path
            data-tube-detail="edge-light"
            d={TUBE_EDGE_LIGHT_PATH}
            fill="none"
            stroke={`url(#${uid}-edge)`}
            strokeWidth="1.7"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
          <path
            d={TUBE_EDGE_SHADOW_PATH}
            fill="none"
            stroke="rgba(0,0,0,0.42)"
            strokeWidth="1.3"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
        </g>

        <path
          data-tube-detail="cap"
          d={TUBE_CAP_PATH}
          fill={`url(#${uid}-capBody)`}
          stroke="rgba(120,130,145,0.22)"
          strokeWidth="0.8"
        />
        <ellipse
          data-tube-detail="recess"
          cx={TUBE_CAP_RECESS.cx}
          cy={TUBE_CAP_RECESS.cy}
          rx={TUBE_CAP_RECESS.rx}
          ry={TUBE_CAP_RECESS.ry}
          fill={`url(#${uid}-recess)`}
        />
        <ellipse
          cx={TUBE_CAP_RECESS.cx}
          cy={TUBE_CAP_RECESS.cy}
          rx={TUBE_CAP_RECESS.rx}
          ry={TUBE_CAP_RECESS.ry}
          fill="none"
          stroke="rgba(0,0,0,0.45)"
          strokeWidth="0.7"
        />
        {/* Die Fuge laeuft quer durch die Mulde: sie ist die Oeffnung, die
            Mulde der Angriffspunkt. */}
        <path
          data-tube-detail="cap-seam"
          d={`M${TUBE_CAP.x + 0.4} ${TUBE_CAP_SEAM_Y} L${TUBE_CAP.x + TUBE_CAP.width - 0.4} ${TUBE_CAP_SEAM_Y}`}
          fill="none"
          stroke="rgba(150,160,175,0.38)"
          strokeWidth="0.6"
        />
        <path
          d={`M${TUBE_CAP.x + 0.4} ${TUBE_CAP_SEAM_LIP_Y} L${TUBE_CAP.x + TUBE_CAP.width - 0.4} ${TUBE_CAP_SEAM_LIP_Y}`}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="0.5"
        />
        {/* Kontaktschatten: ohne ihn floessen Deckel und Tubenende ineinander. */}
        <path
          d={`M${TUBE_CAP.x} ${TUBE_CAP.y} L${TUBE_CAP.x + TUBE_CAP.width} ${TUBE_CAP.y} L${TUBE_CAP.x + TUBE_CAP.width} ${TUBE_CAP.y + 9} L${TUBE_CAP.x} ${TUBE_CAP.y + 9} Z`}
          fill={`url(#${uid}-capTop)`}
        />
      </svg>

      {/* Weiss aufgedruckt. Der Einzug folgt der Verjuengung — hier ist der
          Koerper auf Namenshoehe schmaler als die viewBox. */}
      <div
        data-tube-detail="name"
        className="pointer-events-none absolute -translate-y-1/2 overflow-hidden text-center"
        style={{
          top: `${TUBE_NAME_TOP_PCT * 100}%`,
          left: `${(TUBE_NAME_INSET_PCT * 100).toFixed(2)}%`,
          right: `${(TUBE_NAME_INSET_PCT * 100).toFixed(2)}%`,
        }}
      >
        <StageMarquee className={`${NAME_CLASS[size]} font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]`}>
          {tubeName}
        </StageMarquee>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/tube`
Expected: PASS.

- [ ] **Step 5: Typen und Lint**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe.

Run: `npx eslint src/features/my-stack/extensions/tube`
Expected: keine Ausgabe.

- [ ] **Step 6: Commit**

```bash
git add src/features/my-stack/extensions/tube
git commit -m "feat: render the tube stage form"
```

---

### Task 3: Adapter, Weiche und Freischaltung

**Files:**
- Create: `src/features/my-stack/extensions/tube/TubeRenderer.tsx`
- Modify: `src/features/my-stack/lib/dosageForms.ts`
- Modify: `src/features/my-stack/lib/dosageForms.test.ts`
- Modify: `src/features/my-stack/components/StackStage.tsx`
- Modify: `src/features/my-stack/components/StackStage.test.ts`

- [ ] **Step 1: Die Erwartungen in `dosageForms.test.ts` heben**

Ersetze die beiden bestehenden Zusicherungen:

```ts
  it('aktiviert genau die Formen mit fertiger Bühnengrafik', () => {
    expect(DOSAGE_FORMS.filter(form => form.stageRenderer).map(form => form.key)).toEqual(['vial', 'ampoule', 'tablet', 'capsule', 'nasal_spray', 'tube'])
  })
```

```ts
  it('erkennt die sechs fertigen Formen als darstellbar, den Rest noch nicht', () => {
    expect(isStageRenderable('vial')).toBe(true)
    expect(isStageRenderable('ampoule')).toBe(true)
    expect(isStageRenderable('tablet')).toBe(true)
    expect(isStageRenderable('capsule')).toBe(true)
    expect(isStageRenderable('nasal_spray')).toBe(true)
    expect(isStageRenderable('tube')).toBe(true)
    expect(isStageRenderable('gel')).toBe(false)
    expect(isStageRenderable('spray')).toBe(false)
    expect(isStageRenderable('patch')).toBe(false)
    expect(isStageRenderable('powder')).toBe(false)
  })
```

In `DOSAGE_FORMS` steht `tube` nach `patch`, die Liste endet also auf `'tube'`.

- [ ] **Step 2: Den neuen Test in `StackStage.test.ts` ergänzen**

Ans Ende der Datei:

```ts
const tubeItem: StackItem = {
  ...vialItem,
  id: 'diclofenac-tube',
  display_name: 'Diclofenac',
  category: 'medication',
  dosage_form: 'tube',
  color_hex: '#f97316',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Diclofenac',
    amount_value: 10,
    amount_unit: 'mg',
    basis_unit: 'g',
  }],
}

describe('StackStage — Tube', () => {
  it('rendert die Tube für Tuben-Einträge', () => {
    expect(renderStage(tubeItem)).toContain('data-stack-renderer="tube"')
  })

  it('zeigt Naht, Deckel und Namen, aber kein Etikettband', () => {
    const html = renderStage(tubeItem)

    expect(html).toContain('data-tube-detail="crimp"')
    expect(html).toContain('data-tube-detail="cap"')
    expect(html).toContain('Diclofenac')
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
  })

  it('reicht dem Adapter weder Farbe noch Füllstand noch Physik durch', () => {
    const source = readFileSync(new URL('../extensions/tube/TubeRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('TubeVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('SloshProvider')
    expect(source).not.toContain('fillPct')
    expect(source).not.toContain('color_hex')
  })

  it('lässt den gel-Schlüssel im Textzustand', () => {
    // gel benennt einen Stoff, tube einen Behälter — ein Gel als Alutube zu
    // zeichnen behauptet eine Verpackung, die die Daten nicht hergeben.
    const gelItem: StackItem = { ...tubeItem, id: 'voltaren-gel', dosage_form: 'gel' }
    expect(renderStage(gelItem)).toContain('data-stack-renderer="unsupported"')
  })
})
```

- [ ] **Step 3: Tests laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/components/StackStage.test.ts src/features/my-stack/lib/dosageForms.test.ts`
Expected: FAIL — `data-stack-renderer="unsupported"` statt `"tube"`, und `TubeRenderer.tsx` fehlt.

- [ ] **Step 4: Den Adapter anlegen**

```tsx
import type { Ref } from 'react'
import { TubeVisual } from './TubeVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface TubeRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: die Tube enthält Paste und steht auf einer flachen
// Standfläche. Und keine Farbe: Aluminium hat eine feste, der Name übernimmt
// das Unterscheiden.
export function TubeRenderer({ item, ...visualProps }: TubeRendererProps) {
  return (
    <div data-stack-renderer="tube">
      <TubeVisual name={item.display_name} {...visualProps} />
    </div>
  )
}
```

- [ ] **Step 5: Form freischalten und Weiche erweitern**

In `dosageForms.ts` den Import ergänzen:

```ts
import { TUBE_SPEC } from '../extensions/tube/tubeShape'
```

`DosageFormDefinition.stageRenderer` wird zu
`'vial' | 'ampoule' | 'capsule' | 'tablet' | 'nasal_spray' | 'tube'`, und der
Tuben-Eintrag erhält:

```ts
  { key: 'tube', labelKey: 'dosage_form_tube', suggestedUnits: ['mg', 'g', 'ml'], basisUnits: ['g', 'ml', 'application'], capabilities: ['inventory_capable'], stageRenderer: 'tube', stageForm: TUBE_SPEC },
```

In `StackStage.tsx` den Import ergänzen:

```tsx
import { TubeRenderer } from '../extensions/tube/TubeRenderer'
```

und nach dem Nasenspray-Zweig einfügen:

```tsx
  if (renderer === 'tube') {
    return <TubeRenderer item={item} {...visualProps} />
  }
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack`
Expected: PASS. Die Wache auf `patch` bleibt grün und wird nicht angefasst.

- [ ] **Step 7: Commit**

```bash
git add src/features/my-stack
git commit -m "feat: route tube items to the tube stage"
```

---

### Task 4: Tube in die Vorschau

**Files:**
- Modify: `src/pages/__VialPreview.tsx`

- [ ] **Step 1: Tuben aufnehmen**

Import ergänzen:

```ts
import { TubeVisual } from '../features/my-stack/extensions/tube/TubeVisual'
```

Eine eigene Detailreihe unter den Nasensprays:

```ts
const PREVIEW_TUBES = [
  { name: 'Diclofenac' },
  { name: 'Testogel' },
  // bewusst zu lang: zeigt den Durchlauf auf dem verjuengten Koerper
  { name: 'Hydrocortison Acetat 1%' },
]
```

```tsx
      <p className="mx-auto max-w-4xl pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Tuben — Oberlicht in Detailgröße
      </p>
      <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-center gap-10 pb-2">
        {PREVIEW_TUBES.map((t, i) => (
          <TubeVisual key={t.name} name={t.name} size="large" lightOffset={i - 1} />
        ))}
      </div>
```

Die drei bekommen `lightOffset` −1, 0 und +1, damit die Detailreihe zeigt, wie
das Oberlicht mit der Lage kippt.

`MixedEntry` um `'tube'` erweitern und drei Einträge ans Ende von
`MIXED_CAROUSEL` setzen:

```ts
  { kind: 'tube', name: 'Diclofenac', amount: null, unit: null, color: '#f97316' },
  { kind: 'tube', name: 'Testogel', amount: null, unit: null, color: '#a3e635' },
  { kind: 'tube', name: 'Hydrocortison Acetat 1%', amount: null, unit: null, color: '#38bdf8' },
```

Die `color`-Werte bleiben Teil des Eintragstyps, werden von der Tube aber nicht
benutzt — genau das ist im Karussell zu sehen: drei verschieden gefärbte
Einträge, drei identisch aussehende Tuben.

Im Karussellzweig vor dem Nasenspray-Zweig:

```tsx
              {entry.kind === 'tube' ? (
                <TubeVisual
                  name={entry.name}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              ) : entry.kind === 'nasal_spray' ? (
```

- [ ] **Step 2: Typen und Lint prüfen**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe.

Run: `npx eslint src/pages/__VialPreview.tsx`
Expected: keine Ausgabe.

- [ ] **Step 3: Commit**

```bash
git add src/pages/__VialPreview.tsx
git commit -m "feat: add tubes to the stage preview"
```

---

### Task 5: Regression, Sichtprüfung, Build und Graph

- [ ] **Step 1: Volle Suite**

Run: `npm test`
Expected: PASS. Die fünf bestehenden Formsuiten sind unverändert grün, die Wache auf `patch` ebenfalls.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `tsc -b` und Vite-Build ohne neue Fehler.

- [ ] **Step 3: Lint ohne neue Verstöße**

Run: `npx eslint src/features/my-stack 2>&1 | grep problems`
Expected: dieselbe Problemzahl wie vor Task 1 (zuletzt 23).

- [ ] **Step 4: Sichtprüfung im Browser**

`http://localhost:5176/__vialpreview` öffnen und prüfen:

1. Die Quetschnaht ist die breiteste Stelle; **keine Trennlinie** zwischen Naht und Körper, sie darf nicht wie ein aufgesetzter Deckel wirken.
2. Der Deckel sitzt schmaler als das Tubenende, die Schulter ist sichtbar.
3. Die Trennfuge läuft **durch** die Daumenmulde, über die volle Deckelbreite.
4. Am Übergang: Kantenlicht auf der Rundung, Kehlschatten darüber, Kontaktschatten auf der Deckeloberkante.
5. In der Detailreihe kippt das Licht sichtbar von links über symmetrisch nach rechts (die drei haben `lightOffset` −1 / 0 / +1).
6. Beim Wischen im Karussell wandert das Licht; die **Kantensäume bleiben stehen**.
7. Der Name ist weiß, mittig auf 46 % der Höhe, und läuft bei „Hydrocortison Acetat 1%" durch.
8. Kein Etikettband, keine Prozentzeile.
9. Die drei Karussell-Tuben sehen trotz verschiedener `color`-Werte identisch aus.

Die Maße im DOM gegenprüfen:

```js
const r = document.querySelector('[data-tube-detail="root"]').getBoundingClientRect()
;({ w: r.width, h: r.height, ratio: +(r.width / r.height).toFixed(4) })
```

Erwartet im Karussell: Verhältnis **0,2796**, Höhe 186,4 px (bzw. 236,8 px ab `sm`),
gleiche Unterkante wie alle fünf anderen Formen.

Und die Beleuchtung gegenprüfen, während gewischt wird:

```js
const t = document.querySelector('[data-tube-detail="root"]')
const g = t.querySelector('linearGradient[gradientTransform]')
const c = t.querySelector('[data-tube-detail="core"]')
;({ winkel: g.getAttribute('gradientTransform'), kern: c.getAttribute('cx') })
```

Erwartet: der Winkel läuft zwischen `rotate(34.0 0.5 0.5)` und `rotate(-34.0 0.5 0.5)`,
`cx` zwischen 77 und 43.

- [ ] **Step 5: Graph aktualisieren und committen**

```bash
graphify update .
git add graphify-out
git commit -m "chore: update knowledge graph"
```

---

## Final Acceptance Criteria

- Ein Tuben-Eintrag wird im Karussell und in der Detailansicht als Aluminiumtube auf schwarzem Klappdeckel gerendert.
- Die Quetschnaht ist die breiteste Stelle und hat keine eigene Kontur.
- Der Deckel sitzt schmaler als das Tubenende; die Trennfuge läuft durch die Daumenmulde.
- Am Übergang wirken Rundung, Kehlschatten, Kantenlicht und Kontaktschatten zusammen.
- Das Oberlicht kippt mit `lightOffset` um bis zu 34 Grad, der Glanzkern wandert um bis zu 17 Einheiten; die Kantensäume bleiben stehen.
- Die Aufschrift ist weiß, sitzt auf 46 % der Höhe und trägt den aus der Verjüngung hergeleiteten Einzug von 7,59 %.
- **`color_hex` wird nirgends benutzt**, weder in `TubeVisual` noch im Adapter.
- Kein Etikettband, keine Prozentzeile, keine Slosh-Anbindung.
- Seitenverhältnis 0,2796 auf jeder Stufe; Karussellhöhe 186,4 px, ab `sm` 236,8 px.
- `gel`, `spray`, `patch` und `powder` bleiben im Textzustand.
- Die Wache auf `patch` in `StackStage.test.ts` bleibt unverändert und grün.
- Die Suiten der fünf bestehenden Formen sind unverändert und grün.
- Keine neuen i18n-Schlüssel.
- `npm test`, `npm run build` und `npx eslint src` ohne neue Fehler.
