import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { PeptideVialVisual } from './PeptideVialVisual'

const source = () => readFileSync(new URL('./PeptideVialVisual.tsx', import.meta.url), 'utf8')

describe('PeptideVialVisual', () => {
  test('renders readable vial label content', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'BPC-157',
      amount: '5',
      unit: 'mg',
      fillPct: 75,
      color: '#06b6d4',
    }))

    expect(html).toContain('BPC-157')
    expect(html).toContain('5 mg / Vial')
  })

  test('clamps liquid fill percentage into the visual range', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'CJC-1295 DAC',
      amount: '2',
      unit: 'mg',
      fillPct: 150,
      color: '#a855f7',
    }))

    expect(html).toContain('data-fill-pct="100"')
  })

  test('marks animated liquid when animation is enabled', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'Semax',
      amount: '10',
      unit: 'mg',
      fillPct: 100,
      color: '#f59e0b',
      animateOnMount: true,
    }))

    expect(html).toContain('vial-liquid-fill-reveal')
  })

  test('grows the liquid from the vial floor to the current fill level on mount', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'BPC-157',
      amount: '5',
      unit: 'mg',
      fillPct: 72,
      color: '#06b6d4',
      animateOnMount: true,
    }))

    expect(html).toContain('data-vial-detail="liquid-motion-viewport" class="pointer-events-none absolute inset-0"')
    expect(html).toContain('data-vial-detail="liquid-graphic"')
    expect(html).toContain('class="overflow-visible vial-liquid-fill-reveal"')
    expect(html).not.toContain('data-vial-detail="liquid-motion-viewport" class="pointer-events-none absolute inset-0 vial-liquid-rise"')
    expect(source()).toContain('data-vial-detail="liquid-intro-reveal-clip"')
    expect(source()).toContain('y={reducedMotion ? 0 : LIQUID_VB_H}')
    expect(source()).toContain('height={reducedMotion ? LIQUID_VB_H : 0}')
    expect(source()).toContain('<animate attributeName="y"')
    expect(source()).toContain('<animate attributeName="height"')
    expect(source()).toContain('from={LIQUID_VB_H}')
    expect(source()).toContain('to="0"')
    expect(source()).toContain('from="0"')
    expect(source()).toContain('to={LIQUID_VB_H}')
    expect(source()).not.toContain('scaleY(0)')
    expect(source()).not.toContain('scaleY(1)')
    expect(source()).not.toContain('clip-path: inset(100% 0 0 0)')
  })

  test('uses a visible but fill-dependent intro duration', () => {
    const low = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'Low Fill',
      amount: '5',
      unit: 'mg',
      fillPct: 20,
      color: '#06b6d4',
      animateOnMount: true,
    }))
    const high = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'High Fill',
      amount: '5',
      unit: 'mg',
      fillPct: 90,
      color: '#06b6d4',
      animateOnMount: true,
    }))

    expect(low).toContain('--vial-fill-intro-duration:1060ms')
    expect(high).toContain('--vial-fill-intro-duration:1620ms')
    expect(source()).toContain('dur={`${fillIntroDurationMs}ms`}')
  })
  test('keeps the cap and label while removing split glass body seams', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'TB-500',
      amount: '5',
      unit: 'mg',
      fillPct: 80,
      color: '#06b6d4',
    }))

    expect(html).toContain('data-vial-detail="single-cap"')
    expect(html).not.toContain('data-vial-detail="crimp-seal"')
    expect(html).not.toContain('data-vial-detail="rubber-stopper"')
    expect(html).toContain('data-vial-detail="full-width-label"')
    expect(html).toContain('data-vial-detail="unified-glass-shell"')
    expect(html).not.toContain('data-vial-detail="glass-shoulder"')
    expect(html).not.toContain('data-vial-detail="glass-body"')
    expect(html).not.toContain('data-vial-detail="glass-base"')
  })

  test('renders one unified glass shell for neck shoulder and body', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'BPC-157',
      amount: '5',
      unit: 'mg',
      fillPct: 72,
      color: '#06b6d4',
    }))

    expect(html).toContain('data-vial-detail="unified-glass-shell"')
    expect(html).toContain('data-vial-detail="unified-glass-outline"')
    expect(html).toContain('data-vial-detail="glass-stage-shadow"')
    expect(html).not.toContain('data-vial-detail="glass-shoulder"')
    expect(html).not.toContain('data-vial-detail="glass-body"')
  })

  test('uses a slightly flatter vial base across shell and clips', () => {
    const text = source()

    expect(text).toContain('L116 252 C116 274 102 286 76 286 L44 286 C18 286 4 274 4 252')
    expect(text).not.toContain('L116 250 C116 277 101 292 74 292 L46 292 C19 292 4 277 4 250')
  })

  test('accepts focus and lightOffset as visual control props', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'TB-500',
      amount: '10',
      unit: 'mg',
      fillPct: 40,
      color: '#a855f7',
      focus: 0.42,
      lightOffset: -0.35,
    }))

    expect(html).toContain('data-vial-focus="0.42"')
    expect(html).toContain('data-vial-light-offset="-0.35"')
  })

  test('drives the stage light imperatively and keeps blur filters off per-frame elements', () => {
    const text = source()

    // the carousel pushes scroll focus through an imperative handle, not props
    expect(text).toContain('useImperativeHandle')
    expect(text).toContain('setStageLight')
    expect(text).toContain('stageLightRef')

    // elements the slosh loop or the stage light touch every frame must not
    // carry SVG blur filters — a changed attribute would re-raster the blur
    expect(text).not.toContain('-soft)')
    expect(text).not.toContain('-capSoft)')
    // the remaining blurred shell highlights stay static inside one group that
    // only changes its opacity
    expect(text).toContain('data-vial-detail="shell-highlights"')
    // the bloom gradient itself is static; only a transform moves the light
    expect(text).not.toContain('cx={`${50 + visualLightOffset * 18}%`}')
  })

  test('sweeps a specular reflection across the glass and swaps edge brightness with the light position', () => {
    const text = source()

    // one fixed light, vials swipe through it: a specular band slides sideways
    // with lightOffset, and the two glass edges fade against each other so the
    // lit edge follows the light source
    expect(text).toContain('data-vial-detail="glass-sweep"')
    expect(text).toContain("glassSweepRef.current?.setAttribute('transform', `translate(${(o * 34).toFixed(2)} 0)`)")
    expect(text).toContain('shellHiLeftRef.current?.setAttribute')
    expect(text).toContain('shellHiRightRef.current?.setAttribute')
    expect(text).toContain('0.6 - o * 0.6')
    expect(text).toContain('0.5 + o * 0.6')
  })

  test('renders the empty glass as clear rather than milky (only the label stays frosted)', () => {
    const text = source()

    // the label band keeps its frosted look
    expect(text).toContain('bg-white/28')
    // the glass body is transparent in the centre — the old milky white
    // mid-stops are gone
    expect(text).not.toContain('<stop offset="34%" stopColor="rgba(255,255,255,0.10)" />')
    expect(text).toContain('<stop offset="50%" stopColor="rgba(255,255,255,0)" />')
  })
  test('integrates cap label and liquid into the shared vial lighting', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'Ipamorelin',
      amount: '2',
      unit: 'mg',
      fillPct: 95,
      color: '#ec4899',
      focus: 0.75,
      lightOffset: 0.5,
    }))

    expect(html).toContain('data-vial-detail="cap-light-sheen"')
    expect(html).toContain('data-vial-detail="liquid-glass-window"')
    expect(html).toContain('data-vial-detail="label-glass-wrap"')
    expect(source()).toContain('VialTop({ focus: visualFocus, lightOffset: visualLightOffset, sheenRef: capSheenRef, arcRef: capArcRef, marginClass: capMarginClass })')
    expect(source()).toContain('left-[3.5%] right-[3.5%]')
    expect(source()).toContain('top-1/2 -translate-y-1/2 rounded-sm px-1 py-2')
    expect(source()).toContain('top-1/2 -translate-y-1/2 rounded-sm px-1 py-1')
    expect(source()).not.toContain('top-[53%] rounded-sm px-1 py-2')
    expect(source()).not.toContain('top-[50%] rounded-sm px-1 py-1')
    expect(source()).toContain('text-lg sm:text-xl leading-tight')
  })

  test('uses a full-width single-line label with delayed marquee for long names', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'CJC-1295 DAC WITH EXTRA LONG NAME',
      amount: '2',
      unit: 'mg',
      fillPct: 90,
      color: '#a855f7',
    }))

    expect(html).toContain('data-vial-detail="full-width-label"')
    expect(html).toContain('vial-label-marquee')
    expect(html).toContain('whitespace-nowrap')
    expect(html).not.toContain('break-words')
  })

  test('measures real overflow for vial label marquee instead of using a name-length heuristic', () => {
    const text = source()

    expect(text).toContain('ResizeObserver')
    expect(text).toContain('inner.scrollWidth - wrap.clientWidth')
    expect(text).toContain('inner.animate(')
    expect(text).not.toContain('labelName.length >')
  })

  test('does not add fixed extra width that would trigger marquee without real overflow', () => {
    expect(source()).not.toContain('className="pr-10"')
  })

  test('draws the liquid as one SVG graphic, not a block with a separate waterline band', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'BPC-157',
      amount: '5',
      unit: 'mg',
      fillPct: 72,
      color: '#06b6d4',
    }))

    // One graphic whose body, surface, glow and rim share the same geometry.
    expect(html).toContain('data-vial-detail="liquid-graphic"')
    expect(html).toContain('viewBox="0 0 120 200"')
    expect(html).toContain('data-vial-detail="liquid-body"')
    expect(html).toContain('data-vial-detail="liquid-surface"')
    expect(html).toContain('data-vial-detail="liquid-glow"')
    expect(html).toContain('data-vial-detail="liquid-rim"')

    // The old stacked block + pill waterline must be gone.
    expect(html).not.toContain('realistic-meniscus-surface')
    expect(html).not.toContain('liquid-motion-layer')
    expect(html).not.toContain('realistic-liquid-body')
    expect(html).not.toContain('viewBox="0 0 120 28"')
    expect(html).not.toContain('vial-liquid-slosh')
  })

  test('drives a living, physics-coupled surface with rising bubbles', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'Ipamorelin',
      amount: '2',
      unit: 'mg',
      fillPct: 95,
      color: '#ec4899',
    }))

    // Ambient life: rising bubbles rendered as animated SVG circles.
    expect(html).toContain('data-vial-detail="liquid-bubble"')
    expect(html).toContain('<animateTransform')

    const text = source()
    // Surface is redrawn imperatively from the shared slosh engine each frame.
    expect(text).toContain('useSloshSubscribe')
    expect(text).toContain('buildLiquid')
    expect(text).toContain("setAttribute('d'")
    expect(text).toContain('(prefers-reduced-motion: reduce)')
  })


  test('animates fill-level changes inside the integrated glass window', () => {
    const text = source()

    expect(text).toContain('liquidSurfaceY')
    expect(text).toContain('previousFillRef')
    expect(text).toContain('vial-liquid-level-motion')
    expect(text).toContain('--vial-fill-motion-shift')
    expect(text).toContain('data-vial-detail="liquid-motion-viewport"')
  })

  test('clips the liquid to the new vial chamber instead of a rectangular window', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'BPC-157',
      amount: '5',
      unit: 'mg',
      fillPct: 45,
      color: '#06b6d4',
    }))
    const text = source()

    expect(html).toContain('data-vial-detail="liquid-vial-chamber"')
    expect(html).toContain('data-vial-detail="liquid-glass-window"')
    expect(text).toContain('liquidChamberClip')
    expect(text).toContain('clipPath={`url(#${uid}-liquidChamberClip)`}')
    expect(text).toContain('x="4"')
    expect(text).toContain('y="36"')
    expect(text).toContain('height="247"')
    expect(text).not.toContain('className="absolute inset-0 overflow-hidden"')
  })
  test('renders vial label typography in white for contrast on colored liquid', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'BPC-157',
      amount: '5',
      unit: 'mg',
      fillPct: 45,
      color: '#06b6d4',
    }))

    expect(html).toContain('text-white')
    expect(html).toContain('text-white/90')
    expect(source()).not.toContain('font-black text-slate-900')
    expect(source()).not.toContain('text-slate-700')
  })

  test('dims inactive neighboring vials with a vial-shaped overlay instead of a rectangle', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'CJC-1295',
      amount: '2',
      unit: 'mg',
      fillPct: 45,
      color: '#a855f7',
      isActive: false,
    }))
    const text = source()

    expect(html).toContain('data-vial-detail="inactive-vial-overlay"')
    expect(text).toContain('inactiveOverlayClip')
    expect(text).not.toContain('data-vial-detail="inactive-overlay" className="absolute inset-0 bg-black/40 pointer-events-none"')
  })

  test('uses a slightly smaller cap that overlaps and seats the glass neck', () => {
    const text = source()

    expect(text).toContain('data-vial-detail="cap-top"')
    expect(text).toContain('data-vial-detail="cap-collar"')
    expect(text).toContain('width="86"')
    expect(text).toContain('className={`pointer-events-none relative z-20 ${marginClass} block h-auto w-full`}')
    expect(text).toContain('className={`relative z-0 w-full ${shellClass} overflow-visible`}')
  })

  test('raises the cap slightly so a sliver of neck stays visible below it', () => {
    const text = source()

    // the overlap is smaller than before so a bit of neck peeks out under the
    // cap, and still scales down with vial size to keep proportions
    expect(text).toContain("const capMarginClass = size === 'large' ? '-mb-2' : '-mb-1'")
    expect(text).toContain('marginClass: capMarginClass')
  })
})
