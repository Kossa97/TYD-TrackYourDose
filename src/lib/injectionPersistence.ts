// src/lib/injectionPersistence.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { InjectionLog3D, InjectionPinDraft, SelectableInjectionCycle } from './injectionLogTypes'

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

export async function loadInjectionLogs(
  supabase: SupabaseClient,
  userId: string,
): Promise<InjectionLog3D[]> {
  const { data, error } = await supabase
    .from('injection_logs')
    .select('*, peptides(name), cycles(name)')
    .eq('user_id', userId)
    .order('logged_at', { ascending: false })
    .limit(300)
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
    .in('method', ['Subkutan', 'Intramuskulär', 'Intramuskulaer'])
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
