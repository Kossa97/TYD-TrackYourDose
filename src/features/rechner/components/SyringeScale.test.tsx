// @vitest-environment jsdom
import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, expect, it } from 'vitest'
import { SyringeScale } from './SyringeScale'

const i18n = createInstance()
beforeAll(async () => {
  await i18n.init({
    lng: 'de',
    resources: { de: { translation: {
      rechner_syringe_fill: 'Spritzenfüllung', rechner_scale_target: 'Zielmarke',
      rechner_scale_schematic: 'Schematische Ansicht. Die tatsächliche Skalenteilung hängt von deiner Spritze ab.',
      spritzengroesse: 'Spritzengröße', einh_kurz: 'Einh.',
    } } },
  })
})
afterEach(cleanup)

function renderScale(drawUnits: number, capacityUnits: number, capacityMl: number) {
  return render(<I18nextProvider i18n={i18n}>
    <SyringeScale drawUnits={drawUnits} capacityUnits={capacityUnits} capacityMl={capacityMl} />
  </I18nextProvider>)
}

it('preserves the precise target and selected capacity in the accessible meter', () => {
  renderScale(12.375, 30, 0.3)
  const meter = screen.getByRole('meter', { name: 'Spritzenfüllung' })
  expect(meter.getAttribute('aria-valuemin')).toBe('0')
  expect(meter.getAttribute('aria-valuemax')).toBe('30')
  expect(meter.getAttribute('aria-valuenow')).toBe('12.375')
  expect(meter.getAttribute('aria-valuetext')).toContain('12,375 Einh.')
  expect(meter.getAttribute('aria-valuetext')).toContain('30 Einh.')
  expect(screen.getByText('12,375 Einh.')).toBeTruthy()
  expect(screen.getByText('30 Einh. / 0,3 mL')).toBeTruthy()
  expect(screen.getByText(/Schematische Ansicht/)).toBeTruthy()
})

it.each([
  { capacityUnits: 30, capacityMl: 0.3, drawUnits: 12.375, percent: '41.25%' },
  { capacityUnits: 50, capacityMl: 0.5, drawUnits: 12.5, percent: '25%' },
  { capacityUnits: 100, capacityMl: 1, drawUnits: 75, percent: '75%' },
  { capacityUnits: 200, capacityMl: 2, drawUnits: 100, percent: '50%' },
  { capacityUnits: 40, capacityMl: 1, drawUnits: 10, percent: '25%' },
  { capacityUnits: 7.5, capacityMl: 0.75, drawUnits: 1.875, percent: '25%' },
  { capacityUnits: 30, capacityMl: 0.3, drawUnits: 0, percent: '0%' },
  { capacityUnits: 7.5, capacityMl: 0.75, drawUnits: 7.5, percent: '100%' },
])('positions the target and fill at $percent for $drawUnits / $capacityUnits units', ({ capacityUnits, capacityMl, drawUnits, percent }) => {
  const { container } = renderScale(drawUnits, capacityUnits, capacityMl)
  const target = container.querySelector<HTMLElement>('.rechner-syringe-target-line')!
  const fill = container.querySelector<HTMLElement>('.rechner-syringe-fill')!
  expect(target.style.left).toBe(percent)
  expect(fill.style.width).toBe(percent)
})

it('labels a custom fractional scale without rounding the target to a graduation', () => {
  const { container } = renderScale(1.875, 7.5, 0.75)
  expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('1.875')
  expect(screen.getByText('1,875 Einh.')).toBeTruthy()
  expect(container.querySelector('.rechner-syringe-scale-labels')?.textContent).toBe('01,8753,755,6257,5')
})

it.each([
  { capacityUnits: 1e300, drawUnits: 2.5e299 },
  { capacityUnits: 1e-300, drawUnits: 2.5e-301 },
])('keeps geometry finite and rendering bounded for a custom capacity of $capacityUnits', ({ capacityUnits, drawUnits }) => {
  const { container } = renderScale(drawUnits, capacityUnits, 1)
  expect(container.querySelector<HTMLElement>('.rechner-syringe-target-line')!.style.left).toBe('25%')
  expect(container.querySelector<HTMLElement>('.rechner-syringe-fill')!.style.width).toBe('25%')
  expect(screen.getByRole('meter').querySelectorAll('*').length).toBeLessThan(20)
  expect(container.querySelector('.rechner-syringe-scale-labels')?.children.length).toBe(3)
})
