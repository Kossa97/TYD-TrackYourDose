// @vitest-environment jsdom
import React, { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeAll, expect, it } from 'vitest'
import { SyringeFields } from './SyringeFields'

const i18n = createInstance()
beforeAll(async () => {
  await i18n.init({ lng: 'de', resources: { de: { translation: {
    spritzengroesse: 'Spritzengröße', einh_kurz: 'Einh.', eigene_werte: 'Eigene Werte',
    rechner_capacity: 'Kapazität', rechner_scale_max: 'Maximale Einheiten',
    rechner_graduation_label: 'Kleinster Teilstrich (Einheiten)',
  } } } })
})
afterEach(cleanup)

function Harness({ withGraduation = true }: { withGraduation?: boolean }) {
  const [capacity, setCapacity] = useState(['1', '100'])
  const [graduation, setGraduation] = useState('2')
  return <I18nextProvider i18n={i18n}>
    <SyringeFields idPrefix="test" capacityMl={capacity[0]} capacityUnits={capacity[1]}
      onChange={(ml, units) => setCapacity([ml, units])}
      onGraduationChange={withGraduation ? setGraduation : undefined} />
    <output aria-label="Aktive Teilung">{graduation}</output>
  </I18nextProvider>
}

const selectPreset = (value: string) => fireEvent.change(screen.getByLabelText('Spritzengröße'), { target: { value } })

it.each([[30, '0.3:30', '1'], [50, '0.5:50', '1'], [100, '1:100', '2']])(
  'selects the %s-unit U100 preset and applies its hidden graduation', (units, preset, step) => {
    render(<Harness />)
    const button = screen.getByRole('button', { name: new RegExp(`^${units} Einh[.]`) })
    fireEvent.click(button)
    expect((screen.getByLabelText('Spritzengröße') as HTMLSelectElement).value).toBe(preset)
    expect(screen.getByLabelText('Aktive Teilung').textContent).toBe(step)
    expect(screen.queryByLabelText('Kleinster Teilstrich (Einheiten)')).toBeNull()
    expect(button.getAttribute('aria-pressed')).toBe('true')
  },
)

it('clears the graduation on U40, 200-unit and custom selection', () => {
  render(<Harness />)
  for (const preset of ['1:40', '2:200', 'custom']) {
    selectPreset('1:100')
    expect(screen.getByLabelText('Aktive Teilung').textContent).toBe('2')
    selectPreset(preset)
    expect(screen.getByLabelText('Aktive Teilung').textContent).toBe('')
  }
})

it('keeps custom selected until explicit preset selection and clears graduation when dimensions change', () => {
  render(<Harness />)
  selectPreset('custom')
  fireEvent.change(screen.getByLabelText('Kapazität'), { target: { value: '0.5' } })
  fireEvent.change(screen.getByLabelText('Maximale Einheiten'), { target: { value: '50' } })
  expect(screen.getByLabelText('Aktive Teilung').textContent).toBe('')
  expect((screen.getByLabelText('Spritzengröße') as HTMLSelectElement).value).toBe('custom')
  expect(screen.getByLabelText('Kapazität')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: /^50 Einh\./ }))
  expect((screen.getByLabelText('Spritzengröße') as HTMLSelectElement).value).toBe('0.5:50')
  expect(screen.queryByLabelText('Kapazität')).toBeNull()
})

it('retains all legacy converter presets without adding graduation controls', () => {
  render(<Harness withGraduation={false} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.queryByLabelText('Kleinster Teilstrich (Einheiten)')).toBeNull()
  for (const preset of ['0.3:30', '0.5:50', '1:100', '2:200', '1:40']) {
    selectPreset(preset)
    expect((screen.getByLabelText('Spritzengröße') as HTMLSelectElement).value).toBe(preset)
  }
  selectPreset('custom')
  expect(screen.getByLabelText('Kapazität')).toBeTruthy()
  expect(screen.getByLabelText('Maximale Einheiten')).toBeTruthy()
})
