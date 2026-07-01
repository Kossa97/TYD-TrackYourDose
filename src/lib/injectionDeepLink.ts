import type { OpenInjectionIntake } from './injectionPersistence'

export const INJECTABLE_METHODS = ['Subkutan', 'Intramuskulär', 'Intramuskulaer'] as const

export function isInjectableMethod(method: string | null | undefined): boolean {
  return Boolean(method && INJECTABLE_METHODS.includes(method as typeof INJECTABLE_METHODS[number]))
}

export function getOpenInjectionIntakeKey(intake: OpenInjectionIntake): string {
  return intake.doseLogId ?? `${intake.cycleId}|${intake.scheduledAt}`
}

export function buildInjectionTrackerUrl({
  doseLogId,
  cycleId,
  scheduledAt,
  returnTo,
}: {
  doseLogId?: string | null
  cycleId?: string | null
  scheduledAt?: string | null
  returnTo?: string | null
}): string {
  const params = new URLSearchParams()
  if (doseLogId) params.set('doseLogId', doseLogId)
  else {
    if (cycleId) params.set('cycleId', cycleId)
    if (scheduledAt) params.set('scheduledAt', scheduledAt)
  }
  if (returnTo) params.set('returnTo', returnTo)
  const query = params.toString()
  return query ? `/injektionen?${query}` : '/injektionen'
}

export function findTargetInjectionIntake(
  intakes: OpenInjectionIntake[],
  params: URLSearchParams,
): OpenInjectionIntake | null {
  const doseLogId = params.get('doseLogId')
  if (doseLogId) {
    const byDoseLog = intakes.find(intake => intake.doseLogId === doseLogId)
    if (byDoseLog) return byDoseLog
  }

  const cycleId = params.get('cycleId')
  const scheduledAt = params.get('scheduledAt')
  if (!cycleId || !scheduledAt) return null

  const scheduledTime = new Date(scheduledAt).getTime()
  if (Number.isNaN(scheduledTime)) return null

  return intakes.find(intake => (
    intake.cycleId === cycleId && new Date(intake.scheduledAt).getTime() === scheduledTime
  )) ?? null
}
