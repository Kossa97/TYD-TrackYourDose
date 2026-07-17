import { useMemo } from 'react'
import type { MetricChartPoint } from '../../lib/chartTooltip'
import { resolveChartTooltipContent } from '../../lib/chartTooltip'
import type { CycleBandDraw } from './CycleBandLayer'
import { useChartPointerX } from './ChartPointerContext'
import { useFluidChartHover } from './useFluidChartHover'

interface TooltipSelectionOptions {
  nearestMetric: boolean
  viewStart: number
  viewEnd: number
}

export function useChartTooltipContent(
  snapDates: string[],
  bands: CycleBandDraw[],
  metricData: MetricChartPoint[],
  options: TooltipSelectionOptions,
) {
  const pointerX = useChartPointerX()
  const hover = useFluidChartHover(snapDates)

  return useMemo(() => {
    if (pointerX == null || !hover) return null

    return resolveChartTooltipContent({
      hoverDateIso: hover.dateIso,
      hoverTs: hover.hoverTs,
      bands,
      metricData,
      nearestMetric: options.nearestMetric,
      viewStart: options.viewStart,
      viewEnd: options.viewEnd,
    })
  }, [
    pointerX,
    hover,
    bands,
    metricData,
    options.nearestMetric,
    options.viewStart,
    options.viewEnd,
  ])
}