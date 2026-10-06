import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { markerName } from '../lib/markerCatalog.en'
import { ArrowLeft, ChevronRight, LayoutGrid, List } from 'lucide-react'
import type { BloodworkEntry, BloodworkReport } from '../types'
import { effectiveRange, isInRange, toNumber } from '../lib/bloodwork'
import { normalizeMarker } from '../lib/markerCatalog'
import { formatDisplayDate, formatNumber, formatRange } from '../lib/format'
import { CYAN, MUTED, PANEL_STYLE, RED, TEXT } from '../styles'
import { BefundEditor } from './BefundEditor'

type Layout = 'liste' | 'raster'

const LAYOUT_KEY = 'blutwerte-befund-layout'

const loadLayout = (): Layout => {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'raster' ? 'raster' : 'liste'
  } catch {
    return 'liste'
  }
}

interface Props {
  reports: BloodworkReport[]
  entries: BloodworkEntry[]
  onChanged: () => void
}

const isAuffaellig = (entry: BloodworkEntry): boolean =>
  isInRange(toNumber(entry.value), effectiveRange(entry, normalizeMarker(entry.marker))) === false

export function BefundListe({ reports, entries, onChanged }: Props) {
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const werteLabel = (n: number) => (n === 1 ? t('bw_values_one') : t('bw_values_many', { count: n }))
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [layout, setLayout] = useState<Layout>(loadLayout)

  const chooseLayout = (next: Layout) => {
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      /* localStorage nicht verfügbar – Wahl gilt nur für diese Sitzung */
    }
  }

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
        {t('bw_reports_empty')}
      </div>
    )
  }

  if (openId) {
    const report = reports.find(r => r.id === openId)
    if (report) {
      const values = (byReport.get(report.id) ?? [])
        .slice()
        .sort((a, b) => markerName(a.marker, sprache).localeCompare(markerName(b.marker, sprache), sprache))

      return (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button
              className="p-2 -ml-2 transition-colors"
              style={{ color: MUTED }}
              onClick={() => setOpenId(null)}
              aria-label={t('back')}
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex-1">
              <p className="text-lg font-bold" style={{ color: TEXT }}>{formatDisplayDate(report.tested_at)}</p>
              {report.lab_name && <p className="text-xs" style={{ color: MUTED }}>{report.lab_name}</p>}
            </div>
            <button className="btn-secondary text-sm" onClick={() => setEditing(true)}>{t('bw_add_to')}</button>
          </div>

          {values.length > 1 && (
            <div className="flex justify-end mb-3">
              <div className="flex gap-1 p-1 rounded-full" style={{ border: '1px solid var(--border)' }}>
                <button
                  onClick={() => chooseLayout('liste')}
                  aria-label={t('bw_list_view')}
                  className="p-1.5 rounded-full transition-colors"
                  style={layout === 'liste' ? { background: 'var(--accent-weak)', color: CYAN } : { color: MUTED }}
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => chooseLayout('raster')}
                  aria-label={t('bw_grid_view')}
                  className="p-1.5 rounded-full transition-colors"
                  style={layout === 'raster' ? { background: 'var(--accent-weak)', color: CYAN } : { color: MUTED }}
                >
                  <LayoutGrid size={16} />
                </button>
              </div>
            </div>
          )}

          {values.length === 0 ? (
            <div style={PANEL_STYLE}>
              <p className="p-5 text-sm text-center" style={{ color: MUTED }}>{t('bw_report_no_values')}</p>
            </div>
          ) : layout === 'raster' ? (
            <div className="grid gap-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {values.map(entry => {
                const range = effectiveRange(entry, normalizeMarker(entry.marker))
                const referenz = formatRange(range.min, range.max, entry.unit)
                const auffaellig = isAuffaellig(entry)
                return (
                  <div
                    key={entry.id}
                    style={{ padding: 12, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <p className="text-xs font-semibold leading-tight" style={{ color: TEXT }}>{markerName(entry.marker, sprache)}</p>
                    <p className="text-base font-bold mt-1.5" style={{ color: auffaellig ? RED : TEXT }}>
                      {formatNumber(entry.value)}{' '}
                      <span className="text-xs font-semibold" style={{ color: MUTED }}>{entry.unit}</span>
                    </p>
                    {referenz && <p className="text-[0.6rem] mt-1 leading-tight" style={{ color: MUTED }}>{referenz}</p>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={PANEL_STYLE}>
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
                      <p className="text-sm font-semibold" style={{ color: TEXT }}>{markerName(entry.marker, sprache)}</p>
                      {referenz && <p className="text-xs mt-0.5" style={{ color: MUTED }}>{t('bw_reference', { range: referenz })}</p>}
                    </div>
                    <span className="text-sm font-bold" style={{ color: auffaellig ? RED : TEXT }}>
                      {formatNumber(entry.value)}{' '}
                      <span className="text-xs font-semibold" style={{ color: MUTED }}>{entry.unit}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {editing && (
            <BefundEditor
              report={report}
              entries={values}
              onClose={() => setEditing(false)}
              onSaved={() => { setEditing(false); onChanged() }}
            />
          )}
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
                {auffaelligCount > 0 && <span style={{ color: RED }}> · {t('bw_out_of_range_count', { count: auffaelligCount })}</span>}
              </p>
            </div>
            <ChevronRight size={18} style={{ color: MUTED }} />
          </button>
        )
      })}
    </div>
  )
}
