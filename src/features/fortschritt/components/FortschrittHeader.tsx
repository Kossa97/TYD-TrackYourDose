import { Pencil, Plus } from 'lucide-react'

interface Props {
  rangeLabel: string
  onLogToday: () => void
  hasTodayEntry?: boolean
  highlightEntry?: boolean
}

export function FortschrittHeader({
  rangeLabel,
  onLogToday,
  hasTodayEntry = false,
  highlightEntry = false,
}: Props) {
  const showGlow = highlightEntry && !hasTodayEntry

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
