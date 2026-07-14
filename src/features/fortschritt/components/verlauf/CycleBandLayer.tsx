import {
  usePlotArea,
  useXAxisScale,
  ZIndexLayer,
  DefaultZIndexes,
} from 'recharts'
import { computeCycleBandLayout } from '../../lib/cycleLanes'
import {
  cycleStartsAtHover,
  cycleStartsNearCursor,
  TOOLTIP_CURSOR_PX_THRESHOLD,
} from '../../lib/chartTooltip'
import { useChartPointerX } from './ChartPointerContext'
import { useFluidChartHover } from './useFluidChartHover'

export interface CycleBandDraw {
  id: string
  name: string
  color: string
  filled: boolean
  faded: boolean
  startDate: string
  /** Liegt der echte Zyklus-Start im Sichtfenster? Sonst ist x1 nur der Fensterrand. */
  startVisible: boolean
  x1: number
  x2: number
  lane: number
}

interface Props {
  bands: CycleBandDraw[]
  lanes: number
  snapDates: string[]
}

const HOVER_PX_THRESHOLD = TOOLTIP_CURSOR_PX_THRESHOLD

function bandLayout(
  plotArea: NonNullable<ReturnType<typeof usePlotArea>>,
  xScale: NonNullable<ReturnType<typeof useXAxisScale>>,
  bands: CycleBandDraw[],
  lanes: number,
) {
  const { blockHeight, laneHeight, laneGap } = computeCycleBandLayout(plotArea.height, lanes)
  const baseY = plotArea.y + plotArea.height - blockHeight

  return bands.flatMap(band => {
    const px1 = xScale(band.x1, { position: 'start' })
    const px2 = xScale(band.x2, { position: 'end' })
    if (px1 == null || px2 == null) return []

    const startX = plotArea.x + px1
    const x = Math.min(startX, plotArea.x + px2)
    const w = Math.max(Math.abs((plotArea.x + px2) - startX), 3)
    const y = baseY + band.lane * (laneHeight + laneGap)

    return [{ band, x, y, w, startX, laneHeight }]
  })
}

function isStartHighlighted(
  band: CycleBandDraw,
  pointerActive: boolean,
  cursorX: number | undefined,
  hoverDateIso: string | null,
  hoverTs: number | undefined,
  xScale: NonNullable<ReturnType<typeof useXAxisScale>>,
  plotArea: NonNullable<ReturnType<typeof usePlotArea>>,
): boolean {
  if (!pointerActive || cursorX == null) return false
  if (hoverDateIso && cycleStartsAtHover([band], hoverDateIso, hoverTs).length > 0) {
    return true
  }
  return cycleStartsNearCursor([band], cursorX, xScale, plotArea, HOVER_PX_THRESHOLD).length > 0
}

/**
 * Zyklus-Balken + Start-Striche im Chart-Hintergrund.
 */
export function CycleBandLayer({ bands, lanes, snapDates }: Props) {
  const xScale = useXAxisScale()
  const plotArea = usePlotArea()
  const pointerX = useChartPointerX()
  const hover = useFluidChartHover(snapDates)

  if (!xScale || !plotArea || bands.length === 0 || lanes === 0) {
    return null
  }

  const items = bandLayout(plotArea, xScale, bands, lanes)

  return (
    <>
      <ZIndexLayer zIndex={DefaultZIndexes.barBackground}>
        <g className="cycle-band-layer" aria-hidden>
          {items.map(({ band, x, y, w, laneHeight }) => (
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
          ))}
        </g>
      </ZIndexLayer>

      <ZIndexLayer zIndex={0}>
        <g className="cycle-start-markers" aria-hidden>
          {items.map(({ band, y, startX, laneHeight }) => {
            // Läuft der Zyklus schon vor dem Fenster, ist startX nur der geklemmte
            // Balkenanfang — dort einen Start-Marker zu zeichnen wäre gelogen.
            if (!band.startVisible) return null

            const highlighted = isStartHighlighted(
              band,
              pointerX != null,
              hover?.fluidX ?? pointerX ?? undefined,
              hover?.dateIso ?? null,
              hover?.hoverTs,
              xScale,
              plotArea,
            )

            return (
              <g key={`start-${band.id}`}>
                <line
                  x1={startX}
                  x2={startX}
                  y1={y}
                  y2={y + laneHeight}
                  stroke={band.color}
                  strokeWidth={highlighted ? 2.5 : 1.5}
                  strokeOpacity={highlighted ? 1 : band.faded ? 0.18 : 0.55}
                />
                <circle
                  cx={startX}
                  cy={y}
                  r={highlighted ? 4.5 : 3}
                  fill={highlighted ? band.color : '#07091a'}
                  stroke={band.color}
                  strokeWidth={highlighted ? 2 : 1.25}
                  opacity={highlighted ? 1 : band.faded ? 0.35 : 0.8}
                />
              </g>
            )
          })}
        </g>
      </ZIndexLayer>
    </>
  )
}
