import type { TrackingLevel } from '../types'
import {
  effectiveQuantity,
  resolveScheduleSlots,
  scheduleForDay,
  type EscalationRow,
  type ScheduleCycle,
  type ScheduleSegment,
} from '../../../lib/intakeSchedule'

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
  /** IU je Milligramm aus dem PK-Profil; null, wenn die Substanz keinen hat. */
  iuPerMg?: number | null
}

export type PkScheduleCycle = ScheduleCycle & { method: string | null }

export type ResolvedPkSchedule = ScheduleSegment & {
  method: string | null
  scheduledAt: string | null
}

function normalizedText(value: string | null): string {
  return value?.trim().toLocaleLowerCase() ?? ''
}

/**
 * Rechnet eine geplante Menge in Milligramm um — die Waehrung, in der die
 * Blutspiegelkurve rechnet.
 *
 * `mg` und `mcg` gehen immer. **IU geht nur mit Faktor**, denn eine
 * Internationale Einheit ist keine Masse, sondern eine biologische Wirkstaerke:
 * ein Milligramm HGH sind 3 IU, ein Milligramm HCG rund 10.000. Der Faktor
 * gehoert deshalb zur Substanz und steht im PK-Profil (`iu_per_mg`), nicht hier.
 *
 * Ohne Faktor bleibt es bei `null` — und `null` heisst „koennen wir nicht
 * umrechnen", nicht „hat der Nutzer vergessen". Wer das verwechselt, laesst
 * eine Substanz aus der Kurve verschwinden, ohne zu sagen warum.
 */
export function toPkMilligrams(
  value: number,
  unit: string,
  iuPerMg: number | null = null,
): number | null {
  if (!Number.isFinite(value)) return null
  const normalizedUnit = unit.trim().toLocaleLowerCase()
  if (normalizedUnit === 'mg') return value
  if (normalizedUnit === 'mcg') return value / 1000
  if (normalizedUnit === 'iu') {
    if (iuPerMg == null || !Number.isFinite(iuPerMg) || iuPerMg <= 0) return null
    return value / iuPerMg
  }
  return null
}

export function resolvePkScheduleForDay(
  cycle: PkScheduleCycle,
  escalations: EscalationRow[],
  day: Date,
): ResolvedPkSchedule {
  const segment = scheduleForDay(cycle, day)
  const quantity = effectiveQuantity(cycle, day, escalations)
  return {
    ...segment,
    method: cycle.method,
    dose: quantity?.dose ?? null,
    unit: quantity?.unit ?? null,
    scheduledAt: resolveScheduleSlots(segment)[0]?.time ?? null,
  }
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
  if (toPkMilligrams(input.dose!, input.unit!, input.iuPerMg ?? null) == null) {
    return { status: 'unsupported', reason: 'unit_conversion' }
  }

  return { status: 'ready' }
}
