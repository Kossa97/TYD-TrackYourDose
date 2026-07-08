import type { DailyLogEntry, WeightLogEntry } from '../types'

export function weightForDate(
  weightLogs: WeightLogEntry[],
  date: string,
): { kg: number; id: string } | null {
  const hit = weightLogs
    .filter(w => w.logged_at.slice(0, 10) === date)
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0]
  if (!hit || hit.id == null) return null
  return { kg: hit.weight_kg, id: hit.id }
}

export function lastWeightBefore(weightLogs: WeightLogEntry[], date: string): number | null {
  const hit = weightLogs
    .filter(w => w.logged_at.slice(0, 10) < date)
    .sort((a, b) => b.logged_at.localeCompare(a.logged_at))[0]
  return hit?.weight_kg ?? null
}

export function bodyFatForDate(logs: DailyLogEntry[], date: string): number | null {
  return logs.find(l => l.log_date === date)?.body_fat_pct ?? null
}

export function lastBodyFatBefore(logs: DailyLogEntry[], date: string): number | null {
  const hit = logs
    .filter(l => l.log_date < date && l.body_fat_pct != null)
    .sort((a, b) => b.log_date.localeCompare(a.log_date))[0]
  return hit?.body_fat_pct ?? null
}

export function hasLogForDate(
  logs: DailyLogEntry[],
  weightLogs: WeightLogEntry[],
  date: string,
): boolean {
  if (weightForDate(weightLogs, date)) return true

  const log = logs.find(l => l.log_date === date)
  if (!log) return false

  return (
    (log.energie != null && log.energie > 0)
    || (log.schlaf != null && log.schlaf > 0)
    || (log.wohlbefinden != null && log.wohlbefinden > 0)
    || (log.libido != null && log.libido > 0)
    || log.body_fat_pct != null
  )
}

export interface LogFormValues {
  energie: number | null
  schlaf: number | null
  wohlbefinden: number | null
  libido: number | null
  bodyFat: number | null
  weight: number | null
  weightRowId: string | null
}

function wellnessValue(value: number | null | undefined): number | null {
  return value != null && value > 0 ? value : null
}

/** Lädt Tageswerte; „letzte Werte“ nur wenn für das Datum noch kein Eintrag existiert. */
export function loadLogFormValues(
  logs: DailyLogEntry[],
  weightLogs: WeightLogEntry[],
  date: string,
): LogFormValues {
  const existing = logs.find(l => l.log_date === date)
  const hasEntry = hasLogForDate(logs, weightLogs, date)
  const dayWeight = weightForDate(weightLogs, date)
  const dayBodyFat = bodyFatForDate(logs, date)

  return {
    energie: wellnessValue(existing?.energie),
    schlaf: wellnessValue(existing?.schlaf),
    wohlbefinden: wellnessValue(existing?.wohlbefinden),
    libido: wellnessValue(existing?.libido),
    bodyFat: hasEntry ? dayBodyFat : (dayBodyFat ?? lastBodyFatBefore(logs, date)),
    weight: hasEntry ? (dayWeight?.kg ?? null) : (dayWeight?.kg ?? lastWeightBefore(weightLogs, date)),
    weightRowId: dayWeight?.id ?? null,
  }
}
