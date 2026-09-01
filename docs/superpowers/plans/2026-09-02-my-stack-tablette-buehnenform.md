# Tablette als vierte Bühnenform — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Tablette als vierte Bühnenform rendern — flacher Kreis von oben, waagerechte Bruchrille, Name darunter, ohne Bewegung.

**Architecture:** Alles Neue liegt in `src/features/my-stack/extensions/tablet/`. Geteilt werden `useStageLight` und `StageMarquee`; der Glas-Malstapel entfällt vollständig, weil eine Tablette undurchsichtig ist. `StageFormSpec` bekommt kein neues Feld — `chamber: null` liefert wieder „kein Etikett" und „kein Füllstand".

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Tailwind, Inline-SVG.

**Spec:** `docs/superpowers/specs/2026-09-02-my-stack-tablette-buehnenform-design.md`

---

## Global Constraints

1. **Die Suiten von Vial, Ampulle und Kapsel bleiben unverändert grün.**
2. **Die Tablette ist heute das Negativbeispiel.** `StackStage.test.ts` (Zeilen 39, 61, 65, 119) und `MyStackPage.visibility.test.tsx` benutzen sie als „Form ohne Bühnengrafik". Diese Rolle zieht auf `patch` um. Damit das nicht bei jeder weiteren Form erneut still bricht, kommt eine Wache dazu, die das Negativbeispiel gegen `DOSAGE_FORMS` prüft und im Fehlerfall sagt, was zu tun ist.
3. **`dosageForms.test.ts` erwartet heute `['vial', 'ampoule', 'capsule']`** und `isStageRenderable('tablet') === false`. Beides wird gehoben, weiterhin streng.
4. **Kein Glas-Malstapel.** `TabletVisual.tsx` enthält keine zweite Kontur, keinen Sweep, keinen Innenclip.
5. **Keine Slosh-Anbindung**, kein SVG-Text.
6. Testbefehl `npx vitest run <pfad>`, volle Suite `npm test`, alles aus dem Worktree.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `extensions/tablet/tabletShape.ts` | Kreismaße, Rillen- und Namenslage, `StageFormSpec`. Reine Daten. |
| `extensions/tablet/tabletShape.test.ts` | Prüft die Formkonstanten. |
| `extensions/tablet/TabletVisual.tsx` | Körper, Rille, Lichtfleck, Beschriftung. |
| `extensions/tablet/TabletVisual.test.ts` | Strukturtests. |
| `extensions/tablet/TabletRenderer.tsx` | Adapter von `StackItem` auf `TabletVisual`. |

Geändert: `lib/dosageForms.ts`, `lib/dosageForms.test.ts`, `components/StackStage.tsx`, `components/StackStage.test.ts`, `MyStackPage.visibility.test.tsx`, `src/pages/__VialPreview.tsx`.

---

### Task 1: Formdaten der Tablette

