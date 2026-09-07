// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { IntakePlanDraft, StackItem, StackItemSetupDraft, SubstanceCatalogEntry } from '../types'
import type { WizardSaveMode } from '../lib/wizardState'
import { StackItemWizard, type StackItemWizardProps } from './StackItemWizard'
import { SubstanceSearch } from './SubstanceSearch'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const vitaminD3: SubstanceCatalogEntry = {
  id: 'vitamin-d3',
  canonical_name: 'Vitamin D3',
  aliases: ['Cholecalciferol'],
  default_category: 'vitamin',
  suggested_units: ['IU'],
  suggested_dosage_forms: ['capsule'],
  pk_profile_id: null,
  active: true,
}

const vitaminK2: SubstanceCatalogEntry = {
  ...vitaminD3,
  id: 'vitamin-k2',
  canonical_name: 'Vitamin K2',
  aliases: ['Menachinon'],
}

const existingVitaminD: StackItem = {
  id: 'stack-1',
  user_id: 'user-1',
  display_name: 'Vitamin D3',
  category: 'vitamin',
  dosage_form: 'capsule',
  brand: 'Example Brand',
  color_hex: '#abcdef',
  notes: 'With breakfast',
  configuration_status: 'complete',
  tracking_level: 'complete',
  pk_profile_method: null,
  archived: false,
  archived_at: null,
  created_at: '2026-07-21T10:00:00.000Z',
  updated_at: '2026-07-21T10:00:00.000Z',
  ingredients: [{
    id: 'ingredient-1',
    stack_item_id: 'stack-1',
    catalog_substance_id: 'vitamin-d3',
    custom_name: '',
    amount_value: 5_000,
    amount_unit: 'IU',
    basis_value: 1,
    basis_unit: 'capsule',
    position: 0,
  }],
}

const pkVitaminD3: SubstanceCatalogEntry = {
  ...vitaminD3,
  suggested_units: ['mg'],
  pk_profile_id: 'pk-vitamin-d3',
}

const existingPlan: IntakePlanDraft = {
  id: 'cycle-1',
  name: 'Vitamin D breakfast',
  dose: 5000,
  unit: 'IU',
  method: 'Oral',
  frequency: 'Täglich',
  xDaysInterval: null,
  scheduleDays: [],
  startDate: '2025-01-01',
  endDate: null,
  routineGroup: 'morning',
  time: '08:30',
  reminders: ['on_time'],
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function renderWizard(overrides: Partial<StackItemWizardProps> = {}) {
  const onClose = vi.fn()
  const onOpenExisting = vi.fn()
  const onSave = vi.fn<(draft: StackItemSetupDraft, mode: WizardSaveMode) => Promise<void>>(
    async () => undefined,
  )
  const result = render(
    <StackItemWizard
      catalogEntries={[vitaminD3, vitaminK2]}
      existingItems={[]}
      onClose={onClose}
      onOpenExisting={onOpenExisting}
      onSave={onSave}
      {...overrides}
    />,
  )

  return { ...result, onClose, onOpenExisting, onSave }
}

function continueWizard(): void {
  fireEvent.click(screen.getByRole('button', { name: 'continue' }))
}

function startCustom(name: string): void {
  fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('my_stack_category'), { target: { value: 'supplement' } })
  continueWizard()
}

function completeCustomFlow(name = 'Custom Product'): void {
  startCustom(name)
  fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
  continueWizard()
  fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_complete_title/ }))
  continueWizard()
  continueWizard()
  fireEvent.change(screen.getByLabelText('my_stack_strength_value'), { target: { value: '100' } })
  fireEvent.change(screen.getByLabelText('my_stack_strength_unit'), { target: { value: 'mg' } })
  fireEvent.change(screen.getByLabelText('my_stack_basis_value'), { target: { value: '1' } })
  continueWizard()
  continueWizard()
  fireEvent.change(screen.getByLabelText('my_stack_plan_method'), { target: { value: 'Oral' } })
  fireEvent.change(screen.getByLabelText('my_stack_plan_quantity'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: 'capsule' } })
  continueWizard()
}

