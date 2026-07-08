import { RANGE_CHIPS, type RangeChipKey } from '../lib/verlaufRange'

interface Props {
  value: RangeChipKey
  onChange: (chip: RangeChipKey) => void
  disabled?: boolean
}

export function StickyRangeBar({ value, onChange, disabled }: Props) {
  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 30,
      margin: '-1rem -0.75rem 0',
      padding: 'max(8px, env(safe-area-inset-top)) 12px 8px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        gap: 4,
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
                padding: '7px 0',
                borderRadius: 10,
                fontSize: '0.68rem',
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
  )
}
