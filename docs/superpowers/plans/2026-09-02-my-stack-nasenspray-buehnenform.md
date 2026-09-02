# Nasenspray als fünfte Bühnenform — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Nasenspray als fünfte Bühnenform rendern — Glasflasche mit sichtbarer Flüssigkeit, darauf ein dreiteiliger Kopf aus weißem Kunststoff.

**Architecture:** Alles Neue liegt in `src/features/my-stack/extensions/nasal-spray/`. Anders als bei Kapsel und Tablette trägt hier der **gesamte Glas-Malstapel**: `LiquidGraphic`, `liquidGeometry`, `StageLabel`, `useStageLight` und die Slosh-Anbindung werden unverändert übernommen. Kein neuer geteilter Baustein — der weiße Kopf gehört in die Form, nicht in `stage/`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind, Inline-SVG.

**Spec:** `docs/superpowers/specs/2026-09-02-my-stack-nasenspray-buehnenform-design.md`

---

## Global Constraints

1. **Die Suiten von Vial, Ampulle, Kapsel und Tablette bleiben unverändert grün.**
2. **Das Negativbeispiel zieht diesmal nicht um.** `patch` bleibt ohne Renderer; die beim Tablettenbau eingeführte Wache in `StackStage.test.ts` bleibt unangetastet und grün. Wer sie anfasst, hat etwas falsch gemacht.
3. **Die Flüssigkeit wird am Innenumriss beschnitten, nie am Außenumriss.** Beim Ampullenbau war das der häufigste Fehler: sonst fehlt der Glasboden und die Flüssigkeit klebt an der Außenwand.
4. **Keine erfundenen Mengen.** Ohne Wirkstoffmenge bleibt die Detailzeile weg, kein Platzhalter. Keine Prozentzeile.
5. **Jeder gezeichnete Pfad braucht ein explizites `fill`.** Ein Pfad ohne `fill` füllt schwarz. Die Kragenrille ist eine Linie und muss `fill="none"` tragen.
6. Testbefehl `npx vitest run <pfad>`, volle Suite `npm test`, alles aus dem Worktree `C:/Users/Devin/peptid-tracker/.worktrees/my-stack-foundation`.

---

## Korrektur gegenüber der Spec

Die Spec nennt das Kammerverhältnis „rund 0,52". Aus den festgelegten Maßen
ergibt sich exakt **72 / 134 = 0,537**. Dieser Plan benutzt den exakten Wert.
An der Aussage ändert das nichts — er bleibt nah an der Ampulle (0,483), der
Neigungswinkel braucht keine Nachjustierung.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `extensions/nasal-spray/nasalSprayShape.ts` | Konturen, Kopfmaße, Kammer, Etikettlage, `StageFormSpec`. Reine Daten. |
| `extensions/nasal-spray/nasalSprayShape.test.ts` | Prüft die Formkonstanten gegeneinander. |
| `extensions/nasal-spray/NasalSprayVisual.tsx` | Glas, Kopf, Flüssigkeit, Etikett, Bühnenlicht. |
| `extensions/nasal-spray/NasalSprayVisual.test.ts` | Strukturtests. |
| `extensions/nasal-spray/NasalSprayRenderer.tsx` | Adapter von `StackItem`, reicht `SloshProvider` durch. |

Geändert: `lib/dosageForms.ts`, `lib/dosageForms.test.ts`, `components/StackStage.tsx`, `components/StackStage.test.ts`, `src/pages/__VialPreview.tsx`.

---

### Task 1: Formdaten des Nasensprays

