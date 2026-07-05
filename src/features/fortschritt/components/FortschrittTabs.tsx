import type { FortschrittTab } from '../types'
import { FORTSCHRITT_TABS } from '../constants'

interface Props {
  active: FortschrittTab
  onChange: (tab: FortschrittTab) => void
}

export function FortschrittTabs({ active, onChange }: Props) {
  return (
    <div style={{
      display: 'flex',
      gap: 6,
      overflowX: 'auto',
      paddingBottom: 2,
    }}>
      {FORTSCHRITT_TABS.map(tab => {
        const on = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            style={{
              flexShrink: 0,
              padding: '8px 14px',
              borderRadius: 12,
              fontSize: '0.78rem',
              fontWeight: 800,
              cursor: 'pointer',
              border: on ? '1px solid var(--accent-border)' : '1px solid var(--border)',
              background: on ? 'var(--accent-weak)' : 'var(--surface)',
              color: on ? 'var(--accent)' : 'var(--text-muted)',
              transition: 'all 0.18s',
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
