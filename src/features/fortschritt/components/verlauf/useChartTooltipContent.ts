import { useMemo } from 'react'
import { usePlotArea, useXAxisScale } from 'recharts'
import type { CycleBandDraw } from './CycleBandLayer'
import {
  buildSnapAnchors,
  resolveChartTooltipContent,
} from '../../lib/chartTooltip'
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
  const xScale = useXAxisScale()
  const plotArea = usePlotArea()

  return useMemo(() => {
    if (pointerX == null || !hover || !xScale || !plotArea) return null

    const anchors = buildSnapAnchors(snapDates, xScale, plotArea)
    return resolveChartTooltipContent({
      fluidX: hover.fluidX,
      cursorX: pointerX,
      hoverDateIso: hover.dateIso,
      hoverTs: hover.hoverTs,
      anchors,
      bands,
      metricData,
      xScale,
      plotArea,
    })
  }, [pointerX, hover, snapDates, xScale, plotArea, bands, metricData])
}
