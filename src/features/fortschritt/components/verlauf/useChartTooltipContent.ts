import { useMemo } from 'react'
import type { CycleBandDraw } from './CycleBandLayer'
import { resolveChartTooltipContent } from '../../lib/chartTooltip'
import { useChartPointerX } from './ChartPointerContext'
import { useFluidChartHover } from './useFluidChartHover'

interface ChartPoint {
  date: string
  ts: number
  value: number | null
}

export function useChartTooltipContent(
  snapDates: string[],
  bands: CycleBandDraw[],
  metricData: ChartPoint[],
) {
  const pointerX = useChartPointerX()
  const hover = useFluidChartHover(snapDates)

  return useMemo(() => {
    if (pointerX == null || !hover) return null

    return resolveChartTooltipContent({
      hoverDateIso: hover.dateIso,
      bands,
      metricData,
    })
  }, [pointerX, hover, bands, metricData])
}