**Files:**
- Create: `src/features/my-stack/extensions/tablet/tabletShape.ts`
- Test: `src/features/my-stack/extensions/tablet/tabletShape.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  TABLET_BODY, TABLET_BODY_NORMALIZED, TABLET_NAME_TOP_PCT,
  TABLET_SCORE, TABLET_SPEC, TABLET_VIEWBOX,
} from './tabletShape'

describe('tabletShape', () => {
  it('ist quadratisch, damit der Kreis bei jeder Groesse rund bleibt', () => {
    expect(TABLET_VIEWBOX.width).toBe(TABLET_VIEWBOX.height)
  })

  it('fuellt den Kasten fast vollstaendig aus', () => {
    const diameter = TABLET_BODY.r * 2
    expect(diameter / TABLET_VIEWBOX.width).toBeGreaterThan(0.9)
    expect(diameter / TABLET_VIEWBOX.width).toBeLessThanOrEqual(1)
  })

  it('legt die Bruchrille waagerecht auf die Mittellinie', () => {
    expect(TABLET_SCORE.y).toBe(TABLET_BODY.cy)
    expect(TABLET_SCORE.x1).toBeLessThan(TABLET_SCORE.x2)
  })

  it('laesst die Rille ueber nahezu den ganzen Durchmesser laufen', () => {
    const span = TABLET_SCORE.x2 - TABLET_SCORE.x1
    expect(span / (TABLET_BODY.r * 2)).toBeGreaterThan(0.85)
  })

  it('setzt den Namen unter die Rille, nicht darauf', () => {
    const nameY = TABLET_NAME_TOP_PCT * TABLET_VIEWBOX.height
    expect(nameY).toBeGreaterThan(TABLET_SCORE.y)
    // und noch innerhalb des Kreises
    expect(nameY).toBeLessThan(TABLET_BODY.cy + TABLET_BODY.r)
  })

  it('beschreibt denselben Kreis in objektbezogenen Einheiten', () => {
    // Die HTML-Beschriftung kann nur so beschnitten werden; beide Fassungen
    // muessen zwingend denselben Kreis meinen.
    expect(TABLET_BODY_NORMALIZED.cx).toBeCloseTo(TABLET_BODY.cx / TABLET_VIEWBOX.width, 4)
    expect(TABLET_BODY_NORMALIZED.cy).toBeCloseTo(TABLET_BODY.cy / TABLET_VIEWBOX.height, 4)
    expect(TABLET_BODY_NORMALIZED.r).toBeCloseTo(TABLET_BODY.r / TABLET_VIEWBOX.width, 4)
  })

  it('hat keine Fluessigkeitskammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(TABLET_SPEC.chamber).toBeNull()
    expect(TABLET_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(TABLET_SPEC)).toBe(false)
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/tablet/tabletShape.test.ts`
Expected: FAIL — `Cannot find module './tabletShape'`.

- [ ] **Step 3: Die Formdaten anlegen**

```ts
import type { StageFormSpec } from '../../stage/types'

// Quadratischer Kasten, damit der Kreis bei jeder Skalierung rund bleibt.
export const TABLET_VIEWBOX = { x: 0, y: 0, width: 100, height: 100 } as const

// Der Kreis füllt den Kasten fast vollständig; der Rest ist Luft für den
// Bodenschatten, der mit overflow-visible darunter gezeichnet wird.
export const TABLET_BODY = { cx: 50, cy: 50, r: 48 } as const

// Waagerecht auf der Mittellinie, über nahezu den vollen Durchmesser. Die
// Rille ist der sichtbare Ausdruck von `divisible` und das einzige Merkmal,
// das eine Tablette von einem Dragée unterscheidet.
export const TABLET_SCORE = { x1: 6, x2: 94, y: 50 } as const

// Mitte des Namens auf 62 % der Höhe — ein Viertel Radius unter der Rille.
// Dort ist die Sehne breit genug und der Abstand zur Rille sichtbar.
export const TABLET_NAME_TOP_PCT = 0.62

// Derselbe Kreis in objektbezogenen Einheiten (0…1). Nur so kann er die
// HTML-Beschriftung beschneiden — CSS clip-path kennt die viewBox nicht.
export const TABLET_BODY_NORMALIZED = { cx: 0.5, cy: 0.5, r: 0.48 } as const

export const TABLET_SPEC: StageFormSpec = {
  viewBox: TABLET_VIEWBOX,
  // Kein Innenraum, keine Flüssigkeit: damit kein Etikett und kein Füllstand.
  chamber: null,
  hasMeaningfulFill: false,
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/tablet/tabletShape.test.ts`
Expected: PASS, 7 Tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/my-stack/extensions/tablet
git commit -m "feat: add tablet shape data"
```

---

### Task 2: `TabletVisual`

**Files:**
- Create: `src/features/my-stack/extensions/tablet/TabletVisual.tsx`
- Test: `src/features/my-stack/extensions/tablet/TabletVisual.test.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```ts
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TabletVisual } from './TabletVisual'

const base = { name: 'Ibuprofen', color: '#d9c39a' }
const render = (props: Partial<Parameters<typeof TabletVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(TabletVisual, { ...base, ...props }))

describe('TabletVisual', () => {
  it('meldet sich als Tabletten-Renderer', () => {
    expect(render()).toContain('data-tablet-detail="root"')
  })

  it('zeichnet einen Kreis mit waagerechter Bruchrille', () => {
    const html = render()
    expect(html).toContain('data-tablet-detail="body"')
    expect(html).toContain('data-tablet-detail="score"')
    // waagerecht: gleiche y-Koordinate an beiden Enden
    expect(html).toMatch(/data-tablet-detail="score"[^>]*y1="50"[^>]*y2="50"/)
  })

  it('bleibt bei jeder Groesse rund', () => {
    for (const size of ['large', 'carousel', 'compact', 'mini'] as const) {
      expect(render({ size })).toContain('aspect-square')
    }
  })

  it('haelt die im Spec festgelegten Durchmesser ein', () => {
    expect(render({ size: 'large' })).toContain('w-[160px]')
    expect(render({ size: 'carousel' })).toContain('w-[62px]')
    expect(render({ size: 'compact' })).toContain('w-[96px]')
    expect(render({ size: 'mini' })).toContain('w-[40px]')
  })

  it('faerbt das Material selbst statt eine Toenung darueberzulegen', () => {
    const html = render({ color: '#7dd3fc' })
    expect(html).toContain('#7dd3fc')
    // undurchsichtig: kein Glas-Malstapel
    expect(html).not.toContain('data-tablet-detail="sweep"')
  })

  it('setzt den Namen unter die Rille und beschneidet ihn am Kreis', () => {
    const html = render()
    expect(html).toContain('data-tablet-detail="name"')
    expect(html).toContain('top:62%')
    expect(html).toContain('clipPathUnits="objectBoundingBox"')
  })

  it('beschriftet wie alle anderen Formen', () => {
    const html = render()
    expect(html).toContain('font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]')
    expect(html).toContain('Ibuprofen')
  })

  it('faellt bei leerem Namen auf eine Bezeichnung zurueck', () => {
    expect(render({ name: '   ' })).toContain('Tablette')
  })

  it('bekommt weder Etikett noch Fuellstand', () => {
    const html = render()
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
    expect(html).not.toContain('data-fill-pct')
  })

  it('haengt nicht an der Slosh-Physik und zeichnet keinen SVG-Text', () => {
    const source = readFileSync(new URL('./TabletVisual.tsx', import.meta.url), 'utf8')
    expect(source).not.toContain('SloshContext')
    expect(source).not.toContain('sloshEngine')
    expect(source).not.toContain('<text')
  })

  it('nimmt Focus und Lichtversatz vom Karussell entgegen', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })
    expect(html).toContain('data-tablet-focus="0.42"')
    expect(html).toContain('data-tablet-light-offset="-0.35"')
  })
})
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/extensions/tablet/TabletVisual.test.ts`
Expected: FAIL — `Cannot find module './TabletVisual'`.

