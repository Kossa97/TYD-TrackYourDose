import { format, parseISO } from 'date-fns'

export function hoverDateIso(label: number | string): string {
  const ts = Number(label)
  if (!Number.isFinite(ts)) return String(label)
  return format(new Date(ts), 'yyyy-MM-dd')
}

export function isoFromTs(ts: number): string {
  return format(new Date(ts), 'yyyy-MM-dd')
}

/** Zyklen, deren Start (echt oder sichtbarer Balkenanfang) auf den Hover-Tag fällt */
export function cycleStartsAtHover<T extends { startDate: string; x1: number }>(
  bands: T[],
  hoverIso: string,
  hoverTs?: number,
): T[] {
  return bands.filter(b => {
    if (b.startDate === hoverIso) return true
    if (isoFromTs(b.x1) === hoverIso) return true
    if (hoverTs != null && Number.isFinite(hoverTs)) {
      const startTs = parseISO(`${b.startDate}T12:00:00`).getTime()
      if (Math.abs(hoverTs - startTs) < 12 * 60 * 60 * 1000) return true
      if (Math.abs(hoverTs - b.x1) < 12 * 60 * 60 * 1000) return true
    }
    return false
  })
}
