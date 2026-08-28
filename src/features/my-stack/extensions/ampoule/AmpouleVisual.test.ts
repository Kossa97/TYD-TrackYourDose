import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AmpouleVisual } from './AmpouleVisual'

const base = {
  name: 'Testosteron Enantat',
  amount: 250,
  unit: 'mg / ml',
  color: '#e0a23f',
}

const render = (props: Partial<Parameters<typeof AmpouleVisual>[0]> = {}) =>
  renderToStaticMarkup(createElement(AmpouleVisual, { ...base, ...props }))

describe('AmpouleVisual', () => {
  it('draws two contours so the glass reads as a hollow body', () => {
    const html = render()

    expect(html).toContain('data-ampoule-detail="outer-contour"')
    expect(html).toContain('data-ampoule-detail="inner-contour"')
  })

  it('keeps the wall visible at carousel width by not scaling its stroke', () => {
    expect(render({ size: 'carousel' })).toContain('vector-effect="non-scaling-stroke"')
  })

  it('clips the liquid with the inner contour, never the outer one', () => {
    const html = render()
    const innerClip = html.match(/id="([^"]*-innerClip)"/)?.[1]

    expect(innerClip).toBeTruthy()
    expect(html).toContain(`data-ampoule-detail="liquid-window" clip-path="url(#${innerClip})"`)
  })

  it('leaves a glass floor with a punt under the liquid', () => {
    expect(render()).toContain('data-ampoule-detail="punt"')
  })

  it('keeps every edge light inside the glass', () => {
    // At the constriction the body is only 24 units wide. An unclipped
    // highlight paints a bright streak in mid-air beside the neck.
    const html = render()
    const outerClip = html.match(/id="([^"]*-outerClip)"/)?.[1]

    expect(outerClip).toBeTruthy()
    expect(html).toContain(`data-ampoule-detail="edge-lights" clip-path="url(#${outerClip})"`)
  })

  it('scales uniformly so the proportions survive every size', () => {
    const html = render()

    // The glass itself scales uniformly. The liquid chamber inside is mapped
    // non-uniformly on purpose — that is what chamberAspect compensates for.
    expect(html).toContain('viewBox="24 5 72 274" preserveAspectRatio="xMidYMid meet"')
    expect(html).not.toContain('viewBox="24 5 72 274" preserveAspectRatio="none"')
  })

  it('matches the vial height in the carousel — including its sm breakpoint', () => {
    const html = render({ size: 'carousel' })

    // the vial is 146.7 px tall on mobile and 186.4 px from sm upwards
    expect(html).toContain('h-[146.7px]')
    expect(html).toContain('sm:h-[186.4px]')
    // width follows the ampoule's own aspect: 146.7 * 72/274 = 38.6
    expect(html).toContain('w-[38.6px]')
    expect(html).toContain('sm:w-[49px]')
  })

  it('carries our label with name and amount', () => {
    const html = render()

    expect(html).toContain('data-ampoule-detail="label"')
    expect(html).toContain('Testosteron Enantat')
    expect(html).toContain('250 mg / ml')
  })

  it('leaves the amount line out instead of inventing a placeholder', () => {
    const html = render({ amount: null, unit: null })

    expect(html).toContain('Testosteron Enantat')
    expect(html).not.toContain('undefined')
    expect(html).not.toContain('null')
  })

  it('places the label on the lower half of the straight glass body', () => {
    const html = render()

    expect(html).toContain('top:67.6%')
    expect(html).toContain('height:14.2%')
  })

  it('takes no fill percentage — a sealed ampoule is full or gone', () => {
    expect(render()).not.toContain('data-fill-pct')
  })

  it('dims an inactive neighbour with an ampoule-shaped overlay', () => {
    expect(render({ isActive: false })).toContain('data-ampoule-detail="inactive-overlay"')
    expect(render({ isActive: true })).not.toContain('data-ampoule-detail="inactive-overlay"')
  })

  it('seeds the stage light from the props the carousel passes', () => {
    const html = render({ focus: 0.42, lightOffset: -0.35 })

    expect(html).toContain('data-ampoule-focus="0.42"')
    expect(html).toContain('data-ampoule-light-offset="-0.35"')
  })
})
