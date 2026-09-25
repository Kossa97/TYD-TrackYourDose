import { describe, expect, it } from 'vitest'
import { expirySources, vialStockOverview, type StockOverviewItem } from './stockOverview'

const migrated: StockOverviewItem = {
  id: 'a',
  display_name: 'A',
  vials_in_stock: 0.95,
  reconstitution_date: '2026-09-01',
  expiry_days: 28,
  inventory_item_id: 'lager-a',
  inventory: { enabled: true, package_unit: 'vial', remaining_quantity: 2.95, opened_at: '2026-09-20', use_within_days: 14 },
}

const legacy: StockOverviewItem = {
  id: 'b',
  display_name: 'B',
  vials_in_stock: 1,
  reconstitution_date: '2026-09-10',
  expiry_days: 28,
  inventory_item_id: 'lager-b',
  inventory: null,
}

describe('expirySources', () => {
  it('reads the opened date and shelf life from the new stock when there is one', () => {
    expect(expirySources([migrated, legacy])).toEqual([
      { id: 'a', name: 'A', reconstitution_date: '2026-09-20', expiry_days: 14 },
      { id: 'b', name: 'B', reconstitution_date: '2026-09-10', expiry_days: 28 },
    ])
  })

  it('also reads an opened pen or bottle from the stock', () => {
    const pen = { ...legacy, inventory: [{ enabled: true, package_unit: 'ml', opened_at: '2026-09-20', use_within_days: 28 }] }
    expect(expirySources([pen])[0]).toMatchObject({ reconstitution_date: '2026-09-20', expiry_days: 28 })
  })

  it('warns about nothing for a vial whose stock is switched off', () => {
    const off = { ...migrated, inventory: { ...migrated.inventory as object, enabled: false } }
    expect(expirySources([off])[0]).toMatchObject({ reconstitution_date: null, expiry_days: null })
  })
})

describe('vialStockOverview', () => {
  it('counts full vials from the new stock and leaves out its old warehouse row', () => {
    expect(vialStockOverview([migrated, legacy], [
      { id: 'lager-a', vials_count: 2 },
      { id: 'lager-b', vials_count: 3 },
      { id: 'verwaist', vials_count: 1 },
    ])).toEqual({ inventoryVials: 2 + 3 + 1, lowStock: 1 })
  })

  it('counts nothing for a vial whose stock is switched off, and not its old warehouse row either', () => {
    const off = { ...migrated, inventory: { ...migrated.inventory as object, enabled: false } }
    expect(vialStockOverview([off], [{ id: 'lager-a', vials_count: 2 }])).toEqual({ inventoryVials: 0, lowStock: 0 })
  })

  it('marks a migrated vial with at most one left as low', () => {
    const low = { ...migrated, inventory: { ...migrated.inventory as object, remaining_quantity: 0.4 } }
    expect(vialStockOverview([low], [])).toEqual({ inventoryVials: 0, lowStock: 1 })
  })
})
