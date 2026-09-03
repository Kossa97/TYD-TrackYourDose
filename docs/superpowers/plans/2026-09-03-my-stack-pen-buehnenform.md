# Pen als siebte Bühnenform — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Den Injektionspen als siebte Bühnenform rendern — aufrecht, Kappe oben, mit Dosisfenster, Farbring und längs laufender Beschriftung.

**Architecture:** Alles Neue liegt in `src/features/my-stack/extensions/pen/`. Geteilt werden nur `useStageLight` und `StageMarquee` — letzterer in einer um 90 Grad gedrehten Hülle, damit der Baustein selbst unangetastet bleibt. Kein Glas-Malstapel, keine Flüssigkeit, kein `StageLabel`, keine Slosh-Anbindung.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind, Inline-SVG.

**Spec:** `docs/superpowers/specs/2026-09-03-my-stack-pen-buehnenform-design.md`

---

## Global Constraints

1. **Die Suiten von Vial, Ampulle, Kapsel, Tablette, Nasenspray und Tube bleiben unverändert grün.**
2. **`pen` landet in der Renderer-Liste an dritter Stelle, nicht am Ende.** In `DOSAGE_FORMS` steht er direkt nach `ampoule`. Bei den fünf vorherigen Formen wuchs die Liste hinten; ein Fehlschlag sieht hier nach einer Reihenfolgeänderung aus, ist aber ein Zuwachs in der Mitte.
3. **Das Negativbeispiel zieht nicht um.** `patch` bleibt ohne Renderer; die Wache in `StackStage.test.ts` bleibt unangetastet.
4. **Jedes bewegliche Licht liegt in einem Clip.** Der Pen ist die schmalste Form und damit die anfälligste für den Fehler, den der Tabletten-Glanz hatte. Ein Test hält es fest.
5. **Text als HTML, nie als SVG-Text** — Name und die 0 im Dosisfenster. Die Kapselgravur wurde erst lesbar, als sie von SVG auf HTML umgestellt wurde: HTML bekommt Hinting und Subpixel-Glättung.
6. **Jeder gezeichnete Pfad braucht ein explizites `fill`.** Riffelung und Linien tragen `fill="none"`.
7. Testbefehl `npx vitest run <pfad>`, volle Suite `npm test`, alles aus dem Worktree `C:/Users/Devin/peptid-tracker/.worktrees/my-stack-foundation`.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `extensions/pen/penShape.ts` | Konturen, Fenster-, Ring- und Knopfmaße, hergeleitete Prozentwerte für die gedrehte Hülle, `StageFormSpec`. Reine Daten. |
| `extensions/pen/penShape.test.ts` | Prüft die Formkonstanten und die Umrechnung der gedrehten Hülle. |
| `extensions/pen/PenVisual.tsx` | Kappe, Körper, Ring, Dosisfenster, Knopf, Beleuchtung, gedrehte Beschriftung. |
| `extensions/pen/PenVisual.test.ts` | Strukturtests. |
| `extensions/pen/PenRenderer.tsx` | Adapter von `StackItem`. Kein `SloshProvider`. |

Geändert: `lib/dosageForms.ts`, `lib/dosageForms.test.ts`, `components/StackStage.tsx`, `components/StackStage.test.ts`, `src/pages/__VialPreview.tsx`.

---

### Task 1: Formdaten des Pens

