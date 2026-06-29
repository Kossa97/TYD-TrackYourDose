// src/lib/injectionPersistence.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { differenceInCalendarDays, format, parseISO, startOfDay, subDays } from 'date-fns'
import {
  AUTO_MISSED_NOTE,
  collectOpenIntakes,
  cycleAppliesToDay,
  effectiveDose,
  type EscalationRow,
  type IntakeLog,
  type ScheduleCycle,
} from './intakeSchedule'
import { debitPeptideStockForDoseById } from './peptideStock'
import type { InjectionLog3D, InjectionPinDraft, SelectableInjectionCycle } from './injectionLogTypes'

const INJECTABLE_METHODS = ['Subkutan', 'IntramuskulÃ¤r', 'Intramuskulaer']

interface SaveInjectionInput {
  userId: string
  doseLogId: string | null
  peptideId: string | null
  cycleId: string | null
  dose: number | null
  unit: string | null
  method: string | null
  notes: string | null
  loggedAt: string
  warningState: string | null
  substanceLabel?: string | null
  pin: InjectionPinDraft
}

export function buildInjectionInsertPayload(input: SaveInjectionInput) {
  return {
    user_id: input.userId,
    dose_log_id: input.doseLogId,
    peptide_id: input.peptideId,
    cycle_id: input.cycleId,
    dose: input.dose,
    unit: input.unit,
    method: input.method,
    notes: input.notes?.trim() || null,
    logged_at: input.loggedAt,
    site: `${input.pin.body_region}_${input.pin.body_side}`,
    substance_label: input.substanceLabel?.trim() || null,
    body_region: input.pin.body_region,
    body_side: input.pin.body_side,
    model_version: input.pin.model_version,
    position: input.pin.position,
    normal: input.pin.normal,
    uv: input.pin.uv ?? null,
    camera_state: input.pin.camera_state ?? null,
    warning_state: input.warningState,
  }
}

export function isInjectionProSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  const message = candidate.message?.toLowerCase() ?? ''
  return (
    candidate.code === 'PGRST204' ||
    candidate.code === '42703' ||
    (message.includes('schema cache') && message.includes('injection_logs') && message.includes('column'))
  )
}

export async function assertInjectionProSchema(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase
    .from('injection_logs')
    .select('peptide_id, cycle_id, dose, unit, method, body_region, body_side, model_version, position, normal, uv, camera_state, warning_state, substance_label')
    .limit(0)
  if (error) throw error
}

export async function loadInjectionLogs(
  supabase: SupabaseClient,
  userId: string,
): Promise<InjectionLog3D[]> {
  const enrichedResult = await supabase
    .from('injection_logs')
    .select('*, peptides(name), cycles(name)')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(300)

  let data = enrichedResult.data as any[] | null
  let error = enrichedResult.error

  if (error?.code === 'PGRST200') {
    const plainResult = await supabase
      .from('injection_logs')
      .select('*')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(300)
    data = plainResult.data as any[] | null
    error = plainResult.error
  }

  if (error) throw error

  const rows = data ?? []
  const linkedDoseLogIds = Array.from(new Set(
    rows
      .map((row: any) => row.dose_log_id as string | null | undefined)
      .filter((id): id is string => Boolean(id)),
  ))
  const doseTakenById = new Map<string, boolean | null>()
  if (linkedDoseLogIds.length > 0) {
    const { data: doseRows, error: doseError } = await supabase
      .from('dose_logs')
      .select('id, taken')
      .eq('user_id', userId)
      .in('id', linkedDoseLogIds)
    if (!doseError) {
      for (const row of doseRows ?? []) doseTakenById.set(row.id as string, row.taken as boolean | null)
    }
  }

  return rows.map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    dose_log_id: row.dose_log_id ?? null,
    dose_taken: row.dose_log_id ? doseTakenById.get(row.dose_log_id) : undefined,
    peptide_id: row.peptide_id ?? null,
    cycle_id: row.cycle_id ?? null,
    peptide_name: Array.isArray(row.peptides) ? row.peptides[0]?.name ?? null : row.peptides?.name ?? null,
    cycle_name: Array.isArray(row.cycles) ? row.cycles[0]?.name ?? null : row.cycles?.name ?? null,
    dose: row.dose == null ? null : Number(row.dose),
    unit: row.unit ?? null,
    method: row.method ?? null,
    notes: row.notes ?? null,
    logged_at: row.logged_at,
    created_at: row.created_at ?? null,
    model_version: row.model_version ?? 'legacy-2d',
    body_region: row.body_region ?? 'outside_typical',
    body_side: row.body_side ?? 'center',
    position: row.position ?? { x: 0, y: 0, z: 0 },
    normal: row.normal ?? { x: 0, y: 0, z: 1 },
    uv: row.uv ?? null,
    camera_state: row.camera_state ?? null,
    warning_state: row.warning_state ?? null,
    substance_label: row.substance_label ?? null,
  })) as InjectionLog3D[]
}

