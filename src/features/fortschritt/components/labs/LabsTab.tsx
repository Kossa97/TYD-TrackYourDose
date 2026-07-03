import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { ChevronRight, Droplets } from 'lucide-react'
import type { BloodworkEntry } from '../../types'
import { panel, sectionLabel } from '../../styles'

interface Props {
  bloodwork: BloodworkEntry[]
}

export function LabsTab({ bloodwork }: Props) {
  const latestByMarker = new Map<string, BloodworkEntry>()
  for (const entry of bloodwork) {
    const existing = latestByMarker.get(entry.marker)
    if (!existing || entry.tested_at > existing.tested_at) {
      latestByMarker.set(entry.marker, entry)
    }
  }

  const items = Array.from(latestByMarker.values()).sort((a, b) => b.tested_at.localeCompare(a.tested_at))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text)' }}>Labs</h2>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {items.length} {items.length === 1 ? 'Marker' : 'Marker'} im Zeitraum
          </p>
        </div>
        <Link to="/blutwerte" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem' }}>
          <Droplets size={16} /> Alle Blutwerte
        </Link>
      </div>

      {items.length === 0 ? (
        <section style={{ ...panel, padding: '40px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>Noch keine Blutwerte</p>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
            Erfasse Laborergebnisse um Marker wie IGF-1 im Verlauf zu sehen.
          </p>
          <Link to="/blutwerte" className="btn-primary">Wert hinzufügen</Link>
        </section>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(entry => (
            <Link
              key={entry.id}
              to="/blutwerte"
              style={{
                ...panel,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 16px',
                textDecoration: 'none',
              }}
            >
              <div>
                <p style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {entry.marker}
                </p>
                <p style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-dim)', marginTop: 4 }}>
                  {entry.value} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{entry.unit}</span>
                </p>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
                  {format(parseISO(`${entry.tested_at}T00:00:00`), 'dd.MM.yyyy')}
                </p>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </Link>
          ))}
        </div>
      )}

      <p style={{ ...sectionLabel, textAlign: 'center' }}>
        Vollständige Erfassung und Referenzbereiche unter Blutwerte
      </p>
    </div>
  )
}
