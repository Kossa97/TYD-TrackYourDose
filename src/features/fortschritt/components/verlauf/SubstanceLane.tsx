import { format, parseISO } from 'date-fns'
import type { ActiveSubstance, CycleSubstance, DateRange, OngoingSubstance } from '../../types'
import { barPosition, formatRangeLabel } from '../../lib/verlaufRange'
import { substanceBarEnd } from '../../lib/focusSummary'
import { substanceDayCount } from '../../lib/substances'
import { panel, sectionLabel } from '../../styles'

interface Props {
  cycles: CycleSubstance[]
  ongoing: OngoingSubstance[]
  range: DateRange
  focusId: string | null
  onSelect: (id: string) => void
  onClearFocus: () => void
}

export function SubstanceLane({ cycles, ongoing, range, focusId, onSelect, onClearFocus }: Props) {
  const all = [...cycles.map(c => ({ substance: c as ActiveSubstance, filled: true })), ...ongoing.map(o => ({ substance: o, filled: false }))]
  const todayPos = barPosition(range.to, range.to, range).left

  return (
    <section style={{ ...panel, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={sectionLabel}>Substanzen</p>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>{all.length}</span>
      </div>
      <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
        {formatRangeLabel(range)}
      </p>

      <div style={{ position: 'relative', maxHeight: 220, overflowY: 'auto' }}>
        {all.map(({ substance, filled }) => {
          const end = substanceBarEnd(substance)
          const pos = barPosition(substance.startDate, end, range)
          const focused = focusId === substance.id
          const faded = focusId != null && !focused
          return (
            <button
              key={substance.id}
              type="button"
              onClick={() => onSelect(substance.id)}
              style={{
                display: 'block',
                width: '100%',
                marginBottom: 10,
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                opacity: faded ? 0.35 : 1,
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: substance.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  opacity: focused ? 1 : 0.75,
                  boxShadow: focused ? `0 0 12px ${substance.color}55` : 'none',
                }} />
              </div>
            </button>
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

      {focusId && (
        <button
          type="button"
          onClick={onClearFocus}
          style={{
            marginTop: 8,
            fontSize: '0.72rem',
            fontWeight: 800,
            color: 'var(--accent)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ✕ Fokus aufheben
        </button>
      )}
    </section>
  )
}
