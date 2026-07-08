// src/pages/lab/FilterSheet.tsx
import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_FILTER_STATE } from './pubmed'
import type { FilterState, SortMode, YearFilter } from './pubmed'

const ALL_PEPTIDES = [
  'BPC-157', 'TB-500', 'Ipamorelin', 'CJC-1295',
  'Semaglutide', 'Tirzepatide', 'Selank', 'Epithalon',
]

interface FilterSheetProps {
  open: boolean
  filters: FilterState
  resultCount: number
  onClose: () => void
  onChange: (filters: FilterState) => void
  onApply: () => void
}

export function FilterSheet({
  open,
  filters,
  resultCount,
  onClose,
  onChange,
  onApply,
}: FilterSheetProps) {
  const { t } = useTranslation()

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  function togglePeptide(p: string) {
    const next = filters.peptides.includes(p)
      ? filters.peptides.filter(x => x !== p)
      : [...filters.peptides, p]
    onChange({ ...filters, peptides: next })
  }

  function reset() {
    onChange(DEFAULT_FILTER_STATE)
  }

  return (
    <>
      {/* Backdrop — backdrop-filter is safe here (not a scrollable container) */}
      <div
        className="fixed inset-0 z-40"
        data-app-modal
        onClick={onClose}
      />

      {/* Sheet panel — NO backdrop-filter on this element or its children */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-700/60 border-b-0 rounded-t-2xl pointer-events-auto shadow-card">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-8 h-1 bg-slate-700 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-2 pb-3 border-b border-slate-800">
            <h2 className="text-sm font-black text-white">{t('lab_filter_title')}</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable content — NO backdrop-filter here (breaks overflow-y on iOS Safari) */}
          <div className="overflow-y-auto max-h-[55vh] px-4 py-4 space-y-5">
            {/* Peptid */}
            <div>
              <p className="label">{t('lab_filter_peptide')}</p>
              <div className="flex flex-wrap gap-2">
                {ALL_PEPTIDES.map(p => {
                  const active = filters.peptides.includes(p)
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePeptide(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        active
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Sortieren */}
            <div>
              <p className="label">{t('lab_filter_sort')}</p>
              <div className="flex gap-2">
                {(['date', 'relevance'] as SortMode[]).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChange({ ...filters, sort: s })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                      filters.sort === s
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {s === 'date' ? t('lab_filter_newest') : t('lab_filter_relevance')}
                  </button>
                ))}
              </div>
            </div>

            {/* Jahr */}
            <div>
              <p className="label">{t('lab_filter_year_label')}</p>
              <div className="flex gap-2">
                {(['all', '2024plus', '2025'] as YearFilter[]).map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => onChange({ ...filters, year: y })}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${
                      filters.year === y
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {y === 'all' ? t('lab_filter_year_all') : y === '2024plus' ? '2024+' : '2025'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 px-4 py-4 border-t border-slate-800">
            <button type="button" className="btn-secondary flex-1 text-sm" onClick={reset}>
              {t('lab_filter_reset')}
            </button>
            <button
              type="button"
              className="btn-primary text-sm"
              style={{ flex: 2 }}
              onClick={() => {
                onApply()
                onClose()
              }}
            >
              {t('lab_filter_apply', { count: resultCount })}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
