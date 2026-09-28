// @vitest-environment jsdom
import React from 'react'
import { act, cleanup, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { SyringeScale } from './SyringeScale'

const i18n = createInstance()
beforeAll(async () => {
  await i18n.init({
    lng: 'de',
    resources: { de: { translation: {
      rechner_syringe_fill: 'Spritzenfüllung', rechner_scale_target: 'Zielmarke',
      rechner_scale_unknown: 'Skalierung nicht angegeben',
      rechner_scale_pending: 'Vorschau wird aktualisiert …',
      rechner_scale_exact: 'Exakte Zielmarke', rechner_scale_empty: 'Noch kein Ergebnis',
      rechner_scale_capacity_unknown: 'Spritze auswählen',
      spritzengroesse: 'Spritzengröße', einh_kurz: 'Einh.',
    } } },
  })
})

let reducedMotion = false
let motionListeners: Set<(event: MediaQueryListEvent) => void>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  reducedMotion = false
  motionListeners = new Set()
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reducedMotion },
    media: '(prefers-reduced-motion: reduce)', onchange: null,
    addEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => motionListeners.add(listener),
    removeEventListener: (_event: string, listener: (event: MediaQueryListEvent) => void) => motionListeners.delete(listener),
    addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true,
  }))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

type ScaleProps = React.ComponentProps<typeof SyringeScale>
const defaultProps = { drawUnits: 50, capacityUnits: 100, capacityMl: 1, minorStep: 2, majorStep: 10 }
function renderScale(props: Partial<ScaleProps> = {}) {
  const element = (next: Partial<ScaleProps>) => <I18nextProvider i18n={i18n}>
    <SyringeScale {...defaultProps} {...next} />
  </I18nextProvider>
  const view = render(element(props))
  return { ...view, update: (next: Partial<ScaleProps>) => view.rerender(element(next)) }
}
const advance = (milliseconds: number) => act(() => vi.advanceTimersByTime(milliseconds))
const fluidHeight = (container: HTMLElement) => Number(container.querySelector('.rechner-syringe-fluid')?.getAttribute('height'))
const displacement = (container: HTMLElement) => Number(container.querySelector('.rechner-syringe-plunger')?.getAttribute('transform')?.match(/translate\(0 ([^)]+)\)/)?.[1])

it('preserves the precise target and volume while the graphic waits for settled input', () => {
  const { container } = renderScale({ drawUnits: 12.375, capacityUnits: 30, capacityMl: 0.3, minorStep: 1, majorStep: 5 })
  const meter = screen.getByRole('meter', { name: 'Spritzenfüllung' })
  expect(meter.getAttribute('aria-valuemin')).toBe('0')
  expect(meter.getAttribute('aria-valuemax')).toBe('30')
  expect(meter.getAttribute('aria-valuenow')).toBe('12.375')
  expect(meter.getAttribute('aria-valuetext')).toContain('12,375 Einh.')
  expect(screen.getByText('12,375')).toBeTruthy()
  expect(screen.getByText('0,12375 mL')).toBeTruthy()
  expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  expect(fluidHeight(container)).toBe(0)
  advance(449)
  expect(fluidHeight(container)).toBe(0)
  expect(screen.getByText('Vorschau wird aktualisiert …')).toBeTruthy()
  advance(401)
  expect(fluidHeight(container)).toBeGreaterThan(50)
  expect(fluidHeight(container)).toBeLessThan(70)
  advance(420)
  expect(fluidHeight(container)).toBeCloseTo(123.75)
  expect(screen.getByText('Exakte Zielmarke')).toBeTruthy()
})

