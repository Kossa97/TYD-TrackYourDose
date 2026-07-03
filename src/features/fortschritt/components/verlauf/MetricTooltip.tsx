import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  useActiveTooltipCoordinate,
  useActiveTooltipLabel,
  useXAxisInverseScale,
} from 'recharts'
import type { CycleBandDraw } from './CycleBandLayer'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import {
  hoverDateIso,
  metricValueAtDate,
  resolveCursorHoverDate,
  resolveTooltipCycleStarts,
} from '../../lib/chartTooltip'

interface ChartPoint {
  date: string
  ts: number
  value: number | null
}

interface Props {
  active?: boolean
  label?: number | string
  bands: CycleBandDraw[]
  metric: MetricDefinition
  chartData: ChartPoint[]
}

function fmtDate(iso: string) {
  return format(parseISO(`${iso}T00:00:00`), 'dd.MM.')
}

function formatTooltipValue(value: number, unit: string): string {
  if (unit === 'kg') return `${value} kg`
  if (unit === '%') return `${value}%`
  return unit ? `${value} ${unit}` : String(value)
}

export function MetricTooltip({ active, label, bands, metric, chartData }: Props) {
  const cursor = useActiveTooltipCoordinate()
  const activeLabel = useActiveTooltipLabel()
  const xInverseScale = useXAxisInverseScale()

  const { dateIso, metricValue, starts } = useMemo(() => {
    const fromCursor = resolveCursorHoverDate(cursor?.x, xInverseScale ?? undefined)
    const labelTs = activeLabel ?? label
    const fromLabel = labelTs != null && Number.isFinite(Number(labelTs))
      ? { dateIso: hoverDateIso(labelTs), hoverTs: Number(labelTs) }
      : null
    const hover = fromCursor ?? fromLabel

    if (!hover) {
      return { dateIso: null, metricValue: null, starts: [] as CycleBandDraw[] }
    }

    return {
      dateIso: hover.dateIso,
      metricValue: metricValueAtDate(chartData, hover.dateIso),
      starts: resolveTooltipCycleStarts(bands, hover.dateIso, hover.hoverTs),
    }
  }, [cursor, xInverseScale, activeLabel, label, bands, chartData])

  if (!active || !dateIso) return null

  const hasMetric = metricValue != null

  if (!hasMetric && starts.length === 0) return null

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 12px',
      fontSize: 11,
      fontWeight: 700,
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      minWidth: 140,
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{fmtDate(dateIso)}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {hasMetric && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: metric.color,
              flexShrink: 0,
            }} />
            <span style={{ color: 'var(--text-dim)' }}>
              {metric.label}: {formatTooltipValue(metricValue!, metric.unit)}
            </span>
          </div>
        )}
        {starts.map(band => (
          <div key={band.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: band.color,
              flexShrink: 0,
              boxShadow: `0 0 6px ${band.color}66`,
            }} />
            <span style={{ color: band.color }}>{band.name} · Start</span>
          </div>
        ))}
      </div>
    </div>
  )
}
