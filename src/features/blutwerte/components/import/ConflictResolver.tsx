import { useState } from 'react'
import type { MergeConflict } from '../../lib/mergeRows'
import { formatNumber } from '../../lib/format'
import { CYAN, MUTED, TEXT } from '../../styles'

interface Props {
  conflicts: MergeConflict[]
  /** Für jeden Konflikt-Key: true = neuen Wert übernehmen (ersetzen), false = vorhandenen behalten. */
  onResolve: (replaceByKey: Record<string, boolean>) => void
  onCancel: () => void
}

/** Lässt den Nutzer je doppelt erkanntem Marker zwischen vorhandenem und neuem Wert wählen. */
export function ConflictResolver({ conflicts, onResolve, onCancel }: Props) {
  const [choices, setChoices] = useState<Record<string, boolean>>({})

  const pick = (key: string, replace: boolean) => setChoices(c => ({ ...c, [key]: replace }))

  const apply = () =>
    onResolve(Object.fromEntries(conflicts.map(c => [c.key, choices[c.key] ?? false])))

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center" onClick={onCancel}>
      <div
        className="w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh] rounded-t-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold" style={{ color: TEXT }}>Doppelte Marker klären</h2>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          Diese Marker sind schon vorhanden, der neue Scan liest einen anderen Wert. Wähle je Marker,
          welcher gelten soll.
        </p>

        {conflicts.map(c => {
          const replace = choices[c.key] ?? false
          return (
            <div key={c.key} className="rounded-2xl p-4" style={{ border: '1px solid var(--border)' }}>
              <p className="text-sm font-bold mb-2" style={{ color: TEXT }}>{c.incoming.marker}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => pick(c.key, false)}
                  className="rounded-xl p-3 text-left transition-colors"
                  style={{
                    border: `1px solid ${!replace ? 'var(--accent-border)' : 'var(--border)'}`,
                    opacity: !replace ? 1 : 0.5,
                  }}
                >
                  <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>Behalten</p>
                  <p className="text-sm font-bold" style={{ color: TEXT }}>
                    {formatNumber(c.existing.value)} <span style={{ color: MUTED }}>{c.existing.unit}</span>
                  </p>
                </button>
                <button
                  onClick={() => pick(c.key, true)}
                  className="rounded-xl p-3 text-left transition-colors"
                  style={{
                    border: `1px solid ${replace ? 'var(--accent-border)' : 'var(--border)'}`,
                    opacity: replace ? 1 : 0.5,
                  }}
                >
                  <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: CYAN }}>Ersetzen</p>
                  <p className="text-sm font-bold" style={{ color: TEXT }}>
                    {formatNumber(c.incoming.value)} <span style={{ color: MUTED }}>{c.incoming.unit}</span>
                  </p>
                </button>
              </div>
            </div>
          )
        })}

        <button className="btn-primary w-full" onClick={apply}>Übernehmen</button>
      </div>
    </div>
  )
}
