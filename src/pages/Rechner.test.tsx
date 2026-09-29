// @vitest-environment jsdom
import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import de from '../i18n/locales/de.json'
import { Rechner } from './Rechner'

const mocks = vi.hoisted(() => ({ load: vi.fn(), from: vi.fn(), user: { id: 'calculator-user' } }))
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }))
vi.mock('../lib/supabase', () => ({ supabase: {
  from: mocks.from,
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
  const picker = await screen.findByLabelText('Aus deinen Substanzen')
  const option = within(picker).getByRole('option', { name: /Neuer Eintrag/ }) as HTMLOptionElement
  fireEvent.change(picker, { target: { value: option.value } })
  expect((screen.getByLabelText('Konzentration laut Etikett') as HTMLInputElement).value).toBe('2.5')
  expect((screen.getByLabelText('Inhalt des Behälters (mL, optional)') as HTMLInputElement).value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Substanz lösen' }))
  const nextPicker = screen.getByLabelText('Aus deinen Substanzen')
  const missing = within(nextPicker).getByRole('option', { name: /Ohne Flüssigkeit/ }) as HTMLOptionElement
  fireEvent.change(nextPicker, { target: { value: missing.value } })
  expect((screen.getByLabelText('Gesamtvolumen der Lösung (mL)') as HTMLInputElement).value).toBe('')
})

it('offers saved ampoules and IU vials from My Stack as calculator sources', async () => {
  mocks.load.mockResolvedValue([
    { id: 'ampoule', display_name: 'Testosteron', category: 'hormone', dosage_form: 'ampoule', archived: false, configuration_status: 'complete', tracking_level: 'complete', ingredients: [{ id: 'testosterone', custom_name: '', amount_value: 250, amount_unit: 'mg', basis_value: 1, basis_unit: 'ml', position: 0, substance_catalog: null }] },
    { id: 'iu-vial', display_name: 'HCG', category: 'hormone', dosage_form: 'vial', archived: false, configuration_status: 'complete', tracking_level: 'complete', ingredients: [{ id: 'hcg', custom_name: '', amount_value: 5000, amount_unit: 'IU', basis_value: 1, basis_unit: 'vial', position: 0, substance_catalog: null }] },
  ])
  setup()

  const picker = await screen.findByLabelText('Aus deinen Substanzen')
  const ampoule = within(picker).getByRole('option', { name: 'Testosteron' }) as HTMLOptionElement
  fireEvent.change(picker, { target: { value: ampoule.value } })
  expect((screen.getByLabelText('Konzentration laut Etikett') as HTMLInputElement).value).toBe('250')
  expect((screen.getByLabelText('Einheit der Wirkstoffmenge') as HTMLSelectElement).value).toBe('mg')

  fireEvent.click(screen.getByRole('button', { name: 'Substanz lösen' }))
  const nextPicker = screen.getByLabelText('Aus deinen Substanzen')
  const iuVial = within(nextPicker).getByRole('option', { name: 'HCG' }) as HTMLOptionElement
  fireEvent.change(nextPicker, { target: { value: iuVial.value } })
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).value).toBe('5000')
  expect((screen.getByLabelText('Einheit der Wirkstoffmenge') as HTMLSelectElement).value).toBe('iu')
})

it('loads database-shaped catalog entries through the real service and autofills saved mixing volume', async () => {
  const { loadStackItems } = await vi.importActual<typeof import('../features/my-stack/services/stackItems')>(
    '../features/my-stack/services/stackItems',
  )
  mocks.load.mockImplementation(loadStackItems)
  mocks.from.mockImplementation(() => ({
    select: (columns: string) => ({ eq: () => ({ order: async () => ({ error: null, data: [{
      id: 'catalog-vial', display_name: 'Gespeicherte Substanz', category: 'peptide',
      dosage_form: 'vial', archived: false, configuration_status: 'complete',
      reconstitution_ml: null,
      ...(columns.includes('inventory:stack_item_inventory') ? {
        inventory: { enabled: true, package_unit: 'vial', reconstitution_ml: 1.5 },
      } : {}),
      ingredients: [{ id: 'ingredient', custom_name: null, catalog_substance_id: 'catalog',
        amount_value: 10, amount_unit: 'mg', basis_value: 1, basis_unit: 'vial', position: 0 }],
    }] }) }) }),
  }))
  setup()
  const picker = await screen.findByLabelText('Aus deinen Substanzen')
  fireEvent.change(picker, { target: { value: 'catalog-vial' } })
  expect(screen.queryByRole('alert')).toBeNull()
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).value).toBe('10')
  expect((screen.getByLabelText('Einheit der Wirkstoffmenge') as HTMLSelectElement).value).toBe('mg')
  expect((screen.getByLabelText('Gesamtvolumen der Lösung (mL)') as HTMLInputElement).value).toBe('1.5')
  enter('Gewünschte Menge', '1000')
  expect(screen.getByRole('status', { name: 'Berechnetes Aufziehvolumen' }).textContent).toContain('0,15 mL')
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

it('locks imported composition until explicitly released while withdrawal and syringe remain editable', async () => {
  mocks.load.mockResolvedValue([{ id: 'saved', display_name: 'Gespeicherte Lösung', dosage_form: 'vial', archived: false,
    ingredients: [], vial_amount_mg: 10, reconstitution_ml: 2 }])
  setup()
  const picker = await screen.findByLabelText('Aus deinen Substanzen')
  picker.focus()
  fireEvent.change(picker, { target: { value: 'saved' } })
  expect(screen.queryByLabelText('Aus deinen Substanzen')).toBeNull()
  expect(screen.getByText('Gespeicherte Lösung')).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('group', { name: 'Gespeicherte Lösung' }))
  for (const label of ['Wirkstoffmenge im Behälter', 'Gesamtvolumen der Lösung (mL)']) {
    expect((screen.getByLabelText(label) as HTMLInputElement).readOnly).toBe(true)
  }
  expect((screen.getByLabelText('Einheit der Wirkstoffmenge') as HTMLSelectElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Konzentration bekannt' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: '3 mL' }) as HTMLButtonElement).disabled).toBe(true)
  // Guard all mutation paths, including a dispatched change on a read-only field.
  enter('Wirkstoffmenge im Behälter', '20')
  enter('Gesamtvolumen der Lösung (mL)', '3')
  enter('Einheit der Wirkstoffmenge', 'g')
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).value).toBe('10')
  expect((screen.getByLabelText('Gesamtvolumen der Lösung (mL)') as HTMLInputElement).value).toBe('2')
  expect((screen.getByLabelText('Einheit der Wirkstoffmenge') as HTMLSelectElement).value).toBe('mg')
  enter('Gewünschte Menge', '500')
  enter('Spritzengröße', '1:40')
  expect(screen.getByRole('status', { name: 'Berechnetes Aufziehvolumen' }).textContent).toContain('0,1 mL')
  screen.getByRole('button', { name: 'Substanz lösen' }).focus()
  fireEvent.click(screen.getByRole('button', { name: 'Substanz lösen' }))
  expect(document.activeElement).toBe(screen.getByLabelText('Aus deinen Substanzen'))
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).readOnly).toBe(false)
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).value).toBe('10')
  expect((screen.getByLabelText('Gewünschte Menge') as HTMLInputElement).value).toBe('500')
  expect((screen.getByLabelText('Einheit der Wirkstoffmenge') as HTMLSelectElement).disabled).toBe(false)
  enter('Wirkstoffmenge im Behälter', '5')
  expect(screen.getByRole('status', { name: 'Berechnetes Aufziehvolumen' }).textContent).toContain('0,2 mL')
})

