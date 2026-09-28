// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import de from '../i18n/locales/de.json'
import { Rechner } from './Rechner'

const mocks = vi.hoisted(() => ({ load: vi.fn(), user: { id: 'calculator-user' } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../lib/supabase', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ not: () => ({ order: () => Promise.resolve({ data: [] }) }) }) }) }),
} }))
vi.mock('../features/my-stack/services/stackItems', () => ({ loadStackItems: mocks.load }))

const i18n = createInstance()
await i18n.use(initReactI18next).init({ lng: 'de', resources: { de: { translation: de } }, interpolation: { escapeValue: false } })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
beforeEach(() => { mocks.load.mockReset().mockResolvedValue([]) })

function setup() { render(<I18nextProvider i18n={i18n}><Rechner /></I18nextProvider>) }
function enter(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }
function validValues() {
  enter('Wirkstoffmenge im Behälter', '5')
  enter('Gesamtvolumen der Lösung (mL)', '2')
  enter('Gewünschte Menge', '250')
}

it('uses the actual syringe capacity for both volume and scale across presets', async () => {
  setup()
  validValues()
  for (const preset of ['0.3:30', '2:200', '1:40']) {
    enter('Spritzengröße', preset)
    const result = screen.getByRole('status', { name: 'Berechnetes Aufziehvolumen' })
    expect(result.textContent).toContain('0,1 mL')
    expect(result.textContent).not.toMatch(/0,167|0,05 mL/)
    expect(Number(screen.getByRole('meter').getAttribute('aria-valuenow'))).toBeCloseTo(preset === '1:40' ? 4 : 10)
  }
  await waitFor(() => expect(mocks.load).toHaveBeenCalled())
})

it('replaces results with clear errors for negative amounts and syringe overflow', () => {
  setup()
  validValues()
  enter('Gewünschte Menge', '-250')
  expect(screen.getByRole('alert').textContent).toContain('größer als 0')
  expect(screen.queryByRole('meter')).toBeNull()
  enter('Gewünschte Menge', '3000')
  expect(screen.getByRole('alert').textContent).toContain('Spritze')
  expect(screen.queryByRole('meter')).toBeNull()
})

