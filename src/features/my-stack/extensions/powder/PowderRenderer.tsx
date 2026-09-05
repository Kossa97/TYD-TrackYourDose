import type { Ref } from 'react'
import { PowderVisual } from './PowderVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface PowderRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Weder Etikett noch Fuellstand: beides ist fuer eine undurchsichtige
// Pulverdose bedeutungslos. Deshalb reicht der Renderer weder showLabel noch
// fillPct noch eine Slosh-Anbindung weiter. Die Farbe sitzt auf dem Deckel,
// anders als bei der Tube, die ganz ohne auskommt.
export function PowderRenderer({ item, ...visualProps }: PowderRendererProps) {
  return (
    <div data-stack-renderer="powder">
      <PowderVisual
        name={item.display_name}
        color={item.color_hex ?? '#94a3b8'}
        {...visualProps}
      />
    </div>
  )
}
