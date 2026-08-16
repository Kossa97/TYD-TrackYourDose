import { describe, expect, it, vi } from 'vitest'
import type { InventoryDraft } from '../types'
import {
  applyInventoryConfirmation,
  loadStackItemInventory,
  saveStackItemInventory,
} from './stackInventory'

const inventory: InventoryDraft = {
  enabled: true,
  packageQuantity: 60,
  packageUnit: 'capsule',
  remainingQuantity: 42,
  brand: 'Example',
  batchNumber: 'A-42',
  expiresAt: '2027-08-01',
}

function queryResult(data: unknown, error: { message: string } | null = null) {
  const query: Record<string, unknown> = {}
  query.select = vi.fn(() => query)
  query.eq = vi.fn(() => query)
  query.maybeSingle = vi.fn(async () => ({ data, error }))
  return query
}

describe('stack inventory service', () => {
  it('loads the optional inventory row for one stack item', async () => {
    const row = {
      id: 'inventory-1',
      user_id: 'user-1',
      stack_item_id: 'stack-1',
      enabled: true,
      package_quantity: 60,
      package_unit: 'capsule',
      remaining_quantity: 42,
      batch_number: 'A-42',
      expires_at: '2027-08-01',
      created_at: '2026-08-17T00:00:00.000Z',
      updated_at: '2026-08-17T00:00:00.000Z',
    }
    const query = queryResult(row)
    const from = vi.fn(() => query)

    await expect(loadStackItemInventory({ from } as never, 'stack-1')).resolves.toEqual(row)
    expect(from).toHaveBeenCalledWith('stack_item_inventory')
    expect(query.eq).toHaveBeenCalledWith('stack_item_id', 'stack-1')
  })

  it('persists a normalized row only for complete tracking with inventory enabled', async () => {
    const query = queryResult(null)
    query.upsert = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => query)

    await saveStackItemInventory({ from } as never, {
      userId: 'user-1',
      stackItemId: 'stack-1',
      trackingLevel: 'complete',
      inventory: { ...inventory, packageUnit: ' capsule ', batchNumber: ' A-42 ' },
    })

    expect(query.upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      stack_item_id: 'stack-1',
      enabled: true,
      package_quantity: 60,
      package_unit: 'capsule',
      remaining_quantity: 42,
      batch_number: 'A-42',
      expires_at: '2027-08-01',
    }, { onConflict: 'stack_item_id' })
  })

  it.each(['intake_only', 'with_amount'] as const)(
    'does not persist hidden inventory for %s tracking',
    async trackingLevel => {
      const query = queryResult(null)
      query.upsert = vi.fn(async () => ({ error: null }))
      const from = vi.fn(() => query)

      await saveStackItemInventory({ from } as never, {
        userId: 'user-1',
        stackItemId: 'stack-1',
        trackingLevel,
        inventory,
      })

      expect(from).not.toHaveBeenCalled()
    },
  )

  it('calls the idempotent inventory RPC for a committed dose log', async () => {
    const rpc = vi.fn(async () => ({ data: 41, error: null }))

    await applyInventoryConfirmation({ rpc }, 'dose-log-1')

    expect(rpc).toHaveBeenCalledWith('apply_inventory_confirmation', {
      p_dose_log_id: 'dose-log-1',
    })
  })

  it('surfaces an inventory RPC failure for a separate retry', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'conversion failed' } }))

    await expect(applyInventoryConfirmation({ rpc }, 'dose-log-1'))
      .rejects.toThrow('conversion failed')
  })
})
