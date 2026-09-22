import { addDays, format, parseISO } from 'date-fns'

/**
 * Rechnen mit lokalen Kalendertagen (`YYYY-MM-DD`). Solche Tage tragen keine
 * Zeitzone mehr — die steckt schon darin, wie sie entstanden sind —, also
 * wird hier nur noch gezaehlt und verglichen.
 */
export function shiftLocalDay(day: string, offset: number): string {
  return format(addDays(parseISO(day), offset), 'yyyy-MM-dd')
}

/** Der spaetere zweier Tage; ISO-Tage lassen sich als Text vergleichen. */
export function laterLocalDay(left: string, right: string): string {
  return left > right ? left : right
}

/** Wie die Plankarte Tage schreibt: 22.09.2026 bzw. 09/22/2026. */
export function formatLocalDay(day: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00.000Z`))
}
