import { Plus } from 'lucide-react'
import { formatRangeSubtitle } from './overview/ActiveSubstancesSection'

interface Props {
  subtitle: string
  onLogToday: () => void
}

export function FortschrittHeader({ subtitle, onLogToday }: Props) {
  return (
    <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          Fortschritt
        </h1>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
          {subtitle}
        </p>
      </div>
      <button
        type="button"
        onClick={onLogToday}
        className="btn-primary"
        style={{ flexShrink: 0, padding: '10px 14px', fontSize: '0.78rem' }}
      >
        <Plus size={16} /> Heute
      </button>
    </header>
  )
}

export { formatRangeSubtitle }