**Files:**
- Create: `src/features/my-stack/extensions/nasal-spray/nasalSprayShape.ts`
- Test: `src/features/my-stack/extensions/nasal-spray/nasalSprayShape.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  NASAL_SPRAY_ASPECT,
  NASAL_SPRAY_BODY_INNER_PATH,
  NASAL_SPRAY_BODY_PATH,
  NASAL_SPRAY_COLLAR,
  NASAL_SPRAY_FILL,
  NASAL_SPRAY_FLANGE,
  NASAL_SPRAY_LABEL,
  NASAL_SPRAY_NOZZLE_PATH,
  NASAL_SPRAY_SPEC,
} from './nasalSprayShape'

describe('nasalSprayShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    // Sonst bemisst die Groessenklasse das Zeichenraster statt die Form, und
    // die Flasche verfehlt die gemeinsame Bodenlinie.
    expect(NASAL_SPRAY_SPEC.viewBox).toEqual({ x: 21, y: 6, width: 78, height: 288 })
  })

  it('leitet das Seitenverhaeltnis aus der viewBox ab', () => {
    expect(NASAL_SPRAY_ASPECT).toBeCloseTo(
      NASAL_SPRAY_SPEC.viewBox.width / NASAL_SPRAY_SPEC.viewBox.height,
      6,
    )
  })

  it('laesst Fingerauflage und Schraubkragen ohne Luecke aneinanderstossen', () => {
    // Eine Luecke zeigte sich bei `large` als heller Spalt quer durch den Kopf.
    expect(NASAL_SPRAY_FLANGE.y + NASAL_SPRAY_FLANGE.height).toBeCloseTo(NASAL_SPRAY_COLLAR.y, 6)
  })

  it('haelt die Fingerauflage innerhalb der Glasbreite', () => {
    // Ragt sie ueber den Flaschenrand, sitzt der Kopf wie ein Pilz auf.
    const glassLeft = NASAL_SPRAY_SPEC.viewBox.x
    const glassRight = NASAL_SPRAY_SPEC.viewBox.x + NASAL_SPRAY_SPEC.viewBox.width
    expect(NASAL_SPRAY_FLANGE.x).toBeGreaterThanOrEqual(glassLeft)
    expect(NASAL_SPRAY_FLANGE.x + NASAL_SPRAY_FLANGE.width).toBeLessThanOrEqual(glassRight)
  })

  it('staffelt den Kopf von der Duese ueber die Auflage zum Kragen', () => {
    // Von oben nach unten wird jedes Teil breiter, ausser der Auflage, die
    // bewusst ueber den Kragen hinausragt — daran greifen zwei Finger an.
    expect(NASAL_SPRAY_COLLAR.width).toBeLessThan(NASAL_SPRAY_FLANGE.width)
    expect(NASAL_SPRAY_COLLAR.y).toBeGreaterThan(NASAL_SPRAY_FLANGE.y)
  })

  it('gibt der Kopfgruppe knapp die Haelfte der Hoehe', () => {
    const total = NASAL_SPRAY_SPEC.viewBox.height
    const headEnd = NASAL_SPRAY_COLLAR.y + NASAL_SPRAY_COLLAR.height
    const headShare = (headEnd - NASAL_SPRAY_SPEC.viewBox.y) / total
    expect(headShare).toBeGreaterThan(0.44)
    expect(headShare).toBeLessThan(0.5)
  })

  it('legt die Kammer in den geraden Teil des Glases', () => {
    const chamber = NASAL_SPRAY_SPEC.chamber
    expect(chamber).not.toBeNull()
    // unterhalb des Kragens, also im Flaschenkoerper
    expect(chamber!.y).toBeGreaterThan(NASAL_SPRAY_COLLAR.y + NASAL_SPRAY_COLLAR.height)
    // und innerhalb der Glasaussenkante
    expect(chamber!.x).toBeGreaterThan(NASAL_SPRAY_SPEC.viewBox.x)
    expect(chamber!.x + chamber!.width).toBeLessThan(
      NASAL_SPRAY_SPEC.viewBox.x + NASAL_SPRAY_SPEC.viewBox.width,
    )
  })

  it('leitet das Kammerverhaeltnis aus den Kammermassen ab', () => {
    const chamber = NASAL_SPRAY_SPEC.chamber!
    expect(chamber.aspect).toBeCloseTo(chamber.width / chamber.height, 3)
  })

  it('laesst Kopfraum ueber der Fluessigkeit', () => {
    // Ohne Kopfraum hat die Oberflaeche keinen Platz zum Schwappen.
    expect(NASAL_SPRAY_FILL).toBeGreaterThan(0.8)
    expect(NASAL_SPRAY_FILL).toBeLessThan(1)
  })

  it('setzt das Etikettband auf den Flaschenkoerper', () => {
    const top = NASAL_SPRAY_SPEC.viewBox.y + NASAL_SPRAY_LABEL.topPct * NASAL_SPRAY_SPEC.viewBox.height
    const bottom = top + NASAL_SPRAY_LABEL.heightPct * NASAL_SPRAY_SPEC.viewBox.height
    const chamber = NASAL_SPRAY_SPEC.chamber!
    expect(top).toBeGreaterThan(chamber.y)
    expect(bottom).toBeLessThan(chamber.y + chamber.height)
  })

  it('zieht die Innenkontur ueberall innerhalb der Aussenkontur', () => {
    // Grobpruefung ueber die erste Koordinate: die Innenwand beginnt weiter
    // rechts als die Aussenwand, sonst gaebe es keine Wandstaerke.
    const outerX = Number(NASAL_SPRAY_BODY_PATH.match(/^M([\d.]+)/)![1])
    const innerX = Number(NASAL_SPRAY_BODY_INNER_PATH.match(/^M([\d.]+)/)![1])
    expect(innerX).toBeGreaterThan(outerX)
  })

  it('zeichnet die Duese als geschlossenen Pfad', () => {
    expect(NASAL_SPRAY_NOZZLE_PATH.trim().endsWith('Z')).toBe(true)
  })

  it('traegt ein Etikett, aber keinen aussagekraeftigen Fuellstand', () => {
    expect(carriesLabel(NASAL_SPRAY_SPEC)).toBe(true)
    expect(NASAL_SPRAY_SPEC.hasMeaningfulFill).toBe(false)
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/nasal-spray/nasalSprayShape.test.ts`
Expected: FAIL — `Cannot find module './nasalSprayShape'`.

- [ ] **Step 3: Die Formdaten anlegen**

