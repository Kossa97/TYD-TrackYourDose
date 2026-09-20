// Lädt alle bestätigten Einnahmen eines Zyklus aus der Datenbank
// und gibt sie als sortierte Liste von { timestamp, dose, status } zurück.

import { addDays, format } from 'date-fns'
import { supabase } from '../lib/supabase'
import { FEATURES } from '../config/features'
import {
  resolvePkScheduleForDay,
  toPkMilligrams,
  type PkScheduleCycle,
  type ResolvedPkSchedule,
} from '../features/my-stack/lib/pkReadiness'
import { cycleAppliesToDay, findNextTimelineIntake, type EscalationRow } from '../lib/intakeSchedule'
import { resolveCycleAt } from '../lib/planTimeline'

export type BlutspiegelTrend = 'rising' | 'falling' | 'stable'

export interface CurrentBlutspiegelLevel {
  currentLevel: number
  trend: BlutspiegelTrend
  sparkData: number[]
  nextDoseIn: string
  levelAfterNextDose: number | null
  peakLabel: string
  unit: string
  interruptedAt: string | null
}

export interface DoseEvent {
  method?: string
  cycleId?: string | null
  planVersionId?: string | null
  timestamp: Date   // Zeitpunkt der Einnahme
  dose: number
  unit: string
  status: 'taken' | 'skipped' | 'planned'
}

export interface DoseHistory {
  events: DoseEvent[]
  interruptedAt: string | null
}

export interface QuantifiedDoseLog<TTimestamp = string> {
  timestamp: TTimestamp
  dose: number | null
  unit: string | null
  taken: boolean
}

export interface QuantifiedDoseEvent<TTimestamp = string> {
  timestamp: TTimestamp
  dose: number
  unit: string
  status: 'taken'
}

export function splitQuantifiedDoseHistory<TTimestamp>(
  logs: QuantifiedDoseLog<TTimestamp>[],
): { events: QuantifiedDoseEvent<TTimestamp>[]; interruptedAt: TTimestamp | null } {
  const events: QuantifiedDoseEvent<TTimestamp>[] = []

  for (const log of logs) {
    if (!log.taken) continue
    if (log.dose == null || !Number.isFinite(log.dose) || !log.unit?.trim()) {
      return { events, interruptedAt: log.timestamp }
    }
    events.push({
      timestamp: log.timestamp,
      dose: log.dose,
      unit: log.unit,
      status: 'taken',
    })
  }

  return { events, interruptedAt: null }
}

interface CycleRow {
  stack_item_id: string
  start_date: string
  end_date: string | null
}

interface DoseLogRow {
  logged_at: string
  dose: number | null
  unit: string | null
  taken: boolean
}

/**
 * Einnahme-Bestätigungen liegen in `dose_logs` (Spalte `taken`:
 * `true` = eingenommen, `false` = übersprungen, `null` = noch offen).
 * Verknüpfung zum Zyklus über `stack_item_id` + Datumsbereich des Zyklus.
 */
export async function loadDoseHistory(cycleId: string): Promise<DoseHistory> {
  if (FEATURES.planTimelineV2) return loadNormalizedDoseHistory(cycleId)
  // 1. Zyklus laden
  const { data: cycle, error: cycleError } = await supabase
    .from('cycles')
    .select('stack_item_id, start_date, end_date')
    .eq('id', cycleId)
    .maybeSingle()

  if (cycleError || !cycle) return { events: [], interruptedAt: null }

  const { stack_item_id, start_date, end_date } = cycle as CycleRow

  // Oberes Datum: end_date, aber höchstens heute wenn end_date fehlt oder in der Zukunft liegt
  const todayIso = format(new Date(), 'yyyy-MM-dd')
  const upperDate =
    !end_date || end_date > todayIso ? todayIso : end_date

  // 2. dose_logs laden
  const { data, error } = await supabase
    .from('dose_logs')
    .select('logged_at, dose, unit, taken')
    .eq('stack_item_id', stack_item_id)
    .gte('logged_at', start_date)
    .lte('logged_at', `${upperDate}T23:59:59.999`)
    .not('taken', 'is', null)
    .order('logged_at', { ascending: true })

  if (error || !data) return { events: [], interruptedAt: null }

  const split = splitQuantifiedDoseHistory((data as DoseLogRow[]).map(log => ({
    timestamp: log.logged_at,
    dose: log.dose == null ? null : Number(log.dose),
    unit: log.unit,
    taken: log.taken,
  })))

  return {
    events: split.events.map(event => ({
      ...event,
      timestamp: new Date(event.timestamp),
    })),
    interruptedAt: split.interruptedAt,
  }
}

