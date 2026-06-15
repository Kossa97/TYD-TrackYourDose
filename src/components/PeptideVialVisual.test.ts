import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { PeptideVialVisual } from './PeptideVialVisual'

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

    expect(html).toContain('vial-fill-rise')
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
    const source = readFileSync(new URL('./PeptideVialVisual.tsx', import.meta.url), 'utf8')

    expect(source).toContain('ResizeObserver')
    expect(source).toContain('inner.scrollWidth - wrap.clientWidth')
    expect(source).toContain('inner.animate(')
    expect(source).not.toContain('labelName.length >')
  })

  test('does not add fixed extra width that would trigger marquee without real overflow', () => {
    const source = readFileSync(new URL('./PeptideVialVisual.tsx', import.meta.url), 'utf8')

    expect(source).not.toContain('className="pr-10"')
  })

  test('renders a list-style animated wave surface instead of the rejected meniscus effects', () => {
    const html = renderToStaticMarkup(createElement(PeptideVialVisual, {
      name: 'BPC-157',
      amount: '5',
      unit: 'mg',
      fillPct: 72,
      color: '#06b6d4',
    }))

    expect(html).toContain('data-vial-detail="list-style-wave-surface"')
    expect(html).toContain('vial-wave-scroll')
    expect(html).toContain('vial-wave-breathe')
    expect(html).not.toContain('vial-meniscus-drift')
    expect(html).not.toContain('vial-liquid-caustics')
    expect(html).not.toContain('h-px bg-white/45')
    expect(html).not.toContain('absolute -top-2 left-0 right-0 h-4')
  })
})
