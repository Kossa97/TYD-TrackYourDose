import type { LoadedStackItem } from '../../my-stack/services/stackItems'

export interface CalculatorSource {
  id: string
  label: string
  amount: number
  unit: 'mg' | 'iu'
  diluentMl: number | null
  isReference?: true
}

type LegacyFields = {
  vial_amount_mg?: number | null
  vial_amount_unit?: string | null
  reconstitution_ml?: number | null
}

function positive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function calculatorAmount(
  value: number | null | undefined,
  unit: string | null | undefined,
): Pick<CalculatorSource, 'amount' | 'unit'> | null {
  if (!positive(value)) return null
  const normalizedUnit = unit?.trim().toLowerCase()
  if (normalizedUnit === 'iu') return { amount: value, unit: 'iu' }
  const factor = normalizedUnit === 'mg' ? 1 : normalizedUnit === 'mcg' ? 0.001 : normalizedUnit === 'g' ? 1000 : null
  if (factor === null) return null
  const mg = value * factor
  return positive(mg) ? { amount: mg, unit: 'mg' } : null
}

export function getCalculatorSources(items: LoadedStackItem[]): CalculatorSource[] {
  return items.flatMap(item => {
    if (item.archived) return []

    const legacy = item as LoadedStackItem & LegacyFields
    const legacyAmount = calculatorAmount(legacy.vial_amount_mg, legacy.vial_amount_unit ?? 'mg')
    const legacyMl = positive(legacy.reconstitution_ml) ? legacy.reconstitution_ml : null
    const inventory = item.inventory
    const mixedMl = inventory?.enabled && inventory.package_unit === 'vial' && positive(inventory.reconstitution_ml)
      ? inventory.reconstitution_ml : legacyMl
    if (item.ingredients.length === 0) {
      return item.dosage_form !== 'vial' || legacyAmount === null ? [] : [{
        id: item.id, label: item.display_name, ...legacyAmount, diluentMl: mixedMl,
      }]
    }

    const isBlend = item.ingredients.length > 1
    return item.ingredients.flatMap((ingredient, index) => {
      const activeAmount = calculatorAmount(ingredient.amount_value, ingredient.amount_unit)
      if (activeAmount === null) return []
      const basisUnit = ingredient.basis_unit?.trim().toLowerCase()
      const basis = ingredient.basis_value
      const unsetPowderVolume = item.dosage_form === 'vial' && basisUnit === 'ml' && basis == null
        && (item.category === 'peptide' || item.category === 'other')
      if (!unsetPowderVolume && !positive(basis)) return []
      if (basisUnit !== 'ml' && !(item.dosage_form === 'vial' && basisUnit === 'vial')) return []

      const amount = basisUnit === 'vial' ? activeAmount.amount / basis! : activeAmount.amount
      const diluentMl = basisUnit === 'ml' && !unsetPowderVolume ? basis! : mixedMl
      if (!positive(amount)) return []

      const ingredientName = ingredient.custom_name?.trim()
        || ingredient.substance_catalog?.canonical_name || String(index + 1)
      return [{
        id: isBlend ? `${item.id}:${ingredient.id ?? index}` : item.id,
        label: isBlend ? `${item.display_name} · ${ingredientName}` : item.display_name,
        amount,
        unit: activeAmount.unit,
        diluentMl,
        ...(basisUnit === 'ml' && !unsetPowderVolume ? { isReference: true as const } : {}),
      }]
    })
  })
}