export async function saveInjectionLog(
  supabase: SupabaseClient,
  input: SaveInjectionInput,
): Promise<string> {
  const { data, error } = await supabase
    .from('injection_logs')
    .insert(buildInjectionInsertPayload(input))
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

export async function loadSelectableInjectionCycles(
  supabase: SupabaseClient,
  userId: string,
): Promise<SelectableInjectionCycle[]> {
  const { data, error } = await supabase
    .from('cycles')
    .select('id, peptide_id, name, dose, unit, method, active, peptides(name)')
    .eq('user_id', userId)
    .eq('active', true)
    .in('method', INJECTABLE_METHODS)
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    peptide_id: row.peptide_id,
    peptide_name: Array.isArray(row.peptides) ? row.peptides[0]?.name ?? row.name : row.peptides?.name ?? row.name,
    cycle_name: row.name,
    dose: Number(row.dose),
    unit: row.unit,
    method: row.method,
  }))
}

export type InjectionIntakeStatus = 'open' | 'confirmed'

export interface OpenInjectionIntake {
  cycleId: string | null
  peptideId: string
  peptideName: string
  cycleName: string
  dose: number
  unit: string
  method: string
  scheduledAt: string
  daysOverdue: number
  status: InjectionIntakeStatus
  doseLogId: string | null
}

interface InjectionDoseLog extends IntakeLog {
  id: string
  dose: number
  unit: string
  method: string
  notes?: string | null
  peptides?: { name?: string; default_method?: string } | Array<{ name?: string; default_method?: string }> | null
}

interface InjectionCycleRow extends ScheduleCycle {
  active?: boolean
  name?: string
  method?: string
  peptides?: { name?: string } | Array<{ name?: string }> | null
}

function peptideName(cycle: InjectionCycleRow | undefined): string {
  if (Array.isArray(cycle?.peptides)) return cycle.peptides[0]?.name ?? cycle.name ?? 'Substanz'
  return cycle?.peptides?.name ?? cycle?.name ?? 'Substanz'
}

function cycleName(cycle: InjectionCycleRow | undefined): string {
  return cycle?.name ?? ''
}

function isAutoMissedDoseLog(log: InjectionDoseLog): boolean {
  return log.taken === false && log.notes === AUTO_MISSED_NOTE
}

function isOpenDoseLog(log: InjectionDoseLog): boolean {
  return log.taken === null || isAutoMissedDoseLog(log)
}

function doseLogSlotKey(log: InjectionDoseLog): string {
  const loggedAt = parseISO(log.logged_at)
  const minutes = loggedAt.getHours() * 60 + loggedAt.getMinutes()
  return `${log.peptide_id}|${format(loggedAt, 'yyyy-MM-dd')}|${minutes}`
}

function openIntakeSlotKey(open: { peptideId: string; dateKey: string; minutes: number }): string {
  return `${open.peptideId}|${open.dateKey}|${open.minutes}`
}

