import {
  addMonths,
  differenceInCalendarMonths,
  differenceInDays,
  format,
  parseISO,
} from 'date-fns'

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const WEEKDAYS_DE = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 0: 'So' }
const SLOT_TIMES = { morgens: '08:00', mittags: '12:00', abends: '20:00' }
const SLOT_GROUPS = { morgens: 'morning', mittags: 'midday', abends: 'evening' }

/**
 * Der Name eines Platzes im Einnahmeplan -- `<cycle-uuid>@2026-09-22T08:00`.
 *
 * Zwillingsstueck zu `src/features/routines/lib/slotKey.ts`, wo auch steht,
 * warum der Schluessel die Wanduhr traegt und nicht den Zeitpunkt. Hier muss
 * er dupliziert stehen, weil diese Datei zur Laufzeit als reines JavaScript
 * laeuft und nichts aus `src/` laden kann; `planTimeline.parity.test.js`
 * vergleicht beide Seiten gegeneinander und schlaegt fehl, sobald sie
 * auseinanderlaufen.
 */
function slotSchluessel(cycleId, localDate, minutes) {
  if (!LOCAL_DATE_PATTERN.test(localDate)) {
    throw new Error(`Slot-Schluessel braucht ein lokales Datum: ${localDate}`)
  }
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) {
    throw new Error(`Slot-Schluessel braucht eine Minute des Tages: ${minutes}`)
  }
  const zweistellig = wert => String(wert).padStart(2, '0')
  return `${cycleId}@${localDate}T${zweistellig(Math.floor(minutes / 60))}:${zweistellig(minutes % 60)}`
}

function instantMillis(value, label) {
  const millis = new Date(value).getTime()
  if (!Number.isFinite(millis)) throw new Error(`Invalid date for ${label}: ${value}`)
  return millis
}

