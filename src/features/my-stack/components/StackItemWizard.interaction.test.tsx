// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StackItem, StackItemDraft, SubstanceCatalogEntry } from '../types'
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
  const onSave = vi.fn<(draft: StackItemDraft, mode: WizardSaveMode) => Promise<void>>(
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
  continueWizard()
  fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
  continueWizard()
  fireEvent.change(screen.getByLabelText('my_stack_strength_value'), { target: { value: '100' } })
  fireEvent.change(screen.getByLabelText('my_stack_strength_unit'), { target: { value: 'mg' } })
  fireEvent.change(screen.getByLabelText('my_stack_basis_value'), { target: { value: '1' } })
  continueWizard()
  continueWizard()
}

function completeCatalogFlow(): void {
  fireEvent.change(screen.getByLabelText('my_stack_question'), { target: { value: 'Vitamin' } })
  fireEvent.click(screen.getByRole('option', { name: /Vitamin D3/ }))
  continueWizard()
  continueWizard()
  fireEvent.click(screen.getByRole('button', { name: 'dosage_form_capsule' }))
  continueWizard()
  fireEvent.change(screen.getByLabelText('my_stack_strength_value'), { target: { value: '5000' } })
  fireEvent.change(screen.getByLabelText('my_stack_basis_value'), { target: { value: '1' } })
  continueWizard()
  continueWizard()
}

function reachExistingReview(changeForm = false): void {
  continueWizard()
  continueWizard()
  if (changeForm) fireEvent.click(screen.getByRole('button', { name: 'dosage_form_drops' }))
  continueWizard()
  continueWizard()
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

  it('emits create, update, and duplicate payload modes', async () => {
    const createRun = renderWizard()
    completeCustomFlow('Create Product')
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    await waitFor(() => expect(createRun.onSave).toHaveBeenCalledTimes(1))
    expect(createRun.onSave.mock.calls[0][0].displayName).toBe('Create Product')
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
