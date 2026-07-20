import { useState } from 'react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { BloodworkEntry, BloodworkReport } from '../types'
import { effectiveRange, isInRange, toNumber } from '../lib/bloodwork'
import { normalizeMarker } from '../lib/markerCatalog'
import { formatDisplayDate, formatNumber, formatRange } from '../lib/format'
import { MUTED, PANEL_STYLE, RED, TEXT } from '../styles'

interface Props {
  reports: BloodworkReport[]
  entries: BloodworkEntry[]
}

const werteLabel = (n: number) => (n === 1 ? '1 Wert' : `${n} Werte`)

const isAuffaellig = (entry: BloodworkEntry): boolean =>
  isInRange(toNumber(entry.value), effectiveRange(entry, normalizeMarker(entry.marker))) === false

export function BefundListe({ reports, entries }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)

  const byReport = new Map<string, BloodworkEntry[]>()
  entries.forEach(entry => {
    if (entry.report_id == null) return
    const bucket = byReport.get(entry.report_id) ?? []
    bucket.push(entry)
    byReport.set(entry.report_id, bucket)
  })

  if (reports.length === 0) {
    return (
      <div className="p-10 text-center" style={{ ...PANEL_STYLE, color: MUTED }}>
        Noch keine Befunde. Importiere einen Laborbefund, um alle Werte eines Termins zusammen zu sehen.
      </div>
    )
  }

  if (openId) {
    const report = reports.find(r => r.id === openId)
    if (report) {
      const values = (byReport.get(report.id) ?? [])
        .slice()
        .sort((a, b) => a.marker.localeCompare(b.marker, 'de'))

      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button
              className="p-2 -ml-2 transition-colors"
              style={{ color: MUTED }}
              onClick={() => setOpenId(null)}
              aria-label="Zurück"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="text-lg font-bold" style={{ color: TEXT }}>{formatDisplayDate(report.tested_at)}</p>
              {report.lab_name && <p className="text-xs" style={{ color: MUTED }}>{report.lab_name}</p>}
            </div>
          </div>

          <div style={PANEL_STYLE}>
            {values.length === 0 && (
              <p className="p-5 text-sm text-center" style={{ color: MUTED }}>Keine Werte zu diesem Befund.</p>
            )}
            {values.map((entry, i) => {
              const range = effectiveRange(entry, normalizeMarker(entry.marker))
              const referenz = formatRange(range.min, range.max, entry.unit)
              const auffaellig = isAuffaellig(entry)
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between px-5 py-3.5"
                  style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: TEXT }}>{entry.marker}</p>
                    {referenz && <p className="text-xs mt-0.5" style={{ color: MUTED }}>Referenz: {referenz}</p>}
                  </div>
                  <span className="text-sm font-bold" style={{ color: auffaellig ? RED : TEXT }}>
                    {formatNumber(entry.value)}{' '}
                    <span className="text-xs font-semibold" style={{ color: MUTED }}>{entry.unit}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
  }

  return (
    <div style={PANEL_STYLE}>
      {reports.map((report, i) => {
        const values = byReport.get(report.id) ?? []
        const auffaelligCount = values.filter(isAuffaellig).length
        return (
          <button
            key={report.id}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
            style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
            onClick={() => setOpenId(report.id)}
          >
            <div>
              <p className="text-sm font-bold" style={{ color: TEXT }}>{formatDisplayDate(report.tested_at)}</p>
              <p className="text-xs mt-0.5" style={{ color: MUTED }}>
                {report.lab_name ? `${report.lab_name} · ` : ''}
                {werteLabel(values.length)}
                {auffaelligCount > 0 && <span style={{ color: RED }}> · {auffaelligCount} auffällig</span>}
              </p>
            </div>
            <ChevronRight size={18} style={{ color: MUTED }} />
          </button>
        )
      })}
    </div>
  )
}
