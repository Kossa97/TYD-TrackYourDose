import type { Ref } from 'react'
import type { SloshEngine } from '../../../components/sloshEngine'
import { isStageRenderable } from '../lib/dosageForms'
import { stagePreviewItem } from '../lib/stagePreview'
import type { StageLightHandle } from '../stage/useStageLight'
import type { DosageFormKey, StackItemIngredient } from '../types'
import { StackStage } from './StackStage'

export interface DosageFormPreviewProps {
  dosageForm: DosageFormKey
  displayName?: string | null
  colorHex?: string | null
  ingredients?: readonly StackItemIngredient[]
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  showLabel?: boolean
  // Wie hell das Objekt steht. Die Auswahl dimmt damit, was nicht gewaehlt
  // ist — mit demselben Regler, den das Karussell benutzt, statt mit einer
  // Deckkraft ueber allem.
  focus?: number
  // Aus welcher Richtung das Buehnenlicht faellt (-1..1). Im Karussell ist das
  // die Seite, auf der das Objekt zur Mitte steht.
  lightOffset?: number
  // Der imperative Kanal der Buehnenform: das Karussell schiebt Licht und
  // Fokus beim Wischen direkt in den DOM, ohne React dazwischen. Ohne ihn
  // muesste jedes Bild durch eine Renderrunde, und das ruckelt.
  stageLightRef?: Ref<StageLightHandle>
  // Die Fluessigkeitsphysik der Ansicht. Formen mit Inhalt schwappen damit
  // beim Wischen; die uebrigen ignorieren sie.
  sloshEngine?: SloshEngine
  className?: string
}

// Das Objekt selbst, gefuettert aus dem Entwurf statt aus einem gespeicherten
// Eintrag. Zwei Stellen benutzen es: die Auswahlkacheln (klein, ohne
// Aufschrift) und die Vorschau ueber dem Formular (mit allem, was schon
// eingetippt ist).
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
  showLabel = true,
  focus,
  lightOffset,
  stageLightRef,
  sloshEngine,
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
      <StackStage
        item={item}
        size={size}
        showLabel={showLabel}
        focus={focus}
        lightOffset={lightOffset}
        stageLightRef={stageLightRef}
        sloshEngine={sloshEngine}
      />
    </div>
  )
}