- [ ] **Step 3: Die Komponente implementieren**

```tsx
import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { StageMarquee } from '../../stage/StageLabel'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  TABLET_BODY, TABLET_BODY_NORMALIZED, TABLET_NAME_TOP_PCT, TABLET_SCORE,
} from './tabletShape'

export interface TabletVisualProps {
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

// Rund bei jeder Stufe. Bewusst groesser als massstaeblich richtig — eine echte
// Tablette waere rund 40 px, aber dann bliebe fuer den Namen nichts uebrig.
const SIZE_CLASS: Record<NonNullable<TabletVisualProps['size']>, string> = {
  large: 'w-[160px] max-w-full aspect-square',
  carousel: 'w-[62px] max-w-full aspect-square',
  compact: 'w-[96px] max-w-full aspect-square',
  mini: 'w-[40px] max-w-full aspect-square',
}

const NAME_CLASS: Record<NonNullable<TabletVisualProps['size']>, string> = {
  large: 'text-base leading-tight',
  carousel: 'text-[7px] leading-tight',
  compact: 'text-[10px] leading-tight',
  mini: 'text-[5px] leading-tight',
}

export function TabletVisual({
  name,
  color,
  size = 'large',
  className = '',
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
}: TabletVisualProps) {
  const uid = useId()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const tabletName = name?.trim() || 'Tablette'

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const glintRef = useRef<SVGEllipseElement | null>(null)
  const nameSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-tablet-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-tablet-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (50 - o * 5).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.28 + f * 0.3).toFixed(3))
    // Der Lichtfleck wandert ueber die gewoelbte Oberflaeche, statt dass ein
    // Sweep durch den Koerper zieht — undurchsichtiges Material laesst nichts
    // hindurch.
    glintRef.current?.setAttribute('cx', (34 + o * 22).toFixed(2))
    glintRef.current?.setAttribute('opacity', (0.16 + f * 0.24).toFixed(3))

    if (nameSheenRef.current) {
      nameSheenRef.current.style.transform = `translateX(${(o * 10).toFixed(2)}%)`
      nameSheenRef.current.style.opacity = (0.62 + f * 0.2).toFixed(3)
    }
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-tablet-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-tablet-focus={Number(visualFocus.toFixed(2))}
      data-tablet-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={tabletName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          {/* Gepresstes Pulver: Lichtquelle oben links, zur lichtabgewandten
              Seite hin dunkler. Der Verlauf moduliert nur die Helligkeit —
              die Farbe ist das Material selbst. */}
          <radialGradient id={`${uid}-press`} cx="36%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="52%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
          </radialGradient>
          <radialGradient id={`${uid}-shadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          {/* Der Kreis in objektbezogenen Einheiten beschneidet die
              HTML-Beschriftung, damit sie an der Rundung endet. */}
          <clipPath id={`${uid}-nameClip`} clipPathUnits="objectBoundingBox">
            <circle
              cx={TABLET_BODY_NORMALIZED.cx}
              cy={TABLET_BODY_NORMALIZED.cy}
              r={TABLET_BODY_NORMALIZED.r}
            />
          </clipPath>
        </defs>

        <ellipse
          ref={shadowRef}
          data-tablet-detail="shadow"
          cx={50 - visualLightOffset * 5}
          cy="102"
          rx="40"
          ry="5"
          fill={`url(#${uid}-shadow)`}
          opacity={0.28 + visualFocus * 0.3}
        />

        <circle
          data-tablet-detail="body"
          cx={TABLET_BODY.cx}
          cy={TABLET_BODY.cy}
          r={TABLET_BODY.r}
          fill={color}
        />
        <circle
          cx={TABLET_BODY.cx}
          cy={TABLET_BODY.cy}
          r={TABLET_BODY.r}
          fill={`url(#${uid}-press)`}
        />
        <circle
          cx={TABLET_BODY.cx}
          cy={TABLET_BODY.cy}
          r={TABLET_BODY.r}
          fill="none"
          stroke="rgba(255,255,255,0.32)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />

        {/* Bruchrille als Vertiefung: dunkle Linie mit heller Oberkante. */}
        <line
          data-tablet-detail="score"
          x1={TABLET_SCORE.x1}
          y1={TABLET_SCORE.y}
          x2={TABLET_SCORE.x2}
          y2={TABLET_SCORE.y}
          stroke="rgba(0,0,0,0.42)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <line
          x1={TABLET_SCORE.x1}
          y1={TABLET_SCORE.y - 1.4}
          x2={TABLET_SCORE.x2}
          y2={TABLET_SCORE.y - 1.4}
          stroke="rgba(255,255,255,0.36)"
          strokeWidth="0.9"
          strokeLinecap="round"
        />

        <ellipse
          ref={glintRef}
          data-tablet-detail="glint"
          cx={34 + visualLightOffset * 22}
          cy="30"
          rx="20"
          ry="12"
          fill="rgba(255,255,255,0.9)"
          opacity={0.16 + visualFocus * 0.24}
          filter={`url(#${uid}-soft)`}
        />
      </svg>

      {/* Beschriftet wie alle anderen Formen: HTML, dieselben Klassen, derselbe
          Durchlauf. Kein Band — die Tablette ist kein Behälter. */}
      <div
        data-tablet-detail="name"
        className="pointer-events-none absolute inset-0"
        style={{ clipPath: `url(#${uid}-nameClip)` }}
      >
        <div
          className="absolute inset-x-[12%] -translate-y-1/2 overflow-hidden text-center"
          style={{ top: `${TABLET_NAME_TOP_PCT * 100}%` }}
        >
          <StageMarquee className={`${NAME_CLASS[size]} font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]`}>
            {tabletName}
          </StageMarquee>
        </div>
        <div
          ref={nameSheenRef}
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/10 via-white/10 to-black/10"
          style={{ transform: `translateX(${visualLightOffset * 10}%)`, opacity: 0.62 + visualFocus * 0.2 }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack/extensions/tablet`
Expected: PASS.

- [ ] **Step 5: Typen und Lint**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe.

Run: `npx eslint src/features/my-stack/extensions/tablet`
Expected: keine Ausgabe.

- [ ] **Step 6: Commit**

```bash
git add src/features/my-stack/extensions/tablet
git commit -m "feat: render the tablet stage form"
```

---

### Task 3: Adapter, Weiche und die wandernde Negativrolle

**Files:**
- Create: `src/features/my-stack/extensions/tablet/TabletRenderer.tsx`
- Modify: `src/features/my-stack/lib/dosageForms.ts:23`
- Modify: `src/features/my-stack/lib/dosageForms.test.ts`
- Modify: `src/features/my-stack/components/StackStage.tsx`
- Modify: `src/features/my-stack/components/StackStage.test.ts`
- Modify: `src/features/my-stack/MyStackPage.visibility.test.tsx`

- [ ] **Step 1: Das Negativbeispiel umziehen und absichern**

In `StackStage.test.ts` wird `tabletItem` zu `patchItem` — die Tablette taugt
nicht mehr als Beispiel für „ohne Grafik":

```ts
const patchItem: StackItem = {
  ...vialItem,
  id: 'nikotin-patch',
  display_name: 'Nikotinpflaster',
  category: 'medication',
  dosage_form: 'patch',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Nikotin',
    amount_value: 21,
    amount_unit: 'mg',
    basis_unit: 'patch',
  }],
}
```

Alle Verwendungen von `tabletItem` (Zeilen 61, 65, 119) werden auf `patchItem`
umgestellt; die Zusicherungen selbst bleiben wörtlich unverändert.

Dazu die Wache, damit der nächste Formzuwachs nicht wieder still bricht:

```ts
it('benutzt als Negativbeispiel eine Form, die wirklich keinen Renderer hat', () => {
  // Diese Datei prueft mit patchItem, dass Formen ohne Buehnengrafik im
  // Textzustand bleiben. Bekommt patch selbst einen Renderer, muss das
  // Beispiel auf eine andere Form ohne Renderer wechseln.
  expect(
    getDosageForm(patchItem.dosage_form).stageRenderer,
    'patch hat jetzt einen Renderer — Negativbeispiel auf eine andere Form ohne stageRenderer umstellen',
  ).toBeUndefined()
})
```

Der Import wird um `getDosageForm` erweitert:

```ts
import { getDosageForm } from '../lib/dosageForms'
```

In `MyStackPage.visibility.test.tsx` zieht der Fixture-Eintrag ebenso um:
`id: 'tablet-1'` → `'patch-1'`, `dosage_form: 'tablet'` → `'patch'`,
`basis_unit: 'tablet'` → `'patch'`, `suggested_dosage_forms: ['tablet']` →
`['patch']`, `dosageForm: 'tablet'` → `'patch'`, `dosage_form_tablet` →
`dosage_form_patch`, `/ 1 tablet` → `/ 1 patch`, `stack-stage-tablet-1` →
`stack-stage-patch-1`, `edit=tablet-1` → `edit=patch-1`.

- [ ] **Step 2: Die Erwartungen in `dosageForms.test.ts` heben**

```ts
  it('aktiviert genau die Formen mit fertiger Bühnengrafik', () => {
    expect(DOSAGE_FORMS.filter(form => form.stageRenderer).map(form => form.key)).toEqual(['vial', 'ampoule', 'tablet', 'capsule'])
  })
