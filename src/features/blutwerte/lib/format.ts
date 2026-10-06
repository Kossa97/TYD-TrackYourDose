import i18next from 'i18next'
import { toNumber } from './bloodwork'

/**
 * Anzeige von Datum, Zahl und Referenzbereich in der aktiven Sprache.
 * Ohne initialisiertes i18n (Unit-Tests) gilt Deutsch.
 */
const sprache = (): string => i18next.resolvedLanguage ?? i18next.language ?? 'de'
const deutsch = () => sprache().toLowerCase().startsWith('de')

const alsDatum = (date: string) => new Date(`${date}T00:00:00`)

export const formatDisplayDate = (date: string) =>
  new Intl.DateTimeFormat(sprache(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(alsDatum(date))

export const formatChartDate = (date: string) =>
  new Intl.DateTimeFormat(sprache(), { day: '2-digit', month: '2-digit', year: '2-digit' }).format(alsDatum(date))

export const formatNumber = (value: number | string) => {
  const numeric = toNumber(value)
  if (!Number.isFinite(numeric)) return String(value)
  return new Intl.NumberFormat(sprache(), { maximumFractionDigits: 3 }).format(numeric)
}

/** Menschlich lesbarer Referenztext, z.B. "400–900 ng/dL" oder "bis 1 mg/L" / "up to 1 mg/L". */
export const formatRange = (min: number | null, max: number | null, unit: string): string | null => {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${formatNumber(min)}–${formatNumber(max)} ${unit}`.trim()
  if (max != null) return `${deutsch() ? 'bis' : 'up to'} ${formatNumber(max)} ${unit}`.trim()
  return `${deutsch() ? 'ab' : 'from'} ${formatNumber(min as number)} ${unit}`.trim()
}