export function injectionIntakeLookbackStart(now: Date, lookbackDays = 90): Date {
  return startOfDay(subDays(now, lookbackDays))
}
export function buildSelectableInjectionIntakes({
  cycles,
  logs,
  linkedDoseLogIds,
  escalations,
  now,
  lookbackDays = 90,
}: {
  cycles: InjectionCycleRow[]
  logs: InjectionDoseLog[]
  linkedDoseLogIds: Set<string>
  escalations: EscalationRow[]
  now: Date
  lookbackDays?: number
}): OpenInjectionIntake[] {
  const activeCycles = cycles.filter(cycle => cycle.active !== false)
  const openDoseLogBySlot = new Map(
    logs
      .filter(log => isOpenDoseLog(log) && !linkedDoseLogIds.has(log.id))
      .map(log => [doseLogSlotKey(log), log]),
  )
  const linkedOpenSlotKeys = new Set(
    logs
      .filter(log => isOpenDoseLog(log) && linkedDoseLogIds.has(log.id))
      .map(doseLogSlotKey),
  )
  const logsForOpenSlots = logs.filter(log => !isAutoMissedDoseLog(log))
  const openIntakes = collectOpenIntakes(activeCycles, logsForOpenSlots, now, lookbackDays).flatMap(open => {
    const slotKey = openIntakeSlotKey(open)
    if (linkedOpenSlotKeys.has(slotKey)) return []

    const cycle = activeCycles.find(candidate => candidate.id === open.cycleId)
    const openDoseLog = openDoseLogBySlot.get(slotKey)
    const day = startOfDay(parseISO(open.dateKey))
    const scheduledAt = new Date(day.getTime() + open.minutes * 60000)
    return [{
      cycleId: open.cycleId,
      peptideId: open.peptideId,
      peptideName: peptideName(cycle),
      cycleName: cycleName(cycle),
      dose: openDoseLog ? Number(openDoseLog.dose) : cycle ? effectiveDose(cycle, day, escalations) : 0,
      unit: openDoseLog?.unit ?? cycle?.unit ?? '',
      method: openDoseLog?.method ?? cycle?.method ?? 'Subkutan',
      scheduledAt: openDoseLog?.logged_at ?? scheduledAt.toISOString(),
      daysOverdue: Math.max(0, differenceInCalendarDays(startOfDay(now), day)),
      status: 'open' as const,
      doseLogId: openDoseLog?.id ?? null,
    }]
  })

  const earliestDay = injectionIntakeLookbackStart(now, lookbackDays)
  const confirmedIntakes = logs.flatMap((log): OpenInjectionIntake[] => {
    if (log.taken !== true || linkedDoseLogIds.has(log.id)) return []
    const day = startOfDay(parseISO(log.logged_at))
    if (day < earliestDay || day > startOfDay(now)) return []

    const peptideCycles = cycles.filter(cycle => cycle.peptide_id === log.peptide_id)
    const cycle = peptideCycles.find(candidate => cycleAppliesToDay(candidate, day)) ?? peptideCycles[0]
    const logPeptide = Array.isArray(log.peptides) ? log.peptides[0] : log.peptides
    const resolvedMethod = INJECTABLE_METHODS.includes(log.method)
      ? log.method
      : cycle?.method || logPeptide?.default_method || ''
    if (!INJECTABLE_METHODS.includes(resolvedMethod)) return []

    return [{
      cycleId: cycle?.id ?? null,
      peptideId: log.peptide_id,
      peptideName: logPeptide?.name ?? peptideName(cycle),
      cycleName: cycleName(cycle),
      dose: Number(log.dose),
      unit: log.unit,
      method: resolvedMethod,
      scheduledAt: log.logged_at,
      daysOverdue: Math.max(0, differenceInCalendarDays(startOfDay(now), day)),
      status: 'confirmed',
      doseLogId: log.id,
    }]
  })

  return [...openIntakes, ...confirmedIntakes]
}

