import type { InventoryDraft, StackItem, StackItemDraft } from '../types'

/** The powder-vial form asks for the whole vial's strength and added ml.
 * Storage keeps those separate: strength per vial, solvent on the inventory.
 * Solutions and combinations retain their existing concentration contract.
 */
export function powderVialForSave<T extends StackItemDraft>(draft: T): T {
  const [ingredient] = draft.ingredients
  // Bare item callers cannot persist solvent separately; retain their contract.
  const inventory = 'inventory' in draft ? draft.inventory as InventoryDraft : undefined
  if (!inventory || draft.category !== 'peptide' || draft.dosageForm !== 'vial' || draft.ingredients.length !== 1
    || ingredient.basis_unit !== 'ml' || !Number.isFinite(ingredient.basis_value)
    || !(Number(ingredient.basis_value) > 0 && Number(ingredient.basis_value) <= 1000)) return draft
  return {
    ...draft,
    ingredients: [{ ...ingredient, basis_value: 1, basis_unit: 'vial' }],
    inventory: { ...inventory, reconstitutionMl: ingredient.basis_value },
  }
}

export function powderVialIngredientsForEdit(item: StackItem): StackItem['ingredients'] {
  const [ingredient] = item.ingredients
  const solvent = item.inventory?.reconstitution_ml ?? (item as StackItem & { reconstitution_ml?: number }).reconstitution_ml
  const powder = item.category === 'peptide' && item.dosage_form === 'vial' && item.ingredients.length === 1
    && ingredient.basis_unit === 'vial' && Number(ingredient.basis_value) > 0
    && solvent != null && Number.isFinite(solvent) && solvent > 0 && solvent <= 1000
  return item.ingredients.map(value => powder ? {
    ...value,
    amount_value: value.amount_value == null ? null : value.amount_value / Number(value.basis_value),
    basis_value: solvent!,
    basis_unit: 'ml',
  } : { ...value })
}
