/**
 * Marker-Uebersicht als Karten, zwei nebeneinander: Name und Datum, der
 * Verlauf als Mini-Kurve mit den Grenzen des Referenzbereichs gestrichelt,
 * der neueste Wert und eine farbige Plakette (Gestaltung nach der Aktien-App).
 *
 * Farbe heisst hier Befund, nicht Richtung: gruen im Bereich, rot ausserhalb,
 * grau ohne Referenz. Ein Anstieg ist nicht von sich aus gut oder schlecht.
 * Die Plakette zeigt die Veraenderung zur vorigen Messung oder — nach Tippen,
 * fuer alle Karten — den Referenzbereich.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { markerName } from '../lib/markerCatalog.en'
import type { MarkerSummary } from '../lib/bloodwork'
import { formatDisplayDate, formatNumber, formatRange } from '../lib/format'
import { changeSincePrevious, markerStatus, sparklineGeometry, type MarkerStatus } from '../lib/sparkline'
import { MUTED, PILL_GRAY, PILL_GREEN, PILL_RED, TEXT } from '../styles'

export type PillMode = 'change' | 'range'

const STATUS_COLOR: Record<MarkerStatus, string> = {
  in: PILL_GREEN,
  out: PILL_RED,
  unchecked: PILL_GRAY,
  none: PILL_GRAY,
}

const SPARK_W = 140
const SPARK_H = 44

/** Mini-Kurve ueber die volle Kartenbreite; Linien bleiben beim Strecken gleich duenn. */
function Sparkline({ summary, color }: { summary: MarkerSummary; color: string }) {
  const g = sparklineGeometry(summary, SPARK_W, SPARK_H)
  return (
    <div style={{ position: 'relative' }}>
    <svg width="100%" height={SPARK_H} viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {g.bounds.map((y, i) => (
        <line key={i} x1={0} x2={SPARK_W} y1={y} y2={y} stroke={color} strokeOpacity={0.75} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      ))}
      {g.area && <path d={g.area} fill={color} fillOpacity={0.16} />}
      {g.line && <path d={g.line} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    </svg>
    {/* Letzter Wert als Punkt — ausserhalb des gestreckten SVG, damit er rund bleibt.
        Bei nur einer Messung ist er das Einzige, was den Wert zeigt. */}
    {g.last && (
      <span
        aria-hidden="true"
        style={{
          position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: color,
          left: `calc(${(g.last.x / SPARK_W) * 100}% - 3px)`, top: g.last.y - 3,
        }}
      />
    )}
    </div>
  )
}

function signed(value: number): string {
  // Erst runden, dann vergleichen: Umrechnungen hinterlassen Reste wie 1e-15.
  const rounded = Math.round(value * 1000) / 1000
  if (rounded === 0) return '±0'
  return `${rounded > 0 ? '+' : '−'}${formatNumber(Math.abs(rounded))}`
}

interface CardProps {
  summary: MarkerSummary
  pillMode: PillMode
  onSelect: (name: string) => void
  onTogglePill: () => void
}

const CARD_H = 180

function MarkerCard({ summary, pillMode, onSelect, onTogglePill }: CardProps) {
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
  // „Erstwert" nur, wenn es wirklich der erste ist; sonst sind die frueheren
  // Werte nicht in diese Einheit umrechenbar — dann kein Vergleich.
  const pillText = pillMode === 'change'
    ? (change != null ? signed(change) : summary.entries.length > 1 ? '—' : t('bw_pill_first'))
    : (referenz ?? t('bw_pill_no_range'))
  const statusText = t(`bw_status_${status}`)

  const ariaLabel = latest
    ? t('bw_row_aria', { name, value: `${formatNumber(shownValue!)} ${shownUnit ?? ''}`.trim(), status: statusText, date: formatDisplayDate(latest.tested_at) })
    : `${name}, ${t('bw_no_test').replace(/^[–-]\s*/, '')}`

  // Die ganze Karte oeffnet den Marker (unsichtbare Flaeche darunter); die
  // Plakette liegt darueber und hat ihre eigene Aufgabe. So bleibt der Inhalt
  // ein normales Layout — Wert und Plakette stehen nebeneinander, statt sich
  // bei langen Werten zu ueberlappen.
  return (
    <div className="bw-marker-card" style={{ position: 'relative', minHeight: CARD_H, opacity: latest ? 1 : 0.55 }}>
      <button
        type="button"
        onClick={() => onSelect(summary.name)}
        aria-label={ariaLabel}
        style={{ position: 'absolute', inset: 0, background: 'none', border: 'none', borderRadius: 'inherit', cursor: 'pointer', padding: 0 }}
      />
      <div
        style={{
          position: 'relative', minHeight: CARD_H, boxSizing: 'border-box', padding: '14px 12px 12px 14px', pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 6,
        }}
      >
        {/* Name, Datum und Wert stehen schon im Label der Karte. */}
        <div aria-hidden="true" style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: TEXT, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {latest ? formatDisplayDate(latest.tested_at) : t('bw_no_test')}
          </p>
        </div>
        {latest && <Sparkline summary={summary} color={color} />}
        {latest && (
          // Reicht der Platz nicht, rutscht die Plakette unter den Wert — nichts wird gekuerzt.
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
            <div aria-hidden="true" style={{ flexShrink: 0, maxWidth: '100%', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, lineHeight: 1.1, color: TEXT }}>{formatNumber(shownValue!)}</p>
              <p style={{ margin: 0, fontSize: 11, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis' }}>{shownUnit}</p>
            </div>
            <button
              type="button"
              onClick={onTogglePill}
              aria-label={t(pillMode === 'change' ? 'bw_pill_aria_change' : 'bw_pill_aria_range', { value: pillText, status: statusText })}
              data-bw-status={status}
              style={{
                pointerEvents: 'auto', flexShrink: 0, marginLeft: 'auto', minWidth: 56, minHeight: 32, padding: '0 8px',
                borderRadius: 7, border: 'none', background: color, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'right', whiteSpace: 'nowrap',
              }}
            >
              {pillText}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface Props {
  summaries: MarkerSummary[]
  pillMode: PillMode
  onTogglePill: () => void
  onSelect: (name: string) => void
}

const GRID = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 } as const

/**
 * Immer zwei Karten nebeneinander, gleich gross. Keine Kategorie-Ueberschriften:
 * sie liessen nach jeder ungeraden Kategorie eine halbe Reihe leer. Nach
 * Kategorie filtern die Tabs darueber.
 */
export function MarkerList({ summaries, pillMode, onTogglePill, onSelect }: Props) {
  const { t } = useTranslation()
  const [showUntested, setShowUntested] = useState(false)
  const tested = summaries.filter(s => s.latest)
  const untested = summaries.filter(s => !s.latest)

  if (summaries.length === 0) {
    return <p style={{ padding: '32px 0', textAlign: 'center', fontSize: 14, color: MUTED }}>{t('bw_no_markers')}</p>
  }

  const card = (s: MarkerSummary) => (
    <MarkerCard key={s.name} summary={s} pillMode={pillMode} onSelect={onSelect} onTogglePill={onTogglePill} />
  )

  return (
    <div>
      {tested.length > 0 && <div style={GRID}>{tested.map(card)}</div>}

      {untested.length > 0 && (
        <div style={{ marginTop: tested.length ? 8 : 0 }}>
          <button
            type="button"
            aria-expanded={showUntested}
            onClick={() => setShowUntested(v => !v)}
            style={{
              width: '100%', minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, color: MUTED,
            }}
          >
            {t('bw_untested_count', { count: untested.length })}
            <ChevronDown size={18} style={{ transform: showUntested ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>
          {showUntested && <div style={GRID}>{untested.map(card)}</div>}
        </div>
      )}
    </div>
  )
}
