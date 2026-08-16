import type { RoutineConfirmationEntry } from '../intakeGroups'
import { hasTrackedQuantity } from '../quantityPresentation'

interface ServiceError {
  message: string
}

interface SavedDoseLog {
  id: string
}

interface ConfirmIntakeGroupRpcEntry {
  cycle_id: string
  dose_log_id: string | null
  stack_item_id: string
  dose: number | null
  unit: string | null
  method: string
  logged_at: string
}

interface ConfirmIntakeGroupRpcParams {
  p_entries: ConfirmIntakeGroupRpcEntry[]
}

export interface IntakeConfirmationClient {
  rpc(
    name: 'confirm_intake_group',
    params: ConfirmIntakeGroupRpcParams,
  ): PromiseLike<{ data: SavedDoseLog[] | null; error: ServiceError | null }>
}

export type QuantifiedConfirmationEntry = RoutineConfirmationEntry & {
  actualDose: number
  actualUnit: string
}

export function quantifiedVialEntries(
  entries: RoutineConfirmationEntry[],
  vialStackItemIds: ReadonlySet<string>,
): QuantifiedConfirmationEntry[] {
  return entries.filter((entry): entry is QuantifiedConfirmationEntry => (
    entry.selected
    && vialStackItemIds.has(entry.stackItemId)
    && hasTrackedQuantity({ dose: entry.actualDose, unit: entry.actualUnit })
  ))
}

export async function confirmIntakeGroup(
  client: IntakeConfirmationClient,
  entries: RoutineConfirmationEntry[],
): Promise<string[]> {
  const p_entries = entries
    .filter(entry => entry.selected)
    .map(entry => ({
      cycle_id: entry.cycleId,
      dose_log_id: entry.pendingLogId,
      stack_item_id: entry.stackItemId,
      dose: entry.trackingLevel === 'intake_only' ? null : entry.actualDose,
      unit: entry.trackingLevel === 'intake_only' ? null : entry.actualUnit,
      method: entry.method,
      logged_at: entry.scheduledAt,
    }))

  const { data, error } = await client.rpc('confirm_intake_group', { p_entries })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('confirm_intake_group returned no data')
  return data.map(row => row.id)
}
