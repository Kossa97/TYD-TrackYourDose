import { RANGE_CHIPS, type RangeChipKey } from '../lib/verlaufRange'

/** Innere Höhe der Chip-Zeile (ohne Safe-Area). */
export const RANGE_BAR_INNER_HEIGHT = 28

interface Props {
  value: RangeChipKey
  onChange: (chip: RangeChipKey) => void
  disabled?: boolean
}

export function StickyRangeBar({ value, onChange, disabled }: Props) {
  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 12,
        paddingRight: 12,
        paddingBottom: 4,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          display: 'flex',
          gap: 4,
          height: RANGE_BAR_INNER_HEIGHT,
          alignItems: 'stretch',
          opacity: disabled ? 0.45 : 1,
          pointerEvents: disabled ? 'none' : 'auto',
        }}>
          {RANGE_CHIPS.map(chip => {
            const on = value === chip.key
            return (
              <button
                key={chip.key}
                type="button"
                disabled={disabled}
                onClick={() => onChange(chip.key)}
                style={{
                  flex: 1,
                  padding: 0,
                  borderRadius: 8,
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  cursor: disabled ? 'not-allowed' : 'pointer',
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
      <div
        aria-hidden
        style={{ height: `calc(${RANGE_BAR_INNER_HEIGHT}px + 4px + env(safe-area-inset-top))` }}
      />
    </>
  )
}
