import { getStableStackItemColor } from './colors'

const LEGACY_COLOR_KEY = 'tyd_peptide_colors'
const MIGRATION_MARKER_KEY = 'tyd_stack_colors_migrated_v1'
const HEX_COLOR = /^#[0-9a-f]{6}$/i

interface ColorMigrationItem {
  id: string
  color_hex: string | null
}

interface ColorMigrationStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface ColorMigrationClient {
  from(table: 'stack_items'): {
    update(values: { color_hex: string }): {
      eq(column: 'id', id: string): {
        is(column: 'color_hex', value: null): PromiseLike<{
          error: { message: string } | null
        }>
      }
    }
  }
}

function readLegacyColors(storage: ColorMigrationStorage): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(LEGACY_COLOR_KEY) ?? '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string' && HEX_COLOR.test(entry[1]),
      ),
    )
  } catch {
    return {}
  }
}

export function isLocalColorMigrationComplete(storage: ColorMigrationStorage): boolean {
  return storage.getItem(MIGRATION_MARKER_KEY) !== null
}

export async function migrateLocalColors(
  client: ColorMigrationClient,
  items: ColorMigrationItem[],
  storage: ColorMigrationStorage,
): Promise<boolean> {
  if (isLocalColorMigrationComplete(storage)) return false

  const localColors = readLegacyColors(storage)
  for (const item of items) {
    if (item.color_hex !== null) continue

    const color_hex = localColors[item.id] ?? getStableStackItemColor(item.id)
    const { error } = await client
      .from('stack_items')
      .update({ color_hex })
      .eq('id', item.id)
      .is('color_hex', null)
    if (error) throw new Error(error.message)
  }

  storage.setItem(MIGRATION_MARKER_KEY, '1')
  return true
}
