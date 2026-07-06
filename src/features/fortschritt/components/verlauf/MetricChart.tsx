import { useMemo } from 'react'
import { format } from 'date-fns'
import { dayToTsSafe, formatDaySafe } from '../../lib/dates'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CycleSubstance, DateRange, OngoingSubstance } from '../../types'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import { buildMetricSeries, computeDelta } from '../../lib/metrics'
import type { BloodworkEntry, DailyLogEntry, WeightLogEntry } from '../../types'
import { substanceBarEnd } from '../../lib/focusSummary'
import { assignLanes, laneCount } from '../../lib/cycleLanes'
import { CycleBandLayer, type CycleBandDraw } from './CycleBandLayer'
import { MetricTooltip } from './MetricTooltip'
import { SnapCursor } from './SnapCursor'
import { buildTooltipSnapDates } from '../../lib/chartTooltip'
import { panel } from '../../styles'

interface Props {
  range: DateRange
  metric: MetricDefinition
  weights: WeightLogEntry[]
  dailyLogs: DailyLogEntry[]
  bloodwork: BloodworkEntry[]
  cycles: CycleSubstance[]
  ongoing: OngoingSubstance[]
  focusId: string | null
}

function fmtDate(d: string) {
  return formatDaySafe(d)
}

function dateToTs(date: string): number {
  return dayToTsSafe(date, 12) ?? Date.now()
}

function buildTimeTicks(from: string, to: string, count = 5): number[] {
  const start = dateToTs(from)
  const end = dateToTs(to)
  if (end <= start) return [start]
  const step = (end - start) / Math.max(count - 1, 1)
  return Array.from({ length: count }, (_, i) => Math.round(start + step * i))
}

function formatAxisValue(value: number, unit: string): string {
  if (unit === 'kg') return `${value}`
  if (unit === '%') return `${value}%`
  return unit ? `${value} ${unit}` : String(value)
}

function formatTooltipValue(value: number, unit: string): string {
  if (unit === 'kg') return `${value} kg`
  if (unit === '%') return `${value}%`
  return unit ? `${value} ${unit}` : String(value)
}

function CycleLegend({ bands }: { bands: CycleBandDraw[] }) {
  if (bands.length === 0) return null

  // Ein Eintrag pro Substanz statt pro Zyklus: mehrere Zyklen derselben Substanz
  // teilen sich Farbe und Namen, also auch nur einen Legenden-Punkt. Eine Substanz
  // gilt als gefüllt/hervorgehoben, wenn irgendeiner ihrer Balken es ist.
  const legend = new Map<string, { name: string; color: string; filled: boolean; faded: boolean }>()
  for (const band of bands) {
    const key = `${band.name}|${band.color}`
    const prev = legend.get(key)
    if (!prev) {
      legend.set(key, { name: band.name, color: band.color, filled: band.filled, faded: band.faded })
    } else {
      prev.filled = prev.filled || band.filled
      prev.faded = prev.faded && band.faded
    }
  }
  const items = [...legend.values()]

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px 16px',
      paddingLeft: 12,
      marginTop: 14,
      paddingTop: 12,
      borderTop: '1px solid var(--border)',
    }}>
      {items.map(item => (
        <div
          key={`${item.name}|${item.color}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            opacity: item.faded ? 0.38 : 1,
            transition: 'opacity 0.18s',
          }}
        >
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: item.filled ? item.color : 'transparent',
            border: item.filled ? 'none' : `2px solid ${item.color}`,
            flexShrink: 0,
            boxShadow: item.filled ? `0 0 6px ${item.color}44` : 'none',
          }} />
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {item.name}
          </span>
        </div>
      ))}
    </div>
  )
}

export function MetricChart({
  range,
  metric,
  weights,
  dailyLogs,
  bloodwork,
  cycles,
  ongoing,
  focusId,
}: Props) {
  const rangeStart = dateToTs(range.from)
  const rangeEnd = dateToTs(range.to)

  const series = buildMetricSeries(metric.key, range, weights, dailyLogs, bloodwork)

  const { bands, lanes } = useMemo(() => {
    const substances = [
      ...cycles.map(c => ({ substance: c, filled: true })),
      ...ongoing.map(o => ({ substance: o, filled: false })),
    ]

    const raw = substances.map(({ substance, filled }) => {
      const end = substanceBarEnd(substance)
      const x1 = Math.max(dateToTs(substance.startDate), rangeStart)
      const x2 = Math.min(dateToTs(end), rangeEnd)
      return {
        id: substance.id,
        name: substance.name,
        color: substance.color,
        filled,
        faded: focusId != null && focusId !== substance.id,
        startDate: substance.startDate,
        x1,
        x2,
      }
    }).filter(b => b.x2 > b.x1)

    const packed = assignLanes(raw)
    const lanes = laneCount(packed)

    const bands: CycleBandDraw[] = packed.map(band => ({
      id: band.id,
      name: band.name,
      color: band.color,
      filled: band.filled,
      faded: band.faded,
      startDate: band.startDate,
      x1: band.x1,
      x2: band.x2,
      lane: band.lane,
    }))

    return { bands, lanes }
  }, [cycles, ongoing, focusId, rangeStart, rangeEnd])

  const lineData = useMemo(() => (
    series.map(point => ({
      ts: dateToTs(point.date),
      date: point.date,
      label: fmtDate(point.date),
      value: point.value,
    }))
  ), [series])

  const snapDates = useMemo(() => (
    buildTooltipSnapDates(series.map(point => point.date), bands)
  ), [series, bands])

  const delta = computeDelta(series)
  const latest = series[series.length - 1]
  const xTicks = useMemo(() => buildTimeTicks(range.from, range.to), [range.from, range.to])

  if (lineData.length === 0) {
    return (
      <section style={{ ...panel, padding: '28px 18px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>
          Noch keine {metric.label}-Daten
        </p>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Erfasse Werte mit + Heute
        </p>
      </section>
    )
  }

  return (
    <section style={{ ...panel, padding: '16px 12px 14px 4px' }}>
      <div style={{ paddingLeft: 12, marginBottom: 12 }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-dim)' }}>{metric.label}</p>
        {latest && (
          <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>
            {formatTooltipValue(latest.value, metric.unit)}
          </p>
        )}
        {delta && (
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
            {delta.delta > 0 ? '+' : ''}{formatTooltipValue(delta.delta, metric.unit)} im Zeitraum
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={lineData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={[rangeStart, rangeEnd]}
            ticks={xTicks}
            tickFormatter={ts => fmtDate(format(new Date(ts), 'yyyy-MM-dd'))}
            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="metric"
            tickFormatter={v => formatAxisValue(Number(v), metric.unit)}
            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />

          <CycleBandLayer bands={bands} lanes={lanes} />

          <Tooltip
            cursor={(
              <SnapCursor
                snapDates={snapDates}
                stroke="rgba(0,204,245,0.4)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}
            content={(props) => (
              <MetricTooltip
                {...props}
                bands={bands}
                metric={metric}
                metricData={lineData}
                snapDates={snapDates}
              />
            )}
          />
          <Line
            yAxisId="metric"
            type="monotone"
            dataKey="value"
            name="value"
            stroke={metric.color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#07091a', stroke: metric.color, strokeWidth: 2 }}
            connectNulls={!metric.isLab}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>

      <CycleLegend bands={bands} />
    </section>
  )
}
