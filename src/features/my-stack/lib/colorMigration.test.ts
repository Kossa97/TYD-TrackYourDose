import { describe, expect, it } from 'vitest'
import { getStableStackItemColor } from './colors'
import { isLocalColorMigrationComplete, migrateLocalColors } from './colorMigration'

const LEGACY_KEY = 'tyd_peptide_colors'
const MARKER_KEY = 'tyd_stack_colors_migrated_v1'

function storageWith(values: Record<string, string>) {
  const entries = new Map(Object.entries(values))
  return {
    getItem(key: string) {
      return entries.get(key) ?? null
    },
    setItem(key: string, value: string) {
      entries.set(key, value)
    },
  }
}

function migrationClient(failingId?: string) {
  const updates: Array<{ id: string; color_hex: string }> = []
  const nullGuards: string[] = []
  return {
    updates,
    nullGuards,
    client: {
      from(table: 'stack_items') {
        expect(table).toBe('stack_items')
        return {
          update(values: { color_hex: string }) {
            return {
              eq(column: 'id', id: string) {
                expect(column).toBe('id')
                return {
                  async is(nullColumn: 'color_hex', value: null) {
                    expect(nullColumn).toBe('color_hex')
                    expect(value).toBeNull()
                    nullGuards.push(id)
                    if (id === failingId) return { error: { message: 'failed' } }
                    updates.push({ id, color_hex: values.color_hex })
                    return { error: null }
                  },
                }
              },
            }
          },
        }
      },
    },
  }
}

describe('migrateLocalColors', () => {
  it('migrates a local color only when the database color is missing', async () => {
    const item = { id: 'stack-item-1', color_hex: null }
    const { client, updates, nullGuards } = migrationClient()
    const storage = storageWith({ [LEGACY_KEY]: JSON.stringify({ [item.id]: '#06b6d4' }) })

    await migrateLocalColors(client, [item], storage)

    expect(updates).toEqual([{ id: item.id, color_hex: '#06b6d4' }])
    expect(nullGuards).toEqual([item.id])
  })

  it('migrates active and archived rows before completing the global marker', async () => {
    const items = [
      { id: 'active-item', color_hex: null, archived: false },
      { id: 'archived-item', color_hex: null, archived: true },
    ]
    const storage = storageWith({
      [LEGACY_KEY]: JSON.stringify({
        'active-item': '#06b6d4',
        'archived-item': '#a855f7',
      }),
    })
    const { client, updates } = migrationClient()

    await migrateLocalColors(client, items, storage)

    expect(updates).toEqual([
      { id: 'active-item', color_hex: '#06b6d4' },
      { id: 'archived-item', color_hex: '#a855f7' },
    ])
    expect(isLocalColorMigrationComplete(storage)).toBe(true)
  })

  it('does not overwrite an already persisted color', async () => {
    const item = { id: 'stack-item-1', color_hex: '#ffffff' }
    const { client, updates } = migrationClient()
    const storage = storageWith({ [LEGACY_KEY]: JSON.stringify({ [item.id]: '#06b6d4' }) })

    await migrateLocalColors(client, [item], storage)

    expect(updates).toEqual([])
  })

  it('persists the stable ID fallback when local storage is missing or invalid', async () => {
    const item = { id: 'stack-item-1', color_hex: null }
    const { client, updates } = migrationClient()
    const storage = storageWith({ [LEGACY_KEY]: '{invalid-json' })

    await migrateLocalColors(client, [item], storage)

    expect(updates).toEqual([{ id: item.id, color_hex: getStableStackItemColor(item.id) }])
    expect(updates[0].color_hex).toMatch(/^#[0-9a-f]{6}$/i)
    expect(getStableStackItemColor(item.id)).toBe(getStableStackItemColor(item.id))
  })

  it('marks migration only after every update succeeds and keeps the legacy value', async () => {
    const items = [
      { id: 'stack-item-1', color_hex: null },
      { id: 'stack-item-2', color_hex: null },
    ]
    const legacyValue = JSON.stringify({ 'stack-item-1': '#06b6d4', 'stack-item-2': '#a855f7' })
    const storage = storageWith({ [LEGACY_KEY]: legacyValue })
    const { client } = migrationClient('stack-item-2')

    await expect(migrateLocalColors(client, items, storage)).rejects.toThrow('failed')

    expect(storage.getItem(MARKER_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_KEY)).toBe(legacyValue)
  })

  it('marks a successful migration and does not run it again', async () => {
    const item = { id: 'stack-item-1', color_hex: null }
    const legacyValue = JSON.stringify({ [item.id]: '#06b6d4' })
    const storage = storageWith({ [LEGACY_KEY]: legacyValue })
    const { client, updates } = migrationClient()

    await expect(migrateLocalColors(client, [item], storage)).resolves.toBe(true)
    await expect(migrateLocalColors(client, [item], storage)).resolves.toBe(false)

    expect(updates).toEqual([{ id: item.id, color_hex: '#06b6d4' }])
    expect(storage.getItem(MARKER_KEY)).toBe('1')
    expect(storage.getItem(LEGACY_KEY)).toBe(legacyValue)
  })
})