```ts
import type { StageFormSpec } from '../../stage/types'

// Gezeichnet auf einem Raster von 120 x 294 Einheiten; die viewBox unten ist
// auf die Objektgrenzen beschnitten, wie bei der Ampulle. Aufbau von oben nach
// unten: Düse, Fingerauflage, Schraubkragen, Glaskörper.

// Verjüngte Düse mit gerundeter Spitze. Sie ist das Merkmal, an dem die Form
// als Nasenspray erkannt wird — dasselbe, was die Einschnürung für die Ampulle
// und die Bruchrille für die Tablette leistet.
export const NASAL_SPRAY_NOZZLE_PATH = 'M45.5 75.5 L74.5 75.5 L69.5 14 C 69.5 9 67 6 60 6 C 53 6 50.5 9 50.5 14 Z'

// Die dünne breite Scheibe, an der zwei Finger angreifen. Sie ist breiter als
// der Kragen und damit das zweite unverwechselbare Merkmal.
export const NASAL_SPRAY_FLANGE = { x: 22, y: 75.5, width: 76, height: 12, rx: 5 } as const

// Schraubkragen. Stößt oben lückenlos an die Auflage; eine Lücke zeigte sich
// bei `large` als heller Spalt.
export const NASAL_SPRAY_COLLAR = { x: 33, y: 87.5, width: 54, height: 53 } as const
export const NASAL_SPRAY_COLLAR_PATH = 'M33 87.5 L87 87.5 L87 138 C 87 139.6 86 140.5 84 140.5 L36 140.5 C 34 140.5 33 139.6 33 138 Z'

// Umlaufende Rille am Kragen. Eine Linie, kein Körper — deshalb zwingend
// fill="none", sonst füllt sie schwarz.
export const NASAL_SPRAY_COLLAR_GROOVE_PATH = 'M35 128 L85 128'

// Glaskörper, 78 Einheiten breit. Das ist die Untergrenze: die Fingerauflage
// misst 76 und stünde bei schmalerem Glas über den Flaschenrand hinaus.
export const NASAL_SPRAY_BODY_PATH = 'M21 156 C 21 146 25 141 33 140.5 L87 140.5 C 95 141 99 146 99 156 L99 280 C 99 289 93 294 83 294 L37 294 C 27 294 21 289 21 280 Z'

// Die nach innen versetzte Kontur. Sie zeichnet die Wandstärke — die doppelte
// Linie, die einen hohlen Körper von einer Silhouette unterscheidet — und sie
// beschneidet die Flüssigkeit, damit ein Glasboden darunter sichtbar bleibt.
export const NASAL_SPRAY_BODY_INNER_PATH = 'M24 157 C 24 148.5 27.5 144 34.5 143.5 L85.5 143.5 C 92.5 144 96 148.5 96 157 L96 279 C 96 286.5 91 291 82 291 L38 291 C 29 291 24 286.5 24 279 Z'

// Fast randvoll, wie in der Vorlage — aber nie ganz: der Kopfraum gibt der
// Oberfläche den Platz, den sie zum Schwappen braucht.
export const NASAL_SPRAY_FILL = 0.94

// Anteilige Etikettlage, damit Karussell und Detailansicht dasselbe Verhältnis
// halten: y 196 bis 242 auf dem Zeichenraster.
export const NASAL_SPRAY_LABEL = { topPct: 0.660, heightPct: 0.160 } as const

// Die Form skaliert uniform, also legt das viewBox-Verhältnis die Breite fest.
export const NASAL_SPRAY_ASPECT = 78 / 288

export const NASAL_SPRAY_SPEC: StageFormSpec = {
  viewBox: { x: 21, y: 6, width: 78, height: 288 },
  // Nur der gerade Teil des Innenraums. Das hält die Kammer rechteckig, so
  // braucht die Geometrie kein Breitenprofil für die Schulter — derselbe
  // Kunstgriff, den Vial und Ampulle schon benutzen.
  chamber: { x: 24, y: 157, width: 72, height: 134, aspect: 72 / 134 },
  // Die App kennt den Stand der offenen Flasche nicht: getVialFillPct liest
  // vials_in_stock, ein vial-spezifisches Altfeld. Die Grafik zeigt das
  // Objekt, eine Prozentzahl wäre eine Behauptung.
  hasMeaningfulFill: false,
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/nasal-spray/nasalSprayShape.test.ts`
Expected: PASS, 13 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/extensions/nasal-spray
git commit -m "feat: add nasal spray shape data"
```

---

### Task 2: `NasalSprayVisual`

**Files:**
- Create: `src/features/my-stack/extensions/nasal-spray/NasalSprayVisual.tsx`
- Test: `src/features/my-stack/extensions/nasal-spray/NasalSprayVisual.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NasalSprayVisual } from './NasalSprayVisual'

const base = { name: 'Oxytocin', amount: 24, unit: 'IU / spray', color: '#7dd3fc' }
const render = (props: Partial<Parameters<typeof NasalSprayVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(NasalSprayVisual, { ...base, ...props }))

