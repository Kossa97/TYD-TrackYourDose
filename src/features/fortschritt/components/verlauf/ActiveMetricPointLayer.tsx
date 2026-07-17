import {
  DefaultZIndexes,
  useXAxisScale,
  useYAxisScale,
  ZIndexLayer,
} from 'recharts'
import type { MetricChartPoint } from '../../lib/chartTooltip'
import type { CycleBandDraw } from './CycleBandLayer'
import { useChartTooltipContent } from './useChartTooltipContent'

interface Props {
  enabled: boolean
  snapDates: string[]
  bands: CycleBandDraw[]
  metricData: MetricChartPoint[]
  viewStart: number
  viewEnd: number
  color: string
}

export function ActiveMetricPointLayer({
  enabled,
  snapDates,
  bands,
  metricData,
  viewStart,
  viewEnd,
  color,
}: Props) {
  const xScale = useXAxisScale()
  const yScale = useYAxisScale('metric')
  const content = useChartTooltipContent(snapDates, bands, metricData, {
    nearestMetric: true,
    viewStart,
    viewEnd,
  })

  if (!enabled || !xScale || !yScale || content?.metricTs == null || content.metricValue == null) {
    return null
  }

  const cx = xScale(content.metricTs, { position: 'start' })
  const cy = yScale(content.metricValue)
  if (cx == null || cy == null) return null

  return (
    <ZIndexLayer zIndex={DefaultZIndexes.activeDot}>
      <circle
        aria-hidden
        cx={cx}
        cy={cy}
        r={4.5}
        fill={color}
        stroke="#07091a"
        strokeWidth={2}
        pointerEvents="none"
      />
    </ZIndexLayer>
  )
}
