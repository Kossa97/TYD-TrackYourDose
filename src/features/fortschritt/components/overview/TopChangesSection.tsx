import type { MetricChange } from '../../types'
import { panel, sectionLabel } from '../../styles'

interface Props {
  changes: MetricChange[]
  hasAnyData: boolean
  hasEnoughForTrend: boolean
  onSelect?: (key: string) => void
}

export function TopChangesSection({ changes, hasAnyData, hasEnoughForTrend, onSelect }: Props) {
  return (
    <section style={{ ...panel, padding: '16px 18px' }}>
      <p style={{ ...sectionLabel, marginBottom: 2 }}>Größte Veränderungen</p>
      <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 14 }}>
        im aktiven Zeitraum
      </p>

      {!hasAnyData && (
        <EmptyMessage
          title="Noch keine Werte erfasst"
          body="Starte mit deinem ersten Check-in — dauert unter 30 Sekunden."
        />
      )}

      {hasAnyData && !hasEnoughForTrend && (
        <EmptyMessage
          title="Noch zu wenig Daten"
          body="Logge ein paar Tage mit + Heute, um Trends zu sehen."
        />
      )}

      {hasAnyData && hasEnoughForTrend && changes.length === 0 && (
        <EmptyMessage
          title="Alles stabil im Zeitraum"
          body="Keine Metrik hat sich merklich verändert. Das ist auch ein Ergebnis."
        />
      )}

      {changes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {changes.map(change => (
            <button
              key={change.key}
              type="button"
              onClick={() => onSelect?.(change.key)}
              style={{
                display: 'block',
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: onSelect ? 'pointer' : 'default',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                  {change.rank}
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-dim)' }}>
                  {change.label}
                </span>
                <span style={{
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  color: change.delta > 0 ? '#10b981' : change.delta < 0 ? '#f59e0b' : 'var(--text-muted)',
                }}>
                  {formatDelta(change)}
                </span>
              </div>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                {formatValue(change.from, change.unit)} → {formatValue(change.to, change.unit)}
              </p>
              <div style={{ height: 6, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.abs(change.delta) * (change.unit === 'kg' ? 25 : 12))}%`,
                  background: 'var(--accent)',
                  borderRadius: 99,
                  opacity: 0.85,
                }} />
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function formatValue(value: number, unit: string): string {
  if (unit === 'kg') return `${value} kg`
  if (unit === '%') return `${value}%`
  if (unit === '/10') return `${value}/10`
  if (unit) return `${value} ${unit}`
  return String(value)
}

function formatDelta(change: MetricChange): string {
  const sign = change.delta > 0 ? '↑' : change.delta < 0 ? '↓' : '→'
  const abs = Math.abs(change.delta)
  if (change.unit === 'kg') return `${sign} ${change.delta > 0 ? '+' : ''}${change.delta} kg`
  if (change.unit === '%') return `${sign} ${change.delta > 0 ? '+' : ''}${change.delta}%`
  if (change.unit === '/10') return `${sign} ${change.delta > 0 ? '+' : ''}${change.delta}`
  return `${sign} ${change.delta > 0 ? '+' : ''}${abs}`
}

function EmptyMessage({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
      <p style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.45 }}>{body}</p>
    </div>
  )
}
