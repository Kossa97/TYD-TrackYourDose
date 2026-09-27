// @vitest-environment jsdom

import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DosageFormKey, InventoryDraft } from '../types'
import { ProductInventorySection } from './ProductInventorySection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

const inventory: InventoryDraft = {
  enabled: true,
  packageQuantity: 5,
  packageUnit: 'vial',
  remainingQuantity: 3,
  brand: '',
  batchNumber: 'B-1',
  expiresAt: null,
  batchSource: '',
  batchFileUrl: null,
  reconstitutionMl: 2,
  openedAt: '2026-08-27',
  useWithinDays: 28,
}

function Harness({ form, onDraft }: { form: DosageFormKey; onDraft?: (draft: InventoryDraft) => void }) {
  const [draft, setDraft] = useState(inventory)
  return (
    <ProductInventorySection
      showInventory={false}
      brand=""
      inventory={draft}
      dosageForm={form}
      onBrandChange={() => undefined}
      onInventoryChange={changes => setDraft(current => {
        const next = { ...current, ...changes }
        onDraft?.(next)
        return next
      })}
    />
  )
}

describe('ProductInventorySection beim Bearbeiten', () => {
  it('zeigt beim Vial Flüssigkeit, Anmischdatum, Haltbarkeit und die Charge', () => {
    render(<Harness form="vial" />)
    fireEvent.click(screen.getByRole('button', { name: /my_stack_product_only/ }))

    expect((screen.getByLabelText('my_stack_stock_liquid (ml)') as HTMLInputElement).value).toBe('2')
    expect((screen.getByLabelText('my_stack_stock_mixed_on') as HTMLInputElement).value).toBe('2026-08-27')
    expect((screen.getByLabelText(/my_stack_stock_use_within_vial/) as HTMLInputElement).value).toBe('28')
    expect((screen.getByLabelText('my_stack_stock_batch_number') as HTMLInputElement).value).toBe('B-1')
    expect(screen.getByLabelText('my_stack_stock_source')).toBeTruthy()
    expect(screen.getByLabelText('my_stack_stock_expires')).toBeTruthy()
    // Die Mengen stehen hier nicht — die aendert „Bestand ändern".
    expect(screen.queryByLabelText(/my_stack_remaining_quantity|Aktueller Bestand/)).toBeNull()
  })

  it('zeigt bei Tabletten kein Anmischen, aber die Charge', () => {
    render(<Harness form="tablet" />)
    fireEvent.click(screen.getByRole('button', { name: /my_stack_product_only/ }))
    expect(screen.queryByLabelText('my_stack_stock_liquid (ml)')).toBeNull()
    expect(screen.queryByLabelText('my_stack_stock_opened_on')).toBeNull()
    expect(screen.getByLabelText('my_stack_stock_batch_number')).toBeTruthy()
  })

  it('merkt sich ein gewähltes Dokument, hochgeladen wird erst beim Speichern', () => {
    const onDraft = vi.fn()
    render(<Harness form="vial" onDraft={onDraft} />)
    fireEvent.click(screen.getByRole('button', { name: /my_stack_product_only/ }))
    const file = new File(['x'], 'analyse.pdf', { type: 'application/pdf' })
    const input = screen.getByLabelText('my_stack_stock_document') as HTMLInputElement
    fireEvent.change(input, { target: { files: [file] } })

    expect(onDraft).toHaveBeenCalledWith(expect.objectContaining({ batchFile: file }))
    expect(screen.getByText('analyse.pdf')).toBeTruthy()
    // Dieselbe Datei laesst sich danach erneut waehlen.
    expect(input.value).toBe('')
  })

  it('sagt direkt am Feld, wenn Flüssigkeit oder Tage nicht gehen', () => {
    render(<Harness form="vial" />)
    fireEvent.click(screen.getByRole('button', { name: /my_stack_product_only/ }))
    fireEvent.change(screen.getByLabelText('my_stack_stock_liquid (ml)'), { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText(/my_stack_stock_use_within_vial/), { target: { value: '2.5' } })
    expect(screen.getByText('my_stack_stock_liquid_invalid')).toBeTruthy()
    expect(screen.getByText('my_stack_stock_days_invalid')).toBeTruthy()
  })
})
