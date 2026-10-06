import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { markerName } from '../../lib/markerCatalog.en'
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
  const { t, i18n } = useTranslation()
  const [choices, setChoices] = useState<Record<string, boolean>>({})

  const pick = (key: string, replace: boolean) => setChoices(c => ({ ...c, [key]: replace }))

  const apply = () =>
    onResolve(Object.fromEntries(conflicts.map(c => [c.key, choices[c.key] ?? false])))

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end justify-center" data-app-modal data-app-back-close data-app-back-dirty-on-interaction onClick={onCancel}>
      <div
        className="w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh] rounded-t-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold" style={{ color: TEXT }}>{t('bw_conflict_title')}</h2>
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          {t('bw_conflict_desc')}
        </p>

        {conflicts.map(c => {
          const replace = choices[c.key] ?? false
          return (
            <div key={c.key} className="rounded-2xl p-4" style={{ border: '1px solid var(--border)' }}>
              <p className="text-sm font-bold mb-2" style={{ color: TEXT }}>{markerName(c.incoming.marker, i18n.resolvedLanguage ?? i18n.language)}</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => pick(c.key, false)}
                  className="rounded-xl p-3 text-left transition-colors"
                  style={{
                    border: `1px solid ${!replace ? 'var(--accent-border)' : 'var(--border)'}`,
                    opacity: !replace ? 1 : 0.5,
                  }}
                >
                  <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: MUTED }}>{t('bw_keep')}</p>
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
                  <p className="text-[0.65rem] uppercase tracking-wide" style={{ color: CYAN }}>{t('bw_replace')}</p>
                  <p className="text-sm font-bold" style={{ color: TEXT }}>
                    {formatNumber(c.incoming.value)} <span style={{ color: MUTED }}>{c.incoming.unit}</span>
                  </p>
                </button>
              </div>
            </div>
          )
        })}

        <button className="btn-primary w-full" onClick={apply}>{t('bw_apply')}</button>
      </div>
    </div>
  )
}
