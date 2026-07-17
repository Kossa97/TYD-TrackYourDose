import type { SortMode } from '../lib/bloodwork'
import type { KategorieFilter } from '../lib/markerCatalog'
import { KATEGORIEN, SONSTIGE } from '../lib/markerCatalog'
import { CYAN, MUTED, TEXT } from '../styles'

const SORT_LABELS: Record<SortMode, string> = {
  kategorie: 'Kategorie',
  name: 'Name',
  zuletzt: 'Zuletzt getestet',
  status: 'Auffällige zuerst',
}

interface Props {
  kategorie: KategorieFilter | null
  sortMode: SortMode
  /** "Sonstige" nur anbieten, wenn Custom-Marker existieren. */
  showSonstige: boolean
  onKategorie: (kategorie: KategorieFilter | null) => void
  onSortMode: (mode: SortMode) => void
}

export function GridControls({ kategorie, sortMode, showSonstige, onKategorie, onSortMode }: Props) {
  const chips: Array<{ key: KategorieFilter | null; label: string }> = [
    { key: null, label: 'Alle' },
    ...KATEGORIEN.map(k => ({ key: k as KategorieFilter, label: k })),
    ...(showSonstige ? [{ key: SONSTIGE as KategorieFilter, label: SONSTIGE }] : []),
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
              className="px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors"
              style={
                active
                  ? { background: 'var(--accent-weak)', color: CYAN, border: '1px solid var(--accent-border)' }
                  : { color: MUTED, border: '1px solid var(--border)' }
              }
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs" style={{ color: MUTED }} htmlFor="blutwerte-sort">Sortieren:</label>
        <select
          id="blutwerte-sort"
          className="select"
          style={{ color: TEXT, width: 'auto', paddingTop: 6, paddingBottom: 6 }}
          value={sortMode}
          onChange={e => onSortMode(e.target.value as SortMode)}
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map(mode => (
            <option key={mode} value={mode}>{SORT_LABELS[mode]}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
