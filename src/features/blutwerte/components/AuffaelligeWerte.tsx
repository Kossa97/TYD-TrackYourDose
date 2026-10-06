import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { markerName } from '../lib/markerCatalog.en'
import type { MarkerSummary } from '../lib/bloodwork'
import { formatNumber, formatRange } from '../lib/format'
import { CYAN, GREEN, MUTED, PANEL_STYLE, RED, RED_BORDER, TEXT } from '../styles'

interface Props {
  summaries: MarkerSummary[]
  /** Gemessen, aber ohne Referenzbereich — nicht geprueft, also nie „im Bereich". */
  ungeprueft: number
  /** Gibt es ueberhaupt Messwerte? Sonst ein Einstiegshinweis statt „alles im Bereich". */
  hatWerte: boolean
  onSelect: (name: string) => void
  onAlleMarker: () => void
}

/**
 * Filter „Auffällige“ unter „Marker“: die zuletzt gemessenen Werte ausserhalb
 * des Referenzbereichs, mit Leerzustaenden.
 */
export function AuffaelligeWerte({ summaries, ungeprueft, hatWerte, onSelect, onAlleMarker }: Props) {
  const { t, i18n } = useTranslation()

  const ungeprueftHinweis = ungeprueft > 0 && (
    <p className="text-xs mt-2" style={{ color: MUTED }} data-bw-unchecked>{t('bw_flagged_unchecked', { count: ungeprueft })}</p>
  )

  if (summaries.length === 0) {
    // Gruen nur, wenn wirklich alles geprueft ist und im Bereich liegt.
    const allesGeprueft = hatWerte && ungeprueft === 0
    return (
      <div className="p-6 mb-4 text-center" style={PANEL_STYLE} data-bw-flagged-empty>
        {allesGeprueft && <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: GREEN }} aria-hidden="true" />}
        <p className="text-sm" style={{ color: hatWerte ? TEXT : MUTED }}>
          {t(!hatWerte ? 'bw_flagged_no_data' : allesGeprueft ? 'bw_flagged_none' : 'bw_flagged_none_checked')}
        </p>
        {hatWerte && ungeprueftHinweis}
        {hatWerte && (
          <button type="button" className="mt-3 min-h-11 px-3 text-sm font-semibold" style={{ color: CYAN }} onClick={onAlleMarker}>
            {t('bw_flagged_show_all')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4">
    <div
      role="region"
      aria-label={t('bw_out_of_range_title', { count: summaries.length })}
      style={{ ...PANEL_STYLE, border: `1px solid ${RED_BORDER}` }}
      data-bw-flagged
    >
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <AlertTriangle size={15} style={{ color: RED }} aria-hidden="true" />
        <p className="text-xs" style={{ color: MUTED }}>{t('bw_flagged_hint')}</p>
      </div>
      {summaries.map(summary => {
        const latest = summary.latest!
        const shownValue = summary.displayValue ?? latest.value
        const shownUnit = summary.displayValue != null ? summary.displayUnit : latest.unit
        const referenz = formatRange(summary.range.min, summary.range.max, shownUnit)
        return (
          <button
            key={summary.name}
            onClick={() => onSelect(summary.name)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: TEXT }}>{markerName(summary.name, i18n.resolvedLanguage ?? i18n.language)}</p>
              {referenz && (
                <p className="text-xs mt-0.5" style={{ color: MUTED }}>{t('bw_reference', { range: referenz })}</p>
              )}
            </div>
            <span className="text-sm font-bold" style={{ color: RED }}>
              {formatNumber(shownValue)}{' '}
              <span className="text-xs font-semibold" style={{ color: MUTED }}>{shownUnit}</span>
            </span>
          </button>
        )
      })}
    </div>
    {ungeprueftHinweis && <div className="px-5">{ungeprueftHinweis}</div>}
    </div>
  )
}
