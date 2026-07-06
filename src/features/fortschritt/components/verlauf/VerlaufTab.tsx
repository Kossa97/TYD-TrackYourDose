import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { FortschrittOverviewState, MetricKey, VerlaufNavigation } from '../../types'
import { CHART_METRIC_KEYS, isChartMetricKey, isWellnessMetricKey } from '../../constants'
import { buildMetricSeries } from '../../lib/metrics'
import { buildAvailableMetrics, normalizeMetricKey } from '../../lib/metricDefinitions'
import { allSubstances, defaultFocusSubstanceId } from '../../lib/focusSummary'
import {
  filterCyclesByVisibility,
  filterOngoingByVisibility,
} from '../../lib/chartVisibility'
import { useChartVisibility } from '../../hooks/useChartVisibility'
import {
  RANGE_CHIPS,
  rangeFromChip,
  focusRangeForSubstance,
  type RangeChipKey,
} from '../../lib/verlaufRange'
import { panel } from '../../styles'
import { VerlaufSetup } from './VerlaufSetup'
import { VerlaufSetupSheet } from './VerlaufSetupSheet'
import { ChartSettingsButton } from './ChartSettingsButton'
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
  const [setupOpen, setSetupOpen] = useState(false)

  const {
    groups: visibilityGroups,
    visibleIds,
    toggleGroup,
    toggleCycle,
    showIds,
  } = useChartVisibility(state.cycleSubstances, state.ongoingSubstances)

  const visibleCycles = useMemo(
    () => filterCyclesByVisibility(state.cycleSubstances, visibleIds),
    [state.cycleSubstances, visibleIds],
  )
  const visibleOngoing = useMemo(
    () => filterOngoingByVisibility(state.ongoingSubstances, visibleIds),
    [state.ongoingSubstances, visibleIds],
  )

  useEffect(() => {
    if (!pendingNav) return
    if (pendingNav.focusSubstanceId) {
      showIds([pendingNav.focusSubstanceId])
      setFocusId(pendingNav.focusSubstanceId)
    } else if (pendingNav.metric && isWellnessMetricKey(pendingNav.metric)) {
      const id = defaultFocusSubstanceId(visibleCycles, visibleOngoing)
      if (id) setFocusId(id)
    }
    if (pendingNav.metric && isChartMetricKey(normalizeMetricKey(pendingNav.metric))) {
      setMetricKey(normalizeMetricKey(pendingNav.metric))
    }
    onPendingConsumed()
  }, [pendingNav, onPendingConsumed, showIds, visibleCycles, visibleOngoing])

  useEffect(() => {
    if (focusId && !visibleIds.has(focusId)) {
      setFocusId(null)
    }
  }, [focusId, visibleIds])

  const baseRange = state.fullRange
  const chipRange = useMemo(() => rangeFromChip(rangeChip, baseRange), [rangeChip, baseRange])

  const substances = allSubstances(visibleCycles, visibleOngoing)
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

  const hasChartData = visibleCycles.length > 0 || visibleOngoing.length > 0
  const openSetup = () => setSetupOpen(true)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {(hasChartData || visibilityGroups.length > 0) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '0 4px',
        }}>
          <p style={{
            fontSize: '0.62rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            Zeitraum
          </p>
          <div style={{ display: 'flex', gap: 4, flex: 1, justifyContent: 'flex-end', maxWidth: 240 }}>
            {RANGE_CHIPS.map(chip => {
              const on = rangeChip === chip.key
              return (
                <button
                  key={chip.key}
                  type="button"
                  disabled={!!focused || !hasChartData}
                  onClick={() => setRangeChip(chip.key)}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 10,
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    cursor: focused || !hasChartData ? 'not-allowed' : 'pointer',
                    opacity: focused || !hasChartData ? 0.45 : 1,
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
      )}

      {selectedMetric && hasChartData && (
        <MetricChart
          range={chartRange}
          metric={selectedMetric}
          weights={state.weightLogs}
          dailyLogs={state.dailyLogs}
          bloodwork={state.bloodwork}
          cycles={visibleCycles}
          ongoing={visibleOngoing}
          focusId={focusId}
          onOpenSettings={openSetup}
        />
      )}

      {!hasChartData && (
        <section style={{
          ...panel,
          padding: '32px 18px',
          textAlign: 'center',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 14, right: 12 }}>
            <ChartSettingsButton onClick={openSetup} />
          </div>
          <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>
            Chart noch leer
          </p>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', maxWidth: 260, margin: '0 auto' }}>
            Tippe oben rechts auf Einstellen, um Substanzen und Zyklen für den Verlauf zu wählen.
          </p>
        </section>
      )}

      {hasChartData && (
        <EventStrip range={chartRange} photos={state.photos} bloodwork={state.bloodwork} />
      )}

      {hasChartData && (
        <SubstanceLane
          cycles={visibleCycles}
          ongoing={visibleOngoing}
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

      {focused && (
        <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>
          Zeitraum folgt Fokus-Substanz · Wellness unten antippen
        </p>
      )}

      <VerlaufSetupSheet open={setupOpen} onClose={() => setSetupOpen(false)}>
        <VerlaufSetup
          embedded
          groups={visibilityGroups}
          visibleIds={visibleIds}
          onToggleGroup={toggleGroup}
          onToggleCycle={toggleCycle}
          availableMetrics={availableMetrics}
          metricKey={metricKey}
          pointCounts={pointCounts}
          onSelectMetric={selectMetric}
        />
      </VerlaufSetupSheet>
    </div>
  )
}
