import { differenceInDays, format, parseISO, startOfDay, subDays } from 'date-fns'

// Maps JS getDay() (0 = Sunday) to the German weekday codes stored on cycles.
const WEEKDAYS_DE: Record<number, string> = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 0: 'So' }
const SLOT_TIMES: Record<string, string> = { morgens: '08:00', mittags: '12:00', abends: '20:00' }

export interface ScheduleSegment {
  effective_from: string            // 'yyyy-MM-dd'
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  intake_time: string | null
  intake_time_custom: string | null
  dose: number
  unit: string
}

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
  dose: number
  unit: string
  schedule_history: ScheduleSegment[] | null
}

export interface EscalationRow {
  cycle_id: string
  increase_amount: number
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null
  start_after_days: number | null
}

export interface IntakeLog {
  peptide_id: string
  logged_at: string
  /** true = taken, false = skipped, null = reset. Decided (non-null) logs cover a slot. */
  taken: boolean | null
}

// Active schedule segment for a given day. Empty history => flat cycle fields from start_date.
export function scheduleForDay(cycle: ScheduleCycle, day: Date): ScheduleSegment {
  const flat: ScheduleSegment = {
    effective_from: cycle.start_date,
    frequency: cycle.frequency,
    x_days_interval: cycle.x_days_interval,
    schedule_days: cycle.schedule_days,
    intake_time: cycle.intake_time,
    intake_time_custom: cycle.intake_time_custom,
    dose: cycle.dose,
    unit: cycle.unit,
  }
  const history = cycle.schedule_history
  if (!history || history.length === 0) return flat
  const dayKey = format(day, 'yyyy-MM-dd')
  const sorted = [...history].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  let seg = sorted[0]
  for (const s of sorted) {
    if (s.effective_from <= dayKey) seg = s
    else break
  }
  return seg
}

// Effective dose for a cycle on a given day: segment base dose + active escalations.
export function effectiveDose(cycle: ScheduleCycle, day: Date, escalations: EscalationRow[]): number {
  const daysFromStart = differenceInDays(day, parseISO(cycle.start_date))
  let total = scheduleForDay(cycle, day).dose
  for (const esc of escalations.filter(e => e.cycle_id === cycle.id)) {
    if (esc.start_type === 'date' && esc.start_date) {
      if (day >= parseISO(esc.start_date)) total += esc.increase_amount
    } else if (esc.start_after_days != null) {
      if (daysFromStart >= esc.start_after_days) total += esc.increase_amount
    }
  }
  return total
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

// Single source of truth — Dashboard.tsx imports this instead of duplicating it.
export function cycleAppliesToDay(cycle: ScheduleCycle, day: Date): boolean {
  const start = parseISO(cycle.start_date)
  const end = cycle.end_date ? parseISO(cycle.end_date) : null
  if (day < start) return false
  if (end && day > end) return false

  const seg = scheduleForDay(cycle, day)
  const freq = seg.frequency
  const dayOfWeek = WEEKDAYS_DE[day.getDay()]
  const diff = differenceInDays(day, start)
  const hasDayFilter = (seg.schedule_days ?? []).length > 0

  if (freq === 'Täglich' || freq === '2x täglich' || freq === '3x täglich')
    return hasDayFilter ? (seg.schedule_days ?? []).includes(dayOfWeek) : true
  if (freq === 'Jeden 2. Tag') return diff % 2 === 0
  if (freq === 'Alle X Tage') {
    const intervalOk = diff % (seg.x_days_interval ?? 2) === 0
    return intervalOk && (hasDayFilter ? (seg.schedule_days ?? []).includes(dayOfWeek) : true)
  }
  if (freq === '5 Tage an / 2 aus') return diff % 7 < 5
  if (freq === 'Mo-Fr') return day.getDay() >= 1 && day.getDay() <= 5
  if (freq === 'Wöchentlich') return diff % 7 === 0
  if (freq === 'Wochentage wählen') return (seg.schedule_days ?? []).includes(dayOfWeek)
  return false
}

// All scheduled slots of a cycle ON a given day, sorted by time (segment-resolved).
function cycleDaySlots(c: ScheduleCycle, day: Date): { min: number; time: string }[] {
  const seg = scheduleForDay(c, day)
  const slots = (seg.intake_time ?? '').split(',').filter(Boolean)
  const customs = (seg.intake_time_custom ?? '').split(',')
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
      for (const s of cycleDaySlots(c, day)) {
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

/** Marker in dose_logs.notes für automatisch als „verpasst" eingetragene Einnahmen. */
export const AUTO_MISSED_NOTE = 'auto-missed'

export interface MissedIntake {
  cycleId: string
  peptideId: string
  /** yyyy-MM-dd des geplanten Tages. */
  dateKey: string
  /** Minuten seit Mitternacht (Slot-Zeit). */
  minutes: number
}

/**
 * Alle geplanten Slots der letzten `lookbackDays` VOR heute, die nicht durch einen
 * entschiedenen Log (taken === true/false) gedeckt sind. Frist = Tagesende: heutige
 * Slots werden bewusst ausgelassen (sie bleiben bis Mitternacht bestätigbar). Das
 * Ergebnis wird vom Aufrufer als „verpasst" (taken=false) in dose_logs geschrieben.
 */
export function collectMissedIntakes(
  cycles: ScheduleCycle[],
  logs: IntakeLog[],
  now: Date = new Date(),
  lookbackDays = 90,
): MissedIntake[] {
  const decidedByDay = new Map<string, number>()
  for (const l of logs) {
    if (l.taken == null) continue
    const key = `${l.peptide_id}|${format(parseISO(l.logged_at), 'yyyy-MM-dd')}`
    decidedByDay.set(key, (decidedByDay.get(key) ?? 0) + 1)
  }

  const out: MissedIntake[] = []
  for (let back = lookbackDays; back >= 1; back--) {   // back >= 1 → nur Tage vor heute
    const day = startOfDay(subDays(now, back))
    const dayKey = format(day, 'yyyy-MM-dd')

    const slotsByPeptide = new Map<string, { min: number; cycleId: string }[]>()
    for (const c of cycles) {
      if (!cycleAppliesToDay(c, day)) continue
      for (const s of cycleDaySlots(c, day)) {
        const arr = slotsByPeptide.get(c.peptide_id) ?? []
        arr.push({ min: s.min, cycleId: c.id })
        slotsByPeptide.set(c.peptide_id, arr)
      }
    }

    for (const [peptideId, slots] of slotsByPeptide) {
      const ordered = [...slots].sort((a, b) => a.min - b.min)
      const covered = decidedByDay.get(`${peptideId}|${dayKey}`) ?? 0
      for (const slot of ordered.slice(covered)) {
        out.push({ cycleId: slot.cycleId, peptideId, dateKey: dayKey, minutes: slot.min })
      }
    }
  }
  return out
}
