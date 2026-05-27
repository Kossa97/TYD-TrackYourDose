// Lädt alle bestätigten Einnahmen eines Zyklus aus der Datenbank
// und gibt sie als sortierte Liste von { timestamp, dose, status } zurück.

import { addDays, format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'

export type BlutspiegelTrend = 'rising' | 'falling' | 'stable'

export interface CurrentBlutspiegelLevel {
  currentLevel: number
  trend: BlutspiegelTrend
  sparkData: number[]
  nextDoseIn: string
  levelAfterNextDose: number
  peakLabel: string
}

export interface DoseEvent {
  timestamp: Date   // Zeitpunkt der Einnahme
  dose: number      // Dosis in der Einheit des Zyklus
  status: 'taken' | 'skipped'
}

interface CycleRow {
  peptide_id: string
  start_date: string
  end_date: string | null
  dose: number
  unit: string
}

interface DoseLogRow {
  logged_at: string
  dose: number | null
  taken: boolean
}

/**
 * Einnahme-Bestätigungen liegen in `dose_logs` (Spalte `taken`:
 * `true` = eingenommen, `false` = übersprungen, `null` = noch offen).
 * Verknüpfung zum Zyklus über `peptide_id` + Datumsbereich des Zyklus.
 */
export async function loadDoseHistory(cycleId: string): Promise<DoseEvent[]> {
  // 1. Zyklus laden
  const { data: cycle, error: cycleError } = await supabase
    .from('cycles')
    .select('peptide_id, start_date, end_date, dose, unit')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) return []

  const { peptide_id, start_date, end_date, dose: cycleDose } = cycle as CycleRow

  // Oberes Datum: end_date, aber höchstens heute wenn end_date fehlt oder in der Zukunft liegt
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const upperDate =
    !end_date || end_date > todayIso ? todayIso : end_date

  // 2. dose_logs laden
  const { data, error } = await supabase
    .from('dose_logs')
    .select('logged_at, dose, taken')
    .eq('peptide_id', peptide_id)
    .gte('logged_at', start_date)
    .lte('logged_at', `${upperDate}T23:59:59.999`)
    .not('taken', 'is', null)
    .order('logged_at', { ascending: true })

  if (error || !data) return []

  // 3. Mapping + 4. Rückgabe
  return (data as DoseLogRow[]).map((log) => ({
    timestamp: new Date(log.logged_at),
    dose: log.dose != null ? Number(log.dose) : Number(cycleDose),
    status: log.taken === true ? 'taken' as const : 'skipped' as const,
  }))
}

export interface BlutspiegelCurvePoint {
  time: Date
  level: number
}

function doseContributionAt(
  dose: number,
  bioavailability: number,
  deltaTHours: number,
  ke: number,
  ka: number,
): number {
  if (deltaTHours <= 0) return 0

  const scaled = dose * bioavailability
  if (Math.abs(ka - ke) < 1e-8) {
    return scaled * ka * deltaTHours * Math.exp(-ke * deltaTHours)
  }
  return scaled * (ka / (ka - ke)) * (Math.exp(-ke * deltaTHours) - Math.exp(-ka * deltaTHours))
}

/** Berechnet den Blutspiegel-Verlauf basierend auf echten Einnahme-Events. */
export function calculateHistoryBlutspiegelCurve(
  events: DoseEvent[],
  halfLifeHours: number,
  tmaxHours: number,
  bioavailability: number = 1.0,
  resolutionMinutes: number = 30,
): BlutspiegelCurvePoint[] {
  if (events.length === 0 || halfLifeHours <= 0 || tmaxHours <= 0 || resolutionMinutes <= 0) {
    return []
  }

  const ke = Math.LN2 / halfLifeHours
  const ka = Math.LN2 / tmaxHours
  const start = events[0].timestamp
  const end = new Date()

  if (start.getTime() > end.getTime()) return []

  const stepMs = resolutionMinutes * 60_000
  const raw: BlutspiegelCurvePoint[] = []

  for (let tMs = start.getTime(); tMs <= end.getTime(); tMs += stepMs) {
    let total = 0

    for (const event of events) {
      if (event.status !== 'taken') continue
      const deltaTHours = (tMs - event.timestamp.getTime()) / 3_600_000
      total += doseContributionAt(event.dose, bioavailability, deltaTHours, ke, ka)
    }

    raw.push({ time: new Date(tMs), level: Math.max(0, total) })
  }

  const peak = Math.max(...raw.map(p => p.level), 0)
  if (peak <= 0) {
    return raw.map(p => ({ time: p.time, level: 0 }))
  }

  return raw.map(p => ({
    time: p.time,
    level: Math.round((p.level / peak) * 1000) / 10,
  }))
}

