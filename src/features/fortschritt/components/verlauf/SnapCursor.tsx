import { usePlotArea } from 'recharts'
import { useFluidChartHover } from './useFluidChartHover'

interface Props {
  snapDates: string[]
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
}

export function SnapCursor({
  snapDates,
  stroke = 'rgba(0,204,245,0.4)',
  strokeWidth = 1,
  strokeDasharray = '4 4',
}: Props) {
  const hover = useFluidChartHover(snapDates)
  const plotArea = usePlotArea()

  if (!hover || !plotArea) return null

  return (
    <line
      x1={hover.fluidX}
      x2={hover.fluidX}
      y1={plotArea.y}
      y2={plotArea.y + plotArea.height}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      pointerEvents="none"
    />
  )
}
