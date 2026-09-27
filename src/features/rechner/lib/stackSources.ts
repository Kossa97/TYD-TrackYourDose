import type { LoadedStackItem } from '../../my-stack/services/stackItems'

export interface CalculatorSource {
  id: string
  label: string
  vialAmountMg: number
  diluentMl: number | null
}

type LegacyFields = {
  vial_amount_mg?: number | null
  vial_amount_unit?: string | null
  reconstitution_ml?: number | null
}

function positive(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function massInMg(value: number | null | undefined, unit: string | null | undefined): number | null {
  if (!positive(value)) return null
  const normalizedUnit = unit?.trim().toLowerCase()
  const factor = normalizedUnit === 'mg' ? 1 : normalizedUnit === 'mcg' ? 0.001 : normalizedUnit === 'g' ? 1000 : null
  if (factor === null) return null
  const mg = value * factor
  return positive(mg) ? mg : null
}

export function getCalculatorSources(items: LoadedStackItem[]): CalculatorSource[] {
  return items.flatMap(item => {
    if (item.archived || item.configuration_status !== 'complete'
      || item.tracking_level !== 'complete' || item.dosage_form !== 'vial') return []

    const legacy = item as LoadedStackItem & LegacyFields
    const legacyMg = massInMg(legacy.vial_amount_mg, legacy.vial_amount_unit ?? 'mg')
    const legacyMl = positive(legacy.reconstitution_ml) ? legacy.reconstitution_ml : null
    const inventory = item.inventory
    const mixedMl = inventory?.enabled && inventory.package_unit === 'vial' && positive(inventory.reconstitution_ml)
      ? inventory.reconstitution_ml : legacyMl
    if (item.ingredients.length === 0) {
      return legacyMg === null ? [] : [{
        id: item.id, label: item.display_name, vialAmountMg: legacyMg, diluentMl: mixedMl,
      }]
    }

    const isBlend = item.ingredients.length > 1
    return item.ingredients.flatMap((ingredient, index) => {
      const mg = massInMg(ingredient.amount_value, ingredient.amount_unit)
      if (mg === null) return []
      const basisUnit = ingredient.basis_unit?.trim().toLowerCase()
      const basis = ingredient.basis_value
      const unsetPowderVolume = basisUnit === 'ml' && basis == null
        && (item.category === 'peptide' || item.category === 'other')
      if (!unsetPowderVolume && !positive(basis)) return []
      if (basisUnit !== 'vial' && basisUnit !== 'ml') return []

      const vialAmountMg = basisUnit === 'vial' ? mg / basis! : mg
      const diluentMl = basisUnit === 'ml' && !unsetPowderVolume ? basis! : mixedMl
      if (!positive(vialAmountMg)) return []

      const ingredientName = ingredient.custom_name.trim()
        || ingredient.substance_catalog?.canonical_name || String(index + 1)
      return [{
        id: isBlend ? `${item.id}:${ingredient.id ?? index}` : item.id,
        label: isBlend ? `${item.display_name} · ${ingredientName}` : item.display_name,
        vialAmountMg,
        diluentMl,
      }]
    })
  })
}