export async function loadSelectableInjectionIntakes(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<OpenInjectionIntake[]> {
  const [cyclesRes, logsRes, escRes, linkedRes] = await Promise.all([
    supabase.from('cycles').select('*, peptides(name, default_method)').eq('user_id', userId).in('method', INJECTABLE_METHODS),
    supabase
      .from('dose_logs')
      .select('id, peptide_id, dose, unit, method, logged_at, taken, notes, peptides(name, default_method)')
      .eq('user_id', userId)
      .gte('logged_at', injectionIntakeLookbackStart(now).toISOString())
      .order('logged_at', { ascending: false }),
    supabase.from('dose_escalations').select('cycle_id, increase_amount, start_type, start_date, start_after_days').eq('user_id', userId),
    supabase.from('injection_logs').select('dose_log_id').eq('user_id', userId).not('dose_log_id', 'is', null),
  ])
  if (cyclesRes.error) throw cyclesRes.error
  if (logsRes.error) throw logsRes.error
  if (escRes.error) throw escRes.error
  if (linkedRes.error) throw linkedRes.error

  const cycles = (cyclesRes.data ?? []) as InjectionCycleRow[]
  const logs = (logsRes.data ?? []) as InjectionDoseLog[]
  const linkedDoseLogIds = new Set((linkedRes.data ?? []).map(row => row.dose_log_id as string))
  const intakes = buildSelectableInjectionIntakes({
    cycles,
    logs,
    linkedDoseLogIds,
    escalations: (escRes.data ?? []) as EscalationRow[],
    now,
  })

  if (import.meta.env.DEV) {
    const todayKey = format(now, 'yyyy-MM-dd')
    const todayLogs = logs.filter(log => format(parseISO(log.logged_at), 'yyyy-MM-dd') === todayKey)
    const todayConfirmedLogs = todayLogs.filter(log => log.taken === true)
    const selectableConfirmed = intakes.filter(intake => intake.status === 'confirmed')
    const selectableConfirmedToday = selectableConfirmed.filter(
      intake => format(parseISO(intake.scheduledAt), 'yyyy-MM-dd') === todayKey,
    )
    console.info('[InjectionIntakes] Auswahl geladen', {
      today: todayKey,
      doseLogs: logs.length,
      confirmedDoseLogs: logs.filter(log => log.taken === true).length,
      linkedDoseLogs: linkedDoseLogIds.size,
      selectableConfirmed: selectableConfirmed.length,
      todayDoseLogs: todayLogs.length,
      todayConfirmedDoseLogs: todayConfirmedLogs.length,
      todayLinkedDoseLogs: todayConfirmedLogs.filter(log => linkedDoseLogIds.has(log.id)).length,
      todaySelectableConfirmed: selectableConfirmedToday.length,
      todayExcludedAfterLoad: todayConfirmedLogs.length
        - todayConfirmedLogs.filter(log => linkedDoseLogIds.has(log.id)).length
        - selectableConfirmedToday.length,
    })
  }

  return intakes
}
export async function resolveInjectionDoseLogId(
  intake: OpenInjectionIntake,
  confirmOpenIntake: () => Promise<string>,
): Promise<string> {
  if (intake.status === 'confirmed') {
    if (!intake.doseLogId) throw new Error('Confirmed intake is missing doseLogId')
    return intake.doseLogId
  }
  return confirmOpenIntake()
}

export function isDoseLogAlreadyLinkedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string }
  return candidate.code === '23505' && (candidate.message ?? '').includes('injection_logs_dose_log_id_unique_idx')
}
// Insert a confirmed dose_log for an intake and debit the peptide vial stock,
// matching the Dashboard confirmation. Returns the new dose_log id to link.
export async function confirmIntakeDoseLog(
  supabase: SupabaseClient,
  input: { userId: string; peptideId: string; dose: number; unit: string; method: string; loggedAt: string; doseLogId?: string | null },
): Promise<string> {
  if (input.doseLogId) {
    const { error } = await supabase
      .from('dose_logs')
      .update({
        dose: input.dose,
        unit: input.unit,
        method: input.method,
        logged_at: input.loggedAt,
        taken: true,
      })
      .eq('id', input.doseLogId)
      .eq('user_id', input.userId)
    if (error) throw error
    await debitPeptideStockForDoseById(supabase, input.userId, input.peptideId, input.dose, input.unit)
    return input.doseLogId
  }

  const { data, error } = await supabase
    .from('dose_logs')
    .insert({
      user_id: input.userId,
      peptide_id: input.peptideId,
      dose: input.dose,
      unit: input.unit,
      method: input.method,
      logged_at: input.loggedAt,
      taken: true,
    })
    .select('id')
    .single()
  if (error) throw error
  await debitPeptideStockForDoseById(supabase, input.userId, input.peptideId, input.dose, input.unit)
  return data.id as string
}
