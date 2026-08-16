// @vitest-environment jsdom

import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { InventoryDraft } from '../types'
import { ProductInventorySection } from './ProductInventorySection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue }),
}))

const emptyInventory: InventoryDraft = {
  enabled: false,
  packageQuantity: null,
  packageUnit: null,
  remainingQuantity: null,
  brand: '',
  batchNumber: '',
  expiresAt: null,
}

function Harness() {
  const [brand, setBrand] = useState('')
  const [inventory, setInventory] = useState(emptyInventory)
  return (
    <ProductInventorySection
      brand={brand}
      inventory={inventory}
      onBrandChange={setBrand}
      onInventoryChange={changes => setInventory(current => ({ ...current, ...changes }))}
    />
  )
}

afterEach(cleanup)

describe('ProductInventorySection', () => {
  it('starts collapsed and keeps inventory inputs unmounted until explicit opt-in', () => {
    render(<Harness />)

    const disclosure = screen.getByRole('button', { name: 'Produkt & Bestand' })
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByLabelText('Marke (optional)')).toBeNull()
    expect(screen.queryByLabelText('Packungsgröße')).toBeNull()

    fireEvent.click(disclosure)
    expect(screen.getByLabelText('Marke (optional)')).toBeTruthy()
    expect(screen.getByRole('checkbox', { name: 'Bestand mitverfolgen' })).toBeTruthy()
    expect(screen.queryByLabelText('Packungsgröße')).toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Bestand mitverfolgen' }))
    expect(screen.getByLabelText('Packungsgröße')).toBeTruthy()
    expect(screen.getByLabelText('Packungseinheit')).toBeTruthy()
    expect(screen.getByLabelText('Aktueller Bestand')).toBeTruthy()
  })

  it('keeps brand editable without enabling inventory', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Produkt & Bestand' }))

    const brand = screen.getByLabelText('Marke (optional)') as HTMLInputElement
    fireEvent.change(brand, { target: { value: 'Example Brand' } })

    expect(brand.value).toBe('Example Brand')
    expect((screen.getByRole('checkbox', { name: 'Bestand mitverfolgen' }) as HTMLInputElement).checked)
      .toBe(false)
  })
})
