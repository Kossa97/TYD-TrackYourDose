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

/**
 * Wie die Plankarte Tage schreibt: 22.09.2026 bzw. 09/22/2026.
 *
 * Nimmt auch einen Tag mit angehaengter Uhrzeit (`2026-09-22T08:00`) und
 * schreibt davon den Tag. Was kein Kalendertag ist — ein alter,
 * unvollstaendiger Eintrag wie `2026-9-1` —, kommt unveraendert zurueck,
 * statt die Seite mit einem RangeError anzuhalten.
 */
export function formatLocalDay(day: string, language: string): string {
  const tag = day.slice(0, 10)
  const datum = /^\d{4}-\d{2}-\d{2}$/.test(tag) ? new Date(`${tag}T00:00:00.000Z`) : null
  if (!datum || Number.isNaN(datum.getTime())) return day
  return new Intl.DateTimeFormat(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(datum)
}

/** Ein Zeitpunkt (timestamptz) als Tag, wie `formatLocalDay` ihn schreibt — in der Zeitzone des Geraets. */
export function formatInstantDay(instant: string, language: string): string {
  const datum = new Date(instant)
  if (Number.isNaN(datum.getTime())) return instant
  return new Intl.DateTimeFormat(language, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(datum)
}
