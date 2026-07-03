import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { FortschrittOverviewState, MetricKey, VerlaufNavigation } from '../../types'
import { buildMetricSeries } from '../../lib/metrics'
import { buildAvailableMetrics, normalizeMetricKey, type MetricDefinition } from '../../lib/metricDefinitions'
import { allSubstances, buildFocusSummary } from '../../lib/focusSummary'
import {
  RANGE_CHIPS,
  rangeFromChip,
  focusRangeForSubstance,
  type RangeChipKey,
} from '../../lib/verlaufRange'
import { SubstanceLane } from './SubstanceLane'
import { MetricChart } from './MetricChart'
import { EventStrip } from './EventStrip'
import { FocusSummaryCard } from './FocusSummaryCard'

interface Props {
  state: FortschrittOverviewState
  pendingNav: VerlaufNavigation | null
  onPendingConsumed: () => void
}

const MAX_METRICS = 2

export function VerlaufTab({ state, pendingNav, onPendingConsumed }: Props) {
  const [rangeChip, setRangeChip] = useState<RangeChipKey>('alles')
  const [primaryKey, setPrimaryKey] = useState<MetricKey>('weight')
  const [secondaryKey, setSecondaryKey] = useState<MetricKey | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)

  useEffect(() => {
    if (!pendingNav) return
    if (pendingNav.metric) setPrimaryKey(normalizeMetricKey(pendingNav.metric))
    if (pendingNav.focusSubstanceId) setFocusId(pendingNav.focusSubstanceId)
    onPendingConsumed()
  }, [pendingNav, onPendingConsumed])

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
    const keys: MetricKey[] = ['weight', 'energie', 'schlaf', 'wohlbefinden', 'libido', 'body_fat']
    for (const key of keys) {
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

  const primary = availableMetrics.find(m => m.key === primaryKey) ?? availableMetrics.find(m => m.key === 'weight') ?? availableMetrics[0]
  const secondary = secondaryKey ? availableMetrics.find(m => m.key === secondaryKey) ?? null : null

  const toggleMetric = (key: MetricKey) => {
    const count = pointCounts.get(key) ?? 0
    const metric = availableMetrics.find(m => m.key === key)
    if (!metric || count === 0) return
    if (metric.isLab && count < 2) {
      toast.error('Mindestens 2 Messungen für den Verlauf nötig')
      return
    }

    if (primaryKey === key) {
      if (secondaryKey) {
        setPrimaryKey(secondaryKey)
        setSecondaryKey(null)
      }
      return
    }
    if (secondaryKey === key) {
      setSecondaryKey(null)
      return
    }
    if (!secondaryKey) {
      setSecondaryKey(key)
      return
    }
    setSecondaryKey(key)
  }

  const focusSummary = focused
    ? buildFocusSummary(
      focused,
      chartRange,
      state.weightLogs,
      state.dailyLogs,
      state.bloodwork,
      state.doseLogs,
      state.peptideNames,
    )
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6 }}>
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
                padding: '8px 0',
                borderRadius: 12,
                fontSize: '0.76rem',
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

      {focusSummary && <FocusSummaryCard summary={focusSummary} />}

      {(state.cycleSubstances.length > 0 || state.ongoingSubstances.length > 0) && (
        <SubstanceLane
          cycles={state.cycleSubstances}
          ongoing={state.ongoingSubstances}
          range={chartRange}
          focusId={focusId}
          onSelect={setFocusId}
          onClearFocus={() => setFocusId(null)}
        />
      )}

      <div>
        <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
          Metrik
        </p>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
          {availableMetrics.map(metric => {
            const count = pointCounts.get(metric.key) ?? 0
            const disabled = metric.isLab ? count < 2 : count === 0
            const active = primaryKey === metric.key || secondaryKey === metric.key
            return (
              <button
                key={metric.key}
                type="button"
                disabled={disabled}
                onClick={() => toggleMetric(metric.key)}
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
          Max. 2 Metriken · Tap wechselt Auswahl
        </p>
      </div>

      {primary && (
        <MetricChart
          range={chartRange}
          primary={primary}
          secondary={secondary}
          weights={state.weightLogs}
          dailyLogs={state.dailyLogs}
          bloodwork={state.bloodwork}
          cycles={state.cycleSubstances}
          ongoing={state.ongoingSubstances}
          focusId={focusId}
        />
      )}

      <EventStrip range={chartRange} photos={state.photos} bloodwork={state.bloodwork} />
    </div>
  )
}
