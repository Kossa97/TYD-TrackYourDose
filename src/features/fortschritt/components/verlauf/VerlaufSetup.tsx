import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { CycleSubstance } from '../../types'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import { formatDaySafe } from '../../lib/dates'
import {
  groupVisibilityState,
  partitionCyclesForDisplay,
  type SubstanceCycleGroup,
  type VisibleChartIds,
} from '../../lib/chartVisibility'
import type { MetricKey } from '../../types'
import { panel } from '../../styles'

interface Props {
  groups: SubstanceCycleGroup[]
  visibleIds: VisibleChartIds
  onToggleGroup: (group: SubstanceCycleGroup) => void
  onToggleCycle: (id: string) => void
  availableMetrics: MetricDefinition[]
  metricKey: MetricKey
  pointCounts: Map<string, number>
  onSelectMetric: (key: MetricKey) => void
}

function formatCycleLabel(cycle: CycleSubstance): string {
  const start = formatDaySafe(cycle.startDate)
  const end = cycle.endDate ? formatDaySafe(cycle.endDate) : 'offen'
  return `${start} – ${end}`
}

function CheckRow({
  color,
  checked,
  onToggle,
  title,
  subtitle,
  indent = 28,
}: {
  color: string
  checked: boolean
  onToggle: () => void
  title: string
  subtitle?: string
  indent?: number
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: `8px 10px 8px ${indent}px`,
        borderRadius: 10,
        cursor: 'pointer',
        background: checked ? `${color}0a` : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ accentColor: color, width: 16, height: 16, flexShrink: 0 }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block',
          fontSize: '0.76rem',
          fontWeight: 700,
          color: checked ? 'var(--text-dim)' : 'var(--text-muted)',
        }}>
          {title}
        </span>
        {subtitle && (
          <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        )}
      </span>
    </label>
  )
}

function CycleRow({
  cycle,
  color,
  checked,
  onToggle,
}: {
  cycle: CycleSubstance
  color: string
  checked: boolean
  onToggle: () => void
}) {
  return (
    <CheckRow
      color={color}
      checked={checked}
      onToggle={onToggle}
      title={formatCycleLabel(cycle)}
      subtitle={cycle.active ? 'aktiv' : 'beendet'}
    />
  )
}

function CollapseHeader({
  label,
  count,
  open,
  onToggle,
  indent = 0,
  muted = false,
}: {
  label: string
  count?: number
  open: boolean
  onToggle: () => void
  indent?: number
  muted?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        width: '100%',
        padding: `6px 10px 6px ${10 + indent}px`,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      {open
        ? <ChevronDown size={14} color="var(--text-muted)" />
        : <ChevronRight size={14} color="var(--text-muted)" />}
      <span style={{
        fontSize: muted ? '0.68rem' : '0.74rem',
        fontWeight: muted ? 700 : 800,
        color: muted ? 'var(--text-muted)' : 'var(--text-dim)',
      }}>
        {label}
        {count != null && count > 0 && (
          <span style={{ marginLeft: 6, opacity: 0.65 }}>({count})</span>
        )}
      </span>
    </button>
  )
}

function SubstanceCheckbox({
  state,
  color,
  onToggle,
}: {
  state: 'all' | 'none' | 'partial'
  color: string
  onToggle: () => void
}) {
  return (
    <input
      type="checkbox"
      checked={state === 'all'}
      ref={el => {
        if (el) el.indeterminate = state === 'partial'
      }}
      onChange={onToggle}
      aria-label={state === 'all' ? 'Substanz ausblenden' : 'Substanz einblenden'}
      style={{ accentColor: color, width: 18, height: 18, flexShrink: 0, cursor: 'pointer' }}
    />
  )
}