**Files:**
- Create: `src/features/my-stack/extensions/pen/penShape.ts`
- Test: `src/features/my-stack/extensions/pen/penShape.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  PEN_ASPECT,
  PEN_BODY,
  PEN_DOSE_TEXT,
  PEN_DOSE_WINDOW,
  PEN_DOSE_WINDOW_PCT,
  PEN_KNOB,
  PEN_NAME_BAND_PCT,
  PEN_NAME_RUN_PCT,
  PEN_NAME_TOP_PCT,
  PEN_RING,
  PEN_SPEC,
  PEN_VIEWBOX,
} from './penShape'

describe('penShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    expect(PEN_SPEC.viewBox).toEqual({ x: 0.5, y: 6, width: 39, height: 300 })
  })

  it('trifft die echten Proportionen eines Pens', () => {
    // 20 x 155 mm ergibt 0,129; die gezeichnete Form 39 : 300 = 0,130.
    expect(PEN_ASPECT).toBeCloseTo(PEN_VIEWBOX.width / PEN_VIEWBOX.height, 6)
    expect(PEN_ASPECT).toBeCloseTo(20 / 155, 2)
  })

  it('macht den Dosierknopf zur breitesten Stelle', () => {
    // Nicht der Koerper: der Knopf bestimmt Umriss und Seitenverhaeltnis.
    expect(PEN_KNOB.width).toBe(PEN_VIEWBOX.width)
    expect(PEN_KNOB.width).toBeGreaterThan(PEN_BODY.width)
  })

  it('setzt den Farbring an den oberen Rand des Koerpers', () => {
    expect(PEN_RING.y).toBe(PEN_BODY.y)
    expect(PEN_RING.width).toBe(PEN_BODY.width)
    expect(PEN_RING.height).toBeLessThan(PEN_BODY.height / 8)
  })

  it('legt das Dosisfenster in den Koerper, nicht in den Knopf', () => {
    expect(PEN_DOSE_WINDOW.y).toBeGreaterThan(PEN_BODY.y)
    expect(PEN_DOSE_WINDOW.y + PEN_DOSE_WINDOW.height).toBeLessThan(PEN_KNOB.y)
    expect(PEN_DOSE_WINDOW.x).toBeGreaterThan(PEN_BODY.x)
    expect(PEN_DOSE_WINDOW.x + PEN_DOSE_WINDOW.width).toBeLessThan(PEN_BODY.x + PEN_BODY.width)
  })

  it('zeigt im Dosisfenster den Ruhezustand, keine erfundene Dosis', () => {
    expect(PEN_DOSE_TEXT).toBe('0')
  })

  it('rechnet das Dosisfenster in Prozent der viewBox um', () => {
    expect(PEN_DOSE_WINDOW_PCT.left).toBeCloseTo((PEN_DOSE_WINDOW.x - PEN_VIEWBOX.x) / PEN_VIEWBOX.width, 6)
    expect(PEN_DOSE_WINDOW_PCT.top).toBeCloseTo((PEN_DOSE_WINDOW.y - PEN_VIEWBOX.y) / PEN_VIEWBOX.height, 6)
  })

  it('setzt den Namen mittig zwischen Kappe und Knopf', () => {
    const mitte = PEN_BODY.y + PEN_BODY.height / 2
    expect(PEN_NAME_TOP_PCT).toBeCloseTo((mitte - PEN_VIEWBOX.y) / PEN_VIEWBOX.height, 6)
  })

  it('rechnet die gedrehte Huelle auf die jeweils passende Achse um', () => {
    // Die Huelle wird um 90 Grad gedreht: ihre Breite ist die Laufstrecke am
    // Koerper (eine Hoehe), ihre Hoehe die Koerperbreite (eine Breite). In CSS
    // loesen Prozente aber immer gegen die eigene Achse auf. Weil das
    // Seitenverhaeltnis fest ist, laesst sich das ineinander umrechnen — genau
    // das prueft dieser Test, indem er zurueckrechnet.
    expect(PEN_NAME_RUN_PCT * PEN_ASPECT).toBeCloseTo(PEN_BODY.height / PEN_VIEWBOX.height, 6)
    expect(PEN_NAME_BAND_PCT / PEN_ASPECT).toBeCloseTo(PEN_BODY.width / PEN_VIEWBOX.width, 6)
  })

  it('gibt dem Namen laengs mehr Platz als jeder anderen Form quer', () => {
    // Laengs rund 121,6 px bei Karussellgroesse, quer waeren es 28.
    const laufstreckePx = (PEN_BODY.height / PEN_VIEWBOX.height) * 236.8
    expect(laufstreckePx).toBeGreaterThan(100)
  })

  it('hat keine Kammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(PEN_SPEC.chamber).toBeNull()
    expect(carriesLabel(PEN_SPEC)).toBe(false)
    expect(PEN_SPEC.hasMeaningfulFill).toBe(false)
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/pen/penShape.test.ts`
Expected: FAIL — `Cannot find module './penShape'`.

- [ ] **Step 3: Die Formdaten anlegen**