// ─── Aktueller Spiegel (Live) ────────────────────────────────────────────────

interface CycleScheduleRow {
  dose: number
  intake_time: string | null
  intake_time_custom: string | null
  frequency: string
  schedule_days: string[] | null
  x_days_interval: number | null
  start_date: string
  end_date: string | null
}

const WEEKDAY: Record<number, string> = {
  0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa',
}

const INTAKE_MINUTES: Record<string, number> = {
  morgens: 8 * 60,
  mittags: 12 * 60,
  abends: 20 * 60,
}

const EMPTY_CURRENT_LEVEL: CurrentBlutspiegelLevel = {
  currentLevel: 0,
  trend: 'stable',
  sparkData: Array(10).fill(0),
  nextDoseIn: '—',
  levelAfterNextDose: 0,
  peakLabel: '—',
}

function cycleAppliesToDay(cycle: CycleScheduleRow, day: Date): boolean {
  const start = parseISO(cycle.start_date)
  const end = cycle.end_date ? parseISO(cycle.end_date) : null
  if (day < start) return false
  if (end && day > end) return false

  const diff = Math.round((day.getTime() - start.getTime()) / 86_400_000)
  const wd = WEEKDAY[day.getDay()]
  const sd = cycle.schedule_days ?? []
  const f = cycle.frequency

  if (f === 'Täglich' || f === '2x täglich' || f === '3x täglich') {
    return sd.length ? sd.includes(wd) : true
  }
  if (f === 'Jeden 2. Tag') return diff % 2 === 0
  if (f === '5 Tage an / 2 aus') return diff % 7 < 5
  if (f === 'Mo-Fr') return day.getDay() >= 1 && day.getDay() <= 5
  if (f === 'Wöchentlich') return diff % 7 === 0
  if (f === 'Wochentage wählen') return sd.includes(wd)
  if (f === 'Alle X Tage') {
    const interval = cycle.x_days_interval ?? 2
    return diff % interval === 0 && (sd.length ? sd.includes(wd) : true)
  }
  return false
}

function cycleIntakeMinutes(cycle: CycleScheduleRow): number {
  const firstKey = (cycle.intake_time ?? '').split(',')[0] ?? ''
  if (INTAKE_MINUTES[firstKey]) return INTAKE_MINUTES[firstKey]
  if (firstKey === 'custom' && cycle.intake_time_custom) {
    const firstCustom = cycle.intake_time_custom.split(',')[0]
    const [h, m] = firstCustom.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  return 8 * 60
}

function findNextDoseTime(cycle: CycleScheduleRow, now: Date): Date {
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  for (let dayOffset = 0; dayOffset < 366; dayOffset++) {
    const day = addDays(todayStart, dayOffset)
    if (!cycleAppliesToDay(cycle, day)) continue

    const doseTime = new Date(day)
    doseTime.setHours(0, 0, 0, 0)
    const mins = cycleIntakeMinutes(cycle)
    doseTime.setMinutes(mins % 60)
    doseTime.setHours(Math.floor(mins / 60))

    if (doseTime.getTime() > now.getTime()) return doseTime
  }

  const fallback = new Date(now)
  fallback.setDate(fallback.getDate() + 1)
  fallback.setHours(8, 0, 0, 0)
  return fallback
}

function formatDurationShort(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / 60_000))
  if (totalMin < 60) return `${totalMin}m`
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function calculateCurveTo(
  events: DoseEvent[],
  end: Date,
  halfLifeHours: number,
  tmaxHours: number,
  bioavailability: number,
  resolutionMinutes: number,
): BlutspiegelCurvePoint[] {
  if (events.length === 0 || halfLifeHours <= 0 || tmaxHours <= 0 || resolutionMinutes <= 0) {
    return []
  }

  const ke = Math.LN2 / halfLifeHours
  const ka = Math.LN2 / tmaxHours
  const start = events[0].timestamp
  if (start.getTime() > end.getTime()) return []

  const stepMs = resolutionMinutes * 60_000
  const raw: BlutspiegelCurvePoint[] = []

  for (let tMs = start.getTime(); tMs <= end.getTime(); tMs += stepMs) {
    let total = 0
    for (const event of events) {
      if (event.status !== 'taken') continue
      const deltaTHours = (tMs - event.timestamp.getTime()) / 3_600_000
      total += doseContributionAt(event.dose, bioavailability, deltaTHours, ke, ka)
    }
    raw.push({ time: new Date(tMs), level: Math.max(0, total) })
  }

  const peak = Math.max(...raw.map(p => p.level), 0)
  if (peak <= 0) return raw.map(p => ({ time: p.time, level: 0 }))

  return raw.map(p => ({
    time: p.time,
    level: Math.round((p.level / peak) * 1000) / 10,
  }))
}

