import { AMPOULE_SPEC } from '../extensions/ampoule/ampouleShape'
import { CAPSULE_SPEC } from '../extensions/capsule/capsuleShape'
import { NASAL_SPRAY_SPEC } from '../extensions/nasal-spray/nasalSprayShape'
import { GEL_SPEC } from '../extensions/gel/gelShape'
import { PEN_SPEC } from '../extensions/pen/penShape'
import { POWDER_SPEC } from '../extensions/powder/powderShape'
import { SPRAY_SPEC } from '../extensions/spray/sprayShape'
import { TABLET_SPEC } from '../extensions/tablet/tabletShape'
import { DROPS_SPEC } from '../extensions/drops/dropsShape'
import { PATCH_SPEC } from '../extensions/patch/patchShape'
import { TUBE_SPEC } from '../extensions/tube/tubeShape'
import { VIAL_SPEC } from '../extensions/peptide/vialShape'
import type { StageFormSpec } from '../stage/types'
import type { DosageFormCapability, DosageFormKey, IntakeUnitKey } from '../types'

export interface DosageFormDefinition {
  readonly key: DosageFormKey
  readonly labelKey: string
  readonly suggestedUnits: readonly string[]
  readonly basisUnits: readonly string[]
  readonly capabilities: readonly DosageFormCapability[]
  // Womit eine einzelne Einnahme gezaehlt wird. Getrennt von `basisUnits`:
  // die sagen, worin das PRODUKT gemessen wird (eine Ampulle, ein ml), diese
  // sagt, was man TUT — aus der Ampulle wird eine Spritze aufgezogen.
  readonly intakeUnit: IntakeUnitKey
  readonly stageRenderer?: 'vial' | 'ampoule' | 'capsule' | 'tablet' | 'nasal_spray' | 'tube' | 'pen' | 'patch' | 'drops' | 'powder' | 'gel' | 'spray'
  // What the stage needs to know: where the liquid sits, whether the fill level
  // says anything, and — derived from the chamber — whether it wears our label.
  readonly stageForm?: StageFormSpec
}