```

```ts
  it('erkennt die vier fertigen Formen als darstellbar, den Rest noch nicht', () => {
    expect(isStageRenderable('vial')).toBe(true)
    expect(isStageRenderable('ampoule')).toBe(true)
    expect(isStageRenderable('tablet')).toBe(true)
    expect(isStageRenderable('capsule')).toBe(true)
    expect(isStageRenderable('patch')).toBe(false)
    expect(isStageRenderable('powder')).toBe(false)
  })
```

Die Reihenfolge in der ersten Zusicherung folgt `DOSAGE_FORMS`, wo `tablet` vor
`capsule` steht.

- [ ] **Step 3: Den neuen Test ergänzen**

Ans Ende von `StackStage.test.ts`:

```ts
const tabletItem: StackItem = {
  ...vialItem,
  id: 'ibuprofen-tablet',
  display_name: 'Ibuprofen',
  category: 'medication',
  dosage_form: 'tablet',
  color_hex: '#d9c39a',
  ingredients: [{
    ...vialItem.ingredients[0],
    custom_name: 'Ibuprofen',
    amount_value: 400,
    amount_unit: 'mg',
    basis_unit: 'tablet',
  }],
}

describe('StackStage — Tablette', () => {
  it('rendert die Tablette für Tabletten-Einträge', () => {
    expect(renderStage(tabletItem)).toContain('data-stack-renderer="tablet"')
  })

  it('zeigt Bruchrille und Namen, aber kein Etikettband', () => {
    const html = renderStage(tabletItem)

    expect(html).toContain('data-tablet-detail="score"')
    expect(html).toContain('Ibuprofen')
    expect(html).not.toContain('data-vial-detail="label-glass-wrap"')
  })

  it('hält den Tabletten-Adapter frei von eigener Grafik und von Physik', () => {
    const source = readFileSync(new URL('../extensions/tablet/TabletRenderer.tsx', import.meta.url), 'utf8')

    expect(source).toContain('TabletVisual')
    expect(source).not.toContain('<svg')
    expect(source).not.toContain('SloshProvider')
    expect(source).not.toContain('fillPct')
  })
})
```

- [ ] **Step 4: Tests laufen lassen und Fehlschlag bestätigen**

Run: `npx vitest run src/features/my-stack/components/StackStage.test.ts src/features/my-stack/lib/dosageForms.test.ts`
Expected: FAIL — `data-stack-renderer="unsupported"` statt `"tablet"`, und `TabletRenderer.tsx` fehlt.

- [ ] **Step 5: Den Adapter anlegen**

```tsx
import type { Ref } from 'react'
import { TabletVisual } from './TabletVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface TabletRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: eine flach liegende Tablette wackelt nicht, sie liegt.
export function TabletRenderer({ item, ...visualProps }: TabletRendererProps) {
  return (
    <div data-stack-renderer="tablet">
      <TabletVisual
        name={item.display_name}
        color={item.color_hex ?? '#64748b'}
        {...visualProps}
      />
    </div>
  )
}
```

- [ ] **Step 6: Form freischalten und Weiche erweitern**

In `dosageForms.ts` den Import ergänzen:

```ts
import { TABLET_SPEC } from '../extensions/tablet/tabletShape'
```

`DosageFormDefinition.stageRenderer` wird zu
`'vial' | 'ampoule' | 'capsule' | 'tablet'`, und der Tabletteneintrag erhält:

```ts
  { key: 'tablet', labelKey: 'dosage_form_tablet', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['tablet'], capabilities: ['countable', 'divisible', 'inventory_capable'], stageRenderer: 'tablet', stageForm: TABLET_SPEC },
