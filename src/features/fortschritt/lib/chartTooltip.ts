import { format, parseISO } from 'date-fns'

export const TOOLTIP_CURSOR_PX_THRESHOLD = 14
/** Pixel-Radius, in dem der Cursor leicht zu Mess- und Zyklus-Startpunkten einrastet */
export const CURSOR_SOFT_SNAP_RADIUS_PX = 34
/** Maximale Einrast-Stärke (0 = frei, 1 = voll am Anker) */
export const CURSOR_MAX_SNAP_PULL = 0.55
/** Innerhalb dieses Abstands sitzt der Cursor voll auf dem Anker */
export const CURSOR_HARD_SNAP_PX = 7

export interface SnapAnchor {
  dateIso: string
  hoverTs: number
  x: number
}

export function smoothstep(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return clamped * clamped * (3 - 2 * clamped)
}

export function normalizeDateIso(value: string): string {
  return value.slice(0, 10)
}

export function hoverDateIso(label: number | string): string {
  const ts = Number(label)
  if (!Number.isFinite(ts)) return normalizeDateIso(String(label))
  return format(new Date(ts), 'yyyy-MM-dd')
}

/**
 * `startVisible` unterscheidet den echten Zyklus-Start vom Balkenanfang: Läuft ein
 * Zyklus schon vor dem Sichtfenster, wird sein x1 auf den Fensterrand geklemmt —
 * dort beginnt aber nichts, und beim Wischen wäre an jedem Rand ein Start.
 */
type BandWithStart = { id: string; startDate: string; x1: number; startVisible: boolean }

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
  bands: ReadonlyArray<{ startDate?: string; startVisible: boolean }>,
): string[] {
  const dates = new Set(metricDates.map(normalizeDateIso))
  for (const band of bands) {
    if (band.startVisible && band.startDate) dates.add(normalizeDateIso(band.startDate))
  }
  return [...dates].sort()
}

export function buildSnapAnchors(
  snapDates: readonly string[],
  xScale: XScale,
  plotArea: { x: number },
): SnapAnchor[] {
  const anchors: SnapAnchor[] = []
  for (const raw of snapDates) {
    const dateIso = normalizeDateIso(raw)
    const hoverTs = dateToTs(dateIso)
    const px = xScale(hoverTs, { position: 'start' })
    if (px == null) continue
    anchors.push({ dateIso, hoverTs, x: plotArea.x + px })
  }
  return anchors
}

export function resolveFluidCursorX(
  cursorX: number,
  anchors: readonly SnapAnchor[],
): { x: number; snapStrength: number; anchor: SnapAnchor | null } {
  if (anchors.length === 0) {
    return { x: cursorX, snapStrength: 0, anchor: null }
  }

  let nearest: { anchor: SnapAnchor; dist: number } | null = null
  for (const anchor of anchors) {
    const dist = Math.abs(cursorX - anchor.x)
    if (!nearest || dist < nearest.dist) nearest = { anchor, dist }
  }

  if (!nearest || nearest.dist >= CURSOR_SOFT_SNAP_RADIUS_PX) {
    return { x: cursorX, snapStrength: 0, anchor: null }
  }

  const t = 1 - nearest.dist / CURSOR_SOFT_SNAP_RADIUS_PX
  const ease = smoothstep(t)
  const snapStrength = nearest.dist <= CURSOR_HARD_SNAP_PX
    ? 1
    : ease * CURSOR_MAX_SNAP_PULL

  return {
    x: cursorX + (nearest.anchor.x - cursorX) * snapStrength,
    snapStrength,
    anchor: nearest.anchor,
  }
}

export function resolveFluidChartHover(
  cursorX: number | undefined,
  snapDates: readonly string[],
  xScale: XScale | undefined,
  xInverseScale: XInverseScale | undefined,
  plotArea: { x: number } | undefined,
): {
  fluidX: number
  dateIso: string
  hoverTs: number
  snapStrength: number
} | null {
  if (cursorX == null || !xScale || !plotArea) return null

  const anchors = buildSnapAnchors(snapDates, xScale, plotArea)
  const { x: fluidX, snapStrength, anchor } = resolveFluidCursorX(cursorX, anchors)

  if (anchor) {
    const anchorDist = Math.abs(cursorX - anchor.x)
    if (anchorDist <= CURSOR_SOFT_SNAP_RADIUS_PX) {
      return {
        fluidX,
        dateIso: anchor.dateIso,
        hoverTs: anchor.hoverTs,
        snapStrength,
      }
    }
  }

  const free = resolveCursorHoverDate(fluidX, xInverseScale)
  if (!free) return null

  return {
    fluidX,
    dateIso: free.dateIso,
    hoverTs: free.hoverTs,
    snapStrength,
  }
}

/** Zyklen, deren echter Start auf den Hover-Tag fällt */
export function cycleStartsAtHover<T extends BandWithStart>(
  bands: T[],
  hoverIso: string,
  hoverTs?: number,
): T[] {
  const hoverDay = normalizeDateIso(hoverIso)
  return bands.filter(b => {
    if (!b.startVisible) return false
    const startDay = normalizeDateIso(b.startDate)
    if (startDay === hoverDay) return true
    if (hoverTs != null && Number.isFinite(hoverTs)) {
      const startTs = parseISO(`${startDay}T12:00:00`).getTime()
      if (Math.abs(hoverTs - startTs) < 12 * 60 * 60 * 1000) return true
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

/** Zyklen, deren Start exakt auf den angegebenen Kalendertag fällt */
export function cycleStartsOnDate<T extends BandWithStart>(
  bands: T[],
  dateIso: string,
): T[] {
  const day = normalizeDateIso(dateIso)
  return bands.filter(b => b.startVisible && normalizeDateIso(b.startDate) === day)
}

export function resolveTooltipCycleStarts<T extends BandWithStart>(
  bands: T[],
  dateIso: string | null,
): T[] {
  if (!dateIso) return []
  return cycleStartsOnDate(bands, dateIso)
}

/** Tooltip-Inhalt strikt nach dem Cursor-Datum — kein Mischen benachbarter Tage. */
export function resolveChartTooltipContent<T extends BandWithStart>({
  hoverDateIso,
  bands,
  metricData,
}: {
  hoverDateIso: string | null
  bands: T[]
  metricData: ReadonlyArray<{ date: string; value: number | null }>
}): {
  dateIso: string
  metricValue: number | null
  starts: T[]
} | null {
  if (!hoverDateIso) return null

  const dateIso = normalizeDateIso(hoverDateIso)

  return {
    dateIso,
    metricValue: metricValueAtDate(metricData, dateIso),
    starts: cycleStartsOnDate(bands, dateIso),
  }
}
