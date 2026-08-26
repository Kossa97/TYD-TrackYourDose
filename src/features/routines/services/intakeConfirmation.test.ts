import { describe, expect, it } from 'vitest'
import type { RoutineConfirmationEntry } from '../intakeGroups'
import { confirmIntakeGroup, quantifiedVialEntries, type IntakeConfirmationClient } from './intakeConfirmation'

function entry(overrides: Partial<RoutineConfirmationEntry> = {}): RoutineConfirmationEntry {
  return {
    key: 'd3',
    cycleId: 'cycle-d3',
    pendingLogId: null,
    stackItemId: 'stack-d3',
    stackItemName: 'Vitamin D3',
    trackingLevel: 'intake_only',
    group: 'morning',
    scheduledAt: '2026-07-29T08:00:00.000Z',
    dose: null,
    unit: null,
    method: 'Oral',
    injectable: false,
    selected: true,
    actualDose: null,
    actualUnit: null,
    ...overrides,
  }
}

describe('confirmIntakeGroup', () => {
  it('saves all selected mixed entries in one RPC call and returns their saved log IDs', async () => {
    const calls: Array<{ name: string; params: unknown }> = []
    const client: IntakeConfirmationClient = {
      rpc: async (name, params) => {
        calls.push({ name, params })
        return { data: [{ id: 'log-d3' }, { id: 'log-zinc' }], error: null }
      },
    }

    const result = await confirmIntakeGroup(client, [
      entry(),
      entry({
        key: 'zinc',
        cycleId: 'cycle-zinc',
        pendingLogId: 'pending-zinc',
        stackItemId: 'stack-zinc',
        stackItemName: 'Zink',
        trackingLevel: 'with_amount',
        dose: 25,
        unit: 'mg',
        actualDose: 30,
        actualUnit: 'mg',
      }),
      entry({ key: 'off', cycleId: 'cycle-off', selected: false }),
    ])

    expect(result).toEqual(['log-d3', 'log-zinc'])
    expect(calls).toEqual([{
      name: 'confirm_intake_group',
      params: {
        p_entries: [
          {
            cycle_id: 'cycle-d3',
            dose_log_id: null,
            slot_key: 'cycle-d3@2026-07-29T08:00:00.000Z',
            stack_item_id: 'stack-d3',
            dose: null,
            unit: null,
            method: 'Oral',
            logged_at: '2026-07-29T08:00:00.000Z',
          },
          {
            cycle_id: 'cycle-zinc',
            dose_log_id: 'pending-zinc',
            slot_key: 'cycle-zinc@2026-07-29T08:00:00.000Z',
            stack_item_id: 'stack-zinc',
            dose: 30,
            unit: 'mg',
            method: 'Oral',
            logged_at: '2026-07-29T08:00:00.000Z',
          },
        ],
      },
    }])
  })

  it('surfaces an RPC failure to the confirmation sheet', async () => {
    const client: IntakeConfirmationClient = {
      rpc: async () => ({ data: null, error: { message: 'group rejected' } }),
    }

    await expect(confirmIntakeGroup(client, [entry()])).rejects.toThrow('group rejected')
  })

  it('reuses the same deterministic slot key after an ambiguous retry', async () => {
    const slotKeys: string[] = []
    let attempt = 0
    const client: IntakeConfirmationClient = {
      rpc: async (_name, params) => {
        slotKeys.push(params.p_entries[0].slot_key)
        attempt += 1
        return attempt === 1
          ? { data: null, error: { message: 'response lost' } }
          : { data: [{ id: 'committed-log' }], error: null }
      },
    }

    await expect(confirmIntakeGroup(client, [entry()])).rejects.toThrow('response lost')
    await expect(confirmIntakeGroup(client, [entry()])).resolves.toEqual(['committed-log'])
    expect(slotKeys).toEqual([
      'cycle-d3@2026-07-29T08:00:00.000Z',
      'cycle-d3@2026-07-29T08:00:00.000Z',
    ])
  })

  it('limits post-confirm stock debits to selected quantified vial entries', () => {
    const vial = entry({
      key: 'vial',
      stackItemId: 'stack-vial',
      trackingLevel: 'complete',
      dose: 2,
      unit: 'mg',
      actualDose: 2,
      actualUnit: 'mg',
    })
    const deselectedVial = { ...vial, key: 'off', selected: false }
    const quantifiedTablet = { ...vial, key: 'tablet', stackItemId: 'stack-tablet' }

    expect(quantifiedVialEntries(
      [entry(), vial, deselectedVial, quantifiedTablet],
      new Set(['stack-vial']),
    ).map(item => item.key)).toEqual(['vial'])
  })
})
