import { format, parseISO } from 'date-fns'

export const TOOLTIP_CURSOR_PX_THRESHOLD = 14

export function normalizeDateIso(value: string): string {
  return value.slice(0, 10)
}

export function hoverDateIso(label: number | string): string {
  const ts = Number(label)
  if (!Number.isFinite(ts)) return normalizeDateIso(String(label))
  return format(new Date(ts), 'yyyy-MM-dd')
}

export function isoFromTs(ts: number): string {
  return format(new Date(ts), 'yyyy-MM-dd')
}

type BandWithStart = { id: string; startDate: string; x1: number }

type XInverseScale = (pixelX: number) => unknown

function toHoverTs(value: unknown): number | null {
  const ts = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(ts) ? ts : null
}

/** Datum unter dem Tooltip-Cursor (X-Achse), nicht der gesnappte Linienpunkt */
export function resolveCursorHoverDate(
  cursorX: number | undefined,
  xInverseScale: XInverseScale | undefined,
): { dateIso: string; hoverTs: number } | null {
  if (cursorX == null || !xInverseScale) return null
  const hoverTs = toHoverTs(xInverseScale(cursorX))
  if (hoverTs == null) return null
  return { dateIso: hoverDateIso(hoverTs), hoverTs }
}

export function metricValueAtDate(
  chartData: ReadonlyArray<{ date: string; value: number | null }>,
  dateIso: string,
): number | null {
  const day = normalizeDateIso(dateIso)
  const point = chartData.find(p => normalizeDateIso(p.date) === day)
  if (!point || point.value == null || !Number.isFinite(point.value)) return null
  return point.value
}

/** Alle Tage, an denen der Tooltip-Cursor einrasten soll (Messwerte + sichtbare Zyklus-Starts) */
export function buildTooltipSnapDates(
  metricDates: string[],
  bands: ReadonlyArray<{ x1: number }>,
): string[] {
  const dates = new Set(metricDates.map(normalizeDateIso))
  for (const band of bands) {
    dates.add(isoFromTs(band.x1))
  }
  return [...dates].sort()
}

/** Zyklen, deren Start (echt oder sichtbarer Balkenanfang) auf den Hover-Tag fällt */
export function cycleStartsAtHover<T extends BandWithStart>(
  bands: T[],
  hoverIso: string,
  hoverTs?: number,
): T[] {
  const hoverDay = normalizeDateIso(hoverIso)
  return bands.filter(b => {
    const startDay = normalizeDateIso(b.startDate)
    if (startDay === hoverDay) return true
    if (isoFromTs(b.x1) === hoverDay) return true
    if (hoverTs != null && Number.isFinite(hoverTs)) {
      const startTs = parseISO(`${startDay}T12:00:00`).getTime()
      if (Math.abs(hoverTs - startTs) < 12 * 60 * 60 * 1000) return true
      if (Math.abs(hoverTs - b.x1) < 12 * 60 * 60 * 1000) return true
    }
    return false
  })
}

type XScale = (value: number, options?: { position?: 'start' | 'end' }) => number | undefined

function dateToTs(date: string): number {
  return parseISO(`${normalizeDateIso(date)}T12:00:00`).getTime()
}

/** Nächster Snap-Tag (Messwert oder Zyklus-Start) zur Cursor-X-Position */
export function nearestSnapHoverDate(
  cursorX: number | undefined,
  snapDates: readonly string[],
  xScale: XScale | undefined,
  plotArea: { x: number } | undefined,
): { dateIso: string; hoverTs: number } | null {
  if (cursorX == null || !xScale || !plotArea || snapDates.length === 0) return null

  let best: { dateIso: string; hoverTs: number; dist: number } | null = null
  for (const raw of snapDates) {
    const dateIso = normalizeDateIso(raw)
    const hoverTs = dateToTs(dateIso)
    const px = xScale(hoverTs, { position: 'start' })
    if (px == null) continue
    const dist = Math.abs(cursorX - (plotArea.x + px))
    if (!best || dist < best.dist) {
      best = { dateIso, hoverTs, dist }
    }
  }

  return best
}

/** Zyklen, deren Start-Marker in Pixelnähe zum Tooltip-Cursor liegen (nur Marker-Hervorhebung) */
export function cycleStartsNearCursor<T extends BandWithStart>(
  bands: T[],
  cursorX: number | undefined,
  xScale: XScale | undefined,
  plotArea: { x: number } | undefined,
  threshold = TOOLTIP_CURSOR_PX_THRESHOLD,
): T[] {
  if (cursorX == null || !xScale || !plotArea) return []

  return bands.filter(band => {
    const px1 = xScale(band.x1, { position: 'start' })
    if (px1 == null) return false
    const startX = plotArea.x + px1
    return Math.abs(cursorX - startX) <= threshold
  })
}

export function resolveTooltipCycleStarts<T extends BandWithStart>(
  bands: T[],
  dateIso: string | null,
  hoverTs?: number,
): T[] {
  if (!dateIso) return []
  return cycleStartsAtHover(bands, dateIso, hoverTs)
}