```

In `StackStage.tsx` den Import ergänzen und nach dem Kapselzweig einfügen:

```tsx
  if (renderer === 'tablet') {
    return <TabletRenderer item={item} {...visualProps} />
  }
```

- [ ] **Step 7: Tests laufen lassen**

Run: `npx vitest run src/features/my-stack`
Expected: PASS, inklusive der umgezogenen Negativprüfungen und der neuen Wache.

- [ ] **Step 8: Commit**

```bash
git add src/features/my-stack
git commit -m "feat: route tablet items to the tablet stage"
```

---

### Task 4: Tablette in die Vorschau

**Files:**
- Modify: `src/pages/__VialPreview.tsx`

- [ ] **Step 1: Tabletten aufnehmen**

Import ergänzen:

```ts
import { TabletVisual } from '../features/my-stack/extensions/tablet/TabletVisual'
```

Eine eigene Detailreihe unter den Kapseln:

```ts
const PREVIEW_TABLETS = [
  { name: 'Ibuprofen', color: '#d9c39a' },
  { name: 'Aspirin', color: '#e2e8f0' },
  // bewusst zu lang: zeigt den Durchlauf auf engem Raum
  { name: 'Acetylsalicylsäure 500', color: '#fca5a5' },
]
```

```tsx
      <p className="mx-auto max-w-4xl pt-10 pb-3 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Tabletten — Bruchrille in Detailgröße
      </p>
      <div className="mx-auto flex max-w-4xl flex-wrap items-end justify-center gap-10 pb-2">
        {PREVIEW_TABLETS.map(t => (
          <TabletVisual key={t.name} name={t.name} color={t.color} size="large" />
        ))}
      </div>