async function loadNormalizedDoseHistory(cycleId: string): Promise<DoseHistory> {
  const { data: cycle, error } = await supabase.from('cycles')
    .select('id, stack_item_id, started_at, ended_at, start_local_date, end_local_date, stack_items(pk_profile_method)').eq('id', cycleId).maybeSingle()
  if (error) throw error
  if (!cycle?.started_at) throw new Error('Cycle history boundary unavailable')
  const now = new Date().toISOString()
  const upper = cycle.ended_at && cycle.ended_at < now ? cycle.ended_at : now
  const fields = 'logged_at, dose, unit, method, taken, cycle_id, plan_version_id'
  const [exact, legacy] = await Promise.all([
    supabase.from('dose_logs').select(fields).eq('cycle_id', cycleId).eq('taken', true)
      .lte('logged_at', now).order('logged_at', { ascending: true }),
    supabase.from('dose_logs').select(fields).eq('stack_item_id', cycle.stack_item_id)
      .is('cycle_id', null).is('plan_version_id', null).eq('taken', true)
      .gte('logged_at', cycle.started_at).lt('logged_at', upper).order('logged_at', { ascending: true }),
  ])
  if (exact.error) throw exact.error
  if (legacy.error) throw legacy.error
  const rows = [...(exact.data ?? []), ...(legacy.data ?? [])]
    .sort((a, b) => a.logged_at.localeCompare(b.logged_at))
  const events: DoseEvent[] = []
  for (const row of rows) {
    const dose = row.dose == null ? null : Number(row.dose)
    const profileMethod = (cycle.stack_items as unknown as { pk_profile_method?: string } | null)?.pk_profile_method
    if (!row.method?.trim() || !profileMethod?.trim()
      || row.method.trim().toLocaleLowerCase() !== profileMethod.trim().toLocaleLowerCase()) {
      return { events, interruptedAt: row.logged_at }
    }
    if (dose == null || !Number.isFinite(dose) || !row.unit?.trim()) return { events, interruptedAt: row.logged_at }
    events.push({ timestamp: new Date(row.logged_at), dose, unit: row.unit, status: 'taken',
      cycleId: row.cycle_id, planVersionId: row.plan_version_id, method: row.method })
  }
  return { events, interruptedAt: null }
}

