import { format } from 'date-fns'
import type { ScheduleCycle, ScheduleSegment } from '../../../lib/intakeSchedule'
import {
  localDateTimeKey,
  localDateBoundaryInstant,
  resolveCycleAt,
  type CyclePlanVersion,
  type CycleTimeline,
} from '../../../lib/planTimeline'

/**
 * Was ab wann gilt.
 *
 * Ein Zyklus traegt seine Planstufen in `schedule_history`: je Stufe ein
 * VOLLSTAENDIGER Plan mit einem Stichdatum. `scheduleForDay` nimmt daraus die
 * juengste Stufe, deren Stichdatum nicht in der Zukunft liegt — dieselbe Regel
 * bestimmt hier, welche Stufe „jetzt" gilt.
 *
 * Ohne Historie gibt es genau eine Stufe: den Zyklus selbst, ab seinem Start.
 * So war es bei jedem Plan, der nie geaendert wurde.
 */
export type SegmentStatus = 'past' | 'current' | 'future'

export interface PlanSegment {
  segment: ScheduleSegment
  effectiveFrom: string
  status: SegmentStatus
}

export interface PlanVersionSegment {
  version: CyclePlanVersion
  effectiveFrom: string
  status: SegmentStatus
}

function versionBoundary(version: CyclePlanVersion, timeZone: string): string {
  if (version.effective_kind === 'local_date' && version.effective_local_date) {
    return `${version.effective_local_date}|00:00:00`
  }
  if (version.effective_kind === 'instant' && version.effective_at) {
    return localDateTimeKey(new Date(version.effective_at), timeZone)
  }
  throw new Error(`Invalid boundary for plan version ${version.id}`)
}

export function planVersionSegments(
  timeline: CycleTimeline,
  day: Date = new Date(),
  timeZone = 'UTC',
): PlanVersionSegment[] {
  const currentId = resolveCycleAt(timeline, day, timeZone).planVersion?.id ?? null
  return timeline.versions
    .map(version => ({ version, effectiveFrom: versionBoundary(version, timeZone), boundaryMs: version.effective_kind === 'instant'
      ? new Date(version.effective_at!).getTime() : localDateBoundaryInstant(version.effective_local_date!, timeZone).getTime() }))
    .sort((left, right) => (
      left.boundaryMs - right.boundaryMs
      || left.version.id.localeCompare(right.version.id)
    ))
    .map(({ version, effectiveFrom, boundaryMs }) => ({
      version,
      effectiveFrom,
      status: version.id === currentId
        ? 'current'
        : boundaryMs > day.getTime() ? 'future' : 'past',
    }))
}

/** Der flache Zyklus als Stufe — der Zustand vor der ersten Aenderung. */
function flacheStufe(cycle: ScheduleCycle): ScheduleSegment {
  return {
    effective_from: cycle.start_date,
    frequency: cycle.frequency,
    x_days_interval: cycle.x_days_interval,
    schedule_days: cycle.schedule_days,
    intake_time: cycle.intake_time,
    intake_time_custom: cycle.intake_time_custom,
    dose: cycle.dose,
    unit: cycle.unit,
    interval_unit: cycle.interval_unit ?? null,
    cycle_on_days: cycle.cycle_on_days ?? null,
    cycle_off_days: cycle.cycle_off_days ?? null,
    slot_doses: cycle.slot_doses ?? null,
    slot_days: cycle.slot_days ?? null,
  }
}

export function planSegments(cycle: ScheduleCycle, day: Date = new Date()): PlanSegment[] {
  const historie = cycle.schedule_history
  const roh = Array.isArray(historie) && historie.length > 0 ? historie : [flacheStufe(cycle)]

  // Zwei Stufen mit demselben Stichdatum kann es nicht geben — der RPC ersetzt
  // beim Speichern. Traegt eine alte Zeile sie doch, gilt die spaetere.
  const jeStichtag = new Map<string, ScheduleSegment>()
  for (const stufe of roh) {
    if (stufe?.effective_from) jeStichtag.set(stufe.effective_from, stufe)
  }
  const sortiert = [...jeStichtag.entries()]
    .sort(([links], [rechts]) => links.localeCompare(rechts))

  // „Jetzt" ist die letzte Stufe, die schon angefangen hat. Faengt die erste
  // erst in der Zukunft an, gilt noch keine — dann ist auch sie „kuenftig".
  const heute = format(day, 'yyyy-MM-dd')
  let laufende = -1
  sortiert.forEach(([stichtag], index) => {
    if (stichtag <= heute) laufende = index
  })

  return sortiert.map(([effectiveFrom, segment], index) => ({
    segment,
    effectiveFrom,
    status: index === laufende ? 'current' : index < laufende ? 'past' : 'future',
  }))
}

/** Nur Stufen, die noch nicht angefangen haben — nur die lassen sich zuruecknehmen. */
export function kuenftigeStufen(cycle: ScheduleCycle, day: Date = new Date()): PlanSegment[] {
  return planSegments(cycle, day).filter(stufe => stufe.status === 'future')
}

const SLOT_ZEITEN: Record<string, string> = { morgens: '08:00', mittags: '12:00', abends: '20:00' }

/**
 * Was eine Stufe je Einnahme vorsieht: „08:00 · 250 mg + 20:00 · 500 mg".
 *
 * Bewusst NUR Zeitpunkte und Mengen — das ist es, was sich zwischen zwei
 * Stufen unterscheidet. Der Rhythmus steht schon ueber der Liste; ihn in jeder
 * Zeile zu wiederholen macht sie unlesbar, ohne etwas zu sagen.
 */
export function stufenText(segment: ScheduleSegment): string {
  const zeitpunkte = (segment.intake_time ?? '').split(',').map(teil => teil.trim()).filter(Boolean)
  const uhrzeiten = (segment.intake_time_custom ?? '').split(',').map(teil => teil.trim())
  const mengen = (segment.slot_doses ?? '').split(',').map(teil => teil.trim())
  const einheit = segment.unit?.trim() ?? ''

  const zeilen = zeitpunkte.map((zeitpunkt, index) => {
    const wann = uhrzeiten[index] || SLOT_ZEITEN[zeitpunkt] || zeitpunkt
    const eigene = Number(mengen[index])
    const menge = (mengen[index] ?? '') !== '' && Number.isFinite(eigene) ? eigene : segment.dose
    return menge == null ? wann : `${wann} · ${menge} ${einheit}`.trimEnd()
  })

  return zeilen.join(' + ')
}
