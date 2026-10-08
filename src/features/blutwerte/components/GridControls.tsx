import { useTranslation } from 'react-i18next'
import { AUFFAELLIG, type MarkerFilter, type SortMode } from '../lib/bloodwork'
import type { UnitSystem } from '../lib/unitConversion'
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
  /** Einheitensystem fuer alle Marker (einzelne koennen abweichen). */
  unitSystem: UnitSystem
  /** Erst nach dem Laden der gespeicherten Wahl bedienbar. */
  unitsReady: boolean
  onUnitSystem: (system: UnitSystem) => void
  /** "Sonstige" nur anbieten, wenn Custom-Marker existieren. */
  showSonstige: boolean
  onKategorie: (kategorie: MarkerFilter) => void
  onSortMode: (mode: SortMode) => void
}

export function GridControls({ kategorie, auffaellig, sortMode, unitSystem, unitsReady, onUnitSystem, showSonstige, onKategorie, onSortMode }: Props) {
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

      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Einheiten: konventionell (z.B. ng/dL) oder SI (z.B. nmol/L), fuer alle Marker. */}
        <div role="group" aria-label={t('bw_units')} className="flex items-center gap-2">
          <span className="text-xs" style={{ color: MUTED }} aria-hidden="true">{t('bw_units')}</span>
          <div className="flex rounded-full p-0.5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)' }}>
            {([['konventionell', t('bw_units_conventional')], ['si', t('bw_units_si')]] as [UnitSystem, string][]).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => onUnitSystem(key)}
                disabled={!unitsReady}
                aria-pressed={unitSystem === key}
                className="min-h-8 rounded-full px-3 text-xs whitespace-nowrap transition-colors"
                style={unitSystem === key
                  ? { background: 'var(--surface)', color: TEXT, fontWeight: 800, boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }
                  : { color: MUTED, fontWeight: 600 }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

      {/* Sortieren greift nur im Raster, nicht in der Liste der Auffaelligen. */}
      {kategorie !== AUFFAELLIG && <div className="ml-auto flex items-center gap-2">
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
    </div>
  )
}