export interface BlutspiegelCurvePoint {
  time: Date
  level: number
  status: 'actual' | 'planned'
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
/**
 * Was eine geplante Menge in Milligramm uebersetzt.
 *
 * Zwei Faktoren, beide gehoeren nicht der Kurve, sondern der Substanz bzw.
 * ihrer Zubereitung — deshalb kommen sie von aussen herein:
 *
 *   iuPerMg   Internationale Einheiten sind eine Wirkstaerke, keine Masse.
 *             Steht im PK-Profil.
 *   mgPerMl   Milliliter sind ein Volumen, keine Menge. Aus der Staerke der
 *             Zutat: 5 mg im Vial auf 2 ml Loesungsmittel sind 2,5 mg/ml.
 *
 * Als Objekt statt als zwei weitere Stellen in der Argumentliste: die Kurve
 * nahm zuletzt sieben Argumente, und das siebte war schon eine Zahl, die man
 * an der Aufrufstelle nicht mehr lesen konnte.
 */
export interface DoseUmrechnung {
  iuPerMg?: number | null
  mgPerMl?: number | null
}

export function calculateHistoryBlutspiegelCurve(
  events: DoseEvent[],
  halfLifeHours: number,
  tmaxHours: number,
  bioavailability: number = 1.0,
  resolutionMinutes: number = 30,
  interruptedAt: Date | null = null,
  // Ohne die Umrechnung faellt jede Einnahme still aus der Summe, deren
  // Einheit nicht schon mg oder mcg ist — genau das liess HCG und HGH
  // verschwinden, und dasselbe gilt fuer ein in Millilitern geplantes Vial.
  umrechnung: DoseUmrechnung = {},
): BlutspiegelCurvePoint[] {
  if (events.length === 0 || halfLifeHours <= 0 || tmaxHours <= 0 || resolutionMinutes <= 0) {
    return []
  }

  const ke = Math.LN2 / halfLifeHours
  const ka = Math.LN2 / tmaxHours
  const start = events[0].timestamp
  const end = interruptedAt ?? new Date()

  if (start.getTime() > end.getTime()) return []

  const stepMs = resolutionMinutes * 60_000
  const raw: BlutspiegelCurvePoint[] = []

  const latestActualTimestamp = Math.max(...events
    .filter(event => event.status === 'taken')
    .map(event => event.timestamp.getTime()))
  const withinEnd = interruptedAt
    ? (timestamp: number) => timestamp < end.getTime()
    : (timestamp: number) => timestamp <= end.getTime()

  for (let tMs = start.getTime(); withinEnd(tMs); tMs += stepMs) {
    let total = 0

    for (const event of events) {
      if (event.status === 'skipped') continue
      const doseMg = toPkMilligrams(event.dose, event.unit, umrechnung.iuPerMg ?? null, umrechnung.mgPerMl ?? null)
      if (doseMg == null) continue
      const deltaTHours = (tMs - event.timestamp.getTime()) / 3_600_000
      total += doseContributionAt(doseMg, bioavailability, deltaTHours, ke, ka)
    }

    raw.push({
      time: new Date(tMs),
      level: Math.max(0, total),
      status: tMs <= latestActualTimestamp ? 'actual' : 'planned',
    })
  }

  const peak = Math.max(...raw.map(p => p.level), 0)
  if (peak <= 0) {
    return raw.map(p => ({ ...p, level: 0 }))
  }

  return raw.map(p => ({
    time: p.time,
    level: (p.level / peak) * 100,
    status: p.status,
  }))
}

// ─── Aktueller Spiegel (Live) ────────────────────────────────────────────────

const INTAKE_MINUTES: Record<string, number> = {
  morgens: 8 * 60,
  mittags: 12 * 60,
  abends: 20 * 60,
}

const EMPTY_CURRENT_LEVEL: CurrentBlutspiegelLevel = {
  currentLevel: 0,
  trend: 'stable',
  sparkData: Array(20).fill(0),
  nextDoseIn: '—',
  levelAfterNextDose: 0,
  peakLabel: '—',
  unit: 'mcg',
  interruptedAt: null,
}

function cycleIntakeMinutes(cycle: ResolvedPkSchedule): number {
  const firstKey = (cycle.intake_time ?? '').split(',')[0] ?? ''
  if (INTAKE_MINUTES[firstKey]) return INTAKE_MINUTES[firstKey]
  if (firstKey === 'custom' && cycle.intake_time_custom) {
    const firstCustom = cycle.intake_time_custom.split(',')[0]
    const [h, m] = firstCustom.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  return 8 * 60
}

export interface NextPkDose {
  method?: string | null
  cycleId?: string
  planVersionId?: string
  timestamp: Date
  dose: number | null
  unit: string | null
}

export function findNextPkDose(
  cycle: PkScheduleCycle,
  escalations: EscalationRow[],
  now: Date,
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
): NextPkDose | null {
  if (FEATURES.planTimelineV2) {
    if (!cycle.timeline) throw new Error('Cycle timeline unavailable')
    const resolved = resolveCycleAt(cycle.timeline, now, timeZone)
    if (resolved.status === 'active' && !resolved.planVersion) throw new Error('Cycle plan version unavailable')
    const next = findNextTimelineIntake(cycle.timeline, now, timeZone)
    return next ? { timestamp: new Date(next.scheduledAt), dose: next.dose, unit: next.unit, method: next.method,
      cycleId: next.cycleId, planVersionId: next.planVersionId } : null
  }
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  for (let dayOffset = 0; dayOffset < 366; dayOffset++) {
    const day = addDays(todayStart, dayOffset)
    if (!cycleAppliesToDay(cycle, day)) continue

    const schedule = resolvePkScheduleForDay(cycle, escalations, day)
    if (!schedule) continue

    const doseTime = new Date(day)
    doseTime.setHours(0, 0, 0, 0)
    const mins = cycleIntakeMinutes(schedule)
    doseTime.setMinutes(mins % 60)
    doseTime.setHours(Math.floor(mins / 60))

    if (doseTime.getTime() > now.getTime()) {
      return { timestamp: doseTime, dose: schedule.dose, unit: schedule.unit }
    }
  }

  const fallback = new Date(now)
  fallback.setDate(fallback.getDate() + 1)
  fallback.setHours(8, 0, 0, 0)
  const schedule = resolvePkScheduleForDay(cycle, escalations, fallback)
  if (!schedule) return null
  return { timestamp: fallback, dose: schedule.dose, unit: schedule.unit }
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
  umrechnung: DoseUmrechnung = {},
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
  const latestActualTimestamp = Math.max(...events
    .filter(event => event.status === 'taken')
    .map(event => event.timestamp.getTime()))

  for (let tMs = start.getTime(); tMs <= end.getTime(); tMs += stepMs) {
    let total = 0
    for (const event of events) {
      if (event.status === 'skipped') continue
      const doseMg = toPkMilligrams(event.dose, event.unit, umrechnung.iuPerMg ?? null, umrechnung.mgPerMl ?? null)
      if (doseMg == null) continue
      const deltaTHours = (tMs - event.timestamp.getTime()) / 3_600_000
      total += doseContributionAt(doseMg, bioavailability, deltaTHours, ke, ka)
    }
    raw.push({
      time: new Date(tMs),
      level: Math.max(0, total),
      status: tMs <= latestActualTimestamp ? 'actual' : 'planned',
    })
  }

  const peak = Math.max(...raw.map(p => p.level), 0)
  if (peak <= 0) return raw.map(p => ({ ...p, level: 0 }))

  return raw.map(p => ({
    time: p.time,
    level: (p.level / peak) * 100,
    status: p.status,
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
  cycle: PkScheduleCycle,
  escalations: EscalationRow[],
  halfLifeHours: number,
  tmaxHours: number,
  bioavailability: number = 1.0,
  umrechnung: DoseUmrechnung = {},
  pkProfileMethod: string | null = null,
): Promise<CurrentBlutspiegelLevel> {
  const history = await loadDoseHistory(cycle.id)
  const { events, interruptedAt } = history
  const takenEvents = events.filter(e => e.status === 'taken')
  const now = new Date()
  const schedule = resolvePkScheduleForDay(cycle, escalations, now)
  const cycleUnit = schedule ? schedule.unit ?? 'mcg' : '—'
  const nextDose = findNextPkDose(cycle, escalations, now)
  const canProject = Boolean(nextDose && (!FEATURES.planTimelineV2 || (
    schedule && pkProfileMethod?.trim()
    && nextDose.method?.trim().toLocaleLowerCase() === pkProfileMethod.trim().toLocaleLowerCase()
    && nextDose.dose != null && nextDose.dose > 0 && nextDose.unit
    && toPkMilligrams(nextDose.dose, nextDose.unit, umrechnung.iuPerMg ?? null, umrechnung.mgPerMl ?? null) != null
  )))
  const nextDoseIn = nextDose ? formatDurationShort(nextDose.timestamp.getTime() - now.getTime()) : '—'

  if (!takenEvents.length) {
    return {
      ...EMPTY_CURRENT_LEVEL,
      nextDoseIn,
      levelAfterNextDose: canProject ? 0 : null,
      unit: cycleUnit,
      interruptedAt,
    }
  }

  const curve = calculateHistoryBlutspiegelCurve(
    events,
    halfLifeHours,
    tmaxHours,
    bioavailability,
    30,
    interruptedAt ? new Date(interruptedAt) : null,
    umrechnung,
  )

  if (!curve.length) {
    return {
      ...EMPTY_CURRENT_LEVEL,
      nextDoseIn,
      levelAfterNextDose: canProject ? 0 : null,
      unit: cycleUnit,
      interruptedAt,
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
    30,
    interruptedAt ? new Date(interruptedAt) : null,
    umrechnung,
  )
  const tenHoursAgo = new Date(now.getTime() - 10 * 3_600_000)
  const recentSpark = sparkCurve.filter(p => p.time.getTime() >= tenHoursAgo.getTime())
  const sparkData = sampleSparkData(
    recentSpark.length >= 20 ? recentSpark.slice(-20) : recentSpark,
    20,
  )

  const futureCurve = interruptedAt || !canProject || !nextDose || nextDose.dose == null || nextDose.unit == null
    ? []
    : calculateCurveTo(
        [...takenEvents, {
          timestamp: nextDose.timestamp,
          dose: nextDose.dose,
          unit: nextDose.unit,
          status: 'planned',
        }],
        new Date(nextDose.timestamp.getTime() + tmaxHours * 3_600_000 * 2),
        halfLifeHours,
        tmaxHours,
        bioavailability,
        30,
        umrechnung,
      )
  const afterNext = nextDose ? futureCurve.filter(p => p.time.getTime() >= nextDose.timestamp.getTime()) : []
  const levelAfterNextDose = !canProject ? null : afterNext.length
    ? Math.max(...afterNext.map(p => p.level))
    : currentLevel

  return {
    currentLevel,
    trend,
    sparkData,
    nextDoseIn,
    levelAfterNextDose,
    peakLabel: peakLabelFromCurve(curve, now),
    unit: cycleUnit,
    interruptedAt,
  }
}
