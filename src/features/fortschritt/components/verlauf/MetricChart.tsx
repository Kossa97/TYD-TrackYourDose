import { useCallback, useMemo } from 'react'
import type { MouseEvent, TouchEvent } from 'react'
import { format } from 'date-fns'
import { dayToTsSafe, formatDaySafe } from '../../lib/dates'
import {
  CartesianGrid,
  getRelativeCoordinate,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  usePlotArea,
  XAxis,
  YAxis,
} from 'recharts'
import type { CycleSubstance, DateRange, MetricKey, OngoingSubstance } from '../../types'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import { buildMetricSeries, computeDelta } from '../../lib/metrics'
import type { BloodworkEntry, DailyLogEntry, WeightLogEntry } from '../../types'
import { substanceBarEnd } from '../../lib/focusSummary'
import { assignLanes, laneCount } from '../../lib/cycleLanes'
import { CycleBandLayer, type CycleBandDraw } from './CycleBandLayer'
import { ChartPointerProvider, useChartPointerSetter, useChartPointerX } from './ChartPointerContext'
import { FluidCursorLayer } from './FluidCursorLayer'
import { MetricTooltip } from './MetricTooltip'
import { buildTooltipSnapDates } from '../../lib/chartTooltip'
import { panel } from '../../styles'
import { ChartSettingsButton } from './ChartSettingsButton'
import { MetricChipBar } from './MetricChipBar'

interface Props {
  range: DateRange
  metric: MetricDefinition
  availableMetrics: MetricDefinition[]
  metricKey: MetricKey
  pointCounts: Map<string, number>
  onSelectMetric: (key: MetricKey) => void
  weights: WeightLogEntry[]
  dailyLogs: DailyLogEntry[]
  bloodwork: BloodworkEntry[]
  cycles: CycleSubstance[]
  ongoing: OngoingSubstance[]
  focusId: string | null
  onOpenSettings?: () => void
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

function readMousePointerX(event: MouseEvent<SVGGraphicsElement>): number | null {
  const { relativeX } = getRelativeCoordinate(event)
  return Number.isFinite(relativeX) ? relativeX : null
}

function readTouchPointerX(event: TouchEvent<SVGGraphicsElement>): number | null {
  try {
    const coords = getRelativeCoordinate(event)
    const x = coords[0]?.relativeX
    if (x != null && Number.isFinite(x)) return x
  } catch {
    // touchend: changedTouches statt touches
  }

  const target = event.currentTarget as SVGGraphicsElement
  const rect = target.getBoundingClientRect()
  const touch = event.changedTouches[0] ?? event.touches[0]
  if (!touch) return null
  return touch.clientX - rect.left
}

interface ChartBodyProps {
  lineData: Array<{ ts: number; date: string; label: string; value: number }>
  snapDates: string[]
  bands: CycleBandDraw[]
  lanes: number
  metric: MetricDefinition
  rangeStart: number
  rangeEnd: number
  xTicks: number[]
}

function MetricChartBody({
  lineData,
  snapDates,
  bands,
  lanes,
  metric,
  rangeStart,
  rangeEnd,
  xTicks,
}: ChartBodyProps) {
  const pointerX = useChartPointerX()
  const setPointerX = useChartPointerSetter()
  const plotArea = usePlotArea()

  const trackMouse = useCallback((event: MouseEvent<SVGGraphicsElement>) => {
    setPointerX(readMousePointerX(event))
  }, [setPointerX])

  const trackTouch = useCallback((event: TouchEvent<SVGGraphicsElement>) => {
    setPointerX(readTouchPointerX(event))
  }, [setPointerX])

  return (
    <LineChart
      data={lineData}
      margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
      onMouseMove={(_state, event) => trackMouse(event)}
      onClick={(_state, event) => trackMouse(event)}
      onTouchStart={(_state, event) => trackTouch(event)}
      onTouchMove={(_state, event) => trackTouch(event)}
      onTouchEnd={(_state, event) => trackTouch(event)}
    >
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

      <CycleBandLayer bands={bands} lanes={lanes} snapDates={snapDates} />
      <FluidCursorLayer snapDates={snapDates} />

      <Tooltip
        active={pointerX != null}
        position={pointerX != null && plotArea
          ? { x: pointerX, y: plotArea.y + 8 }
          : undefined}
        shared
        cursor={false}
        isAnimationActive={false}
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
  )
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
  availableMetrics,
  metricKey,
  pointCounts,
  onSelectMetric,
  weights,
  dailyLogs,
  bloodwork,
  cycles,
  ongoing,
  focusId,
  onOpenSettings,
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

  const metricBar = (
    <MetricChipBar
      availableMetrics={availableMetrics}
      metricKey={metricKey}
      pointCounts={pointCounts}
      onSelectMetric={onSelectMetric}
    />
  )

  if (lineData.length === 0) {
    return (
      <section style={{ ...panel, padding: '28px 18px', textAlign: 'center', position: 'relative' }}>
        {onOpenSettings && (
          <div style={{ position: 'absolute', top: 14, right: 12 }}>
            <ChartSettingsButton onClick={onOpenSettings} />
          </div>
        )}
        <div style={{ paddingLeft: 12, paddingRight: 12, width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
          {metricBar}
        </div>
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
    <section style={{ ...panel, padding: '16px 12px 14px 4px', position: 'relative' }}>
      {onOpenSettings && (
        <div style={{ position: 'absolute', top: 14, right: 12, zIndex: 2 }}>
          <ChartSettingsButton onClick={onOpenSettings} />
        </div>
      )}
      <div style={{ paddingLeft: 12, marginBottom: 4, paddingRight: onOpenSettings ? 88 : 12 }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-dim)' }}>{metric.label}</p>
        {(latest || delta) && (
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: '2px 6px',
            marginTop: 2,
          }}>
            {latest && (
              <p style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text)', margin: 0 }}>
                {formatTooltipValue(latest.value, metric.unit)}
              </p>
            )}
            {delta && (
              <p style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                margin: 0,
              }}>
                {delta.delta > 0 ? '+' : ''}{formatTooltipValue(delta.delta, metric.unit)} im Zeitraum
              </p>
            )}
          </div>
        )}
      </div>
      <div style={{ width: '100%', paddingLeft: 12, paddingRight: 12, boxSizing: 'border-box' }}>
        {metricBar}
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ChartPointerProvider>
          <MetricChartBody
            lineData={lineData}
            snapDates={snapDates}
            bands={bands}
            lanes={lanes}
            metric={metric}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            xTicks={xTicks}
          />
        </ChartPointerProvider>
      </ResponsiveContainer>

      <CycleLegend bands={bands} />
    </section>
  )
}
