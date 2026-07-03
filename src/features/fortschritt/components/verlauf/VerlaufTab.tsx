import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { FortschrittOverviewState, MetricKey, VerlaufNavigation } from '../../types'
import { CHART_METRIC_KEYS, isChartMetricKey, isWellnessMetricKey } from '../../constants'
import { buildMetricSeries } from '../../lib/metrics'
import { buildAvailableMetrics, normalizeMetricKey } from '../../lib/metricDefinitions'
import { allSubstances, defaultFocusSubstanceId } from '../../lib/focusSummary'
import {
  RANGE_CHIPS,
  rangeFromChip,
  focusRangeForSubstance,
  type RangeChipKey,
} from '../../lib/verlaufRange'
import { SubstanceLane } from './SubstanceLane'
import { MetricChart } from './MetricChart'
import { EventStrip } from './EventStrip'

interface Props {
  state: FortschrittOverviewState
  pendingNav: VerlaufNavigation | null
  onPendingConsumed: () => void
}


export function VerlaufTab({ state, pendingNav, onPendingConsumed }: Props) {
  const [rangeChip, setRangeChip] = useState<RangeChipKey>('alles')
  const [metricKey, setMetricKey] = useState<MetricKey>('weight')
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    if (!pendingNav) return
    if (pendingNav.focusSubstanceId) {
      setFocusId(pendingNav.focusSubstanceId)
    } else if (pendingNav.metric && isWellnessMetricKey(pendingNav.metric)) {
      const id = defaultFocusSubstanceId(state.cycleSubstances, state.ongoingSubstances)
      if (id) setFocusId(id)
    }
    if (pendingNav.metric && isChartMetricKey(normalizeMetricKey(pendingNav.metric))) {
      setMetricKey(normalizeMetricKey(pendingNav.metric))
    }
    onPendingConsumed()
  }, [pendingNav, onPendingConsumed, state.cycleSubstances, state.ongoingSubstances])

  const baseRange = state.range
  const chipRange = useMemo(() => rangeFromChip(rangeChip, baseRange), [rangeChip, baseRange])

  const substances = allSubstances(state.cycleSubstances, state.ongoingSubstances)
  const focused = substances.find(s => s.id === focusId) ?? null

  const chartRange = useMemo(() => {
    if (focused) return focusRangeForSubstance(focused)
    return chipRange
  }, [focused, chipRange])

  const pointCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const key of CHART_METRIC_KEYS) {
      counts.set(key, buildMetricSeries(key, baseRange, state.weightLogs, state.dailyLogs, state.bloodwork).length)
    }
    for (const marker of [...new Set(state.bloodwork.map(b => b.marker))]) {
      counts.set(marker, buildMetricSeries(marker, baseRange, state.weightLogs, state.dailyLogs, state.bloodwork).length)
    }
    return counts
  }, [baseRange, state])

  const labUnits = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of state.bloodwork) m.set(b.marker, b.unit)
    return m
  }, [state.bloodwork])

  const availableMetrics = useMemo(
    () => buildAvailableMetrics(pointCounts, [...new Set(state.bloodwork.map(b => b.marker))], labUnits),
    [pointCounts, state.bloodwork, labUnits],
  )

  const selectedMetric = availableMetrics.find(m => m.key === metricKey)
    ?? availableMetrics.find(m => m.key === 'weight')
    ?? availableMetrics[0]

  useEffect(() => {
    if (availableMetrics.length === 0) return
    if (!availableMetrics.some(m => m.key === metricKey)) {
      setMetricKey(availableMetrics.find(m => m.key === 'weight')?.key ?? availableMetrics[0].key)
    }
  }, [availableMetrics, metricKey])

  const selectMetric = (key: MetricKey) => {
    const count = pointCounts.get(key) ?? 0
    const metric = availableMetrics.find(m => m.key === key)
    if (!metric || count === 0) return
    if (metric.isLab && count < 2) {
      toast.error('Mindestens 2 Messungen für den Verlauf nötig')
      return
    }
    setMetricKey(key)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 10,
        }}>
          <p style={{
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            flexShrink: 0,
          }}>
            Metrik
          </p>
          <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'flex-end', maxWidth: 220 }}>
            {RANGE_CHIPS.map(chip => {
              const on = rangeChip === chip.key
              return (
                <button
                  key={chip.key}
                  type="button"
                  disabled={!!focused}
                  onClick={() => setRangeChip(chip.key)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 10,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    cursor: focused ? 'not-allowed' : 'pointer',
                    opacity: focused ? 0.45 : 1,
                    background: on ? 'var(--accent-weak)' : 'transparent',
                    color: on ? 'var(--accent)' : 'var(--text-muted)',
                    border: on ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  }}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {availableMetrics.map(metric => {
            const count = pointCounts.get(metric.key) ?? 0
            const disabled = metric.isLab ? count < 2 : count === 0
            const active = metricKey === metric.key
            return (
              <button
                key={metric.key}
                type="button"
                disabled={disabled}
                onClick={() => selectMetric(metric.key)}
                style={{
                  flexShrink: 0,
                  padding: '7px 13px',
                  borderRadius: 99,
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.35 : 1,
                  background: active ? `${metric.color}22` : 'transparent',
                  color: active ? metric.color : 'var(--text-muted)',
                  border: `1px solid ${active ? `${metric.color}55` : 'var(--border)'}`,
                }}
              >
                {metric.label}
              </button>
            )
          })}
        </div>
        <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: 6 }}>
          {focused
            ? 'Zeitraum folgt Fokus-Substanz · Chips deaktiviert'
            : 'Eine Metrik · eigene Y-Achse · Wellness per Substanz antippen'}
        </p>
      </div>

      {selectedMetric && (
        <MetricChart
          range={chartRange}
          metric={selectedMetric}
          weights={state.weightLogs}
          dailyLogs={state.dailyLogs}
          bloodwork={state.bloodwork}
          cycles={state.cycleSubstances}
          ongoing={state.ongoingSubstances}
          focusId={focusId}
        />
      )}

      <EventStrip range={chartRange} photos={state.photos} bloodwork={state.bloodwork} />

      {(state.cycleSubstances.length > 0 || state.ongoingSubstances.length > 0) && (
        <SubstanceLane
          cycles={state.cycleSubstances}
          ongoing={state.ongoingSubstances}
          range={chartRange}
          focusId={focusId}
          weightLogs={state.weightLogs}
          dailyLogs={state.dailyLogs}
          bloodwork={state.bloodwork}
          doseLogs={state.doseLogs}
          peptideNames={state.peptideNames}
          onSelect={setFocusId}
        />
      )}
    </div>
  )
}
