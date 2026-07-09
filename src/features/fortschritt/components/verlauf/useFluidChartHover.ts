import { useMemo } from 'react'
import {
  usePlotArea,
  useXAxisInverseScale,
  useXAxisScale,
} from 'recharts'
import { resolveFluidChartHover } from '../../lib/chartTooltip'
import { useChartPointerX } from './ChartPointerContext'

export function useFluidChartHover(snapDates: string[]) {
  const pointerX = useChartPointerX()
  const xScale = useXAxisScale()
  const xInverseScale = useXAxisInverseScale()
  const plotArea = usePlotArea()

  return useMemo(
    () => resolveFluidChartHover(
      pointerX ?? undefined,
      snapDates,
      xScale ?? undefined,
      xInverseScale ?? undefined,
      plotArea ?? undefined,
    ),
    [pointerX, snapDates, xScale, xInverseScale, plotArea],
  )
}
