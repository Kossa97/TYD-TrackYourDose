import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { InjectionLog3D } from './injectionLogTypes'

export function getInjectionPinAgeDays(loggedAt: string, now = new Date()) {
  return Math.max(0, differenceInCalendarDays(now, parseISO(loggedAt)))
}

export function formatInjectionPinAge(loggedAt: string, now = new Date()) {
  const days = getInjectionPinAgeDays(loggedAt, now)
  if (days === 0) return 'heute'
  if (days === 1) return 'vor 1 Tag'
  return 'vor ' + days + ' Tagen'
}

export function getInjectionPinAgeColor(loggedAt: string, now = new Date()) {
  const days = getInjectionPinAgeDays(loggedAt, now)
  if (days <= 1) return '#ef4444'
  if (days <= 3) return '#f97316'
  if (days <= 7) return '#facc15'
  return '#22c55e'
}

export function getInjectionPinSubstance(log: InjectionLog3D) {
  return log.peptide_name?.trim() || log.substance_label?.trim() || 'Injektion'
}