describe('StackItemWizard — Vorschau der Darreichungsform', () => {
  it('zeigt erst ab der gewaehlten Form ein Objekt', () => {
    renderWizard()
    startCustom('Kreatin')

    // Auf dem Schritt davor gibt es noch keine Form und damit nichts zu zeigen.
    expect(document.querySelector('[data-wizard-preview]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_powder' }))

    const vorschau = document.querySelector('[data-wizard-preview]')
    expect(vorschau).not.toBeNull()
    expect(vorschau!.querySelector('[data-stack-renderer="powder"]')).not.toBeNull()
  })

  it('bleibt ueber allen weiteren Schritten stehen und uebernimmt den Namen', () => {
    // Farbe und Menge kommen aus spaeteren Schritten. Stuende die Vorschau nur
    // ueber der Formauswahl, saehe man genau die Aenderungen nicht, die man
    // gerade macht.
    renderWizard()
    startCustom('Kreatin Monohydrat')
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_powder' }))
    continueWizard()

    const vorschau = document.querySelector('[data-wizard-preview]')
    expect(vorschau).not.toBeNull()
    expect(vorschau!.textContent).toContain('Kreatin Monohydrat')
  })

  it('gibt der Vorschau die Farbpalette mit, nicht ein Hex-Feld', () => {
    // Dieselbe Palette wie beim Anlegen eines Peptids, direkt unter dem Objekt,
    // das sie faerbt. Frueher lag hier ein Hex-Textfeld im letzten Schritt.
    renderWizard()
    startCustom('Kreatin')
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_powder' }))

    const vorschau = document.querySelector('[data-wizard-preview]')!
    const felder = vorschau.querySelectorAll('[data-color-swatch]')
    expect(felder.length).toBeGreaterThan(0)

    fireEvent.click(vorschau.querySelector('[data-color-swatch="#f59e0b"]') as HTMLElement)

    // Das Objekt traegt die Farbe sofort — ohne einen Schritt weiter zu gehen.
    expect(vorschau.querySelector('[data-powder-detail="lid"]')?.getAttribute('fill')).toBe('#f59e0b')
  })

  it('zeigt fuer Formen ohne Buehnengrafik gar nichts', () => {
    renderWizard()
    startCustom('Saft')
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_liquid' }))

    // Kein Rahmen, keine erfundene Grafik. Ein leerer Kasten saehe aus wie ein
    // Fehler.
    expect(document.querySelector('[data-wizard-preview]')).toBeNull()
  })
})

function completeCatalogFlow(): void {
  fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'Vitamin' } })
  fireEvent.click(screen.getByRole('option', { name: /Vitamin D3/ }))
  continueWizard()
  fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
  continueWizard()
  fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_complete_title/ }))
  continueWizard()
  continueWizard()
  fireEvent.change(screen.getByLabelText('my_stack_strength_value'), { target: { value: '5000' } })
  fireEvent.change(screen.getByLabelText('my_stack_basis_value'), { target: { value: '1' } })
  continueWizard()
  continueWizard()
  fireEvent.change(screen.getByLabelText('my_stack_plan_method'), { target: { value: 'Oral' } })
  fireEvent.change(screen.getByLabelText('my_stack_plan_quantity'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: 'capsule' } })
  continueWizard()
}

