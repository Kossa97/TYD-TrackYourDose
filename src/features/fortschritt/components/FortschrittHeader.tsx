import { Pencil, Plus } from 'lucide-react'

const ENTRY_GLOW_CSS = `
  @keyframes fortschritt-entry-pulse {
    0%, 100% {
      opacity: 0.5;
      box-shadow: 0 0 14px rgba(0, 204, 245, 0.4);
    }
    50% {
      opacity: 1;
      box-shadow:
        0 0 28px rgba(0, 204, 245, 0.85),
        0 0 0 4px rgba(0, 204, 245, 0.3);
    }
  }
  .fortschritt-entry-glow-wrap {
    position: relative;
    border-radius: 14px;
    overflow: visible;
  }
  .fortschritt-entry-glow-wrap::before {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 18px;
    border: 2px solid rgba(0, 204, 245, 0.75);
    animation: fortschritt-entry-pulse 1.4s ease-in-out infinite !important;
    animation-duration: 1.4s !important;
    animation-iteration-count: infinite !important;
    pointer-events: none;
    z-index: 0;
  }
  .fortschritt-entry-glow-wrap .btn-primary {
    position: relative;
    z-index: 1;
    box-shadow:
      0 0 22px rgba(0, 204, 245, 0.55),
      var(--shadow-btn-primary) !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .fortschritt-entry-glow-wrap::before {
      animation: fortschritt-entry-pulse 2s ease-in-out infinite !important;
      animation-duration: 2s !important;
      animation-iteration-count: infinite !important;
    }
  }
`

interface Props {
  rangeLabel: string
  onLogToday: () => void
  hasTodayEntry?: boolean
  /** Daten geladen — Glow erst dann, kein Flackern */
  dataReady?: boolean
}

export function FortschrittHeader({
  rangeLabel,
  onLogToday,
  hasTodayEntry = false,
  dataReady = false,
}: Props) {
  // Glow genau wenn der Button „Fortschritt eintragen“ zeigt (noch kein heutiger Eintrag)
  const showGlow = dataReady && !hasTodayEntry

  const button = (
    <button
      type="button"
      onClick={onLogToday}
      className="btn-primary"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '12px 16px',
        fontSize: '0.82rem',
      }}
    >
      {hasTodayEntry ? <Pencil size={17} /> : <Plus size={17} />}
      {hasTodayEntry ? 'HEUTIGEN EINTRAG BEARBEITEN' : 'FORTSCHRITT EINTRAGEN'}
    </button>
  )

  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showGlow && <style>{ENTRY_GLOW_CSS}</style>}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: '4px 10px',
      }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
          Fortschritt
        </h1>
        <span style={{
          fontSize: '0.62rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
        }}>
          {rangeLabel}
        </span>
      </div>

      <div className={showGlow ? 'fortschritt-entry-glow-wrap' : undefined}>
        {button}
      </div>
    </header>
  )
}
