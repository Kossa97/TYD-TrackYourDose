import { useTranslation } from 'react-i18next'
import { denyProps } from '../../../lib/denyFeedback'
import { STACK_TABS, type StackTabKey } from '../lib/stackTabs'

/**
 * Die Reiter: „Alle" und alle sechs Kategorien, feste Plaetze.
 *
 * Leere bleiben stehen und sind gedimmt — „Medikamente" ohne Inhalt sagt,
 * dass die App das auch kann; versteckt saehe das niemand. Antippen laesst
 * sie rot wackeln (denyFeedback). Die Leiste wischt waagerecht, das
 * Karussell darunter auch: deshalb ist sie flach, mit Pillen, und deutlich
 * abgesetzt.
 */
export function StackTabBar({ counts, openTab, onSelect }: {
  counts: ReadonlyMap<StackTabKey, number>
  openTab: StackTabKey
  onSelect: (key: StackTabKey) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      data-stack-tabs
      role="tablist"
      aria-label={String(t('my_stack_category', { defaultValue: 'Kategorie' }))}
      className="no-scrollbar -mx-3 mb-2 flex shrink-0 snap-x gap-2 overflow-x-auto overflow-y-hidden overscroll-none touch-pan-x px-3 pb-1"
    >
      {STACK_TABS.map(reiter => {
        const anzahl = counts.get(reiter.key) ?? 0
        const offen = reiter.key === openTab
        const reiterName = String(t(reiter.labelKey, { defaultValue: reiter.defaultValue }))
        return (
          <button
            key={reiter.key}
            type="button"
            role="tab"
            aria-selected={offen}
            data-stack-tab={reiter.key}
            data-stack-tab-count={anzahl}
            {...denyProps(anzahl === 0, String(t('my_stack_tab_locked', {
              defaultValue: 'Noch keine Substanz unter „{{category}}“.',
              category: reiterName,
            })))}
            onClick={() => { if (anzahl > 0) onSelect(reiter.key) }}
            className={`flex min-h-9 shrink-0 snap-start cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${offen
              ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
              : anzahl === 0
                ? 'border-white/[0.06] bg-white/[0.02] text-slate-600'
                : 'border-white/10 bg-white/[0.035] text-slate-300 hover:border-cyan-400/25'
            }`}
          >
            {reiterName}
            {anzahl > 0 && (
              <span className={`text-xs font-semibold tabular-nums ${offen ? 'text-cyan-100/70' : 'text-slate-500'}`}>
                {anzahl}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