export const DOSAGE_FORMS: readonly DosageFormDefinition[] = [
  { key: 'vial', labelKey: 'dosage_form_vial', suggestedUnits: ['mcg', 'mg', 'IU'], basisUnits: ['vial', 'ml'], capabilities: ['injectable', 'reconstitutable', 'concentration_based', 'inventory_capable'], intakeUnit: 'syringe', stageRenderer: 'vial', stageForm: VIAL_SPEC },
  { key: 'ampoule', labelKey: 'dosage_form_ampoule', suggestedUnits: ['mg', 'ml', 'IU'], basisUnits: ['ml', 'ampoule'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'], intakeUnit: 'syringe', stageRenderer: 'ampoule', stageForm: AMPOULE_SPEC },
  { key: 'pen', labelKey: 'dosage_form_pen', suggestedUnits: ['mg', 'mcg', 'IU'], basisUnits: ['dose', 'ml'], capabilities: ['injectable', 'liquid', 'concentration_based', 'inventory_capable'], intakeUnit: 'dose', stageRenderer: 'pen', stageForm: PEN_SPEC },
  { key: 'tablet', labelKey: 'dosage_form_tablet', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['tablet'], capabilities: ['countable', 'divisible', 'inventory_capable'], intakeUnit: 'tablet', stageRenderer: 'tablet', stageForm: TABLET_SPEC },
  { key: 'capsule', labelKey: 'dosage_form_capsule', suggestedUnits: ['mcg', 'mg', 'g', 'IU'], basisUnits: ['capsule'], capabilities: ['countable', 'inventory_capable'], intakeUnit: 'capsule', stageRenderer: 'capsule', stageForm: CAPSULE_SPEC },
  { key: 'drops', labelKey: 'dosage_form_drops', suggestedUnits: ['mcg', 'mg', 'IU', 'ml'], basisUnits: ['drop', 'ml'], capabilities: ['liquid', 'concentration_based', 'inventory_capable'], intakeUnit: 'drop', stageRenderer: 'drops', stageForm: DROPS_SPEC },
  { key: 'powder', labelKey: 'dosage_form_powder', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'portion'], capabilities: ['inventory_capable'], intakeUnit: 'portion', stageRenderer: 'powder', stageForm: POWDER_SPEC },
  { key: 'nasal_spray', labelKey: 'dosage_form_nasal_spray', suggestedUnits: ['mcg', 'mg'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'], intakeUnit: 'spray', stageRenderer: 'nasal_spray', stageForm: NASAL_SPRAY_SPEC },
  { key: 'spray', labelKey: 'dosage_form_spray', suggestedUnits: ['mcg', 'mg', 'ml'], basisUnits: ['spray'], capabilities: ['countable', 'liquid', 'inventory_capable'], intakeUnit: 'spray', stageRenderer: 'spray', stageForm: SPRAY_SPEC },
  { key: 'gel', labelKey: 'dosage_form_gel', suggestedUnits: ['mg', 'g'], basisUnits: ['g', 'application'], capabilities: ['inventory_capable'], intakeUnit: 'application', stageRenderer: 'gel', stageForm: GEL_SPEC },
  { key: 'patch', labelKey: 'dosage_form_patch', suggestedUnits: ['mcg', 'mg'], basisUnits: ['patch', 'hour'], capabilities: ['countable', 'inventory_capable'], intakeUnit: 'patch', stageRenderer: 'patch', stageForm: PATCH_SPEC },
  { key: 'tube', labelKey: 'dosage_form_tube', suggestedUnits: ['mg', 'g', 'ml'], basisUnits: ['g', 'ml', 'application'], capabilities: ['inventory_capable'], intakeUnit: 'application', stageRenderer: 'tube', stageForm: TUBE_SPEC },
  { key: 'other', labelKey: 'dosage_form_other', suggestedUnits: ['mcg', 'mg', 'g', 'IU', 'ml'], basisUnits: ['unit', 'portion'], capabilities: [], intakeUnit: 'unit' },
] as const

// Faellt auf 'other' zurueck, wenn die Form unbekannt ist. Das ist kein
// Sicherheitsnetz gegen Tippfehler — der Typ deckt das ab —, sondern gegen
// Eintraege, die aelter sind als die Liste: 'liquid' stand bis September in
// der Datenbank und liegt in Bestandsdaten weiter. Ohne den Rueckfall gaebe
// die Suche undefined zurueck und der naechste Zugriff auf .stageRenderer
// wuerde die Seite abstuerzen lassen, statt den Eintrag textuell zu zeigen.
export function getDosageForm(key: DosageFormKey): DosageFormDefinition {
  return DOSAGE_FORMS.find(form => form.key === key)
    ?? DOSAGE_FORMS.find(form => form.key === 'other')!
}

export function getIntakePlanUnitSuggestions(
  key: DosageFormKey,
  catalogSuggestedUnits: readonly string[] = [],
): string[] {
  const form = getDosageForm(key)
  const catalogUnits = catalogSuggestedUnits
    .filter(unit => form.suggestedUnits.includes(unit))

  // Die Einnahmeeinheit steht mit vorn: sie ist das, was der Nutzer im Alltag
  // zaehlt (eine Spritze, ein Spruehstoss), waehrend `suggestedUnits` die
  // Wirkstoffmengen sind und `basisUnits` die Packungsmasse.
  return Array.from(new Set([
    ...catalogUnits,
    form.intakeUnit,
    ...form.suggestedUnits,
    ...form.basisUnits,
  ]))
}

// Der Uebersetzungsschluessel zur Einnahmeeinheit einer Form. Eine Stelle,
// damit „Spritze" ueberall dasselbe Wort ist — im Beispieleintrag, im Plan
// und in der Zusammenfassung.
export function intakeUnitLabelKey(key: DosageFormKey): string {
  return `my_stack_intake_unit_${getDosageForm(key).intakeUnit}`
}

export function isStageRenderable(key: DosageFormKey): boolean {
  return getDosageForm(key).stageRenderer !== undefined
}
