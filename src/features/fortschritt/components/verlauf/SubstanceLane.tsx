import type { ActiveSubstance, CycleSubstance, DailyLogEntry, DateRange, DoseLogEntry, OngoingSubstance, WeightLogEntry, BloodworkEntry } from '../../types'
import { barPosition, formatRangeLabel } from '../../lib/verlaufRange'
import { substanceBarEnd, buildFocusSummary } from '../../lib/focusSummary'
import { substanceDayCount } from '../../lib/substances'
import { panel, sectionLabel } from '../../styles'
import { FocusSummaryCard } from './FocusSummaryCard'

interface Props {
  cycles: CycleSubstance[]
  ongoing: OngoingSubstance[]
  range: DateRange
  focusId: string | null
  weightLogs: WeightLogEntry[]
  dailyLogs: DailyLogEntry[]
  bloodwork: BloodworkEntry[]
  doseLogs: DoseLogEntry[]
  peptideNames: Map<string, string>
  onSelect: (id: string | null) => void
}

export function SubstanceLane({
  cycles,
  ongoing,
  range,
  focusId,
  weightLogs,
  dailyLogs,
  bloodwork,
  doseLogs,
  peptideNames,
  onSelect,
}: Props) {
  const all = [
    ...cycles.map(c => ({ substance: c as ActiveSubstance, filled: true })),
    ...ongoing.map(o => ({ substance: o, filled: false })),
  ]
  const todayPos = barPosition(range.to, range.to, range).left

  const handleTap = (id: string) => {
    onSelect(focusId === id ? null : id)
  }

  return (
    <section style={{ ...panel, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={sectionLabel}>Substanzen</p>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>{all.length}</span>
      </div>
      <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
        {formatRangeLabel(range)}
      </p>

      <div style={{ position: 'relative' }}>
        {all.map(({ substance, filled }) => {
          const end = substanceBarEnd(substance)
          const pos = barPosition(substance.startDate, end, range)
          const expanded = focusId === substance.id
          const faded = focusId != null && !expanded
          const summary = expanded
            ? buildFocusSummary(substance, range, weightLogs, dailyLogs, bloodwork, doseLogs, peptideNames)
            : null

          return (
            <div
              key={substance.id}
              style={{
                marginBottom: 10,
                opacity: faded ? 0.35 : 1,
                transition: 'opacity 0.18s',
              }}
            >
              <button
                type="button"
                onClick={() => handleTap(substance.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: substance.color,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {substance.name}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                    {filled ? `Tag ${substanceDayCount(substance)}` : `seit ${substanceDayCount(substance)}d`}
                  </span>
                </div>
                <div style={{ position: 'relative', height: 10, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
                  <div style={{
                    position: 'absolute',
                    left: `${pos.left}%`,
                    width: `${pos.width}%`,
                    top: 0,
                    bottom: 0,
                    borderRadius: 6,
                    background: filled ? substance.color : 'transparent',
                    border: filled ? 'none' : `2px solid ${substance.color}`,
                    opacity: expanded ? 1 : 0.75,
                    boxShadow: expanded ? `0 0 12px ${substance.color}55` : 'none',
                  }} />
                </div>
              </button>

              {expanded && summary && (
                <FocusSummaryCard summary={summary} inline />
              )}
            </div>
          )
        })}

        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${todayPos}%`,
          width: 1,
          background: 'rgba(0,204,245,0.35)',
          pointerEvents: 'none',
        }} />
      </div>
    </section>
  )
}