```ts
import type { StageFormSpec } from '../../stage/types'

// Gezeichnet auf einem Raster von 40 x 310 Einheiten; die viewBox ist auf die
// Objektgrenzen beschnitten. Sie steht zuerst, weil alle Prozentwerte darunter
// daraus hergeleitet werden.
export const PEN_VIEWBOX = { x: 0.5, y: 6, width: 39, height: 300 } as const

export const PEN_ASPECT = PEN_VIEWBOX.width / PEN_VIEWBOX.height

// Nadelkappe mit Clip. Sie schliesst oben ab und ist schmaler als der Koerper.
export const PEN_CAP_PATH = 'M6.5 12 C 6.5 6 33.5 6 33.5 12 L33.5 96 L6.5 96 Z'
export const PEN_CLIP_PATH = 'M29 16 L29 46 C 29 50 25.5 50 25.5 46 L25.5 20 Z'

// Gehäusekörper. Er trägt Ring, Dosisfenster und die längs laufende Schrift.
export const PEN_BODY = { x: 4, y: 96, width: 32, height: 154 } as const

// Der Farbring sitzt direkt unter der Kappe und ist die einzige Stelle, an der
// color_hex sichtbar wird — echte Pens sind farbkodiert.
export const PEN_RING = { x: 4, y: 96, width: 32, height: 10 } as const

// Dosisfenster. Die 0 ist der wahrheitsgemäße Ruhezustand eines nicht
// eingestellten Pens; die App kennt die eingestellte Dosis nicht.
export const PEN_DOSE_WINDOW = { x: 13, y: 196, width: 14, height: 17, rx: 2 } as const
export const PEN_DOSE_TEXT = '0'

// Der Dosierknopf ist die breiteste Stelle der ganzen Form und bestimmt damit
// den Umriss — nicht der Körper.
export const PEN_KNOB = { x: 0.5, y: 250, width: 39, height: 56, rx: 7 } as const
export const PEN_KNOB_RIB_XS = [8, 15, 22, 29] as const

// Mitte des Namens zwischen Kappenunterkante und Knopfoberkante.
export const PEN_NAME_TOP_PCT = (PEN_BODY.y + PEN_BODY.height / 2 - PEN_VIEWBOX.y) / PEN_VIEWBOX.height

// Die um 90 Grad gedrehte Hülle: vor der Drehung ist ihre Breite die
// Laufstrecke am Körper (also eine Höhe) und ihre Höhe die Körperbreite (also
// eine Breite). CSS löst Prozente immer gegen die eigene Achse auf, deshalb
// wird hier über das feste Seitenverhältnis umgerechnet.
export const PEN_NAME_RUN_PCT = (PEN_BODY.height / PEN_VIEWBOX.height) / PEN_ASPECT
export const PEN_NAME_BAND_PCT = (PEN_BODY.width / PEN_VIEWBOX.width) * PEN_ASPECT

// Das Dosisfenster wird von HTML überlagert, deshalb auch in Prozent.
export const PEN_DOSE_WINDOW_PCT = {
  left: (PEN_DOSE_WINDOW.x - PEN_VIEWBOX.x) / PEN_VIEWBOX.width,
  top: (PEN_DOSE_WINDOW.y - PEN_VIEWBOX.y) / PEN_VIEWBOX.height,
  width: PEN_DOSE_WINDOW.width / PEN_VIEWBOX.width,
  height: PEN_DOSE_WINDOW.height / PEN_VIEWBOX.height,
} as const

// Wie weit das Glanzband beim Wischen wandert.
export const PEN_SWEEP_SHIFT = 14

export const PEN_SPEC: StageFormSpec = {
  viewBox: PEN_VIEWBOX,
  // Kein Kartuschenfenster, keine sichtbare Flüssigkeit: damit weder
  // Etikettband noch Prozentzeile noch Schwappen.
  chamber: null,
  hasMeaningfulFill: false,
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/pen/penShape.test.ts`
Expected: PASS, 11 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/extensions/pen
git commit -m "feat: add pen shape data"
```

---

### Task 2: `PenVisual`

**Files:**
- Create: `src/features/my-stack/extensions/pen/PenVisual.tsx`
- Test: `src/features/my-stack/extensions/pen/PenVisual.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PenVisual } from './PenVisual'

const render = (props: Partial<Parameters<typeof PenVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(PenVisual, { name: 'Semaglutid', color: '#3f7fbf', ...props }))

