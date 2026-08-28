import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StageLabel } from './StageLabel'

describe('StageLabel', () => {
  it('renders name and detail with the data attributes the caller supplies', () => {
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
    expect(html).toContain('whitespace-nowrap')
  })

  it('leaves the detail line out instead of printing an empty one', () => {
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

  it('measures real overflow rather than guessing from the name length', () => {
    const source = readFileSync(new URL('./StageLabel.tsx', import.meta.url), 'utf8')

    expect(source).toContain('ResizeObserver')
    expect(source).toContain('inner.scrollWidth - wrap.clientWidth')
    expect(source).toContain('inner.animate(')
    expect(source).not.toContain('.length >')
  })
})
