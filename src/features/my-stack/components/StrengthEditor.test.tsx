// @vitest-environment jsdom

import { cleanup, render, screen, within } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import de from '../../../i18n/locales/de.json'
import en from '../../../i18n/locales/en.json'
import { initialWizardState, wizardReducer } from '../lib/wizardState'
import type { DosageFormKey, StackItemIngredient } from '../types'
import { StrengthEditor } from './StrengthEditor'

const completeIngredient: StackItemIngredient = {
  catalog_substance_id: null,
  custom_name: 'Testosteron Enantat',
  amount_value: 250,
  amount_unit: 'mg',
  basis_value: 1,
  basis_unit: 'ml',
  position: 0,
}

async function renderEditor({
  language = 'de',
  dosageForm = 'ampoule',
  ingredient = completeIngredient,
  ingredientName = 'Testosteron Enantat',
  errors,
}: {
  language?: 'de' | 'en'
  dosageForm?: DosageFormKey
  ingredient?: StackItemIngredient
  ingredientName?: string
  errors?: Parameters<typeof StrengthEditor>[0]['errors']
} = {}) {
  const i18n = createInstance()
  await i18n.init({
    lng: language,
    fallbackLng: 'de',
    resources: {
      de: { translation: de },
      en: { translation: en },
    },
    interpolation: { escapeValue: false },
  })

  return render(
    <I18nextProvider i18n={i18n}>
      <StrengthEditor
        dosageForm={dosageForm}
        ingredient={ingredient}
        ingredientIndex={0}
        ingredientName={ingredientName}
        errors={errors}
        onChange={vi.fn()}
      />
    </I18nextProvider>,
  )
}

afterEach(cleanup)

