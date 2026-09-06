import { isStageRenderable } from '../lib/dosageForms'
import { stagePreviewItem } from '../lib/stagePreview'
import type { DosageFormKey, StackItemIngredient } from '../types'
import { StackStage } from './StackStage'

export interface DosageFormPreviewProps {
  dosageForm: DosageFormKey
  displayName?: string | null
  colorHex?: string | null
  ingredients?: readonly StackItemIngredient[]
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
}

// Das Objekt selbst, gefuettert aus dem Entwurf statt aus einem gespeicherten
// Eintrag: die Vorschau ueber dem Formular, mit allem, was schon eingetippt
// ist.
//
// Kein Buehnenlicht und keine Physik: die Lampe gehoert dem Karussell, wo sie
// aus der Lage der Karte kommt. Im Formular gibt es keine Lage, also stuende
// sie still — und eine stillstehende Lampe ist kein Effekt, sondern nur ein
// fest eingebautes Gefaelle.
export function DosageFormPreview({
  dosageForm,
  displayName,
  colorHex,
  ingredients,
  size = 'compact',
  className = '',
}: DosageFormPreviewProps) {
  // `liquid` und `other` haben keine Buehnengrafik. Sie bekommen hier auch
  // keine erfundene: die Kachel faellt auf ihr Symbol zurueck, die Vorschau
  // bleibt weg. Die Regel „Formen ohne Grafik bleiben textlich" wird nicht
  // aufgeweicht.
  if (!isStageRenderable(dosageForm)) return null

  const item = stagePreviewItem({ dosageForm, displayName, colorHex, ingredients })

  return (
    <div data-dosage-form-preview={dosageForm} className={className}>
      <StackStage item={item} size={size} />
    </div>
  )
}
