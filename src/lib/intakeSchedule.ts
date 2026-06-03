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
  /** true = taken, false = skipped, null = reset. Decided (non-null) logs cover a slot. */
  taken: boolean | null
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

// All scheduled slots of a cycle on any day, sorted by time. One entry per intake time.
function cycleDaySlots(c: ScheduleCycle): { min: number; time: string }[] {
  const slots = (c.intake_time ?? '').split(',').filter(Boolean)
  const customs = (c.intake_time_custom ?? '').split(',')
  const out: { min: number; time: string }[] = []
  slots.forEach((slot, i) => {
    const tm = slot === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slot] ?? '')
    if (!tm) return
    const [h, m] = tm.split(':').map(Number)
    out.push({ min: h * 60 + m, time: tm })
  })
  return out.sort((a, b) => a.min - b.min)
}

/**
 * Walk backwards over the last `lookbackDays` and return the OLDEST scheduled
 * intake slot not yet covered by a decided log. Per peptide and day, the decided
 * logs (taken === true/false) cover the earliest scheduled slots in time order;
 * the first uncovered slot whose time has passed counts as overdue. This keeps
 * multiple intakes per day (e.g. "2x täglich") tracked independently.
 */
export function findOldestOverdueIntake(
  cycles: ScheduleCycle[],
  logs: IntakeLog[],
  peptideNameById: Map<string, string>,
  now: Date = new Date(),
  lookbackDays = 90,
): OverdueIntake | null {
  // Count decided logs per peptide per day — that many earliest slots are covered.
  const decidedByDay = new Map<string, number>()
  for (const l of logs) {
    if (l.taken == null) continue
    const key = `${l.peptide_id}|${format(parseISO(l.logged_at), 'yyyy-MM-dd')}`
    decidedByDay.set(key, (decidedByDay.get(key) ?? 0) + 1)
  }

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const todayKey = format(now, 'yyyy-MM-dd')

  for (let back = lookbackDays; back >= 0; back--) {
    const day = startOfDay(subDays(now, back))
    const dayKey = format(day, 'yyyy-MM-dd')
    const isToday = dayKey === todayKey

    // Collect each peptide's scheduled slots for this day across all applicable cycles.
    const slotsByPeptide = new Map<string, { min: number; time: string; cycleId: string }[]>()
    for (const c of cycles) {
      if (!cycleAppliesToDay(c, day)) continue
      for (const s of cycleDaySlots(c)) {
        const arr = slotsByPeptide.get(c.peptide_id) ?? []
        arr.push({ min: s.min, time: s.time, cycleId: c.id })
        slotsByPeptide.set(c.peptide_id, arr)
      }
    }

    let candidate: { min: number; time: string; substance: string | null; cycleId: string } | null = null
    for (const [peptideId, slots] of slotsByPeptide) {
      const ordered = [...slots].sort((a, b) => a.min - b.min)
      const covered = decidedByDay.get(`${peptideId}|${dayKey}`) ?? 0
      for (const slot of ordered.slice(covered)) {
        if (isToday && slot.min > nowMin) break // earliest uncovered slot still upcoming → none overdue
        if (!candidate || slot.min < candidate.min) {
          candidate = { min: slot.min, time: slot.time, substance: peptideNameById.get(peptideId) ?? null, cycleId: slot.cycleId }
        }
        break // only the earliest uncovered slot per peptide matters
      }
    }
    if (candidate) {
      return { time: candidate.time, substance: candidate.substance, daysOverdue: differenceInDays(now, day), dateKey: dayKey, cycleId: candidate.cycleId }
    }
  }
  return null
}
