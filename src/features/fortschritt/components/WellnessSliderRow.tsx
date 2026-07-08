import type { CSSProperties } from 'react'
import { fieldLabel } from '../styles'

export const WELLNESS_SLIDER_CSS = `
  input.tyd-wellness-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 99px;
    outline: none;
    cursor: pointer;
    margin: 0;
    background: transparent;
  }
  input.tyd-wellness-slider::-webkit-slider-runnable-track {
    height: 6px;
    border-radius: 99px;
    background: linear-gradient(
      to right,
      var(--accent) 0%,
      var(--accent) var(--fill-pct, 44%),
      rgba(255,255,255,0.1) var(--fill-pct, 44%),
      rgba(255,255,255,0.1) 100%
    );
    border: 1px solid rgba(255,255,255,0.06);
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
  }
  input.tyd-wellness-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px;
    height: 22px;
    margin-top: -9px;
    border-radius: 50%;
    background: radial-gradient(circle at 32% 28%, #7ef0ff 0%, #00ccf5 42%, #008fbd 100%);
    border: 2.5px solid rgba(255,255,255,0.92);
    box-shadow:
      0 0 0 3px rgba(0,204,245,0.16),
      0 3px 10px rgba(0,0,0,0.4),
      0 0 14px rgba(0,204,245,0.3);
    cursor: grab;
  }
  input.tyd-wellness-slider:active::-webkit-slider-thumb {
    cursor: grabbing;
    transform: scale(1.05);
  }
  input.tyd-wellness-slider::-moz-range-track {
    height: 6px;
    border-radius: 99px;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.06);
  }
  input.tyd-wellness-slider::-moz-range-progress {
    height: 6px;
    border-radius: 99px;
    background: var(--accent);
  }
  input.tyd-wellness-slider::-moz-range-thumb {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: radial-gradient(circle at 32% 28%, #7ef0ff 0%, #00ccf5 42%, #008fbd 100%);
    border: 2.5px solid rgba(255,255,255,0.92);
    box-shadow:
      0 0 0 3px rgba(0,204,245,0.16),
      0 3px 10px rgba(0,0,0,0.4),
      0 0 14px rgba(0,204,245,0.3);
    cursor: grab;
  }
`

export const DEFAULT_WELLNESS = 5

export function wellnessFillPercent(value: number): string {
  return `${((value - 1) / 9) * 100}%`
}

export const dateFieldStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.92rem',
  fontWeight: 800,
  fontFamily: 'inherit',
  textAlign: 'right',
  colorScheme: 'dark',
}

export const compactInputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 11px',
  borderRadius: 12,
  background: 'var(--surface-input)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: '0.84rem',
  fontWeight: 700,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
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
      marginBottom: 8,
      padding: '9px 11px 8px',
      borderRadius: 14,
      background: 'var(--surface-input)',
      border: '1px solid var(--border)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 7,
        gap: 8,
      }}>
        <label style={{ ...fieldLabel, marginBottom: 0, fontSize: '0.56rem' }}>
          {label}
        </label>
        <span style={{
          fontSize: '0.82rem',
          fontWeight: 900,
          color: 'var(--accent)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {display}<span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>/10</span>
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
    </div>
  )
}
