import { AlertTriangle } from 'lucide-react'
import type { MarkerSummary } from '../lib/bloodwork'
import { formatNumber, formatRange } from '../lib/format'
import { MUTED, PANEL_STYLE, RED, TEXT } from '../styles'

interface Props {
  summaries: MarkerSummary[]
  onSelect: (name: string) => void
}

export function AuffaelligeWerte({ summaries, onSelect }: Props) {
  if (summaries.length === 0) return null

  return (
    <div className="mb-4" style={{ ...PANEL_STYLE, border: '1px solid rgba(239,68,68,0.35)' }}>
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <AlertTriangle size={15} style={{ color: RED }} />
        <p className="text-sm font-bold" style={{ color: TEXT }}>
          Auffällige Werte ({summaries.length})
        </p>
      </div>
      {summaries.map((summary, i) => {
        const latest = summary.latest!
        const referenz = formatRange(summary.range.min, summary.range.max, latest.unit)
        return (
          <button
            key={summary.name}
            onClick={() => onSelect(summary.name)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
            style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>{summary.name}</p>
              {referenz && (
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>Referenz: {referenz}</p>
              )}
            </div>
            <span className="text-sm font-bold" style={{ color: RED }}>
              {formatNumber(latest.value)}{' '}
              <span className="text-xs font-semibold" style={{ color: MUTED }}>{latest.unit}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