function reachExistingReview(changeForm = false): void {
  continueWizard()
  if (changeForm) {
    // Kein Aufklappen mehr noetig: beide Reihen stehen immer da.
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_drops' }))
  }
  continueWizard()
  continueWizard()
  continueWizard()
  continueWizard()
  continueWizard()
  if (!(screen.getByLabelText('my_stack_plan_method') as HTMLSelectElement).value) {
    fireEvent.change(screen.getByLabelText('my_stack_plan_method'), { target: { value: 'Oral' } })
  }
  fireEvent.change(screen.getByLabelText('my_stack_plan_quantity'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: changeForm ? 'ml' : 'capsule' } })
  continueWizard()
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => (
    window.setTimeout(() => callback(performance.now()), 0)
  ))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('StackItemWizard interactions', () => {
  it('uses the first profile-bearing ingredient by position for PK confirmation and save', async () => {
    const pkItem: StackItem = {
      ...existingVitaminD,
      pk_profile_method: null,
      ingredients: [{
        ...existingVitaminD.ingredients[0],
        id: 'ingredient-k2',
        catalog_substance_id: vitaminK2.id,
        position: 0,
      }, {
        ...existingVitaminD.ingredients[0],
        id: 'ingredient-d3',
        catalog_substance_id: pkVitaminD3.id,
        position: 1,
      }],
    }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      dose: 1,
      unit: 'mg',
      time: '08:30',
    }
    const { onSave } = renderWizard({
      catalogEntries: [vitaminK2, pkVitaminD3],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    const confirmation = screen.getByRole('checkbox', { name: 'my_stack_pk_method_confirm' })
    fireEvent.click(confirmation)
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].pkProfileMethod).toBe('Oral')
  })

  it('includes missing complete-strength fields in a PK upgrade flow', () => {
    const pkItem: StackItem = {
      ...existingVitaminD,
      tracking_level: 'with_amount',
      pk_profile_method: null,
      ingredients: existingVitaminD.ingredients.map(ingredient => ({
        ...ingredient,
        amount_value: null,
        amount_unit: null,
        basis_value: null,
        basis_unit: null,
      })),
    }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      dose: 1,
      unit: 'mg',
      time: null,
    }
    renderWizard({
      catalogEntries: [pkVitaminD3],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_complete_title/ }))
    continueWizard()

    expect(screen.getByLabelText('my_stack_strength_value')).toBeTruthy()
    expect(screen.queryByLabelText('my_stack_question')).toBeNull()
  })

  it('shows only the missing complete-tracking step for a PK edit intent', async () => {
    const pkItem: StackItem = {
      ...existingVitaminD,
      tracking_level: 'with_amount',
      pk_profile_method: 'Oral',
    }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      dose: 1,
      unit: 'mg',
      time: '08:30',
    }
    const { onSave } = renderWizard({
      catalogEntries: [pkVitaminD3],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    expect(screen.getByRole('group', { name: 'my_stack_tracking_question' })).toBeTruthy()
    expect(screen.queryByLabelText('my_stack_question')).toBeNull()
    expect(screen.queryByLabelText('my_stack_plan_frequency')).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_complete_title/ }))
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toMatchObject({
      trackingLevel: 'complete',
      pkProfileMethod: 'Oral',
      plan: { dose: 1, unit: 'mg', time: '08:30' },
    })
  })

  it('opens on the missing PK plan fields and requires explicit method confirmation', async () => {
    const pkItem: StackItem = {
      ...existingVitaminD,
      pk_profile_method: null,
    }
    const pkPlan: IntakePlanDraft = {
      ...existingPlan,
      dose: 1,
      unit: 'mg',
      time: null,
    }
    const { onSave } = renderWizard({
      catalogEntries: [pkVitaminD3],
      existingItem: pkItem,
      existingPlan: pkPlan,
      intent: 'pk',
    })

    expect(screen.getByLabelText('my_stack_plan_frequency')).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'my_stack_tracking_question' })).toBeNull()
    fireEvent.change(screen.getByLabelText('my_stack_plan_time'), { target: { value: '08:30' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'my_stack_pk_method_confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toMatchObject({
      pkProfileMethod: 'Oral',
      plan: { method: 'Oral', dose: 1, unit: 'mg', time: '08:30' },
    })
  })

  it('preserves raw multi-word typing and a chosen custom category', () => {
    renderWizard()
    const input = screen.getByLabelText('my_stack_question') as HTMLInputElement
    const category = screen.getByLabelText('my_stack_category') as HTMLSelectElement

    fireEvent.change(input, { target: { value: 'Vitamin' } })
    fireEvent.change(category, { target: { value: 'supplement' } })
    fireEvent.change(input, { target: { value: 'Vitamin ' } })

    expect(input.value).toBe('Vitamin ')
    expect(category.value).toBe('supplement')

    fireEvent.change(input, { target: { value: 'Vitamin D' } })
    expect(input.value).toBe('Vitamin D')
    expect(category.value).toBe('supplement')
  })

  it('clears stale catalog identity when catalog text is edited', () => {
    renderWizard()
    const input = screen.getByLabelText('my_stack_question') as HTMLInputElement
    const category = screen.getByLabelText('my_stack_category') as HTMLSelectElement

    fireEvent.change(input, { target: { value: 'Vitamin' } })
    fireEvent.click(screen.getByRole('option', { name: /Vitamin D3/ }))
    expect(category.value).toBe('vitamin')

    fireEvent.change(input, { target: { value: 'Own product' } })
    expect(category.value).toBe('')
  })

  it('supports listbox navigation and selection keys', () => {
    const onSelect = vi.fn()
    render(
      <SubstanceSearch
        query="Vitamin"
        entries={[vitaminD3, vitaminK2]}
        category={null}
        onQueryChange={() => undefined}
        onSelect={onSelect}
        onAddCustom={() => undefined}
        onCategoryChange={() => undefined}
      />,
    )
    const listbox = screen.getByRole('listbox')
    const options = within(listbox).getAllByRole('option')

    expect(options[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(options[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'Home' })
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'End' })
    expect(options[1].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'ArrowUp' })
    expect(options[0].getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith(vitaminD3)
  })

  it('uses Escape to dismiss results without closing the dialog and reopens on input', () => {
    const { onClose } = renderWizard()
    const input = screen.getByLabelText('my_stack_question') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Vitamin' } })
    const listbox = screen.getByRole('listbox')

    fireEvent.keyDown(listbox, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).toBeNull()

    fireEvent.change(input, { target: { value: 'Vitamin D' } })
    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  it('shows and focuses the product-name error on the ingredient step', async () => {
    renderWizard()
    startCustom('Custom Product')
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
    continueWizard()
    fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_complete_title/ }))
    continueWizard()
    const productName = screen.getByLabelText('my_stack_product_name') as HTMLInputElement

    fireEvent.change(productName, { target: { value: '' } })
    continueWizard()

    expect(screen.getByText('my_stack_name_required')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(productName))
    expect(screen.queryByText('my_stack_dosage_form')).toBeNull()
  })

  it('traps focus and restores it to the opener on unmount', async () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = renderWizard()
    const dialog = screen.getByRole('dialog')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))

    const close = screen.getByRole('button', { name: 'close' })
    const next = screen.getByRole('button', { name: 'continue' })
    next.focus()
    fireEvent.keyDown(next, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(next)

    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('requires a conscious tracking choice before a new item can advance', async () => {
    renderWizard()
    startCustom('Choice Required')
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
    continueWizard()

    const trackingGroup = screen.getByRole('group', { name: 'my_stack_tracking_question' })
    expect(screen.getAllByRole('radio').every(radio => !(radio as HTMLInputElement).checked))
      .toBe(true)

    continueWizard()

    expect(screen.getByText('my_stack_tracking_level_required')).toBeTruthy()
    expect(screen.queryByLabelText('my_stack_plan_frequency')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trackingGroup))

    fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_with_amount_title/ }))
    continueWizard()
    expect(screen.getByLabelText('my_stack_plan_frequency')).toBeTruthy()
  })

  it('follows the lower-depth path and reviews an intake without quantity', () => {
    renderWizard()
    startCustom('Simple Product')
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
    continueWizard()
  fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_intake_only_title/ }))
  continueWizard()

  expect(screen.queryByLabelText('my_stack_plan_quantity')).toBeNull()
  fireEvent.change(screen.getByLabelText('my_stack_plan_method'), { target: { value: 'Oral' } })
  continueWizard()

    expect(screen.getByText('my_stack_tracking_intake_only_title')).toBeTruthy()
    expect(screen.getByText('my_stack_quantity_not_tracked')).toBeTruthy()
    expect(screen.getByText('dosage_form_capsule')).toBeTruthy()
    expect(screen.getByText('Täglich')).toBeTruthy()
  })

  it('saves intake-only from review with null quantity instead of redirecting to hidden strength', async () => {
    const { onSave } = renderWizard()
    startCustom('Simple Product')
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
    continueWizard()
    fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_intake_only_title/ }))
    continueWizard()
    fireEvent.change(screen.getByLabelText('my_stack_plan_method'), { target: { value: 'Oral' } })
    continueWizard()

    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].trackingLevel).toBe('intake_only')
    expect(onSave.mock.calls[0][0].plan).toMatchObject({ dose: null, unit: null })
    expect(onSave.mock.calls[0][1]).toBe('create')
    expect(screen.queryByLabelText('my_stack_strength_value')).toBeNull()
  })
  it('hydrates the active plan and clears its id only when creating a duplicate', async () => {
    const updateRun = renderWizard({ existingItem: existingVitaminD, existingPlan })
    reachExistingReview()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(updateRun.onSave).toHaveBeenCalledTimes(1))
    expect(updateRun.onSave.mock.calls[0][0].plan).toMatchObject({
      id: 'cycle-1',
      name: 'Vitamin D breakfast',
      method: 'Oral',
      routineGroup: 'morning',
      time: '08:30',
    })
    cleanup()

    const duplicateRun = renderWizard({ existingItem: existingVitaminD, existingPlan })
    reachExistingReview(true)
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_create_variant' }))
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(duplicateRun.onSave).toHaveBeenCalledTimes(1))
    expect(duplicateRun.onSave.mock.calls[0][0].plan.id).toBeUndefined()
  })
  it('reviews complete tracking, routine, quantity, PK status, and product details', () => {
    renderWizard({ existingItem: existingVitaminD })
    reachExistingReview()

    expect(screen.getByText('my_stack_tracking_complete_title')).toBeTruthy()
    expect(screen.getByText('Täglich')).toBeTruthy()
    expect(screen.getByText('my_stack_routine_morning')).toBeTruthy()
    expect(screen.getByText('my_stack_no_exact_time')).toBeTruthy()
    expect(screen.getByText('1 capsule')).toBeTruthy()
    expect(screen.getByText('my_stack_pk_unavailable')).toBeTruthy()
    expect(screen.getByText('Example Brand')).toBeTruthy()
  })
  it('keeps generic inventory opt-in collapsed and reviews enabled stock', () => {
    renderWizard()
    startCustom('Inventory Product')
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
    continueWizard()
    fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_complete_title/ }))
    continueWizard()
    continueWizard()
    fireEvent.change(screen.getByLabelText('my_stack_strength_value'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('my_stack_strength_unit'), { target: { value: 'mg' } })
    fireEvent.change(screen.getByLabelText('my_stack_basis_value'), { target: { value: '1' } })
    continueWizard()

    const disclosure = screen.getByRole('button', { name: 'my_stack_product_inventory' })
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByLabelText('my_stack_package_quantity')).toBeNull()
    fireEvent.click(disclosure)
    fireEvent.change(screen.getByLabelText('my_stack_brand_optional'), {
      target: { value: 'Example Brand' },
    })
    expect(screen.queryByLabelText('my_stack_package_quantity')).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'my_stack_inventory_enabled' }))
    fireEvent.change(screen.getByLabelText('my_stack_package_quantity'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('my_stack_package_unit'), { target: { value: 'capsule' } })
    fireEvent.change(screen.getByLabelText('my_stack_remaining_quantity'), { target: { value: '42' } })

    continueWizard()
    fireEvent.change(screen.getByLabelText('my_stack_plan_method'), { target: { value: 'Oral' } })
    fireEvent.change(screen.getByLabelText('my_stack_plan_quantity'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: 'capsule' } })
    continueWizard()

    expect(screen.getByText('42 capsule')).toBeTruthy()
    expect(screen.getByText('Example Brand')).toBeTruthy()
  })

  it('does not emit hidden generic inventory after changing to a lower tracking level', async () => {
    const { onSave } = renderWizard()
    startCustom('Lower Depth Product')
    fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
    continueWizard()
    fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_complete_title/ }))
    continueWizard()
    continueWizard()
    fireEvent.change(screen.getByLabelText('my_stack_strength_value'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('my_stack_strength_unit'), { target: { value: 'mg' } })
    fireEvent.change(screen.getByLabelText('my_stack_basis_value'), { target: { value: '1' } })
    continueWizard()
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_product_inventory' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'my_stack_inventory_enabled' }))
    fireEvent.change(screen.getByLabelText('my_stack_package_quantity'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('my_stack_package_unit'), { target: { value: 'capsule' } })
    fireEvent.change(screen.getByLabelText('my_stack_remaining_quantity'), { target: { value: '42' } })

    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'back' }))
    }
    fireEvent.click(screen.getByRole('radio', { name: /my_stack_tracking_with_amount_title/ }))
    continueWizard()
    fireEvent.change(screen.getByLabelText('my_stack_plan_method'), { target: { value: 'Oral' } })
    fireEvent.change(screen.getByLabelText('my_stack_plan_quantity'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('my_stack_plan_unit'), { target: { value: 'capsule' } })
    continueWizard()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0].trackingLevel).toBe('with_amount')
    expect(onSave.mock.calls[0][0].inventory.enabled).toBe(false)
  })
  it('emits create, update, and duplicate payload modes', async () => {
    const createRun = renderWizard()
    completeCustomFlow('Create Product')
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(createRun.onSave).toHaveBeenCalledTimes(1))
    expect(createRun.onSave.mock.calls[0][0].displayName).toBe('Create Product')
    expect(createRun.onSave.mock.calls[0][0].plan).toMatchObject({ dose: 1, unit: 'capsule' })
    expect(createRun.onSave.mock.calls[0][0].inventory.enabled).toBe(false)
    expect(createRun.onSave.mock.calls[0][1]).toBe('create')
    cleanup()

    const updateRun = renderWizard({ existingItem: existingVitaminD })
    reachExistingReview()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(updateRun.onSave).toHaveBeenCalledTimes(1))
    expect(updateRun.onSave.mock.calls[0][0].id).toBe('stack-1')
    expect(updateRun.onSave.mock.calls[0][1]).toBe('update')
    cleanup()

    const duplicateRun = renderWizard({ existingItem: existingVitaminD })
    reachExistingReview(true)
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_create_variant' }))
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(duplicateRun.onSave).toHaveBeenCalledTimes(1))
    expect(duplicateRun.onSave.mock.calls[0][0].id).toBeUndefined()
    expect(duplicateRun.onSave.mock.calls[0][1]).toBe('duplicate')
  })

  it('focuses duplicate actions and blocks competing navigation during separate save', async () => {
    const pending = deferred<void>()
    const onSave = vi.fn(() => pending.promise)
    const { onClose, onOpenExisting } = renderWizard({
      existingItems: [existingVitaminD],
      onSave,
    })
    completeCatalogFlow()
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    const openExisting = await screen.findByRole('button', { name: 'my_stack_open_existing' }) as HTMLButtonElement
    const addSeparately = screen.getByRole('button', { name: 'my_stack_add_separately' }) as HTMLButtonElement
    const cancelDuplicate = screen.getAllByRole('button', { name: 'cancel' }).at(-1) as HTMLButtonElement
    await waitFor(() => expect(document.activeElement).toBe(openExisting))

    fireEvent.click(addSeparately)
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(openExisting.disabled).toBe(true)
    expect(cancelDuplicate.disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'close' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'back' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(openExisting)
    expect(onClose).not.toHaveBeenCalled()
    expect(onOpenExisting).not.toHaveBeenCalled()

    await act(async () => pending.reject(new Error('RPC failed')))
    expect(await screen.findByText('my_stack_save_error')).toBeTruthy()
    expect(openExisting.disabled).toBe(false)
    expect(cancelDuplicate.disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'close' }) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByRole('heading', { name: 'Vitamin D3' })).toBeTruthy()
  })

  it('keeps the complete draft open after a rejected save', async () => {
    const onSave = vi.fn(async () => { throw new Error('RPC failed') })
    const { onClose } = renderWizard({ onSave })
    completeCustomFlow('Multi Word Product')
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(await screen.findByText('my_stack_save_error')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Multi Word Product' })).toBeTruthy()

    for (let index = 0; index < 4; index += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'back' }))
    }
    expect((screen.getByLabelText('my_stack_product_name') as HTMLInputElement).value)
      .toBe('Multi Word Product')
  })
})
