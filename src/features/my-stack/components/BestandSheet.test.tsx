// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { StackItemIngredient, StackItemInventory } from '../types'
import { BestandCard, BestandSheet, type BestandActions } from './BestandSheet'

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
    addPackage: vi.fn(async () => undefined),
    openContainer: vi.fn(async () => undefined),
    uploadDocument: vi.fn(async () => 'https://synthetic.invalid/a.pdf'),
  }
}

function renderSheet(inventory: StackItemInventory | null, form: 'vial' | 'tablet' = 'vial') {
  const handlers = actions()
  render(
    <BestandSheet
      itemName="BPC-157"
      dosageForm={form}
      inventory={inventory}
      ingredients={[ingredient]}
      timelines={[]}
      timeZone="Europe/Berlin"
      deductsIntakes
      now={new Date('2026-09-25T08:00:00.000Z')}
      onClose={vi.fn()}
      actions={handlers}
    />,
  )
  return handlers
}

describe('BestandSheet', () => {
  it('shows full vials, the mixed one, the mixed-vial block and the batch', () => {
    renderSheet(vial)
    const summary = document.querySelector<HTMLElement>('[data-stock-summary]')!

    expect(summary.textContent).toContain('my_stack_stock_unit_vial_multiple(n=2)')
    expect(summary.textContent).toContain('my_stack_stock_mixed_extra(percent=95)')
    expect(summary.textContent).toContain('my_stack_stock_range_no_plan')
    expect(screen.getByText('my_stack_stock_opened_vial')).not.toBeNull()
    expect(screen.getByText('15.09.2026')).not.toBeNull()
    expect(screen.getByText('my_stack_stock_days_multiple(n=28) · my_stack_stock_until(date=13.10.)')).not.toBeNull()
    expect(screen.getByText('C-1')).not.toBeNull()
  })

  it('adds a package with the package size prefilled', async () => {
    const handlers = renderSheet(vial)
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_stock_add_package' }))
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_add_amount' })
    expect((within(editor).getByRole('textbox') as HTMLInputElement).value).toBe('5')

    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.addPackage).toHaveBeenCalledWith(5))
    expect(handlers.update).not.toHaveBeenCalled()
  })

  it('corrects the stock by replacing the number', async () => {
    const handlers = renderSheet(vial)
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_stock_correct' }))
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_correct' })
    fireEvent.change(within(editor).getByRole('textbox'), { target: { value: '4,5' } })
    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))

    await waitFor(() => expect(handlers.update).toHaveBeenCalledWith({ remaining_quantity: 4.5 }))
  })

  it('mixes a new vial and offers to discard the rest of the old one', async () => {
    const handlers = renderSheet(vial)
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_stock_mix_new' }))
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_mix_new' })
    expect(within(editor).getByRole('checkbox', { name: 'my_stack_stock_discard_rest(amount=95 %)' })).toHaveProperty('checked', true)

    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.openContainer).toHaveBeenCalledWith(expect.objectContaining({
      discardRest: true,
      reconstitutionMl: 2,
    })))
  })

  it('has no opened block for tablets', () => {
    renderSheet({ ...vial, package_unit: 'tablet', package_quantity: 60, remaining_quantity: 42, opened_at: null }, 'tablet')

    expect(screen.queryByText('my_stack_stock_opened_vial')).toBeNull()
    expect(screen.queryByRole('button', { name: 'my_stack_stock_mix_new' })).toBeNull()
    expect(document.querySelector('[data-stock-summary]')!.textContent).toContain('my_stack_stock_unit_tablet_multiple(n=42)')
  })

  it('starts tracking with the unit the ingredients count in', async () => {
    const handlers = renderSheet(null)
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_stock_start' }))
    const editor = screen.getByRole('dialog', { name: 'my_stack_stock_start' })
    const [packung, rest] = within(editor).getAllByRole('textbox')
    fireEvent.change(packung, { target: { value: '5' } })
    fireEvent.change(rest, { target: { value: '3' } })
    expect((within(editor).getByRole('combobox') as HTMLSelectElement).value).toBe('vial')

    fireEvent.click(within(editor).getByRole('button', { name: 'my_stack_stock_save' }))
    await waitFor(() => expect(handlers.start).toHaveBeenCalledWith({ packageQuantity: 5, packageUnit: 'vial', remainingQuantity: 3 }))
  })

  it('keeps the editor open when saving fails', async () => {
    const handlers = renderSheet(vial)
    vi.mocked(handlers.update).mockRejectedValueOnce(new Error('nope'))
    fireEvent.click(screen.getByRole('button', { name: 'my_stack_stock_correct' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'my_stack_stock_correct' })).getByRole('button', { name: 'my_stack_stock_save' }))

    await waitFor(() => expect(handlers.update).toHaveBeenCalled())
    expect(screen.getByRole('dialog', { name: 'my_stack_stock_correct' })).not.toBeNull()
  })
})

describe('BestandCard', () => {
  it('summarises the stock and opens the sheet', () => {
    const onOpen = vi.fn()
    render(
      <BestandCard dosageForm="vial" inventory={vial} ingredients={[ingredient]} timelines={[]} timeZone="Europe/Berlin" onOpen={onOpen} />,
    )
    const card = document.querySelector<HTMLElement>('[data-stack-detail="bestand"]')!
    expect(card.textContent).toContain('my_stack_stock_unit_vial_multiple(n=2)')
    fireEvent.click(card)
    expect(onOpen).toHaveBeenCalled()
  })

  it('says when stock is not tracked', () => {
    render(<BestandCard dosageForm="tablet" inventory={null} ingredients={[]} timelines={[]} timeZone="Europe/Berlin" onOpen={vi.fn()} />)
    expect(screen.getByText('my_stack_stock_not_tracked')).not.toBeNull()
  })
})