```

`MixedEntry` um `'tablet'` erweitern und drei Einträge ans Ende von
`MIXED_CAROUSEL` setzen:

```ts
  { kind: 'tablet', name: 'Ibuprofen', amount: 400, unit: 'mg', color: '#d9c39a' },
  { kind: 'tablet', name: 'Aspirin', amount: 500, unit: 'mg', color: '#e2e8f0' },
  { kind: 'tablet', name: 'Acetylsalicylsäure 500', amount: 500, unit: 'mg', color: '#fca5a5' },
```

Im Karussellzweig vor dem Kapselzweig:

```tsx
              {entry.kind === 'tablet' ? (
                <TabletVisual
                  name={entry.name}
                  color={entry.color}
                  size="carousel"
                  isActive={index === activeIndex}
                />
              ) : entry.kind === 'capsule' ? (
```

- [ ] **Step 2: Typen und Lint prüfen**

Run: `npx tsc -b --noEmit`
Expected: keine Ausgabe.

Run: `npx eslint src/pages/__VialPreview.tsx`
Expected: keine Ausgabe.

- [ ] **Step 3: Commit**

```bash
git add src/pages/__VialPreview.tsx
git commit -m "feat: add tablets to the stage preview"
```

---

### Task 5: Regression, Sichtprüfung, Build und Graph

- [ ] **Step 1: Volle Suite**

Run: `npm test`
Expected: PASS. Die Suiten von Vial, Ampulle und Kapsel sind unverändert grün.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `tsc -b` und Vite-Build ohne neue Fehler.

- [ ] **Step 3: Lint ohne neue Verstöße**

Run: `npx eslint src/features/my-stack 2>&1 | grep problems`
Expected: dieselbe Problemzahl wie vor Task 1.

- [ ] **Step 4: Sichtprüfung**

`http://localhost:5176/__vialpreview` öffnen und prüfen:

1. Die Tablette ist rund und sitzt auf der Bodenlinie, deutlich kleiner als Vial und Ampulle, größer als die Kapsel.
2. Die Bruchrille läuft waagerecht durch die Mitte, über nahezu den vollen Durchmesser.
3. Der Name steht **unter** der Rille und ist gegen den dunkleren unteren Teil noch lesbar. Falls nicht: Schattenwurf verstärken.
4. Der lange Name läuft durch und wird am Kreisrand beschnitten, nicht an einer geraden Kante.
5. Beim Wischen wandert der Lichtfleck über die Oberfläche; die Tablette selbst bewegt sich nicht.
6. Kein Etikettband, keine Prozentzeile.

Die Maße im DOM gegenprüfen: Karussell-Tablette 62 × 62 px, Seitenverhältnis 1,000, gleiche Unterkante wie Vial und Kapsel.

- [ ] **Step 5: Graph aktualisieren und committen**

```bash
graphify update .
git add graphify-out
git commit -m "chore: update knowledge graph"
```

---

## Final Acceptance Criteria

- Ein Tabletten-Eintrag wird im Karussell und in der Detailansicht als runde Tablette gerendert.
- Die Bruchrille läuft waagerecht über nahezu den vollen Durchmesser.
- Der Name sitzt unter der Rille, trägt die Klassen des Etikettnamens und wird am Kreisrand beschnitten.
- Die Tablette bleibt bei jeder Größe rund und hält die Durchmesser 160 / 96 / 62 / 40 px ein.
- `color_hex` färbt das Material; kein Sweep, keine zweite Kontur, kein Innenclip.
- Die Tablette abonniert die Slosh-Engine nicht und zeichnet keinen SVG-Text.
- Kein Etikett, keine Prozentzeile.
- `patch` und `powder` bleiben im Textzustand, und eine Wache meldet, wenn das Negativbeispiel selbst einen Renderer bekommt.
- Die Suiten von Vial, Ampulle und Kapsel sind unverändert und grün.
- Keine neuen i18n-Schlüssel.
- `npm test`, `npm run build` und `npx eslint src` ohne neue Fehler.
