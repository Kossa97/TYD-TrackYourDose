import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { MarkerSummary, Trend } from '../lib/bloodwork'
import { GREEN, MUTED, RED } from '../styles'

export const TrendIcon = ({ trend, size = 16 }: { trend: Trend; size?: number }) => {
  if (trend === 'up') return <TrendingUp size={size} />
  if (trend === 'down') return <TrendingDown size={size} />
  if (trend === 'same') return <Minus size={size} />
  return null
}

/** Grün, wenn sich der Wert in die gewünschte Richtung bewegt. */
// eslint-disable-next-line react-refresh/only-export-components
export const trendColor = (summary: MarkerSummary): string => {
  const { trend } = summary
  if (trend === 'same' || trend === null) return MUTED
  const lowerIsBetter = summary.def?.lowerIsBetter
  const good = lowerIsBetter ? trend === 'down' : trend === 'up'
  return good ? GREEN : RED
}
