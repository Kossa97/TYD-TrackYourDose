import type { Ref } from 'react'
import { CapsuleVisual } from './CapsuleVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface CapsuleRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: eine liegende Kapsel schwingt nicht, sie lebt allein vom
// wandernden Licht.
export function CapsuleRenderer({ item, ...visualProps }: CapsuleRendererProps) {
  return (
    <div data-stack-renderer="capsule">
      <CapsuleVisual
        name={item.display_name}
        color={item.color_hex ?? '#64748b'}
        {...visualProps}
      />
    </div>
  )
}
