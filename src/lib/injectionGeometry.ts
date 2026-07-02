// src/lib/injectionGeometry.ts
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type {
  BodyRegion,
  BodySide,
  InjectionLog3D,
  InjectionPinDraft,
  InjectionProximityWarning,
  Vector3Json,
} from './injectionLogTypes'

const CAUTION_DISTANCE = 0.09
const STRONG_DISTANCE = 0.04

function distance(a: Vector3Json, b: Vector3Json): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function sideFromX(x: number): BodySide {
  if (x > 0.06) return 'right'
  if (x < -0.06) return 'left'
  return 'center'
}

function regionFromPoint(point: Vector3Json, normal?: Vector3Json): BodyRegion {
  const isRearSurface = (normal?.z ?? 0) < -0.35
  const distanceFromCenter = Math.abs(point.x)
  if (point.y > 0.58) return distanceFromCenter > 0.38 ? 'deltoid' : 'chest'
  if (distanceFromCenter > 0.5) return point.y > 0.15 ? 'upper_arm' : 'forearm'
  if (isRearSurface && point.y <= -0.15 && point.y > -0.58) return 'glute'
  if (point.y > -0.2) return 'abdomen'
  if (point.y > -0.78) return 'thigh'
  if (point.y > -1.24) return 'lower_leg'
  return 'outside_typical'
}

export function inferBodyRegion(
  point: Vector3Json,
  normal?: Vector3Json,
): { body_region: BodyRegion; body_side: BodySide } {
  return {
    body_region: regionFromPoint(point, normal),
    body_side: sideFromX(point.x),
  }
}

export function filterRecentInjectionLogs(
  logs: InjectionLog3D[],
  now: Date,
  days: number,
): InjectionLog3D[] {
  return logs.filter(log => {
    const age = differenceInCalendarDays(now, parseISO(log.logged_at))
    return age >= 0 && age <= days
  })
}

export function proximityWarning(
  draft: InjectionPinDraft,
  logs: InjectionLog3D[],
  now: Date,
): InjectionProximityWarning {
  const recent = filterRecentInjectionLogs(logs, now, 7)
  let nearest: { log: InjectionLog3D; distance: number } | null = null

  for (const log of recent) {
    if (log.model_version !== draft.model_version) continue
    const d = distance(draft.position, log.position)
    if (!nearest || d < nearest.distance) nearest = { log, distance: d }
  }

  if (!nearest || nearest.distance > CAUTION_DISTANCE) {
    return { level: 'none', nearestLogId: null, distance: null }
  }

  const age = differenceInCalendarDays(now, parseISO(nearest.log.logged_at))
  return {
    level: nearest.distance <= STRONG_DISTANCE && age <= 3 ? 'strong' : 'caution',
    nearestLogId: nearest.log.id,
    distance: nearest.distance,
  }
}
