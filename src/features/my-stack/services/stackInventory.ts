import type { InventoryDraft, TrackingLevel } from '../types'

interface ServiceError {
  message: string
}

export interface StackItemInventoryRow {
  id: string
  user_id: string
  stack_item_id: string
  enabled: boolean
  package_quantity: number | null
  package_unit: string | null
  remaining_quantity: number | null
  batch_number: string | null
  expires_at: string | null
  created_at: string
  updated_at: string
}

interface InventorySaveInput {
  userId: string
  stackItemId: string
  trackingLevel: TrackingLevel
  inventory: InventoryDraft
}

export class InventoryConfirmationError extends Error {
  readonly doseLogIds: string[]

  constructor(doseLogIds: string[], message = 'Inventory confirmation failed') {
    super(message)
    this.name = 'InventoryConfirmationError'
    this.doseLogIds = doseLogIds
  }
}

function throwIfError(error: ServiceError | null): void {
  if (error) throw new Error(error.message)
}

export async function loadStackItemInventory(
  client: {
    from(table: 'stack_item_inventory'): {
      select(columns: '*'): {
        eq(column: 'stack_item_id', value: string): {
          maybeSingle(): PromiseLike<{ data: StackItemInventoryRow | null; error: ServiceError | null }>
        }
      }
    }
  },
  stackItemId: string,
): Promise<StackItemInventoryRow | null> {
  const { data, error } = await client
    .from('stack_item_inventory')
    .select('*')
    .eq('stack_item_id', stackItemId)
    .maybeSingle()
  throwIfError(error)
  return data
}

export async function saveStackItemInventory(
  client: {
    from(table: 'stack_item_inventory'): {
      upsert(
        values: Record<string, unknown>,
        options: { onConflict: 'stack_item_id' },
      ): PromiseLike<{ error: ServiceError | null }>
    }
  },
  input: InventorySaveInput,
): Promise<void> {
  if (input.trackingLevel !== 'complete' || !input.inventory.enabled) return
  const { error } = await client.from('stack_item_inventory').upsert({
    user_id: input.userId,
    stack_item_id: input.stackItemId,
    enabled: true,
    package_quantity: input.inventory.packageQuantity,
    package_unit: input.inventory.packageUnit?.trim() || null,
    remaining_quantity: input.inventory.remainingQuantity,
    batch_number: input.inventory.batchNumber.trim() || null,
    expires_at: input.inventory.expiresAt,
  }, { onConflict: 'stack_item_id' })
  throwIfError(error)
}

export async function applyInventoryConfirmation(
  client: {
    rpc(
      name: 'apply_inventory_confirmation',
      params: { p_dose_log_id: string },
    ): PromiseLike<{ data: number | null; error: ServiceError | null }>
  },
  doseLogId: string,
): Promise<number | null> {
  const { data, error } = await client.rpc('apply_inventory_confirmation', {
    p_dose_log_id: doseLogId,
  })
  throwIfError(error)
  return data
}
