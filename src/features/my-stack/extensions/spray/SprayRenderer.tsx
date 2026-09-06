import type { Ref } from 'react'
import { SprayVisual } from './SprayVisual'
import { SloshProvider } from '../../../../components/SloshContext'
import type { SloshEngine } from '../../../../components/sloshEngine'
import type { StageLightHandle } from '../../stage/useStageLight'
import type { StackItem } from '../../types'

export interface SprayRendererProps {
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

// "1000 IU / spray" — Wirkstoff je Spruehstoss, wie es auf der Flasche steht.
// Fehlende Teile bleiben weg statt durch einen Platzhalter ersetzt zu werden.
function strengthLabel(item: StackItem): string | null {
  const ingredient = item.ingredients[0]
  if (!ingredient?.amount_unit) return null
  return ingredient.basis_unit
    ? `${ingredient.amount_unit} / ${ingredient.basis_unit}`
    : ingredient.amount_unit
}

export function SprayRenderer({ item, sloshEngine, ...visualProps }: SprayRendererProps) {
  const ingredient = item.ingredients[0]
  const spray = (
    <SprayVisual
      name={item.display_name}
      amount={ingredient?.amount_value}
      unit={strengthLabel(item)}
      color={item.color_hex ?? '#64748b'}
      {...visualProps}
    />
  )

  return (
    <div data-stack-renderer="spray">
      {sloshEngine ? <SloshProvider engine={sloshEngine}>{spray}</SloshProvider> : spray}
    </div>
  )
}
