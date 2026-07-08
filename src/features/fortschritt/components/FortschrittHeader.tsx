import { Pencil, Plus } from 'lucide-react'
import { formatRangeSubtitle } from './overview/ActiveSubstancesSection'

interface Props {
  subtitle: string
  onLogToday: () => void
  hasTodayEntry?: boolean
}

export function FortschrittHeader({ subtitle, onLogToday, hasTodayEntry = false }: Props) {
  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Fortschritt
        </h1>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
          {subtitle}
        </p>
      </div>

      <div>
        <p style={{
          fontSize: '0.88rem',
          fontWeight: 800,
          color: 'var(--text-dim)',
          marginBottom: 8,
        }}>
          Wie läuft&apos;s?
        </p>
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
          {hasTodayEntry ? 'HEUTIGEN EINTRAG BEARBEITEN' : 'DEINEN HEUTIGEN STAND EINTRAGEN'}
        </button>
      </div>
    </header>
  )
}

export { formatRangeSubtitle }
