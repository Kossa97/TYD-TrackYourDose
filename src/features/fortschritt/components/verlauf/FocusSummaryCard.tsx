import type { FocusSummary } from '../../lib/focusSummary'
import { panel, sectionLabel } from '../../styles'

export function FocusSummaryCard({ summary }: { summary: FocusSummary }) {
  return (
    <section style={{ ...panel, padding: '16px 18px', borderColor: 'rgba(0,204,245,0.2)' }}>
      <p style={sectionLabel}>Zusammenfassung</p>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'var(--text)', marginTop: 6 }}>{summary.title}</h3>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14 }}>
        {summary.subtitle}
      </p>

      {summary.note && (
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>{summary.note}</p>
      )}

      {summary.rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {summary.rows.map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: '0.78rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{row.label}</span>
              <span style={{ fontWeight: 800, color: 'var(--text-dim)', textAlign: 'right' }}>
                {row.from} → {row.to} <span style={{ color: 'var(--accent)' }}>({row.delta})</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {summary.adherence && (
        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
          Adherence {summary.adherence}
          {summary.doseDetail ? ` · ${summary.doseDetail}` : ''}
        </p>
      )}
    </section>
  )
}
