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

    expect(html).toContain('vial-liquid-rise')
  })

  test('renders a single lower vial cap without the two upper cap stages', () => {
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
    expect(html).toContain('data-vial-detail="glass-shoulder"')
    expect(html).toContain('data-vial-detail="glass-base"')
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
})
