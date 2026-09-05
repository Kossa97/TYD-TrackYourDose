import type { Ref } from 'react'
import { GelVisual } from './GelVisual'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface GelRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
  sloshEngine?: SloshEngine
}

// Dieselbe Feder wie bei der Fluessigkeit, andere Auswertung — wie bei der
// Tablette, die anrollt statt zu schwappen. Das Gel filtert die Federantwort
// durch ein Verzoegerungsglied und kriecht der Bewegung hinterher.
//
// Kein Fuellstand: der Tiegel zeigt seinen Inhalt, aber die App kennt keine
// Menge. Die Farbe sitzt auf Deckel und Gel, wie bei der Tropfflasche auf
// Kappe und Fluessigkeit.
export function GelRenderer({ item, sloshEngine, ...visualProps }: GelRendererProps) {
  const jar = (
    <GelVisual
      name={item.display_name}
      color={item.color_hex ?? '#94a3b8'}
      {...visualProps}
    />
  )

  return (
    <div data-stack-renderer="gel">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{jar}</SloshProvider> : jar}
    </div>
  )
}
