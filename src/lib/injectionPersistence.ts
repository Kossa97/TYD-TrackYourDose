// src/lib/injectionPersistence.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseISO, startOfDay } from 'date-fns'
import { collectOpenIntakes, effectiveDose, type EscalationRow, type IntakeLog, type ScheduleCycle } from './intakeSchedule'
import { debitPeptideStockForDoseById } from './peptideStock'
import type { InjectionLog3D, InjectionPinDraft, SelectableInjectionCycle } from './injectionLogTypes'

const INJECTABLE_METHODS = ['Subkutan', 'Intramuskulär', 'Intramuskulaer']

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
  return (data ?? []).map((row: any) => ({
    id: row.id,
    user_id: row.user_id,
    dose_log_id: row.dose_log_id ?? null,
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

export interface OpenInjectionIntake {
  cycleId: string
  peptideId: string
  peptideName: string
  cycleName: string
  dose: number
  unit: string
  method: string
  scheduledAt: string
  daysOverdue: number
}

// Active injectable cycles' open (due/overdue) intakes, enriched with the
// effective dose and a concrete scheduled timestamp for retroactive logging.
export async function loadOpenInjectionIntakes(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date(),
): Promise<OpenInjectionIntake[]> {
  const [cyclesRes, logsRes, escRes] = await Promise.all([
    supabase.from('cycles').select('*, peptides(name)').eq('user_id', userId).eq('active', true).in('method', INJECTABLE_METHODS),
    supabase.from('dose_logs').select('peptide_id, logged_at, taken').eq('user_id', userId),
    supabase.from('dose_escalations').select('cycle_id, increase_amount, start_type, start_date, start_after_days').eq('user_id', userId),
  ])
  if (cyclesRes.error) throw cyclesRes.error
  const cycles = (cyclesRes.data ?? []) as any[]
  const logs = (logsRes.data ?? []) as IntakeLog[]
  const escalations = (escRes.data ?? []) as EscalationRow[]

  return collectOpenIntakes(cycles as ScheduleCycle[], logs, now).map(open => {
    const cycle = cycles.find(c => c.id === open.cycleId)
    const day = startOfDay(parseISO(open.dateKey))
    const scheduledAt = new Date(day.getTime() + open.minutes * 60000)
    const peptideName = Array.isArray(cycle?.peptides)
      ? cycle?.peptides[0]?.name ?? cycle?.name
      : cycle?.peptides?.name ?? cycle?.name
    return {
      cycleId: open.cycleId,
      peptideId: open.peptideId,
      peptideName: peptideName ?? 'Substanz',
      cycleName: cycle?.name ?? '',
      dose: cycle ? effectiveDose(cycle as ScheduleCycle, day, escalations) : 0,
      unit: cycle?.unit ?? '',
      method: cycle?.method ?? 'Subkutan',
      scheduledAt: scheduledAt.toISOString(),
      daysOverdue: Math.max(0, Math.round((startOfDay(now).getTime() - day.getTime()) / 86_400_000)),
    }
  })
}

// Insert a confirmed dose_log for an intake and debit the peptide vial stock,
// matching the Dashboard confirmation. Returns the new dose_log id to link.
export async function confirmIntakeDoseLog(
  supabase: SupabaseClient,
  input: { userId: string; peptideId: string; dose: number; unit: string; method: string; loggedAt: string },
): Promise<string> {
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