it('accepts German decimals and keeps custom syringe configuration visible', () => {
  setup()
  validValues()
  enter('Wirkstoffmenge im Behälter', '2,5')
  enter('Spritzengröße', 'custom')
  enter('Spritzenvolumen (mL)', '0,5')
  enter('Skalenmaximum (Einheiten)', '50')
  expect(screen.getByRole('status', { name: 'Berechnetes Aufziehvolumen' }).textContent).toContain('0,2 mL')
  enter('Skalenmaximum (Einheiten)', '0')
  expect(screen.queryByRole('meter')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('größer als 0')
})

it('imports concentration references without inventing container contents and clears missing volume on source changes', async () => {
  mocks.load.mockResolvedValue([
    { id: 'new', display_name: 'Neuer Eintrag', dosage_form: 'vial', archived: false, configuration_status: 'complete', tracking_level: 'complete', ingredients: [{ id: 'ingredient', custom_name: '', amount_value: 5000, amount_unit: 'mcg', basis_value: 2, basis_unit: 'ml', position: 0, substance_catalog: null }] },
    { id: 'old', display_name: 'Ohne Flüssigkeit', dosage_form: 'vial', archived: false, configuration_status: 'complete', tracking_level: 'complete', ingredients: [], vial_amount_mg: 10, vial_amount_unit: 'mg', reconstitution_ml: null },
  ])
  setup()
  const picker = await screen.findByLabelText('Werte aus Mein Stack')
  const option = within(picker).getByRole('option', { name: /Neuer Eintrag/ }) as HTMLOptionElement
  fireEvent.change(picker, { target: { value: option.value } })
  expect((screen.getByLabelText('Konzentration laut Etikett') as HTMLInputElement).value).toBe('2.5')
  expect((screen.getByLabelText('Inhalt des Behälters (mL, optional)') as HTMLInputElement).value).toBe('')
  const missing = within(picker).getByRole('option', { name: /Ohne Flüssigkeit/ }) as HTMLOptionElement
  fireEvent.change(picker, { target: { value: missing.value } })
  expect((screen.getByLabelText('Gesamtvolumen der Lösung (mL)') as HTMLInputElement).value).toBe('')
})

it('explains stack loading failures and allows retry while manual calculation works', async () => {
  mocks.load.mockRejectedValueOnce(new Error('network')).mockResolvedValue([])
  setup()
  expect((await screen.findByRole('alert')).textContent).toContain('nicht geladen')
  validValues()
  expect(screen.getByRole('meter')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})

it('keeps entered calculations when switching to the unit converter and back', () => {
  setup()
  validValues()
  fireEvent.click(screen.getByRole('button', { name: 'Einheiten' }))
  expect(screen.queryByRole('meter')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Aufziehrechner' }))
  expect(screen.getByRole('status', { name: 'Berechnetes Aufziehvolumen' }).textContent).toContain('0,1 mL')
})

it('shows concentration before a target is entered and clears it when the solution becomes invalid', () => {
  setup()
  enter('Wirkstoffmenge im Behälter', '5')
  const concentration = screen.getByRole('status', { name: 'Konzentration der Lösung' })
  expect(concentration.textContent).toContain('2,5 mg/mL')
  expect(screen.queryByRole('meter')).toBeNull()
  enter('Gewünschte Menge', '-1')
  expect(concentration.textContent).toContain('2,5 mg/mL')
  enter('Gesamtvolumen der Lösung (mL)', '0')
  expect(concentration.textContent).not.toContain('mg/mL')
  enter('Gesamtvolumen der Lösung (mL)', '4')
  expect(concentration.textContent).toContain('1,25 mg/mL')
  enter('Wirkstoffmenge im Behälter', '')
  expect(concentration.textContent).not.toContain('mg/mL')
})

it('does not show infinite or zero concentration for numbers outside the numeric range', () => {
  setup()
  enter('Wirkstoffmenge im Behälter', '1e308')
  enter('Gesamtvolumen der Lösung (mL)', '1e-300')
  const concentration = screen.getByRole('status', { name: 'Konzentration der Lösung' })
  expect(concentration.textContent).toContain('berechenbaren Bereichs')
  expect(concentration.textContent).not.toMatch(/Infinity|NaN|mg\/mL/)
  enter('Wirkstoffmenge im Behälter', '1e-300')
  enter('Gesamtvolumen der Lösung (mL)', '1e308')
  expect(concentration.textContent).toContain('berechenbaren Bereichs')
})

it('copies a complete calculation using the selected U-40 scale and German decimals', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  setup()
  expect(screen.queryByRole('button', { name: 'Berechnung kopieren' })).toBeNull()
  validValues()
  enter('Spritzengröße', '1:40')
  fireEvent.click(screen.getByRole('button', { name: 'Berechnung kopieren' }))
  await screen.findByText('Berechnung kopiert.')
  const copied = writeText.mock.calls[0][0]
  for (const line of [
    'Aufziehrechner',
    'Wirkstoffmenge im Behälter: 5 mg',
    'Gesamtvolumen der Lösung (mL): 2 mL',
    'Konzentration: 2,5 mg/mL',
    'Gewünschte Menge: 250 µg',
    'Spritzenskala: 40 Skaleneinheiten = 1 mL',
    'Dein Ergebnis: 4 Skaleneinheiten = 0,1 mL',
    'Volle Entnahmen: 20',
    de.rechner_precision_note,
  ]) expect(copied).toContain(line)
  enter('Gewünschte Menge', '500')
  expect(screen.queryByText('Berechnung kopiert.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Berechnung kopieren' }))
  await screen.findByText('Berechnung kopiert.')
  expect(writeText.mock.calls[1][0]).toContain('Dein Ergebnis: 8 Skaleneinheiten = 0,2 mL')
  enter('Gewünschte Menge', '-1')
  expect(screen.queryByRole('button', { name: 'Berechnung kopieren' })).toBeNull()
})

it.each(['denied', 'unavailable'])('offers the current summary for manual copying when clipboard is %s', async reason => {
  vi.stubGlobal('navigator', reason === 'denied'
    ? { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Permission denied')) } } : {})
  setup()
  validValues()
  enter('Einheit der Menge', 'mg')
  enter('Gewünschte Menge', '0,25')
  fireEvent.click(screen.getByRole('button', { name: 'Berechnung kopieren' }))
  const summary = await screen.findByRole('textbox', { name: 'Berechnung zum Kopieren' }) as HTMLTextAreaElement
  expect(summary.readOnly).toBe(true)
  expect(summary.value).toContain('Gewünschte Menge: 0,25 mg')
  expect(summary.value).toContain('Dein Ergebnis: 10 Skaleneinheiten = 0,1 mL')
  expect(screen.queryByText('Berechnung kopiert.')).toBeNull()
})

it('shows a full syringe when valid arithmetic crosses capacity only by floating-point noise', () => {
  setup()
  enter('Wirkstoffmenge im Behälter', '0.3')
  enter('Gesamtvolumen der Lösung (mL)', '1.5')
  enter('Gewünschte Menge', '100')
  expect(screen.getByRole('status', { name: 'Berechnetes Aufziehvolumen' }).textContent).toContain('0,5 mL')
  expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('50')
})

it('keeps scheduling and calendar duration out of the draw calculator', () => {
  setup()
  validValues()
  expect(screen.queryByLabelText('Entnahmen pro Woche (optional)')).toBeNull()
  expect(screen.queryByText('Rechnerische Reichweite')).toBeNull()
  expect(screen.queryByText(/Reichweite nach Verbrauch/)).toBeNull()
  expect(screen.getByText('Volle Entnahmen')).toBeTruthy()
})

it('calculates from a label concentration without inventing a container size', () => {
  setup()
  fireEvent.click(screen.getByRole('button', { name: 'Konzentration bekannt' }))
  enter('Konzentration laut Etikett', '5')
  enter('Gewünschte Menge', '250')
  const result = screen.getByRole('status', { name: 'Berechnetes Aufziehvolumen' })
  expect(result.textContent).toContain('0,05 mL')
  expect(result.textContent).not.toContain('Infinity')
  enter('Inhalt des Behälters (mL, optional)', '2')
  expect(result.textContent).toContain('40')
  enter('Inhalt des Behälters (mL, optional)', '-1')
  expect(result.textContent).toContain('0,05 mL')
  expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('5')
})

it('preserves physical amounts on mass and volume unit changes and clears incompatible IU', () => {
  setup()
  validValues()
  expect(screen.getByLabelText('Gewünschte Menge').parentElement)
    .toBe(screen.getByLabelText('Einheit der Menge').parentElement)
  enter('Einheit der Wirkstoffmenge', 'g')
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).value).toBe('0.005')
  enter('Einheit der Menge', 'mg')
  expect((screen.getByLabelText('Gewünschte Menge') as HTMLInputElement).value).toBe('0.25')
  enter('Einheit der Menge', 'ml')
  expect((screen.getByLabelText('Gewünschte Menge') as HTMLInputElement).value).toBe('0.1')
  enter('Einheit der Wirkstoffmenge', 'iu')
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Gewünschte Menge') as HTMLInputElement).value).toBe('0.1')
  expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('10')
  enter('Wirkstoffmenge im Behälter', '1000')
  enter('Einheit der Menge', 'iu')
  expect((screen.getByLabelText('Gewünschte Menge') as HTMLInputElement).value).toBe('50')
  enter('Einheit der Wirkstoffmenge', 'mg')
  expect((screen.getByLabelText('Gewünschte Menge') as HTMLInputElement).value).toBe('')
  expect(screen.queryByRole('meter')).toBeNull()
})

it('uses the preset graduation without exposing a technical graduation field', () => {
  setup()
  validValues()
  enter('Gewünschte Menge', '325')
  enter('Spritzengröße', '1:100')
  expect(screen.queryByLabelText('Kleinster Teilstrich (Einheiten)')).toBeNull()
  const result = screen.getByRole('status', { name: 'Berechnetes Aufziehvolumen' })
  expect(result.textContent).toContain('0,13 mL')
  expect(result.textContent).toContain('15')
  expect(result.textContent).toContain('Zwischen den Teilstrichen 12 und 14')
  expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('13')
})

it('retains equivalent solution data across source modes and resets the whole form', () => {
  setup()
  validValues()
  fireEvent.click(screen.getByRole('button', { name: 'Konzentration bekannt' }))
  expect((screen.getByLabelText('Konzentration laut Etikett') as HTMLInputElement).value).toBe('2.5')
  expect((screen.getByLabelText('Inhalt des Behälters (mL, optional)') as HTMLInputElement).value).toBe('2')
  fireEvent.click(screen.getByRole('button', { name: 'Menge + Volumen' }))
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).value).toBe('5')
  fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }))
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Gewünschte Menge') as HTMLInputElement).value).toBe('')
  expect(screen.queryByRole('meter')).toBeNull()
})
