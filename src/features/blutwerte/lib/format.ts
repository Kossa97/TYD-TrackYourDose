import { format } from 'date-fns'
import { toNumber } from './bloodwork'

export const formatDisplayDate = (date: string) => format(new Date(`${date}T00:00:00`), 'dd.MM.yyyy')

export const formatChartDate = (date: string) => format(new Date(`${date}T00:00:00`), 'dd.MM.yy')

export const formatNumber = (value: number | string) => {
  const numeric = toNumber(value)
  if (!Number.isFinite(numeric)) return String(value)
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(numeric)
}

/** Menschlich lesbarer Referenztext, z.B. "400–900 ng/dL" oder "bis 1 mg/L". */
export const formatRange = (min: number | null, max: number | null, unit: string): string | null => {
  if (min == null && max == null) return null
  if (min != null && max != null) return `${formatNumber(min)}–${formatNumber(max)} ${unit}`.trim()
  if (max != null) return `bis ${formatNumber(max)} ${unit}`.trim()
  return `ab ${formatNumber(min as number)} ${unit}`.trim()
}
