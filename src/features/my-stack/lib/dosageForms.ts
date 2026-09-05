import { AMPOULE_SPEC } from '../extensions/ampoule/ampouleShape'
import { CAPSULE_SPEC } from '../extensions/capsule/capsuleShape'
import { NASAL_SPRAY_SPEC } from '../extensions/nasal-spray/nasalSprayShape'
import { PEN_SPEC } from '../extensions/pen/penShape'
import { TABLET_SPEC } from '../extensions/tablet/tabletShape'
import { DROPS_SPEC } from '../extensions/drops/dropsShape'
import { PATCH_SPEC } from '../extensions/patch/patchShape'
import { TUBE_SPEC } from '../extensions/tube/tubeShape'
import { VIAL_SPEC } from '../extensions/peptide/vialShape'
import type { StageFormSpec } from '../stage/types'
import type { DosageFormCapability, DosageFormKey } from '../types'

export interface DosageFormDefinition {
  readonly key: DosageFormKey
  readonly labelKey: string
  readonly suggestedUnits: readonly string[]
  readonly basisUnits: readonly string[]
  readonly capabilities: readonly DosageFormCapability[]
  readonly stageRenderer?: 'vial' | 'ampoule' | 'capsule' | 'tablet' | 'nasal_spray' | 'tube' | 'pen' | 'patch' | 'drops'
  // What the stage needs to know: where the liquid sits, whether the fill level
  // says anything, and — derived from the chamber — whether it wears our label.
  readonly stageForm?: StageFormSpec
}

export const DOSAGE_FORMS: readonly DosageFormDefinition[] = [
  { key: 'vial', labelKey: 'dosage_form_vial', suggestedUnits: ['mcg', 'mg', 'IU'], basisUnits: ['vial', 'ml'], capabilities: ['injectable', 'reconstitutable', 'concentration_based', 'inventory_capable'], stageRenderer: 'vial', stageForm: VIAL_SPEC },
  { key: 'ampoule', labelKey: 'dosage_form_ampoule', suggestedUnits: ['mg', 'ml', 'IU'], basisUnits: ['ml', 'ampoule'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'], stageRenderer: 'ampoule', stageForm: AMPOULE_SPEC },
  { key: 'pen', labelKey: 'dosage_form_pen', suggestedUnits: ['mg', 'mcg', 'IU'], basisUnits: ['dose', 'ml'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'], stageRenderer: 'pen', stageForm: PEN_SPEC },
  { key: 'tablet', labelKey: 'dosage_form_tablet', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['tablet'], capabilities: ['countable', 'divisible', 'inventory_capable'], stageRenderer: 'tablet', stageForm: TABLET_SPEC },
  { key: 'capsule', labelKey: 'dosage_form_capsule', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['capsule'], capabilities: ['countable', 'inventory_capable'], stageRenderer: 'capsule', stageForm: CAPSULE_SPEC },
  { key: 'drops', labelKey: 'dosage_form_drops', suggestedUnits: ['mcg', 'mg', 'IU', 'ml'], basisUnits: ['drop', 'ml'], capabilities: ['liquid', 'concentration_based', 'inventory_capable'], stageRenderer: 'drops', stageForm: DROPS_SPEC },
  { key: 'liquid', labelKey: 'dosage_form_liquid', suggestedUnits: ['mcg', 'mg', 'g', 'IU', 'ml'], basisUnits: ['ml', 'portion'], capabilities: ['liquid', 'concentration_based', 'inventory_capable'] },
  { key: 'powder', labelKey: 'dosage_form_powder', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'portion'], capabilities: ['inventory_capable'] },
  { key: 'nasal_spray', labelKey: 'dosage_form_nasal_spray', suggestedUnits: ['mcg', 'mg'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'], stageRenderer: 'nasal_spray', stageForm: NASAL_SPRAY_SPEC },
  { key: 'spray', labelKey: 'dosage_form_spray', suggestedUnits: ['mcg', 'mg', 'ml'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'] },
  { key: 'gel', labelKey: 'dosage_form_gel', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'application'], capabilities: ['inventory_capable'] },
  { key: 'patch', labelKey: 'dosage_form_patch', suggestedUnits: ['mcg', 'mg'], basisUnits: ['patch', 'hour'], capabilities: ['countable', 'inventory_capable'], stageRenderer: 'patch', stageForm: PATCH_SPEC },
  { key: 'tube', labelKey: 'dosage_form_tube', suggestedUnits: ['mg', 'g', 'ml'], basisUnits: ['g', 'ml', 'application'], capabilities: ['inventory_capable'], stageRenderer: 'tube', stageForm: TUBE_SPEC },
  { key: 'other', labelKey: 'dosage_form_other', suggestedUnits: ['mcg', 'mg', 'g', 'IU', 'ml'], basisUnits: ['unit', 'portion'], capabilities: [] },
] as const

export function getDosageForm(key: DosageFormKey): DosageFormDefinition {
  return DOSAGE_FORMS.find(form => form.key === key)!
}

export function getIntakePlanUnitSuggestions(
  key: DosageFormKey,
  catalogSuggestedUnits: readonly string[] = [],
): string[] {
  const form = getDosageForm(key)
  const catalogUnits = catalogSuggestedUnits
    .filter(unit => form.suggestedUnits.includes(unit))

  return Array.from(new Set([
    ...catalogUnits,
    ...form.suggestedUnits,
    ...form.basisUnits,
  ]))
}

export function isStageRenderable(key: DosageFormKey): boolean {
  return getDosageForm(key).stageRenderer !== undefined
}
