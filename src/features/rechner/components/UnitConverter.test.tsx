// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { UnitConverter } from './UnitConverter'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => ({
    rechner_converter_category: 'Kategorie', rechner_converter_mass: 'Masse',
    rechner_converter_volume: 'Volumen', rechner_converter_syringe: 'Spritzenskala',
    rechner_converter_amount: 'Wert', rechner_converter_from: 'Von', rechner_converter_to: 'Nach',
    rechner_converter_swap: 'Einheiten tauschen', rechner_converter_empty: 'Gib einen Wert ein.',
    rechner_converter_invalid: 'Gib eine gültige Zahl ab 0 ein.',
    rechner_converter_over_capacity: 'Das Volumen überschreitet die gewählte Spritzenkapazität.',
    rechner_converter_scale_units: 'Skaleneinheiten',
  }[key] ?? key), i18n: { language: 'de' } }),
}))

afterEach(cleanup)
const enterAmount = (value: string) => fireEvent.change(screen.getByLabelText('Wert'), { target: { value } })
const chooseCategory = (value: string) => fireEvent.change(screen.getByLabelText('Kategorie'), { target: { value } })

it('converts 2.5 mg to 2500 micrograms and swaps the units', () => {
  render(<UnitConverter />)
  enterAmount('2,5')
  expect(screen.getByRole('status').textContent).toContain('2500 mcg')
  fireEvent.click(screen.getByRole('button', { name: 'Einheiten tauschen' }))
  expect((screen.getByLabelText('Von') as HTMLSelectElement).value).toBe('mcg')
  expect((screen.getByLabelText('Nach') as HTMLSelectElement).value).toBe('mg')
  expect(screen.getByRole('status').textContent).toContain('0,0025 mg')
})

it('converts millilitres to microlitres instantly', () => {
  render(<UnitConverter />)
  chooseCategory('volume')
  enterAmount('0.25')
  expect(screen.getByRole('status').textContent).toContain('250 µl')
})

it('handles blank, malformed, negative, and zero amounts without a stale result', () => {
  render(<UnitConverter />)
  expect(screen.getByRole('status').textContent).toContain('Gib einen Wert ein.')
  enterAmount('0')
  expect(screen.getByRole('status').textContent).toContain('0 mcg')
  for (const value of ['-1', '1x', '1,2.3']) {
    enterAmount(value)
    expect(screen.getByRole('status').textContent).toContain('Gib eine gültige Zahl ab 0 ein.')
    expect(screen.getByLabelText('Wert').getAttribute('aria-invalid')).toBe('true')
  }
  enterAmount('')
  expect(screen.getByRole('status').textContent).toContain('Gib einen Wert ein.')
})

it('calculates scale units and warns for a volume above syringe capacity', () => {
  render(<UnitConverter />)
  chooseCategory('syringe')
  enterAmount('0,25')
  expect(screen.getByRole('status').textContent).toContain('25 Skaleneinheiten')
  enterAmount('1.25')
  expect(screen.getByRole('status').textContent).toContain('125 Skaleneinheiten')
  expect(screen.getByRole('status').textContent).toContain('überschreitet')
  fireEvent.click(screen.getByRole('button', { name: 'Einheiten tauschen' }))
  enterAmount('25')
  expect(screen.getByRole('status').textContent).toContain('0,25 ml')
})

it('shows an error instead of crashing when a finite input overflows the conversion', () => {
  render(<UnitConverter />)
  fireEvent.change(screen.getByLabelText('Von'), { target: { value: 'g' } })
  enterAmount('1e308')
  expect(screen.getByRole('status').textContent).toContain('Gib eine gültige Zahl')
})
