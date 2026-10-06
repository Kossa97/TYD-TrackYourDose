import { useTranslation } from 'react-i18next'
import { AUFFAELLIG, type MarkerFilter, type SortMode } from '../lib/bloodwork'
import { KATEGORIE_KEY } from '../lib/markerCatalog.en'
import type { KategorieFilter } from '../lib/markerCatalog'
import { KATEGORIEN, SONSTIGE } from '../lib/markerCatalog'
import { CYAN, MUTED, RED, RED_WEAK, TEXT } from '../styles'

const SORT_LABELS: Record<SortMode, string> = {
  kategorie: 'bw_sort_category',
  name: 'bw_sort_name',
  zuletzt: 'bw_sort_recent',
  status: 'bw_sort_status',
}

interface Props {
  kategorie: MarkerFilter
  /** Anzahl fuer den Chip „Auffällige“. */
  auffaellig: number
  sortMode: SortMode
  /** "Sonstige" nur anbieten, wenn Custom-Marker existieren. */
  showSonstige: boolean
  onKategorie: (kategorie: MarkerFilter) => void
  onSortMode: (mode: SortMode) => void
}

export function GridControls({ kategorie, auffaellig, sortMode, showSonstige, onKategorie, onSortMode }: Props) {
  const { t } = useTranslation()
  const chips: Array<{ key: MarkerFilter; label: string }> = [
    // Zuerst und vorausgewaehlt: was Aufmerksamkeit braucht.
    { key: AUFFAELLIG, label: t('bw_view_flagged') },
    { key: null, label: t('bw_all') },
    ...KATEGORIEN.map(k => ({ key: k as KategorieFilter, label: t(KATEGORIE_KEY[k]) })),
    ...(showSonstige ? [{ key: SONSTIGE as KategorieFilter, label: t(KATEGORIE_KEY[SONSTIGE]) }] : []),
  ]

  return (
    <div className="mb-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {chips.map(chip => {
          const active = kategorie === chip.key
          return (
            <button
              key={chip.label}
              onClick={() => onKategorie(chip.key)}
              aria-pressed={active}
              // Die Zahl am Chip mit Zusammenhang vorlesen: „Auffällige Werte (2)“.
              aria-label={chip.key === AUFFAELLIG && auffaellig > 0 ? t('bw_out_of_range_title', { count: auffaellig }) : undefined}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors"
              style={
                active
                  ? { background: 'var(--accent-weak)', color: CYAN, border: '1px solid var(--accent-border)' }
                  : { color: MUTED, border: '1px solid var(--border)' }
              }
            >
              {chip.label}
              {chip.key === AUFFAELLIG && auffaellig > 0 && (
                <span
                  aria-hidden="true"
                  className="min-w-5 rounded-full px-1.5 text-xs font-bold leading-5 tabular-nums text-center"
                  style={{ background: RED_WEAK, color: RED }}
                  data-bw-flagged-count
                >
                  {auffaellig}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Sortieren greift nur im Raster, nicht in der Liste der Auffaelligen. */}
      {kategorie !== AUFFAELLIG && <div className="flex items-center gap-2">
        <label className="text-xs" style={{ color: MUTED }} htmlFor="blutwerte-sort">{t('bw_sort')}</label>
        <select
          id="blutwerte-sort"
          className="select"
          style={{ color: TEXT, width: 'auto', paddingTop: 6, paddingBottom: 6 }}
          value={sortMode}
          onChange={e => onSortMode(e.target.value as SortMode)}
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
            <option key={mode} value={mode}>{t(SORT_LABELS[mode])}</option>
          ))}
        </select>
      </div>}
    </div>
  )
}
