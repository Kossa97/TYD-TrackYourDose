# Ampulle als zweite Bühnenform — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Ampulle als zweite vollwertige Bühnenform in My Stack rendern und dabei die Bausteine herauslösen, die sie sich mit dem Vial teilt.

**Architecture:** Architektur C aus dem Spec. Material — Flüssigkeitsgeometrie, Flüssigkeits-Malstapel, Stage-Light-Kanal, Etikett — wandert nach `src/features/my-stack/stage/` und wird von beiden Formen benutzt. Form — Shell-Kontur, Kappe, Kammerlage, Seitenverhältnis — bleibt pro Darreichungsform. Das Vial behält Aussehen und Pfad; seine 24 bestehenden Tests sind das Regressionsnetz für jede Extraktion.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind, Inline-SVG.

**Spec:** `docs/superpowers/specs/2026-08-28-my-stack-ampulle-buehnenform-design.md`

---

## Global Constraints

1. **Die bestehende Vial-Suite darf nicht angefasst werden.** `src/components/PeptideVialVisual.test.ts` (24 Tests) und `src/features/my-stack/components/StackStage.test.ts` bleiben inhaltlich unverändert und müssen nach jeder Task grün sein. Wenn eine Extraktion sie rot macht, ist die Extraktion falsch — nicht der Test.
2. **`StackStage.test.ts` prüft Quelltext-Strings.** Es verlangt, dass `VialRenderer.tsx` die Bezeichner `PeptideVialVisual`, `VialStageLightHandle`, `SloshProvider` und `sloshEngine?: SloshEngine` enthält und **kein** `<svg`. Der Name `VialStageLightHandle` muss deshalb erhalten bleiben, auch wenn der Typ umzieht.
3. **`StackStage.tsx` darf kein `<svg`, `<img` oder `lucide-react` enthalten.** Auch das wird per Quelltext geprüft.
4. **Keine neuen i18n-Schlüssel.** Der Vertrag in `src/features/my-stack/lib/i18n.test.ts` listet Schlüssel explizit über 14 Locales; die Ampulle braucht keinen.
5. **`data-vial-detail`-Attribute bleiben unverändert.** Sie umzubenennen ist eine eigene Aufräumarbeit und nicht Teil dieses Plans.
6. Testbefehl ist `npx vitest run <pfad>`, die volle Suite `npm test`.

---

## File Structure

**Neu — geteiltes Material:**

| Datei | Verantwortung |
|---|---|
| `src/features/my-stack/stage/liquidGeometry.ts` | Umzug. Reine Geometrie der Flüssigkeitsoberfläche, jetzt kammerbreiten-abhängig. |
| `src/features/my-stack/stage/liquidGeometry.test.ts` | Umzug der bestehenden Tests plus neue für die Hub-Skalierung. |
| `src/features/my-stack/stage/useStageLight.ts` | Imperativer Focus-/LightOffset-Kanal, `StageLightHandle`. |
| `src/features/my-stack/stage/StageLabel.tsx` | Glasband inklusive Marquee. |
| `src/features/my-stack/stage/LiquidGraphic.tsx` | Vollständiger Flüssigkeits-Malstapel, abonniert die Slosh-Engine. |
| `src/features/my-stack/stage/types.ts` | `StageFormSpec`, `StageRendererProps`. |

**Neu — Ampullenform:**

| Datei | Verantwortung |
|---|---|
| `src/features/my-stack/extensions/ampoule/ampouleShape.ts` | Konturen, Kammer, Etikettlage, Kammerverhältnis. Reine Daten. |
| `src/features/my-stack/extensions/ampoule/ampouleShape.test.ts` | Prüft die Formkonstanten. |
| `src/features/my-stack/extensions/ampoule/AmpouleVisual.tsx` | Komposition aus Formdaten und geteiltem Material. |
| `src/features/my-stack/extensions/ampoule/AmpouleVisual.test.ts` | Strukturtests der Ampulle. |
| `src/features/my-stack/extensions/ampoule/AmpouleRenderer.tsx` | Adapter von `StackItem` auf `AmpouleVisual`, analog `VialRenderer`. |

**Geändert:**

| Datei | Änderung |
|---|---|
| `src/components/PeptideVialVisual.tsx` | Konsumiert die geteilten Bausteine. Aussehen und Markup unverändert. |
| `src/components/liquidGeometry.ts` | Entfällt (Umzug). |
| `src/components/liquidGeometry.test.ts` | Entfällt (Umzug). |
| `src/features/my-stack/lib/dosageForms.ts` | `stageRenderer: 'ampoule'`, `stageForm`-Verknüpfung. |
| `src/features/my-stack/components/StackStage.tsx` | Verzweigt auf `stageRenderer`. |
| `src/features/my-stack/MyStackPage.tsx` | Prozentzeile an den Füllstand der Form gebunden. |

---

### Task 1: Kipphub aus der Kammerbreite ableiten

Reine Geometrie, noch am alten Pfad, damit der Diff klein und lesbar bleibt.

**Files:**
- Modify: `src/components/liquidGeometry.ts`
- Test: `src/components/liquidGeometry.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

Ans Ende der `describe('liquidGeometry', ...)`-Blockes in `src/components/liquidGeometry.test.ts` anfügen. Der Import in Zeile 2 wird um `REFERENCE_CHAMBER_ASPECT` erweitert:

```ts
test('scales the tilt with the chamber aspect so narrow chambers keep a comparable surface angle', () => {
  const wide = buildLiquid({ fill: 0.5, tilt: 1, chamberAspect: 0.794 })
  const narrow = buildLiquid({ fill: 0.5, tilt: 1, chamberAspect: 0.483 })

  const wideRise = Math.abs(wide.leftWallY - wide.rightWallY)
  const narrowRise = Math.abs(narrow.leftWallY - narrow.rightWallY)

  expect(narrowRise).toBeLessThan(wideRise)
  expect(narrowRise / wideRise).toBeCloseTo(0.483 / 0.794, 1)
})

