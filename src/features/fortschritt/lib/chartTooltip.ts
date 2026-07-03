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

export function mergeCycleStarts<T extends BandWithStart>(...groups: T[][]): T[] {
  const seen = new Set<string>()
  const merged: T[] = []
  for (const group of groups) {
    for (const band of group) {
      if (seen.has(band.id)) continue
      seen.add(band.id)
      merged.push(band)
    }
  }
  return merged
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

/** Zyklen, deren Start-Marker in Pixelnähe zum Tooltip-Cursor liegen */
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

export function resolveTooltipCycleStarts<T extends BandWithStart>(args: {
  bands: T[]
  dateIso: string | null
  hoverTs?: number
  cursorX?: number
  xScale?: XScale
  plotArea?: { x: number }
}): T[] {
  const { bands, dateIso, hoverTs, cursorX, xScale, plotArea } = args
  const byDate = dateIso ? cycleStartsAtHover(bands, dateIso, hoverTs) : []
  const byCursor = cycleStartsNearCursor(bands, cursorX, xScale, plotArea)
  return mergeCycleStarts(byDate, byCursor)
}
