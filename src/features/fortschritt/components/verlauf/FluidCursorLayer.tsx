import { usePlotArea, ZIndexLayer, DefaultZIndexes } from 'recharts'
import { useFluidChartHover } from './useFluidChartHover'

interface Props {
  snapDates: string[]
}

export function FluidCursorLayer({ snapDates }: Props) {
  const hover = useFluidChartHover(snapDates)
  const plotArea = usePlotArea()

  if (!hover || !plotArea) return null

  return (
    <ZIndexLayer zIndex={DefaultZIndexes.cursorLine}>
      <line
        x1={hover.fluidX}
        x2={hover.fluidX}
        y1={plotArea.y}
        y2={plotArea.y + plotArea.height}
        stroke="rgba(0,204,245,0.4)"
        strokeWidth={1}
        strokeDasharray="4 4"
        pointerEvents="none"
      />
    </ZIndexLayer>
  )
}
