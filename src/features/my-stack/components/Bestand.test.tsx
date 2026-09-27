// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StackItemIngredient, StackItemInventory } from '../types'
import { BestandCard, BestandEditorHost, type BestandActions, type BestandEditorArt } from './Bestand'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'de', resolvedLanguage: 'de' },
    t: (key: string, options?: Record<string, unknown>) => {
      const werte = Object.entries(options ?? {}).map(([name, wert]) => `${name}=${String(wert)}`)
      return werte.length > 0 ? `${key}(${werte.join(',')})` : key
    },
  }),
}))

afterEach(cleanup)

const vial: StackItemInventory = {
  id: 'inv-1',
  enabled: true,
  package_quantity: 5,
  package_unit: 'vial',
  remaining_quantity: 2.95,
  batch_number: 'C-1',
  expires_at: null,
  batch_source: null,
  batch_file_url: null,
  opened_at: '2026-09-15',
  use_within_days: 28,
  reconstitution_ml: 2,
}

const ingredient: StackItemIngredient = {
  catalog_substance_id: null,
  custom_name: 'Wirkstoff',
  amount_value: 10,
  amount_unit: 'mg',
  basis_value: 1,
  basis_unit: 'vial',
  position: 0,
}

function actions(): BestandActions {
  return {
    start: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
    openContainer: vi.fn(async () => undefined),
    uploadDocument: vi.fn(async () => 'https://synthetic.invalid/a.pdf'),
  }
}

function renderEditor(editor: BestandEditorArt, inventory: StackItemInventory | null, form: 'vial' | 'tablet' | 'pen' = 'vial') {
  const handlers = actions()
  const onClose = vi.fn()
  render(
    <BestandEditorHost
      editor={editor}
      dosageForm={form}
      inventory={inventory}
      ingredients={[ingredient]}
      onClose={onClose}
      actions={handlers}
    />,
  )
  return { handlers, onClose }
}

describe('BestandCard', () => {
  it('summarises the stock and offers „Bestand ändern“ instead of opening a window', () => {
    const onEdit = vi.fn()
    render(<BestandCard dosageForm="vial" inventory={vial} ingredients={[ingredient]} timelines={[]} timeZone="Europe/Berlin" onEdit={onEdit} />)
    const card = document.querySelector<HTMLElement>('[data-stack-detail="bestand"]')!
    expect(card.textContent).toContain('my_stack_stock_unit_vial_multiple(n=2)')
    expect(card.textContent).toContain('my_stack_stock_mixed_extra(percent=95)')
    fireEvent.click(within(card).getByRole('button', { name: 'my_stack_stock_edit' }))
    expect(onEdit).toHaveBeenCalledWith('correct')
  })

  it('starts tracking from the card when stock is not tracked', () => {
    const onEdit = vi.fn()
    render(<BestandCard dosageForm="tablet" inventory={null} ingredients={[]} timelines={[]} timeZone="Europe/Berlin" onEdit={onEdit} />)
    expect(screen.getByText('my_stack_stock_not_tracked')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_stock_start' }))
    expect(onEdit).toHaveBeenCalledWith('start')
  })
})

describe('Bestand ändern', () => {
  it('shows unopened vials and the mixed one in percent, both editable', async () => {
    const { handlers, onClose } = renderEditor('correct', vial)
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_edit' })
    const voll = within(editor).getByLabelText('my_stack_stock_unopened_vial') as HTMLInputElement
    const prozent = within(editor).getByLabelText('my_stack_stock_opened_percent_vial') as HTMLInputElement
    expect(voll.value).toBe('2')
    expect(prozent.value).toBe('95')

    fireEvent.change(voll, { target: { value: '3' } })
    fireEvent.change(prozent, { target: { value: '40' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.update).toHaveBeenCalledWith({ remaining_quantity: 3.4 }))
    expect(onClose).toHaveBeenCalled()
  })

  it('counts pens by container size, the opened one in percent', async () => {
    const pen: StackItemInventory = { ...vial, package_unit: 'ml', package_quantity: 3, remaining_quantity: 7.5, reconstitution_ml: null }
    const { handlers } = renderEditor('correct', pen, 'pen')
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_edit' })
    expect((within(editor).getByLabelText('my_stack_stock_unopened_pen') as HTMLInputElement).value).toBe('2')
    expect((within(editor).getByLabelText('my_stack_stock_opened_percent_pen') as HTMLInputElement).value).toBe('50')
    fireEvent.change(within(editor).getByLabelText('my_stack_stock_opened_percent_pen'), { target: { value: '100' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.update).toHaveBeenCalledWith({ remaining_quantity: 9 }))
  })

  it('refuses a percentage above 100', () => {
    renderEditor('correct', vial)
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_edit' })
    fireEvent.change(within(editor).getByLabelText('my_stack_stock_opened_percent_vial'), { target: { value: '120' } })
    expect(within(editor).getByRole('button', { name: 'my_stack_stock_save' })).toHaveProperty('disabled', true)
  })

  it('keeps one amount for forms without an opened container', async () => {
    const { handlers } = renderEditor('correct', { ...vial, package_unit: 'tablet', package_quantity: 60, remaining_quantity: 42, opened_at: null }, 'tablet')
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_edit' })
    fireEvent.change(within(editor).getByRole('textbox'), { target: { value: '4,5' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.update).toHaveBeenCalledWith({ remaining_quantity: 4.5 }))
  })

  it('stops tracking from the same place', async () => {
    const { handlers } = renderEditor('correct', vial)
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_stock_stop' }))
    await waitFor(() => expect(handlers.update).toHaveBeenCalledWith({ enabled: false }))
  })

  it('keeps the editor open when saving fails', async () => {
    const { handlers, onClose } = renderEditor('correct', vial)
    vi.mocked(handlers.update).mockRejectedValueOnce(new Error('nope'))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'my_stack_stock_edit' })).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.update).toHaveBeenCalled())
    expect(screen.getByRole('dialog', { name: 'my_stack_stock_edit' })).not.toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('single fields opened from the detail view', () => {
  it('mixes a new vial and offers to discard the rest of the old one', async () => {
    const { handlers } = renderEditor('open_new', vial)
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_mix_new' })
    expect(within(editor).getByRole('checkbox', { name: 'my_stack_stock_discard_rest(amount=95 %)' })).toHaveProperty('checked', true)
    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.openContainer).toHaveBeenCalledWith(expect.objectContaining({ discardRest: true, reconstitutionMl: 2 })))
  })

  it('edits the added liquid', async () => {
    const { handlers } = renderEditor('reconstitution_ml', vial)
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_liquid' })
    fireEvent.change(within(editor).getByRole('textbox'), { target: { value: '3' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.update).toHaveBeenCalledWith({ reconstitution_ml: 3 }))
  })

  it('starts tracking with the unit the ingredients count in', async () => {
    const { handlers } = renderEditor('start', null)
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_start' })
    const [packung, rest] = within(editor).getAllByRole('textbox')
    fireEvent.change(packung, { target: { value: '5' } })
    fireEvent.change(rest, { target: { value: '3' } })
    expect((within(editor).getByRole('combobox') as HTMLSelectElement).value).toBe('vial')
    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.start).toHaveBeenCalledWith({ packageQuantity: 5, packageUnit: 'vial', remainingQuantity: 3 }))
  })
})
