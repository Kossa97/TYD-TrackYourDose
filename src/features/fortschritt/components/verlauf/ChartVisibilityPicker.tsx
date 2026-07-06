import { useState } from 'react'
import type { CycleSubstance } from '../../types'
import { formatDaySafe } from '../../lib/dates'
import {
  groupMemberIds,
  groupVisibilityState,
  type SubstanceCycleGroup,
  type VisibleChartIds,
} from '../../lib/chartVisibility'
import { panel, sectionLabel } from '../../styles'

interface Props {
  groups: SubstanceCycleGroup[]
  visibleIds: VisibleChartIds
  onToggleGroup: (group: SubstanceCycleGroup) => void
  onToggleCycle: (id: string) => void
}

function formatCycleLabel(cycle: CycleSubstance): string {
  const start = formatDaySafe(cycle.startDate)
  const end = cycle.endDate ? formatDaySafe(cycle.endDate) : 'offen'
  const status = cycle.active ? 'aktiv' : 'beendet'
  return `${start} – ${end} · ${status}`
}

function groupChipStyle(color: string, state: 'all' | 'none' | 'partial') {
  if (state === 'all') {
    return {
      background: `${color}22`,
      color,
      border: `1px solid ${color}55`,
    }
  }
  if (state === 'partial') {
    return {
      background: `${color}11`,
      color,
      border: `1px dashed ${color}66`,
    }
  }
  return {
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
  }
}

export function ChartVisibilityPicker({
  groups,
  visibleIds,
  onToggleGroup,
  onToggleCycle,
}: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  if (groups.length === 0) return null

  const visibleCount = groups.reduce((sum, g) => (
    sum + groupMemberIds(g).filter(id => visibleIds.has(id)).length
  ), 0)
  const totalCount = groups.reduce((sum, g) => sum + groupMemberIds(g).length, 0)

  return (
    <section style={{ ...panel, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={sectionLabel}>Anzeigen</p>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          {visibleCount}/{totalCount}
        </span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: expandedKey ? 12 : 0 }}>
        {groups.map(group => {
          const state = groupVisibilityState(group, visibleIds)
          const expanded = expandedKey === group.key
          const hasCycles = group.cycles.length > 0
          const chipStyle = groupChipStyle(group.color, state)

          return (
            <div key={group.key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                type="button"
                onClick={() => onToggleGroup(group)}
                style={{
                  flexShrink: 0,
                  padding: '7px 13px',
                  borderRadius: 99,
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  ...chipStyle,
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  marginRight: 7,
                  background: state === 'none' ? 'transparent' : group.color,
                  border: state === 'none' ? `2px solid ${group.color}` : 'none',
                  verticalAlign: 'middle',
                }} />
                {group.name}
                {state === 'partial' && (
                  <span style={{ marginLeft: 5, opacity: 0.75 }}>···</span>
                )}
              </button>
              {hasCycles && (
                <button
                  type="button"
                  aria-label={`Zyklen von ${group.name}`}
                  onClick={() => setExpandedKey(expanded ? null : group.key)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    border: `1px solid ${expanded ? `${group.color}55` : 'var(--border)'}`,
                    background: expanded ? `${group.color}15` : 'transparent',
                    color: expanded ? group.color : 'var(--text-muted)',
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    cursor: 'pointer',
                    lineHeight: 1,
                  }}
                >
                  {expanded ? '▾' : '▸'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {expandedKey && (() => {
        const group = groups.find(g => g.key === expandedKey)
        if (!group || group.cycles.length === 0) return null
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            paddingTop: 10,
            borderTop: '1px solid var(--border)',
          }}>
            {group.cycles.map(cycle => {
              const checked = visibleIds.has(cycle.id)
              return (
                <label
                  key={cycle.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 12,
                    background: checked ? `${group.color}0d` : 'transparent',
                    border: `1px solid ${checked ? `${group.color}33` : 'var(--border)'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleCycle(cycle.id)}
                    style={{ accentColor: group.color, width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    color: checked ? 'var(--text-dim)' : 'var(--text-muted)',
                  }}>
                    {formatCycleLabel(cycle)}
                  </span>
                </label>
              )
            })}
          </div>
        )
      })()}

      <p style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: 10 }}>
        Substanz antippen = alle Zyklen ein/aus · Pfeil = einzelne Zyklen wählen
      </p>
    </section>
  )
}
