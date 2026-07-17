import { format, parseISO } from 'date-fns'
import type { MetricChartPoint } from '../../lib/chartTooltip'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import type { CycleBandDraw } from './CycleBandLayer'
import { useChartPointerX } from './ChartPointerContext'
import { useChartTooltipContent } from './useChartTooltipContent'

interface Props {
  active?: boolean
  label?: number | string
  bands: CycleBandDraw[]
  metric: MetricDefinition
  metricData: MetricChartPoint[]
  snapDates: string[]
  nearestMetric?: boolean
  viewStart?: number
  viewEnd?: number
}

function fmtDate(iso: string) {
  return format(parseISO(`${iso}T00:00:00`), 'dd.MM.')
}

function formatTooltipValue(value: number, unit: string): string {
  if (unit === 'kg') return `${value} kg`
  if (unit === '%') return `${value}%`
  return unit ? `${value} ${unit}` : String(value)
}

export function MetricTooltip({
  bands,
  metric,
  metricData,
  snapDates,
  nearestMetric = false,
  viewStart = Number.NEGATIVE_INFINITY,
  viewEnd = Number.POSITIVE_INFINITY,
}: Props) {
  const pointerX = useChartPointerX()
  const content = useChartTooltipContent(snapDates, bands, metricData, {
    nearestMetric,
    viewStart,
    viewEnd,
  })

  if (pointerX == null || !content) return null

  const { dateIso, metricDateIso, metricValue, starts } = content
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
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{
              width: 7,
              height: 7,
              marginTop: 3,
              borderRadius: '50%',
              background: metric.color,
              flexShrink: 0,
            }} />
            <div>
              {nearestMetric && metricDateIso && (
                <p style={{ color: 'var(--text-muted)', margin: '0 0 2px' }}>
                  Messwert vom {fmtDate(metricDateIso)}
                </p>
              )}
              <span style={{ color: 'var(--text-dim)' }}>
                {metric.label}: {formatTooltipValue(metricValue, metric.unit)}
              </span>
            </div>
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