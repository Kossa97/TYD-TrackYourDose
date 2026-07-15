import { forwardRef, useImperativeHandle, useMemo } from 'react'
import { format } from 'date-fns'
import { dayToTsSafe, formatDaySafe } from '../../lib/dates'
import {
  CartesianGrid,
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
import {
  ChartPointerProvider,
  useChartPointerSetter,
  useChartPointerX,
} from './ChartPointerContext'
import { FluidCursorLayer } from './FluidCursorLayer'
import { MetricTooltip } from './MetricTooltip'
import { buildTooltipSnapDates } from '../../lib/chartTooltip'
import { panel } from '../../styles'
import { ChartSettingsButton } from './ChartSettingsButton'
import { ChartWindowToggle } from './ChartWindowToggle'
import { JumpToNowButton } from './JumpToNowButton'
import { MetricChipBar } from './MetricChipBar'
import { rangeBounds, windowMsFor, type ChartWindowKey } from '../../lib/chartWindow'
import { useChartPan, type ChartPanHandle } from '../../hooks/useChartPan'
import { pickChartTimeTicks } from '../../../../components/liveCycleChart/chartMath'

const MIN_PX_PER_TICK = 52

interface Props {
  /** Voller Datenbereich — das Fenster schneidet daraus zu. */
  dataRange: DateRange
  windowKey: ChartWindowKey
  onWindowChange: (key: ChartWindowKey) => void
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

export type { ChartPanHandle }

function fmtDate(d: string) {
  return formatDaySafe(d)
}

function dateToTs(date: string): number {
  return dayToTsSafe(date, 12) ?? Date.now()
}

/**
 * Y-Tick zweizeilig: Zahl oben, Einheit darunter. Nebeneinander sprengten lange
 * Lab-Einheiten wie "mIU/L" die Achsenbreite — und eine mitwachsende Achse
 * (width="auto") verschiebt bei jedem Metrik-Wechsel die ganze Plot-Fläche.
 */
function MetricAxisTick({ x = 0, y = 0, payload, unit }: {
  x?: number
  y?: number
  payload?: { value: number | string }
  unit: string
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      fill="var(--text-muted)"
      fontSize={10}
      fontWeight={700}
    >
      <tspan x={x} dy={unit ? '-0.1em' : '0.32em'}>{payload?.value}</tspan>
      {unit && <tspan x={x} dy="1.05em" fillOpacity={0.72}>{unit}</tspan>}
    </text>
  )
}

function formatTooltipValue(value: number, unit: string): string {
  if (unit === 'kg') return `${value} kg`
  if (unit === '%') return `${value}%`
  return unit ? `${value} ${unit}` : String(value)
}

interface ChartBodyProps {
  lineData: Array<{ ts: number; date: string; label: string; value: number }>
  snapDates: string[]
  bands: CycleBandDraw[]
  lanes: number
  metric: MetricDefinition
  viewStart: number
  viewEnd: number
}

function MetricChartBody({
  lineData,
  snapDates,
  bands,
  lanes,
  metric,
  viewStart,
  viewEnd,
}: ChartBodyProps) {
  const pointerX = useChartPointerX()
  const plotArea = usePlotArea()

  // Kalendertage im Raster — wandern beim Wischen mit der Kurve.
  const xTicks = useMemo(
    () => pickChartTimeTicks(viewStart, viewEnd, plotArea?.width ?? 300, MIN_PX_PER_TICK),
    [viewStart, viewEnd, plotArea?.width],
  )

  return (
    <LineChart data={lineData} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
      <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
      <XAxis
        dataKey="ts"
        type="number"
        domain={[viewStart, viewEnd]}
        allowDataOverflow
        ticks={xTicks}
        tickFormatter={ts => fmtDate(format(new Date(ts), 'yyyy-MM-dd'))}
        tick={{ fill: 'var(--text-muted)', fontSize: 10, fontWeight: 700 }}
        tickLine={false}
        axisLine={false}
      />
      {/* Feste Breite: eine mitwachsende Achse verschiebt die Plot-Fläche. */}
      <YAxis
        yAxisId="metric"
        tick={<MetricAxisTick unit={metric.unit} />}
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

const MetricChartInner = forwardRef<ChartPanHandle, Props>(
function MetricChartInner({
  dataRange,
  windowKey,
  onWindowChange,
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
}, ref) {
  const setPointerX = useChartPointerSetter()
  const { start: dataStart, now } = useMemo(() => rangeBounds(dataRange), [dataRange])
  const windowMs = windowMsFor(windowKey)

  const {
    wrapRef, viewStart, viewEnd, showJetzt, handlers, jumpToNow, jumpToTs,
  } = useChartPan({ dataStart, now, windowMs, onPointerX: setPointerX })

  useImperativeHandle(ref, () => ({ jumpToNow, jumpToTs }), [jumpToNow, jumpToTs])

  // Serie über den vollen Bereich — die Domain schneidet die Anzeige zu.
  const series = buildMetricSeries(metric.key, dataRange, weights, dailyLogs, bloodwork)

  const { bands, lanes } = useMemo(() => {
    const substances = [
      ...cycles.map(c => ({ substance: c, filled: true })),
      ...ongoing.map(o => ({ substance: o, filled: false })),
    ]

    // Zeilen über die gesamte Historie packen, nicht über das Sichtfenster: Die
    // Balkenhöhe hängt an der Zeilenzahl, also würde jeder aus dem Fenster
    // gewanderte Zyklus die Geometrie der übrigen verschieben.
    const all = substances.map(({ substance, filled }) => {
      const startTs = dateToTs(substance.startDate)
      return {
        id: substance.id,
        name: substance.name,
        color: substance.color,
        filled,
        faded: focusId != null && focusId !== substance.id,
        startDate: substance.startDate,
        startTs,
        x1: startTs,
        x2: dateToTs(substanceBarEnd(substance)),
      }
    })

    const packed = assignLanes(all)
    const lanes = laneCount(packed)

    // Erst fürs Zeichnen aufs Fenster klemmen — Zeile und Zeilenzahl bleiben global.
    const bands: CycleBandDraw[] = packed.map(band => ({
      id: band.id,
      name: band.name,
      color: band.color,
      filled: band.filled,
      faded: band.faded,
      startDate: band.startDate,
      startVisible: band.startTs >= viewStart && band.startTs <= viewEnd,
      x1: Math.max(band.x1, viewStart),
      x2: Math.min(band.x2, viewEnd),
      lane: band.lane,
    })).filter(b => b.x2 > b.x1)

    return { bands, lanes }
  }, [cycles, ongoing, focusId, viewStart, viewEnd])

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
      <div style={{
        position: 'absolute', top: 14, right: 12, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <ChartWindowToggle value={windowKey} onChange={onWindowChange} />
        {onOpenSettings && <ChartSettingsButton onClick={onOpenSettings} />}
      </div>

      <div style={{ paddingLeft: 12, marginBottom: 4, paddingRight: 150 }}>
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

      <div
        ref={wrapRef}
        style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none', cursor: 'crosshair' }}
        {...handlers}
      >
        <ResponsiveContainer width="100%" height={280}>
          <MetricChartBody
            lineData={lineData}
            snapDates={snapDates}
            bands={bands}
            lanes={lanes}
            metric={metric}
            viewStart={viewStart}
            viewEnd={viewEnd}
          />
        </ResponsiveContainer>
        {showJetzt && <JumpToNowButton onClick={jumpToNow} />}
      </div>

      <CycleLegend bands={bands} />
    </section>
  )
})

export const MetricChart = forwardRef<ChartPanHandle, Props>(
function MetricChart(props, ref) {
  // Der Gesten-Wrapper muss den Pointer-Setter erreichen → Provider liegt außen.
  return (
    <ChartPointerProvider>
      <MetricChartInner {...props} ref={ref} />
    </ChartPointerProvider>
  )
})
