import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronRight, Droplets } from 'lucide-react'
import type { BloodworkEntry, DateRange } from '../../types'
import { filterByDateRange } from '../../lib/range'
import { panel, sectionLabel } from '../../styles'

interface Props {
  bloodwork: BloodworkEntry[]
  range: DateRange
}

export function LabsCard({ bloodwork, range }: Props) {
  const inRange = filterByDateRange(bloodwork, range, b => b.tested_at)

  const latestByMarker = new Map<string, BloodworkEntry>()
  for (const entry of inRange) {
    const existing = latestByMarker.get(entry.marker)
    if (!existing || entry.tested_at > existing.tested_at) {
      latestByMarker.set(entry.marker, entry)
    }
  }

  const items = Array.from(latestByMarker.values())
    .sort((a, b) => b.tested_at.localeCompare(a.tested_at))
    .slice(0, 4)

  return (
    <section style={{ ...panel, padding: '14px 14px 12px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={sectionLabel}>Labs</p>
        <Link to="/blutwerte" style={{ color: 'var(--accent)', display: 'flex' }} aria-label="Alle Blutwerte">
          <Droplets size={16} />
        </Link>
      </div>

      {items.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', textAlign: 'center', padding: '8px 0' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: 10 }}>
            Keine Blutwerte im Zeitraum
          </p>
          <Link to="/blutwerte" className="btn-secondary" style={{ fontSize: '0.72rem', padding: '8px 10px' }}>
            Wert hinzufügen
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {items.map(entry => (
            <Link
              key={entry.id}
              to="/blutwerte"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                textDecoration: 'none',
                padding: '6px 0',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {entry.marker}
                </p>
                <p style={{ fontSize: '0.92rem', fontWeight: 900, color: 'var(--text-dim)', marginTop: 2 }}>
                  {entry.value}
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: 4 }}>{entry.unit}</span>
                </p>
              </div>
              <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>
                {format(parseISO(`${entry.tested_at}T00:00:00`), 'dd.MM.yy')}
              </span>
            </Link>
          ))}
          <Link
            to="/blutwerte"
            style={{
              marginTop: 'auto',
              paddingTop: 6,
              fontSize: '0.68rem',
              fontWeight: 800,
              color: 'var(--accent)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              textDecoration: 'none',
            }}
          >
            Alle Blutwerte <ChevronRight size={14} />
          </Link>
        </div>
      )}
    </section>
  )
}
