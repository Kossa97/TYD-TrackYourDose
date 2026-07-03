import { format, parseISO } from 'date-fns'
import type { CycleBandDraw } from './CycleBandLayer'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import { cycleStartsAtHover, hoverDateIso } from '../../lib/chartTooltip'

interface ChartPoint {
  date: string
  ts: number
  value: number | null
}

interface Props {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: ChartPoint; value?: unknown }>
  label?: number | string
  bands: CycleBandDraw[]
  metric: MetricDefinition
}

function fmtDate(iso: string) {
  return format(parseISO(`${iso}T00:00:00`), 'dd.MM.')
}

function formatTooltipValue(value: number, unit: string): string {
  if (unit === 'kg') return `${value} kg`
  if (unit === '%') return `${value}%`
  return unit ? `${value} ${unit}` : String(value)
}

export function MetricTooltip({ active, payload, label, bands, metric }: Props) {
  if (!active) return null

  const point = payload?.[0]?.payload
  const dateIso = point?.date ?? (label != null ? hoverDateIso(label) : null)
  if (!dateIso) return null

  const hoverTs = point?.ts ?? (typeof label === 'number' ? label : Number(label))
  const starts = cycleStartsAtHover(bands, dateIso, Number.isFinite(hoverTs) ? hoverTs : undefined)
  const rawValue = payload?.[0]?.value
  const metricValue = rawValue != null && rawValue !== '' ? Number(rawValue) : null
  const hasMetric = metricValue != null && Number.isFinite(metricValue)

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
