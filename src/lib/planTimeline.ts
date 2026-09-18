export type PlanEffectiveKind = 'instant' | 'local_date'
export type PlanChangeKind = 'initial' | 'dose' | 'schedule' | 'titration'
export type CycleLifecycleStatus = 'planned' | 'active' | 'paused' | 'ended'

export interface PlanScheduleSnapshot {
  frequency: string
  x_days_interval: number | null
  interval_unit: string | null
  cycle_on_days: number | null
  cycle_off_days: number | null
  schedule_days: string[]
  intake_time: string
  intake_time_custom: string | null
  slot_doses: string | null
  slot_days: string | null
  dose: number | null
  unit: string | null
  method: string
}

export interface CyclePlanVersion extends PlanScheduleSnapshot {
  id: string
  cycle_id: string
  effective_kind: PlanEffectiveKind
  effective_at: string | null
  effective_local_date: string | null
  change_kind: PlanChangeKind
}

export interface TimelineCycle {
  id: string
  stack_item_id: string
  started_at: string
  ended_at: string | null
}

export interface CyclePausePeriod {
  id: string
  cycle_id: string
  paused_at: string
  ends_at: string | null
}

export interface CycleTimeline {
  cycle: TimelineCycle
  versions: CyclePlanVersion[]
  pauses: CyclePausePeriod[]
}

export interface ResolvedCycleAt {
  status: CycleLifecycleStatus
  planVersion: CyclePlanVersion | null
  pause: CyclePausePeriod | null
}

interface ResolutionTarget {
  localKey: string
  instantMs: number | null
}

interface VersionCandidate {
  version: CyclePlanVersion
  key: string
  instantMs: number | null
}

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function instantMillis(value: string, label: string): number {
  const millis = new Date(value).getTime()
  if (!Number.isFinite(millis)) {
    throw new Error(`Invalid date for ${label}: ${value}`)
  }
  return millis
}

function localDateKey(value: string, label: string): string {
  const match = LOCAL_DATE_PATTERN.exec(value)
  if (!match) {
    throw new Error(`Invalid local date for ${label}: ${value}`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid local date for ${label}: ${value}`)
  }

  return `${value}|00:00:00`
}

function hasReachedInstant(
  value: string,
  label: string,
  target: ResolutionTarget,
  timeZone: string,
): boolean {
  const boundaryMs = instantMillis(value, label)
  if (target.instantMs !== null) return boundaryMs <= target.instantMs
  return localDateTimeKey(new Date(boundaryMs), timeZone) <= target.localKey
}

function resolvePlanVersion(
  versions: CyclePlanVersion[],
  target: ResolutionTarget,
  timeZone: string,
): CyclePlanVersion | null {
  const eligible: VersionCandidate[] = []
  for (const version of versions) {
    if (version.effective_kind === 'local_date') {
      if (version.effective_at !== null || version.effective_local_date === null) {
        throw new Error(`Invalid local-date boundary for plan version ${version.id}`)
      }
      const key = localDateKey(version.effective_local_date, `plan version ${version.id}`)
      if (key <= target.localKey) eligible.push({ version, key, instantMs: null })
      continue
    }

    if (version.effective_kind === 'instant') {
      if (version.effective_at === null || version.effective_local_date !== null) {
        throw new Error(`Invalid instant boundary for plan version ${version.id}`)
      }
      const millis = instantMillis(version.effective_at, `plan version ${version.id}`)
      const reached = target.instantMs === null
        ? localDateTimeKey(new Date(millis), timeZone) <= target.localKey
        : millis <= target.instantMs
      if (reached) {
        eligible.push({
          version,
          key: localDateTimeKey(new Date(millis), timeZone),
          instantMs: millis,
        })
      }
      continue
    }

    throw new Error(`Invalid effective kind for plan version ${version.id}`)
  }

  eligible.sort((left, right) => {
    const keyOrder = right.key.localeCompare(left.key)
    if (keyOrder !== 0) return keyOrder
    if (left.instantMs === null && right.instantMs !== null) return 1
    if (left.instantMs !== null && right.instantMs === null) return -1
    if (left.instantMs !== null && right.instantMs !== null) return right.instantMs - left.instantMs
    return right.version.id.localeCompare(left.version.id)
  })

  return eligible[0]?.version ?? null
}

function resolveTimeline(
  timeline: CycleTimeline,
  target: ResolutionTarget,
  timeZone: string,
): ResolvedCycleAt {
  const ended = timeline.cycle.ended_at !== null
    && hasReachedInstant(timeline.cycle.ended_at, 'cycle end', target, timeZone)
  const started = hasReachedInstant(timeline.cycle.started_at, 'cycle start', target, timeZone)
  const planVersion = resolvePlanVersion(timeline.versions, target, timeZone)

  if (ended) return { status: 'ended', planVersion, pause: null }
  if (!started) return { status: 'planned', planVersion, pause: null }

  const pause = timeline.pauses.find(period => {
    const pauseStarted = hasReachedInstant(period.paused_at, `pause ${period.id} start`, target, timeZone)
    const pauseEnded = period.ends_at !== null
      && hasReachedInstant(period.ends_at, `pause ${period.id} end`, target, timeZone)
    return pauseStarted && !pauseEnded
  }) ?? null

  return {
    status: pause ? 'paused' : 'active',
    planVersion,
    pause,
  }
}

export function localDateTimeKey(instant: Date, timeZone: string): string {
  if (!Number.isFinite(instant.getTime())) {
    throw new Error('Invalid date for local date-time key')
  }

  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant)
  } catch (error) {
    if (error instanceof RangeError) {
      throw new Error(`Invalid IANA time zone: ${timeZone}`, { cause: error })
    }
    throw error
  }

  const valueByType = new Map(parts.map(part => [part.type, part.value]))
  const year = valueByType.get('year')
  const month = valueByType.get('month')
  const day = valueByType.get('day')
  const hour = valueByType.get('hour')
  const minute = valueByType.get('minute')
  const second = valueByType.get('second')
  if (!year || !month || !day || !hour || !minute || !second) {
    throw new Error(`Could not format local date-time in time zone: ${timeZone}`)
  }

  return `${year}-${month}-${day}|${hour}:${minute}:${second}`
}

export function resolveCycleAt(
  timeline: CycleTimeline,
  target: Date,
  timeZone: string,
): ResolvedCycleAt {
  const instantMs = target.getTime()
  if (!Number.isFinite(instantMs)) {
    throw new Error('Invalid date for cycle resolution')
  }

  return resolveTimeline(timeline, {
    localKey: localDateTimeKey(target, timeZone),
    instantMs,
  }, timeZone)
}

export function resolveCycleAtLocalSlot(
  timeline: CycleTimeline,
  localDate: string,
  minutes: number,
  timeZone: string,
): ResolvedCycleAt {
  localDateKey(localDate, 'local slot')
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) {
    throw new Error(`Invalid local slot minutes: ${minutes}`)
  }

  // Validate the IANA zone even when the timeline contains no instant boundary.
  localDateTimeKey(new Date(0), timeZone)
  const hour = String(Math.floor(minutes / 60)).padStart(2, '0')
  const minute = String(minutes % 60).padStart(2, '0')
  return resolveTimeline(timeline, {
    localKey: `${localDate}|${hour}:${minute}:00`,
    instantMs: null,
  }, timeZone)
}