it('locks reference concentration and empty container until released without inventing missing values', async () => {
  mocks.load.mockResolvedValue([{ id: 'reference', display_name: 'Referenz', dosage_form: 'ampoule', archived: false,
    ingredients: [{ id: 'i', amount_value: 250, amount_unit: 'mg', basis_value: 1, basis_unit: 'ml' }] }])
  setup()
  fireEvent.change(await screen.findByLabelText('Aus deinen Substanzen'), { target: { value: 'reference' } })
  expect((screen.getByLabelText('Konzentration laut Etikett') as HTMLInputElement).readOnly).toBe(true)
  expect((screen.getByLabelText('Inhalt des Behälters (mL, optional)') as HTMLInputElement).readOnly).toBe(true)
  expect((screen.getByLabelText('Inhalt des Behälters (mL, optional)') as HTMLInputElement).value).toBe('')
  fireEvent.click(screen.getByRole('button', { name: 'Substanz lösen' }))
  expect((screen.getByLabelText('Konzentration laut Etikett') as HTMLInputElement).value).toBe('250')
  enter('Inhalt des Behälters (mL, optional)', '2')
  expect((screen.getByLabelText('Inhalt des Behälters (mL, optional)') as HTMLInputElement).value).toBe('2')
})

it('reset releases a selected substance and clears the imported values', async () => {
  mocks.load.mockResolvedValue([{ id: 'saved', display_name: 'Lösung', dosage_form: 'vial', archived: false,
    ingredients: [], vial_amount_mg: 10, reconstitution_ml: 2 }])
  setup()
  fireEvent.change(await screen.findByLabelText('Aus deinen Substanzen'), { target: { value: 'saved' } })
  fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }))
  expect(screen.queryByRole('button', { name: 'Substanz lösen' })).toBeNull()
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).readOnly).toBe(false)
  expect((screen.getByLabelText('Wirkstoffmenge im Behälter') as HTMLInputElement).value).toBe('')
})
