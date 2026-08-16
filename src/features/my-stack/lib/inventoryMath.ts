export interface InventoryIngredientBasis {
  amountValue: number | null
  amountUnit: string | null
  basisValue: number | null
  basisUnit: string | null
}

export interface InventoryDoseInput extends Partial<InventoryIngredientBasis> {
  dose: number
  doseUnit: string
  ingredients?: readonly InventoryIngredientBasis[]
}

function positive(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0
}

function doseInAmountUnit(dose: number, doseUnit: string, amountUnit: string): number | null {
  if (doseUnit === amountUnit) return dose
  if (doseUnit === 'mg' && amountUnit === 'mcg') return dose * 1000
  if (doseUnit === 'mcg' && amountUnit === 'mg') return dose / 1000
  return null
}

function deltaForIngredient(
  dose: number,
  doseUnit: string,
  ingredient: InventoryIngredientBasis,
): number | null {
  if (!positive(ingredient.basisValue) || !ingredient.basisUnit) return null
  if (doseUnit === ingredient.basisUnit) return dose
  if (!positive(ingredient.amountValue) || !ingredient.amountUnit) return null

  const convertedDose = doseInAmountUnit(dose, doseUnit, ingredient.amountUnit)
  if (convertedDose == null) return null
  return convertedDose / ingredient.amountValue * ingredient.basisValue
}

export function inventoryDeltaForDose(input: InventoryDoseInput): number | null {
  if (!positive(input.dose) || !input.doseUnit) return null
  const ingredients = input.ingredients ?? [{
    amountValue: input.amountValue ?? null,
    amountUnit: input.amountUnit ?? null,
    basisValue: input.basisValue ?? null,
    basisUnit: input.basisUnit ?? null,
  }]
  if (ingredients.length === 0) return null

  const deltas = ingredients.map(ingredient => (
    deltaForIngredient(input.dose, input.doseUnit, ingredient)
  ))
  if (deltas.some(delta => delta == null || !Number.isFinite(delta) || delta <= 0)) return null

  const first = deltas[0] as number
  return deltas.every(delta => Math.abs((delta as number) - first) <= Number.EPSILON * Math.max(1, first))
    ? first
    : null
}
