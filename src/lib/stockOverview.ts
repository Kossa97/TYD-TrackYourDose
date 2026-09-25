import type { PeptideExpirySource } from './peptideExpiry'

/**
 * Vorrat und Haltbarkeit fuer die Startseite.
 *
 * Ein Vial fuehrt seinen Bestand entweder im neuen Modell
 * (`stack_item_inventory` in der Einheit 'vial') oder noch in den Altspalten
 * (`stack_items.vials_in_stock`, `inventory_items.vials_count`). Das neue
 * Modell gewinnt: dort bucht die Datenbank ab, die Altspalten stehen still.
 */

interface NewInventory {
  enabled?: boolean | null
  package_unit?: string | null
  remaining_quantity?: number | null
  opened_at?: string | null
  use_within_days?: number | null
}

export interface StockOverviewItem {
  id: string
  display_name: string
  vials_in_stock?: number | null
  reconstitution_date?: string | null
  expiry_days?: number | null
  inventory_item_id?: string | null
  /** PostgREST liefert die 1:1-Zeile als Objekt; aeltere Abfragen als Liste. */
  inventory?: NewInventory | NewInventory[] | null
}

export interface LegacyInventoryItem {
  id: string
  vials_count?: number | null
}

function inventoryRow(item: StockOverviewItem): NewInventory | null {
  return Array.isArray(item.inventory) ? item.inventory[0] ?? null : item.inventory ?? null
}

/**
 * Hat das Vial einen Bestand in Vials, gilt nur noch der — auch wenn er
 * ausgeschaltet ist: dann wird eben nichts mehr gezaehlt. Die Altspalten
 * stehen seit der Umstellung still und wuerden sonst ewig dasselbe melden.
 */
function vialInventory(item: StockOverviewItem): NewInventory | null {
  const inventory = inventoryRow(item)
  return inventory?.package_unit === 'vial' ? inventory : null
}

/**
 * Wann angebrochen und wie lange haltbar: aus dem Bestand, sobald dort ein
 * Anbruch steht (Vial, Pen, Flasche) oder das Vial dort gefuehrt wird, sonst
 * aus den Altspalten.
 */
export function expirySources(items: readonly StockOverviewItem[]): PeptideExpirySource[] {
  return items.map(item => {
    const inventory = inventoryRow(item)
    // Ein Vial mit Bestand in Vials: nur noch der zaehlt, ausgeschaltet
    // heisst keine Warnung. Sonst der Bestand, wenn dort ein Anbruch steht.
    const ausBestand = vialInventory(item) != null || Boolean(inventory?.enabled && inventory.opened_at)
    const aktiv = ausBestand && inventory?.enabled
    return {
      id: item.id,
      name: item.display_name,
      reconstitution_date: ausBestand ? (aktiv ? inventory?.opened_at ?? null : null) : item.reconstitution_date ?? null,
      expiry_days: ausBestand ? (aktiv ? inventory?.use_within_days ?? null : null) : item.expiry_days ?? null,
    }
  })
}

/**
 * Volle Vials im Vorrat und wie viele Eintraege nur noch hoechstens eines
 * haben. Ein angemischtes Vial zaehlt nicht als volles.
 */
export function vialStockOverview(
  items: readonly StockOverviewItem[],
  legacyInventory: readonly LegacyInventoryItem[],
): { inventoryVials: number; lowStock: number } {
  const migratedLegacyIds = new Set<string>()
  let inventoryVials = 0
  let lowStock = 0
  for (const item of items) {
    const inventory = vialInventory(item)
    if (inventory) {
      if (item.inventory_item_id) migratedLegacyIds.add(item.inventory_item_id)
      if (!inventory.enabled) continue
      const remaining = Math.max(0, Number(inventory.remaining_quantity ?? 0))
      inventoryVials += Math.floor(remaining + 1e-9)
      if (remaining <= 1) lowStock += 1
    } else if (item.vials_in_stock != null && Number(item.vials_in_stock) <= 1) {
      lowStock += 1
    }
  }
  for (const row of legacyInventory) {
    if (!migratedLegacyIds.has(row.id)) inventoryVials += Number(row.vials_count ?? 0)
  }
  return { inventoryVials, lowStock }
}
