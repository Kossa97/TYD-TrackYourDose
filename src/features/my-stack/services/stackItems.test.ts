import { describe, expect, it, vi } from 'vitest'
import type { PlanScheduleSnapshot } from '../../../lib/planTimeline'
import { emptyRhythm } from '../lib/intakeRhythm'
import type { PlanEditTarget, PlanEffectiveDraft } from '../lib/wizardState'
import type {
  StackItemDraft,
  StackItemIngredient,
  StackItemSetupDraft,
  SubstanceCatalogEntry,
} from '../types'
import {
  archiveStackItem,
  deleteStackItem,
  findDuplicate,
  loadStackItems,
  restoreStackItem,
  reconstituteStackItem,
  savePlanChange,
  saveStackItem,
  saveStackItemSetup,
  saveVialTracking,
  type LoadedStackItem,
  type SaveStackItemRpcParams,
  type SaveStackItemSetupRpcParams,
  type SavedStackItemRow,
  type StackItemMutationClient,
  type StackItemQueryClient,
  type StackItemRpcClient,
  type StackItemSetupRpcClient,
} from './stackItems'
import type { PlanRpcClient } from './planLifecycle'

const ingredient: StackItemIngredient = {
  catalog_substance_id: 'vitamin-d3',
  custom_name: '',
  amount_value: 5000,
  amount_unit: 'IU',
  basis_value: 1,
  basis_unit: 'capsule',
  position: 0,
}

const validDraft: StackItemDraft = {
  displayName: 'Vitamin D3',
  category: 'vitamin',
  trackingLevel: 'complete',
  dosageForm: 'capsule',
  brand: '',
  colorHex: '#abcdef',
  notes: '',
  ingredients: [ingredient],
}

const completeSetupDraft: StackItemSetupDraft = {
  ...validDraft,
  plan: {
    name: 'Vitamin D3 morgens',
    unit: 'IU',
    method: 'Oral',
    rhythm: emptyRhythm(),
    startDate: '2026-08-17',
    endDate: null,
    slots: [{ routineGroup: 'morning', time: '08:30', dose: 5000, weekdays: [] }],
    reminders: ['on_time'],
  },
  inventory: {
    enabled: false,
    packageQuantity: null,
    packageUnit: null,
    remainingQuantity: null,
    brand: '',
    batchNumber: '',
    expiresAt: null,
  },
  pkProfileMethod: 'Oral',
}

const intakeOnlySetupDraft: StackItemSetupDraft = {
  ...completeSetupDraft,
  trackingLevel: 'intake_only',
  plan: {
    ...completeSetupDraft.plan,
    unit: null,
    slots: completeSetupDraft.plan.slots.map(slot => ({ ...slot, dose: null })),
  },
}

const savedItem: SavedStackItemRow = {
  id: 'stack-item-1',
  user_id: 'user-1',
  display_name: 'Vitamin D3',
  category: 'vitamin',
  dosage_form: 'capsule',
  brand: null,
  color_hex: '#abcdef',
  notes: null,
  configuration_status: 'complete',
  tracking_level: 'complete',
  pk_profile_method: null,
  archived: false,
  archived_at: null,
  created_at: '2026-07-21T00:00:00.000Z',
  updated_at: '2026-07-21T00:00:00.000Z',
}

const catalogEntry: SubstanceCatalogEntry = {
  id: 'vitamin-d3',
  canonical_name: 'Vitamin D3',
  aliases: ['Cholecalciferol'],
  default_category: 'vitamin',
  suggested_units: ['IU'],
  suggested_dosage_forms: ['capsule'],
  pk_profile_id: null,
  active: true,
}

const loadedItem: LoadedStackItem = {
  ...savedItem,
  ingredients: [{
    ...ingredient,
    substance_catalog: catalogEntry,
  }],
}

