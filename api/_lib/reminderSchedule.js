import { resolveTimelineIntakesForDay } from './planTimeline.js'

export const REMINDER_OFFSETS_MIN = { on_time: 0, '2h': 120, '1day': 1440 }

function addDaysKey(dateKey, amount) {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

export function localParts(date, timeZone) {
  if (!timeZone) throw new Error('Missing IANA time zone')
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid reminder instant')

  let parts
  try {
    parts = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date)
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
  if (!year || !month || !day || !hour || !minute) {
    throw new Error(`Could not format local reminder time in time zone: ${timeZone}`)
  }
  return {
    dateKey: `${year}-${month}-${day}`,
    minutes: Number(hour) * 60 + Number(minute),
  }
}

export function reminderKeys(reminder) {
  const raw = String(reminder ?? '').trim()
  if (!raw) return ['on_time']
  return [...new Set(raw.split(',')
    .map(value => value.trim())
    .filter(key => key && key !== 'none' && REMINDER_OFFSETS_MIN[key] != null))]
}

export function dueReminders(timeline, reminder, now, timeZone, windowMin) {
  const offsets = reminderKeys(reminder)
  if (!offsets.length) return []

  const nowMs = now.getTime()
  if (!Number.isFinite(nowMs)) throw new Error('Invalid reminder instant')
  const today = localParts(now, timeZone).dateKey
  const earlierDays = Math.ceil(Math.max(windowMin, 0) / 1440) + 1
  const localDates = []
  for (let shift = -earlierDays; shift <= 2; shift += 1) {
    localDates.push(addDaysKey(today, shift))
  }

  const lowerExclusive = nowMs - windowMin * 60_000
  const due = []
  for (const localDate of localDates) {
    for (const occurrence of resolveTimelineIntakesForDay(timeline, localDate, timeZone)) {
      const scheduledMs = new Date(occurrence.scheduledAt).getTime()
      for (const offset of offsets) {
        const dueAtMs = scheduledMs - REMINDER_OFFSETS_MIN[offset] * 60_000
        if (dueAtMs > lowerExclusive && dueAtMs <= nowMs) {
          due.push({ ...occurrence, offset })
        }
      }
    }
  }
  return due
}
