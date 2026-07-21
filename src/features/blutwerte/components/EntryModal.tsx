import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { CATALOG_MARKER_NAMES, normalizeMarker } from '../lib/markerCatalog'
import { conversionHint } from '../lib/conversionHint'
import { CYAN, MUTED, TEXT } from '../styles'

export interface EntryDraft {
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

    if (!draft.tested_at) return toast.error('Bitte ein Testdatum eintragen')
    if (!marker) return toast.error('Bitte einen Marker auswählen')
    if (!Number.isFinite(parsedValue)) return toast.error('Bitte einen gültigen Wert eintragen')
    if (!unit) return toast.error('Bitte eine Einheit eintragen')

    onSave({ tested_at: draft.tested_at, marker, value: parsedValue, unit })
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg p-6 pb-8 space-y-4 overflow-y-auto max-h-[90vh] rounded-t-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold" style={{ color: TEXT }}>Neuer Eintrag</h2>

        <div>
          <label className="label">Marker</label>
          {markerLocked ? (
            <div
              className="rounded-2xl px-4 py-3 font-semibold"
              style={{ border: '1px solid var(--accent-border)', color: CYAN }}
            >
              {draft.marker}
            </div>
          ) : (
            <select
              className="select"
              value={draft.marker}
              onChange={e => setMarker(e.target.value)}
            >
              <option value="">Marker auswählen</option>
              {CATALOG_MARKER_NAMES.map(marker => (
                <option key={marker} value={marker}>{marker}</option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="label">Datum</label>
          <input
            className="input"
            type="date"
            value={draft.tested_at}
            onChange={e => onChange({ ...draft, tested_at: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Wert</label>
            <input
              className="input"
              inputMode="decimal"
              placeholder="42.5"
              value={draft.value}
              onChange={e => onChange({ ...draft, value: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Einheit</label>
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
              {hint} <span style={{ color: MUTED }}>· wird so im Verlauf angezeigt</span>
            </p>
          ) : null
        })()}

        <div className="flex gap-3 pt-2">
          <button className="btn-secondary flex-1" onClick={onCancel}>Abbrechen</button>
          <button className="btn-primary flex-1" onClick={save} disabled={saving}>
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}
