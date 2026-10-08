import { useTranslation } from 'react-i18next'
import { AUFFAELLIG, type MarkerFilter, type SortMode } from '../lib/bloodwork'
import { KATEGORIE_KEY } from '../lib/markerCatalog.en'
import type { KategorieFilter } from '../lib/markerCatalog'
import { KATEGORIEN, SONSTIGE } from '../lib/markerCatalog'
import { MUTED, RED, RED_WEAK, TEXT } from '../styles'

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
    <div className="mb-2 space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {chips.map(chip => {
          const active = kategorie === chip.key
          return (
            <button
              key={chip.key ?? 'alle'}
              onClick={() => onKategorie(chip.key)}
              aria-pressed={active}
              // Sichtbarer Text plus Anzahl: „Auffällige (2)“ — Sprachsteuerung findet ihn am Namen.
              aria-label={chip.key === AUFFAELLIG && auffaellig > 0 ? `${chip.label} (${auffaellig})` : undefined}
              className="inline-flex min-h-9 items-center gap-1.5 px-3.5 rounded-full text-sm whitespace-nowrap transition-colors"
              style={
                active
                  ? { background: 'var(--surface-raised)', color: TEXT, fontWeight: 800 }
                  : { color: 'var(--text-dim)', fontWeight: 600 }
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
      {kategorie !== AUFFAELLIG && <div className="flex items-center justify-end gap-2">
        <label className="text-xs" style={{ color: MUTED }} htmlFor="blutwerte-sort">{t('bw_sort')}</label>
        <select
          id="blutwerte-sort"
          className="select"
          style={{ color: TEXT, width: 'auto', paddingTop: 4, paddingBottom: 4, fontSize: 13 }}
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
