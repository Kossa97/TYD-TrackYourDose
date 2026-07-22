import { describe, expect, it, vi } from 'vitest'
import type {
  StackItemDraft,
  StackItemIngredient,
  SubstanceCatalogEntry,
} from '../types'
import {
  archiveStackItem,
  deleteStackItem,
  findDuplicate,
  loadStackItems,
  restoreStackItem,
  reconstituteStackItem,
  saveStackItem,
  saveVialTracking,
  type LoadedStackItem,
  type SaveStackItemRpcParams,
  type SavedStackItemRow,
  type StackItemMutationClient,
  type StackItemQueryClient,
  type StackItemRpcClient,
} from './stackItems'

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
  dosageForm: 'capsule',
  brand: '',
  colorHex: '#abcdef',
  notes: '',
  ingredients: [ingredient],
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

describe('stack item service', () => {
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
