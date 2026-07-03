import { useXAxisScale, usePlotArea, ZIndexLayer, DefaultZIndexes } from 'recharts'

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
 * Zyklus-Balken im Chart-Hintergrund (Recharts 3 Hooks).
 */
export function CycleBandLayer({ bands, lanes }: Props) {
  const xScale = useXAxisScale()
  const plotArea = usePlotArea()

  if (!xScale || !plotArea || bands.length === 0 || lanes === 0) {
    return null
  }

  const laneHeight = Math.min(14, Math.max(9, plotArea.height / Math.max(lanes * 1.35, 3.5)))
  const laneGap = 4
  const blockHeight = lanes * (laneHeight + laneGap) - laneGap
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
              fillOpacity={band.faded ? 0.12 : band.filled ? 0.38 : 0.2}
              stroke={band.filled ? 'none' : band.color}
              strokeOpacity={band.faded ? 0.25 : 0.55}
              strokeWidth={band.filled ? 0 : 1.5}
              strokeDasharray={band.filled ? undefined : '5 4'}
              rx={5}
              ry={5}
            />
          )
        })}
      </g>
    </ZIndexLayer>
  )
}
