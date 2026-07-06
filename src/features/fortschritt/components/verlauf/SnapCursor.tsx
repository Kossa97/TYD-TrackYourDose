import { useActiveTooltipCoordinate, usePlotArea, useXAxisScale } from 'recharts'
import { nearestSnapHoverDate } from '../../lib/chartTooltip'

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
  const cursor = useActiveTooltipCoordinate()
  const xScale = useXAxisScale()
  const plotArea = usePlotArea()

  const snap = nearestSnapHoverDate(
    cursor?.x,
    snapDates,
    xScale ?? undefined,
    plotArea ?? undefined,
  )

  if (!snap || !xScale || !plotArea) return null

  const px = xScale(snap.hoverTs, { position: 'start' })
  if (px == null) return null

  const x = plotArea.x + px

  return (
    <line
      x1={x}
      x2={x}
      y1={plotArea.y}
      y2={plotArea.y + plotArea.height}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      pointerEvents="none"
    />
  )
}
