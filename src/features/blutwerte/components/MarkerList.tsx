/**
 * Marker-Uebersicht nach dem Vorbild der Aktien-App: eine Zeile je Marker,
 * links Name und Kategorie, in der Mitte der Verlauf als Mini-Kurve mit den
 * Grenzen des Referenzbereichs gestrichelt, rechts der neueste Wert und eine
 * farbige Plakette.
 *
 * Farbe heisst hier Befund, nicht Richtung: gruen im Bereich, rot ausserhalb,
 * grau ohne Referenz. Ein Anstieg ist nicht von sich aus gut oder schlecht.
 * Die Plakette zeigt die Veraenderung zur vorigen Messung oder — nach Tippen,
 * fuer alle Zeilen — den Referenzbereich, wie die Aktien-App zwischen
 * Veraenderung und Marktkapitalisierung wechselt.
 */
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { KATEGORIE_KEY, markerName } from '../lib/markerCatalog.en'
import type { KategorieFilter } from '../lib/markerCatalog'
import type { MarkerSummary } from '../lib/bloodwork'
import { formatDisplayDate, formatNumber, formatRange } from '../lib/format'
import { changeSincePrevious, markerStatus, sparklineGeometry, type MarkerStatus } from '../lib/sparkline'
import { MUTED, TEXT } from '../styles'

export type PillMode = 'change' | 'range'

const STATUS_COLOR: Record<MarkerStatus, string> = {
  in: '#22c55e',
  out: '#ef4444',
  unchecked: '#64748b',
  none: '#64748b',
}

const SPARK_W = 56
const SPARK_H = 36
const HAIRLINE = '1px solid var(--border)'

function Sparkline({ summary, color }: { summary: MarkerSummary; color: string }) {
  const gradId = useId()
  const g = sparklineGeometry(summary, SPARK_W, SPARK_H)
  return (
    <svg width={SPARK_W} height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true" style={{ flexShrink: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {g.bounds.map((y, i) => (
        <line key={i} x1={0} x2={SPARK_W} y1={y} y2={y} stroke={color} strokeOpacity={0.75} strokeWidth={1} strokeDasharray="3 3" />
      ))}
      {g.area && <path d={g.area} fill={`url(#${gradId})`} />}
      {g.line && <path d={g.line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />}
      {g.last && <circle cx={g.last.x} cy={g.last.y} r={2.5} fill={color} />}
    </svg>
  )
}

function signed(value: number): string {
  if (value === 0) return '±0'
  return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(Math.round(value * 1000) / 1000))}`
}

interface RowProps {
  summary: MarkerSummary
  pillMode: PillMode
  onSelect: (name: string) => void
  onTogglePill: () => void
}

function MarkerRow({ summary, pillMode, onSelect, onTogglePill }: RowProps) {
  const { t, i18n } = useTranslation()
  const sprache = i18n.resolvedLanguage ?? i18n.language
  const status = markerStatus(summary)
  const color = STATUS_COLOR[status]
  const latest = summary.latest
  const name = markerName(summary.name, sprache)
  const shownValue = summary.displayValue ?? latest?.value
  const shownUnit = summary.displayValue != null ? summary.displayUnit : latest?.unit ?? summary.displayUnit
  const change = changeSincePrevious(summary)
  const referenz = formatRange(summary.range.min, summary.range.max, '')
  const pillText = pillMode === 'change'
    ? (change != null ? signed(change) : t('bw_pill_first'))
    : (referenz ?? t('bw_pill_no_range'))
  const statusText = t(`bw_status_${status}`)

  return (
    <div style={{ display: 'flex', alignItems: 'center', borderBottom: HAIRLINE }}>
      <button
        type="button"
        onClick={() => onSelect(summary.name)}
        aria-label={latest
          ? t('bw_row_aria', { name, value: formatNumber(shownValue!), unit: shownUnit, status: statusText, date: formatDisplayDate(latest.tested_at) })
          : name}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 17, fontWeight: 800, color: TEXT, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </span>
          <span style={{ display: 'block', marginTop: 2, fontSize: 14, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {latest ? formatDisplayDate(latest.tested_at) : t('bw_no_test')}
          </span>
        </span>
        {latest && <Sparkline summary={summary} color={color} />}
        {latest && (
          <span style={{ flexShrink: 0, minWidth: 44, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ display: 'block', fontSize: 18, fontWeight: 700, color: TEXT, whiteSpace: 'nowrap' }}>
              {formatNumber(shownValue!)}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {shownUnit}
            </span>
          </span>
        )}
      </button>
      {latest && (
        <button
          type="button"
          onClick={onTogglePill}
          aria-label={t(pillMode === 'change' ? 'bw_pill_aria_change' : 'bw_pill_aria_range', { value: pillText, status: statusText })}
          data-bw-status={status}
          style={{
            marginLeft: 8, flexShrink: 0, minWidth: 66, minHeight: 32, padding: '0 8px', borderRadius: 7, border: 'none',
            background: color, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap',
          }}
        >
          {pillText}
        </button>
      )}
    </div>
  )
}

interface Props {
  summaries: MarkerSummary[]
  grouped: boolean
  pillMode: PillMode
  onTogglePill: () => void
  onSelect: (name: string) => void
}

export function MarkerList({ summaries, grouped, pillMode, onTogglePill, onSelect }: Props) {
  const { t } = useTranslation()
  const [showUntested, setShowUntested] = useState(false)
  const tested = summaries.filter(s => s.latest)
  const untested = summaries.filter(s => !s.latest)

  if (summaries.length === 0) {
    return <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: MUTED }}>{t('bw_no_markers')}</p>
  }

  const row = (s: MarkerSummary) => (
    <MarkerRow key={s.name} summary={s} pillMode={pillMode} onSelect={onSelect} onTogglePill={onTogglePill} />
  )

  const groups: Array<{ kategorie: string; items: MarkerSummary[] }> = []
  if (grouped) {
    for (const s of tested) {
      const current = groups[groups.length - 1]
      if (current && current.kategorie === s.kategorie) current.items.push(s)
      else groups.push({ kategorie: s.kategorie, items: [s] })
    }
  }

  return (
    <div>
      {grouped
        ? groups.map(group => (
          <section key={group.kategorie} aria-label={t(KATEGORIE_KEY[group.kategorie as KategorieFilter] ?? group.kategorie)}>
            <h3 style={{ margin: '18px 0 0', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>
              {t(KATEGORIE_KEY[group.kategorie as KategorieFilter] ?? group.kategorie)}
            </h3>
            {group.items.map(row)}
          </section>
        ))
        : tested.map(row)}

      {untested.length > 0 && (
        <div style={{ marginTop: tested.length ? 8 : 0 }}>
          <button
            type="button"
            aria-expanded={showUntested}
            onClick={() => setShowUntested(v => !v)}
            style={{
              width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', borderBottom: showUntested ? HAIRLINE : 'none', padding: 0,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: MUTED,
            }}
          >
            {t('bw_untested_count', { count: untested.length })}
            <ChevronDown size={18} style={{ transform: showUntested ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>
          {showUntested && untested.map(row)}
        </div>
      )}
    </div>
  )
}