export function VerlaufSetup({
  groups,
  visibleIds,
  onToggleGroup,
  onToggleCycle,
  availableMetrics,
  metricKey,
  pointCounts,
  onSelectMetric,
}: Props) {
  const [openSubstances, setOpenSubstances] = useState<Set<string>>(() => (
    new Set(groups.map(g => g.key))
  ))
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const keys = new Set<string>()
    for (const g of groups) {
      keys.add(`${g.key}:active`)
    }
    return keys
  })

  const toggleSubstance = (key: string) => {
    setOpenSubstances(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSection = (key: string) => {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const hasCycles = groups.some(g => g.cycles.length > 0 || g.ongoing)

  return (
    <section style={{ ...panel, padding: '16px 16px 14px' }}>
      {hasCycles && (
        <div style={{ marginBottom: 18 }}>
          <p style={{
            fontSize: '0.92rem',
            fontWeight: 800,
            color: 'var(--text-dim)',
            lineHeight: 1.35,
            marginBottom: 12,
          }}>
            Was soll in deinem Verlauf dargestellt werden?
          </p>
          <p style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginBottom: 10,
          }}>
            Substanz an- oder abwählen · Pfeil zum Aufklappen der Zyklen.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {groups.map(group => {
              const substanceOpen = openSubstances.has(group.key)
              const { active, inactive } = partitionCyclesForDisplay(group.cycles)
              const activeKey = `${group.key}:active`
              const inactiveKey = `${group.key}:inactive`
              const activeOpen = openSections.has(activeKey)
              const inactiveOpen = openSections.has(inactiveKey)
              const visibility = groupVisibilityState(group, visibleIds)

              return (
                <div
                  key={group.key}
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${visibility === 'none' ? 'var(--border)' : `${group.color}33`}`,
                    overflow: 'hidden',
                    background: visibility === 'none' ? 'transparent' : `${group.color}06`,
                    opacity: visibility === 'none' ? 0.72 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                    }}
                  >
                    <SubstanceCheckbox
                      state={visibility}
                      color={group.color}
                      onToggle={() => onToggleGroup(group)}
                    />
                    <button
                      type="button"
                      aria-label={substanceOpen ? 'Zyklen zuklappen' : 'Zyklen aufklappen'}
                      aria-expanded={substanceOpen}
                      onClick={() => toggleSubstance(group.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flex: 1,
                        minWidth: 0,
                        padding: 0,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {substanceOpen
                        ? <ChevronDown size={16} color={group.color} />
                        : <ChevronRight size={16} color={group.color} />}
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: group.color,
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        color: group.color,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {group.name}
                      </span>
                    </button>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                      {groupMemberVisibleCount(group, visibleIds)}/{groupMemberIdsCount(group)}
                    </span>
                  </div>

                  {substanceOpen && (
                    <div style={{ paddingBottom: 6 }}>
                      {group.ongoing && (
                        <CheckRow
                          color={group.color}
                          checked={visibleIds.has(group.ongoing.id)}
                          onToggle={() => onToggleCycle(group.ongoing!.id)}
                          title={`seit ${formatDaySafe(group.ongoing.startDate)}`}
                          subtitle="dauerhaft"
                        />
                      )}

                      {active.length > 0 && (
                        <div>
                          <CollapseHeader
                            label="Aktive Zyklen"
                            count={active.length}
                            open={activeOpen}
                            onToggle={() => toggleSection(activeKey)}
                            indent={4}
                            muted
                          />
                          {activeOpen && active.map(cycle => (
                            <CycleRow
                              key={cycle.id}
                              cycle={cycle}
                              color={group.color}
                              checked={visibleIds.has(cycle.id)}
                              onToggle={() => onToggleCycle(cycle.id)}
                            />
                          ))}
                        </div>
                      )}

                      {inactive.length > 0 && (
                        <div>
                          <CollapseHeader
                            label="Beendete Zyklen"
                            count={inactive.length}
                            open={inactiveOpen}
                            onToggle={() => toggleSection(inactiveKey)}
                            indent={4}
                            muted
                          />
                          {inactiveOpen && inactive.map(cycle => (
                            <CycleRow
                              key={cycle.id}
                              cycle={cycle}
                              color={group.color}
                              checked={visibleIds.has(cycle.id)}
                              onToggle={() => onToggleCycle(cycle.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        <p style={{
          fontSize: '0.92rem',
          fontWeight: 800,
          color: 'var(--text-dim)',
          lineHeight: 1.35,
          marginBottom: 12,
        }}>
          Wähle einen Wert, um die Entwicklung zu sehen.
        </p>

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
                onClick={() => onSelectMetric(metric.key)}
                style={{
                  flexShrink: 0,
                  padding: '8px 14px',
                  borderRadius: 99,
                  fontSize: '0.78rem',
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
      </div>
    </section>
  )
}

function groupMemberIdsCount(group: SubstanceCycleGroup): number {
  return group.cycles.length + (group.ongoing ? 1 : 0)
}

function groupMemberVisibleCount(group: SubstanceCycleGroup, visibleIds: VisibleChartIds): number {
  let n = 0
  for (const c of group.cycles) if (visibleIds.has(c.id)) n++
  if (group.ongoing && visibleIds.has(group.ongoing.id)) n++
  return n
}
