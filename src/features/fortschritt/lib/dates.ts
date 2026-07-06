import { format, isValid, parseISO } from 'date-fns'

/** Formatiert yyyy-MM-dd sicher — invalid/leer wirft nicht. */
export function formatDaySafe(iso: string | null | undefined, pattern = 'dd.MM.'): string {
  if (!iso) return '?'
  const d = parseISO(`${iso.slice(0, 10)}T00:00:00`)
  if (!isValid(d)) return '?'
  return format(d, pattern)
}

export function parseDaySafe(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = parseISO(`${iso.slice(0, 10)}T00:00:00`)
  return isValid(d) ? d : null
}

export function dayToTsSafe(iso: string | null | undefined, hour = 12): number | null {
  const d = parseDaySafe(iso)
  if (!d) return null
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}
