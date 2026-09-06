import type { DosageFormKey, StackItem, StackItemIngredient } from '../types'

// Die Buehne rendert einen StackItem, das Anlege-Formular haelt einen Entwurf.
// Damit das Formular dieselbe Grafik zeigen kann wie die Karte danach, giesst
// diese Funktion den Entwurf in genau die Form, die StackStage ohnehin kennt.
//
// Absichtlich KEINE zweite Zuordnung Darreichungsform -> Grafik: die gibt es
// einmal, in StackStage. Eine zweite koennte auseinanderlaufen, und dann zeigt
// das Formular etwas anderes an als der Stack.

export interface StagePreviewInput {
  dosageForm: DosageFormKey
  displayName?: string | null
  colorHex?: string | null
  ingredients?: readonly StackItemIngredient[]
}

// Erkennbar kein gespeicherter Eintrag: die Kennung sagt, woher er kommt, und
// user_id bleibt leer. Nichts davon wird je geschrieben.
export const STAGE_PREVIEW_ID = 'stage-preview'

export function stagePreviewItem(input: StagePreviewInput): StackItem {
  const name = input.displayName?.trim() ?? ''
  const farbe = input.colorHex?.trim() ?? ''

  return {
    id: STAGE_PREVIEW_ID,
    user_id: '',
    // Ohne Namen greift jede Form ihren eigenen Vorgabenamen („Pulver",
    // „Spray") — im Formular ist das ehrlicher als ein erfundener Platzhalter.
    display_name: name,
    category: 'medication',
    dosage_form: input.dosageForm,
    brand: null,
    // Eine leere Farbe ist keine Farbe: die Formen haben ihr eigenes Grau als
    // Rueckfall, und das ist besser als ein halb getipptes „#0".
    color_hex: istFarbe(farbe) ? farbe : null,
    notes: null,
    configuration_status: 'needs_review',
    archived: false,
    tracking_level: 'intake_only',
    pk_profile_method: null,
    archived_at: null,
    created_at: '',
    updated_at: '',
    ingredients: input.ingredients ? [...input.ingredients] : [],
  }
}

// Waehrend des Tippens steht im Feld jeder Zwischenstand: „#", „#0a", „#0af0".
// Nur ein vollstaendiger Hex-Wert darf durchgereicht werden, sonst flackert
// die Vorschau bei jedem Tastendruck durch Schwarz.
function istFarbe(wert: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(wert)
}
