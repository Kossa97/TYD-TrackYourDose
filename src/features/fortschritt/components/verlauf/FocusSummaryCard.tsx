import type { FocusSummary } from '../../lib/focusSummary'

interface Props {
  summary: FocusSummary
  inline?: boolean
}

export function FocusSummaryCard({ summary, inline = false }: Props) {
  if (inline) {
    return (
      <div style={{
        marginTop: 10,
        padding: '12px 14px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
          Start → heute
        </p>
        <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10 }}>
          {summary.subtitle}
        </p>

        {summary.note && (
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>{summary.note}</p>
        )}

        {summary.rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: summary.adherence ? 10 : 0 }}>
            {summary.rows.map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: '0.74rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 800, color: 'var(--text-dim)', textAlign: 'right' }}>
                  {row.from} → {row.to}{' '}
                  <span style={{ color: 'var(--accent)' }}>({row.delta})</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {summary.adherence && (
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            Adherence {summary.adherence}
            {summary.doseDetail ? ` · ${summary.doseDetail}` : ''}
          </p>
        )}
      </div>
    )
  }

  return (
    <section style={{
      background: 'var(--surface)',
      border: '1px solid rgba(0,204,245,0.2)',
      borderRadius: 20,
      padding: '16px 18px',
    }}>
      <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        Zusammenfassung
      </p>
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
