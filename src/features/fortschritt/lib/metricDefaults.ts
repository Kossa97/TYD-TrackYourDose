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
