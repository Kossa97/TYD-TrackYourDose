import type { CSSProperties } from 'react'
import { fieldLabel } from '../styles'

export const WELLNESS_SLIDER_CSS = `
  input.tyd-wellness-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 8px;
    border-radius: 99px;
    outline: none;
    cursor: pointer;
    margin: 0;
    background: transparent;
  }
  input.tyd-wellness-slider::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 99px;
    background: linear-gradient(
      to right,
      var(--accent) 0%,
      var(--accent) var(--fill-pct, 44%),
      rgba(255,255,255,0.1) var(--fill-pct, 44%),
      rgba(255,255,255,0.1) 100%
    );
    border: 1px solid rgba(255,255,255,0.06);
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.35);
  }
  input.tyd-wellness-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 26px;
    height: 26px;
    margin-top: -10px;
    border-radius: 50%;
    background: radial-gradient(circle at 32% 28%, #7ef0ff 0%, #00ccf5 42%, #008fbd 100%);
    border: 3px solid rgba(255,255,255,0.92);
    box-shadow:
      0 0 0 4px rgba(0,204,245,0.18),
      0 4px 14px rgba(0,0,0,0.45),
      0 0 18px rgba(0,204,245,0.35);
    cursor: grab;
    transition: box-shadow 0.15s ease, transform 0.15s ease;
  }
  input.tyd-wellness-slider:active::-webkit-slider-thumb {
    cursor: grabbing;
    transform: scale(1.06);
    box-shadow:
      0 0 0 6px rgba(0,204,245,0.22),
      0 6px 18px rgba(0,0,0,0.5),
      0 0 24px rgba(0,204,245,0.45);
  }
  input.tyd-wellness-slider::-moz-range-track {
    height: 8px;
    border-radius: 99px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.06);
  }
  input.tyd-wellness-slider::-moz-range-progress {
    height: 8px;
    border-radius: 99px;
    background: var(--accent);
  }
  input.tyd-wellness-slider::-moz-range-thumb {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: radial-gradient(circle at 32% 28%, #7ef0ff 0%, #00ccf5 42%, #008fbd 100%);
    border: 3px solid rgba(255,255,255,0.92);
    box-shadow:
      0 0 0 4px rgba(0,204,245,0.18),
      0 4px 14px rgba(0,0,0,0.45),
      0 0 18px rgba(0,204,245,0.35);
    cursor: grab;
  }
`

export const DEFAULT_WELLNESS = 5

export function wellnessFillPercent(value: number): string {
  return `${((value - 1) / 9) * 100}%`
}

export const dateFieldStyle: CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 16,
  background: 'var(--surface-input)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: '1rem',
  fontWeight: 800,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  textAlign: 'center',
  colorScheme: 'dark',
}

interface Props {
  label: string
  value: number | null
  onChange: (value: number) => void
}

export function WellnessSliderRow({ label, value, onChange }: Props) {
  const display = value ?? DEFAULT_WELLNESS

  return (
    <div style={{
      marginBottom: 12,
      padding: '14px 14px 12px',
      borderRadius: 18,
      background: 'var(--surface-input)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
      }}>
        <label style={{ ...fieldLabel, marginBottom: 0 }}>
          {label}
        </label>
        <span style={{
          fontSize: '0.95rem',
          fontWeight: 900,
          color: 'var(--accent)',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
        }}>
          {display}<span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>/10</span>
        </span>
      </div>

      <input
        className="tyd-wellness-slider"
        type="range"
        min={1}
        max={10}
        step={1}
        value={display}
        onChange={e => onChange(Number(e.target.value))}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={display}
        aria-label={label}
        style={{ '--fill-pct': wellnessFillPercent(display) } as CSSProperties}
      />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: 8,
        padding: '0 4px',
      }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map(tick => (
          <span
            key={tick}
            aria-hidden
            style={{
              width: tick === display ? 7 : 4,
              height: tick === display ? 7 : 4,
              borderRadius: 99,
              background: tick <= display
                ? (tick === display ? 'var(--accent)' : 'rgba(0,204,245,0.35)')
                : 'rgba(255,255,255,0.12)',
              flexShrink: 0,
              transition: 'all 0.12s ease',
            }}
          />
        ))}
      </div>
    </div>
  )
}
