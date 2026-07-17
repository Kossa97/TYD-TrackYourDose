import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import type { MarkerSummary, Trend } from '../lib/bloodwork'
import { formatDisplayDate, formatNumber } from '../lib/format'
import { CYAN, GREEN, MUTED, RED, TEXT } from '../styles'

export const TrendIcon = ({ trend, size = 16 }: { trend: Trend; size?: number }) => {
  if (trend === 'up') return <TrendingUp size={size} />
  if (trend === 'down') return <TrendingDown size={size} />
  if (trend === 'same') return <Minus size={size} />
  return null
}

/** Grün, wenn sich der Wert in die gewünschte Richtung bewegt. */
// eslint-disable-next-line react-refresh/only-export-components
export const trendColor = (summary: MarkerSummary): string => {
  const { trend } = summary
  if (trend === 'same' || trend === null) return MUTED
  const lowerIsBetter = summary.def?.lowerIsBetter
  const good = lowerIsBetter ? trend === 'down' : trend === 'up'
  return good ? GREEN : RED
}

interface Props {
  summaries: MarkerSummary[]
  onSelect: (name: string) => void
}

export function MarkerGrid({ summaries, onSelect }: Props) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
      {summaries.map(summary => {
        const { latest, inRange, trend, name } = summary
        const hasData = !!latest

        return (
          <button
            key={name}
            onClick={() => onSelect(name)}
            className="text-left"
            style={{
              padding: 14,
              borderRadius: 16,
              background: 'var(--surface)',
              border: hasData ? '1px solid var(--accent-border)' : '1px solid var(--border)',
              cursor: 'pointer',
              opacity: hasData ? 1 : 0.55,
            }}
          >
            <p className="font-bold text-sm" style={{ color: TEXT }}>{name}</p>
            {hasData && latest ? (
              <>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-base font-bold" style={{ color: inRange === false ? RED : CYAN }}>
                    {formatNumber(latest.value)} <span className="text-xs font-semibold" style={{ color: MUTED }}>{latest.unit}</span>
                  </span>
                  <span style={{ color: trendColor(summary) }}>
                    <TrendIcon trend={trend} size={15} />
                  </span>
                </div>
                <p className="text-xs mt-1.5" style={{ color: MUTED }}>{formatDisplayDate(latest.tested_at)}</p>
              </>
            ) : (
              <p className="text-xs mt-3" style={{ color: MUTED }}>– Noch kein Test</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
