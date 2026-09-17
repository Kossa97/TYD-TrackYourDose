import type { StackItemLike } from './stackSortTypes'

/**
 * Welche Sortierungen ein Reiter beantworten kann.
 *
 * Fuellstand, Rekonstitution und Bestand lesen VIAL-Felder. In einem Reiter
 * aus lauter Kapseln sind sie ueberall leer — sortiert man danach, aendert
 * sich nichts, und die App wirkt kaputt. Angeboten wird eine Sortierung
 * deshalb nur, wenn mindestens ein Eintrag im Reiter sie beantworten kann.
 *
 * Name, Ablauf, Hinzugefuegt und „Aktive zuerst" gehen immer.
 */
export type SortAbility = 'fill' | 'recon' | 'stock' | 'expiry'

export function sortAbilities(items: readonly StackItemLike[]): Set<SortAbility> {
  const koennen = new Set<SortAbility>()
  for (const item of items) {
    if (item.vials_in_stock != null && item.vials_in_stock > 0) koennen.add('stock')
    if (item.reconstitution_date != null) koennen.add('recon')
    if (item.vial_amount_mg != null || item.reconstitution_ml != null) koennen.add('fill')
    if (item.reconstitution_date != null || item.expiry_days != null) koennen.add('expiry')
  }
  return koennen
}
