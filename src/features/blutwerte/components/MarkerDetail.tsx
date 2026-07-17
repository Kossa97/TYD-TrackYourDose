import { useState } from 'react'
import { format } from 'date-fns'
import { ArrowLeft, Info, Plus, Trash2 } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MarkerSummary } from '../lib/bloodwork'
import { toNumber } from '../lib/bloodwork'
import type { BloodworkEntry } from '../types'
import { formatChartDate, formatDisplayDate, formatNumber } from '../lib/format'
import { CYAN, DISCLAIMER, GREEN, MUTED, PANEL_STYLE, RED, TEXT } from '../styles'
import { TrendIcon, trendColor } from './MarkerGrid'
import { ReferenceBar } from './ReferenceBar'

export type RangeFilter = '3M' | '6M' | '1J' | 'ALL'

interface Props {
  summary: MarkerSummary
  onBack: () => void
  onAdd: () => void
  onDelete: (entry: BloodworkEntry) => void
}

export function MarkerDetail({ summary, onBack, onAdd, onDelete }: Props) {
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('1J')

  const { name, entries, latest, range, inRange, trend, diff } = summary

  const now = new Date()
  const cutoff = (() => {
    const d = new Date(now)
    if (rangeFilter === '3M') d.setMonth(d.getMonth() - 3)
    else if (rangeFilter === '6M') d.setMonth(d.getMonth() - 6)
    else if (rangeFilter === '1J') d.setFullYear(d.getFullYear() - 1)
    else return null
    return format(d, 'yyyy-MM-dd')
  })()

  // oldest -> newest for the chart
  const chartData = entries
    .filter(e => (cutoff ? e.tested_at >= cutoff : true))
    .slice()
    .sort((a, b) => a.tested_at.localeCompare(b.tested_at))
    .map(e => ({
      date_label: formatChartDate(e.tested_at),
      value: toNumber(e.value),
    }))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          className="p-2 -ml-2 transition-colors"
          style={{ color: MUTED }}
          onClick={onBack}
          aria-label="Zurück"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold" style={{ color: TEXT }}>{name}</h1>
        <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={onAdd}>
          <Plus size={15} /> Eintrag
        </button>
      </div>

      {/* Hero */}
      <div className="p-5 mb-4" style={PANEL_STYLE}>
        {latest ? (
          <>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold" style={{ color: inRange === false ? RED : CYAN }}>
                {formatNumber(latest.value)}
                <span className="text-base font-semibold ml-1.5" style={{ color: MUTED }}>{latest.unit}</span>
              </p>
              {trend && (
                <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: trendColor(summary) }}>
                  <TrendIcon trend={trend} />
                  {trend === 'same' ? 'gleich' : formatNumber(Math.abs(diff))}
                </div>
              )}
            </div>
            {range.source !== 'none' ? (
              <div className="mt-4">
                <ReferenceBar
                  value={toNumber(latest.value)}
                  unit={latest.unit}
                  range={range}
                  inRange={inRange}
                />
              </div>
            ) : (
              <p className="text-xs mt-2" style={{ color: MUTED }}>Kein Referenzbereich hinterlegt</p>
            )}
            <div className="mt-3">
              {inRange === true && (
                <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: GREEN }}>Im Normalbereich</span>
              )}
              {inRange === false && (
                <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: RED }}>Außerhalb</span>
              )}
              {inRange === null && (
                <span className="badge" style={{ background: 'var(--border)', color: MUTED }}>Kein Referenzbereich</span>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: MUTED }}>Noch kein Test für {name}.</p>
        )}
      </div>

      {/* Was ist das? */}
      <div className="p-5 mb-4" style={PANEL_STYLE}>
        <div className="flex items-center gap-2 mb-2">
          <Info size={15} style={{ color: CYAN }} />
          <p className="text-sm font-bold" style={{ color: TEXT }}>Was ist das?</p>
        </div>
        {summary.def ? (
          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{summary.def.erklaerung}</p>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
            Für diesen Marker ist keine Erklärung hinterlegt. Er wurde aus einem importierten Befund übernommen.
          </p>
        )}
        <p className="text-xs mt-3" style={{ color: MUTED, opacity: 0.8 }}>{DISCLAIMER}</p>
      </div>

      {/* Range filter */}
      <div className="flex gap-2 mb-4">
        {([['3M', '3M'], ['6M', '6M'], ['1J', '1J'], ['ALL', 'Alles']] as [RangeFilter, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setRangeFilter(key)}
            className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
            style={
              rangeFilter === key
                ? { background: 'var(--accent-weak)', color: CYAN, border: '1px solid var(--accent-border)' }
                : { color: MUTED, border: '1px solid var(--border)' }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="p-4 mb-4" style={PANEL_STYLE}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date_label" tick={{ fill: 'rgba(154,170,191,0.55)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'rgba(154,170,191,0.55)', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--accent-border)', borderRadius: 12, color: 'var(--text)' }} />
              {range.min != null && range.max != null && (
                <ReferenceArea y1={range.min} y2={range.max} fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.2)" />
              )}
              <Line type="monotone" dataKey="value" stroke="#00ccf5" strokeWidth={2} dot={{ fill: '#00ccf5', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="p-6 mb-4 text-center text-sm" style={{ ...PANEL_STYLE, color: MUTED }}>
          Keine Werte im gewählten Zeitraum.
        </div>
      )}

      {/* Entry list */}
      <div style={PANEL_STYLE}>
        {entries.length === 0 && (
          <p className="p-5 text-sm text-center" style={{ color: MUTED }}>Noch keine Einträge.</p>
        )}
        {entries.map((entry, i) => (
          <div
            key={entry.id}
            className="flex items-center justify-between px-5 py-3.5"
            style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
          >
            <span className="text-sm" style={{ color: MUTED }}>{formatDisplayDate(entry.tested_at)}</span>
            <span className="text-sm font-semibold flex-1 text-right mr-3" style={{ color: TEXT }}>
              {formatNumber(entry.value)} {entry.unit}
            </span>
            <button
              className="p-1.5 transition-colors hover:text-red-400"
              style={{ color: MUTED }}
              onClick={() => onDelete(entry)}
              aria-label="Löschen"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