describe('StrengthEditor', () => {
  it.each([
    {
      language: 'de' as const,
      labels: ['Wirkstoffmenge', 'Wirkstoffeinheit', 'Produktmenge', 'Produkteinheit'],
      explanation: 'Trage die Konzentration ein, wie sie auf dem Etikett steht. Beispiel: 250 mg pro 1 ml. Keine Dosierungsempfehlung.',
      errors: [
        'Bitte gib die Wirkstoffmenge an.',
        'Bitte wähle eine Wirkstoffeinheit.',
        'Bitte gib die Produktmenge an.',
        'Bitte wähle eine Produkteinheit.',
      ],
    },
    {
      language: 'en' as const,
      labels: ['Active ingredient amount', 'Active ingredient unit', 'Product quantity', 'Product unit'],
      explanation: 'Enter the concentration as printed on the label. Example: 250 mg per 1 ml. Not a dosage recommendation.',
      errors: [
        'Please enter the active ingredient amount.',
        'Please select an active ingredient unit.',
        'Please enter the product quantity.',
        'Please select a product unit.',
      ],
    },
  ])('explains the four strength fields clearly in $language', async ({ language, labels, explanation, errors }) => {
    await renderEditor({
      language,
      errors: { amountValue: 'required', amountUnit: 'required', basisValue: 'required', basisUnit: 'required' },
    })

    const group = screen.getByRole('group', { name: 'Testosteron Enantat' })
    expect(within(group).getByText(explanation)).toBeTruthy()
    for (const label of labels) expect(within(group).getByLabelText(label)).toBeTruthy()
    expect(within(group).getAllByRole('alert').map(alert => alert.textContent)).toEqual(errors)
  })

  it('presents amount, unit, per, product quantity, and product unit in semantic order with a polite preview', async () => {
    await renderEditor()

    const group = screen.getByRole('group', { name: 'Testosteron Enantat' })
    const amountValue = within(group).getByLabelText('Wirkstoffmenge')
    const amountUnit = within(group).getByLabelText('Wirkstoffeinheit')
    const separator = within(group).getByText('pro', { selector: 'span' })
    const basisValue = within(group).getByLabelText('Produktmenge')
    const basisUnit = within(group).getByLabelText('Produkteinheit')

    expect(amountValue.compareDocumentPosition(amountUnit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(amountUnit.compareDocumentPosition(separator) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(separator.compareDocumentPosition(basisValue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(basisValue.compareDocumentPosition(basisUnit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const preview = within(group).getByRole('status')
    expect(preview.getAttribute('aria-live')).toBe('polite')
    expect(preview.textContent).toBe('Testosteron Enantat: 250 mg pro 1 ml')
  })

  it('does not render a strength preview until all four values are complete', async () => {
    await renderEditor({
      ingredient: { ...completeIngredient, basis_value: null },
    })

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('uses the same localized fallback name in the legend and live preview', async () => {
    await renderEditor({
      ingredient: { ...completeIngredient, custom_name: '' },
      ingredientName: '',
    })

    expect(screen.getByRole('group', { name: 'Inhaltsstoff 1' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Inhaltsstoff 1: 250 mg pro 1 ml')
  })

  it('keeps the per separator in a stable input row when a field error is visible', async () => {
    await renderEditor({ errors: { amountValue: 'required' } })

    const separator = screen.getByText('pro', { selector: 'span' })
    const separatorCell = separator.parentElement!
    expect(separator.previousElementSibling?.getAttribute('aria-hidden')).toBe('true')
    expect(separatorCell.className).not.toContain('self-end')
  })

  it.each([
    ['ampoule', 'Produktmenge', 'ml', '1'],
    ['capsule', 'Produktmenge', 'capsule', '1'],
    ['gel', 'Produktmenge', 'g', '1'],
    // Das Vial ist der Sonderfall: wie viel Loesungsmittel zugegeben wird,
    // steht auf keinem Etikett — die Zahl bleibt leer, bis der Nutzer
    // rekonstituiert.
    ['vial', 'Lösungsmittel', 'ml', ''],
  ] as const)('belegt die Produktmenge von %s aus der Form vor', async (dosageForm, mengenLabel, erwarteteEinheit, erwarteteMenge) => {
    const state = wizardReducer(
      wizardReducer(initialWizardState(), { type: 'custom_started', name: 'Testosteron Enantat' }),
      { type: 'dosage_form_selected', dosageForm },
    )

    await renderEditor({ dosageForm, ingredient: state.draft.ingredients[0] })

    const einheitLabel = dosageForm === 'vial' ? 'Einheit' : 'Produkteinheit'
    expect((screen.getByLabelText(einheitLabel) as HTMLInputElement).value).toBe(erwarteteEinheit)
    expect((screen.getByLabelText(mengenLabel) as HTMLInputElement).value).toBe(erwarteteMenge)
  })

  it('erklaert beim Vial die Rekonstitution und benennt die Felder danach', async () => {
    // „Produktmenge" fragte beim Peptid nach einer Zahl, die auf keiner
    // Packung steht. Gemeint ist das Loesungsmittel — das muss dranstehen.
    await renderEditor({
      dosageForm: 'vial',
      ingredient: { ...completeIngredient, amount_value: 10, amount_unit: 'mg', basis_value: 2, basis_unit: 'ml' },
    })

    const hinweis = document.querySelector('[data-strength-hint]')!
    expect(hinweis.getAttribute('data-strength-hint')).toBe('reconstituted')
    expect(hinweis.textContent).toMatch(/Rekonstitution/)
    expect(screen.getByLabelText('Wirkstoff im Vial')).toBeTruthy()
    expect(screen.getByLabelText('Lösungsmittel')).toBeTruthy()
    expect(screen.queryByLabelText('Produktmenge')).toBeNull()
  })

  it('rechnet vor, was nach dem Aufloesen in einem Milliliter steckt', async () => {
    await renderEditor({
      dosageForm: 'vial',
      ingredient: { ...completeIngredient, amount_value: 10, amount_unit: 'mg', basis_value: 2, basis_unit: 'ml' },
    })

    expect(screen.getByRole('status').textContent).toBe('Testosteron Enantat: 10 mg pro 2 ml= 5 mg/ml')
    expect(document.querySelector('[data-strength-concentration]')!.textContent).toBe('= 5 mg/ml')
  })

  it('laesst die Umrechnung weg, wo sie nichts hinzufuegt', async () => {
    // „250 mg pro 1 ml" IST die Konzentration. Und eine Kapsel hat keine.
    await renderEditor({ dosageForm: 'ampoule' })
    expect(document.querySelector('[data-strength-concentration]')).toBeNull()

    cleanup()
    await renderEditor({
      dosageForm: 'capsule',
      ingredient: { ...completeIngredient, amount_value: 500, amount_unit: 'mg', basis_value: 1, basis_unit: 'capsule' },
    })
    expect(document.querySelector('[data-strength-concentration]')).toBeNull()
  })

  it.each([
    ['capsule', 'per_unit'],
    ['tablet', 'per_unit'],
    ['ampoule', 'per_volume'],
    ['pen', 'per_volume'],
    ['drops', 'per_volume'],
    ['vial', 'reconstituted'],
    ['powder', 'per_mass'],
    ['gel', 'per_mass'],
    ['tube', 'per_mass'],
    ['nasal_spray', 'per_unit'],
    ['spray', 'per_unit'],
    ['patch', 'per_unit'],
    ['other', 'free'],
  ] as const)('gibt %s den Hinweis seiner Staerke-Form (%s)', async (dosageForm, shape) => {
    await renderEditor({ dosageForm })

    const hinweis = document.querySelector('[data-strength-hint]')!
    expect(hinweis.getAttribute('data-strength-hint')).toBe(shape)
    // Kein Schluessel-Durchschlag: jede Form hat einen uebersetzten Satz.
    expect(hinweis.textContent).not.toMatch(/^my_stack_/)
    expect(hinweis.textContent!.length).toBeGreaterThan(40)
  })
})
