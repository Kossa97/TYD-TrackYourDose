import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
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

interface CycleBand {
  id: string
  name: string
  color: string
  filled: boolean
  faded: boolean
  x1: number
  x2: number
  y1: number
  y2: number
}

/** Hintergrund-Achse: Zyklus-Balken unten im Chart, Metrik-Linie darüber */
const BAND_AXIS_MAX = 10
const LANE_HEIGHT = 0.55
const LANE_GAP = 0.1

function fmtDate(d: string) {
  return format(parseISO(`${d}T00:00:00`), 'dd.MM.')
}

function dateToTs(date: string): number {
  return parseISO(`${date}T12:00:00`).getTime()
}

function buildTimeTicks(from: string, to: string, count = 5): number[] {
  const start = dateToTs(from)
  const end = dateToTs(to)
  if (end <= start) return [start]
  const step = (end - start) / Math.max(count - 1, 1)
  return Array.from({ length: count }, (_, i) => Math.round(start + step * i))
}

function CycleLegend({ bands }: { bands: CycleBand[] }) {
  if (bands.length === 0) return null

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
      {bands.map(band => (
        <div
          key={band.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            opacity: band.faded ? 0.38 : 1,
            transition: 'opacity 0.18s',
          }}
        >
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: band.filled ? band.color : 'transparent',
            border: band.filled ? 'none' : `2px solid ${band.color}`,
            flexShrink: 0,
            boxShadow: band.filled ? `0 0 6px ${band.color}44` : 'none',
          }} />
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {band.name}
          </span>
        </div>
      ))}
    </div>
  )
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
  const rangeStart = dateToTs(range.from)
  const rangeEnd = dateToTs(range.to)

  const primarySeries = buildMetricSeries(primary.key, range, weights, dailyLogs, bloodwork)
  const secondarySeries = secondary
    ? buildMetricSeries(secondary.key, range, weights, dailyLogs, bloodwork)
    : []

  const chartData = useMemo(() => {
    const dateSet = new Set<string>()
    primarySeries.forEach(p => dateSet.add(p.date))
    secondarySeries.forEach(p => dateSet.add(p.date))
    return Array.from(dateSet).sort().map(date => ({
      ts: dateToTs(date),
      date,
      label: fmtDate(date),
      primary: primarySeries.find(p => p.date === date)?.value ?? null,
      secondary: secondarySeries.find(p => p.date === date)?.value ?? null,
    }))
  }, [primarySeries, secondarySeries])

  const bands = useMemo((): CycleBand[] => {
    const substances = [
      ...cycles.map(c => ({ substance: c, filled: true })),
      ...ongoing.map(o => ({ substance: o, filled: false })),
    ]

    return substances.map(({ substance, filled }, lane) => {
      const end = substanceBarEnd(substance)
      const x1 = Math.max(dateToTs(substance.startDate), rangeStart)
      const x2 = Math.min(dateToTs(end), rangeEnd)
      const y1 = lane * (LANE_HEIGHT + LANE_GAP)
      const y2 = y1 + LANE_HEIGHT
      return {
        id: substance.id,
        name: substance.name,
        color: substance.color,
        filled,
        faded: focusId != null && focusId !== substance.id,
        x1,
        x2,
        y1,
        y2,
      }
    }).filter(b => b.x2 > b.x1)
  }, [cycles, ongoing, focusId, rangeStart, rangeEnd])

  const delta = computeDelta(primarySeries)
  const latest = primarySeries[primarySeries.length - 1]
  const xTicks = useMemo(() => buildTimeTicks(range.from, range.to), [range.from, range.to])

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
    <section style={{ ...panel, padding: '16px 12px 14px 4px' }}>
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
        {secondary && (
          <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: primary.color }} />
              {primary.label}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 14, height: 0, borderTop: `2px dashed ${secondary.color}` }} />
              {secondary.label}
            </span>
          </p>
        )}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: secondary ? 36 : 12, bottom: 4, left: 0 }}>
          <YAxis yAxisId="bands" domain={[0, BAND_AXIS_MAX]} hide />

          {bands.map(band => (
            <ReferenceArea
              key={band.id}
              x1={band.x1}
              x2={band.x2}
              y1={band.y1}
              y2={band.y2}
              yAxisId="bands"
              fill={band.color}
              fillOpacity={band.faded ? 0.05 : band.filled ? 0.2 : 0.08}
              stroke={band.filled ? 'none' : band.color}
              strokeOpacity={band.faded ? 0.15 : 0.35}
              strokeWidth={band.filled ? 0 : 1}
              strokeDasharray={band.filled ? undefined : '4 3'}
            />
          ))}

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
            labelFormatter={ts => fmtDate(format(new Date(Number(ts)), 'yyyy-MM-dd'))}
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
        </LineChart>
      </ResponsiveContainer>

      <CycleLegend bands={bands} />
    </section>
  )
}
