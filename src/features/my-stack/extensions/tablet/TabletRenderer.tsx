import type { Ref } from 'react'
import { TabletVisual } from './TabletVisual'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface TabletRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
}

// Kein Slosh-Provider: eine flach liegende Tablette wackelt nicht, sie liegt.
export function TabletRenderer({ item, ...visualProps }: TabletRendererProps) {
  return (
    <div data-stack-renderer="tablet">
      <TabletVisual
        name={item.display_name}
        color={item.color_hex ?? '#64748b'}
        {...visualProps}
      />
    </div>
  )
}
