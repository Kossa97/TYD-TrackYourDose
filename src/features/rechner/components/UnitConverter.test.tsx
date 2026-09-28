// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import de from '../../../i18n/locales/de.json'
import { UnitConverter } from './UnitConverter'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => (de as Record<string, string>)[key] ?? key, i18n: { language: 'de' } }),
}))

afterEach(cleanup)
const enter = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
const enterAmount = (value: string) => enter('Wert', value)
const targets = () => Array.from((screen.getByLabelText('Nach') as HTMLSelectElement).options).map(option => option.value)

it('converts 2.5 mg to 2500 micrograms and swaps units', () => {
  render(<UnitConverter />)
  enterAmount('2,5')
  expect(screen.getByRole('status').textContent).toContain('2500 µg')
  fireEvent.click(screen.getByRole('button', { name: 'Einheiten tauschen' }))
  expect((screen.getByLabelText('Von') as HTMLSelectElement).value).toBe('mcg')
  expect((screen.getByLabelText('Nach') as HTMLSelectElement).value).toBe('mg')
  expect(screen.getByRole('status').textContent).toContain('0,0025 mg')
})

it('offers compatible targets and resets a stale target when the source family changes', () => {
  render(<UnitConverter />)
  expect(targets()).toContain('g')
  expect(targets()).not.toContain('mL')
  enter('Von', 'mL')
  expect(targets()).toContain('µL')
  expect(targets()).not.toContain('mg')
  expect((screen.getByLabelText('Nach') as HTMLSelectElement).value).toBe('µL')
  enterAmount('0.25')
  expect(screen.getByRole('status').textContent).toContain('250 µL')
})

it('handles blank, malformed, negative, zero and overflowing amounts without stale results', () => {
  render(<UnitConverter />)
  expect(screen.getByRole('status').textContent).toContain('Gib einen Wert ein.')
  enterAmount('0')
  expect(screen.getByRole('status').textContent).toContain('0 µg')
  for (const value of ['-1', '1x', '1,2.3', '1e308']) {
    enterAmount(value)
    expect(screen.getByRole('status').textContent).toContain('Gib eine gültige Zahl')
    expect(screen.getByLabelText('Wert').getAttribute('aria-invalid')).toBe('true')
  }
  enterAmount('')
  expect(screen.getByRole('status').textContent).toContain('Gib einen Wert ein.')
})

it('calculates syringe units using the chosen scale and reports capacity overflow', () => {
  render(<UnitConverter />)
  enter('Von', 'mL')
  enter('Nach', 'scale')
  enterAmount('0,25')
  expect(screen.getByRole('status').textContent).toContain('25 Skaleneinheiten')
  enter('Spritzengröße', '1:40')
  expect(screen.getByRole('status').textContent).toContain('10 Skaleneinheiten')
  enterAmount('1.25')
  expect(screen.getByRole('status').textContent).toContain('überschreitet')
  fireEvent.click(screen.getByRole('button', { name: 'Einheiten tauschen' }))
  enterAmount('10')
  expect(screen.getByRole('status').textContent).toContain('0,25 mL')
  expect(targets()).not.toContain('IU')
})

it('requires a blood marker for mass-to-molar conversion and updates its factor', () => {
  render(<UnitConverter />)
  enter('Von', 'mg/dL')
  expect(targets()).not.toContain('mmol/L')
  enter('Blutwert (optional)', 'Glukose')
  expect(targets()).toContain('mmol/L')
  enterAmount('100')
  expect(screen.getByRole('status').textContent).toContain('5,55 mmol/L')
  enter('Blutwert (optional)', 'Cholesterin gesamt')
  expect(screen.getByRole('status').textContent).toContain('Gib einen Wert ein.')
  enterAmount('100')
  expect(screen.getByRole('status').textContent).toContain('2,59 mmol/L')
  enter('Blutwert (optional)', '')
  expect(targets()).not.toContain('mmol/L')
})

it('does not invent molar conversions for Lp(a) or insulin', () => {
  render(<UnitConverter />)
  enter('Blutwert (optional)', 'Lipoprotein (a)')
  expect(targets()).toContain('g/L')
  expect(targets()).not.toContain('nmol/L')
  enter('Blutwert (optional)', 'Insulin')
  expect(targets()).toContain('mIU/L')
  expect(targets()).not.toContain('pmol/L')
  expect(targets()).not.toContain('mg')
})

it('uses the named HbA1c systems and explains an out-of-range result', () => {
  render(<UnitConverter />)
  enter('Blutwert (optional)', 'HbA1c')
  enterAmount('7')
  expect(screen.getByRole('status').textContent).toContain('52,9952 mmol/mol (IFCC)')
  expect(targets()).not.toContain('fraction')
  enterAmount('1')
  expect(screen.getByRole('status').textContent).toContain('HbA1c')
  expect(screen.getByRole('status').textContent).not.toContain('52,9952')
})

it('clears syringe validation when returning to an ordinary volume conversion', () => {
  render(<UnitConverter />)
  enter('Von', 'scale')
  enterAmount('10')
  enter('Spritzengröße', 'custom')
  enter('Skalenmaximum (Einheiten)', '0')
  expect(screen.getByRole('status').textContent).toContain('größer als 0')
  enter('Von', 'mL')
  enter('Nach', 'µL')
  expect(screen.getByRole('status').textContent).toContain('10000 µL')
})