describe('NasalSprayVisual', () => {
  it('meldet sich als Nasenspray-Renderer', () => {
    expect(render()).toContain('data-nasal-spray-detail="root"')
  })

  it('zeichnet den dreiteiligen Kopf', () => {
    const html = render()
    expect(html).toContain('data-nasal-spray-detail="nozzle"')
    expect(html).toContain('data-nasal-spray-detail="flange"')
    expect(html).toContain('data-nasal-spray-detail="collar"')
  })

  it('gibt der Kragenrille ein explizites fill, damit sie nicht schwarz fuellt', () => {
    const html = render()
    expect(html).toMatch(/data-nasal-spray-detail="collar-groove"[^>]*fill="none"/)
  })

  it('beschneidet die Fluessigkeit an der Innenkontur, nicht an der Aussenkontur', () => {
    const source = readFileSync(new URL('./NasalSprayVisual.tsx', import.meta.url), 'utf8')
    const window = source.match(/data-nasal-spray-detail="liquid-window"[\s\S]{0,120}/)?.[0] ?? ''
    expect(window).toContain('innerClip')
    expect(window).not.toContain('outerClip')
  })

  it('beschneidet das Kopflicht auf den Kopf', () => {
    // Unbeschnitten malte der Lichtstreifen neben die Duese ins Leere — der
    // Fehler, den die Kantenlichter der Ampulle einmal hatten.
    const source = readFileSync(new URL('./NasalSprayVisual.tsx', import.meta.url), 'utf8')
    const light = source.match(/headClip[\s\S]{0,400}?head-light/)?.[0] ?? ''
    expect(light).not.toBe('')
  })

  it('haelt die im Spec festgelegten Hoehen ein', () => {
    expect(render({ size: 'large' })).toContain('h-[464px]')
    expect(render({ size: 'carousel' })).toContain('h-[186.4px]')
    expect(render({ size: 'carousel' })).toContain('sm:h-[236.8px]')
    expect(render({ size: 'compact' })).toContain('h-[140px]')
    expect(render({ size: 'mini' })).toContain('h-[76px]')
  })

  it('leitet jede Breite aus derselben Form ab', () => {
    // 0,2708 mal die Hoehe, auf eine Nachkommastelle.
    expect(render({ size: 'large' })).toContain('w-[125.7px]')
    expect(render({ size: 'carousel' })).toContain('w-[50.5px]')
    expect(render({ size: 'carousel' })).toContain('sm:w-[64.1px]')
    expect(render({ size: 'compact' })).toContain('w-[37.9px]')
    expect(render({ size: 'mini' })).toContain('w-[20.6px]')
  })

  it('traegt Name und Wirkstoffmenge auf dem Etikett', () => {
    const html = render()
    expect(html).toContain('Oxytocin')
    expect(html).toContain('24 IU / spray')
  })

  it('laesst die Detailzeile weg, wenn keine Menge bekannt ist', () => {
    const html = render({ amount: null, unit: null })
    expect(html).toContain('Oxytocin')
    // Die Signaturklasse der Detailzeile darf gar nicht erst erscheinen.
    expect(html).not.toContain('font-bold uppercase tracking-wide')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Nasenspray')
  })

  it('zeigt keinen Prozentwert', () => {
    expect(render()).not.toContain('data-fill-pct')
  })

  it('faerbt die Fluessigkeit mit der Eintragsfarbe', () => {
    expect(render({ color: '#a3e635' })).toContain('#a3e635')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-nasal-spray-focus="0.42"')
    expect(html).toContain('data-nasal-spray-light-offset="-0.35"')
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/nasal-spray/NasalSprayVisual.test.ts`
Expected: FAIL — `Cannot find module './NasalSprayVisual'`.

- [ ] **Step 3: Die Komponente implementieren**

```tsx
import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { LiquidGraphic, type LiquidGraphicHandle } from '../../stage/LiquidGraphic'
import { StageLabel } from '../../stage/StageLabel'
import { usePrefersReducedMotion } from '../../stage/usePrefersReducedMotion'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  NASAL_SPRAY_BODY_INNER_PATH,
  NASAL_SPRAY_BODY_PATH,
  NASAL_SPRAY_COLLAR_GROOVE_PATH,
  NASAL_SPRAY_COLLAR_PATH,
  NASAL_SPRAY_FILL,
  NASAL_SPRAY_FLANGE,
  NASAL_SPRAY_LABEL,
  NASAL_SPRAY_NOZZLE_PATH,
  NASAL_SPRAY_SPEC,
} from './nasalSprayShape'

export interface NasalSprayVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  color: string
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0)
const clampOffset = (value: number) => (Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0)

// Kein erfundener Platzhalter: ohne bekannte Menge bleibt die Zeile weg.
function sprayAmountLabel(amount?: string | number | null, unit?: string | null): string | null {
  if (amount === null || amount === undefined || amount === '') return null
  return unit ? `${amount} ${unit}` : String(amount)
}

// Das Spray nimmt die naechsten beiden Sprossen der Leiter, die Vial und
// Ampulle schon steigen: 146,7 -> 186,4 -> 236,8, jeder Schritt x1,2706. Die
// Breite folgt immer dem eigenen Verhaeltnis 78/288, damit die Form nie in
// einen fremden Kasten gequetscht wird. Als Klassen geschrieben, weil ein
// Breakpoint nicht in einem Inline-Style leben kann.
const SIZE_CLASS: Record<NonNullable<NasalSprayVisualProps['size']>, string> = {
  large: 'h-[464px] w-[125.7px]',
  carousel: 'h-[186.4px] w-[50.5px] sm:h-[236.8px] sm:w-[64.1px]',
  compact: 'h-[140px] w-[37.9px]',
  mini: 'h-[76px] w-[20.6px]',
}

export function NasalSprayVisual({
  name,
  amount,
  unit,
  color,
  size = 'large',
  className = '',
  showLabel = true,
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: NasalSprayVisualProps) {
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const labelName = name?.trim() || 'Nasenspray'
  const detail = sprayAmountLabel(amount, unit)
  const chamber = NASAL_SPRAY_SPEC.chamber!

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const bloomRef = useRef<SVGRectElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const outlineRef = useRef<SVGUseElement | null>(null)
  const headLightRef = useRef<SVGRectElement | null>(null)
  const liquidRef = useRef<LiquidGraphicHandle | null>(null)
  const labelSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-nasal-spray-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-nasal-spray-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (60 - o * 6).toFixed(2))
    shadowRef.current?.setAttribute('rx', (26 + f * 9).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    outlineRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))
    bloomRef.current?.setAttribute('transform', `translate(${(o * 14).toFixed(2)} 0)`)
    bloomRef.current?.setAttribute('opacity', (0.2 + f * 0.42).toFixed(3))
    sweepRef.current?.setAttribute('transform', `translate(${(o * 22).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.14 + f * 0.34).toFixed(3))
    // Der Kopf ist matt: sein Licht wandert, aber es glaenzt nicht auf.
    headLightRef.current?.setAttribute('transform', `translate(${(o * 9).toFixed(2)} 0)`)
    headLightRef.current?.setAttribute('opacity', (0.18 + f * 0.2).toFixed(3))
    liquidRef.current?.applyStageLight(f, o)

    if (labelSheenRef.current) {
      labelSheenRef.current.style.transform = `translateX(${(o * 12).toFixed(2)}%)`
      labelSheenRef.current.style.opacity = (0.6 + f * 0.22).toFixed(3)
    }
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  const nameClass = size === 'large'
    ? 'text-sm sm:text-base leading-tight font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
    : size === 'carousel'
      ? 'text-[8.5px] sm:text-[10px] leading-tight font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
      : 'text-[7px] leading-tight font-black text-white'
  const detailClass = size === 'large'
    ? 'text-[10px] sm:text-xs mt-0.5 font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'
    : 'text-[6px] mt-0.5 font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'

  return (
    <div
      ref={rootRef}
      data-nasal-spray-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-nasal-spray-focus={Number(visualFocus.toFixed(2))}
      data-nasal-spray-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={detail ? `${labelName}, ${detail}` : labelName}
    >
      <svg
        data-nasal-spray-detail="glass"
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="21 6 78 288"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <path id={`${uid}-outer`} d={NASAL_SPRAY_BODY_PATH} />
          <path id={`${uid}-inner`} d={NASAL_SPRAY_BODY_INNER_PATH} />
          <clipPath id={`${uid}-outerClip`}>
            <use href={`#${uid}-outer`} />
          </clipPath>
          <clipPath id={`${uid}-innerClip`}>
            <use href={`#${uid}-inner`} />
          </clipPath>
          {/* Vereinigung der drei Kopfteile. Ohne diesen Clip malte das
              Kopflicht einen hellen Streifen in die Luft neben der Düse —
              derselbe Fehler, den die Kantenlichter der Ampulle hatten. */}
          <clipPath id={`${uid}-headClip`}>
            <path d={NASAL_SPRAY_COLLAR_PATH} />
            <rect
              x={NASAL_SPRAY_FLANGE.x}
              y={NASAL_SPRAY_FLANGE.y}
              width={NASAL_SPRAY_FLANGE.width}
              height={NASAL_SPRAY_FLANGE.height}
              rx={NASAL_SPRAY_FLANGE.rx}
            />
            <path d={NASAL_SPRAY_NOZZLE_PATH} />
          </clipPath>
          {/* Klarglas: nur die Kanten tragen die Tiefe der Wandstaerke. */}
          <linearGradient id={`${uid}-glassDepth`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(2,6,23,0.62)" />
            <stop offset="9%" stopColor="rgba(226,232,240,0.11)" />
            <stop offset="32%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="72%" stopColor="rgba(15,23,42,0.11)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.72)" />
          </linearGradient>
          <radialGradient id={`${uid}-glassBloom`} gradientUnits="userSpaceOnUse" cx="60" cy="215" r="80">
            <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id={`${uid}-glassSweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Weisses Polypropylen: matt, weiche Kante, kein Metallglanz. Ein
              metallischer Kopf truege die Farbfamilie der Vial-Boerdelkappe. */}
          <linearGradient id={`${uid}-pp`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9aa6b4" />
            <stop offset="16%" stopColor="#f4f7fb" />
            <stop offset="52%" stopColor="#e2e8f0" />
            <stop offset="86%" stopColor="#c2cbd7" />
            <stop offset="100%" stopColor="#8d99a8" />
          </linearGradient>
          <linearGradient id={`${uid}-headLight`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id={`${uid}-stageShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.78)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.5)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.1" />
          </filter>
        </defs>

        <ellipse
          ref={shadowRef}
          data-nasal-spray-detail="stage-shadow"
          cx={60 - visualLightOffset * 6}
          cy="296"
          rx={26 + visualFocus * 9}
          ry="5"
          fill={`url(#${uid}-stageShadow)`}
          opacity={0.2 + visualFocus * 0.28}
        />

        <use
          ref={outlineRef}
          data-nasal-spray-detail="outer-contour"
          href={`#${uid}-outer`}
          fill={`url(#${uid}-glassDepth)`}
          stroke="rgba(203,213,225,0.56)"
          strokeOpacity={0.36 + visualFocus * 0.28}
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />

        <g clipPath={`url(#${uid}-outerClip)`}>
          <rect
            ref={bloomRef}
            x="-40"
            y="120"
            width="200"
            height="200"
            fill={`url(#${uid}-glassBloom)`}
            opacity={0.2 + visualFocus * 0.42}
            transform={`translate(${visualLightOffset * 14} 0)`}
          />
          <rect
            ref={sweepRef}
            data-nasal-spray-detail="glass-sweep"
            x="44"
            y="130"
            width="32"
            height="170"
            fill={`url(#${uid}-glassSweep)`}
            opacity={0.14 + visualFocus * 0.34}
            transform={`translate(${visualLightOffset * 22} 0)`}
          />
        </g>

        {/* Die Fluessigkeit wird von der INNEN-Kontur beschnitten, nie von der
            aeusseren: sonst fehlt der Glasboden und sie klebt an der Aussenwand. */}
        <g data-nasal-spray-detail="liquid-window" clipPath={`url(#${uid}-innerClip)`}>
          <LiquidGraphic
            uid={`${uid}-liquid`}
            fill={NASAL_SPRAY_FILL}
            chamberAspect={chamber.aspect}
            x={chamber.x}
            y={chamber.y}
            width={chamber.width}
            height={chamber.height}
            color={color}
            bubbles={size === 'large'}
            reducedMotion={reducedMotion}
            seedFocus={visualFocus}
            seedLightOffset={visualLightOffset}
            handleRef={liquidRef}
          />
        </g>

        {/* Die Wandstaerke. Non-scaling, damit sie die Karussellbreite ueberlebt. */}
        <use
          data-nasal-spray-detail="inner-contour"
          href={`#${uid}-inner`}
          fill="none"
          stroke="rgba(226,232,240,0.34)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />

        {/* Kantenlichter am Glas, auf den Koerper beschnitten. */}
        <g data-nasal-spray-detail="edge-lights" clipPath={`url(#${uid}-outerClip)`}>
          <path
            d="M25.5 168 L25.5 272 C 25.5 283 29 289 36 292"
            fill="none"
            stroke="rgba(255,255,255,0.52)"
            strokeOpacity={Math.max(0.08, Math.min(1, 0.6 - visualLightOffset * 0.6))}
            strokeWidth="4.4"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
          <path
            d="M94.5 180 L94.5 272 C 94.5 281 91 287 85 290"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeOpacity={Math.max(0.08, Math.min(1, 0.5 + visualLightOffset * 0.6))}
            strokeWidth="2.4"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
        </g>

        {/* Der Kopf liegt ueber dem Glas: sein unterer Rand deckt die Naht am
            Flaschenhals ab. */}
        <g data-nasal-spray-detail="head">
          <path
            data-nasal-spray-detail="collar"
            d={NASAL_SPRAY_COLLAR_PATH}
            fill={`url(#${uid}-pp)`}
            stroke="rgba(148,163,184,0.5)"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
          <path
            data-nasal-spray-detail="collar-groove"
            d={NASAL_SPRAY_COLLAR_GROOVE_PATH}
            fill="none"
            stroke="rgba(120,132,148,0.5)"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
          <rect
            data-nasal-spray-detail="flange"
            x={NASAL_SPRAY_FLANGE.x}
            y={NASAL_SPRAY_FLANGE.y}
            width={NASAL_SPRAY_FLANGE.width}
            height={NASAL_SPRAY_FLANGE.height}
            rx={NASAL_SPRAY_FLANGE.rx}
            fill={`url(#${uid}-pp)`}
            stroke="rgba(148,163,184,0.5)"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
          <path
            data-nasal-spray-detail="nozzle"
            d={NASAL_SPRAY_NOZZLE_PATH}
            fill={`url(#${uid}-pp)`}
            stroke="rgba(148,163,184,0.5)"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
          <g clipPath={`url(#${uid}-headClip)`}>
            <rect
              ref={headLightRef}
              data-nasal-spray-detail="head-light"
              x="30"
              y="6"
              width="24"
              height="135"
              fill={`url(#${uid}-headLight)`}
              opacity={0.18 + visualFocus * 0.2}
              transform={`translate(${visualLightOffset * 9} 0)`}
            />
          </g>
        </g>
      </svg>

      {showLabel && (
        <StageLabel
          name={labelName}
          detail={detail}
          className="inset-x-[6%]"
          nameClassName={nameClass}
          detailClassName={detailClass}
          wrapperProps={{
            'data-nasal-spray-detail': 'label',
            style: {
              top: `${(NASAL_SPRAY_LABEL.topPct * 100).toFixed(1)}%`,
              height: `${(NASAL_SPRAY_LABEL.heightPct * 100).toFixed(1)}%`,
            },
          }}
          innerProps={{ className: 'flex h-full flex-col justify-center px-1' }}
          sheenRef={labelSheenRef}
          sheenStyle={{
            transform: `translateX(${visualLightOffset * 12}%)`,
            opacity: 0.6 + visualFocus * 0.22,
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/nasal-spray`
Expected: PASS.

- [ ] **Step 5: Typen und Lint**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe.

Run: `npx eslint src/features/my-stack/extensions/nasal-spray`
Expected: keine Ausgabe.

- [ ] **Step 6: Commit**

```bash
git add src/features/my-stack/extensions/nasal-spray
git commit -m "feat: render the nasal spray stage form"
```

---

### Task 3: Adapter, Weiche und Freischaltung

**Files:**
- Create: `src/features/my-stack/extensions/nasal-spray/NasalSprayRenderer.tsx`
- Modify: `src/features/my-stack/lib/dosageForms.ts`
- Modify: `src/features/my-stack/lib/dosageForms.test.ts`
- Modify: `src/features/my-stack/components/StackStage.tsx`
- Modify: `src/features/my-stack/components/StackStage.test.ts`

- [ ] **Step 1: Die Erwartungen in `dosageForms.test.ts` heben**

Ersetze die beiden bestehenden Zusicherungen:

```ts
  it('aktiviert genau die Formen mit fertiger Bühnengrafik', () => {
    expect(DOSAGE_FORMS.filter(form => form.stageRenderer).map(form => form.key)).toEqual(['vial', 'ampoule', 'tablet', 'capsule', 'nasal_spray'])
  })
```

```ts
  it('erkennt die fünf fertigen Formen als darstellbar, den Rest noch nicht', () => {
    expect(isStageRenderable('vial')).toBe(true)
    expect(isStageRenderable('ampoule')).toBe(true)
    expect(isStageRenderable('tablet')).toBe(true)
    expect(isStageRenderable('capsule')).toBe(true)
    expect(isStageRenderable('nasal_spray')).toBe(true)
    expect(isStageRenderable('spray')).toBe(false)
    expect(isStageRenderable('patch')).toBe(false)
    expect(isStageRenderable('powder')).toBe(false)
  })
```

Die Reihenfolge in der ersten Zusicherung folgt `DOSAGE_FORMS`, wo `nasal_spray`
nach `capsule` steht.

- [ ] **Step 2: Den neuen Test in `StackStage.test.ts` ergänzen**

Ans Ende der Datei:

```ts
const nasalSprayItem: StackItem = {
  ...vialItem,
  id: 'oxytocin-spray',
  display_name: 'Oxytocin',
  category: 'peptide',
  dosage_form: 'nasal_spray',
  color_hex: '#7dd3fc',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Oxytocin',
    amount_value: 24,
    amount_unit: 'IU',
    basis_unit: 'spray',
  }],
}

describe('StackStage — Nasenspray', () => {
  it('rendert das Nasenspray für Nasenspray-Einträge', () => {
    expect(renderStage(nasalSprayItem)).toContain('data-stack-renderer="nasal_spray"')
  })

  it('zeigt den Kopf und ein Etikett mit Name und Wirkstoffmenge', () => {
    const html = renderStage(nasalSprayItem)

    expect(html).toContain('data-nasal-spray-detail="nozzle"')
    expect(html).toContain('Oxytocin')
    expect(html).toContain('24 IU / spray')
  })

  it('reicht keinen Füllstand an das Nasenspray durch', () => {
    const source = readFileSync(new URL('../extensions/nasal-spray/NasalSprayRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('NasalSprayVisual')
    expect(source).toContain('SloshProvider')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('fillPct')
  })

  it('lässt den generischen spray-Schlüssel im Textzustand', () => {
    const sprayItem: StackItem = { ...nasalSprayItem, id: 'rachenspray', dosage_form: 'spray' }
    expect(renderStage(sprayItem)).toContain('data-stack-renderer="unsupported"')
  })
})
```

- [ ] **Step 3: Tests laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/components/StackStage.test.ts src/features/my-stack/lib/dosageForms.test.ts`
Expected: FAIL — `data-stack-renderer="unsupported"` statt `"nasal_spray"`, und `NasalSprayRenderer.tsx` fehlt.

- [ ] **Step 4: Den Adapter anlegen**

```tsx
import type { Ref } from 'react'
import { NasalSprayVisual } from './NasalSprayVisual'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface NasalSprayRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
  sloshEngine?: SloshEngine
}

// "24 IU / spray" — Wirkstoff je Sprühstoß, wie es auf der Flasche steht.
// Fehlende Teile bleiben weg statt durch einen Platzhalter ersetzt zu werden.
function strengthLabel(item: StackItem): string | null {
  const ingredient = item.ingredients[0]
  if (!ingredient?.amount_unit) return null
  return ingredient.basis_unit
    ? `${ingredient.amount_unit} / ${ingredient.basis_unit}`
    : ingredient.amount_unit
}

export function NasalSprayRenderer({ item, sloshEngine, ...visualProps }: NasalSprayRendererProps) {
  const ingredient = item.ingredients[0]
  const spray = (
    <NasalSprayVisual
      name={item.display_name}
      amount={ingredient?.amount_value}
      unit={strengthLabel(item)}
      color={item.color_hex ?? '#64748b'}
      {...visualProps}
    />
  )

  return (
    <div data-stack-renderer="nasal_spray">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{spray}</SloshProvider> : spray}
    </div>
  )
}
```

- [ ] **Step 5: Form freischalten und Weiche erweitern**

In `dosageForms.ts` den Import ergänzen:

```ts
import { NASAL_SPRAY_SPEC } from '../extensions/nasal-spray/nasalSprayShape'
```

`DosageFormDefinition.stageRenderer` wird zu
`'vial' | 'ampoule' | 'capsule' | 'tablet' | 'nasal_spray'`, und der
Nasenspray-Eintrag erhält:

```ts
  { key: 'nasal_spray', labelKey: 'dosage_form_nasal_spray', suggestedUnits: ['mcg', 'mg'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'], stageRenderer: 'nasal_spray', stageForm: NASAL_SPRAY_SPEC },
```

In `StackStage.tsx` den Import ergänzen:

```tsx
import { NasalSprayRenderer } from '../extensions/nasal-spray/NasalSprayRenderer'
```

und nach dem Ampullenzweig einfügen:

```tsx
  if (renderer === 'nasal_spray') {
    return <NasalSprayRenderer item={item} showLabel={showLabel} sloshEngine={sloshEngine} {...visualProps} />
  }
```

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack`
Expected: PASS. Die Wache auf `patch` bleibt grün — sie wird nicht angefasst.

- [ ] **Step 7: Commit**

```bash
git add src/features/my-stack
git commit -m "feat: route nasal spray items to the nasal spray stage"
```

---

### Task 4: Nasenspray in die Vorschau

**Files:**
- Modify: `src/pages/__VialPreview.tsx`

- [ ] **Step 1: Nasensprays aufnehmen**

Import ergänzen:

```ts
import { NasalSprayVisual } from '../features/my-stack/extensions/nasal-spray/NasalSprayVisual'
```

Eine eigene Detailreihe unter den Tabletten:

```ts
const PREVIEW_SPRAYS = [
  { name: 'Oxytocin', amount: 24, unit: 'IU / spray', color: '#7dd3fc' },
  { name: 'Melanotan II', amount: 300, unit: 'mcg / spray', color: '#f0b357' },
  // bewusst ohne Menge: zeigt das Etikett ohne Detailzeile
  { name: 'Selank', amount: null, unit: null, color: '#a3e635' },
]
```

```tsx
      <p className="mx-auto max-w-4xl pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Nasensprays — Kopf in Detailgröße
      </p>
      <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-center gap-10 pb-2">
        {PREVIEW_SPRAYS.map(s => (
          <NasalSprayVisual key={s.name} name={s.name} amount={s.amount} unit={s.unit} color={s.color} size="large" />
        ))}
      </div>
```

`MixedEntry` um `'nasal_spray'` erweitern und drei Einträge ans Ende von
`MIXED_CAROUSEL` setzen:

```ts
  { kind: 'nasal_spray', name: 'Oxytocin', amount: 24, unit: 'IU / spray', color: '#7dd3fc' },
  { kind: 'nasal_spray', name: 'Melanotan II', amount: 300, unit: 'mcg / spray', color: '#f0b357' },
  { kind: 'nasal_spray', name: 'Selank', amount: null, unit: null, color: '#a3e635' },
```

Im Karussellzweig vor dem Tablettenzweig:

```tsx
              {entry.kind === 'nasal_spray' ? (
                <NasalSprayVisual
                  name={entry.name}
                  amount={entry.amount}
                  unit={entry.unit}
                  color={entry.color}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              ) : entry.kind === 'tablet' ? (
```

- [ ] **Step 2: Typen und Lint prüfen**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe.

Run: `npx eslint src/pages/__VialPreview.tsx`
Expected: keine Ausgabe.

- [ ] **Step 3: Commit**

```bash
git add src/pages/__VialPreview.tsx
git commit -m "feat: add nasal sprays to the stage preview"
```

---

### Task 5: Regression, Sichtprüfung, Build und Graph

- [ ] **Step 1: Volle Suite**

Run: `npm test`
Expected: PASS. Die Suiten von Vial, Ampulle, Kapsel und Tablette sind unverändert grün, die Wache auf `patch` ebenfalls.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `tsc -b` und Vite-Build ohne neue Fehler.

- [ ] **Step 3: Lint ohne neue Verstöße**

Run: `npx eslint src/features/my-stack 2>&1 | grep problems`
Expected: dieselbe Problemzahl wie vor Task 1 (zuletzt 23).

- [ ] **Step 4: Sichtprüfung im Browser**

`http://localhost:5176/__vialpreview` öffnen und prüfen:

1. Der Kopf ist **weiß und matt**, nicht metallisch — im Karussell neben einem Vial gegenprüfen, dessen Bördelkappe metallisch ist.
2. Die drei Kopfteile sind einzeln erkennbar: Kragen mit Rille, Fingerauflage, Düse.
3. **Kein heller Spalt** zwischen Auflage und Kragen bei `large`.
4. Die Fingerauflage bleibt innerhalb des Flaschenrands, ragt nicht über.
5. Die Flüssigkeit sitzt **im** Glas, mit sichtbarem Glasboden darunter — nicht auf der Außenwand.
6. Beim Wischen schwappt die Flüssigkeit; die Flasche selbst bewegt sich nicht.
7. Etikett mit Name und Wirkstoffmenge; bei „Selank" nur der Name, keine leere Zeile.
8. Keine Prozentzeile.
9. Kein schwarzer Balken am Kragen — die Rille ist eine Linie mit `fill="none"`.

Die Maße im DOM gegenprüfen:

```js
const r = document.querySelector('[data-nasal-spray-detail="root"]').getBoundingClientRect()
;({ w: r.width, h: r.height, ratio: +(r.width / r.height).toFixed(4) })
```

Erwartet im Karussell: Verhältnis **0,2708**, Höhe 186,4 px (bzw. 236,8 px ab `sm`),
gleiche Unterkante wie Vial, Ampulle, Kapsel und Tablette.

Die 464 px von `large` prüfen: steht die Form in der Detailreihe noch vernünftig,
oder muss die Stufe gedeckelt werden? Die Spec lässt das ausdrücklich offen.

- [ ] **Step 5: Graph aktualisieren und committen**

```bash
graphify update .
git add graphify-out
git commit -m "chore: update knowledge graph"
```

---

## Final Acceptance Criteria

- Ein Nasenspray-Eintrag wird im Karussell und in der Detailansicht als Glasflasche mit dreiteiligem weißem Kopf gerendert.
- Der Kopf besteht aus Schraubkragen mit Rille, Fingerauflage und verjüngter Düse; die Teile stoßen lückenlos aneinander.
- Die Fingerauflage bleibt innerhalb der Glasbreite.
- Die Flüssigkeit wird an der Innenkontur beschnitten und schwappt beim Wischen.
- Das Etikett trägt Name und Wirkstoffmenge; ohne Menge bleibt die Detailzeile weg.
- Keine Prozentzeile.
- Seitenverhältnis 0,2708 auf jeder Stufe; Karussellhöhe 186,4 px, ab `sm` 236,8 px.
- `spray`, `patch` und `powder` bleiben im Textzustand.
- Die Wache auf `patch` in `StackStage.test.ts` bleibt unverändert und grün.
- Die Suiten von Vial, Ampulle, Kapsel und Tablette sind unverändert und grün.
- Keine neuen i18n-Schlüssel.
- `npm test`, `npm run build` und `npx eslint src` ohne neue Fehler.
