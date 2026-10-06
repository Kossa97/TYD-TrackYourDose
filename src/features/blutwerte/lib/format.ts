import { toNumber } from './bloodwork'
import { aktiveSprache, uebersetze } from './sprache'

/**
 * Anzeige von Datum, Zahl und Referenzbereich in der aktiven Sprache.
 * Die Intl-Formatierer sind teuer im Aufbau — einer je Sprache und Art.
 */
const formatierer = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>()

function datumFormat(art: 'lang' | 'kurz'): Intl.DateTimeFormat {
  const sprache = aktiveSprache()
  const key = `${art}:${sprache}`
  let f = formatierer.get(key) as Intl.DateTimeFormat | undefined
  if (!f) {
    f = new Intl.DateTimeFormat(sprache, { day: '2-digit', month: '2-digit', year: art === 'lang' ? 'numeric' : '2-digit' })
    formatierer.set(key, f)
  }
  return f
}

function zahlFormat(): Intl.NumberFormat {
  const key = `zahl:${aktiveSprache()}`
  let f = formatierer.get(key) as Intl.NumberFormat | undefined
  if (!f) {
    f = new Intl.NumberFormat(aktiveSprache(), { maximumFractionDigits: 3 })
    formatierer.set(key, f)
  }
  return f
}

const alsDatum = (date: string) => new Date(`${date}T00:00:00`)

export const formatDisplayDate = (date: string) => datumFormat('lang').format(alsDatum(date))

export const formatChartDate = (date: string) => datumFormat('kurz').format(alsDatum(date))

export const formatNumber = (value: number | string) => {
  const numeric = toNumber(value)
  if (!Number.isFinite(numeric)) return String(value)
  return zahlFormat().format(numeric)
}

/** Menschlich lesbarer Referenztext, z.B. "400–900 ng/dL" oder "bis 1 mg/L" / "up to 1 mg/L". */
export const formatRange = (min: number | null, max: number | null, unit: string): string | null => {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${formatNumber(min)}–${formatNumber(max)} ${unit}`.trim()
  if (max != null) {
    const wert = formatNumber(max)
    return `${uebersetze('bw_range_up_to', `bis ${wert}`, { value: wert })} ${unit}`.trim()
  }
  const wert = formatNumber(min as number)
  return `${uebersetze('bw_range_from', `ab ${wert}`, { value: wert })} ${unit}`.trim()
}
