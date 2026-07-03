import { format, parseISO } from 'date-fns'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import { cycleStartsOnDate, hoverDateIso } from '../../lib/chartTooltip'

export interface CycleBandDraw {
  id: string
  name: string
  color: string
  filled: boolean
  faded: boolean
  startDate: string
  x1: number
  x2: number
  lane: number
}

interface Props {
  active?: boolean
  payload?: ReadonlyArray<{ value?: unknown }>
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
  if (!active || label == null) return null

  const dateIso = hoverDateIso(label)
  const starts = cycleStartsOnDate(bands, dateIso)
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
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>{fmtDate(dateIso)}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {hasMetric && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              width: 8,
              height: 8,
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
              width: 8,
              height: 8,
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
