export type StackCategory = 'peptide' | 'medication' | 'hormone' | 'supplement' | 'vitamin'
export type ConfigurationStatus = 'complete' | 'needs_review'
export type TrackingLevel = 'intake_only' | 'with_amount' | 'complete'
export type RoutineGroup = 'morning' | 'midday' | 'evening'

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
  tracking_level: TrackingLevel
  pk_profile_method: string | null
  archived_at: string | null
  created_at: string
  updated_at: string
  ingredients: StackItemIngredient[]
}

export interface StackItemDraft {
  id?: string
  displayName: string
  category: StackCategory | null
  trackingLevel: TrackingLevel
  dosageForm: DosageFormKey | null
  brand: string
  colorHex: string
  notes: string
  ingredients: StackItemIngredient[]
}

export interface IntakePlanDraft {
  id?: string
  name: string
  dose: number | null
  unit: string | null
  method: string
  frequency: string
  xDaysInterval: number | null
  scheduleDays: string[]
  startDate: string
  endDate: string | null
  routineGroup: RoutineGroup
  time: string | null
  reminders: string[]
}

export interface InventoryDraft {
  enabled: boolean
  packageQuantity: number | null
  packageUnit: string | null
  remainingQuantity: number | null
  brand: string
  batchNumber: string
  expiresAt: string | null
}

export interface StackItemSetupDraft extends StackItemDraft {
  plan: IntakePlanDraft
  inventory: InventoryDraft
  pkProfileMethod: string | null
}
