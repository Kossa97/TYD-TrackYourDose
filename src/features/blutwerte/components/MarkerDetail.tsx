import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { markerErklaerung, markerName } from '../lib/markerCatalog.en'
import { format } from 'date-fns'
import { ArrowLeft, Info, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { CYAN, GREEN, MUTED, PANEL_STYLE, RED, RED_WEAK, TEXT } from '../styles'
import { TrendIcon, trendColor } from './trend'
import { ReferenceBar } from './ReferenceBar'
import { PLOT_LINKS, PLOT_RECHTS, ZyklusStreifen } from './ZyklusStreifen'
import type { CycleTimeline } from '../../../lib/planTimeline'
import { achse as zeitachse, achsenTicks, msTag, tagMs, zyklusZeilen } from '../lib/zyklusZeilen'

export type RangeFilter = '3M' | '6M' | '1J' | 'ALL'

/** Messpunkt in der Mitte seines Tags — dort, wo der Tag auch in den Zyklus-Zeilen liegt. */
const HALBER_TAG = 12 * 60 * 60 * 1000

interface Props {
  summary: MarkerSummary
  /** Zyklen aus My Stack fuer die Zeitstreifen unter dem Verlauf. */
  zyklen?: { timelines: CycleTimeline[]; namen: ReadonlyMap<string, string> }
  onBack: () => void
  onAdd: () => void
  onEdit: (entry: BloodworkEntry) => void
  onDelete: (entry: BloodworkEntry) => void
}

export function MarkerDetail({ summary, zyklen, onBack, onAdd, onEdit, onDelete }: Props) {
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('1J')

  const { name, entries, latest, range, inRange, trend, diff } = summary
  const shownValue = summary.displayValue ?? (latest ? latest.value : null)
  const shownUnit = summary.displayValue != null ? summary.displayUnit : (latest?.unit ?? '')

  const now = new Date()
  const cutoff = (() => {
    const d = new Date(now)
    if (rangeFilter === '3M') d.setMonth(d.getMonth() - 3)
    else if (rangeFilter === '6M') d.setMonth(d.getMonth() - 6)
    else if (rangeFilter === '1J') d.setFullYear(d.getFullYear() - 1)
    else return null
    return format(d, 'yyyy-MM-dd')
  })()

  // oldest -> newest for the chart. Die x-Achse ist echte Zeit (Tage), damit
  // die Zyklus-Zeilen darunter auf derselben Achse liegen.
  const windowPoints = summary.points.filter(p => (cutoff ? p.entry.tested_at >= cutoff : true))
  const chartData = windowPoints
    .filter(p => p.value != null)
    .slice()
    .sort((a, b) => a.entry.tested_at.localeCompare(b.entry.tested_at))
    .map(p => ({
      t: tagMs(p.entry.tested_at) + HALBER_TAG,
      value: p.value as number,
    }))

  const heute = format(now, 'yyyy-MM-dd')
  const letzterPunkt = chartData.length > 0 ? msTag(chartData[chartData.length - 1].t) : heute
  const fenster = {
    von: cutoff ?? (chartData.length > 0 ? msTag(chartData[0].t) : heute),
    // Ein Wert mit Datum in der Zukunft verlaengert die Achse, statt herauszufallen.
    bis: letzterPunkt > heute ? letzterPunkt : heute,
  }
  const achse = zeitachse(fenster)
  const ticks = achsenTicks(achse)
  const streifen = zyklen
    ? zyklusZeilen(zyklen.timelines, zyklen.namen, fenster, heute, Intl.DateTimeFormat().resolvedOptions().timeZone)
    : { zeilen: [], weitere: 0 }

  const excludedCount = windowPoints.filter(p => p.value == null).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          className="p-2 -ml-2 transition-colors"
          style={{ color: MUTED }}
          onClick={onBack}
          aria-label={t('back')}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold" style={{ color: TEXT }}>{markerName(name, sprache)}</h1>
        <button className="btn-primary flex items-center gap-1.5 text-sm" onClick={onAdd}>
          <Plus size={15} /> {t('bw_entry')}
        </button>
      </div>

      {/* Hero */}
      <div className="p-5 mb-4" style={PANEL_STYLE}>
        {latest ? (
          <>
            <div className="flex items-end justify-between">
              <p className="text-3xl font-bold" style={{ color: inRange === false ? RED : CYAN }}>
                {formatNumber(shownValue!)}
                <span className="text-base font-semibold ml-1.5" style={{ color: MUTED }}>{shownUnit}</span>
              </p>
              {trend && (
                <div className="flex items-center gap-1 text-sm font-semibold" style={{ color: trendColor(summary) }}>
                  <TrendIcon trend={trend} />
                  {trend === 'same' ? t('bw_trend_same') : formatNumber(Math.abs(diff))}
                </div>
              )}
            </div>
            {range.source !== 'none' ? (
              <div className="mt-4">
                <ReferenceBar
                  value={summary.displayValue ?? toNumber(latest.value)}
                  unit={shownUnit}
                  range={range}
                  inRange={inRange}
                />
              </div>
            ) : (
              <p className="text-xs mt-2" style={{ color: MUTED }}>{t('bw_no_reference_set')}</p>
            )}
            <div className="mt-3">
              {inRange === true && (
                <span className="badge" style={{ background: 'rgba(16,185,129,0.12)', color: GREEN }}>{t('bw_in_range')}</span>
              )}
              {inRange === false && (
                <span className="badge" style={{ background: RED_WEAK, color: RED }}>{t('bw_out_range')}</span>
              )}
              {inRange === null && (
                <span className="badge" style={{ background: 'var(--border)', color: MUTED }}>{t('bw_no_reference')}</span>
              )}
            </div>
          </>
        ) : (
          <p style={{ color: MUTED }}>{t('bw_no_test_for', { name: markerName(name, sprache) })}</p>
        )}
      </div>

      {/* Was ist das? */}
      <div className="p-5 mb-4" style={PANEL_STYLE}>
        <div className="flex items-center gap-2 mb-2">
          <Info size={15} style={{ color: CYAN }} />
          <p className="text-sm font-bold" style={{ color: TEXT }}>{t('bw_what_is')}</p>
        </div>
        {summary.def ? (
          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{markerErklaerung(summary.def, sprache)}</p>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
            {t('bw_no_explanation')}
          </p>
        )}
        <p className="text-xs mt-3" style={{ color: MUTED, opacity: 0.8 }}>{t('bw_disclaimer')}</p>
      </div>

      {/* Range filter */}
      <div className="flex gap-2 mb-4">
        {([['3M', t('bw_range_3m')], ['6M', t('bw_range_6m')], ['1J', t('bw_range_1y')], ['ALL', t('bw_range_all')]] as [RangeFilter, string][]).map(([key, label]) => (
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
            <LineChart data={chartData} margin={{ top: 8, right: PLOT_RECHTS, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="t"
                type="number"
                domain={achse}
                ticks={ticks}
                allowDataOverflow
                tickFormatter={(ms: number) => formatChartDate(msTag(ms))}
                tick={{ fill: 'rgba(154,170,191,0.55)', fontSize: 10 }}
              />
              <YAxis width={PLOT_LINKS} tick={{ fill: 'rgba(154,170,191,0.55)', fontSize: 10 }} />
              <Tooltip
                labelFormatter={label => (typeof label === 'number' ? formatDisplayDate(msTag(label)) : label)}
                formatter={value => [`${formatNumber(Number(value))} ${shownUnit}`, markerName(name, sprache)]}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--accent-border)', borderRadius: 12, color: 'var(--text)' }}
              />
              {range.min != null && range.max != null && (
                <ReferenceArea y1={range.min} y2={range.max} fill="rgba(16,185,129,0.08)" stroke="rgba(16,185,129,0.2)" />
              )}
              <Line type="monotone" dataKey="value" stroke="#00ccf5" strokeWidth={2} dot={{ fill: '#00ccf5', r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
          <ZyklusStreifen zeilen={streifen.zeilen} weitere={streifen.weitere} />
        </div>
      ) : (
        <div className="p-6 mb-4 text-center text-sm" style={{ ...PANEL_STYLE, color: MUTED }}>
          {t('bw_no_values_period')}
        </div>
      )}

      {excludedCount > 0 && (
        <p className="text-xs mb-4 -mt-2" style={{ color: MUTED }}>
          {excludedCount === 1 ? t('bw_excluded_one') : t('bw_excluded_many', { count: excludedCount })}
        </p>
      )}

      {/* Entry list */}
      <div style={PANEL_STYLE}>
        {entries.length === 0 && (
          <p className="p-5 text-sm text-center" style={{ color: MUTED }}>{t('bw_no_entries')}</p>
        )}
        {summary.points.map((p, i) => {
          const e = p.entry
          const v = p.value != null ? p.value : e.value
          const u = p.value != null ? summary.displayUnit : e.unit
          return (
            <div
              key={e.id}
              className="flex items-center justify-between px-5 py-3.5"
              style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
            >
              <span className="text-sm" style={{ color: MUTED }}>{formatDisplayDate(e.tested_at)}</span>
              <span className="text-sm font-semibold flex-1 text-right mr-2" style={{ color: TEXT }}>
                {formatNumber(v)} {u}
              </span>
              <button
                className="flex h-11 w-11 -my-2 items-center justify-center rounded-xl transition-colors hover:text-cyan-400"
                style={{ color: MUTED }}
                onClick={() => onEdit(e)}
                data-bw-entry-edit
                aria-label={t('bw_edit_aria', { value: `${formatNumber(e.value)} ${e.unit}`, date: formatDisplayDate(e.tested_at) })}
              >
                <Pencil size={15} />
              </button>
              <button
                className="flex h-11 w-11 -my-2 -mr-3 items-center justify-center rounded-xl transition-colors hover:text-red-400"
                style={{ color: MUTED }}
                onClick={() => onDelete(e)}
                data-bw-entry-delete
                aria-label={t('bw_delete_aria', { value: `${formatNumber(e.value)} ${e.unit}`, date: formatDisplayDate(e.tested_at) })}
              >
                <Trash2 size={15} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