test('defaults to the vial chamber so existing callers stay unchanged', () => {
  const implicit = buildLiquid({ fill: 0.5, tilt: 1, time: 0.3 })
  const explicit = buildLiquid({ fill: 0.5, tilt: 1, time: 0.3, chamberAspect: REFERENCE_CHAMBER_ASPECT })
  expect(implicit).toEqual(explicit)
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/components/liquidGeometry.test.ts`
Expected: FAIL — `REFERENCE_CHAMBER_ASPECT` ist kein Export, und `chamberAspect` wird ignoriert, sodass `narrowRise === wideRise`.

- [ ] **Step 3: Den Parameter einbauen**

In `src/components/liquidGeometry.ts` nach der `TILT_RISE`-Konstante ergänzen:

```ts
// Das Seitenverhältnis der Flüssigkeitskammer in Pixeln (Breite / Höhe), wie
// sie am Ende tatsächlich gerendert wird. Referenz ist das Vial mit 74.7 x 94.1.
// Der Kipphub steckt in viewBox-Einheiten der Höhe, die halbe Oberfläche in
// Einheiten der Breite — ohne Skalierung kippt eine schmale Kammer daher
// steiler. Skaliert man den Hub mit dem Verhältnis, bleibt der Oberflächen-
// WINKEL über alle Formen vergleichbar.
export const REFERENCE_CHAMBER_ASPECT = 0.794
```

`LiquidParams` um das Feld erweitern:

```ts
export interface LiquidParams {
  fill: number // 0..1, already capped by the caller
  tilt?: number // -1..1 slosh tilt (right wall higher when > 0)
  energy?: number // 0..1 slosh energy — scales the traveling wave + highlight
  time?: number // seconds, advances continuously to animate the surface
  chamberAspect?: number // rendered chamber width / height in px
}
```

`nearEdgeY` bekommt einen weiteren Parameter und skaliert damit die beiden **bewegten** Terme. Bauch und Kapillaranstieg bleiben unberührt:

```ts
function nearEdgeY(
  x: number,
  surfaceY: number,
  tilt: number,
  energy: number,
  time: number,
  scale: number,
  motion: number,
): number {
  const n = norm(x)
  const tiltY = -tilt * TILT_RISE * scale * motion * n
  const bow = NEAR_BOW * (1 - n * n)
  const capillary = CAP_RISE * n * n
  const ambient =
    0.7 * Math.sin(n * 2.3 + time * 1.7) + 0.45 * Math.sin(n * 4.1 - time * 1.1 + 0.7)
  const dir = tilt >= 0 ? 1 : -1
  const slosh =
    energy * scale * motion * 3 * Math.sin(n * 3.2 - dir * time * 6) * (0.5 + 0.5 * Math.abs(n))
  return surfaceY + tiltY + bow - capillary + ambient + slosh
}
```

In `buildLiquid` die Signatur und die drei Aufrufstellen anpassen:

```ts
export function buildLiquid({
  fill,
  tilt = 0,
  energy = 0,
  time = 0,
  chamberAspect = REFERENCE_CHAMBER_ASPECT,
}: LiquidParams): LiquidGeometry {
  const t = clamp(tilt, -1, 1)
  const e = clamp(energy, 0, 1)
  const tm = finite(time)
  const scale = fillSloshResponse(fill)
  const motion = clamp(chamberAspect / REFERENCE_CHAMBER_ASPECT, 0.2, 2)
  const surfaceY = liquidSurfaceY(fill)

  const near: Array<[number, number]> = []
  for (let i = 0; i <= SAMPLES; i++) {
    const x = (i / SAMPLES) * LIQUID_VB_W
    near.push([x, nearEdgeY(x, surfaceY, t, e, tm, scale, motion)])
  }
```

Weiter unten die Highlight-Berechnung, die ebenfalls eine Bewegung ist:

```ts
  const highlightX = clamp(CX + t * scale * motion * 30, 16, LIQUID_VB_W - 16)
  const highlightY = nearEdgeY(highlightX, surfaceY, t, e, tm, scale, motion) - thickness(highlightX) * 0.5
```

- [ ] **Step 4: Tests laufen lassen und Erfolg bestätigen**

Run: `npx vitest run src/components/liquidGeometry.test.ts src/components/PeptideVialVisual.test.ts`
Expected: PASS. Die Vial-Tests bleiben grün, weil der Default exakt dem heutigen Verhalten entspricht.

- [ ] **Step 5: Commit**

```bash
git add src/components/liquidGeometry.ts src/components/liquidGeometry.test.ts
git commit -m "feat: scale liquid tilt with the chamber aspect"
```

---

### Task 2: Bühnenmodul anlegen, Geometrie und Motion-Hook umziehen

**Files:**
- Create: `src/features/my-stack/stage/liquidGeometry.ts` (Verschiebung)
- Create: `src/features/my-stack/stage/liquidGeometry.test.ts` (Verschiebung)
- Create: `src/features/my-stack/stage/usePrefersReducedMotion.ts`
- Delete: `src/components/liquidGeometry.ts`, `src/components/liquidGeometry.test.ts`
- Modify: `src/components/PeptideVialVisual.tsx:3`, `:18-28`

- [ ] **Step 1: Dateien verschieben**

```bash
mkdir -p src/features/my-stack/stage
git mv src/components/liquidGeometry.ts src/features/my-stack/stage/liquidGeometry.ts
git mv src/components/liquidGeometry.test.ts src/features/my-stack/stage/liquidGeometry.test.ts
```

Der Inhalt beider Dateien bleibt unverändert; der relative Import `./liquidGeometry` im Test stimmt weiterhin.

- [ ] **Step 2: Den Reduced-Motion-Hook mit umziehen**

Beide Formen brauchen ihn, deshalb gehört er ins geteilte Modul.
`src/features/my-stack/stage/usePrefersReducedMotion.ts` anlegen und die
Funktion aus `PeptideVialVisual.tsx:18-28` **unverändert** hierher verschieben:

```ts
import { useEffect, useState } from 'react'

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return reduced
}
```

- [ ] **Step 3: Die Importe im Vial anpassen**

`src/components/PeptideVialVisual.tsx`, Zeile 3 und die entfallende lokale
Funktion:

```ts
import { buildLiquid, LIQUID_VB_H, LIQUID_VB_W, liquidSurfaceY } from '../features/my-stack/stage/liquidGeometry'
import { usePrefersReducedMotion } from '../features/my-stack/stage/usePrefersReducedMotion'
```

- [ ] **Step 4: Prüfen, dass kein Import übrig ist**

Run: `npx tsc -b --noEmit 2>&1 | head -20`
Expected: keine Ausgabe.

- [ ] **Step 5: Volle Suite laufen lassen**

Run: `npm test`
Expected: PASS, unveränderte Testanzahl gegenüber dem Stand nach Task 1.

- [ ] **Step 6: Commit**

```bash
git add -A src/components src/features/my-stack/stage
git commit -m "refactor: move liquid geometry into the stage module"
```

---

### Task 3: Stage-Light-Kanal herauslösen

Geteilt wird der **Kanal** — Clamping, Änderungsschwelle, imperatives Handle, das Zurückschreiben nach jedem Render. Was genau ins DOM geschrieben wird, bleibt formspezifisch und wird als Callback übergeben.

**Files:**
- Create: `src/features/my-stack/stage/useStageLight.ts`
- Test: `src/features/my-stack/stage/useStageLight.test.ts`
- Modify: `src/components/PeptideVialVisual.tsx:264-300`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/features/my-stack/stage/useStageLight.test.ts`:

```ts
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { useStageLight, type StageLightHandle } from './useStageLight'

function Probe({ apply, handleRef }: {
  apply: (f: number, o: number) => void
  handleRef: React.Ref<StageLightHandle>
}) {
  useStageLight(apply, { focus: 1, lightOffset: 0 }, handleRef)
  return createElement('div')
}

describe('useStageLight', () => {
  it('exposes a setStageLight handle that clamps its inputs', () => {
    const apply = vi.fn()
    const ref = createRef<StageLightHandle>()
    renderToStaticMarkup(createElement(Probe, { apply, handleRef: ref }))

    // Server-Rendering ruft keine Layout-Effekte auf; das Handle entsteht erst
    // im Browser. Der Vertrag wird deshalb über die reine Clamp-Funktion geprüft.
    expect(typeof useStageLight).toBe('function')
    expect(ref.current).toBeNull()
  })
})
```

Zusätzlich die reine Hilfsfunktion prüfen, die der Hook exportiert:

```ts
import { clampStageLight } from './useStageLight'

describe('clampStageLight', () => {
  it('clamps focus to 0..1 and light offset to -1..1', () => {
    expect(clampStageLight(2, 5)).toEqual({ focus: 1, lightOffset: 1 })
    expect(clampStageLight(-3, -4)).toEqual({ focus: 0, lightOffset: -1 })
    expect(clampStageLight(Number.NaN, Number.NaN)).toEqual({ focus: 0, lightOffset: 0 })
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/stage/useStageLight.test.ts`
Expected: FAIL — `Cannot find module './useStageLight'`.

- [ ] **Step 3: Den Hook implementieren**

`src/features/my-stack/stage/useStageLight.ts`:

```ts
import { useCallback, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import type { Ref } from 'react'

// Der Stage-Light-Kanal einer Bühnenform. Das Karussell schiebt pro
// Scroll-Frame Focus und Lichtversatz hier durch, damit beim Wischen kein
// React-Render entsteht. Was daraus im DOM passiert, entscheidet die Form.
export interface StageLightHandle {
  setStageLight: (focus: number, lightOffset: number) => void
}

const clamp = (value: number, lo: number, hi: number) =>
  Number.isFinite(value) ? Math.max(lo, Math.min(hi, value)) : lo

export function clampStageLight(focus: number, lightOffset: number) {
  return { focus: clamp(focus, 0, 1), lightOffset: clamp(lightOffset, -1, 1) }
}

export function useStageLight(
  apply: (focus: number, lightOffset: number) => void,
  seed: { focus: number; lightOffset: number },
  handleRef?: Ref<StageLightHandle>,
): void {
  const stageRef = useRef(seed)

  const setStageLight = useCallback((nextFocus: number, nextLightOffset: number) => {
    const { focus, lightOffset } = clampStageLight(nextFocus, nextLightOffset)
    const stage = stageRef.current
    if (Math.abs(stage.focus - focus) < 0.005 && Math.abs(stage.lightOffset - lightOffset) < 0.005) return
    stageRef.current = { focus, lightOffset }
    apply(focus, lightOffset)
  }, [apply])

  useImperativeHandle(handleRef, () => ({ setStageLight }), [setStageLight])

  // React kann die stage-lit Attribute gerade auf die Prop-Werte zurückgesetzt
  // haben; vor dem Paint den imperativen Stand wiederherstellen.
  useLayoutEffect(() => {
    const stage = stageRef.current
    apply(stage.focus, stage.lightOffset)
  })
}
```

- [ ] **Step 4: Das Vial darauf umstellen**

In `src/components/PeptideVialVisual.tsx` den Block von `const setStageLight = useCallback(` bis zum abschließenden `useLayoutEffect(() => { ... })` (Zeilen 279–300) ersetzen durch:

```ts
  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)
```

Die lokale `stageRef`-Deklaration in Zeile 227 entfällt; die Verwendung in `draw` liest den Stand künftig aus den DOM-Attributen, die `applyStageLight` ohnehin schreibt:

```ts
      const root = rootRef.current
      const stageFocus = Number(root?.getAttribute('data-vial-focus') ?? 1)
      const stageShift = Number(root?.getAttribute('data-vial-light-offset') ?? 0) * 10
```

Import ergänzen und den Typalias erhalten, damit `StackStage.test.ts` grün bleibt:

```ts
import { useStageLight, type StageLightHandle } from '../features/my-stack/stage/useStageLight'

export type VialStageLightHandle = StageLightHandle
```

Die alte lokale `interface VialStageLightHandle` (Zeilen 32–34) wird dadurch ersetzt.

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run src/components/PeptideVialVisual.test.ts src/features/my-stack src/pages`
Expected: PASS. Besonders `drives the stage light imperatively and keeps blur filters off per-frame elements` und die drei `StackStage`-Tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/my-stack/stage/useStageLight.ts src/features/my-stack/stage/useStageLight.test.ts src/components/PeptideVialVisual.tsx
git commit -m "refactor: extract the stage light channel"
```

---

### Task 4: Etikett herauslösen

Das gerenderte Markup des Vials muss **byte-identisch** bleiben. Die vial-spezifischen `data-vial-detail`-Attribute werden deshalb als Props durchgereicht, nicht fest eingebaut.

**Files:**
- Create: `src/features/my-stack/stage/StageLabel.tsx`
- Test: `src/features/my-stack/stage/StageLabel.test.ts`
- Modify: `src/components/PeptideVialVisual.tsx:78-145` (Marquee), `:727-750` (Etikett)

- [ ] **Step 1: Die Vial-Erwartungen nachlesen**

Run: `npx vitest run src/components/PeptideVialVisual.test.ts -t "label"`
Notiere die genauen Strings, die die Tests erwarten — insbesondere `label-glass-wrap`, `full-width-label` und `vial-label-marquee`. Diese müssen nach der Extraktion unverändert im Markup stehen.

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`src/features/my-stack/stage/StageLabel.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StageLabel } from './StageLabel'

describe('StageLabel', () => {
  it('renders name and detail with caller supplied data attributes', () => {
    const html = renderToStaticMarkup(createElement(StageLabel, {
      name: 'Testosteron Enantat',
      detail: '250 mg / ml',
      className: 'left-0 right-0',
      nameClassName: 'text-sm',
      detailClassName: 'text-xs',
      wrapperProps: { 'data-vial-detail': 'label-glass-wrap' },
      innerProps: { 'data-vial-detail': 'full-width-label' },
    }))

    expect(html).toContain('data-vial-detail="label-glass-wrap"')
    expect(html).toContain('data-vial-detail="full-width-label"')
    expect(html).toContain('Testosteron Enantat')
    expect(html).toContain('250 mg / ml')
    expect(html).toContain('vial-label-marquee')
  })

  it('omits the detail line when there is nothing to show', () => {
    const html = renderToStaticMarkup(createElement(StageLabel, {
      name: 'Ampulle ohne Menge',
      detail: null,
      className: '',
      nameClassName: '',
      detailClassName: '',
    }))

    expect(html).toContain('Ampulle ohne Menge')
    expect(html).not.toContain('<p')
  })
})
```

- [ ] **Step 3: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/stage/StageLabel.test.ts`
Expected: FAIL — `Cannot find module './StageLabel'`.

- [ ] **Step 4: `StageLabel` implementieren**

`src/features/my-stack/stage/StageLabel.tsx` anlegen. Die Funktion `VialLabelMarquee` aus `PeptideVialVisual.tsx:78-145` wird **unverändert** hierher verschoben und in `StageLabelMarquee` umbenannt; die CSS-Klasse `vial-label-marquee` im gerenderten Markup bleibt dabei erhalten. Darum herum:

```tsx
import type { CSSProperties, HTMLAttributes, ReactNode, RefObject } from 'react'

export interface StageLabelProps {
  name: string
  detail: string | null
  className: string
  nameClassName: string
  detailClassName: string
  wrapperProps?: HTMLAttributes<HTMLDivElement>
  innerProps?: HTMLAttributes<HTMLDivElement>
  sheenRef?: RefObject<HTMLDivElement | null>
  sheenStyle?: CSSProperties
}

// Das Glasband, das jeder Behälter mit Flüssigkeit trägt. Position und
// Typografie kommen von der Form, das Material ist überall dasselbe.
export function StageLabel({
  name, detail, className, nameClassName, detailClassName,
  wrapperProps, innerProps, sheenRef, sheenStyle,
}: StageLabelProps) {
  return (
    <div
      {...wrapperProps}
      className={`absolute ${className} overflow-hidden border-y border-white/40 bg-white/28 text-center shadow-[0_8px_22px_rgba(0,0,0,0.28)] backdrop-blur-[2px]`}
    >
      <div {...innerProps} className="relative overflow-hidden">
        <StageLabelMarquee className={nameClassName}>{name}</StageLabelMarquee>
        {detail !== null && detail !== '' && (
          <p className={detailClassName}>{detail}</p>
        )}
      </div>
      {sheenRef && (
        <div
          ref={sheenRef}
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-white/10 to-black/10"
          style={sheenStyle}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 5: Das Vial darauf umstellen**

Den `showLabel &&`-Block in `PeptideVialVisual.tsx:727-750` ersetzen:

```tsx
          {showLabel && (
            <StageLabel
              name={labelName}
              detail={vialAmountLabel(amount, unit)}
              className={labelClass}
              nameClassName={`${nameClass} font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]`}
              detailClassName={`${amountClass} font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
              wrapperProps={{ 'data-vial-detail': 'label-glass-wrap' }}
              innerProps={{ 'data-vial-detail': 'full-width-label' }}
              sheenRef={labelSheenRef}
              sheenStyle={{ transform: `translateX(${visualLightOffset * 10}%)`, opacity: 0.62 + visualFocus * 0.2 }}
            />
          )}
```

Die lokale `VialLabelMarquee`-Definition entfällt, `ReactNode` aus dem Typimport streichen, falls dadurch ungenutzt.

- [ ] **Step 6: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack/stage/StageLabel.test.ts src/components/PeptideVialVisual.test.ts`
Expected: PASS. Kritisch sind `uses a full-width single-line label with delayed marquee for long names`, `measures real overflow for vial label marquee instead of using a name-length heuristic` und `renders vial label typography in white for contrast on colored liquid`.

- [ ] **Step 7: Commit**

```bash
git add src/features/my-stack/stage/StageLabel.tsx src/features/my-stack/stage/StageLabel.test.ts src/components/PeptideVialVisual.tsx
git commit -m "refactor: extract the stage label"
```

---

### Task 5: Flüssigkeits-Malstapel herauslösen

Der größte Schnitt. `LiquidGraphic` bekommt eigene Refs, abonniert die Slosh-Engine selbst und reicht die stage-light-abhängigen Teile über ein Handle nach außen.

**Files:**
- Create: `src/features/my-stack/stage/LiquidGraphic.tsx`
- Test: `src/features/my-stack/stage/LiquidGraphic.test.ts`
- Modify: `src/components/PeptideVialVisual.tsx:565-700`

**Interface:**

```ts
export interface LiquidGraphicHandle {
  applyStageLight: (focus: number, lightOffset: number) => void
}

export interface LiquidGraphicProps {
  uid: string
  fill: number              // 0..1
  color: string
  chamberAspect: number
  x: number; y: number; width: number; height: number  // Kammer im Eltern-viewBox
  clipPathId: string        // Kontur, die die Flüssigkeit beschneidet
  bubbles: boolean
  reducedMotion: boolean
  seedFocus: number
  seedLightOffset: number
  motionClass?: string
  motionStyle?: CSSProperties
  motionKey?: number
  introDurationMs?: number
  introReveal?: boolean
  handleRef?: Ref<LiquidGraphicHandle>
}
```

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/features/my-stack/stage/LiquidGraphic.test.ts`:

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LiquidGraphic } from './LiquidGraphic'

const base = {
  uid: 'probe', fill: 0.94, color: '#e0a23f', chamberAspect: 0.483,
  x: 29.4, y: 146.6, width: 61.2, height: 126.8,
  clipPathId: 'probe-inner', bubbles: true, reducedMotion: false,
  seedFocus: 1, seedLightOffset: 0,
}

describe('LiquidGraphic', () => {
  it('draws body, glow, surface and rim as one coherent graphic', () => {
    const html = renderToStaticMarkup(createElement(LiquidGraphic, base))
    expect(html).toContain('data-vial-detail="liquid-body"')
    expect(html).toContain('data-vial-detail="liquid-glow"')
    expect(html).toContain('data-vial-detail="liquid-surface"')
    expect(html).toContain('data-vial-detail="liquid-rim"')
  })

  it('places the chamber where the caller asked for it', () => {
    const html = renderToStaticMarkup(createElement(LiquidGraphic, base))
    expect(html).toContain('x="29.4"')
    expect(html).toContain('y="146.6"')
    expect(html).toContain('width="61.2"')
    expect(html).toContain('height="126.8"')
  })

  it('omits bubbles when they are switched off', () => {
    const html = renderToStaticMarkup(createElement(LiquidGraphic, { ...base, bubbles: false }))
    expect(html).not.toContain('data-vial-detail="liquid-bubble"')
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/stage/LiquidGraphic.test.ts`
Expected: FAIL — `Cannot find module './LiquidGraphic'`.

- [ ] **Step 3: `LiquidGraphic` implementieren**

Die Konstante `LIQUID_BUBBLES` aus `PeptideVialVisual.tsx:9-15` und die JSX von `<g data-vial-detail="liquid-glass-window" …>` bis zu ihrem Schließen (`PeptideVialVisual.tsx:565-700`) werden **unverändert** übernommen. Geändert wird nur, was vorher aus dem Elternscope kam:

- `uid` wird Prop statt `useId()`,
- `fillFrac` wird `fill`,
- `visualFocus` / `visualLightOffset` werden `seedFocus` / `seedLightOffset`,
- die Kammer-Koordinaten `x="4" y="36" width="112" height="247"` werden zu `x={x} y={y} width={width} height={height}`,
- `buildLiquid` wird mit `chamberAspect` aufgerufen,
- `clipPath={`url(#${uid}-liquidChamberClip)`}` wird `clipPath={`url(#${clipPathId})`}`.

Die `draw`-Funktion (`PeptideVialVisual.tsx:240-266`) und ihr `useEffect(() => subscribe(draw))` ziehen mit um. Neu ist das Handle für die stage-light-abhängigen Teile:

```tsx
  const applyStageLight = useCallback((focus: number, lightOffset: number) => {
    refractLeftRef.current?.setAttribute('x', (5 + lightOffset * 8).toFixed(2))
    refractLeftRef.current?.setAttribute('opacity', (0.46 + focus * 0.22).toFixed(3))
    refractRightRef.current?.setAttribute('x', (99 + lightOffset * 5).toFixed(2))
    refractRightRef.current?.setAttribute('opacity', (0.14 + focus * 0.16).toFixed(3))
    surfaceRef.current?.setAttribute('opacity', (0.4 + focus * 0.14).toFixed(3))
  }, [])

  useImperativeHandle(handleRef, () => ({ applyStageLight }), [applyStageLight])
```

- [ ] **Step 4: Das Vial darauf umstellen**

Der ersetzte Block wird zu:

```tsx
              <LiquidGraphic
                uid={uid}
                fill={fillFrac}
                color={color}
                chamberAspect={REFERENCE_CHAMBER_ASPECT}
                x={4} y={36} width={112} height={247}
                clipPathId={`${uid}-liquidChamberClip`}
                bubbles
                reducedMotion={reducedMotion}
                seedFocus={visualFocus}
                seedLightOffset={visualLightOffset}
                motionClass={liquidMotionClass}
                motionStyle={liquidMotionStyle}
                motionKey={fillMotion.epoch}
                introDurationMs={fillIntroDurationMs}
                introReveal={fillMotion.mode === 'reveal'}
                handleRef={liquidRef}
              />
```

In `applyStageLight` des Vials werden die fünf herausgezogenen Zeilen ersetzt durch:

```ts
    liquidRef.current?.applyStageLight(f, o)
```

Die Refs `refractLeftRef`, `refractRightRef`, `surfaceRef`, `bodyRef`, `glowRef`, `rimRef`, `specHaloRef`, `specCoreRef`, `leftGlintRef`, `rightGlintRef` sowie die `draw`-Funktion und ihr `useEffect` entfallen im Vial.

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack/stage src/components/PeptideVialVisual.test.ts`
Expected: PASS. Kritisch sind `draws the liquid as one SVG graphic, not a block with a separate waterline band`, `drives a living, physics-coupled surface with rising bubbles`, `clips the liquid to the new vial chamber instead of a rectangular window` und `animates fill-level changes inside the integrated glass window`.

- [ ] **Step 6: Volle Suite und Commit**

Run: `npm test`
Expected: PASS.

```bash
git add src/features/my-stack/stage/LiquidGraphic.tsx src/features/my-stack/stage/LiquidGraphic.test.ts src/components/PeptideVialVisual.tsx
git commit -m "refactor: extract the liquid graphic"
```

---

### Task 6: Bühnentypen definieren

**Files:**
- Create: `src/features/my-stack/stage/types.ts`
- Test: `src/features/my-stack/stage/types.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`src/features/my-stack/stage/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { carriesLabel, type StageFormSpec } from './types'

const withChamber: StageFormSpec = {
  viewBox: { x: 0, y: 0, width: 120, height: 294 },
  chamber: { x: 4, y: 36, width: 112, height: 247, aspect: 0.794 },
  hasMeaningfulFill: true,
}

const withoutChamber: StageFormSpec = {
  viewBox: { x: 0, y: 0, width: 120, height: 120 },
  chamber: null,
  hasMeaningfulFill: false,
}

describe('carriesLabel', () => {
  it('gives a label to every container that holds liquid', () => {
    expect(carriesLabel(withChamber)).toBe(true)
  })

  it('withholds the label from forms without a liquid chamber', () => {
    expect(carriesLabel(withoutChamber)).toBe(false)
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/stage/types.test.ts`
Expected: FAIL — `Cannot find module './types'`.

- [ ] **Step 3: Die Typen implementieren**

`src/features/my-stack/stage/types.ts`:

```ts
export interface StageBox {
  x: number
  y: number
  width: number
  height: number
}

export interface StageChamber extends StageBox {
  // Breite geteilt durch Höhe der gerenderten Kammer in Pixeln. Steuert, wie
  // stark die Oberfläche beim Slosh kippt.
  aspect: number
}

export interface StageFormSpec {
  viewBox: StageBox
  // null für Formen ohne Flüssigkeit — Tablette, Kapsel, Pflaster.
  chamber: StageChamber | null
  // Ob der Füllstand dieser Form etwas aussagt. Das Vial wird leergezogen,
  // eine Ampulle ist voll oder weg.
  hasMeaningfulFill: boolean
}

// Ein Behälter mit Flüssigkeit trägt unser Etikett, alles andere nicht. Das
// wird bewusst aus der Kammer abgeleitet statt separat gepflegt, damit beide
// Angaben nicht auseinanderlaufen können.
export function carriesLabel(spec: StageFormSpec): boolean {
  return spec.chamber !== null
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run src/features/my-stack/stage/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/stage/types.ts src/features/my-stack/stage/types.test.ts
git commit -m "feat: add stage form capabilities"
```

---

### Task 7: Ampullenform als reine Daten

**Files:**
- Create: `src/features/my-stack/extensions/ampoule/ampouleShape.ts`
- Test: `src/features/my-stack/extensions/ampoule/ampouleShape.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  AMPOULE_FILL, AMPOULE_INNER_PATH, AMPOULE_LABEL, AMPOULE_OUTER_PATH, AMPOULE_SPEC,
} from './ampouleShape'

describe('ampouleShape', () => {
  it('closes both contours so they can be used as fills and clips', () => {
    expect(AMPOULE_OUTER_PATH.startsWith('M')).toBe(true)
    expect(AMPOULE_OUTER_PATH.trimEnd().endsWith('Z')).toBe(true)
    expect(AMPOULE_INNER_PATH.startsWith('M')).toBe(true)
    expect(AMPOULE_INNER_PATH.trimEnd().endsWith('Z')).toBe(true)
  })

  it('keeps the liquid chamber inside the inner contour', () => {
    // Innenkontur: x 29.4..90.6, Boden bei y 273.4
    expect(AMPOULE_SPEC.chamber?.x).toBeGreaterThanOrEqual(29.4)
    expect((AMPOULE_SPEC.chamber?.x ?? 0) + (AMPOULE_SPEC.chamber?.width ?? 0)).toBeLessThanOrEqual(90.6)
    expect((AMPOULE_SPEC.chamber?.y ?? 0) + (AMPOULE_SPEC.chamber?.height ?? 0)).toBeLessThanOrEqual(273.4)
  })

  it('describes a chamber narrower than the vial so the tilt gets damped', () => {
    expect(AMPOULE_SPEC.chamber?.aspect).toBeCloseTo(0.483, 2)
    expect(AMPOULE_SPEC.chamber?.aspect).toBeLessThan(0.794)
  })

  it('has no meaningful fill but does carry a label', () => {
    expect(AMPOULE_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(AMPOULE_SPEC)).toBe(true)
  })

  it('leaves head space under the tip instead of filling to the brim', () => {
    expect(AMPOULE_FILL).toBeGreaterThan(0.8)
    expect(AMPOULE_FILL).toBeLessThan(1)
  })

  it('centres the label on the straight glass body', () => {
    // Körper 75.5..143.7 px von 146.7 → Mitte bei 109.6, Band 21 hoch
    expect(AMPOULE_LABEL.topPct).toBeCloseTo(0.676, 2)
    expect(AMPOULE_LABEL.heightPct).toBeCloseTo(0.142, 2)
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/ampoule/ampouleShape.test.ts`
Expected: FAIL — `Cannot find module './ampouleShape'`.

- [ ] **Step 3: Die Formdaten anlegen**

```ts
import type { StageFormSpec } from '../../stage/types'

// Klassische Brechampulle: runde Spitze, breiter Kopf, sanfte Einschnürung,
// konische Schulter, gerader Zylinder, flacher Boden mit Punt.
export const AMPOULE_OUTER_PATH = 'M60 7 C 66 7 68 12 68.5 18 C 70 30 74 44 77 58 C 79.5 69 80 76 79 82 C 78 88 74 90.5 72 95 C 70.5 98.5 71 103 74 107 C 80 115 88 122 91.5 130 C 93.6 135 94 140 94 146 L 94 262 C 94 272 89 277 80 277 L 40 277 C 31 277 26 272 26 262 L 26 146 C 26 140 26.4 135 28.5 130 C 32 122 40 115 46 107 C 49 103 49.5 98.5 48 95 C 46 90.5 42 88 41 82 C 40 76 40.5 69 43 58 C 46 44 50 30 51.5 18 C 52 12 54 7 60 7 Z'

// Nach innen versetzte Kontur. Sie bildet die Glaswandstärke ab — die
// Doppellinie, die einen Hohlkörper von einer Silhouette unterscheidet — und
// beschneidet die Flüssigkeit, damit unten ein Glasboden stehen bleibt.
export const AMPOULE_INNER_PATH = 'M60 11.5 C 64.4 11.5 64.9 14.4 65.4 19.2 C 66.8 31 70.9 45 73.8 59 C 76.1 69.6 76.6 76.1 75.7 81.6 C 74.8 87 71.1 89.6 69.1 94 C 67.7 97.4 68.1 101.9 70.9 105.8 C 76.7 113.7 84.9 120.7 88.4 130.9 C 90.4 135.8 90.6 140.8 90.6 146.6 L 90.6 261 C 90.6 269 86.6 273.4 79.2 273.4 L 40.8 273.4 C 33.4 273.4 29.4 269 29.4 261 L 29.4 146.6 C 29.4 140.8 29.6 135.8 31.6 130.9 C 35.1 120.7 43.3 113.7 49.1 105.8 C 51.9 101.9 52.3 97.4 50.9 94 C 48.9 89.6 45.2 87 44.3 81.6 C 43.4 76.1 43.9 69.6 46.2 59 C 49.1 45 53.2 31 54.6 19.2 C 55.1 14.4 55.6 11.5 60 11.5 Z'

// Eine versiegelte Ampulle ist nie randvoll; der Luftraum unter der Spitze ist
// real und liefert nebenbei die freie Oberfläche für den Slosh.
export const AMPOULE_FILL = 0.94

// Anteilige Lage des Etiketts, damit Karussell und Detailansicht dasselbe
// Verhältnis halten: 99/146.7 bzw. 247/365.
export const AMPOULE_LABEL = { topPct: 0.676, heightPct: 0.142 } as const

export const AMPOULE_SPEC: StageFormSpec = {
  viewBox: { x: 24, y: 5, width: 72, height: 274 },
  // Nur der gerade Zylinder. Dadurch bleibt die Kammer rechteckig und die
  // Geometrie braucht kein Breitenprofil für den konischen Hals.
  chamber: { x: 29.4, y: 146.6, width: 61.2, height: 126.8, aspect: 0.483 },
  hasMeaningfulFill: false,
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/ampoule/ampouleShape.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/extensions/ampoule/ampouleShape.ts src/features/my-stack/extensions/ampoule/ampouleShape.test.ts
git commit -m "feat: add ampoule shape data"
```

---

### Task 8: `AmpouleVisual` komponieren

**Files:**
- Create: `src/features/my-stack/extensions/ampoule/AmpouleVisual.tsx`
- Test: `src/features/my-stack/extensions/ampoule/AmpouleVisual.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AmpouleVisual } from './AmpouleVisual'

const base = { name: 'Testosteron Enantat', amount: 250, unit: 'mg / ml', color: '#e0a23f' }

describe('AmpouleVisual', () => {
  it('marks itself as the ampoule renderer', () => {
    expect(renderToStaticMarkup(createElement(AmpouleVisual, base)))
      .toContain('data-stack-renderer="ampoule"')
  })

  it('draws two contours so the glass reads as a hollow body', () => {
    const html = renderToStaticMarkup(createElement(AmpouleVisual, base))
    expect(html).toContain('data-ampoule-detail="outer-contour"')
    expect(html).toContain('data-ampoule-detail="inner-contour"')
  })

  it('keeps the wall visible at carousel width by not scaling its stroke', () => {
    const html = renderToStaticMarkup(createElement(AmpouleVisual, { ...base, size: 'carousel' as const }))
    expect(html).toContain('vector-effect="non-scaling-stroke"')
  })

  it('clips the liquid with the inner contour, never the outer one', () => {
    const html = renderToStaticMarkup(createElement(AmpouleVisual, base))
    const clip = html.match(/id="([^"]*-innerClip)"/)?.[1]
    expect(clip).toBeTruthy()
    expect(html).toContain(`clip-path="url(#${clip})"`)
  })

  it('scales uniformly so the proportions survive every size', () => {
    const html = renderToStaticMarkup(createElement(AmpouleVisual, base))
    expect(html).not.toContain('preserveAspectRatio="none"><svg')
    expect(html).toContain('viewBox="24 5 72 274"')
  })

  it('carries the label with name and amount', () => {
    const html = renderToStaticMarkup(createElement(AmpouleVisual, base))
    expect(html).toContain('Testosteron Enantat')
    expect(html).toContain('250 mg / ml')
  })

  it('leaves the amount line out instead of inventing a placeholder', () => {
    const html = renderToStaticMarkup(createElement(AmpouleVisual, { ...base, amount: null, unit: null }))
    expect(html).toContain('Testosteron Enantat')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('null')
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/ampoule/AmpouleVisual.test.ts`
Expected: FAIL — `Cannot find module './AmpouleVisual'`.

- [ ] **Step 3: Die Komponente implementieren**

`src/features/my-stack/extensions/ampoule/AmpouleVisual.tsx`. Aufbau von außen nach innen: Bodenschatten, Außenkontur mit Glasgradient, Bloom und Sweep innerhalb der Außenkontur, `LiquidGraphic` innerhalb der **Innen**kontur, Glasboden mit Punt, Innenkontur als Wandlinie, konturgeführte Kantenlichter, `StageLabel`.

```tsx
import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { LiquidGraphic, type LiquidGraphicHandle } from '../../stage/LiquidGraphic'
import { StageLabel } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import { AMPOULE_FILL, AMPOULE_INNER_PATH, AMPOULE_LABEL, AMPOULE_OUTER_PATH, AMPOULE_SPEC } from './ampouleShape'

export interface AmpouleVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  color: string
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

function amountLabel(amount?: string | number | null, unit?: string | null): string | null {
  if (amount === null || amount === undefined || amount === '') return null
  return unit ? `${amount} ${unit}` : String(amount)
}
```

Der Komponentenkörper beginnt mit denselben abgeleiteten Werten wie das Vial,
damit sich Focus und Licht identisch verhalten:

```tsx
export function AmpouleVisual({
  name, amount, unit, color, size = 'large', className = '',
  isActive = true, focus, lightOffset = 0, stageLightRef,
}: AmpouleVisualProps) {
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0)

  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = Number.isFinite(lightOffset)
    ? Math.max(-1, Math.min(1, lightOffset))
    : 0
  const labelName = name?.trim() || 'Ampulle'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const bloomRef = useRef<SVGRectElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const hiLeftRef = useRef<SVGGElement | null>(null)
  const hiRightRef = useRef<SVGGElement | null>(null)
  const liquidRef = useRef<LiquidGraphicHandle | null>(null)
```

Die Typografie folgt derselben Staffelung wie beim Vial, nur eine Stufe kleiner,
weil die Ampulle schmaler ist:

```tsx
  const nameClass = size === 'large'
    ? 'text-base sm:text-lg leading-tight font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
    : size === 'carousel'
      ? 'text-[8.5px] sm:text-[10px] leading-tight font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
      : 'text-[7px] leading-tight font-black text-white'
  const amountClass = size === 'large'
    ? 'text-[10px] sm:text-xs mt-0.5 font-bold uppercase tracking-wide text-white/90'
    : 'text-[6px] mt-0.5 font-bold uppercase tracking-wide text-white/90'
```

Dann folgen `applyStageLight` und der Hook:

```tsx
  const applyStageLight = useCallback((focus: number, lightOffset: number) => {
    rootRef.current?.setAttribute('data-ampoule-focus', focus.toFixed(2))
    rootRef.current?.setAttribute('data-ampoule-light-offset', lightOffset.toFixed(2))
    shadowRef.current?.setAttribute('cx', (60 - lightOffset * 6).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + focus * 0.28).toFixed(3))
    bloomRef.current?.setAttribute('transform', `translate(${(lightOffset * 14).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('transform', `translate(${(lightOffset * 22).toFixed(2)} 0)`)
    hiLeftRef.current?.setAttribute('opacity', Math.max(0.08, Math.min(1, 0.6 - lightOffset * 0.6)).toFixed(3))
    hiRightRef.current?.setAttribute('opacity', Math.max(0.08, Math.min(1, 0.5 + lightOffset * 0.6)).toFixed(3))
    liquidRef.current?.applyStageLight(focus, lightOffset)
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)
```

Die Breite ergibt sich aus dem Seitenverhältnis der viewBox, damit die Proportionen erhalten bleiben — `72 / 274 ≈ 0.263` der Höhe:

```tsx
  const heightClass = size === 'carousel' ? 'h-[146.7px] sm:h-[186.4px]'
    : size === 'large' ? 'h-[365px]'
    : size === 'mini' ? 'h-[60px]' : 'h-[110px]'
```

Die Flüssigkeit:

```tsx
        <g clipPath={`url(#${uid}-innerClip)`}>
          <LiquidGraphic
            uid={`${uid}-liquid`}
            fill={AMPOULE_FILL}
            color={color}
            chamberAspect={AMPOULE_SPEC.chamber!.aspect}
            x={AMPOULE_SPEC.chamber!.x}
            y={AMPOULE_SPEC.chamber!.y}
            width={AMPOULE_SPEC.chamber!.width}
            height={AMPOULE_SPEC.chamber!.height}
            clipPathId={`${uid}-innerClip`}
            bubbles={size === 'large'}
            reducedMotion={reducedMotion}
            seedFocus={visualFocus}
            seedLightOffset={visualLightOffset}
            handleRef={liquidRef}
          />
        </g>
```

Das Etikett wird anteilig positioniert:

```tsx
      <StageLabel
        name={labelName}
        detail={amountLabel(amount, unit)}
        className=""
        nameClassName={nameClass}
        detailClassName={amountClass}
        wrapperProps={{ 'data-ampoule-detail': 'label' }}
        innerProps={{ 'data-ampoule-detail': 'label-inner' }}
      />
```

mit `style={{ top: `${AMPOULE_LABEL.topPct * 100}%`, height: `${AMPOULE_LABEL.heightPct * 100}%` }}` am umgebenden Element, links und rechts 4 % Einzug, damit das Band auf dem Glas sitzt.

Beide Konturen tragen `vector-effect="non-scaling-stroke"`, damit die Glaswand bei 38,6 px Breite nicht unter ein Pixel fällt.

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/ampoule`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/extensions/ampoule/AmpouleVisual.tsx src/features/my-stack/extensions/ampoule/AmpouleVisual.test.ts
git commit -m "feat: render the ampoule stage form"
```

---

### Task 9: Renderer-Adapter und Bühnenweiche

**Files:**
- Create: `src/features/my-stack/extensions/ampoule/AmpouleRenderer.tsx`
- Modify: `src/features/my-stack/lib/dosageForms.ts:8`, `:13`
- Modify: `src/features/my-stack/components/StackStage.tsx`
- Test: `src/features/my-stack/components/StackStage.test.ts` (nur ergänzen, nichts ändern)

- [ ] **Step 1: Den fehlschlagenden Test ergänzen**

Ans Ende von `StackStage.test.ts` anfügen — die drei bestehenden Tests bleiben unangetastet:

```ts
const ampouleItem: StackItem = {
  ...vialItem,
  id: 'testosteron-ampoule',
  display_name: 'Testosteron Enantat',
  category: 'hormone',
  dosage_form: 'ampoule',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Testosteron Enantat',
    amount_value: 250,
    amount_unit: 'mg',
    basis_unit: 'ml',
  }],
}

describe('StackStage — Ampulle', () => {
  it('rendert die Ampulle für Ampullen-Einträge', () => {
    expect(renderStage(ampouleItem)).toContain('data-stack-renderer="ampoule"')
  })

  it('lässt unbekannte Formen weiterhin im Textzustand', () => {
    expect(renderStage(capsuleItem)).toContain('data-stack-renderer="unsupported"')
  })

  it('hält den Ampullen-Adapter frei von eigener Grafik', () => {
    const source = readFileSync(new URL('../extensions/ampoule/AmpouleRenderer.tsx', import.meta.url), 'utf8')
    expect(source).toContain('AmpouleVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('lucide-react')
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/components/StackStage.test.ts`
Expected: FAIL — `data-stack-renderer="unsupported"` statt `"ampoule"`.

- [ ] **Step 3: Den Adapter anlegen**

`src/features/my-stack/extensions/ampoule/AmpouleRenderer.tsx`:

```tsx
import type { Ref } from 'react'
import { AmpouleVisual } from './AmpouleVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StackItem } from '../../types'

export interface AmpouleRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
  sloshEngine?: SloshEngine
}

export function AmpouleRenderer({ item, sloshEngine, ...visualProps }: AmpouleRendererProps) {
  const ingredient = item.ingredients[0]
  const ampoule = (
    <AmpouleVisual
      name={item.display_name}
      amount={ingredient?.amount_value}
      unit={ingredient?.amount_unit && ingredient?.basis_unit
        ? `${ingredient.amount_unit} / ${ingredient.basis_unit}`
        : ingredient?.amount_unit}
      color={item.color_hex ?? '#64748b'}
      {...visualProps}
    />
  )

  return (
    <div data-stack-renderer="ampoule">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{ampoule}</SloshProvider> : ampoule}
    </div>
  )
}
```

- [ ] **Step 4: Die Form freischalten und die Weiche erweitern**

In `src/features/my-stack/lib/dosageForms.ts` die Zeile für `ampoule` um den Renderer ergänzen und `DosageFormDefinition` um `stageForm` erweitern:

```ts
import { AMPOULE_SPEC } from '../extensions/ampoule/ampouleShape'
import { VIAL_SPEC } from '../extensions/peptide/vialShape'
import type { StageFormSpec } from '../stage/types'

export interface DosageFormDefinition {
  readonly key: DosageFormKey
  readonly labelKey: string
  readonly suggestedUnits: readonly string[]
  readonly basisUnits: readonly string[]
  readonly capabilities: readonly DosageFormCapability[]
  readonly stageRenderer?: 'vial' | 'ampoule'
  readonly stageForm?: StageFormSpec
}
```

Die beiden Einträge bekommen `stageRenderer` und `stageForm`; alle anderen bleiben unverändert. Dafür wird `src/features/my-stack/extensions/peptide/vialShape.ts` neu angelegt:

```ts
import type { StageFormSpec } from '../../stage/types'

export const VIAL_SPEC: StageFormSpec = {
  viewBox: { x: 0, y: 0, width: 120, height: 294 },
  chamber: { x: 4, y: 36, width: 112, height: 247, aspect: 0.794 },
  hasMeaningfulFill: true,
}
```

`StackStage.tsx` tauscht den Import `isStageRenderable` gegen `getDosageForm` und
verzweigt auf `stageRenderer`, ohne selbst SVG zu enthalten. **`isStageRenderable`
bleibt in `dosageForms.ts` erhalten** — die Funktion hat einen eigenen Test in
`dosageForms.test.ts` und wird nicht gelöscht, nur hier nicht mehr benutzt:

```tsx
export function StackStage({ item, ...visualProps }: StackStageProps) {
  const { t } = useTranslation()
  const renderer = getDosageForm(item.dosage_form).stageRenderer

  if (renderer === 'vial') return <VialRenderer item={item} {...visualProps} />
  if (renderer === 'ampoule') return <AmpouleRenderer item={item} {...visualProps} />

  return (
    <div
      data-stack-renderer="unsupported"
      className="flex min-h-28 flex-col justify-center rounded-2xl border border-slate-700/70 bg-slate-950/80 px-5 py-4 shadow-[0_18px_45px_rgba(2,6,23,0.32)]"
    >
      <p className="font-semibold text-white">{item.display_name}</p>
      <p className="mt-1 text-sm text-slate-400">{t('my_stack_visual_pending')}</p>
    </div>
  )
}
```

`fillPct` wird an `AmpouleRenderer` bewusst nicht durchgereicht; `StackStageProps` trennt die gemeinsamen Bühnen-Props vom vial-eigenen `fillPct`.

- [ ] **Step 5: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack`
Expected: PASS, inklusive der drei unveränderten Alt-Tests in `StackStage.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/features/my-stack/extensions src/features/my-stack/lib/dosageForms.ts src/features/my-stack/components/StackStage.tsx src/features/my-stack/components/StackStage.test.ts
git commit -m "feat: route ampoule items to the ampoule stage"
```

---

### Task 10: Prozentzeile an den Füllstand der Form binden

**Files:**
- Modify: `src/features/my-stack/MyStackPage.tsx:2029-2033`
- Test: `src/features/my-stack/MyStackPage.visibility.test.tsx`

- [ ] **Step 1: Den fehlschlagenden Test ergänzen**

```tsx
it('zeigt die Prozentzeile nur bei Formen mit aussagekräftigem Füllstand', () => {
  expect(getDosageForm('vial').stageForm?.hasMeaningfulFill).toBe(true)
  expect(getDosageForm('ampoule').stageForm?.hasMeaningfulFill).toBe(false)

  const source = readFileSync(new URL('./MyStackPage.tsx', import.meta.url), 'utf8')
  expect(source).toContain('hasMeaningfulFill')
  expect(source).not.toMatch(/dosage_form === 'ampoule'/)
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/MyStackPage.visibility.test.tsx`
Expected: FAIL — `MyStackPage.tsx` enthält `hasMeaningfulFill` noch nicht.

- [ ] **Step 3: Die Zeile binden**

In `MyStackPage.tsx` innerhalb der Karussell-Map vor dem `return`:

```tsx
                    const showsFillPct = getDosageForm(p.dosage_form).stageForm?.hasMeaningfulFill ?? false
```

und die Bedingung ändern:

```tsx
                        {isActive && showsFillPct && (
                          <p className="mt-1 text-center text-xs font-semibold tabular-nums text-slate-400">
                            {Math.round(vialPct)}%
                          </p>
                        )}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/MyStackPage.tsx src/features/my-stack/MyStackPage.visibility.test.tsx
git commit -m "feat: bind the fill percentage to forms that have one"
```

---

### Task 11: Regression, Build und Graph

**Files:**
- Modify: `graphify-out/` (generiert)

- [ ] **Step 1: Volle Suite**

Run: `npm test`
Expected: PASS. Die Testanzahl liegt über dem Stand unmittelbar vor Task 1; keiner der 24 Vial-Tests darf fehlschlagen.

- [ ] **Step 2: Typen und Build**

Run: `npm run build`
Expected: erfolgreicher `tsc -b` und Vite-Build ohne neue Fehler.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: keine neuen Verstöße gegenüber dem Stand vor Task 1.

- [ ] **Step 4: Sichtprüfung im Browser**

Dev-Server starten und in My Stack prüfen:

1. Ein bestehender Vial-Eintrag sieht unverändert aus — Kappe, Etikett, Flüssigkeit, Slosh beim Wischen, Prozentzeile.
2. Ein Ampullen-Eintrag zeigt die Ampulle: doppelte Glaskante, Flüssigkeit endet an der Innenwand mit Glasboden darunter, Etikett mittig auf dem Glaskörper, keine Prozentzeile.
3. Beim Wischen kippt die Ampulle sichtbar sanfter als das Vial.
4. Beide Objekte stehen auf derselben Bodenlinie und sind gleich hoch.
5. Die Ampulle behält in der Detailansicht ihre Proportionen.

- [ ] **Step 5: Graph aktualisieren**

Run: `graphify update .`
Den Diff auf fremde Pfade prüfen, dann die aktualisierten Artefakte behalten — dieses Repository versioniert `graphify-out/`.

- [ ] **Step 6: Commit**

```bash
git add graphify-out
git commit -m "chore: refresh the knowledge graph"
```

---

## Final Acceptance Criteria

- Ein Ampullen-Eintrag wird im Karussell und in der Detailansicht als Ampulle gerendert.
- Die Flüssigkeit wird von der Innenkontur beschnitten; darunter bleibt sichtbarer Glasboden mit Punt.
- Die Ampulle skaliert uniform und ist genauso hoch wie das Vial.
- Das Etikett sitzt mittig auf dem Glaskörper und zeigt Name und Menge; fehlt die Menge, bleibt die Zeile leer.
- Die Ampulle kippt beim Wischen mit vergleichbarem Oberflächenwinkel wie das Vial, nicht mit gleichem Hub.
- Formen ohne Flüssigkeitskammer bekommen kein Etikett.
- Die Prozentzeile erscheint beim Vial und entfällt bei der Ampulle.
- Kein Bühnen-Code verzweigt auf `dosage_form`, um über Etikett oder Füllstand zu entscheiden.
- Die 24 bestehenden Vial-Tests und die drei bestehenden `StackStage`-Tests sind unverändert und grün.
- Keine neuen i18n-Schlüssel; der i18n-Vertrag bleibt grün.
- `npm test`, `npm run build` und `npm run lint` laufen ohne neue Fehler.