function rpcClient() {
  const rpc = vi.fn(async (_name: 'save_stack_item', _params: SaveStackItemRpcParams) => ({
    data: savedItem,
    error: null,
  }))
  const client: StackItemRpcClient = { rpc }
  return { client, rpc }
}

function setupRpcClient() {
  const rpc = vi.fn(async (
    _name: 'save_stack_item_with_plan',
    _params: SaveStackItemSetupRpcParams,
  ) => ({ data: savedItem, error: null }))
  const client: StackItemSetupRpcClient = { rpc }
  return { client, rpc }
}

function planRpcClient() {
  const rpc = vi.fn(async (_name: string, _params: Record<string, unknown>) => ({
    data: [{
      id: 'version-result',
      cycle_id: 'cycle-1',
      effective_kind: 'instant',
      effective_at: '2026-09-19T10:15:00.000Z',
      effective_local_date: null,
      change_kind: 'dose',
      frequency: 'Täglich',
      x_days_interval: null,
      interval_unit: null,
      cycle_on_days: null,
      cycle_off_days: null,
      schedule_days: [],
      intake_time: 'morgens',
      intake_time_custom: '08:30',
      slot_doses: null,
      slot_days: null,
      dose: 6000,
      unit: 'IU',
      method: 'Oral',
    }],
    error: null,
  }))
  const client = { rpc, from: vi.fn() } as unknown as PlanRpcClient
  return { client, rpc }
}

const planSnapshot: PlanScheduleSnapshot = {
  frequency: 'Täglich',
  x_days_interval: null,
  interval_unit: null,
  cycle_on_days: null,
  cycle_off_days: null,
  schedule_days: [],
  intake_time: 'morgens',
  intake_time_custom: '08:30',
  slot_doses: null,
  slot_days: null,
  dose: 6000,
  unit: 'IU',
  method: 'Oral',
}

