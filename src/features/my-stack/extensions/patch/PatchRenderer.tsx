import type { Ref } from 'react'
import { PatchVisual } from './PatchVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface PatchRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: ein Pflaster enthält keine sichtbare Flüssigkeit.
// Die Eintragsfarbe geht an den Streifen am unteren Rand.
export function PatchRenderer({ item, ...visualProps }: PatchRendererProps) {
  return (
    <div data-stack-renderer="patch">
      <PatchVisual
        name={item.display_name}
        color={item.color_hex ?? '#64748b'}
        {...visualProps}
      />
    </div>
  )
}
