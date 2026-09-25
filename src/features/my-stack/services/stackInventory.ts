import type { InventoryDraft } from '../types'

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

// Ohne trackingLevel: der Bestand haengt am eigenen Schalter, nicht an der
// Tracking-Stufe. Stand das Feld hier, waere es eine zweite Stelle, an der
// jemand die Regel nachbaut.
interface InventorySaveInput {
  userId: string
  stackItemId: string
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
  if (!input.inventory.enabled) return
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

export type InventoryReversalAction = 'undo' | 'skip' | 'delete'

export async function reverseInventoryConfirmation(
  client: {
    rpc(
      name: 'reverse_inventory_confirmation',
      params: {
        p_dose_log_id: string
        p_action: InventoryReversalAction
      },
    ): PromiseLike<{ data: number | null; error: ServiceError | null }>
  },
  doseLogId: string,
  action: InventoryReversalAction,
): Promise<number | null> {
  const { data, error } = await client.rpc('reverse_inventory_confirmation', {
    p_dose_log_id: doseLogId,
    p_action: action,
  })
  throwIfError(error)
  return data
}

// ── Bestand-Ansicht ─────────────────────────────────────────────────────────
// Was die Bestand-Ansicht aendert. Die Datenbank prueft die Werte (Checks auf
// stack_item_inventory) und dass die Zeile dem Nutzer gehoert (RLS).

export interface InventoryPatch {
  package_quantity?: number
  remaining_quantity?: number
  batch_number?: string | null
  batch_source?: string | null
  batch_file_url?: string | null
  expires_at?: string | null
  opened_at?: string | null
  use_within_days?: number | null
  reconstitution_ml?: number | null
  enabled?: boolean
}

interface InventoryTableClient {
  from(table: 'stack_item_inventory'): {
    update(values: InventoryPatch & { updated_at: string }): {
      eq(column: 'id', value: string): PromiseLike<{ error: ServiceError | null }>
    }
    upsert(
      values: Record<string, unknown>,
      options: { onConflict: 'stack_item_id' },
    ): PromiseLike<{ error: ServiceError | null }>
  }
}

/** Einzelne Angaben aendern — auch „Bestand korrigieren": die Zahl wird ersetzt. */
export async function updateInventory(
  client: InventoryTableClient,
  inventoryId: string,
  patch: InventoryPatch,
): Promise<void> {
  const { error } = await client
    .from('stack_item_inventory')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', inventoryId)
  throwIfError(error)
}

/** Bestand erstmals erfassen oder wieder einschalten. */
export async function startInventory(
  client: InventoryTableClient,
  input: {
    userId: string
    stackItemId: string
    packageQuantity: number
    packageUnit: string
    remainingQuantity: number
  },
): Promise<void> {
  const { error } = await client.from('stack_item_inventory').upsert({
    user_id: input.userId,
    stack_item_id: input.stackItemId,
    enabled: true,
    package_quantity: input.packageQuantity,
    package_unit: input.packageUnit,
    remaining_quantity: input.remainingQuantity,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'stack_item_id' })
  throwIfError(error)
}

interface InventoryRpcClient {
  rpc(
    name: 'add_inventory_package',
    params: { p_inventory_id: string; p_quantity: number },
  ): PromiseLike<{ data: number | null; error: ServiceError | null }>
  rpc(
    name: 'open_inventory_container',
    params: {
      p_inventory_id: string
      p_opened_at: string
      p_discard_rest: boolean
      p_reconstitution_ml: number | null
    },
  ): PromiseLike<{ data: number | null; error: ServiceError | null }>
}

/** Neue Packung: atomar zum aktuellen Stand addiert. */
export async function addInventoryPackage(
  client: InventoryRpcClient,
  inventoryId: string,
  quantity: number,
): Promise<number | null> {
  const { data, error } = await client.rpc('add_inventory_package', {
    p_inventory_id: inventoryId,
    p_quantity: quantity,
  })
  throwIfError(error)
  return data
}

/** Neues Vial anmischen bzw. neue Flasche oeffnen. */
export async function openInventoryContainer(
  client: InventoryRpcClient,
  inventoryId: string,
  input: { openedAt: string; discardRest: boolean; reconstitutionMl: number | null },
): Promise<number | null> {
  const { data, error } = await client.rpc('open_inventory_container', {
    p_inventory_id: inventoryId,
    p_opened_at: input.openedAt,
    p_discard_rest: input.discardRest,
    p_reconstitution_ml: input.reconstitutionMl,
  })
  throwIfError(error)
  return data
}

interface BatchStorageClient {
  storage: {
    from(bucket: 'batch-files'): {
      upload(path: string, file: File): PromiseLike<{ error: ServiceError | null }>
      getPublicUrl(path: string): { data: { publicUrl: string } }
    }
  }
}

/** Analyse-Dokument hochladen; gleicher Ablageort wie bisher. */
export async function uploadBatchDocument(
  client: BatchStorageClient,
  userId: string,
  file: File,
): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const path = `${userId}/${Date.now()}.${extension}`
  const bucket = client.storage.from('batch-files')
  const { error } = await bucket.upload(path, file)
  throwIfError(error)
  return bucket.getPublicUrl(path).data.publicUrl
}