describe('stack item service', () => {
  it('creates a new version for the exact cycle with an instant boundary', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-19T10:15:00.000Z'))
    const mockClient = planRpcClient()
    const target: PlanEditTarget = {
      cycleId: 'cycle-1',
      versionId: null,
      mode: 'new_change',
    }
    const effective: PlanEffectiveDraft = { kind: 'now', localDate: null }

    await savePlanChange(mockClient.client, target, planSnapshot, effective, {
      changeKind: 'dose',
      idempotencyKey: 'plan-change-1',
      timeZone: 'Europe/Berlin',
    })

    expect(mockClient.rpc).toHaveBeenCalledTimes(1)
    expect(mockClient.rpc).toHaveBeenCalledWith('create_plan_version', {
      p_cycle_id: 'cycle-1',
      p_effective_kind: 'instant',
      p_effective_at: '2026-09-19T10:15:00.000Z',
      p_effective_local_date: null,
      p_change_kind: 'dose',
      p_schedule: planSnapshot,
      p_idempotency_key: 'plan-change-1',
    })
    vi.useRealTimers()
  })

  it('replaces only the selected future version with a local-date boundary', async () => {
    const mockClient = planRpcClient()
    const target: PlanEditTarget = {
      cycleId: 'cycle-1',
      versionId: 'future-version-2',
      mode: 'replace_future',
    }
    const effective: PlanEffectiveDraft = { kind: 'date', localDate: '2026-10-01' }

    await savePlanChange(mockClient.client, target, planSnapshot, effective, {
      changeKind: 'schedule',
      idempotencyKey: 'plan-change-2',
      timeZone: 'Europe/Berlin',
    })

    expect(mockClient.rpc).toHaveBeenCalledTimes(1)
    expect(mockClient.rpc).toHaveBeenCalledWith('replace_future_plan_version', {
      p_version_id: 'future-version-2',
      p_effective_kind: 'local_date',
      p_effective_at: null,
      p_effective_local_date: '2026-10-01',
      p_change_kind: 'schedule',
      p_schedule: planSnapshot,
      p_timezone: 'Europe/Berlin',
      p_idempotency_key: 'plan-change-2',
    })
  })

  it('sends item, ingredients, and the initial plan to one RPC', async () => {
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, completeSetupDraft)

    expect(mockClient.rpc).toHaveBeenCalledTimes(1)
    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', {
      p_item: expect.objectContaining({
        tracking_level: 'complete',
        pk_profile_method: 'Oral',
        inventory: {
          enabled: false,
          package_quantity: null,
          package_unit: null,
          remaining_quantity: null,
          batch_number: null,
          expires_at: null,
        },
      }),
      p_ingredients: expect.any(Array),
      p_plan: expect.objectContaining({
        id: null,
        dose: 5000,
        unit: 'IU',
        method: 'Oral',
        start_date: '2026-08-17',
        intake_time: 'morgens',
        intake_time_custom: '08:30',
        reminder: 'on_time',
      }),
    })
  })

  it('schreibt mehrere Einnahmezeitpunkte kommagetrennt in eine Zeile', async () => {
    // So liest sie die Auswertung (`resolveScheduleSlots`): „morgens,abends"
    // und „08:00,20:00" in derselben Reihenfolge. Vorher konnte der Assistent
    // nur einen Zeitpunkt speichern — bei einem Antibiotikum die Regel, nicht
    // die Ausnahme.
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      plan: {
        ...completeSetupDraft.plan,
        slots: [
          { routineGroup: 'morning', time: '08:00', dose: 1000, weekdays: [] },
          { routineGroup: 'midday', time: null, dose: 1000, weekdays: [] },
          { routineGroup: 'evening', time: '20:00', dose: 500, weekdays: [] },
        ],
      },
    })

    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({
        frequency: 'Täglich',
        intake_time: 'morgens,mittags,abends',
        // Die mittlere Uhrzeit bleibt leer — dort greift die Standardzeit der
        // Tageszeit. Die Position muss trotzdem stehen, sonst verrutscht alles.
        intake_time_custom: '08:00,,20:00',
        // Dasselbe für die Mengen: „morgens 1000, mittags 1000, abends 500".
        slot_doses: '1000,1000,500',
        // `cycles.dose` bleibt EINE Zahl und trägt die führende Menge, damit
        // alles, was den Zyklus liest, weiter funktioniert.
        dose: 1000,
      }),
    }))
  })

  it('schickt bei „Bei Bedarf" keine Uhrzeit mit', async () => {
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      plan: {
        ...completeSetupDraft.plan,
        rhythm: { ...emptyRhythm(), kind: 'on_demand' },
        // Ein Zeitpunkt bleibt: er trägt die Menge je Einnahme.
        slots: [{ routineGroup: 'morning', time: '08:30', dose: 400, weekdays: [] }],
      },
    })

    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({
        frequency: 'Bei Bedarf',
        // Die Tabelle verlangt eine Tageszeit. Sie bedeutet hier nichts:
        // `cycleAppliesToDay` plant für diese Frequenz keinen Tag.
        intake_time: 'morgens',
        intake_time_custom: null,
      }),
    }))
  })

  it('schreibt den Rhythmus in seine eigenen Spalten', async () => {
    // Ein Depot alle zehn Wochen und die Pille mit drei Wochen an, einer aus —
    // beides ging nicht, solange die Frequenz einer von acht festen Texten war.
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      plan: {
        ...completeSetupDraft.plan,
        rhythm: { ...emptyRhythm(), kind: 'interval', intervalValue: 10, intervalUnit: 'week' },
      },
    })
    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({
        frequency: 'Alle X Tage',
        x_days_interval: 10,
        interval_unit: 'week',
        cycle_on_days: null,
        cycle_off_days: null,
      }),
    }))

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      plan: {
        ...completeSetupDraft.plan,
        rhythm: { ...emptyRhythm(), kind: 'cycle', onDays: 21, offDays: 7 },
      },
    })
    expect(mockClient.rpc).toHaveBeenLastCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({
        frequency: 'Im Wechsel',
        cycle_on_days: 21,
        cycle_off_days: 7,
        x_days_interval: null,
        interval_unit: null,
      }),
    }))
  })

  it('lässt slot_doses leer, wenn überall dieselbe Menge steht', async () => {
    // Sonst trüge jeder gewöhnliche Plan eine Spalte mit, die nichts sagt.
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      plan: {
        ...completeSetupDraft.plan,
        slots: [
          { routineGroup: 'morning', time: '08:00', dose: 1000, weekdays: [] },
          { routineGroup: 'evening', time: '20:00', dose: 1000, weekdays: [] },
        ],
      },
    })

    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({ slot_doses: null, dose: 1000 }),
    }))
  })

  it('schreibt die Wochentage je Einnahmezeitpunkt', async () => {
    // Montags zweimal, mittwochs einmal — so, wie die Tagesreiter es angeben:
    // jeder Zeitpunkt gehört genau einem Tag.
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      plan: {
        ...completeSetupDraft.plan,
        rhythm: { ...emptyRhythm(), kind: 'weekdays', weekdays: ['Mo', 'Mi'] },
        slots: [
          { routineGroup: 'morning', time: '08:00', dose: 1000, weekdays: ['Mo'] },
          { routineGroup: 'evening', time: '20:00', dose: 1000, weekdays: ['Mo'] },
          { routineGroup: 'morning', time: '08:00', dose: 1000, weekdays: ['Mi'] },
        ],
      },
    })

    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({
        frequency: 'Wochentage wählen',
        schedule_days: ['Mo', 'Mi'],
        intake_time: 'morgens,abends,morgens',
        intake_time_custom: '08:00,20:00,08:00',
        slot_days: 'Mo,Mo,Mi',
      }),
    }))
  })

  it('lässt slot_days leer, wenn alle Zeitpunkte an allen Tagen liegen', async () => {
    // Sonst trüge jeder gewöhnliche Plan eine Spalte mit, die nichts sagt.
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, completeSetupDraft)

    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({ slot_days: null }),
    }))
  })

  it('speichert die gewählten Erinnerungen statt stillschweigend keine', async () => {
    // Der Assistent fragte nie danach und schrieb deshalb bei jedem neuen
    // Eintrag 'none' — während die alte Zyklusmaske die Wahl hatte.
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      plan: { ...completeSetupDraft.plan, reminders: ['on_time', '2h'] },
    })

    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({ reminder: 'on_time,2h' }),
    }))
  })

  it('reicht das Enddatum einer Kur durch', async () => {
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      plan: { ...completeSetupDraft.plan, endDate: '2026-08-23' },
    })

    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item_with_plan', expect.objectContaining({
      p_plan: expect.objectContaining({ end_date: '2026-08-23' }),
    }))
  })

  it('sends null dose and unit for intake_only', async () => {
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, intakeOnlySetupDraft)

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'save_stack_item_with_plan',
      expect.objectContaining({
        p_plan: expect.objectContaining({ dose: null, unit: null }),
        p_item: expect.objectContaining({
          inventory: expect.objectContaining({ enabled: false }),
        }),
      }),
    )
  })

  it('includes enabled generic inventory only for complete tracking', async () => {
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      inventory: {
        ...completeSetupDraft.inventory,
        enabled: true,
        packageQuantity: 60,
        packageUnit: 'capsule',
        remainingQuantity: 42,
        batchNumber: ' A-42 ',
      },
    })

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'save_stack_item_with_plan',
      expect.objectContaining({
        p_item: expect.objectContaining({
          inventory: {
            enabled: true,
            package_quantity: 60,
            package_unit: 'capsule',
            remaining_quantity: 42,
            batch_number: 'A-42',
            expires_at: null,
          },
        }),
      }),
    )
  })

  it('preserves the active plan id when saving an edit', async () => {
    const mockClient = setupRpcClient()

    await saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      id: 'stack-item-1',
      plan: { ...completeSetupDraft.plan, id: 'cycle-1' },
    })

    expect(mockClient.rpc).toHaveBeenCalledWith(
      'save_stack_item_with_plan',
      expect.objectContaining({ p_plan: expect.objectContaining({ id: 'cycle-1' }) }),
    )
  })

  it.each([
    ['method', { method: ' ' }],
    ['start date', { startDate: '' }],
  ])('rejects a setup with no %s before the RPC', async (_label, changes) => {
    const mockClient = setupRpcClient()

    await expect(saveStackItemSetup(mockClient.client, {
      ...completeSetupDraft,
      plan: { ...completeSetupDraft.plan, ...changes },
    })).rejects.toThrow('Invalid stack item setup draft')
    expect(mockClient.rpc).not.toHaveBeenCalled()
  })

  it('sendet Hauptobjekt und Inhaltsstoffe in genau einem RPC-Aufruf', async () => {
    const mockClient = rpcClient()

    await saveStackItem(mockClient.client, validDraft)

    expect(mockClient.rpc).toHaveBeenCalledTimes(1)
    expect(mockClient.rpc).toHaveBeenCalledWith('save_stack_item', expect.objectContaining({
      p_item: expect.objectContaining({ display_name: 'Vitamin D3' }),
      p_ingredients: expect.any(Array),
    }))
  })

  it('behält den Draft außerhalb des Services unverändert', async () => {
    const mockClient = rpcClient()
    const before = structuredClone(validDraft)

    await saveStackItem(mockClient.client, validDraft)

    expect(validDraft).toEqual(before)
  })

  it('returns the RPC table row without invented ingredients', async () => {
    const mockClient = rpcClient()

    await expect(saveStackItem(mockClient.client, validDraft)).resolves.toEqual(savedItem)
  })

  it('validiert den Draft vor dem RPC-Aufruf', async () => {
    const mockClient = rpcClient()

    await expect(saveStackItem(mockClient.client, {
      ...validDraft,
      ingredients: [{ ...ingredient, amount_value: null }],
    })).rejects.toThrow('Invalid stack item draft')
    expect(mockClient.rpc).not.toHaveBeenCalled()
  })

  it('lädt aktive oder archivierte Einträge samt Inhaltsstoffbeziehungen', async () => {
    const calls: Array<unknown> = []
    const client: StackItemQueryClient = {
      from: table => {
        calls.push(['from', table])
        return {
          select: columns => {
            calls.push(['select', columns])
            return {
              eq: (column, value) => {
                calls.push(['eq', column, value])
                return {
                  order: async (orderColumn, options) => {
                    calls.push(['order', orderColumn, options])
                    return { data: [loadedItem], error: null }
                  },
                }
              },
            }
          },
        }
      },
    }

    const result = await loadStackItems(client, true)

    expect(result).toEqual([loadedItem])
    expect(result[0]?.ingredients[0]?.substance_catalog).toEqual(catalogEntry)
    expect(calls[0]).toEqual(['from', 'stack_items'])
    expect(calls).toContainEqual(['eq', 'archived', true])
    expect(String((calls[1] as unknown[])[1])).toContain('stack_item_ingredients')
    expect(String((calls[1] as unknown[])[1])).toContain('substance_catalog')
    expect(String((calls[1] as unknown[])[1])).toContain('inventory:stack_item_inventory')
  })

  it.each([
    ['archiveStackItem', archiveStackItem, true],
    ['restoreStackItem', restoreStackItem, false],
  ] as const)('%s aktualisiert nur stack_items', async (_name, mutate, archived) => {
    const calls: Array<unknown> = []
    const client: StackItemMutationClient = {
      from: table => {
        calls.push(['from', table])
        return {
          update: values => {
            calls.push(['update', values])
            return {
              eq: async (column, value) => {
                calls.push(['eq', column, value])
                return { error: null }
              },
            }
          },
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        }
      },
    }

    await mutate(client, 'stack-item-1')

    expect(calls).toContainEqual(['from', 'stack_items'])
    const update = calls.find(call => (call as unknown[])[0] === 'update') as [string, Record<string, unknown>]
    expect(update[1].archived).toBe(archived)
    expect(update[1].archived_at).toEqual(archived ? expect.any(String) : null)
    expect(calls).toContainEqual(['eq', 'id', 'stack-item-1'])
  })

  it('aktualisiert die Rekonstitution über den Stack-Item-Service', async () => {
    const update = vi.fn(() => ({ eq: async () => ({ error: null }) }))
    const client: StackItemMutationClient = {
      from: () => ({
        update,
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
    }

    await reconstituteStackItem(client, 'stack-item-1', '2026-07-22')

    expect(update).toHaveBeenCalledWith({
      reconstitution_date: '2026-07-22',
      vials_in_stock: 1,
      vials_initial: 1,
    })
  })

  it('begrenzt Rekonstitution auf die gewählte ID und propagiert Fehler', async () => {
    const eq = vi.fn(async () => ({ error: null }))
    const from = vi.fn(() => ({
      update: () => ({ eq }),
      delete: () => ({ eq: async () => ({ error: null }) }),
    }))
    await reconstituteStackItem({ from }, 'stack-item-1', '2026-07-22')
    expect(from).toHaveBeenCalledWith('stack_items')
    expect(eq).toHaveBeenCalledWith('id', 'stack-item-1')

    const failing: StackItemMutationClient = {
      from: () => ({
        update: () => ({ eq: async () => ({ error: { message: 'failed' } }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
    }
    await expect(reconstituteStackItem(failing, 'stack-item-1', '2026-07-22')).rejects.toThrow('failed')
  })


  it('speichert Vial-Tracking nur für das gewählte Stack-Item', async () => {
    const eq = vi.fn(async () => ({ error: null }))
    const update = vi.fn(() => ({ eq }))
    const client: StackItemMutationClient = {
      from: () => ({ update, delete: () => ({ eq: async () => ({ error: null }) }) }),
    }
    const values = {
      display_name: 'BPC-157', name: 'BPC-157', default_method: 'Subkutan',
      vial_amount_mg: 5, vial_amount_unit: 'mg', reconstitution_ml: 2,
      syringe_type: '1:100', notes: null, vials_in_stock: 1, vials_initial: 1,
      reconstitution_date: '2026-07-22', expiry_days: 28, batch_number: null,
      batch_source: null, batch_file_url: null, inventory_item_id: 'inventory-1',
      pk_profile_id: null, color_hex: '#123456',
    }

    await saveVialTracking(client, 'stack-item-1', values)
    expect(update).toHaveBeenCalledWith(values)
    expect(eq).toHaveBeenCalledWith('id', 'stack-item-1')
  })
  it('löscht ausschließlich aus stack_items', async () => {
    const calls: Array<unknown> = []
    const client: StackItemMutationClient = {
      from: table => {
        calls.push(['from', table])
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
          delete: () => ({
            eq: async (column, value) => {
              calls.push(['delete-eq', column, value])
              return { error: null }
            },
          }),
        }
      },
    }

    await deleteStackItem(client, 'stack-item-1')

    expect(calls).toEqual([
      ['from', 'stack_items'],
      ['delete-eq', 'id', 'stack-item-1'],
    ])
  })

  it('findet gleiche Form und Stärke über den Duplicate-Fingerprint', () => {
    expect(findDuplicate([loadedItem], validDraft)).toEqual(loadedItem)
    expect(findDuplicate([loadedItem], { ...validDraft, dosageForm: 'drops' })).toBeUndefined()
  })
})
