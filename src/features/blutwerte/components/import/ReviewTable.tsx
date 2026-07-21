import type { ExtractedValue } from '../../lib/extractResult'
import { conversionHint } from '../../lib/conversionHint'
import { CYAN, MUTED, TEXT } from '../../styles'

export interface ReviewRow extends ExtractedValue {
  /** Wird übernommen, wenn true. */
  selected: boolean
}

interface Props {
  rows: ReviewRow[]
  onChange: (index: number, row: ReviewRow) => void
}

export function ReviewTable({ rows, onChange }: Props) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-center py-6" style={{ color: MUTED }}>Keine Werte erkannt.</p>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => {
        const label = row.marker.trim() || 'Wert'
        return (
          <div
            key={index}
            className="rounded-2xl p-4"
            style={{
              border: `1px solid ${row.selected ? 'var(--accent-border)' : 'var(--border)'}`,
              opacity: row.selected ? 1 : 0.5,
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                checked={row.selected}
                onChange={() => onChange(index, { ...row, selected: !row.selected })}
                aria-label={row.selected ? `${label} abwählen` : `${label} auswählen`}
                className="shrink-0"
                style={{ width: 18, height: 18, accentColor: CYAN }}
              />

              <input
                className="input flex-1"
                aria-label="Marker"
                value={row.marker}
                onChange={e => onChange(index, { ...row, marker: e.target.value })}
              />

              {!row.matched && (
                <span className="badge shrink-0" style={{ background: 'var(--border)', color: MUTED }}>Neu</span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="label">Wert</label>
                <input
                  className="input"
                  inputMode="decimal"
                  aria-label="Wert"
                  value={String(row.value)}
                  onChange={e => onChange(index, { ...row, value: Number(e.target.value.replace(',', '.')) })}
                />
              </div>
              <div>
                <label className="label">Einheit</label>
                <input
                  className="input"
                  aria-label="Einheit"
                  value={row.unit}
                  onChange={e => onChange(index, { ...row, unit: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Ref. min</label>
                <input
                  className="input"
                  inputMode="decimal"
                  aria-label="Ref. min"
                  value={row.ref_min == null ? '' : String(row.ref_min)}
                  onChange={e => {
                    const raw = e.target.value.trim()
                    onChange(index, { ...row, ref_min: raw === '' ? null : Number(raw.replace(',', '.')) })
                  }}
                />
              </div>
              <div>
                <label className="label">Ref. max</label>
                <input
                  className="input"
                  inputMode="decimal"
                  aria-label="Ref. max"
                  value={row.ref_max == null ? '' : String(row.ref_max)}
                  onChange={e => {
                    const raw = e.target.value.trim()
                    onChange(index, { ...row, ref_max: raw === '' ? null : Number(raw.replace(',', '.')) })
                  }}
                />
              </div>
            </div>

            {(() => {
              const hint = conversionHint(row.marker, row.unit, row.value)
              return hint ? (
                <p className="text-xs mt-2" style={{ color: CYAN }}>
                  {hint} <span style={{ color: MUTED }}>· wird so im Verlauf angezeigt</span>
                </p>
              ) : null
            })()}
          </div>
        )
      })}

      <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
        <span className="font-bold" style={{ color: TEXT }}>Bitte prüfen:</span>{' '}
        Die Werte wurden automatisch erkannt und können Fehler enthalten.
      </p>
    </div>
  )
}
