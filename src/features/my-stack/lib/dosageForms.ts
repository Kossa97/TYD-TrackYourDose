import type { DosageFormCapability, DosageFormKey } from '../types'

export interface DosageFormDefinition {
  readonly key: DosageFormKey
  readonly labelKey: string
  readonly suggestedUnits: readonly string[]
  readonly basisUnits: readonly string[]
  readonly capabilities: readonly DosageFormCapability[]
  readonly stageRenderer?: 'vial'
}

export const DOSAGE_FORMS: readonly DosageFormDefinition[] = [
  { key: 'vial', labelKey: 'dosage_form_vial', suggestedUnits: ['mcg', 'mg', 'IU'], basisUnits: ['vial', 'ml'], capabilities: ['injectable', 'reconstitutable', 'concentration_based', 'inventory_capable'], stageRenderer: 'vial' },
  { key: 'ampoule', labelKey: 'dosage_form_ampoule', suggestedUnits: ['mg', 'ml', 'IU'], basisUnits: ['ampoule', 'ml'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'] },
  { key: 'pen', labelKey: 'dosage_form_pen', suggestedUnits: ['mg', 'mcg', 'IU'], basisUnits: ['dose', 'ml'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'] },
  { key: 'tablet', labelKey: 'dosage_form_tablet', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['tablet'], capabilities: ['countable', 'divisible', 'inventory_capable'] },
  { key: 'capsule', labelKey: 'dosage_form_capsule', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['capsule'], capabilities: ['countable', 'inventory_capable'] },
  { key: 'drops', labelKey: 'dosage_form_drops', suggestedUnits: ['mcg', 'mg', 'IU', 'ml'], basisUnits: ['drop', 'ml'], capabilities: ['liquid', 'concentration_based', 'inventory_capable'] },
  { key: 'liquid', labelKey: 'dosage_form_liquid', suggestedUnits: ['mcg', 'mg', 'g', 'IU', 'ml'], basisUnits: ['ml', 'portion'], capabilities: ['liquid', 'concentration_based', 'inventory_capable'] },
  { key: 'powder', labelKey: 'dosage_form_powder', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'portion'], capabilities: ['inventory_capable'] },
  { key: 'nasal_spray', labelKey: 'dosage_form_nasal_spray', suggestedUnits: ['mcg', 'mg'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'] },
  { key: 'spray', labelKey: 'dosage_form_spray', suggestedUnits: ['mcg', 'mg', 'ml'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'] },
  { key: 'gel', labelKey: 'dosage_form_gel', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'application'], capabilities: ['inventory_capable'] },
  { key: 'patch', labelKey: 'dosage_form_patch', suggestedUnits: ['mcg', 'mg'], basisUnits: ['patch', 'hour'], capabilities: ['countable', 'inventory_capable'] },
  { key: 'tube', labelKey: 'dosage_form_tube', suggestedUnits: ['mg', 'g', 'ml'], basisUnits: ['g', 'ml', 'application'], capabilities: ['inventory_capable'] },
  { key: 'other', labelKey: 'dosage_form_other', suggestedUnits: ['mcg', 'mg', 'g', 'IU', 'ml'], basisUnits: ['unit', 'portion'], capabilities: [] },
] as const

export function getDosageForm(key: DosageFormKey): DosageFormDefinition {
  return DOSAGE_FORMS.find(form => form.key === key)!
}

export function isStageRenderable(key: DosageFormKey): boolean {
  return getDosageForm(key).stageRenderer !== undefined
}
