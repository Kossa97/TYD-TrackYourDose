import { useMemo } from 'react'
import {
  useActiveTooltipCoordinate,
  usePlotArea,
  useXAxisInverseScale,
  useXAxisScale,
} from 'recharts'
import { resolveFluidChartHover } from '../../lib/chartTooltip'

export function useFluidChartHover(snapDates: string[]) {
  const cursor = useActiveTooltipCoordinate()
  const xScale = useXAxisScale()
  const xInverseScale = useXAxisInverseScale()
  const plotArea = usePlotArea()

  return useMemo(
    () => resolveFluidChartHover(
      cursor?.x,
      snapDates,
      xScale ?? undefined,
      xInverseScale ?? undefined,
      plotArea ?? undefined,
    ),
    [cursor?.x, snapDates, xScale, xInverseScale, plotArea],
  )
}