function localDateKey(value, label) {
  const match = LOCAL_DATE_PATTERN.exec(value)
  if (!match) throw new Error(`Invalid local date for ${label}: ${value}`)

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

export function localDateTimeKey(instant, timeZone) {
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid date for local date-time key')

  let parts
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

function hasReachedInstant(value, label, target, timeZone) {
  const boundaryMs = instantMillis(value, label)
  if (target.instantMs !== null) return boundaryMs <= target.instantMs
  return localDateTimeKey(new Date(boundaryMs), timeZone) <= target.localKey
}

function resolvePlanVersion(versions, target, timeZone) {
  const eligible = []
  for (const version of versions) {
    if (version.effective_kind === 'local_date') {
      if (version.effective_at !== null || version.effective_local_date === null) {
        throw new Error(`Invalid local-date boundary for plan version ${version.id}`)
      }
      const key = localDateKey(version.effective_local_date, `plan version ${version.id}`)
      const instantMs = localDateBoundaryInstant(version.effective_local_date, timeZone).getTime()
      if (target.instantMs !== null ? instantMs <= target.instantMs : key <= target.localKey) {
        eligible.push({ version, key, instantMs })
      }
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
    const instantOrder = right.instantMs - left.instantMs
    if (instantOrder !== 0) return instantOrder
    const creationOrder = new Date(right.version.created_at ?? 0).getTime() - new Date(left.version.created_at ?? 0).getTime()
    if (creationOrder !== 0) return creationOrder
    return right.version.id.localeCompare(left.version.id)
  })
  return eligible[0]?.version ?? null
}

function resolveTimeline(timeline, target, timeZone) {
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

  return { status: pause ? 'paused' : 'active', planVersion, pause }
}

export function resolveCycleAt(timeline, target, timeZone) {
  const instantMs = target.getTime()
  if (!Number.isFinite(instantMs)) throw new Error('Invalid date for cycle resolution')
  return resolveTimeline(timeline, {
    localKey: localDateTimeKey(target, timeZone),
    instantMs,
  }, timeZone)
}

function parsedClock(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value?.trim() ?? '')
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { time: `${match[1]}:${match[2]}`, minutes: hours * 60 + minutes }
}

function routineGroupForMinutes(minutes) {
  const hour = Math.floor(minutes / 60) % 24
  if (hour < 12) return 'morning'
  if (hour < 18) return 'midday'
  return 'evening'
}

function resolveScheduleSlots(schedule, day) {
  const keys = (schedule.intake_time ?? '').split(',').filter(Boolean)
  const exactTimes = (schedule.intake_time_custom ?? '').split(',')
  const doses = (schedule.slot_doses ?? '').split(',')
  const days = (schedule.slot_days ?? '').split(',')
  const weekday = day ? WEEKDAYS_DE[day.getDay()] : null

  return keys.flatMap((key, index) => {
    const slotDays = (days[index] ?? '').split('|').map(value => value.trim()).filter(Boolean)
    if (weekday && slotDays.length > 0 && !slotDays.includes(weekday)) return []

    const clock = parsedClock(exactTimes[index]) ?? parsedClock(SLOT_TIMES[key])
    if (!clock) return []
    const amount = Number(doses[index])
    return [{
      key,
      routineGroup: SLOT_GROUPS[key] ?? routineGroupForMinutes(clock.minutes),
      dose: (doses[index] ?? '').trim() !== '' && Number.isFinite(amount) && amount > 0 ? amount : null,
      ...clock,
    }]
  }).sort((left, right) => left.minutes - right.minutes)
}

function timelineVersionAsCycle(timeline, version, timeZone) {
  const startDate = timeline.versions.find(version => version.change_kind === 'initial' && version.effective_kind === 'local_date')?.effective_local_date
    ?? timeline.cycle.start_local_date ?? localDateTimeKey(new Date(timeline.cycle.started_at), timeZone).slice(0, 10)
  return {
    start_date: startDate,
    end_date: null,
    frequency: version.frequency,
    x_days_interval: version.x_days_interval,
    schedule_days: version.schedule_days,
    interval_unit: version.interval_unit,
    cycle_on_days: version.cycle_on_days,
    cycle_off_days: version.cycle_off_days,
  }
}

function cycleAppliesToDay(cycle, day) {
  const start = parseISO(cycle.start_date)
  if (day < start) return false

  const frequency = cycle.frequency
  const dayOfWeek = WEEKDAYS_DE[day.getDay()]
  const diff = differenceInDays(day, start)
  const days = cycle.schedule_days ?? []
  const hasDayFilter = days.length > 0

  if (frequency === 'Bei Bedarf') return false
  if (frequency === 'Täglich' || frequency === '2x täglich' || frequency === '3x täglich') {
    return hasDayFilter ? days.includes(dayOfWeek) : true
  }
  if (frequency === 'Alle X Tage') {
    const unit = cycle.interval_unit ?? 'day'
    const interval = cycle.x_days_interval
    if (interval == null || !Number.isFinite(interval) || !Number.isInteger(interval) || interval < 1) return false
    if (unit === 'month') {
      if (interval > 12) return false
      const distance = differenceInCalendarMonths(day, start)
      return distance >= 0
        && distance % interval === 0
        && format(addMonths(start, distance), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
    }
    const step = unit === 'week' ? interval * 7 : interval
    if (step > 366) return false
    return diff % step === 0 && (hasDayFilter ? days.includes(dayOfWeek) : true)
  }
  if (frequency === 'Im Wechsel') {
    const on = cycle.cycle_on_days
    const off = cycle.cycle_off_days
    if (on == null || off == null || !Number.isInteger(on) || !Number.isInteger(off)) return false
    if (on < 1 || off < 1 || on > 90 || off > 90) return false
    return diff % (on + off) < on
  }
  if (frequency === 'Wochentage wählen') {
    if (days.length === 0 || new Set(days).size !== days.length || days.some(value => !Object.values(WEEKDAYS_DE).includes(value))) {
      return false
    }
    return days.includes(dayOfWeek)
  }
  if (frequency === 'Jeden 2. Tag') return diff % 2 === 0
  if (frequency === '5 Tage an / 2 aus') return diff % 7 < 5
  if (frequency === 'Mo-Fr') return day.getDay() >= 1 && day.getDay() <= 5
  if (frequency === 'Wöchentlich') return diff % 7 === 0
  return false
}

function localTimeCandidates(localDate, minutes, timeZone) {
  const [year, month, day] = localDate.split('-').map(Number)
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  const desiredLocalMillis = Date.UTC(year, month - 1, day, hour, minute)
  const wallMillis = instantMs => Date.parse(
    `${localDateTimeKey(new Date(instantMs), timeZone).replace('|', 'T')}Z`,
  )
  const candidates = [...new Set([-1, 0, 1].map(dayOffset => {
    const sample = desiredLocalMillis + dayOffset * 86_400_000
    return desiredLocalMillis - (wallMillis(sample) - sample)
  }))].sort((left, right) => left - right)
  return { desiredLocalMillis, wallMillis, candidates }
}

// PostgreSQL's date boundary policy: later instant for a fold; pre-transition
// offset for a gap. Keep this in parity with src/lib/planTimeline.ts.
export function localDateBoundaryInstant(localDate, timeZone) {
  localDateKey(localDate, 'date boundary')
  const { desiredLocalMillis, wallMillis, candidates } = localTimeCandidates(localDate, 0, timeZone)
  const exact = candidates.filter(candidate => wallMillis(candidate) === desiredLocalMillis)
  return new Date(exact.at(-1) ?? candidates[candidates.length - 1])
}

function localSlotInstant(localDate, minutes, timeZone) {
  const { desiredLocalMillis, wallMillis, candidates } = localTimeCandidates(localDate, minutes, timeZone)
  const dayBoundary = localDateBoundaryInstant(localDate, timeZone).getTime()
  const exact = candidates.find(candidate => candidate >= dayBoundary && wallMillis(candidate) === desiredLocalMillis)
  if (exact !== undefined) return new Date(exact)

  for (let instant = Math.max(candidates[0], dayBoundary); instant <= candidates[candidates.length - 1]; instant += 60_000) {
    if (wallMillis(instant) >= desiredLocalMillis) return new Date(instant)
  }
  throw new Error(`Could not resolve local intake slot: ${localDate} ${minutes} ${timeZone}`)
}

export function resolveTimelineIntakesForDay(timeline, localDate, timeZone) {
  const day = parseISO(localDate)
  if (!Number.isFinite(day.getTime()) || format(day, 'yyyy-MM-dd') !== localDate) {
    throw new Error(`Invalid local intake date: ${localDate}`)
  }

  const candidates = timeline.versions.flatMap(version => {
    const cycle = timelineVersionAsCycle(timeline, version, timeZone)
    return cycleAppliesToDay(cycle, day) ? resolveScheduleSlots(version, day) : []
  })
  const uniqueCandidates = new Map(candidates.map(slot => [`${slot.key}|${slot.time}`, slot]))

  const resolved = [...uniqueCandidates.values()].flatMap(candidate => {
    const instant = localSlotInstant(localDate, candidate.minutes, timeZone)
    const atSlot = resolveCycleAt(timeline, instant, timeZone)
    if (atSlot.status !== 'active' || !atSlot.planVersion) return []

    const activeCycle = timelineVersionAsCycle(timeline, atSlot.planVersion, timeZone)
    if (!cycleAppliesToDay(activeCycle, day)) return []
    const activeSlot = resolveScheduleSlots(atSlot.planVersion, day).find(slot => (
      slot.key === candidate.key && slot.time === candidate.time
    ))
    if (!activeSlot) return []

    const scheduledAt = instant.toISOString()
    const clock = parsedClock(localDateTimeKey(instant, timeZone).slice(11, 16))
    const routineSlotKey = slotSchluessel(timeline.cycle.id, localDate, candidate.minutes)
    return [{
      ...activeSlot,
      ...clock,
      key: routineSlotKey,
      slotKey: activeSlot.key,
      cycleId: timeline.cycle.id,
      stackItemId: timeline.cycle.stack_item_id,
      planVersionId: atSlot.planVersion.id,
      dose: activeSlot.dose ?? atSlot.planVersion.dose,
      unit: atSlot.planVersion.unit,
      method: atSlot.planVersion.method,
      localDate,
      scheduledAt,
      routineSlotKey,
      pendingLogId: null,
    }]
  })

  const uniqueIntakes = new Map()
  for (const intake of resolved) {
    if (!uniqueIntakes.has(intake.routineSlotKey)) uniqueIntakes.set(intake.routineSlotKey, intake)
  }
  return [...uniqueIntakes.values()].sort((left, right) => left.minutes - right.minutes)
}
