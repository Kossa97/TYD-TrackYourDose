export type StackCategory = 'peptide' | 'medication' | 'hormone' | 'supplement' | 'vitamin'
export type ConfigurationStatus = 'complete' | 'needs_review'
export type DosageFormKey =
  | 'vial' | 'ampoule' | 'pen' | 'tablet' | 'capsule' | 'drops' | 'liquid'
  | 'powder' | 'nasal_spray' | 'spray' | 'gel' | 'patch' | 'tube' | 'other'
export type DosageFormCapability =
  | 'countable' | 'divisible' | 'liquid' | 'injectable' | 'reconstitutable'
  | 'concentration_based' | 'inventory_capable'

export interface SubstanceCatalogEntry {
  id: string
  canonical_name: string
  aliases: string[]
  default_category: StackCategory
  suggested_units: string[]
  suggested_dosage_forms: DosageFormKey[]
  pk_profile_id: string | null
  active: boolean
}

export interface StackItemIngredient {
  id?: string
  stack_item_id?: string
  catalog_substance_id: string | null
  custom_name: string
  amount_value: number | null
  amount_unit: string | null
  basis_value: number | null
  basis_unit: string | null
  position: number
}

export interface StackItem {
  id: string
  user_id: string
  display_name: string
  category: StackCategory
  dosage_form: DosageFormKey
  brand: string | null
  color_hex: string | null
  notes: string | null
  configuration_status: ConfigurationStatus
  archived: boolean
  archived_at: string | null
  created_at: string
  updated_at: string
  ingredients: StackItemIngredient[]
}

export interface StackItemDraft {
  id?: string
  displayName: string
  category: StackCategory | null
  dosageForm: DosageFormKey | null
  brand: string
  colorHex: string
  notes: string
  ingredients: StackItemIngredient[]
}
