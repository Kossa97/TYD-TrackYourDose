import { format, parseISO } from 'date-fns'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CycleSubstance, DateRange, MetricKey, OngoingSubstance } from '../../types'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import { buildMetricSeries, computeDelta } from '../../lib/metrics'
import type { BloodworkEntry, DailyLogEntry, WeightLogEntry } from '../../types'
import { substanceBarEnd } from '../../lib/focusSummary'
import { panel } from '../../styles'

interface Props {
  range: DateRange
  primary: MetricDefinition
  secondary: MetricDefinition | null
  weights: WeightLogEntry[]
  dailyLogs: DailyLogEntry[]
  bloodwork: BloodworkEntry[]
  cycles: CycleSubstance[]
  ongoing: OngoingSubstance[]
  focusId: string | null
}

function fmtDate(d: string) {
  return format(parseISO(`${d}T00:00:00`), 'dd.MM.')
}

export function MetricChart({
  range,
  primary,
  secondary,
  weights,
  dailyLogs,
  bloodwork,
  cycles,
  ongoing,
  focusId,
}: Props) {
  const primarySeries = buildMetricSeries(primary.key, range, weights, dailyLogs, bloodwork)
  const secondarySeries = secondary
    ? buildMetricSeries(secondary.key, range, weights, dailyLogs, bloodwork)
    : []

  const dateSet = new Set<string>()
  primarySeries.forEach(p => dateSet.add(p.date))
  secondarySeries.forEach(p => dateSet.add(p.date))
  const chartData = Array.from(dateSet).sort().map(date => ({
    date,
    label: fmtDate(date),
    primary: primarySeries.find(p => p.date === date)?.value ?? null,
    secondary: secondarySeries.find(p => p.date === date)?.value ?? null,
  }))

  const delta = computeDelta(primarySeries)
  const latest = primarySeries[primarySeries.length - 1]

  const bands = [...cycles, ...ongoing].map(s => ({
    id: s.id,
    name: s.name,
    color: s.color,
    x1: s.startDate,
    x2: substanceBarEnd(s),
    faded: focusId != null && focusId !== s.id,
  }))

  if (chartData.length === 0) {
    return (
      <section style={{ ...panel, padding: '28px 18px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>
          Noch keine {primary.label}-Daten
        </p>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          Erfasse Werte mit + Heute
        </p>
      </section>
    )
  }

  return (
    <section style={{ ...panel, padding: '16px 12px 12px 4px' }}>
      <div style={{ paddingLeft: 12, marginBottom: 12 }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-dim)' }}>{primary.label}</p>
        {latest && (
          <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', marginTop: 2 }}>
            {latest.value}{primary.unit === 'kg' ? ' kg' : primary.unit === '/10' ? '/10' : primary.unit ? ` ${primary.unit}` : ''}
          </p>
        )}
        {delta && (
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
            {delta.delta > 0 ? '+' : ''}{delta.delta}{primary.unit === 'kg' ? ' kg' : primary.unit === '/10' ? '' : primary.unit ? ` ${primary.unit}` : ''} im Zeitraum
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 8, right: secondary ? 36 : 12, bottom: 0, left: 0 }}>
          {bands.map(band => (
            <ReferenceArea
              key={band.id}
              x1={band.x1}
              x2={band.x2}
              fill={band.color}
              fillOpacity={band.faded ? 0.03 : 0.08}
              strokeOpacity={0}
              label={band.faded ? undefined : { value: band.name, position: 'insideTopLeft', fontSize: 8, fill: band.color, opacity: 0.6 }}
            />
          ))}
          <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="left"
            tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          {secondary && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
          )}
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 11, fontWeight: 700 }}
            formatter={(value, name) => {
              const label = name === 'primary' ? primary.label : secondary?.label ?? String(name)
              return [value ?? '—', label]
            }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="primary"
            name="primary"
            stroke={primary.color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#07091a', stroke: primary.color, strokeWidth: 2 }}
            connectNulls={!primary.isLab}
            isAnimationActive={false}
          />
          {secondary && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="secondary"
              name="secondary"
              stroke={secondary.color}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: '#07091a', stroke: secondary.color, strokeWidth: 2 }}
              connectNulls={!secondary.isLab}
              isAnimationActive={false}
            />
          )}
          {secondary && <Legend wrapperStyle={{ fontSize: 10, fontWeight: 700 }} />}
        </LineChart>
      </ResponsiveContainer>
    </section>
  )
}
