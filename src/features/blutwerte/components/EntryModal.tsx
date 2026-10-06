import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { markerName } from '../lib/markerCatalog.en'
import toast from 'react-hot-toast'
import { CATALOG_MARKER_NAMES, normalizeMarker } from '../lib/markerCatalog'
import { conversionHint } from '../lib/conversionHint'
import { CYAN, MUTED, TEXT } from '../styles'

export interface EntryDraft {
  /** Gesetzt, wenn ein bestehender Wert bearbeitet wird. */
  id?: string
  /** Wert aus einem Befund: das Datum gehoert dem Befund und bleibt fest. */
  reportId?: string | null
  tested_at: string
  marker: string
  value: string
  unit: string
}

// eslint-disable-next-line react-refresh/only-export-components
export const emptyDraft = (marker = ''): EntryDraft => ({
  tested_at: format(new Date(), 'yyyy-MM-dd'),
  marker,
  value: '',
  unit: marker ? (normalizeMarker(marker)?.einheit ?? '') : '',
})

interface Props {
  draft: EntryDraft
  /** Marker ist fixiert, wenn das Modal aus der Detailansicht geöffnet wurde. */
  markerLocked: boolean
  saving: boolean
  onChange: (draft: EntryDraft) => void
  onCancel: () => void
  onSave: (parsed: { tested_at: string; marker: string; value: number; unit: string }) => void
}

export function EntryModal({ draft, markerLocked, saving, onChange, onCancel, onSave }: Props) {
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const setMarker = (marker: string) => {
    onChange({
      ...draft,
      marker,
      unit: normalizeMarker(marker)?.einheit ?? '',
    })
  }

  const save = () => {
    const marker = draft.marker.trim()
    const unit = draft.unit.trim()
    const parsedValue = Number(draft.value.replace(',', '.'))

    if (!draft.tested_at) return toast.error(t('bw_err_date'))
    if (!marker) return toast.error(t('bw_err_marker'))
    if (!Number.isFinite(parsedValue)) return toast.error(t('bw_err_value'))
    if (!unit) return toast.error(t('bw_err_unit'))

    onSave({ tested_at: draft.tested_at, marker, value: parsedValue, unit })
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
      data-app-modal
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh] rounded-t-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold" style={{ color: TEXT }}>{t(draft.id ? 'bw_edit_title' : 'bw_entry_title')}</h2>

        <div>
          <label className="label">{t('bw_marker')}</label>
          {markerLocked ? (
            <div
              className="rounded-2xl px-4 py-3 font-semibold"
              style={{ border: '1px solid var(--accent-border)', color: CYAN }}
            >
              {markerName(draft.marker, sprache)}
            </div>
          ) : (
            <select
              className="select"
              value={draft.marker}
              onChange={e => setMarker(e.target.value)}
            >
              <option value="">{t('bw_marker_choose')}</option>
              {CATALOG_MARKER_NAMES.map(marker => (
                <option key={marker} value={marker}>{markerName(marker, sprache)}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="label">{t('bw_date')}</label>
          <input
            className="input disabled:opacity-50 disabled:cursor-not-allowed"
            type="date"
            value={draft.tested_at}
            disabled={!!draft.reportId}
            aria-describedby={draft.reportId ? 'bw-date-from-report' : undefined}
            onChange={e => onChange({ ...draft, tested_at: e.target.value })}
          />
          {draft.reportId && (
            <p id="bw-date-from-report" className="text-xs mt-1.5" style={{ color: MUTED }}>{t('bw_date_from_report')}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">{t('bw_value')}</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="42.5"
              value={draft.value}
              onChange={e => onChange({ ...draft, value: e.target.value })}
            />
          </div>
          <div>
            <label className="label">{t('bw_unit')}</label>
            <input
              className="input"
              placeholder="ng/mL"
              value={draft.unit}
              onChange={e => onChange({ ...draft, unit: e.target.value })}
            />
          </div>
        </div>

        {(() => {
          const hint = conversionHint(draft.marker, draft.unit, Number(draft.value.replace(',', '.')))
          return hint ? (
            <p className="text-xs" style={{ color: CYAN }}>
              {hint} <span style={{ color: MUTED }}>{t('bw_conversion_note')}</span>
            </p>
          ) : null
        })()}

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" data-app-back-close onClick={onCancel}>{t('cancel')}</button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  )
}
