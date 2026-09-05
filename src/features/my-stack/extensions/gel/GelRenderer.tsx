import type { Ref } from 'react'
import { GelVisual } from './GelVisual'
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
}

// Kein Slosh-Provider: Gel schwappt nicht. Kein Fuellstand: der Tiegel zeigt
// seinen Inhalt, aber die App kennt keine Menge. Die Farbe sitzt auf Deckel
// und Gel, wie bei der Tropfflasche auf Kappe und Fluessigkeit.
export function GelRenderer({ item, ...visualProps }: GelRendererProps) {
  return (
    <div data-stack-renderer="gel">
      <GelVisual
        name={item.display_name}
        color={item.color_hex ?? '#94a3b8'}
        {...visualProps}
      />
    </div>
  )
}
