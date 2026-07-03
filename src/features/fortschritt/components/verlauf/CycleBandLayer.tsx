import { useXAxisScale, usePlotArea, ZIndexLayer, DefaultZIndexes } from 'recharts'
import { computeCycleBandLayout } from '../../lib/cycleLanes'

export interface CycleBandDraw {
  id: string
  name: string
  color: string
  filled: boolean
  faded: boolean
  x1: number
  x2: number
  lane: number
}

interface Props {
  bands: CycleBandDraw[]
  lanes: number
}

/**
 * Zyklus-Balken im Chart-Hintergrund — füllen die Y-Höhe je nach Zeilenanzahl.
 */
export function CycleBandLayer({ bands, lanes }: Props) {
  const xScale = useXAxisScale()
  const plotArea = usePlotArea()

  if (!xScale || !plotArea || bands.length === 0 || lanes === 0) {
    return null
  }

  const { blockHeight, laneHeight, laneGap } = computeCycleBandLayout(plotArea.height, lanes)
  const baseY = plotArea.y + plotArea.height - blockHeight

  return (
    <ZIndexLayer zIndex={DefaultZIndexes.barBackground}>
      <g className="cycle-band-layer" aria-hidden>
        {bands.map(band => {
          const px1 = xScale(band.x1, { position: 'start' })
          const px2 = xScale(band.x2, { position: 'end' })
          if (px1 == null || px2 == null) return null

          const x = plotArea.x + Math.min(px1, px2)
          const w = Math.max(Math.abs(px2 - px1), 3)
          const y = baseY + band.lane * (laneHeight + laneGap)

          return (
            <rect
              key={band.id}
              x={x}
              y={y}
              width={w}
              height={laneHeight}
              fill={band.color}
              fillOpacity={band.faded ? 0.1 : band.filled ? 0.32 : 0.18}
              stroke={band.filled ? 'none' : band.color}
              strokeOpacity={band.faded ? 0.2 : 0.5}
              strokeWidth={band.filled ? 0 : 1.5}
              strokeDasharray={band.filled ? undefined : '5 4'}
              rx={4}
              ry={4}
            />
          )
        })}
      </g>
    </ZIndexLayer>
  )
}