function levelAtOrBefore(curve: BlutspiegelCurvePoint[], target: Date): number {
  if (!curve.length) return 0
  let level = curve[0].level
  for (const p of curve) {
    if (p.time.getTime() <= target.getTime()) level = p.level
    else break
  }
  return level
}

function sampleSparkData(curve: BlutspiegelCurvePoint[], count = 10): number[] {
  if (!curve.length) return Array(count).fill(0)
  if (curve.length <= count) {
    const values = curve.map(p => p.level)
    while (values.length < count) values.unshift(values[0] ?? 0)
    return values
  }
  const result: number[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (curve.length - 1))
    result.push(curve[idx].level)
  }
  return result
}

function peakLabelFromCurve(curve: BlutspiegelCurvePoint[], now: Date): string {
  if (!curve.length) return '—'

  let peakPoint = curve[0]
  for (const p of curve) {
    if (p.level >= peakPoint.level) peakPoint = p
  }

  const diffMs = peakPoint.time.getTime() - now.getTime()
  const absH = Math.abs(diffMs) / 3_600_000

  if (diffMs < 0) {
    if (absH < 1) return 'vor <1h'
    if (absH < 24) return `vor ${Math.round(absH)}h`
    return `vor ${Math.round(absH / 24)}T`
  }
  if (absH < 1) return 'in <1h'
  if (absH < 24) return `in ${Math.round(absH)}h`
  return `in ${Math.round(absH / 24)}T`
}

function computeTrend(current: number, previous: number): BlutspiegelTrend {
  const diff = current - previous
  if (diff > 2) return 'rising'
  if (diff < -2) return 'falling'
  return 'stable'
}

/** Berechnet den aktuellen Blutspiegel-Wert für JETZT basierend auf den letzten Einnahmen eines Zyklus. */
export async function getCurrentBlutspiegelLevel(
  cycleId: string,
  halfLifeHours: number,
  tmaxHours: number,
  bioavailability: number = 1.0,
): Promise<CurrentBlutspiegelLevel> {
  const events = await loadDoseHistory(cycleId)
  const takenEvents = events.filter(e => e.status === 'taken')

  const { data: cycle, error: cycleErr } = await supabase
    .from('cycles')
    .select('dose, intake_time, intake_time_custom, frequency, schedule_days, x_days_interval, start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleErr || !cycle) return { ...EMPTY_CURRENT_LEVEL }

  const schedule = cycle as CycleScheduleRow
  const now = new Date()
  const nextDose = findNextDoseTime(schedule, now)
  const nextDoseIn = formatDurationShort(nextDose.getTime() - now.getTime())

  if (!takenEvents.length) {
    return {
      ...EMPTY_CURRENT_LEVEL,
      nextDoseIn,
      levelAfterNextDose: 0,
    }
  }

  const curve = calculateHistoryBlutspiegelCurve(
    events,
    halfLifeHours,
    tmaxHours,
    bioavailability,
    30,
  )

  if (!curve.length) {
    return {
      ...EMPTY_CURRENT_LEVEL,
      nextDoseIn,
    }
  }

  const currentLevel = curve[curve.length - 1].level
  const oneHourAgo = new Date(now.getTime() - 3_600_000)
  const trend = computeTrend(currentLevel, levelAtOrBefore(curve, oneHourAgo))

  const sparkCurve = calculateHistoryBlutspiegelCurve(
    events,
    halfLifeHours,
    tmaxHours,
    bioavailability,
    120,
  )
  const sparkData = sampleSparkData(
    sparkCurve.length >= 10 ? sparkCurve.slice(-10) : sparkCurve,
    10,
  )

  const futureDose: DoseEvent = {
    timestamp: nextDose,
    dose: schedule.dose,
    status: 'taken',
  }
  const simEnd = new Date(nextDose.getTime() + tmaxHours * 3_600_000 * 2)
  const futureCurve = calculateCurveTo(
    [...takenEvents, futureDose],
    simEnd,
    halfLifeHours,
    tmaxHours,
    bioavailability,
    30,
  )
  const afterNext = futureCurve.filter(p => p.time.getTime() >= nextDose.getTime())
  const levelAfterNextDose = afterNext.length
    ? Math.max(...afterNext.map(p => p.level))
    : currentLevel

  return {
    currentLevel,
    trend,
    sparkData,
    nextDoseIn,
    levelAfterNextDose,
    peakLabel: peakLabelFromCurve(curve, now),
  }
}