it.each([
  { capacityUnits: 30, capacityMl: 0.3, minorStep: 1, majorStep: 5, count: 30, labels: ['5', '10', '15', '20', '25', '30'] },
  { capacityUnits: 50, capacityMl: 0.5, minorStep: 1, majorStep: 5, count: 50, labels: ['5', '10', '15', '20', '25', '30', '35', '40', '45', '50'] },
  { capacityUnits: 100, capacityMl: 1, minorStep: 2, majorStep: 10, count: 50, labels: ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100'] },
  { capacityUnits: 7.5, capacityMl: 0.75, minorStep: 0.5, majorStep: 2.5, count: 15, labels: ['2,5', '5', '7,5'] },
])('renders every supplied graduation for a $capacityUnits-unit syringe', ({ count, labels, ...props }) => {
  const { container } = renderScale({ ...props, drawUnits: 0 })
  expect(container.querySelectorAll('.rechner-syringe-graduations line').length).toBe(count)
  expect(Array.from(container.querySelectorAll('.rechner-syringe-graduations text'), label => label.textContent)).toEqual(labels)
})

it.each([0, 25, 100])('keeps liquid touching the needle-facing rubber edge at %s units and the whole plunger in view', drawUnits => {
  const { container } = renderScale({ drawUnits })
  advance(1270)
  const liquid = container.querySelector('.rechner-syringe-fluid')!
  const plunger = container.querySelector('.rechner-syringe-plunger')!
  const rubber = plunger.querySelector('.rechner-syringe-rubber')!
  const rod = plunger.querySelector('.rechner-syringe-rod')!
  const thumb = plunger.querySelector('.rechner-syringe-thumb')!
  const offset = displacement(container)
  expect(Number(liquid.getAttribute('height'))).toBe(drawUnits * 3)
  expect(Number(liquid.getAttribute('y')) + fluidHeight(container)).toBe(Number(rubber.getAttribute('y')) + offset)
  expect(Number(rod.getAttribute('y')) + offset).toBeGreaterThan(Number(rubber.getAttribute('y')) + offset)
  const viewBoxHeight = Number(container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[3])
  expect(Number(thumb.getAttribute('y')) + Number(thumb.getAttribute('height')) + offset).toBeLessThan(viewBoxHeight)
})

it('cancels a pending target and waits a fresh 450 ms after input changes', () => {
  const { container, update } = renderScale()
  advance(400)
  update({ drawUnits: 20 })
  advance(449)
  expect(fluidHeight(container)).toBe(0)
  advance(821)
  expect(fluidHeight(container)).toBe(60)
  expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('20')
})

it('interrupts motion at the visible position and resumes from there after the next debounce', () => {
  const { container, update } = renderScale({ drawUnits: 100 })
  advance(850)
  const visible = fluidHeight(container)
  expect(visible).toBeGreaterThan(130)
  expect(visible).toBeLessThan(160)
  update({ drawUnits: 10 })
  expect(fluidHeight(container)).toBe(visible)
  advance(449)
  expect(fluidHeight(container)).toBe(visible)
  advance(200)
  expect(fluidHeight(container)).toBeLessThan(visible)
  expect(fluidHeight(container)).toBeGreaterThan(30)
  advance(621)
  expect(fluidHeight(container)).toBe(30)
})

it.each([null, NaN, Infinity, -1, 101])('immediately clears an invalid target %s and prevents old motion from returning', drawUnits => {
  const { container, update } = renderScale()
  advance(850)
  expect(fluidHeight(container)).toBeGreaterThan(0)
  update({ drawUnits })
  expect(container.querySelector('svg')).toBeTruthy()
  expect(fluidHeight(container)).toBe(0)
  expect(displacement(container)).toBe(0)
  expect(container.querySelector('.rechner-syringe-target-marker')).toBeNull()
  expect(screen.queryByRole('meter')).toBeNull()
  advance(2000)
  expect(fluidHeight(container)).toBe(0)
})

it('recalculates the visual ratio when the selected syringe capacity changes', () => {
  const { container, update } = renderScale({ drawUnits: 25, capacityUnits: 50, capacityMl: 0.5, minorStep: 1, majorStep: 5 })
  advance(1270)
  expect(fluidHeight(container)).toBe(150)
  update({ drawUnits: 25 })
  advance(1270)
  expect(fluidHeight(container)).toBe(75)
  expect(screen.getByRole('meter').getAttribute('aria-valuemax')).toBe('100')
})

it('honors reduced motion after the debounce and reacts when the preference changes during movement', () => {
  reducedMotion = true
  const { container, update } = renderScale()
  advance(449)
  expect(fluidHeight(container)).toBe(0)
  advance(1)
  expect(fluidHeight(container)).toBe(150)
  act(() => {
    reducedMotion = false
    motionListeners.forEach(listener => listener({ matches: false } as MediaQueryListEvent))
  })
  update({ drawUnits: 100 })
  advance(650)
  expect(fluidHeight(container)).toBeGreaterThan(150)
  expect(fluidHeight(container)).toBeLessThan(300)
  act(() => {
    reducedMotion = true
    motionListeners.forEach(listener => listener({ matches: true } as MediaQueryListEvent))
  })
  expect(fluidHeight(container)).toBe(300)
  advance(1000)
  expect(fluidHeight(container)).toBe(300)
})

it('still renders and animates when matchMedia is unavailable', () => {
  vi.stubGlobal('matchMedia', undefined)
  const { container } = renderScale()
  advance(1270)
  expect(fluidHeight(container)).toBe(150)
})

it.each([
  { minorStep: null, majorStep: null },
  { minorStep: 0.0001, majorStep: 1 },
  { capacityUnits: 1e300, drawUnits: 2.5e299, minorStep: 1, majorStep: 5 },
])('shows schematic endpoints instead of inventing or rendering unbounded graduations', props => {
  const { container } = renderScale(props)
  advance(1270)
  expect(container.querySelectorAll('.rechner-syringe-graduations line').length).toBe(2)
  expect(screen.getByText('Skalierung nicht angegeben')).toBeTruthy()
  expect(Number.isFinite(fluidHeight(container))).toBe(true)
  expect(Number.isFinite(displacement(container))).toBe(true)
})

it.each([
  { capacityUnits: 0 }, { capacityUnits: NaN }, { capacityUnits: Infinity },
  { capacityMl: 0 }, { capacityMl: NaN },
])('shows an empty neutral syringe without bogus labels for an invalid capacity', props => {
  const { container } = renderScale(props)
  expect(container.querySelector('svg')).toBeTruthy()
  expect(screen.queryByRole('meter')).toBeNull()
  expect(container.querySelectorAll('.rechner-syringe-graduations line').length).toBe(0)
  expect(container.textContent).not.toMatch(/NaN|Infinity/)
  expect(screen.getByText('Spritze auswählen')).toBeTruthy()
  advance(1270)
  expect(fluidHeight(container)).toBe(0)
})
