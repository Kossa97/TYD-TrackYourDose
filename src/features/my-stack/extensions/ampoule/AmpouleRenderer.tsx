import type { Ref } from 'react'
import { AmpouleVisual } from './AmpouleVisual'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface AmpouleRendererProps {
  item: StackItem
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
  sloshEngine?: SloshEngine
}

// "250 mg / ml" — strength per basis, the way it is printed on a real ampoule.
// Missing pieces are left out rather than filled with a placeholder.
function strengthLabel(item: StackItem): string | null {
  const ingredient = item.ingredients[0]
  if (!ingredient?.amount_unit) return null
  return ingredient.basis_unit
    ? `${ingredient.amount_unit} / ${ingredient.basis_unit}`
    : ingredient.amount_unit
}

export function AmpouleRenderer({ item, sloshEngine, ...visualProps }: AmpouleRendererProps) {
  const ingredient = item.ingredients[0]
  const ampoule = (
    <AmpouleVisual
      name={item.display_name}
      amount={ingredient?.amount_value}
      unit={strengthLabel(item)}
      color={item.color_hex ?? '#64748b'}
      {...visualProps}
    />
  )

  return (
    <div data-stack-renderer="ampoule">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{ampoule}</SloshProvider> : ampoule}
    </div>
  )
}
