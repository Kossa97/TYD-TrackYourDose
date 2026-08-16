import type { TrackingLevel } from '../types'

export type PkRequirement = 'complete_tracking' | 'method' | 'dose' | 'unit' | 'time'

export type PkReadiness =
  | { status: 'ready' }
  | { status: 'missing'; missing: PkRequirement[] }
  | { status: 'unsupported'; reason: string }

export interface PkReadinessInput {
  trackingLevel: TrackingLevel
  pkProfileId: string | null
  pkProfileMethod: string | null
  method: string | null
  dose: number | null
  unit: string | null
  scheduledAt: string | null
}

function normalizedText(value: string | null): string {
  return value?.trim().toLocaleLowerCase() ?? ''
}

export function toPkMilligrams(value: number, unit: string): number | null {
  if (!Number.isFinite(value)) return null
  const normalizedUnit = unit.trim().toLocaleLowerCase()
  if (normalizedUnit === 'mg') return value
  if (normalizedUnit === 'mcg') return value / 1000
  return null
}

export function evaluatePkReadiness(input: PkReadinessInput): PkReadiness {
  if (!input.pkProfileId?.trim()) {
    return { status: 'unsupported', reason: 'no_profile' }
  }

  const missing: PkRequirement[] = []
  if (input.trackingLevel !== 'complete') missing.push('complete_tracking')
  const method = normalizedText(input.method)
  if (!method || normalizedText(input.pkProfileMethod) !== method) missing.push('method')
  if (input.dose == null || !Number.isFinite(input.dose) || input.dose <= 0) missing.push('dose')
  if (!input.unit?.trim()) missing.push('unit')
  if (!input.scheduledAt?.trim()) missing.push('time')

  if (missing.length) return { status: 'missing', missing }
  if (toPkMilligrams(input.dose!, input.unit!) == null) {
    return { status: 'unsupported', reason: 'unit_conversion' }
  }

  return { status: 'ready' }
}
