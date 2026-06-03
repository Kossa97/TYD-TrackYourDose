import { differenceInDays, format, parseISO, startOfDay, subDays } from 'date-fns'

// Maps JS getDay() (0 = Sunday) to the German weekday codes stored on cycles.
const WEEKDAYS_DE: Record<number, string> = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 0: 'So' }
const SLOT_TIMES: Record<string, string> = { morgens: '08:00', mittags: '12:00', abends: '20:00' }

export interface ScheduleCycle {
  id: string
  peptide_id: string
  start_date: string
  end_date: string | null
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  intake_time: string | null
  intake_time_custom: string | null
}

export interface IntakeLog {
  peptide_id: string
  logged_at: string
}

export interface OverdueIntake {
  time: string
  substance: string | null
  daysOverdue: number
  /** yyyy-MM-dd of the overdue intake's scheduled day. */
  dateKey: string
  /** id of the cycle this overdue intake belongs to. */
  cycleId: string
}

// NOTE: kept in sync with the identical predicate in Dashboard.tsx (cycleAppliesToDay).
export function cycleAppliesToDay(cycle: ScheduleCycle, day: Date): boolean {
  const start = parseISO(cycle.start_date)
  const end = cycle.end_date ? parseISO(cycle.end_date) : null
  if (day < start) return false
  if (end && day > end) return false

  const freq = cycle.frequency
  const dayOfWeek = WEEKDAYS_DE[day.getDay()]
  const diff = differenceInDays(day, start)
  const hasDayFilter = (cycle.schedule_days ?? []).length > 0

  if (freq === 'Täglich' || freq === '2x täglich' || freq === '3x täglich')
    return hasDayFilter ? (cycle.schedule_days ?? []).includes(dayOfWeek) : true
  if (freq === 'Jeden 2. Tag') return diff % 2 === 0
  if (freq === 'Alle X Tage') {
    const intervalOk = diff % (cycle.x_days_interval ?? 2) === 0
    return intervalOk && (hasDayFilter ? (cycle.schedule_days ?? []).includes(dayOfWeek) : true)
  }
  if (freq === '5 Tage an / 2 aus') return diff % 7 < 5
  if (freq === 'Mo-Fr') return day.getDay() >= 1 && day.getDay() <= 5
  if (freq === 'Wöchentlich') return diff % 7 === 0
  if (freq === 'Wochentage wählen') return (cycle.schedule_days ?? []).includes(dayOfWeek)
  return false
}

function earliestSlot(c: ScheduleCycle): { min: number; time: string } | null {
  const slots = (c.intake_time ?? '').split(',').filter(Boolean)
  const customs = (c.intake_time_custom ?? '').split(',')
  let best: { min: number; time: string } | null = null
  slots.forEach((slot, i) => {
    const tm = slot === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slot] ?? '')
    if (!tm) return
    const [h, m] = tm.split(':').map(Number)
    const min = h * 60 + m
    if (!best || min < best.min) best = { min, time: tm }
  })
  return best
}

/**
 * Walk backwards over the last `lookbackDays` and return the OLDEST scheduled
 * intake that has no confirmed log on its day. A day counts as satisfied if any
 * confirmed (taken) log exists for that peptide on that day. Today's intakes only
 * count as overdue once their time has passed.
 */
export function findOldestOverdueIntake(
  cycles: ScheduleCycle[],
  logs: IntakeLog[],
  peptideNameById: Map<string, string>,
  now: Date = new Date(),
  lookbackDays = 90,
): OverdueIntake | null {
  const satisfied = new Set<string>()
  for (const l of logs) satisfied.add(`${l.peptide_id}|${format(parseISO(l.logged_at), 'yyyy-MM-dd')}`)

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const todayKey = format(now, 'yyyy-MM-dd')

  for (let back = lookbackDays; back >= 0; back--) {
    const day = startOfDay(subDays(now, back))
    const dayKey = format(day, 'yyyy-MM-dd')
    const isToday = dayKey === todayKey

    let candidate: { min: number; time: string; substance: string | null; cycleId: string } | null = null
    for (const c of cycles) {
      if (!cycleAppliesToDay(c, day)) continue
      if (satisfied.has(`${c.peptide_id}|${dayKey}`)) continue
      const slot = earliestSlot(c)
      if (!slot) continue
      if (isToday && slot.min > nowMin) continue // still upcoming today → not overdue
      if (!candidate || slot.min < candidate.min) {
        candidate = { min: slot.min, time: slot.time, substance: peptideNameById.get(c.peptide_id) ?? null, cycleId: c.id }
      }
    }
    if (candidate) {
      return { time: candidate.time, substance: candidate.substance, daysOverdue: differenceInDays(now, day), dateKey: dayKey, cycleId: candidate.cycleId }
    }
  }
  return null
}