describe('PenVisual', () => {
  it('meldet sich als Pen-Renderer', () => {
    expect(render()).toContain('data-pen-detail="root"')
  })

  it('zeichnet Kappe, Koerper, Ring, Dosisfenster und Knopf', () => {
    const html = render()
    expect(html).toContain('data-pen-detail="cap"')
    expect(html).toContain('data-pen-detail="body"')
    expect(html).toContain('data-pen-detail="ring"')
    expect(html).toContain('data-pen-detail="dose-window"')
    expect(html).toContain('data-pen-detail="knob"')
  })

  it('zeigt kein Kartuschenfenster und keine Fluessigkeit', () => {
    const source = readFileSync(new URL('./PenVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('LiquidGraphic')
    expect(source).not.toContain('SloshContext')
    expect(render()).not.toContain('data-pen-detail="cartridge"')
  })

  it('faerbt nur den Ring mit der Eintragsfarbe', () => {
    // Das Gehaeuse bleibt neutral; die Farbe erscheint ausschliesslich im Ring.
    const html = render({ color: '#a3e635' })
    expect(html).toMatch(/data-pen-detail="ring"[^>]*fill="#a3e635"/)
    expect(html).not.toMatch(/data-pen-detail="body"[^>]*fill="#a3e635"/)
  })

  it('beschneidet das wandernde Glanzband auf den Koerper', () => {
    // Der Pen ist die schmalste Form — unbeschnitten malte das Band beim
    // Wischen neben das Gehaeuse. Derselbe Fehler wie beim Tabletten-Glanz.
    const source = readFileSync(new URL('./PenVisual.tsx', import.meta.url), 'utf8')
    const band = source.match(/bodyClip[\s\S]{0,300}?data-pen-detail="sweep"/)?.[0] ?? ''
    expect(band).not.toBe('')
  })

  it('laesst das Glanzband mit dem Licht wandern', () => {
    expect(render({ lightOffset: 0 })).toMatch(/data-pen-detail="sweep"[^>]*translate\(0/)
    expect(render({ lightOffset: 1 })).toMatch(/data-pen-detail="sweep"[^>]*translate\(14/)
    expect(render({ lightOffset: -1 })).toMatch(/data-pen-detail="sweep"[^>]*translate\(-14/)
  })

  it('haelt die im Spec festgelegten Groessen ein', () => {
    expect(render({ size: 'large' })).toContain('h-[589.2px]')
    expect(render({ size: 'large' })).toContain('w-[76.6px]')
    expect(render({ size: 'carousel' })).toContain('h-[236.8px]')
    expect(render({ size: 'carousel' })).toContain('w-[30.8px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[300.9px]')
    expect(render({ size: 'carousel' })).toContain('sm:w-[39.1px]')
    expect(render({ size: 'compact' })).toContain('h-[177.6px]')
    expect(render({ size: 'mini' })).toContain('h-[96.9px]')
  })

  it('setzt den Namen laengs in einer gedrehten Huelle', () => {
    const html = render()
    expect(html).toContain('data-pen-detail="name"')
    expect(html).toContain('rotate(-90deg)')
    // 394,87 % der Breite entsprechen der Laufstrecke, 10,67 % der Hoehe der Bandbreite.
    expect(html).toContain('width:394.87%')
    expect(html).toContain('height:10.67%')
  })

  it('schreibt Name und Ziffer als HTML, nicht als SVG-Text', () => {
    const source = readFileSync(new URL('./PenVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('<text')
    expect(render()).toContain('data-pen-detail="dose-value"')
  })

  it('zeigt im Dosisfenster eine 0', () => {
    expect(render()).toMatch(/data-pen-detail="dose-value"[^>]*>0</)
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Pen')
  })

  it('bekommt weder Etikettband noch Fuellstand', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
    const source = readFileSync(new URL('./PenVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('<StageLabel')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-pen-focus="0.42"')
    expect(html).toContain('data-pen-light-offset="-0.35"')
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/pen/PenVisual.test.ts`
Expected: FAIL — `Cannot find module './PenVisual'`.

- [ ] **Step 3: Die Komponente implementieren**

```tsx
import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  PEN_BODY,
  PEN_CAP_PATH,
  PEN_CLIP_PATH,
  PEN_DOSE_TEXT,
  PEN_DOSE_WINDOW,
  PEN_DOSE_WINDOW_PCT,
  PEN_KNOB,
  PEN_KNOB_RIB_XS,
  PEN_NAME_BAND_PCT,
  PEN_NAME_RUN_PCT,
  PEN_NAME_TOP_PCT,
  PEN_RING,
  PEN_SWEEP_SHIFT,
} from './penShape'

export interface PenVisualProps {
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

// Der Pen nimmt die naechste Sprosse der Leiter, die die stehenden Formen
// steigen: 236,8 ist die Hoehe, die Ampulle und Nasenspray am sm-Breakpoint
// erreichen. Die Breite folgt dem eigenen Verhaeltnis 39/300 = 0,130.
const SIZE_CLASS: Record<NonNullable<PenVisualProps['size']>, string> = {
  large: 'h-[589.2px] w-[76.6px]',
  carousel: 'h-[236.8px] w-[30.8px] sm:h-[300.9px] sm:w-[39.1px]',
  compact: 'h-[177.6px] w-[23.1px]',
  mini: 'h-[96.9px] w-[12.6px]',
}

const NAME_CLASS: Record<NonNullable<PenVisualProps['size']>, string> = {
  large: 'text-sm leading-tight',
  carousel: 'text-[6px] sm:text-[7.5px] leading-tight',
  compact: 'text-[5px] leading-tight',
  mini: 'text-[3.5px] leading-tight',
}

const DOSE_CLASS: Record<NonNullable<PenVisualProps['size']>, string> = {
  large: 'text-[15px]',
  carousel: 'text-[7px] sm:text-[9px]',
  compact: 'text-[5px]',
  mini: 'text-[3px]',
}

export function PenVisual({
  name,
  color,
  size = 'large',
  className = '',
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: PenVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const penName = name?.trim() || 'Pen'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const bodyRef = useRef<SVGRectElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-pen-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-pen-light-offset', o.toFixed(2))
    sweepRef.current?.setAttribute('transform', `translate(${(o * PEN_SWEEP_SHIFT).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.10 + f * 0.30).toFixed(3))
    shadowRef.current?.setAttribute('cx', (20 - o * 4).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.3).toFixed(3))
    bodyRef.current?.setAttribute('opacity', (0.72 + f * 0.28).toFixed(3))
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-pen-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-pen-focus={Number(visualFocus.toFixed(2))}
      data-pen-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={penName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0.5 6 39 300"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`${uid}-bodyClip`}>
            <rect x={PEN_BODY.x} y={PEN_BODY.y} width={PEN_BODY.width} height={PEN_BODY.height} />
          </clipPath>
          <linearGradient id={`${uid}-cap`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#23272e" />
            <stop offset="18%" stopColor="#6f7683" />
            <stop offset="46%" stopColor="#454b55" />
            <stop offset="76%" stopColor="#5e646f" />
            <stop offset="100%" stopColor="#1d2127" />
          </linearGradient>
          <linearGradient id={`${uid}-knob`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#20242b" />
            <stop offset="20%" stopColor="#5b626d" />
            <stop offset="52%" stopColor="#383d45" />
            <stop offset="80%" stopColor="#4d535d" />
            <stop offset="100%" stopColor="#1b1f25" />
          </linearGradient>
          {/* Zylinderschattierung des Gehaeuses, unabhaengig vom Buehnenlicht. */}
          <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.55)" />
            <stop offset="20%" stopColor="rgba(255,255,255,0.30)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="78%" stopColor="rgba(255,255,255,0.14)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.60)" />
          </linearGradient>
          <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.65)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id={`${uid}-groundShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <ellipse
          ref={shadowRef}
          data-pen-detail="ground-shadow"
          cx={20 - visualLightOffset * 4}
          cy="308"
          rx="15"
          ry="3.5"
          fill={`url(#${uid}-groundShadow)`}
          opacity={0.2 + visualFocus * 0.3}
        />

        <path data-pen-detail="cap" d={PEN_CAP_PATH} fill={`url(#${uid}-cap)`} />
        <path data-pen-detail="clip" d={PEN_CLIP_PATH} fill="rgba(200,208,218,0.55)" />

        <rect
          ref={bodyRef}
          data-pen-detail="body"
          x={PEN_BODY.x}
          y={PEN_BODY.y}
          width={PEN_BODY.width}
          height={PEN_BODY.height}
          fill="#6a717c"
          opacity={0.72 + visualFocus * 0.28}
        />
        {/* Die einzige Stelle, an der color_hex sichtbar wird. */}
        <rect
          data-pen-detail="ring"
          x={PEN_RING.x}
          y={PEN_RING.y}
          width={PEN_RING.width}
          height={PEN_RING.height}
          fill={color}
        />
        <rect
          x={PEN_BODY.x}
          y={PEN_BODY.y}
          width={PEN_BODY.width}
          height={PEN_BODY.height}
          fill={`url(#${uid}-shade)`}
        />

        {/* Das wandernde Glanzband — beschnitten, weil der Pen die schmalste
            Form ist und es sonst neben das Gehaeuse malte. */}
        <g clipPath={`url(#${uid}-bodyClip)`}>
          <rect
            ref={sweepRef}
            data-pen-detail="sweep"
            x="10"
            y={PEN_BODY.y}
            width="12"
            height={PEN_BODY.height}
            fill={`url(#${uid}-sweep)`}
            opacity={0.10 + visualFocus * 0.30}
            transform={`translate(${(visualLightOffset * PEN_SWEEP_SHIFT).toFixed(2)} 0)`}
          />
        </g>

        <rect
          data-pen-detail="dose-window"
          x={PEN_DOSE_WINDOW.x}
          y={PEN_DOSE_WINDOW.y}
          width={PEN_DOSE_WINDOW.width}
          height={PEN_DOSE_WINDOW.height}
          rx={PEN_DOSE_WINDOW.rx}
          fill="#0a0f18"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />

        <rect
          data-pen-detail="knob"
          x={PEN_KNOB.x}
          y={PEN_KNOB.y}
          width={PEN_KNOB.width}
          height={PEN_KNOB.height}
          rx={PEN_KNOB.rx}
          fill={`url(#${uid}-knob)`}
        />
        <g
          data-pen-detail="knob-ribs"
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="0.9"
        >
          {PEN_KNOB_RIB_XS.map(x => (
            <path key={x} d={`M${x} ${PEN_KNOB.y + 9} L${x} ${PEN_KNOB.y + PEN_KNOB.height - 9}`} />
          ))}
        </g>
      </svg>

      {/* Die 0 als HTML: bei Karussellgroesse misst sie rund 8 px, und
          SVG-Text bekommt weder Hinting noch Subpixel-Glaettung. */}
      <div
        data-pen-detail="dose-value"
        className={`pointer-events-none absolute flex items-center justify-center font-black text-slate-100 ${DOSE_CLASS[size]}`}
        style={{
          left: `${(PEN_DOSE_WINDOW_PCT.left * 100).toFixed(2)}%`,
          top: `${(PEN_DOSE_WINDOW_PCT.top * 100).toFixed(2)}%`,
          width: `${(PEN_DOSE_WINDOW_PCT.width * 100).toFixed(2)}%`,
          height: `${(PEN_DOSE_WINDOW_PCT.height * 100).toFixed(2)}%`,
        }}
      >
        {PEN_DOSE_TEXT}
      </div>

      {/* Der Name laeuft laengs. Die Huelle ist um 90 Grad gedreht, darin
          arbeitet der bestehende waagerechte StageMarquee unveraendert weiter —
          so bleibt der geteilte Baustein fuer die sechs anderen Formen
          unangetastet. */}
      <div
        data-pen-detail="name"
        className="pointer-events-none absolute overflow-hidden text-center"
        style={{
          left: '50%',
          top: `${(PEN_NAME_TOP_PCT * 100).toFixed(2)}%`,
          width: `${(PEN_NAME_RUN_PCT * 100).toFixed(2)}%`,
          height: `${(PEN_NAME_BAND_PCT * 100).toFixed(2)}%`,
          transform: 'translate(-50%, -50%) rotate(-90deg)',
        }}
      >
        <StageMarquee className={`${NAME_CLASS[size]} font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]`}>
          {penName}
        </StageMarquee>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/pen`
Expected: PASS.

- [ ] **Step 5: Typen und Lint**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe.

Run: `npx eslint src/features/my-stack/extensions/pen`
Expected: keine Ausgabe.

- [ ] **Step 6: Commit**

```bash
git add src/features/my-stack/extensions/pen
git commit -m "feat: render the pen stage form"
```

---

### Task 3: Adapter, Weiche und Freischaltung

**Files:**
- Create: `src/features/my-stack/extensions/pen/PenRenderer.tsx`
- Modify: `src/features/my-stack/lib/dosageForms.ts`
- Modify: `src/features/my-stack/lib/dosageForms.test.ts`
- Modify: `src/features/my-stack/components/StackStage.tsx`
- Modify: `src/features/my-stack/components/StackStage.test.ts`

- [ ] **Step 1: Die Erwartungen in `dosageForms.test.ts` heben**

**Achtung: `pen` wird an dritter Stelle eingefügt, nicht angehängt.** In
`DOSAGE_FORMS` steht er direkt nach `ampoule`.

```ts
  it('aktiviert genau die Formen mit fertiger Bühnengrafik', () => {
    expect(DOSAGE_FORMS.filter(form => form.stageRenderer).map(form => form.key)).toEqual(['vial', 'ampoule', 'pen', 'tablet', 'capsule', 'nasal_spray', 'tube'])
  })
```

```ts
  it('erkennt die sieben fertigen Formen als darstellbar, den Rest noch nicht', () => {
    expect(isStageRenderable('vial')).toBe(true)
    expect(isStageRenderable('ampoule')).toBe(true)
    expect(isStageRenderable('pen')).toBe(true)
    expect(isStageRenderable('tablet')).toBe(true)
    expect(isStageRenderable('capsule')).toBe(true)
    expect(isStageRenderable('nasal_spray')).toBe(true)
    expect(isStageRenderable('tube')).toBe(true)
    expect(isStageRenderable('drops')).toBe(false)
    expect(isStageRenderable('gel')).toBe(false)
    expect(isStageRenderable('patch')).toBe(false)
    expect(isStageRenderable('powder')).toBe(false)
  })
```

- [ ] **Step 2: Den neuen Test in `StackStage.test.ts` ergänzen**

Ans Ende der Datei:

```ts
const penItem: StackItem = {
  ...vialItem,
  id: 'semaglutid-pen',
  display_name: 'Semaglutid',
  category: 'medication',
  dosage_form: 'pen',
  color_hex: '#3f7fbf',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Semaglutid',
    amount_value: 0.25,
    amount_unit: 'mg',
    basis_unit: 'dose',
  }],
}

describe('StackStage — Pen', () => {
  it('rendert den Pen für Pen-Einträge', () => {
    expect(renderStage(penItem)).toContain('data-stack-renderer="pen"')
  })

  it('zeigt Dosisfenster und Namen, aber kein Etikettband', () => {
    const html = renderStage(penItem)

    expect(html).toContain('data-pen-detail="dose-window"')
    expect(html).toContain('Semaglutid')
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
  })

  it('zeigt im Dosisfenster eine 0 statt der geplanten Dosis', () => {
    // Die Bühne zeigt den Stack-Eintrag, nicht eine einzelne Einnahme —
    // dieselbe Grenze wie bei der Bruchmenge der Tablette.
    const html = renderStage(penItem)
    expect(html).toMatch(/data-pen-detail="dose-value"[^>]*>0</)
    expect(html).not.toContain('0.25')
  })

  it('hält den Pen-Adapter frei von eigener Grafik und von Physik', () => {
    const source = readFileSync(new URL('../extensions/pen/PenRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('PenVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('SloshProvider')
    expect(source).not.toContain('fillPct')
  })
})
```

- [ ] **Step 3: Tests laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/components/StackStage.test.ts src/features/my-stack/lib/dosageForms.test.ts`
Expected: FAIL — `data-stack-renderer="unsupported"` statt `"pen"`, und `PenRenderer.tsx` fehlt.

- [ ] **Step 4: Den Adapter anlegen**

```tsx
import type { Ref } from 'react'
import { PenVisual } from './PenVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface PenRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: ohne Kartuschenfenster gibt es keine sichtbare
// Flüssigkeit, die schwappen könnte. Die Eintragsfarbe geht an den Ring.
export function PenRenderer({ item, ...visualProps }: PenRendererProps) {
  return (
    <div data-stack-renderer="pen">
      <PenVisual
        name={item.display_name}
        color={item.color_hex ?? '#64748b'}
        {...visualProps}
      />
    </div>
  )
}
```

- [ ] **Step 5: Form freischalten und Weiche erweitern**

In `dosageForms.ts` den Import ergänzen:

```ts
import { PEN_SPEC } from '../extensions/pen/penShape'
```

`DosageFormDefinition.stageRenderer` wird zu
`'vial' | 'ampoule' | 'capsule' | 'tablet' | 'nasal_spray' | 'tube' | 'pen'`,
und der Pen-Eintrag erhält:

```ts
  { key: 'pen', labelKey: 'dosage_form_pen', suggestedUnits: ['mg', 'mcg', 'IU'], basisUnits: ['dose', 'ml'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'], stageRenderer: 'pen', stageForm: PEN_SPEC },
```

In `StackStage.tsx` den Import ergänzen:

```tsx
import { PenRenderer } from '../extensions/pen/PenRenderer'
```

und nach dem Tuben-Zweig einfügen:

```tsx
  if (renderer === 'pen') {
    return <PenRenderer item={item} {...visualProps} />
  }
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack`
Expected: PASS. Die Wache auf `patch` bleibt grün und wird nicht angefasst.

- [ ] **Step 7: Commit**

```bash
git add src/features/my-stack
git commit -m "feat: route pen items to the pen stage"
```

---

### Task 4: Pen in die Vorschau

**Files:**
- Modify: `src/pages/__VialPreview.tsx`

- [ ] **Step 1: Pens aufnehmen**

Import ergänzen:

```ts
import { PenVisual } from '../features/my-stack/extensions/pen/PenVisual'
```

Eine eigene Detailreihe unter den Tuben:

```ts
const PREVIEW_PENS = [
  { name: 'Semaglutid', color: '#3f7fbf' },
  { name: 'Tirzepatid', color: '#a3e635' },
  // bewusst zu lang: zeigt den senkrechten Durchlauf
  { name: 'Insulin glargin 300 E/ml', color: '#f0b357' },
]
```

```tsx
      <p className="mx-auto max-w-4xl pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Pens — Dosisfenster in Detailgröße
      </p>
      <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-center gap-12 pb-2">
        {PREVIEW_PENS.map(p => (
          <PenVisual key={p.name} name={p.name} color={p.color} size="large" />
        ))}
      </div>
```

`MixedEntry` um `'pen'` erweitern und drei Einträge ans Ende von
`MIXED_CAROUSEL` setzen:

```ts
  { kind: 'pen', name: 'Semaglutid', amount: null, unit: null, color: '#3f7fbf' },
  { kind: 'pen', name: 'Tirzepatid', amount: null, unit: null, color: '#a3e635' },
  { kind: 'pen', name: 'Insulin glargin 300 E/ml', amount: null, unit: null, color: '#f0b357' },
```

Im Karussellzweig vor dem Tuben-Zweig:

```tsx
              {entry.kind === 'pen' ? (
                <PenVisual
                  name={entry.name}
                  color={entry.color}
                  size="carousel"
                  isActive={index === activeIndex}
                  stageLightRef={registerStageLight(index)}
                />
              ) : entry.kind === 'tube' ? (
```

- [ ] **Step 2: Typen und Lint prüfen**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe.

Run: `npx eslint src/pages/__VialPreview.tsx`
Expected: keine Ausgabe.

- [ ] **Step 3: Commit**

```bash
git add src/pages/__VialPreview.tsx
git commit -m "feat: add pens to the stage preview"
```

---

### Task 5: Regression, Sichtprüfung, Build und Graph

- [ ] **Step 1: Volle Suite**

Run: `npm test`
Expected: PASS. Die sechs bestehenden Formsuiten sind unverändert grün, die Wache auf `patch` ebenfalls.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `tsc -b` und Vite-Build ohne neue Fehler.

- [ ] **Step 3: Lint ohne neue Verstöße**

Run: `npx eslint src/features/my-stack src/pages/__VialPreview.tsx 2>&1 | grep problems`
Expected: dieselbe Problemzahl wie vor Task 1 (zuletzt 23).

- [ ] **Step 4: Sichtprüfung im Browser**

`http://localhost:5176/__vialpreview` öffnen und prüfen:

1. Der Pen steht aufrecht mit der Kappe oben auf dem Dosierknopf.
2. Der Farbring sitzt direkt unter der Kappe und trägt die Eintragsfarbe; das Gehäuse bleibt grau.
3. Das Dosisfenster zeigt eine **0**, keine andere Zahl.
4. Der Name läuft **längs**, um 90 Grad gedreht, und bei „Insulin glargin 300 E/ml" senkrecht durch.
5. Beim Wischen wandert das Glanzband und bleibt **auf dem Gehäuse** — kein Streifen daneben.
6. Kein Kartuschenfenster, keine Flüssigkeit, kein Etikettband, keine Prozentzeile.
7. Der Pen ist sichtbar das höchste Objekt der Reihe.

Die Maße im DOM gegenprüfen:

```js
const r = document.querySelector('[data-pen-detail="root"]').getBoundingClientRect()
;({ w: r.width, h: r.height, ratio: +(r.width / r.height).toFixed(4) })
```

Erwartet im Karussell: Verhältnis **0,1300**, Höhe 236,8 px (bzw. 300,9 px ab `sm`),
gleiche Unterkante wie alle sechs anderen Formen.

Und den Beschnitt des Glanzbands gegenprüfen, während gewischt wird:

```js
const p = document.querySelector('[data-pen-detail="root"]')
const s = p.querySelector('[data-pen-detail="sweep"]')
;({ transform: s.getAttribute('transform'), imClip: !!s.closest('g[clip-path]') })
```

Erwartet: `imClip` ist `true`, und `transform` läuft zwischen `translate(-14 0)` und `translate(14 0)`.

Die 589,2 px von `large` prüfen: steht die Form in der Detailreihe noch vernünftig,
oder muss die Stufe gedeckelt werden? Die Spec lässt das ausdrücklich offen.

- [ ] **Step 5: Graph aktualisieren und committen**

```bash
graphify update .
git add graphify-out
git commit -m "chore: update knowledge graph"
```

---

## Final Acceptance Criteria

- Ein Pen-Eintrag wird im Karussell und in der Detailansicht als aufrechter Pen mit Kappe, Ring, Dosisfenster und Knopf gerendert.
- Das Dosisfenster zeigt **0** — nie die geplante Dosis.
- Der Name läuft **längs**, um 90 Grad gedreht, mit rund 121,6 px Laufweite bei Karussellgröße.
- `color_hex` färbt **nur den Ring**, nicht das Gehäuse.
- Das Glanzband wandert mit `lightOffset` um ±14 Einheiten und liegt **im Clip**.
- Name und Ziffer sind HTML, kein SVG-Text.
- Kein Kartuschenfenster, keine Flüssigkeit, kein Etikettband, keine Prozentzeile, keine Slosh-Anbindung.
- Seitenverhältnis 0,1300 auf jeder Stufe; Karussellhöhe 236,8 px, ab `sm` 300,9 px.
- Die Renderer-Liste enthält `pen` an **dritter** Stelle.
- `drops`, `liquid`, `powder`, `spray`, `gel` und `patch` bleiben im Textzustand.
- Die Wache auf `patch` in `StackStage.test.ts` bleibt unverändert und grün.
- Die Suiten der sechs bestehenden Formen sind unverändert und grün.
- Keine neuen i18n-Schlüssel.
- `npm test`, `npm run build` und `npx eslint src` ohne neue Fehler.
